/**
 * AudioContext Mock
 * PX SDK 使用 OfflineAudioContext 生成音频指纹
 */

/**
 * 安装 AudioContext Mock
 */
function installAudioContext(window) {
  // 固定的音频指纹 hash (从真实浏览器采集)
  const AUDIO_FINGERPRINT = '124.04347527516074';
  
  /**
   * OfflineAudioContext Mock
   */
  class OfflineAudioContext {
    constructor(numberOfChannels, length, sampleRate) {
      this.numberOfChannels = numberOfChannels;
      this.length = length;
      this.sampleRate = sampleRate;
      this.currentTime = 0;
      this.destination = {
        numberOfInputs: 1,
        numberOfOutputs: 0,
        channelCount: numberOfChannels,
        channelCountMode: 'explicit',
        channelInterpretation: 'speakers'
      };
      this.listener = {
        positionX: { value: 0 },
        positionY: { value: 0 },
        positionZ: { value: 0 },
        forwardX: { value: 0 },
        forwardY: { value: 0 },
        forwardZ: { value: -1 },
        upX: { value: 0 },
        upY: { value: 1 },
        upZ: { value: 0 }
      };
      this.state = 'suspended';
      this.oncomplete = null;
    }
    
    createOscillator() {
      const oscillator = {
        type: 'sine',
        frequency: {
          value: 440,
          setValueAtTime: function() { return this; }
        },
        connect: function() { return this; },
        disconnect: function() {},
        start: function() {},
        stop: function() {}
      };
      return oscillator;
    }
    
    createDynamicsCompressor() {
      const compressor = {
        threshold: { value: -24 },
        knee: { value: 30 },
        ratio: { value: 12 },
        reduction: 0,
        attack: { value: 0.003 },
        release: { value: 0.25 },
        connect: function() { return this; },
        disconnect: function() {}
      };
      return compressor;
    }
    
    createGain() {
      const gain = {
        gain: {
          value: 1,
          setValueAtTime: function() { return this; }
        },
        connect: function() { return this; },
        disconnect: function() {}
      };
      return gain;
    }
    
    createAnalyser() {
      const analyser = {
        fftSize: 2048,
        frequencyBinCount: 1024,
        minDecibels: -100,
        maxDecibels: -30,
        smoothingTimeConstant: 0.8,
        getFloatFrequencyData: function() {},
        getByteFrequencyData: function() {},
        getFloatTimeDomainData: function() {},
        getByteTimeDomainData: function() {},
        connect: function() { return this; },
        disconnect: function() {}
      };
      return analyser;
    }
    
    createBiquadFilter() {
      const filter = {
        type: 'lowpass',
        frequency: { value: 350 },
        Q: { value: 1 },
        gain: { value: 0 },
        connect: function() { return this; },
        disconnect: function() {}
      };
      return filter;
    }
    
    startRendering() {
      return new Promise((resolve) => {
        setTimeout(() => {
          // 创建一个模拟的 AudioBuffer
          const audioBuffer = {
            length: this.length,
            duration: this.length / this.sampleRate,
            sampleRate: this.sampleRate,
            numberOfChannels: this.numberOfChannels,
            getChannelData: (channel) => {
              // 返回固定的音频数据以生成一致的指纹
              const data = new Float32Array(this.length);
              for (let i = 0; i < this.length; i++) {
                // 使用固定的算法生成数据
                data[i] = Math.sin(2 * Math.PI * 440 * i / this.sampleRate) * 0.5;
              }
              // 修改特定位置的值以匹配固定指纹
              if (data.length > 4500) {
                data[4500] = parseFloat(AUDIO_FINGERPRINT) / 1000000;
              }
              return data;
            },
            copyFromChannel: function() {},
            copyToChannel: function() {}
          };
          
          this.state = 'closed';
          if (this.oncomplete) {
            this.oncomplete({ renderedBuffer: audioBuffer });
          }
          resolve(audioBuffer);
        }, 10);
      });
    }
    
    close() {
      return Promise.resolve();
    }
    
    resume() {
      return Promise.resolve();
    }
    
    suspend() {
      return Promise.resolve();
    }
  }
  
  /**
   * AudioContext (在线版本)
   */
  class AudioContext {
    constructor() {
      this.currentTime = 0;
      this.sampleRate = 48000;
      this.state = 'running';
      this.destination = {
        numberOfInputs: 1,
        numberOfOutputs: 0,
        channelCount: 2,
        channelCountMode: 'explicit',
        channelInterpretation: 'speakers'
      };
      this.listener = {
        positionX: { value: 0 },
        positionY: { value: 0 },
        positionZ: { value: 0 },
        forwardX: { value: 0 },
        forwardY: { value: 0 },
        forwardZ: { value: -1 },
        upX: { value: 0 },
        upY: { value: 1 },
        upZ: { value: 0 }
      };
    }
    
    createOscillator() {
      return OfflineAudioContext.prototype.createOscillator();
    }
    
    createGain() {
      return OfflineAudioContext.prototype.createGain();
    }
    
    createAnalyser() {
      return OfflineAudioContext.prototype.createAnalyser();
    }
    
    createBiquadFilter() {
      return OfflineAudioContext.prototype.createBiquadFilter();
    }
    
    close() {
      return Promise.resolve();
    }
    
    resume() {
      return Promise.resolve();
    }
    
    suspend() {
      return Promise.resolve();
    }
  }
  
  // 安装到 window
  window.OfflineAudioContext = OfflineAudioContext;
  window.AudioContext = AudioContext;
  window.webkitOfflineAudioContext = OfflineAudioContext;
  window.webkitAudioContext = AudioContext;
  
  console.log('[AUDIO] AudioContext mock installed');
}

module.exports = { installAudioContext };
