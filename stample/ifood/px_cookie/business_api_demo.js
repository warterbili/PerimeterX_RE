/**
 * iFood 业务 API 端到端 demo —— _px3 → GraphQL → 商家数据
 *
 * 链路：
 *   1. generatePx3() → 拿 { cookie_value: _px3, state.vid, state.cts }
 *   2. 构造 Cookie: _px3=...; _pxvid=...; _pxcts=...
 *   3. POST https://cw-marketplace.ifood.com.br/v1/merchant-info/graphql
 *   4. 返回真实商家数据（name / userRating / available）
 *
 * 用法：
 *   node business_api_demo.js                                    # 用内置默认商家
 *   node business_api_demo.js <merchant_id>                      # 指定商家
 *
 * 期望输出：
 *   ✅ _px3=eyJ1IjoiYWJ…  ttl=330
 *   ✅ GraphQL 200 OK
 *   {
 *     "data": {
 *       "merchant": {
 *         "available": true,
 *         "name": "Pastel da Maria",
 *         "userRating": 4.7
 *       }
 *     }
 *   }
 *
 * 注意：
 *   - 这是 _px3 工作的真实证明（非 smoke_test 的 PX 内部 echo）
 *   - 业务 API 200 = 拿到的 _px3 评分足够高，不是低评分 cookie
 *   - 失败 403 通常是 IP 评分问题（住宅 IP / 巴西 IP 较安全）
 */

const https = require('https');

// ─── Optional HTTPS_PROXY support (set HTTPS_PROXY env var to use a proxy) ───
const proxyUrl = process.env.HTTPS_PROXY || process.env.https_proxy;
if (proxyUrl) {
    try {
        const { HttpsProxyAgent } = require('https-proxy-agent');
        const agent = new HttpsProxyAgent(proxyUrl);
        const orig = https.request;
        https.request = function(options, ...args) {
            if (typeof options === 'string') options = new URL(options);
            if (options && !options.agent) options.agent = agent;
            return orig.call(this, options, ...args);
        };
        console.log(`[proxy] using ${proxyUrl.replace(/:[^:@]+@/, ':***@')}`);
    } catch (e) {
        console.error('[proxy] https-proxy-agent not installed. npm i https-proxy-agent');
        process.exit(1);
    }
}

const generatePx3 = require('./ifood_px3');

// 默认商家 ID（实测 2026-05-21 仍活跃）
const DEFAULT_MERCHANT_ID = 'ccd2ff85-a898-4da3-bd72-428a66443a2f';

// São Paulo (圣保罗) — production code 用相同坐标
const LAT = -23.5505, LNG = -46.6333;

const GRAPHQL_URL = `https://cw-marketplace.ifood.com.br/v1/merchant-info/graphql?latitude=${LAT}&longitude=${LNG}&channel=IFOOD`;
const GRAPHQL_QUERY = 'query ($merchantId: String!) { merchant(merchantId: $merchantId, required: true) { available name userRating } }';

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36';

function postGraphQL(merchantId, cookies, ua) {
    const body = JSON.stringify({
        query: GRAPHQL_QUERY,
        variables: { merchantId }
    });

    const cookieStr = Object.entries(cookies)
        .map(([k, v]) => `${k}=${v}`)
        .join('; ');

    return new Promise((resolve, reject) => {
        const u = new URL(GRAPHQL_URL);
        const req = https.request({
            method: 'POST',
            hostname: u.hostname,
            path: u.pathname,
            headers: {
                'Accept': 'application/json, text/plain, */*',
                'Content-Type': 'application/json',
                'accept-language': 'pt-BR,pt;q=0.9',
                'user-agent': ua,
                'x-client-application-key': '41a266ee-51b7-4c37-9e9d-5cd331f280d5',
                'referer': 'https://www.ifood.com.br/',
                'origin': 'https://www.ifood.com.br',
                'cookie': cookieStr,
                'content-length': Buffer.byteLength(body),
            }
        }, (res) => {
            const chunks = [];
            res.on('data', c => chunks.push(c));
            res.on('end', () => resolve({
                status: res.statusCode,
                body: Buffer.concat(chunks).toString()
            }));
        });
        req.on('error', reject);
        req.write(body);
        req.end();
    });
}

(async () => {
    const merchantId = process.argv[2] || DEFAULT_MERCHANT_ID;

    console.log('━━━ Step 1: 生成 _px3 ━━━');
    const t0 = Date.now();
    const px = await generatePx3();
    const genMs = Date.now() - t0;

    if (!px.cookie_name) {
        console.error('❌ _px3 生成失败:', px.error || 'unknown');
        process.exit(1);
    }
    console.log(`✅ ${px.cookie_name}=${px.cookie_value.slice(0, 40)}…  ttl=${px.ttl}  (${genMs}ms)`);
    console.log(`   uuid=${px.uuid}  vid=${px.state.vid}`);

    console.log('\n━━━ Step 2: 用 _px3 调 GraphQL 抓商家 ━━━');
    const cookies = {
        _px3: px.cookie_value,
    };
    if (px.state.vid) cookies._pxvid = px.state.vid;
    if (px.state.cts) cookies._pxcts = px.state.cts;
    console.log(`   merchant_id: ${merchantId}`);
    console.log(`   cookies: ${Object.keys(cookies).join(', ')}`);

    const t1 = Date.now();
    const res = await postGraphQL(merchantId, cookies, UA);
    const apiMs = Date.now() - t1;

    console.log(`\nGraphQL response: HTTP ${res.status}  (${apiMs}ms)`);

    if (res.status === 200) {
        console.log('✅ 业务 API 调通 — _px3 评分足够\n');
        try {
            const data = JSON.parse(res.body);
            console.log(JSON.stringify(data, null, 2));
        } catch (e) {
            console.log(res.body.slice(0, 500));
        }
        console.log(`\n━━━ 总耗时: ${genMs + apiMs}ms  (gen ${genMs} + api ${apiMs}) ━━━`);
    } else if (res.status === 403) {
        console.log('❌ 403 — _px3 评分不够 / IP 评分太低');
        console.log('   常见原因：');
        console.log('   - 数据中心 IP（PX 拉黑）→ 换住宅代理');
        console.log('   - TLS 指纹被识别 → Node fetch 可能不够，试 curl_cffi (Python)');
        console.log('   - 频率太高 → 加间隔（每 IP ≥ 1s/次）');
        console.log(`\n   response body (前 300 字): ${res.body.slice(0, 300)}`);
        process.exit(2);
    } else {
        console.log(`⚠️  HTTP ${res.status}`);
        console.log(res.body.slice(0, 300));
        process.exit(3);
    }
})().catch(e => {
    console.error('❌', e.message);
    process.exit(1);
});
