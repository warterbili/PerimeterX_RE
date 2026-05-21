/**
 * px_cookie_v2.js — ifood.com.br PerimeterX _px3 (新版 SDK, HUMAN Security 2026-05)
 *
 * 关键改动 vs v1:
 *   - tag: DhI0E0h7J2cKHw== → U0MmDhUmOnhXSw==
 *   - ft: 388 → 401
 *   - seq#2: 2 → 1
 *   - ob XOR key: 83 → 100 (自动由 ml(TAG)%128 计算)
 *   - ev1: 12 字段 → 14 字段 (新增 pxhd + PX12738 计数器)
 *   - ev2: 203 字段 → 204 字段 (cold visit), 几乎全部 base64 key 换了一遍
 *   - _px3 提取: collector#2 响应的 ob 字段 set_cookie handler (旧版是 do 数组 bake|_px3|)
 *
 * 用法:
 *   const px = require('./px_cookie_v2');
 *   const r = await px({ userAgent: '...' });
 */

const https = require('https');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// ═══ 常量 ═══

const TAG    = 'U0MmDhUmOnhXSw==';      // 新版
const FT     = 401;                      // 新版
const APP_ID = 'PXO1GDTa7Q';
const GT     = TAG;
const BI     = 'EwNmQ0Y0IWJVVwZmCl9aYBIqdAQCBilmHx5zDihCKkkRLCB5V0IrfH1YFDgSLW0aEDksfTsLJSB6CjJcUGJtO18eam5RCVVuBit2G1VPejAfTXdjL0IpSUdyJSgYUW8=';
const COLLECTOR_URL = 'https://collector-pxo1gdta7q.px-cloud.net/api/v2/collector';
const DEFAULT_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36';
const DEFAULT_TIMESTAMP = '1604064986000';

// ═══ 模板：从 batch6（cold visit）实际抓包加载 ═══

const EV1_TEMPLATE = JSON.parse(fs.readFileSync(path.join(__dirname, 'ev1_template.json')))[0];
const EV2_TEMPLATE = JSON.parse(fs.readFileSync(path.join(__dirname, 'ev2_template.json')))[0];

// ═══ XOR / Base64 / serialize / MD5 (与 v1 相同，省略实现，从原 px_cookie.js 复用) ═══

function xor(t,k){var r='';for(var i=0;i<t.length;i++)r+=String.fromCharCode(t.charCodeAt(i)^k);return r;}
function te(t,e){var n='';for(var r=0;r<t.length;r++)n+=String.fromCharCode(e^t.charCodeAt(r));return n;}
function b64encode(t){return Buffer.from(t,'utf-8').toString('base64');}

var ESC_RE=/[\\"\u0000-\u001f\u007f-\u009f\u00ad\u0600-\u0604\u070f\u17b4\u17b5\u200c-\u200f\u2028-\u202f\u2060-\u206f\ufeff\ufff0-\uffff]/g;
var ESC_MAP={'\b':'\\b','\t':'\\t','\n':'\\n','\f':'\\f','\r':'\\r','\v':'\\v','"':'\\"','\\':'\\\\'};
function escChar(c){return ESC_MAP[c]||'\\u'+('0000'+c.charCodeAt(0).toString(16)).slice(-4);}
function quote(t){ESC_RE.lastIndex=0;return '"'+(ESC_RE.test(t)?t.replace(ESC_RE,escChar):t)+'"';}
function serialize(e){var tp=typeof e;if(tp==='undefined')return '"undefined"';if(tp==='boolean')return String(e);if(tp==='number'){var r=String(e);return r==='NaN'||r==='Infinity'?'null':r;}if(tp==='string')return quote(e);if(e===null||e instanceof RegExp)return 'null';if(e instanceof Date)return ['"',e.getFullYear(),'-',e.getMonth()+1,'-',e.getDate(),'T',e.getHours(),':',e.getMinutes(),':',e.getSeconds(),'.',e.getMilliseconds(),'"'].join('');if(Array.isArray(e)){var n=['['];for(var a=0;a<e.length;a++)n.push(serialize(e[a])||'"undefined"',',');n[n.length>1?n.length-1:n.length]=']';return n.join('');}var n2=['{'];for(var o in e){if(e.hasOwnProperty(o)&&e[o]!==undefined)n2.push(quote(o),':',serialize(e[o])||'"undefined"',',');}n2[n2.length>1?n2.length-1:n2.length]='}';return n2.join('');}

// MD5 / HMAC-MD5
function w(t){var n='';for(var e=0;e<32*t.length;e+=8)n+=String.fromCharCode(t[e>>5]>>>e%32&255);return n;}
function NN(t,e){var n=(65535&t)+(65535&e);return (t>>16)+(e>>16)+(n>>16)<<16|65535&n;}
function XX(t,e,n,r,a,o){var i=NN(NN(e,t),NN(r,o));return NN(i<<a|i>>>32-a,n);}
function kk(t,e,n,r,a,o,i){return XX(e&n|~e&r,t,e,a,o,i);}
function PP(t,e,n,r,a,o,i){return XX(e&r|n&~r,t,e,a,o,i);}
function xx(t,e,n,r,a,o,i){return XX(e^n^r,t,e,a,o,i);}
function CC(t,e,n,r,a,o,i){return XX(n^(e|~r),t,e,a,o,i);}
function BB(t){var n=[];n[(t.length>>2)-1]=void 0;for(var e=0;e<n.length;e++)n[e]=0;for(var e2=0;e2<8*t.length;e2+=8)n[e2>>5]|=(255&t.charCodeAt(e2/8))<<e2%32;return n;}
function OO(t){return unescape(encodeURIComponent(t));}
function MM(t,e){t[e>>5]|=128<<e%32;t[14+(e+64>>>9<<4)]=e;var n,r,a,o,i,c=1732584193,u=-271733879,s=-1732584194,f=271733878;for(n=0;n<t.length;n+=16){r=c;a=u;o=s;i=f;c=kk(c,u,s,f,t[n],7,-680876936);f=kk(f,c,u,s,t[n+1],12,-389564586);s=kk(s,f,c,u,t[n+2],17,606105819);u=kk(u,s,f,c,t[n+3],22,-1044525330);c=kk(c,u,s,f,t[n+4],7,-176418897);f=kk(f,c,u,s,t[n+5],12,1200080426);s=kk(s,f,c,u,t[n+6],17,-1473231341);u=kk(u,s,f,c,t[n+7],22,-45705983);c=kk(c,u,s,f,t[n+8],7,1770035416);f=kk(f,c,u,s,t[n+9],12,-1958414417);s=kk(s,f,c,u,t[n+10],17,-42063);u=kk(u,s,f,c,t[n+11],22,-1990404162);c=kk(c,u,s,f,t[n+12],7,1804603682);f=kk(f,c,u,s,t[n+13],12,-40341101);s=kk(s,f,c,u,t[n+14],17,-1502002290);c=PP(c,u=kk(u,s,f,c,t[n+15],22,1236535329),s,f,t[n+1],5,-165796510);f=PP(f,c,u,s,t[n+6],9,-1069501632);s=PP(s,f,c,u,t[n+11],14,643717713);u=PP(u,s,f,c,t[n],20,-373897302);c=PP(c,u,s,f,t[n+5],5,-701558691);f=PP(f,c,u,s,t[n+10],9,38016083);s=PP(s,f,c,u,t[n+15],14,-660478335);u=PP(u,s,f,c,t[n+4],20,-405537848);c=PP(c,u,s,f,t[n+9],5,568446438);f=PP(f,c,u,s,t[n+14],9,-1019803690);s=PP(s,f,c,u,t[n+3],14,-187363961);u=PP(u,s,f,c,t[n+8],20,1163531501);c=PP(c,u,s,f,t[n+13],5,-1444681467);f=PP(f,c,u,s,t[n+2],9,-51403784);s=PP(s,f,c,u,t[n+7],14,1735328473);c=xx(c,u=PP(u,s,f,c,t[n+12],20,-1926607734),s,f,t[n+5],4,-378558);f=xx(f,c,u,s,t[n+8],11,-2022574463);s=xx(s,f,c,u,t[n+11],16,1839030562);u=xx(u,s,f,c,t[n+14],23,-35309556);c=xx(c,u,s,f,t[n+1],4,-1530992060);f=xx(f,c,u,s,t[n+4],11,1272893353);s=xx(s,f,c,u,t[n+7],16,-155497632);u=xx(u,s,f,c,t[n+10],23,-1094730640);c=xx(c,u,s,f,t[n+13],4,681279174);f=xx(f,c,u,s,t[n],11,-358537222);s=xx(s,f,c,u,t[n+3],16,-722521979);u=xx(u,s,f,c,t[n+6],23,76029189);c=xx(c,u,s,f,t[n+9],4,-640364487);f=xx(f,c,u,s,t[n+12],11,-421815835);s=xx(s,f,c,u,t[n+15],16,530742520);c=CC(c,u=xx(u,s,f,c,t[n+2],23,-995338651),s,f,t[n],6,-198630844);f=CC(f,c,u,s,t[n+7],10,1126891415);s=CC(s,f,c,u,t[n+14],15,-1416354905);u=CC(u,s,f,c,t[n+5],21,-57434055);c=CC(c,u,s,f,t[n+12],6,1700485571);f=CC(f,c,u,s,t[n+3],10,-1894986606);s=CC(s,f,c,u,t[n+10],15,-1051523);u=CC(u,s,f,c,t[n+1],21,-2054922799);c=CC(c,u,s,f,t[n+8],6,1873313359);f=CC(f,c,u,s,t[n+15],10,-30611744);s=CC(s,f,c,u,t[n+6],15,-1560198380);u=CC(u,s,f,c,t[n+13],21,1309151649);c=CC(c,u,s,f,t[n+4],6,-145523070);f=CC(f,c,u,s,t[n+11],10,-1120210379);s=CC(s,f,c,u,t[n+2],15,718787259);u=CC(u,s,f,c,t[n+9],21,-343485551);c=NN(c,r);u=NN(u,a);s=NN(s,o);f=NN(f,i);}return [c,u,s,f];}
function UU(t){var h='0123456789abcdef',a='';for(var n=0;n<t.length;n++){var e=t.charCodeAt(n);a+=h.charAt(e>>>4&15)+h.charAt(15&e);}return a;}
function md5Raw(t){return w(MM(BB(OO(t)),8*OO(t).length));}
function hmacRaw(key,data){var t=OO(key),e=OO(data),r=BB(t),a=[],o=[];a[15]=o[15]=void 0;if(r.length>16){var p=MM(r,8*t.length);for(var n=0;n<16;n++){a[n]=909522486^p[n];o[n]=1549556828^p[n];}}else{for(var n2=0;n2<16;n2++){a[n2]=909522486^r[n2];o[n2]=1549556828^r[n2];}}return w(MM(o.concat(MM(a.concat(BB(e)),512+8*e.length)),640));}
function hmacMD5(data,key){return key?UU(hmacRaw(key,data)):UU(md5Raw(data));}

// ═══ UUID v1 ═══
var _hex=[];for(var _i=0;_i<256;_i++)_hex[_i]=(_i+256).toString(16).substr(1);
function fmtUUID(b){return _hex[b[0]]+_hex[b[1]]+_hex[b[2]]+_hex[b[3]]+'-'+_hex[b[4]]+_hex[b[5]]+'-'+_hex[b[6]]+_hex[b[7]]+'-'+_hex[b[8]]+_hex[b[9]]+'-'+_hex[b[10]]+_hex[b[11]]+_hex[b[12]]+_hex[b[13]]+_hex[b[14]]+_hex[b[15]];}
var _init=new Uint8Array(16);crypto.getRandomValues(_init);
var _node=[1|_init[0],_init[1],_init[2],_init[3],_init[4],_init[5]];
var _clk=16383&(_init[6]<<8|_init[7]),_lastMs=0,_lastNs=0;
function uuidV1(){var buf=[],idx=0,s=_clk,ms=+new Date,ns=_lastNs+1;var dt=ms-_lastMs+(ns-_lastNs)/1e4;if(dt<0)s=s+1&16383;if(dt<0||ms>_lastMs)ns=0;_lastMs=ms;_lastNs=ns;_clk=s;ms+=122192928e5;var tl=(1e4*(268435455&ms)+ns)%4294967296;buf[idx++]=tl>>>24&255;buf[idx++]=tl>>>16&255;buf[idx++]=tl>>>8&255;buf[idx++]=255&tl;var tm=ms/4294967296*1e4&268435455;buf[idx++]=tm>>>8&255;buf[idx++]=255&tm;buf[idx++]=tm>>>24&15|16;buf[idx++]=tm>>>16&255;buf[idx++]=s>>>8|128;buf[idx++]=255&s;for(var m=0;m<6;m++)buf[idx+m]=_node[m];return fmtUUID(buf);}

// ═══ Payload 加密 ═══
function Qf(t,e,n,r,a){return Math.floor((t-e)/(n-e)*(a-r)+r);}
function getOffsets(pLen,bLen,uuid){var h=xor(b64encode(uuid),10),mx=-1;for(var p=0;p<pLen;p++){var row=Math.floor(p/h.length)+1,col=p>=h.length?p%h.length:p;var pr=h.charCodeAt(col)*h.charCodeAt(row);if(pr>mx)mx=pr;}var off=[];for(var b=0;b<pLen;b++){var row2=Math.floor(b/h.length)+1,col2=b%h.length;var pr2=h.charCodeAt(col2)*h.charCodeAt(row2);if(pr2>=bLen)pr2=Qf(pr2,0,mx,0,bLen-1);while(off.indexOf(pr2)!==-1)pr2+=1;off.push(pr2);}return off.sort(function(a,b){return a-b;});}
function interleave(key,payload,off){var r='',pos=0,ch=key.split('');for(var u=0;u<key.length;u++){r+=payload.substring(pos,off[u]-u-1)+ch[u];pos=off[u]-u-1;}r+=payload.substring(pos);return r;}
function genPayload(events,serverTs,uuid){var json=serialize(events),enc=b64encode(xor(json,50));var ts=serverTs||DEFAULT_TIMESTAMP,o=xor(b64encode(String(ts)),10);return interleave(o,enc,getOffsets(o.length,enc.length,uuid));}

// ═══ PC ═══
function genPC(events,uuid,tag,ft){var data=serialize(events),salt=uuid+':'+tag+':'+ft,n=hmacMD5(data,salt);var d='',l='';for(var r=0;r<n.length;r++){var a=n.charCodeAt(r);if(a>=48&&a<=57)d+=n[r];else l+=a%10;}var c=d+l,pc='';for(var o=0;o<c.length;o+=2)pc+=c[o];return pc;}

// ═══ OB 解码 ═══
function ml(t){var e=0;for(var n=0;n<t.length;n++)e=(31*e+t.charCodeAt(n))%2147483647;return (e%900+100).toString();}
var UUID_RE=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function decodeOb(resp,gt){
    var xk=parseInt(ml(gt),10)%128;
    var p=typeof resp==='string'?JSON.parse(resp):resp;
    var ob=p.do||p.ob;if(!ob)return {state:{},xk};
    var dec=Buffer.from(ob,'base64').toString('binary');
    var segs=xor(dec,xk).split('~~~~');
    var st={};
    var allSegs=[];
    for(var i=0;i<segs.length;i++){var s=segs[i];if(!s)continue;var f=s.split('|');var handler=f.shift();var args=f;allSegs.push({handler,args});
        if(args.length===1&&/^1[5-9]\d{11}$/.test(args[0]))st.no=args[0];
        else if(args.length===1&&/^[0-9a-f]{64}$/.test(args[0]))st.qa=args[0];
        else if(args.length===3&&UUID_RE.test(args[0])&&/^\d+$/.test(args[1]))st.vid=args[0];
        else if(args.length===2&&UUID_RE.test(args[0]))st.cts=args[0];
        else if(args.length===1&&UUID_RE.test(args[0]))st.pxsid=args[0];
        else if((args.length===1||args.length===2)&&/^\d{16,}$/.test(args[0]))st.to=args[0];
        else if(args.length===1&&/^\d{3}$/.test(args[0]))st.ao=args[0];
        else if(args.length>=4&&/^_?px/i.test(args[0]))st.px3={name:args[0],value:args[2],ttl:+args[1]};
        else if(args.length===1&&/^[a-z0-9]{12,30}$/.test(args[0]))st.appId=args[0];
        else if(args.length===1&&/^[a-z]{2,4}$/.test(args[0]))st.jf=args[0];
        else if(args.length===1&&/^\d{4,5}$/.test(args[0]))st.o111val=parseInt(args[0]);
    }
    return {state:st,xk,segments:allSegs};
}

// ═══ SID 隐写 ═══
function genSid(pxsid,serverTs){var r='';var t=String(serverTs);for(var i=0;i<t.length;i++)r+=String.fromCodePoint(0xE0100+t.charCodeAt(i));return pxsid+r;}

// ═══ Hash (djb2) ═══
function Kt(t){t=''+t;var e=0;for(var n=0;n<t.length;n++){e=(e<<5)-e+t.charCodeAt(n);e|=0;}if(e<0)e+=4294967296;return e.toString(16);}
function genHash(no,vid){return Kt(''+Math.floor(Math.floor(parseInt(no)/1e3)*2863/vid.charCodeAt(9)));}

// ═══ Memory ═══
function randInt(a,b){return Math.floor(Math.random()*(b-a+1))+a;}
function genMem(){var u=randInt(40000000,140000000);return {used:u,total:randInt(Math.floor(u*1.1),Math.floor(u*1.5)),limit:4294967296};}

// ═══ HTTP ═══
function post(body,ua){return new Promise(function(resolve,reject){var buf=Buffer.from(body,'utf-8'),u=new URL(COLLECTOR_URL);var req=https.request({hostname:u.hostname,port:443,path:u.pathname,method:'POST',headers:{
    'Content-Type':'application/x-www-form-urlencoded',
    'Content-Length':buf.length,
    'Accept':'*/*',
    'Accept-Language':'en-US,en;q=0.9,zh-CN;q=0.8,zh;q=0.7',
    'Origin':'https://www.ifood.com.br',
    'Referer':'https://www.ifood.com.br/',
    'User-Agent':ua,
    'priority':'u=1, i',
    'sec-ch-ua':'"Chromium";v="148", "Google Chrome";v="148", "Not/A)Brand";v="99"',
    'sec-ch-ua-mobile':'?0',
    'sec-ch-ua-platform':'"Windows"',
    'sec-fetch-dest':'empty',
    'sec-fetch-mode':'cors',
    'sec-fetch-site':'cross-site',
}},function(res){var d='';res.on('data',function(c){d+=c;});res.on('end',function(){resolve({status:res.statusCode,body:d,headers:res.headers});});});req.on('error',reject);req.write(buf);req.end();});}
function fetchNs(uuid){return new Promise(function(resolve){var start=Date.now();https.get('https://tzm.px-cloud.net/ns?c='+uuid,function(res){var d='';res.on('data',function(c){d+=c;});res.on('end',function(){resolve({sm:res.statusCode===200?d:null,duration:Date.now()-start});});}).on('error',function(){resolve({sm:null,duration:Date.now()-start});});});}

// ═══ EV1 / EV2 构造 — 用 batch6 模板 + DYNAMIC overrides ═══

function deepClone(o){return JSON.parse(JSON.stringify(o));}

function buildEv1(ctx){
    // ctx: {uuid, initTime, sendTime, nsResult}
    var e = deepClone(EV1_TEMPLATE);
    var d = e.d;
    d['VQEgCxNnKjw='] = ctx.initTime;                       // initTime
    d['bHgZcikfE0A='] = ctx.sendTime;                       // sendTime
    d['NSEAa3NAC18='] = ctx.uuid;                           // uuid
    d['BzdyfUJXdks='] = ctx.nsResult.sm;                    // /ns sm
    d['DFg5Ekk4PSU='] = ctx.nsResult.duration;              // /ns dur
    d['PSkIY3tJDFE='] = Math.floor(300+Math.random()*1600); // perfNow (small)
    // PX12738 计数器: 每次累加，首次访问通常是 0-3 区间
    d['cyNGaTZBQVs='] = {"PX12738":randInt(0,5),"PX12739":0,"PX12740":0,"PX12741":-1};
    return e;
}

function buildEv2(ctx){
    // ctx: {state, uuid, ua, initTime, sendTs, perfNow, nsResult}
    // 策略: 几乎全部用 batch6 模板原值; 只更新 SDK 明确依赖运行时状态的字段
    var e = deepClone(EV2_TEMPLATE);
    var d = e.d;
    // ── 必改：state-derived ──
    d['RTEwewNQMUg='] = parseInt(ctx.state.no);                  // 服务器时间戳 (number!)
    d['VQEgCxNnKjw='] = ctx.initTime;                            // initTime
    d['bHgZcikfE0A='] = ctx.sendTs;                              // sendTime
    d['NSEAa3NAC18='] = ctx.uuid;                                // uuid
    d['Czt+cU1WeEM='] = new Date().toString();                   // Date.toString()
    d['PSkIY3tJDFE='] = ctx.perfNow;                             // perf.now()
    // ── HMAC: 依赖 uuid/vid/pxsid + UA ──
    d['M2MGKXUOBB8='] = hmacMD5(ctx.uuid, ctx.ua);
    d['FmYjbFAEJVg='] = hmacMD5(ctx.state.vid, ctx.ua);
    d['BzdyfUFRd04='] = hmacMD5(ctx.state.pxsid, ctx.ua);
    // ── state.to / state.appId 写入字段 ──
    d['FCAhKlJCIxk='] = ctx.state.to;
    if (ctx.state.appId) d['Xi5rJBtKaB4='] = ctx.state.appId;
    // ── /ns ──
    d['BzdyfUJXdks='] = ctx.nsResult.sm;
    d['DFg5Ekk4PSU='] = ctx.nsResult.duration;
    // ── pxhd 字段: 冷访问首次=""; 否则要用上次 server 给的 pxhd ──
    d['R3cyPQIVMAw='] = "";
    // ── Anti-tamper: 保留原位置（在 FCAhKlJCIxk= 之后）重新算 key/value ──
    var stateNo = parseInt(ctx.state.no);
    var newAtKey = te(ctx.state.to, stateNo%10+2);
    var newAtVal = te(ctx.state.to, stateNo%10+1);
    // 重建 d 保持顺序：遇到旧 anti-tamper key 时替换为新的
    var d2 = {};
    for (var k of Object.keys(d)) {
        if (/^[0-9:;<=>?@]{15,25}$/.test(k) && /^[0-9:;<=>?@]{15,25}$/.test(String(d[k]))) {
            d2[newAtKey] = newAtVal;  // 用新 key/val 占据原位置
        } else {
            d2[k] = d[k];
        }
    }
    e.d = d2;
    return e;
}

// ═══ 主入口 ═══

async function generateCookie(opts){
    opts = opts || {};
    var ua = opts.userAgent || DEFAULT_UA;
    var uuid = uuidV1();
    var initTime = Date.now();
    var nsP = fetchNs(uuid);

    // ── collector#1 ──
    var sendTime = initTime + randInt(5, 15);
    var ev1 = [buildEv1({uuid, initTime, sendTime, nsResult: {sm:null, duration:0}})];
    var p1 = genPayload(ev1, null, uuid);
    var pc1 = genPC(ev1, uuid, TAG, FT);
    var body1 = ['payload='+encodeURIComponent(p1),'appId='+APP_ID,'tag='+encodeURIComponent(TAG),
        'uuid='+encodeURIComponent(uuid),'ft='+FT,'seq=0','en=NTA','bi='+encodeURIComponent(BI),
        'pc='+encodeURIComponent(pc1),'rsc=1'].join('&');

    var r1 = await post(body1, ua);
    if (r1.status !== 200) throw new Error('collector#1 failed: '+r1.status);
    var ob1 = decodeOb(r1.body, GT);
    var st = ob1.state;
    if (!st.no || !st.vid || !st.pxsid || !st.to || !st.qa) {
        throw new Error('ob#1 missing state: '+JSON.stringify({no:!!st.no,vid:!!st.vid,pxsid:!!st.pxsid,to:!!st.to,qa:!!st.qa}));
    }
    var px3 = st.px3 ? st.px3.value : null;

    // ── 等 /ns ──
    var ns; try { ns = await nsP; } catch(e) { ns = {sm:null, duration:0}; }

    // ── collector#2 ──
    var now2 = Date.now();
    var mem = genMem();
    var sendTs = now2 + randInt(1000, 1500);
    var perfNow = Math.round(sendTs - initTime);

    var ev2 = [buildEv2({state:st, uuid, ua, initTime, sendTs, perfNow, mem:{used:mem.used,total:mem.total}, nsResult:ns})];

    var p2 = genPayload(ev2, st.no, uuid);
    var pc2 = genPC(ev2, uuid, TAG, FT);
    var sid = genSid(st.pxsid, st.no);

    var body2 = ['payload='+encodeURIComponent(p2),'appId='+APP_ID,'tag='+encodeURIComponent(TAG),
        'uuid='+encodeURIComponent(uuid),'ft='+FT,'seq=1','en=NTA','bi='+encodeURIComponent(BI),
        'cs='+encodeURIComponent(st.qa),'pc='+encodeURIComponent(pc2),
        'sid='+encodeURIComponent(sid),'vid='+encodeURIComponent(st.vid),
        'cts='+encodeURIComponent(st.cts),'rsc=2'].join('&');

    var r2 = await post(body2, ua);

    // ── 提取 _px3 (新版: ob#2 的 set_cookie handler) ──
    var ob2 = decodeOb(r2.body, GT);
    if (ob2.state.px3 && ob2.state.px3.value) {
        px3 = ob2.state.px3.value;
    }

    return {
        px3, pxvid: st.vid, uuid, status: r2.status, response: r2.body,
        ob2_segments_count: ob2.segments ? ob2.segments.length : 0,
        ob2_segments: ob2.segments,
        state: st,
        ev1_sent: ev1,
        ev2_sent: ev2,
    };
}

module.exports = generateCookie;

// 直接运行
if (require.main === module) {
    generateCookie().then(function(r){
        console.log('_px3:', r.px3 ? r.px3.substring(0,60)+'...' : 'NONE');
        console.log('_pxvid:', r.pxvid);
        console.log('status:', r.status);
        console.log('ob2_segs:', r.ob2_segments_count);
        console.log('response:', r.response);
    }).catch(function(e){
        console.error('ERROR:', e.message);
        process.exit(1);
    });
}
