/**
 * Total Wine — 端到端业务 API demo
 *
 * 步骤：
 *   Step 1: 生成 _px2 (3 POST 链含 seq=2 cookie-confirmation beacon)
 *   Step 2: 用 _px2 GET totalwine.com 搜索结果页 → 期望 ~1.3 MB 真实 HTML
 *
 * 必需 env：
 *   HTTPS_PROXY=http://<user>-session-<id>:<pwd>@<host>:<port>   # 美国住宅代理
 *
 * 用法：
 *   $env:HTTPS_PROXY = 'http://...'
 *   node business_api_demo.js                  # 默认查 "wine"
 *   node business_api_demo.js "bourbon"        # 查别的
 *
 * 期望输出（2026-05-25 实测，BrightData US residential）：
 *   [proxy] using http://...:***@zproxy.lum-superproxy.io:22225
 *   ━━━ Step 1: 生成 _px2 (3 POST chain) ━━━
 *   ✅ _px2=eyJ1IjoiYWIxMjM0NTAtNTgz…  ttl=330  (~6500ms)
 *      uuid=ab123450-583c-11f1-…  vid=ab234560-583c-11f1-…
 *      seq=2 beacon: 200 ✓
 *
 *   ━━━ Step 2: GET search/all?text=wine ━━━
 *   ✅ HTTP 200 — 真实 HTML 内容 1,328,242 bytes
 *      title: "wine - Search | Total Wine & More"
 *      products: 找到 24 个 .product-tile 块
 *      → 完整 SRP 拿到
 *
 * 退出码：
 *   0 = 成功
 *   1 = 配置/环境错误
 *   2 = PX 层拦截 (HTTP 403 + bootstrap JSON, 或 5745B captcha)
 *   3 = 下游业务层错误
 */

const https = require('https');

// ─── Proxy 配置：从 HTTPS_PROXY env var 读 ───
const proxyUrl = process.env.HTTPS_PROXY || process.env.https_proxy;
if (!proxyUrl) {
    console.error('❌ 必须设 HTTPS_PROXY env var (美国住宅代理):');
    console.error('   PowerShell: $env:HTTPS_PROXY = "http://<user>-session-<id>:<pwd>@<host>:<port>"');
    console.error('   bash:       export HTTPS_PROXY="http://<user>-session-<id>:<pwd>@<host>:<port>"');
    process.exit(1);
}
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
    console.error('[proxy] https-proxy-agent not installed. Run: npm i https-proxy-agent');
    process.exit(1);
}

const generatePx2 = require('./totalwine_px2');

// 默认搜索词（可通过 argv[2] 覆盖）
const DEFAULT_QUERY = 'wine';

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36';

function getSrp(query, cookies, ua) {
    const url = new URL(`https://www.totalwine.com/search/all?text=${encodeURIComponent(query)}`);
    const cookieStr = Object.entries(cookies).map(([k, v]) => `${k}=${v}`).join('; ');

    return new Promise((resolve, reject) => {
        const req = https.request({
            method: 'GET',
            hostname: url.hostname,
            path: url.pathname + url.search,
            headers: {
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9',
                'User-Agent': ua,
                'Referer': 'https://www.totalwine.com/',
                'Cookie': cookieStr,
            }
        }, (res) => {
            const chunks = [];
            res.on('data', c => chunks.push(c));
            res.on('end', () => resolve({
                status: res.statusCode,
                headers: res.headers,
                body: Buffer.concat(chunks).toString('utf-8'),
            }));
        });
        req.on('error', reject);
        req.end();
    });
}

(async () => {
    const query = process.argv[2] || DEFAULT_QUERY;

    console.log('\n━━━ Step 1: 生成 _px2 (3 POST chain) ━━━');
    const t0 = Date.now();
    const px = await generatePx2();
    const genMs = Date.now() - t0;

    if (!px.cookie_name) {
        console.error('❌ _px2 生成失败:', px.error || 'unknown');
        process.exit(1);
    }
    console.log(`✅ ${px.cookie_name}=${px.cookie_value.slice(0, 40)}…  ttl=${px.ttl}  (${genMs}ms)`);
    console.log(`   uuid=${px.uuid}  vid=${px.state.vid}`);
    console.log(`   seq=2 beacon: ${px.collector3_status} ${px.collector3_status === 200 ? '✓' : '⚠️'}`);

    console.log(`\n━━━ Step 2: GET search/all?text=${query} ━━━`);
    const cookies = { _px2: px.cookie_value };
    if (px.state.vid) cookies._pxvid = px.state.vid;
    console.log(`   cookies: ${Object.keys(cookies).join(', ')}`);

    const t1 = Date.now();
    const res = await getSrp(query, cookies, UA);
    const apiMs = Date.now() - t1;

    console.log(`\nSRP response: HTTP ${res.status}  (${apiMs}ms)  body=${res.body.length} bytes`);

    // 严档部署判别 — 看响应 body
    const isPxBlock = res.body.includes('PXFF0j69T5') && res.body.includes('jsClientSrc') && res.body.length < 1000;
    const isCaptcha = res.body.includes('px-captcha');

    if (res.status === 200 && res.body.length > 100000) {
        console.log('✅ 业务页面调通 — _px2 通过 PX 严档边缘\n');
        // 简单提取一些信息
        const titleMatch = res.body.match(/<title>([^<]+)<\/title>/);
        if (titleMatch) console.log(`   title: ${titleMatch[1]}`);
        const productCount = (res.body.match(/class="[^"]*product-tile/g) || []).length;
        console.log(`   products: 找到 ${productCount} 个 .product-tile 块`);
        console.log(`\n━━━ 总耗时: ${genMs + apiMs}ms  (gen ${genMs} + api ${apiMs}) ━━━`);
        process.exit(0);
    } else if (isPxBlock) {
        console.log('❌ PX bootstrap JSON (427B) — cookie 被标 trust=low');
        console.log('   症状参考: skill/AI_re/references/gotchas.md Bug #15');
        console.log('   排查方向: 重抓 6 批样本 → diff_ev2_ours_vs_real.py 找 bot signal');
        console.log(`\n   response body: ${res.body.slice(0, 400)}`);
        process.exit(2);
    } else if (isCaptcha) {
        console.log('🧩 PX captcha challenge — proxy IP 信任度太低');
        console.log('   尝试: 换 -session-<id> 拿新住宅 IP，或换代理 zone');
        process.exit(2);
    } else if (res.status === 403) {
        console.log('❌ 403 但非 PX block — 可能 WAF / TLS 指纹问题');
        console.log(`   response: ${res.body.slice(0, 400)}`);
        process.exit(2);
    } else {
        console.log(`⚠️  HTTP ${res.status} — 非标准响应`);
        console.log(res.body.slice(0, 400));
        process.exit(3);
    }
})().catch(e => {
    console.error('❌', e.message);
    process.exit(1);
});
