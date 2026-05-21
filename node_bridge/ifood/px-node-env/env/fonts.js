/**
 * 字体枚举支持
 * PX SDK 通过测试字体渲染的 offsetWidth/offsetHeight 来检测字体存在
 */

/**
 * 安装字体检测支持
 */
function installFontDetection(window) {
  const document = window.document;
  
  // 定义常见字体及其特征
  const fontMetrics = {
    // 常见系统字体
    'Arial': { widthMultiplier: 1.0, heightMultiplier: 1.0 },
    'Helvetica': { widthMultiplier: 1.02, heightMultiplier: 1.0 },
    'Times New Roman': { widthMultiplier: 0.95, heightMultiplier: 1.05 },
    'Courier New': { widthMultiplier: 1.2, heightMultiplier: 1.0 },
    'Verdana': { widthMultiplier: 1.1, heightMultiplier: 1.0 },
    'Georgia': { widthMultiplier: 0.98, heightMultiplier: 1.03 },
    'Palatino': { widthMultiplier: 0.97, heightMultiplier: 1.02 },
    'Garamond': { widthMultiplier: 0.93, heightMultiplier: 1.01 },
    'Bookman': { widthMultiplier: 1.05, heightMultiplier: 1.02 },
    'Comic Sans MS': { widthMultiplier: 1.08, heightMultiplier: 1.0 },
    'Trebuchet MS': { widthMultiplier: 1.03, heightMultiplier: 1.0 },
    'Impact': { widthMultiplier: 0.88, heightMultiplier: 1.1 },
    
    // 默认字体
    'monospace': { widthMultiplier: 1.2, heightMultiplier: 1.0 },
    'sans-serif': { widthMultiplier: 1.0, heightMultiplier: 1.0 },
    'serif': { widthMultiplier: 0.95, heightMultiplier: 1.05 }
  };
  
  // 保存原始的 createElement
  const originalCreateElement = document.createElement.bind(document);
  
  // 重写 createElement 以处理字体检测
  const enhancedCreateElement = document.createElement;
  document.createElement = function(tagName) {
    const element = enhancedCreateElement.call(this, tagName);
    
    if (tagName.toLowerCase() === 'span') {
      // 为 span 元素添加字体检测支持
      enhanceElementForFontDetection(element, fontMetrics);
    }
    
    return element;
  };
  
  console.log('[FONTS] Font detection support installed');
}

/**
 * 增强元素以支持字体检测
 */
function enhanceElementForFontDetection(element, fontMetrics) {
  let currentFont = 'Arial';
  let baseWidth = 100;
  let baseHeight = 20;
  
  // 监听 style 变化
  const originalSetAttribute = element.setAttribute.bind(element);
  element.setAttribute = function(name, value) {
    originalSetAttribute(name, value);
    if (name === 'style') {
      // 解析字体族
      const fontMatch = value.match(/font-family:\s*([^;]+)/);
      if (fontMatch) {
        currentFont = fontMatch[1].replace(/['"]/g, '').trim();
      }
    }
  };
  
  // 重写 offsetWidth
  Object.defineProperty(element, 'offsetWidth', {
    get: function() {
      const metrics = fontMetrics[currentFont] || fontMetrics['Arial'];
      return Math.round(baseWidth * metrics.widthMultiplier);
    },
    configurable: true
  });
  
  // 重写 offsetHeight
  Object.defineProperty(element, 'offsetHeight', {
    get: function() {
      const metrics = fontMetrics[currentFont] || fontMetrics['Arial'];
      return Math.round(baseHeight * metrics.heightMultiplier);
    },
    configurable: true
  });
}

module.exports = { installFontDetection };
