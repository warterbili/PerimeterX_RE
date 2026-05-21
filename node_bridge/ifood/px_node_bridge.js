#!/usr/bin/env node
/**
 * PX Node Bridge - Generate PX collector payloads using Node.js env,
 * output them as JSON for Python to send via curl_cffi.
 * 
 * Flow:
 * 1. Build browser env in Node
 * 2. Intercept XHR/fetch to collector - DON'T send, just capture
 * 3. Output captured requests as JSON lines to stdout
 * 4. Read responses from stdin (Python sends via curl_cffi and pipes back)
 * 5. Feed responses back to PX SDK
 * 6. Extract cookies
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { buildEnvironment } = require('./px-node-env/env/builder');

const pendingRequests = new Map();
let requestId = 0;

function installProxyNetwork(window) {
  const rl = readline.createInterface({ input: process.stdin });
  
  // Promise resolvers for responses
  const responseResolvers = new Map();
  
  rl.on('line', (line) => {
    try {
      const resp = JSON.parse(line);
      const resolver = responseResolvers.get(resp.id);
      if (resolver) {
        resolver(resp);
        responseResolvers.delete(resp.id);
      }
    } catch(e) {
      process.stderr.write(`[BRIDGE] Failed to parse response: ${e.message}\n`);
    }
  });
  
  function waitForResponse(id) {
    return new Promise((resolve) => {
      responseResolvers.set(id, resolve);
      // Timeout after 30s
      setTimeout(() => {
        if (responseResolvers.has(id)) {
          responseResolvers.delete(id);
          resolve({ id, status: 0, body: '{}', error: 'timeout' });
        }
      }, 30000);
    });
  }

  class ProxyXHR {
    constructor() {
      this.readyState = 0;
      this.status = 0;
      this.statusText = '';
      this.responseText = '';
      this.response = '';
      this.responseType = '';
      this.responseURL = '';
      this.timeout = 0;
      this.withCredentials = false;
      this._method = null;
      this._url = null;
      this._headers = {};
      this._async = true;
      this.onreadystatechange = null;
      this.onload = null;
      this.onerror = null;
      this.ontimeout = null;
      this.onabort = null;
      this.onloadstart = null;
      this.onloadend = null;
      this.onprogress = null;
    }

    open(method, url, async = true) {
      this._method = method;
      this._url = url;
      this._async = async;
      this._changeReadyState(1);
    }

    setRequestHeader(header, value) {
      this._headers[header] = value;
    }

    async send(data) {
      const id = ++requestId;
      const url = this._url.startsWith('http') ? this._url : `https:${this._url}`;
      
      // Output request as JSON to stdout for Python
      const reqObj = {
        type: 'request',
        id: id,
        method: this._method,
        url: url,
        headers: this._headers,
        body: data
      };
      
      // Write to stdout
      process.stdout.write(JSON.stringify(reqObj) + '\n');
      process.stderr.write(`[BRIDGE] Request ${id}: ${this._method} ${url.substring(0, 80)}\n`);
      
      // Wait for Python to send back response
      const resp = await waitForResponse(id);
      
      this.status = resp.status || 200;
      this.statusText = this.status === 200 ? 'OK' : 'Error';
      this.responseURL = url;
      this.responseText = resp.body || '{}';
      this.response = this.responseText;
      
      process.stderr.write(`[BRIDGE] Response ${id}: status=${this.status} len=${this.responseText.length}\n`);
      
      // Handle set-cookie from response
      if (resp.cookies) {
        for (const cookie of resp.cookies) {
          try { window.document.cookie = cookie; } catch(e) {}
        }
      }
      
      // Handle PX bake commands from do field
      try {
        const respJson = JSON.parse(this.responseText);
        if (respJson.do && Array.isArray(respJson.do)) {
          for (const directive of respJson.do) {
            if (typeof directive === 'string' && directive.includes('bake|')) {
              const parts = directive.split('|');
              if (parts.length >= 3) {
                try { window.document.cookie = `${parts[1]}=${parts[2]}`; } catch(e) {}
              }
            }
          }
        }
      } catch(e) {}
      
      this._changeReadyState(2);
      this._changeReadyState(3);
      this._changeReadyState(4);
      
      if (this.onload) {
        this.onload({ type: 'load', target: this });
      }
    }

    _changeReadyState(newState) {
      this.readyState = newState;
      if (this.onreadystatechange) {
        this.onreadystatechange({ type: 'readystatechange', target: this });
      }
    }

    abort() { if (this.onabort) this.onabort({ type: 'abort', target: this }); }
    getAllResponseHeaders() { return 'content-type: application/json\r\n'; }
    getResponseHeader(name) {
      if (name.toLowerCase() === 'content-type') return 'application/json';
      return null;
    }
    addEventListener(event, handler) { this[`on${event}`] = handler; }
    removeEventListener(event, handler) { if (this[`on${event}`] === handler) this[`on${event}`] = null; }
  }

  window.XMLHttpRequest = ProxyXHR;

  // Mock fetch
  window.fetch = async function(url, options = {}) {
    const id = ++requestId;
    const fullUrl = url.startsWith('http') ? url : `https:${url}`;
    
    const reqObj = {
      type: 'request',
      id: id,
      method: options.method || 'GET',
      url: fullUrl,
      headers: options.headers || {},
      body: options.body || null
    };
    
    process.stdout.write(JSON.stringify(reqObj) + '\n');
    process.stderr.write(`[BRIDGE] Fetch ${id}: ${reqObj.method} ${fullUrl.substring(0, 80)}\n`);
    
    const resp = await waitForResponse(id);
    const responseBody = resp.body || '{}';
    
    return {
      ok: (resp.status || 200) >= 200 && (resp.status || 200) < 300,
      status: resp.status || 200,
      statusText: (resp.status || 200) === 200 ? 'OK' : 'Error',
      headers: new Map(Object.entries(resp.headers || {})),
      url: fullUrl,
      text: async () => responseBody,
      json: async () => JSON.parse(responseBody),
    };
  };

  process.stderr.write('[BRIDGE] Proxy network layer installed\n');
}

async function main() {
  process.stderr.write('[BRIDGE] Starting PX Node Bridge...\n');
  
  const { window, dom, document } = buildEnvironment({
    targetUrl: 'https://www.ifood.com.br',
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  });
  
  installProxyNetwork(window);
  
  // Load and execute PX SDK
  const pxSdkPath = path.join(__dirname, 'perimeterx/main.min.js');
  const pxCode = fs.readFileSync(pxSdkPath, 'utf8');
  
  process.stderr.write(`[BRIDGE] Loading PX SDK (${pxCode.length} bytes)...\n`);
  
  const scriptElement = document.createElement('script');
  scriptElement.textContent = pxCode;
  document.head.appendChild(scriptElement);
  
  process.stderr.write('[BRIDGE] PX SDK loaded, waiting for requests...\n');
  
  // Wait for PX to do its thing (full collector 链路: /ns + EV1 + EV2 + state echo)
  await new Promise(resolve => setTimeout(resolve, 30000));
  
  // Output cookies
  const cookies = document.cookie;
  const result = {
    type: 'result',
    cookies: cookies,
    px3: cookies.match(/_px3=([^;]+)/)?.[1] || null,
    pxvid: cookies.match(/_pxvid=([^;]+)/)?.[1] || null,
  };
  
  process.stdout.write(JSON.stringify(result) + '\n');
  process.stderr.write(`[BRIDGE] Done. Cookies: ${cookies.substring(0, 100)}\n`);
  
  dom.window.close();
  process.exit(0);
}

main().catch(e => {
  process.stderr.write(`[BRIDGE] Fatal: ${e.message}\n${e.stack}\n`);
  process.exit(1);
});
