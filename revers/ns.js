/**
 * PX /ns 端点请求
 *
 * 还原自 main.js line 8374-8409 (Am), 调用处 line 10430-10438
 *
 * ═══ 输入 ═══
 *   uuid: String — 会话 UUID (Xa() 生成), 如 "68303b30-1224-11f1-a20a-312c66e49e40"
 *   host: String — /ns 域名 (可选, 默认 "https://tzm.px-cloud.net")
 *
 * ═══ 原始逻辑 ═══
 *   Am(t, e):                        // t = Xa() = uuid, e = host
 *     url = e + "/ns?c=" + t         // "https://tzm.px-cloud.net/ns?c={uuid}"
 *     GET url (XMLHttpRequest, async, no credentials)
 *     200 → Sm = responseText
 *     记录 Performance duration → Em
 *
 *   调用处 (main.js:10430-10438):
 *     a = "https://tzm.px-cloud.net"
 *     Am(Xa(), a)                    // 首次调用
 *     setInterval(() => Am(Xa(), a), 60 * r * 1e3)  // 定时刷新
 *
 * ═══ 输出 ═══
 *   Promise<{ sm, duration, url }> — sm 即 Sm, 放入 Bundle #2 payload 事件字段
 *   NOT cs 参数! cs 来自 ob 响应 handler (qa)
 *
 * 用法:
 *   const fetchNs = require('./ns')
 *   const { sm } = await fetchNs('68303b30-1224-11f1-a20a-312c66e49e40')
 */

const https = require('https');
const http = require('http');

function fetchNs(uuid, host) {
    if (!host) host = 'https://tzm.px-cloud.net';
    const url = host + '/ns?c=' + uuid;

    return new Promise((resolve, reject) => {
        const mod = url.startsWith('https') ? https : http;
        const start = Date.now();

        mod.get(url, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                const duration = Date.now() - start;
                if (res.statusCode === 200) {
                    resolve({ sm: data, duration, url });
                } else {
                    resolve({ sm: null, duration, url, status: res.statusCode });
                }
            });
        }).on('error', (e) => {
            resolve({ sm: null, duration: Date.now() - start, url, error: e.message });
        });
    });
}

module.exports = fetchNs;
