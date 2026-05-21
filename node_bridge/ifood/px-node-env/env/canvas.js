const { createCanvas } = require('@napi-rs/canvas');

/**
 * 安装 Canvas 2D 指纹
 */
function installCanvasPatch(window) {
  const document = window.document;
  
  // 保存原始的 createElement
  const originalCreateElement = document.createElement.bind(document);
  
  // 重写 createElement 来处理 canvas
  document.createElement = function(tagName) {
    if (tagName.toLowerCase() === 'canvas') {
      return createCanvasElement(window);
    }
    return originalCreateElement(tagName);
  };
  
  console.log('[CANVAS] Canvas 2D patch installed');
}

/**
 * 创建一个带有真实 Canvas API 的元素
 */
function createCanvasElement(window) {
  const document = window.document;
  const element = document.createElement.call(document, 'canvas');
  
  // 创建真实的 canvas (用于 2D 上下文)
  const realCanvas = createCanvas(300, 150);
  
  // 设置属性
  element.width = 300;
  element.height = 150;
  
  // 保存原始的 getContext
  const originalGetContext = element.getContext.bind(element);
  
  // 重写 getContext
  element.getContext = function(contextType, contextAttributes) {
    if (contextType === '2d') {
      return realCanvas.getContext('2d');
    } else if (contextType === 'webgl' || contextType === 'experimental-webgl') {
      return createWebGLContext(element, contextAttributes);
    }
    return originalGetContext(contextType, contextAttributes);
  };
  
  // 添加 toDataURL 方法
  element.toDataURL = function(type, quality) {
    return realCanvas.toDataURL(type, quality);
  };
  
  // 添加 toBlob 方法
  element.toBlob = function(callback, type, quality) {
    realCanvas.toBlob(callback, type, quality);
  };
  
  return element;
}

/**
 * 创建 WebGL Mock 上下文
 */
function createWebGLContext(canvas, contextAttributes) {
  const gl = {
    canvas: canvas,
    drawingBufferWidth: canvas.width || 300,
    drawingBufferHeight: canvas.height || 150,
    
    // WebGL 常量
    VERSION: 0x1F02,
    RENDERER: 0x1F01,
    VENDOR: 0x1F00,
    SHADING_LANGUAGE_VERSION: 0x8B8C,
    
    // 扩展常量
    UNMASKED_VENDOR_WEBGL: 0x9245,
    UNMASKED_RENDERER_WEBGL: 0x9246,
    
    // 参数值
    getParameter: function(pname) {
      switch (pname) {
        case this.VERSION:
          return 'WebGL 1.0';
        case this.RENDERER:
          return 'WebKit WebGL';
        case this.VENDOR:
          return 'WebKit';
        case this.SHADING_LANGUAGE_VERSION:
          return 'WebGL GLSL ES 1.0';
        case this.UNMASKED_VENDOR_WEBGL:
          return 'Google Inc. (NVIDIA)';
        case this.UNMASKED_RENDERER_WEBGL:
          return 'ANGLE (NVIDIA, NVIDIA GeForce GTX 1650 Direct3D11 vs_5_0 ps_5_0, D3D11)';
        case 0x8B4C: // MAX_VERTEX_ATTRIBS
          return 16;
        case 0x8869: // MAX_TEXTURE_IMAGE_UNITS
          return 16;
        case 0x8DFD: // MAX_RENDERBUFFER_SIZE
          return 16384;
        case 0x0D33: // MAX_VIEWPORT_DIMS
          return new Int32Array([16384, 16384]);
        case 0x8872: // MAX_VERTEX_TEXTURE_IMAGE_UNITS
          return 16;
        case 0x8B4D: // MAX_VARYING_VECTORS
          return 30;
        case 0x8B49: // MAX_VERTEX_UNIFORM_VECTORS
          return 256;
        case 0x8DFB: // MAX_FRAGMENT_UNIFORM_VECTORS
          return 224;
        case 0x846D: // ALIASED_LINE_WIDTH_RANGE
          return new Float32Array([1, 1]);
        case 0x846E: // ALIASED_POINT_SIZE_RANGE
          return new Float32Array([1, 1024]);
        case 0x8B8D: // ACTIVE_TEXTURE
          return 33984;
        case 0x8894: // ARRAY_BUFFER_BINDING
          return null;
        default:
          return null;
      }
    },
    
    // 获取扩展
    getExtension: function(name) {
      const extensions = {
        'WEBGL_debug_renderer_info': {
          UNMASKED_VENDOR_WEBGL: 0x9245,
          UNMASKED_RENDERER_WEBGL: 0x9246
        },
        'EXT_texture_filter_anisotropic': {},
        'WEBKIT_EXT_texture_filter_anisotropic': {},
        'OES_texture_float': {},
        'OES_texture_half_float': {},
        'OES_standard_derivatives': {},
        'OES_vertex_array_object': {},
        'WEBGL_lose_context': {},
        'WEBGL_compressed_texture_s3tc': {},
        'WEBKIT_WEBGL_compressed_texture_s3tc': {}
      };
      return extensions[name] || null;
    },
    
    // 获取支持的扩展列表
    getSupportedExtensions: function() {
      return [
        'ANGLE_instanced_arrays',
        'EXT_blend_minmax',
        'EXT_color_buffer_half_float',
        'EXT_disjoint_timer_query',
        'EXT_float_blend',
        'EXT_frag_depth',
        'EXT_shader_texture_lod',
        'EXT_texture_compression_bptc',
        'EXT_texture_compression_rgtc',
        'EXT_texture_filter_anisotropic',
        'EXT_sRGB',
        'KHR_parallel_shader_compile',
        'OES_element_index_uint',
        'OES_fbo_render_mipmap',
        'OES_standard_derivatives',
        'OES_texture_float',
        'OES_texture_float_linear',
        'OES_texture_half_float',
        'OES_texture_half_float_linear',
        'OES_vertex_array_object',
        'WEBGL_color_buffer_float',
        'WEBGL_compressed_texture_s3tc',
        'WEBGL_compressed_texture_s3tc_srgb',
        'WEBGL_debug_renderer_info',
        'WEBGL_debug_shaders',
        'WEBGL_depth_texture',
        'WEBGL_draw_buffers',
        'WEBGL_lose_context',
        'WEBGL_multi_draw'
      ];
    },
    
    // 其他必要的方法（空实现）
    createBuffer: () => ({}),
    bindBuffer: () => {},
    bufferData: () => {},
    createProgram: () => ({}),
    createShader: () => ({}),
    shaderSource: () => {},
    compileShader: () => {},
    getShaderParameter: () => true,
    attachShader: () => {},
    linkProgram: () => {},
    getProgramParameter: () => true,
    useProgram: () => {},
    createTexture: () => ({}),
    bindTexture: () => {},
    texParameteri: () => {},
    texImage2D: () => {},
    clear: () => {},
    enable: () => {},
    disable: () => {},
    depthFunc: () => {},
    clearColor: () => {},
    clearDepth: () => {},
    viewport: () => {},
    drawArrays: () => {},
    drawElements: () => {},
    getAttribLocation: () => 0,
    getUniformLocation: () => ({}),
    vertexAttribPointer: () => {},
    enableVertexAttribArray: () => {},
    uniform1f: () => {},
    uniform2f: () => {},
    uniform3f: () => {},
    uniform4f: () => {},
    uniformMatrix4fv: () => {},
    activeTexture: () => {},
    getError: () => 0
  };
  
  // 使所有函数的 toString 返回 [native code]
  Object.keys(gl).forEach(key => {
    if (typeof gl[key] === 'function') {
      Object.defineProperty(gl[key], 'toString', {
        value: () => 'function ' + key + '() { [native code] }',
        writable: false,
        configurable: true
      });
    }
  });
  
  return gl;
}

module.exports = { installCanvasPatch };
