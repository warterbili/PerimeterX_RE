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
 * ⚠️ 凭据：
 *   - 本脚本绝不嵌任何代理凭据 / 账号凭据
 *   - 全部通过环境变量传入
 *
 * 用法:
 *   # 轻量版（只 anonymous）
 *   export HTTPS_PROXY='http://<user>:<pwd>@<host>:<port>'
 *   node business_api_demo.js
 *
 *   # 全链路版（含登录）
 *   export HTTPS_PROXY='http://<user>:<pwd>@<host>:<port>'
 *   export GRUBHUB_EMAIL='your@email.com'
 *   export GRUBHUB_PASSWORD='yourpassword'
 *   node business_api_demo.js
 *
 * 期望输出 (full chain):
 *   ✅ _px2 generated
 *   ✅ Stage 2 /auth (anonymous) HTTP 200, anon_token=...
 *   ✅ Stage 3 /auth/login HTTP 200 (login OK) or 463 (OTP needed) — both = PX passed
 *
 * 注意:
 *   - 463 (OTP needed) 是 PX 通过的合法表现 — 业务层后端因 device_id 不熟悉要求 OTP
 *   - 403 表示 _px2 评分不够，PX 拦截 (换 IP / 算法检查)
 *   - 401 "Invalid client_id" 表示 PX 过了但 client_id 错（项目用 config.yaml 的值）
 *
 * 完整链路 (8 步) 实现见 sourcing-cracked/grubhub-web/grubhub-auth/core/python/login.py
 *   本 demo 只演示前 3 步 (PX 通过的核心证据)；后续 OTP + OAuth2 SSO 需 mail.tm + 更多状态
 */

const https = require('https');
const crypto = require('crypto');

// ─── Optional HTTPS_PROXY support ───
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
const CLIENT_ID = 'beta_UmWlpstzQSFmocLy3h1UieYcVST';   // from sourcing-cracked/grubhub-web/config.yaml
const UA        = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36';

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
    const email = process.env.GRUBHUB_EMAIL;
    const password = process.env.GRUBHUB_PASSWORD;

    if (!email || !password) {
        console.log('\n💡 跳过 Stage 3 (/auth/login)');
        console.log('   要测试 PX 第 2 个守门端点，设环境变量后重跑：');
        console.log('     export GRUBHUB_EMAIL=...');
        console.log('     export GRUBHUB_PASSWORD=...');
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
        device_id: '-981990071',   // grubhub-auth 生产用的固定 device_id
        email,
        password,
    });
    const apiMs2 = Date.now() - t2;
    console.log(`   HTTP ${r2.status}  (${apiMs2}ms)`);

    if (r2.status === 200) {
        const data = JSON.parse(r2.b || r2.body);
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
        console.log(`   ↑ 桌面 (3) 项目把 463 算作 PX-pass`);
        console.log(`     (PX 评分够了，账号风控因 device_id 不熟悉要 OTP 验证)`);
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
