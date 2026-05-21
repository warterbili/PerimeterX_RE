// !! base64 key(gt值，直接搜) (如 "OA9ITn1hRnk=", "PSINY3tKDlQ=" 等) 随 PX 脚本版本变化
// !! 更新 main.js 后需重新提取所有 key, 值的逻辑不变

function buildBundle1Event(uuid) {
    var now = Date.now();
    return [{
        "t": "OA9ITn1hRnk=",
        "d": {
            "PSINY3tKDlQ=": location.href,
            "GC8oLl1DLxs=": 1,
            "HmUuZFsPLF4=": navigator.platform,
            "ST45fw9ZPk8=": 0,
            "HCMsIlpILRA=": Math.floor(2500 + Math.random() * 5000),
            "GmEqYF8NKVo=": 3600,
            "HmUuZFgIIVM=": now,
            "KD9YPm1TVww=": now + Math.floor(3 + Math.random() * 6),
            "bRJdEyt4Uyc=": uuid,
            "UTYhdxRdIEE=": null,
            "Fm0mbFMGJ1s=": 0,
            "QSYxZwdLMVw=": false,
            "ST45fwxTPko=": "PX11745",
            "Rl12HAA1dyY=": "pxhc",
            "RTo1ewBXNkE=": false,
            "b1RfVSo9WGQ=": (document.cookie.match(/_px3=([^;]+)/) || [])[1] || ""
        }
    }];
}
