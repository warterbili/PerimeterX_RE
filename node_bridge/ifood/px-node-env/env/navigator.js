/**
 * 完善 Navigator API
 */
function installNavigatorPatches(window) {
  const navigator = window.navigator;
  
  // 安装 Plugins
  installPlugins(navigator);
  
  // 安装 MimeTypes
  installMimeTypes(navigator);
  
  // 安装 Connection
  installConnection(navigator);
  
  // 安装 Permissions
  installPermissions(navigator);
  
  // 安装 UserAgentData (可选)
  installUserAgentData(navigator);
  
  console.log('[NAVIGATOR] Navigator patches installed');
}

/**
 * 安装 Navigator.plugins
 */
function installPlugins(navigator) {
  const pluginsData = [
    {
      name: 'PDF Viewer',
      description: 'Portable Document Format',
      filename: 'internal-pdf-viewer',
      mimeTypes: [
        { type: 'application/pdf', suffixes: 'pdf', description: 'Portable Document Format' },
        { type: 'text/pdf', suffixes: 'pdf', description: 'Portable Document Format' }
      ]
    },
    {
      name: 'Chrome PDF Viewer',
      description: 'Portable Document Format',
      filename: 'internal-pdf-viewer',
      mimeTypes: [
        { type: 'application/pdf', suffixes: 'pdf', description: 'Portable Document Format' }
      ]
    },
    {
      name: 'Chromium PDF Viewer',
      description: 'Portable Document Format',
      filename: 'internal-pdf-viewer',
      mimeTypes: [
        { type: 'application/pdf', suffixes: 'pdf', description: 'Portable Document Format' }
      ]
    },
    {
      name: 'Microsoft Edge PDF Viewer',
      description: 'Portable Document Format',
      filename: 'internal-pdf-viewer',
      mimeTypes: [
        { type: 'application/pdf', suffixes: 'pdf', description: 'Portable Document Format' }
      ]
    },
    {
      name: 'WebKit built-in PDF',
      description: 'Portable Document Format',
      filename: 'internal-pdf-viewer',
      mimeTypes: [
        { type: 'application/pdf', suffixes: 'pdf', description: 'Portable Document Format' }
      ]
    }
  ];
  
  const plugins = pluginsData.map((pluginData, index) => {
    const plugin = {
      name: pluginData.name,
      description: pluginData.description,
      filename: pluginData.filename,
      length: pluginData.mimeTypes.length,
      item: function(i) {
        return this[i] || null;
      },
      namedItem: function(name) {
        for (let i = 0; i < this.length; i++) {
          if (this[i].type === name) {
            return this[i];
          }
        }
        return null;
      }
    };
    
    // 添加 MimeType 对象
    pluginData.mimeTypes.forEach((mt, idx) => {
      plugin[idx] = {
        type: mt.type,
        suffixes: mt.suffixes,
        description: mt.description,
        enabledPlugin: plugin
      };
    });
    
    return plugin;
  });
  
  const pluginArray = {
    length: plugins.length,
    item: function(index) {
      return plugins[index] || null;
    },
    namedItem: function(name) {
      return plugins.find(p => p.name === name) || null;
    },
    refresh: function() {}
  };
  
  // 添加插件到数组
  plugins.forEach((plugin, index) => {
    pluginArray[index] = plugin;
  });
  
  Object.defineProperty(navigator, 'plugins', {
    get: () => pluginArray,
    configurable: true
  });
}

/**
 * 安装 Navigator.mimeTypes
 */
function installMimeTypes(navigator) {
  const mimeTypesData = [
    { type: 'application/pdf', suffixes: 'pdf', description: 'Portable Document Format' },
    { type: 'text/pdf', suffixes: 'pdf', description: 'Portable Document Format' }
  ];
  
  const mimeTypes = mimeTypesData.map(mt => ({
    type: mt.type,
    suffixes: mt.suffixes,
    description: mt.description,
    enabledPlugin: navigator.plugins[0] || null
  }));
  
  const mimeTypeArray = {
    length: mimeTypes.length,
    item: function(index) {
      return mimeTypes[index] || null;
    },
    namedItem: function(name) {
      return mimeTypes.find(mt => mt.type === name) || null;
    }
  };
  
  mimeTypes.forEach((mt, index) => {
    mimeTypeArray[index] = mt;
  });
  
  Object.defineProperty(navigator, 'mimeTypes', {
    get: () => mimeTypeArray,
    configurable: true
  });
}

/**
 * 安装 Navigator.connection
 */
function installConnection(navigator) {
  const connection = {
    downlink: 10,
    effectiveType: '4g',
    rtt: 50,
    saveData: false,
    onchange: null,
    addEventListener: function() {},
    removeEventListener: function() {},
    dispatchEvent: function() { return true; }
  };
  
  Object.defineProperty(navigator, 'connection', {
    get: () => connection,
    configurable: true
  });
}

/**
 * 安装 Navigator.permissions
 */
function installPermissions(navigator) {
  const permissions = {
    query: async function(permissionDesc) {
      return {
        state: 'prompt',
        onchange: null,
        addEventListener: function() {},
        removeEventListener: function() {},
        dispatchEvent: function() { return true; }
      };
    }
  };
  
  Object.defineProperty(navigator, 'permissions', {
    get: () => permissions,
    configurable: true
  });
}

/**
 * 安装 Navigator.userAgentData (可选)
 */
function installUserAgentData(navigator) {
  const userAgentData = {
    brands: [
      { brand: 'Google Chrome', version: '131' },
      { brand: 'Chromium', version: '131' },
      { brand: 'Not_A Brand', version: '24' }
    ],
    mobile: false,
    platform: 'macOS',
    getHighEntropyValues: async function(hints) {
      return {
        architecture: 'arm',
        bitness: '64',
        brands: this.brands,
        fullVersionList: [
          { brand: 'Google Chrome', version: '131.0.6778.140' },
          { brand: 'Chromium', version: '131.0.6778.140' },
          { brand: 'Not_A Brand', version: '24.0.0.0' }
        ],
        mobile: false,
        model: '',
        platform: 'macOS',
        platformVersion: '14.0.0',
        uaFullVersion: '131.0.6778.140'
      };
    },
    toJSON: function() {
      return {
        brands: this.brands,
        mobile: this.mobile,
        platform: this.platform
      };
    }
  };
  
  Object.defineProperty(navigator, 'userAgentData', {
    get: () => userAgentData,
    configurable: true
  });
}

module.exports = { installNavigatorPatches };
