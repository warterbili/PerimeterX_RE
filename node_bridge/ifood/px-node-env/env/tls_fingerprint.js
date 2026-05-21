
// 注入到 px-node-env/env/tls_fingerprint.js
module.exports = function patchTLSFingerprint(window) {
    // 从 curl_cffi 获得的真实 TLS 指纹
    Object.defineProperty(window, '__tls_ja3', {
        value: '4dbeb913eebcaa7d2b3bbf5a015e1833',
        writable: false,
        configurable: false
    });
    
    Object.defineProperty(window, '__tls_ja4', {
        value: 't13d1516h2_8daaf6152771_02713d6af862',
        writable: false,
        configurable: false
    });
    
    // 如果 PX SDK 通过其他方式获取 TLS 指纹，确保返回正确值
    // 可能通过 performance API 或其他途径
};
