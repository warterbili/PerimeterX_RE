/**
 * Grubhub 端到端实战 demo —— _px2 → 全链路（anonymous + login）
 *
 * 链路说明（PX 守 5 个端点，本 demo 验证其中 2 个）：
 *
 *   Stage 1: 纯算 generator → _px2 cookie
 *   Stage 2: POST api-gtm.grubhub.com/auth (anonymous scope) — PX 守门 #1
 *            → anonymous_token (UUID)
 *   Stage 3: POST api-gtm.grubhub.com/auth/login (with Bearer anon_token + email/pwd) — PX 守门 #2
 *            → 200 (登录成功) 或 463 (OTP needed) 都算 PX 通过
 *            → 403 算 PX 拦截
 *
 * Stage 3 是可选的：
 *   - 不设 GRUBHUB_EMAIL/GRUBHUB_PASSWORD → 只跑 Stage 1+2 (轻量验证 PX 第 1 关)
 *   - 设了 → 跑 full chain (验证 PX 在 2 个不同端点都通过)
 *
 * ⚠️ 环境要求:
 *   - HTTPS_PROXY 必须设为 **美国住宅代理**（建议）
 *     Grubhub 是美国站，PX 对非 US IP 评分降低；数据中心 IP 容易 403
 *     格式: http://<user>:<pwd>@<host>:<port>
 *   - 项目根 `npm install` 一次（装 https-proxy-agent）
 *
 * ⚠️ 凭据（占位符，必须替换成你自己的）:
 *   - 代理：BrightData country-us 住宅（替换 DEFAULT_BRD_PROXY 里的 <YOUR_BRD_*>）
 *   - 账号：必须是 **device-trusted** 的 Grubhub 账号（替换 DEFAULT_EMAIL / DEFAULT_PASSWORD）
 *   - 也可以用 env var 覆盖：HTTPS_PROXY / GRUBHUB_EMAIL / GRUBHUB_PASSWORD（推荐，凭据不入 git）
 *
 * 用法:
 *   # 一键跑（用内置默认）
 *   node business_api_demo.js
 *
 *   # 用自己的代理 / 账号
 *   export HTTPS_PROXY='http://<user>:<pwd>@<host>:<port>'
 *   export GRUBHUB_EMAIL='your@email.com'
 *   export GRUBHUB_PASSWORD='yourpassword'
 *   node business_api_demo.js
 *
 * 期望输出 (2026-05-23 实测，BrightData country-us，默认 device-trusted 账号):
 *   [proxy] using http://<user>:<pwd>@zproxy.lum-superproxy.io:22225
 *   ━━━ Stage 1: 生成 _px2 ━━━
 *   ✅ _px2=...  ttl=500  (~3500ms)
 *   ━━━ Stage 2: /auth (anonymous scope) ━━━
 *      HTTP 200  (~1500ms)
 *   ✅ PX 守门 #1 通过 — anon_token=...
 *   ━━━ Stage 3: /auth/login (real account) ━━━
 *      HTTP 200  (~1700ms)
 *   ✅ PX 守门 #2 通过 — 登录成功
 *      user access_token: <uuid>          (60min TTL)
 *      refresh_token:     <uuid>          (30 day TTL)
 *
 * 注意:
 *   - 200 = 账号 device-trusted（业务层认 device_id）；默认账号已预热
 *   - 463 (OTP needed) 也是 PX 通过 — 业务层因 device_id 陌生要 OTP（换账号或走 mail.tm OTP）
 *   - 403 表示 _px2 评分不够，PX 拦截 (换 IP / 算法检查)
 *   - 401 "Invalid client_id" 表示 PX 过了但 client_id 错（项目用 config.yaml 的值）
 *
 * ⚠️ 本 JS demo 只演示 PX 守门 #1 + #2 的核心证据（拿到 anon_token + user access_token）。
 *    完整 9 步端到端（含 SSO 4 步 → __Host-instacart_sid 落地到 grocery.grubhub.com）
 *    在下游生产项目里实现，见 ../live_validation/journal/2026-05-23.md §Part 2。
 *    本仓的 Python 全链路 demo 见 ./business_api_demo_full_chain.py。
 *
 * 退出码（跨 3 个 demo 统一）:
 *   0 = 成功
 *   1 = 配置/环境错误（代理 / 生成器 / 凭据缺失）
 *   2 = PX 层拦截（HTTP 403 + captcha）
 *   3 = 下游业务层错误（其它 HTTP 异常 / schema 不对）
 */

const https = require('https');
const crypto = require('crypto');

// ─── 代理凭据占位符（必须替换或走 env var 覆盖） ───
// 推荐用 env var：export HTTPS_PROXY='http://<user>:<pwd>@<host>:<port>'
const DEFAULT_BRD_PROXY = 'http://brd-customer-hl_<YOUR_BRD_ID>-zone-residential-country-us:<YOUR_BRD_PASSWORD>@zproxy.lum-superproxy.io:22225';
// 默认测试账号占位符（必须替换成你自己 device-trusted 的 Grubhub 账号或走 env var）
// device-trusted = 此账号已完整跑过一次 OTP 注册流程，Grubhub 业务层已把它的 device_id 入信任白名单
const DEFAULT_EMAIL    = '<YOUR_GRUBHUB_EMAIL>';
const DEFAULT_PASSWORD = '<YOUR_GRUBHUB_PASSWORD>';

const proxyUrl = process.env.HTTPS_PROXY || process.env.https_proxy || DEFAULT_BRD_PROXY;
if (proxyUrl.includes('<YOUR_BRD_')) {
    console.error('❌ 必须先设代理: 编辑 DEFAULT_BRD_PROXY 或 export HTTPS_PROXY=...');
    process.exit(1);
}
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
        // mask proxy URL when logging
        console.log(`[proxy] using ${proxyUrl.replace(/:\/\/[^:]+:[^@]+@/, '://<user>:<pwd>@')}`);
    } catch (e) {
        console.error('[proxy] https-proxy-agent missing. Run `npm install` at project root.');
        process.exit(1);
    }
} else {
    console.log('[proxy] HTTPS_PROXY not set — may fail without US residential IP');
}

const generatePx2 = require('./grubhub_px2');

const AUTH_URL  = 'https://api-gtm.grubhub.com/auth';
const LOGIN_URL = 'https://api-gtm.grubhub.com/auth/login';
const BRAND     = 'GRUBHUB';
const CLIENT_ID = 'beta_UmWlpstzQSFmocLy3h1UieYcVST';   // 从 Grubhub 网页 SPA 抓的硬编码常量
// ⚠️  UA must match the TLS impersonation profile used by the proxy / cffi layer.
// Production verified 2026-05-23: Chrome 120 UA + curl_cffi impersonate=chrome120
// passes PX on /auth, /auth/login, and SSO step 3. Mismatched UA (e.g. Chrome 148
// while impersonating chrome120) is detected as bot.
const UA        = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

function postJson(url, headers, bodyObj) {
    const body = JSON.stringify(bodyObj);
    return new Promise((res, rej) => {
        const u = new URL(url);
        const req = https.request({
            method: 'POST', hostname: u.hostname, path: u.pathname + u.search,
            headers: { ...headers, 'content-length': Buffer.byteLength(body) }
        }, resp => {
            const chunks = [];
            resp.on('data', c => chunks.push(c));
            resp.on('end', () => res({
                status: resp.statusCode,
                body: Buffer.concat(chunks).toString(),
            }));
        });
        req.on('error', rej);
        req.write(body);
        req.end();
    });
}

function buildCookieHeader(cookies) {
    return Object.entries(cookies).map(([k, v]) => `${k}=${v}`).join('; ');
}

(async () => {
    // ═══ Stage 1: 纯算生成 _px2 ═══
    console.log('━━━ Stage 1: 生成 _px2 ━━━');
    const t0 = Date.now();
    const px = await generatePx2();
    const genMs = Date.now() - t0;

    if (!px.cookie_name) {
        console.error('❌ _px2 生成失败:', px.error || 'unknown');
        process.exit(1);
    }
    console.log(`✅ ${px.cookie_name}=${px.cookie_value.slice(0, 40)}…  ttl=${px.ttl}  (${genMs}ms)`);
    console.log(`   uuid=${px.uuid}  vid=${px.state.vid}`);

    const cookies = { _px2: px.cookie_value };
    if (px.state.vid) cookies._pxvid = px.state.vid;

    const COMMON_HEADERS = {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'accept-language': 'en-US,en;q=0.9',
        'user-agent': UA,
        'origin': 'https://www.grubhub.com',
        'referer': 'https://www.grubhub.com/',
        'x-gh-features': '0=pc;1=@grubhubprod/order-taking-client-sdk 16.6.3;3=Chrome 120.0.0.0;',
        'cookie': buildCookieHeader(cookies),
    };

    // ═══ Stage 2: /auth (anonymous scope) — PX 守门 #1 ═══
    console.log('\n━━━ Stage 2: /auth (anonymous scope) ━━━');
    console.log(`   endpoint: ${AUTH_URL}`);
    console.log(`   cookies sent: _px2, _pxvid`);

    const t1 = Date.now();
    const r1 = await postJson(AUTH_URL, COMMON_HEADERS, {
        brand: BRAND,
        client_id: CLIENT_ID,
        device_id: crypto.randomUUID(),
        scope: 'anonymous',
    });
    const apiMs1 = Date.now() - t1;
    console.log(`   HTTP ${r1.status}  (${apiMs1}ms)`);

    if (r1.status !== 200) {
        console.error('❌ PX 守门 #1 拦了:', r1.body.slice(0, 300));
        process.exit(2);
    }

    const anonData = JSON.parse(r1.body);
    const anonToken = anonData.session_handle?.access_token;
    console.log(`✅ PX 守门 #1 通过 — anon_token=${anonToken.slice(0, 16)}…  expire_in=${anonData.session_handle?.expire_in}min`);

    // ═══ Stage 3 (optional): /auth/login — PX 守门 #2 ═══
    const email = process.env.GRUBHUB_EMAIL || DEFAULT_EMAIL;
    const password = process.env.GRUBHUB_PASSWORD || DEFAULT_PASSWORD;

    if (!email || !password || email.startsWith('<YOUR_')) {
        console.log('\n💡 跳过 Stage 3 (/auth/login)');
        console.log('   要测试 PX 第 2 个守门端点，设环境变量或编辑 DEFAULT_* 后重跑：');
        console.log('     export GRUBHUB_EMAIL=<your device-trusted account>');
        console.log('     export GRUBHUB_PASSWORD=<your password>');
        console.log(`\n━━━ Total time: ${genMs + apiMs1}ms ━━━`);
        return;
    }

    console.log('\n━━━ Stage 3: /auth/login (real account) ━━━');
    console.log(`   endpoint: ${LOGIN_URL}`);
    console.log(`   email: ${email.replace(/(.{2}).*(@.+)/, '$1***$2')}`);

    const t2 = Date.now();
    const r2 = await postJson(LOGIN_URL, {
        ...COMMON_HEADERS,
        Authorization: `Bearer ${anonToken}`,
    }, {
        brand: BRAND,
        client_id: CLIENT_ID,
        device_id: '-981990071',   // ⚠️ 必须 string。此值跟具体账号绑定 —— 换账号时必须换成那个账号 OTP 注册时用过的 device_id
        email,
        password,
    });
    const apiMs2 = Date.now() - t2;
    console.log(`   HTTP ${r2.status}  (${apiMs2}ms)`);

    if (r2.status === 200) {
        const data = JSON.parse(r2.body);
        const sh = data.session_handle || {};
        console.log(`✅ PX 守门 #2 通过 — 登录成功`);
        console.log(`   user access_token: ${(sh.access_token||'').slice(0, 40)}…`);
        console.log(`   refresh_token:     ${(sh.refresh_token||'').slice(0, 40)}…`);
        console.log(`   ud_id:             ${data.credential?.ud_id || sh.tracking_id || 'n/a'}`);
    } else if (r2.status === 463) {
        const data = JSON.parse(r2.body);
        const otp = Object.keys(data.verify_methods || {})[0] || 'unknown';
        console.log(`✅ PX 守门 #2 通过 — 业务层要 OTP (${otp})`);
        console.log(`   verify_methods: ${JSON.stringify(data.verify_methods, null, 2)}`);
        console.log(`   ↑ 下游生产项目把 463 算作 PX-pass`);
        console.log(`     (PX 评分够了，账号风控因 device_id 陌生要 OTP 验证 — 换 device-trusted 账号即可)`);
    } else if (r2.status === 403) {
        console.log(`❌ PX 守门 #2 拦了 (HTTP 403)`);
        console.log(`   response: ${r2.body.slice(0, 300)}`);
        process.exit(3);
    } else if (r2.status === 401) {
        console.log(`⚠️  HTTP 401 — 可能 client_id 过期 or 账号密码错`);
        console.log(`   response: ${r2.body.slice(0, 300)}`);
    } else {
        console.log(`⚠️  Unexpected HTTP ${r2.status}`);
        console.log(`   response: ${r2.body.slice(0, 300)}`);
    }

    console.log(`\n━━━ Total time: ${genMs + apiMs1 + apiMs2}ms  (gen ${genMs} + anon ${apiMs1} + login ${apiMs2}) ━━━`);
})().catch(e => {
    console.error('❌ FATAL:', e.message);
    process.exit(1);
});
