/**
 * 反自动化检测
 * 确保所有 API 看起来像原生代码
 */

/**
 * 安装反自动化检测补丁
 */
function installStealthPatches(window) {
  // 1. 确保 navigator.webdriver 为 false
  // CRITICAL: Must be writable data property, NOT a getter!
  // PX SDK does: navigator.webdriver = 1; if (1 !== navigator.webdriver) -> detected
  Object.defineProperty(window.navigator, 'webdriver', {
    value: false,
    writable: true,
    configurable: true,
    enumerable: true,
  });
  
  // 2. 移除自动化相关的属性
  try { delete window.navigator.__proto__.webdriver; } catch(e) {}
  
  // 3. 确保关键 API 的 toString 返回 [native code]
  patchToString(window);
  
  // 4. 移除 Chromium/WebDriver 标记
  removeAutomationFlags(window);
  
  console.log('[STEALTH] Stealth patches installed');
}

/**
 * 修补 toString 方法
 */
function patchToString(window) {
  // 保存原始的 toString
  const originalToString = Function.prototype.toString;
  
  // 需要伪装的函数列表
  const nativeFunctions = new Set([
    window.navigator.plugins.toString,
    window.navigator.mimeTypes.toString,
    window.navigator.permissions.query,
    window.document.createElement,
    window.HTMLCanvasElement?.prototype.getContext,
    window.CanvasRenderingContext2D?.prototype.getImageData,
    window.WebGLRenderingContext?.prototype.getParameter
  ].filter(Boolean));
  
  // 重写 Function.prototype.toString
  Function.prototype.toString = function() {
    // 如果是被标记为 native 的函数，返回 native code
    if (nativeFunctions.has(this)) {
      return `function ${this.name || ''}() { [native code] }`;
    }
    
    // 对于某些关键对象，也返回 native code
    const fnStr = originalToString.call(this);
    if (this.name && (
      this.name.includes('bound ') ||
      this.name === 'createElement' ||
      this.name === 'getContext' ||
      this.name === 'getParameter' ||
      this.name === 'getImageData'
    )) {
      return `function ${this.name}() { [native code] }`;
    }
    
    return fnStr;
  };
  
  // 确保 toString 本身看起来也是 native
  Object.defineProperty(Function.prototype.toString, 'toString', {
    value: () => 'function toString() { [native code] }',
    writable: false,
    configurable: true
  });
}

/**
 * 移除自动化标记
 */
function removeAutomationFlags(window) {
  // 移除常见的自动化检测标记
  const flagsToRemove = [
    '__webdriver_script_fn',
    '__driver_evaluate',
    '__webdriver_evaluate',
    '__selenium_evaluate',
    '__fxdriver_evaluate',
    '__driver_unwrapped',
    '__webdriver_unwrapped',
    '__selenium_unwrapped',
    '__fxdriver_unwrapped',
    '__webdriver_script_func',
    '__webdriver_script_function',
    '_Selenium_IDE_Recorder',
    '_selenium',
    'callSelenium',
    '_phantom',
    '__nightmare',
    'callPhantom'
  ];
  
  flagsToRemove.forEach(flag => {
    try {
      delete window[flag];
      delete window.document[flag];
      delete window.navigator[flag];
    } catch (e) {
      // Ignore errors
    }
  });
  
  // 确保 chrome 对象存在，模拟真实 Chrome 结构
  // PX SDK checks chrome.runtime/app/csi constructors and error message lengths
  if (!window.chrome) {
    const makeNativeFn = (name) => {
      const fn = function() {};
      Object.defineProperty(fn, 'name', { value: name });
      Object.defineProperty(fn, 'toString', {
        value: () => `function ${name}() { [native code] }`,
      });
      return fn;
    };
    
    window.chrome = {
      app: {
        isInstalled: false,
        InstallState: { DISABLED: 'disabled', INSTALLED: 'installed', NOT_INSTALLED: 'not_installed' },
        RunningState: { CANNOT_RUN: 'cannot_run', READY_TO_RUN: 'ready_to_run', RUNNING: 'running' },
        getDetails: makeNativeFn('getDetails'),
        getIsInstalled: makeNativeFn('getIsInstalled'),
        installState: makeNativeFn('installState'),
        runningState: makeNativeFn('runningState'),
      },
      runtime: {
        OnInstalledReason: { CHROME_UPDATE: 'chrome_update', INSTALL: 'install', SHARED_MODULE_UPDATE: 'shared_module_update', UPDATE: 'update' },
        OnRestartRequiredReason: { APP_UPDATE: 'app_update', OS_UPDATE: 'os_update', PERIODIC: 'periodic' },
        PlatformArch: { ARM: 'arm', ARM64: 'arm64', MIPS: 'mips', MIPS64: 'mips64', X86_32: 'x86-32', X86_64: 'x86-64' },
        PlatformNaclArch: { ARM: 'arm', MIPS: 'mips', MIPS64: 'mips64', X86_32: 'x86-32', X86_64: 'x86-64' },
        PlatformOs: { ANDROID: 'android', CROS: 'cros', LINUX: 'linux', MAC: 'mac', OPENBSD: 'openbsd', WIN: 'win' },
        RequestUpdateCheckStatus: { NO_UPDATE: 'no_update', THROTTLED: 'throttled', UPDATE_AVAILABLE: 'update_available' },
        connect: makeNativeFn('connect'),
        sendMessage: makeNativeFn('sendMessage'),
        id: undefined,
      },
      csi: makeNativeFn('csi'),
      loadTimes: makeNativeFn('loadTimes'),
    };
  }
}

/**
 * 修补 Permissions API
 */
function patchPermissions(window) {
  const originalQuery = window.navigator.permissions.query;
  
  window.navigator.permissions.query = function(parameters) {
    // 对于通知权限，返回 denied 或 prompt
    if (parameters.name === 'notifications') {
      return Promise.resolve({
        state: 'prompt',
        onchange: null
      });
    }
    
    return originalQuery.call(this, parameters);
  };
  
  // 确保 toString 正确
  Object.defineProperty(window.navigator.permissions.query, 'toString', {
    value: () => 'function query() { [native code] }',
    writable: false,
    configurable: true
  });
}

/**
 * 修补 console
 */
function patchConsole(window) {
  // 某些反爬虫会检测 console 是否被修改
  const originalConsole = { ...window.console };
  
  Object.keys(originalConsole).forEach(key => {
    if (typeof originalConsole[key] === 'function') {
      Object.defineProperty(window.console[key], 'toString', {
        value: () => `function ${key}() { [native code] }`,
        writable: false,
        configurable: true
      });
    }
  });
}

module.exports = { installStealthPatches };
