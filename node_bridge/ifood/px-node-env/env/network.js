const { request } = require('undici');

/**
 * 拦截的请求记录
 */
const interceptedRequests = [];

/**
 * 安装网络层补丁
 * @param {Window} window - JSDOM window 对象
 * @param {Object} config - 配置对象
 */
function installNetworkPatch(window, config = {}) {
  // 保存原始 XMLHttpRequest
  const OriginalXHR = window.XMLHttpRequest;

  // Mock XMLHttpRequest
  class MockXMLHttpRequest {
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
      this._requestData = null;
      this._async = true;

      // 事件处理器
      this.onreadystatechange = null;
      this.onload = null;
      this.onerror = null;
      this.ontimeout = null;
      this.onabort = null;
      this.onloadstart = null;
      this.onloadend = null;
      this.onprogress = null;
    }

    open(method, url, async = true, user, password) {
      this._method = method;
      this._url = url;
      this._async = async;
      this._changeReadyState(1); // OPENED
    }

    setRequestHeader(header, value) {
      this._headers[header] = value;
    }

    send(data) {
      this._requestData = data;
      this._changeReadyState(1); // OPENED

      // 判断是否是 collector 请求
      if (this._url && this._url.includes('collector')) {
        console.log('[NETWORK] Intercepted collector request:', this._url);
        const requestInfo = {
          method: this._method,
          url: this._url,
          headers: this._headers,
          data: this._requestData,
          timestamp: Date.now(),
        };
        interceptedRequests.push(requestInfo);
        
        // 记录 payload 到文件
        try {
          const fs = require('fs');
          const path = require('path');
          const payloadPath = path.join(__dirname, '../.checkpoint/payload-latest.json');
          const payloadDir = path.dirname(payloadPath);
          if (!fs.existsSync(payloadDir)) {
            fs.mkdirSync(payloadDir, { recursive: true });
          }
          
          let payloadData = {};
          try {
            payloadData = JSON.parse(this._requestData);
          } catch (e) {
            payloadData = { raw: this._requestData };
          }
          
          fs.writeFileSync(payloadPath, JSON.stringify(payloadData, null, 2), 'utf8');
          console.log('[PAYLOAD] Saved to:', payloadPath);
        } catch (e) {
          console.error('[PAYLOAD] Failed to save:', e.message);
        }

        // 使用 undici 发送真实请求
        this._sendRealRequest();
      } else {
        // 非 collector 请求，模拟响应
        this._mockResponse();
      }
    }

    async _sendRealRequest() {
      try {
        const url = this._url.startsWith('http') ? this._url : `https:${this._url}`;
        
        this._changeReadyState(2); // HEADERS_RECEIVED
        this._changeReadyState(3); // LOADING

        const response = await request(url, {
          method: this._method,
          headers: this._headers,
          body: this._requestData,
        });

        this.status = response.statusCode;
        this.statusText = response.statusCode === 200 ? 'OK' : 'Error';
        this.responseURL = url;

        // Parse set-cookie headers from collector response
        const setCookieHeaders = response.headers['set-cookie'];
        if (setCookieHeaders) {
          const cookies = Array.isArray(setCookieHeaders) ? setCookieHeaders : [setCookieHeaders];
          cookies.forEach(cookie => {
            const nameValue = cookie.split(';')[0];
            if (nameValue) {
              try {
                const doc = window.document;
                doc.cookie = nameValue;
                console.log('[NETWORK] Set cookie from response:', nameValue.split('=')[0]);
              } catch(e) {}
            }
          });
        }

        const responseBody = await response.body.text();
        this.responseText = responseBody;
        this.response = responseBody;

        // Parse response body for cookie directives
        try {
          const respJson = JSON.parse(responseBody);
          if (respJson.do && Array.isArray(respJson.do)) {
            respJson.do.forEach(directive => {
              if (typeof directive === 'string' && directive.includes('bake|')) {
                // PX cookie bake directive
                const parts = directive.split('|');
                if (parts.length >= 3) {
                  const cookieName = parts[1];
                  const cookieValue = parts[2];
                  try {
                    window.document.cookie = `${cookieName}=${cookieValue}`;
                    console.log('[NETWORK] Baked cookie from response:', cookieName);
                  } catch(e) {}
                }
              }
            });
          }
        } catch(e) {}

        console.log('[NETWORK] Real request completed:', {
          url,
          status: this.status,
          responseLength: responseBody.length,
        });
        console.log('[NETWORK] Response body:', responseBody.substring(0, 500));

        this._changeReadyState(4); // DONE

        if (this.onload) {
          this.onload({ type: 'load', target: this });
        }
      } catch (error) {
        console.error('[NETWORK] Request error:', error.message);
        this.status = 0;
        this.statusText = 'Error';
        this._changeReadyState(4); // DONE

        if (this.onerror) {
          this.onerror({ type: 'error', target: this, error });
        }
      }
    }

    _mockResponse() {
      setTimeout(() => {
        this.status = 200;
        this.statusText = 'OK';
        this.responseText = '{}';
        this.response = '{}';
        this._changeReadyState(4); // DONE

        if (this.onload) {
          this.onload({ type: 'load', target: this });
        }
      }, 10);
    }

    _changeReadyState(newState) {
      this.readyState = newState;
      if (this.onreadystatechange) {
        this.onreadystatechange({ type: 'readystatechange', target: this });
      }
    }

    abort() {
      if (this.onabort) {
        this.onabort({ type: 'abort', target: this });
      }
    }

    getAllResponseHeaders() {
      return 'content-type: application/json\r\n';
    }

    getResponseHeader(name) {
      if (name.toLowerCase() === 'content-type') {
        return 'application/json';
      }
      return null;
    }

    addEventListener(event, handler) {
      this[`on${event}`] = handler;
    }

    removeEventListener(event, handler) {
      if (this[`on${event}`] === handler) {
        this[`on${event}`] = null;
      }
    }
  }

  // 替换全局 XMLHttpRequest
  window.XMLHttpRequest = MockXMLHttpRequest;

  // Mock fetch（基础实现）
  window.fetch = async function(url, options = {}) {
    try {
      const fullUrl = url.startsWith('http') ? url : `https:${url}`;
      
      if (url.includes('collector')) {
        console.log('[NETWORK] Intercepted fetch collector request:', fullUrl);
        interceptedRequests.push({
          method: options.method || 'GET',
          url: fullUrl,
          headers: options.headers || {},
          data: options.body,
          timestamp: Date.now(),
        });
      }

      const response = await request(fullUrl, {
        method: options.method || 'GET',
        headers: options.headers,
        body: options.body,
      });

      const responseBody = await response.body.text();

      return {
        ok: response.statusCode >= 200 && response.statusCode < 300,
        status: response.statusCode,
        statusText: response.statusCode === 200 ? 'OK' : 'Error',
        headers: new Map(Object.entries(response.headers)),
        url: fullUrl,
        text: async () => responseBody,
        json: async () => JSON.parse(responseBody),
      };
    } catch (error) {
      console.error('[NETWORK] Fetch error:', error.message);
      throw error;
    }
  };

  console.log('[ENV] Network layer installed');
}

/**
 * 获取拦截的请求
 */
function getInterceptedRequests() {
  return interceptedRequests;
}

/**
 * 清空拦截的请求
 */
function clearInterceptedRequests() {
  interceptedRequests.length = 0;
}

module.exports = {
  installNetworkPatch,
  getInterceptedRequests,
  clearInterceptedRequests,
};
