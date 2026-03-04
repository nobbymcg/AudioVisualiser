/**
 * AudioVisualiser - A reusable audio visualization component
 * Creates animated circles modulated by audio input (file or microphone)
 */
class AudioVisualiser {
  // Named constants
  static FAST_FFT_SIZE = 2048;
  static SLOW_FFT_SIZE = 8192;
  static NUM_POINTS = 360;
  static NORMALIZE_OFFSET = 128;
  static TWO_PI = 2 * Math.PI;
  static ANIMATION_STARTUP_DELAY_MS = 63;

  constructor(canvasId, options = {}) {
    // Canvas setup
    this.canvas = document.getElementById(canvasId);
    if (!this.canvas) {
      throw new Error(`Canvas with id "${canvasId}" not found`);
    }
    this.ctx = this.canvas.getContext('2d');
    
    // Set canvas size
    this.canvas.width = options.width || 500;
    this.canvas.height = options.height || 500;
    this.canvas.style.width = `${this.canvas.width}px`;
    this.canvas.style.height = `${this.canvas.height}px`;
    
    // Circle parameters
    this.centerX = this.canvas.width / 2;
    this.centerY = this.canvas.height / 2;
    this.baseRadius = options.baseRadius || 150;
    this.sineAmplitude = options.sineAmplitude || 25;
    this.sineFrequency = options.sineFrequency || 10;  // First circle: 10 petals
    this.sineFrequency2 = options.sineFrequency2 || 6;  // Second circle: 6 petals
    
    // Pre-compute sine/cosine lookup tables for the base angles
    this.cosTable = new Float32Array(AudioVisualiser.NUM_POINTS + 1);
    this.sinTable = new Float32Array(AudioVisualiser.NUM_POINTS + 1);
    for (let i = 0; i <= AudioVisualiser.NUM_POINTS; i++) {
      const angle = (i / AudioVisualiser.NUM_POINTS) * AudioVisualiser.TWO_PI;
      this.cosTable[i] = Math.cos(angle);
      this.sinTable[i] = Math.sin(angle);
    }
    
    // Rotation tracking
    this.rotationStartTime = null;
    
    // Audio context and analysers
    this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
    this.source = null;
    
    // Fast analyser (~1/32 second window)
    this.analyser = this.audioContext.createAnalyser();
    this.analyser.fftSize = AudioVisualiser.FAST_FFT_SIZE;
    this.bufferLength = this.analyser.frequencyBinCount;
    this.dataArray = new Uint8Array(this.bufferLength);
    
    // Slow analyser (~1/8 second window)
    this.analyser2 = this.audioContext.createAnalyser();
    this.analyser2.fftSize = AudioVisualiser.SLOW_FFT_SIZE;
    this.bufferLength2 = this.analyser2.frequencyBinCount;
    this.dataArray2 = new Uint8Array(this.bufferLength2);
    
    // Connection state tracking (avoids try/catch for flow control)
    this.analyserConnectedToDestination = false;
    this.sourceConnectedToAnalysers = false;
    this.connectAnalyserToDestination();
    
    // Current RMS values
    this.currentRMS = 0;
    this.currentRMS2 = 0;
    
    // Animation state
    this.animationFrameId = null;
    this.isRecording = false;
    
    // Object URL tracking (prevents memory leaks)
    this.currentObjectURL = null;
    
    // Microphone state
    this.micStream = null;
    this.micSource = null;
    
    // Bound event listener references (for cleanup in destroy)
    this._boundListeners = [];
    
    // Default settings (can be overridden by connectControls)
    this.settings = {
      rotationSpeed: 8,    // seconds per revolution
      rotationSpeed2: 12,  // seconds per revolution for second circle
      fade: 0.3,          // trail fade
      color1: '#2563eb',  // first circle color
      color2: '#a02ced',  // second circle color
      bgColor: '#f7f7f9', // background color
      opacity1: 0.1,      // first circle opacity
      opacity2: 0.05      // second circle opacity
    };
    
    // Cached RGB values (recomputed only when colors change)
    this._cachedRGB = {
      color1: this.hexToRgb(this.settings.color1),
      color2: this.hexToRgb(this.settings.color2),
      bgColor: this.hexToRgb(this.settings.bgColor)
    };
    
    // Draw initial state
    this.drawCircle(0, 0);
  }
  
  // --- Connection state helpers ---
  
  /**
   * Connect analyser to audio destination (for playback output)
   */
  connectAnalyserToDestination() {
    if (!this.analyserConnectedToDestination) {
      this.analyser.connect(this.audioContext.destination);
      this.analyserConnectedToDestination = true;
    }
  }
  
  /**
   * Disconnect analyser from audio destination
   */
  disconnectAnalyserFromDestination() {
    if (this.analyserConnectedToDestination) {
      this.analyser.disconnect();
      this.analyserConnectedToDestination = false;
    }
  }
  
  /**
   * Connect audio source to both analysers
   */
  connectSourceToAnalysers() {
    if (this.source && !this.sourceConnectedToAnalysers) {
      this.source.connect(this.analyser);
      this.source.connect(this.analyser2);
      this.sourceConnectedToAnalysers = true;
    }
  }
  
  /**
   * Disconnect audio source from analysers
   */
  disconnectSource() {
    if (this.source && this.sourceConnectedToAnalysers) {
      this.source.disconnect();
      this.sourceConnectedToAnalysers = false;
    }
  }
  
  // --- Helper to register event listeners with cleanup tracking ---
  
  /**
   * Add an event listener and track it for removal on destroy
   */
  _addTrackedListener(element, event, handler) {
    if (!element) return;
    element.addEventListener(event, handler);
    this._boundListeners.push({ element, event, handler });
  }
  
  /**
   * Remove all tracked event listeners
   */
  _removeAllListeners() {
    for (const { element, event, handler } of this._boundListeners) {
      element.removeEventListener(event, handler);
    }
    this._boundListeners = [];
  }
  
  /**
   * Connect to HTML controls (inputs) for interactive control
   */
  connectControls(controlIds) {
    const {
      rotationSpeed,
      rotationSpeed2,
      fade,
      fadeValue,
      color1,
      color2,
      bgColor,
      opacity1,
      opacity1Value,
      opacity2,
      opacity2Value,
      fileInput,
      audioPlayer,
      recordBtn
    } = controlIds;
    
    // Store references
    this.controls = {
      rotationSpeed: document.getElementById(rotationSpeed),
      rotationSpeed2: document.getElementById(rotationSpeed2),
      fade: document.getElementById(fade),
      fadeValue: document.getElementById(fadeValue),
      color1: document.getElementById(color1),
      color2: document.getElementById(color2),
      bgColor: document.getElementById(bgColor),
      opacity1: document.getElementById(opacity1),
      opacity1Value: document.getElementById(opacity1Value),
      opacity2: document.getElementById(opacity2),
      opacity2Value: document.getElementById(opacity2Value),
      fileInput: document.getElementById(fileInput),
      audioPlayer: document.getElementById(audioPlayer),
      recordBtn: document.getElementById(recordBtn)
    };
    
    // Set up event listeners for controls
    this.setupControlListeners();
  }
  
  /**
   * Set up event listeners for all controls
   */
  setupControlListeners() {
    const c = this.controls;
    
    // Update fade value display
    if (c.fade && c.fadeValue) {
      this._addTrackedListener(c.fade, 'input', () => {
        c.fadeValue.textContent = c.fade.value;
        this.settings.fade = parseFloat(c.fade.value);
      });
    }
    
    // Update opacity displays and settings
    if (c.opacity1 && c.opacity1Value) {
      this._addTrackedListener(c.opacity1, 'input', () => {
        c.opacity1Value.textContent = c.opacity1.value;
        this.settings.opacity1 = parseFloat(c.opacity1.value);
      });
    }
    
    if (c.opacity2 && c.opacity2Value) {
      this._addTrackedListener(c.opacity2, 'input', () => {
        c.opacity2Value.textContent = c.opacity2.value;
        this.settings.opacity2 = parseFloat(c.opacity2.value);
      });
    }
    
    // Cache RGB values when color inputs change
    if (c.color1) {
      this._addTrackedListener(c.color1, 'input', () => {
        this._cachedRGB.color1 = this.hexToRgb(c.color1.value);
      });
    }
    if (c.color2) {
      this._addTrackedListener(c.color2, 'input', () => {
        this._cachedRGB.color2 = this.hexToRgb(c.color2.value);
      });
    }
    if (c.bgColor) {
      this._addTrackedListener(c.bgColor, 'input', () => {
        this._cachedRGB.bgColor = this.hexToRgb(c.bgColor.value);
      });
    }
    
    // File input handler
    if (c.fileInput && c.audioPlayer) {
      this._addTrackedListener(c.fileInput, 'change', (e) => this.handleFileSelect(e));
    }
    
    // Audio player handlers
    if (c.audioPlayer) {
      this._addTrackedListener(c.audioPlayer, 'play', () => this.handleAudioPlay());
      this._addTrackedListener(c.audioPlayer, 'pause', () => this.stopAnimation());
      this._addTrackedListener(c.audioPlayer, 'ended', () => this.stopAnimation());
      this._addTrackedListener(c.audioPlayer, 'error', (e) => {
        console.error('Error loading audio file:', e);
        alert('Error loading audio file.');
      });
      this._addTrackedListener(c.audioPlayer, 'loadeddata', () => {
        console.log('Audio loaded successfully');
      });
    }
    
    // Record button handler
    if (c.recordBtn) {
      this._addTrackedListener(c.recordBtn, 'click', () => this.toggleRecording());
    }
  }
  
  /**
   * Handle file selection
   */
  async handleFileSelect(e) {
    const file = e.target.files[0];
    if (!file) return;
    
    console.log('File selected:', file.name);
    
    // Stop existing animation
    this.stopAnimation();
    
    // Stop microphone if recording
    this.stopMicrophone();
    
    // Reconnect analyser to destination for audio playback
    this.connectAnalyserToDestination();
    
    // Revoke previous object URL to prevent memory leak
    if (this.currentObjectURL) {
      URL.revokeObjectURL(this.currentObjectURL);
    }
    
    // Create object URL for the audio player
    this.currentObjectURL = URL.createObjectURL(file);
    this.controls.audioPlayer.src = this.currentObjectURL;
    this.controls.audioPlayer.classList.add('visible');
    
    // Create media element source if not already created
    if (!this.source) {
      this.source = this.audioContext.createMediaElementSource(this.controls.audioPlayer);
      this.source.connect(this.analyser);
      this.source.connect(this.analyser2);
      this.sourceConnectedToAnalysers = true;
    }
    
    console.log('Audio ready to play');
  }
  
  /**
   * Handle audio play event
   */
  handleAudioPlay() {
    console.log('Audio playing');
    
    // Stop microphone if recording
    this.stopMicrophone();
    
    // Reconnect analyser to destination for audio playback
    this.connectAnalyserToDestination();
    
    // Reconnect source if it was disconnected
    this.connectSourceToAnalysers();
    
    // Resume audio context if needed
    if (this.audioContext.state === 'suspended') {
      this.audioContext.resume();
    }
    
    // Start animation after brief delay
    setTimeout(() => {
      this.startAnimation();
    }, AudioVisualiser.ANIMATION_STARTUP_DELAY_MS);
  }
  
  /**
   * Toggle microphone recording
   */
  async toggleRecording() {
    if (this.isRecording) {
      this.stopMicrophone();
      this.stopAnimation();
      this.drawCircle(0, 0);
      
      if (this.controls.recordBtn) {
        this.controls.recordBtn.textContent = 'Start Recording';
      }
      if (this.controls.fileInput) {
        this.controls.fileInput.disabled = false;
      }
      
      console.log('Recording stopped');
    } else {
      try {
        // Request microphone access
        this.micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        
        // Stop any playing audio
        if (this.controls.audioPlayer && !this.controls.audioPlayer.paused) {
          this.controls.audioPlayer.pause();
        }
        
        // Stop existing animation
        this.stopAnimation();
        
        // Disconnect audio player source
        this.disconnectSource();
        
        // Disconnect analyser from destination (no playback for mic)
        this.disconnectAnalyserFromDestination();
        
        // Create microphone source
        this.micSource = this.audioContext.createMediaStreamSource(this.micStream);
        this.micSource.connect(this.analyser);
        this.micSource.connect(this.analyser2);
        
        // Resume audio context if suspended
        if (this.audioContext.state === 'suspended') {
          await this.audioContext.resume();
        }
        
        // Start visualization
        this.isRecording = true;
        if (this.controls.recordBtn) {
          this.controls.recordBtn.textContent = 'Stop Recording';
        }
        if (this.controls.fileInput) {
          this.controls.fileInput.disabled = true;
        }
        
        this.startAnimation();
        
        console.log('Recording started');
      } catch (err) {
        console.error('Error accessing microphone:', err);
        alert('Error accessing microphone: ' + err.message);
      }
    }
  }
  
  /**
   * Stop microphone and clean up
   */
  stopMicrophone() {
    if (this.micStream) {
      this.micStream.getTracks().forEach(track => track.stop());
      this.micStream = null;
    }
    
    if (this.micSource) {
      this.micSource.disconnect();
      this.micSource = null;
    }
    
    this.isRecording = false;
  }
  
  /**
   * Get rotation period in milliseconds from settings
   */
  getRotationPeriod() {
    const seconds = this.controls?.rotationSpeed 
      ? parseFloat(this.controls.rotationSpeed.value) 
      : this.settings.rotationSpeed;
    return seconds * 1000;
  }
  
  /**
   * Get rotation period for second circle in milliseconds
   */
  getRotationPeriod2() {
    const seconds = this.controls?.rotationSpeed2 
      ? parseFloat(this.controls.rotationSpeed2.value) 
      : this.settings.rotationSpeed2;
    return seconds * 1000;
  }
  
  /**
   * Calculate RMS from fast analyser
   */
  calculateRMS() {
    this.analyser.getByteTimeDomainData(this.dataArray);
    let sum = 0;
    for (let i = 0; i < this.bufferLength; i++) {
      const normalized = (this.dataArray[i] - AudioVisualiser.NORMALIZE_OFFSET) / AudioVisualiser.NORMALIZE_OFFSET;
      sum += normalized * normalized;
    }
    return Math.sqrt(sum / this.bufferLength);
  }
  
  /**
   * Calculate RMS from slow analyser
   */
  calculateRMS2() {
    this.analyser2.getByteTimeDomainData(this.dataArray2);
    let sum = 0;
    for (let i = 0; i < this.bufferLength2; i++) {
      const normalized = (this.dataArray2[i] - AudioVisualiser.NORMALIZE_OFFSET) / AudioVisualiser.NORMALIZE_OFFSET;
      sum += normalized * normalized;
    }
    return Math.sqrt(sum / this.bufferLength2);
  }
  
  /**
   * Draw a single modulated circle using pre-computed trig tables and Path2D
   */
  drawModulatedCircle(rmsModulation, sineFreq, rotationOffset, color, cachedRGB, opacity, lineWidth) {
    const ctx = this.ctx;
    const path = new Path2D();
    const modulatedAmplitude = this.sineAmplitude * rmsModulation * 2;
    const numPoints = AudioVisualiser.NUM_POINTS;
    
    for (let i = 0; i <= numPoints; i++) {
      const baseAngle = (i / numPoints) * AudioVisualiser.TWO_PI;
      const radiusModulation = modulatedAmplitude * Math.cos(sineFreq * baseAngle + rotationOffset);
      const radius = this.baseRadius + radiusModulation;
      
      const x = this.centerX + radius * this.cosTable[i];
      const y = this.centerY + radius * this.sinTable[i];
      
      if (i === 0) {
        path.moveTo(x, y);
      } else {
        path.lineTo(x, y);
      }
    }
    
    path.closePath();
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    ctx.stroke(path);
    
    // Fill with opacity using cached RGB
    ctx.fillStyle = `rgba(${cachedRGB.r}, ${cachedRGB.g}, ${cachedRGB.b}, ${opacity})`;
    ctx.fill(path);
  }
  
  /**
   * Draw the visualization
   */
  drawCircle(rmsModulation, rmsModulation2) {
    // Create trail effect with semi-transparent background
    const fadeAlpha = this.controls?.fade 
      ? parseFloat(this.controls.fade.value) 
      : this.settings.fade;
    const bgRGB = this._cachedRGB.bgColor;
    this.ctx.fillStyle = `rgba(${bgRGB.r}, ${bgRGB.g}, ${bgRGB.b}, ${fadeAlpha})`;
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    
    // Calculate rotation offsets
    let rotationOffset = 0;
    let rotationOffset2 = 0;
    
    if (this.rotationStartTime !== null) {
      const elapsed = Date.now() - this.rotationStartTime;
      rotationOffset = (elapsed / this.getRotationPeriod()) * AudioVisualiser.TWO_PI * this.sineFrequency;
      rotationOffset2 = (elapsed / this.getRotationPeriod2()) * AudioVisualiser.TWO_PI * this.sineFrequency2;
    }
    
    // Get colors and opacities
    const color1 = this.controls?.color1?.value || this.settings.color1;
    const color2 = this.controls?.color2?.value || this.settings.color2;
    const opacity1 = this.controls?.opacity1 
      ? parseFloat(this.controls.opacity1.value) 
      : this.settings.opacity1;
    const opacity2 = this.controls?.opacity2 
      ? parseFloat(this.controls.opacity2.value) 
      : this.settings.opacity2;
    
    // Draw second circle first (behind)
    this.drawModulatedCircle(rmsModulation2, this.sineFrequency2, rotationOffset2, color2, this._cachedRGB.color2, opacity2, 1.5);
    
    // Draw first circle on top
    this.drawModulatedCircle(rmsModulation, this.sineFrequency, rotationOffset, color1, this._cachedRGB.color1, opacity1, 2);
  }
  
  /**
   * Convert hex color to RGB
   */
  hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : { r: 0, g: 0, b: 0 };
  }
  
  /**
   * Animation frame callback
   */
  animate() {
    this.currentRMS = this.calculateRMS();
    this.currentRMS2 = this.calculateRMS2();
    this.drawCircle(this.currentRMS, this.currentRMS2);
    this.animationFrameId = requestAnimationFrame(this._boundAnimate);
  }
  
  /**
   * Start animation loop using requestAnimationFrame
   */
  startAnimation() {
    // Stop any existing animation first
    this.stopAnimation();
    
    this.rotationStartTime = Date.now();
    
    // Store bound reference for consistent cancel
    this._boundAnimate = this.animate.bind(this);
    this.animationFrameId = requestAnimationFrame(this._boundAnimate);
  }
  
  /**
   * Stop animation loop
   */
  stopAnimation() {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    this.rotationStartTime = null;
    this.drawCircle(0, 0);
  }
  
  /**
   * Clean up all resources
   */
  destroy() {
    this.stopAnimation();
    this.stopMicrophone();
    
    // Remove all tracked event listeners
    this._removeAllListeners();
    
    // Revoke any outstanding object URL
    if (this.currentObjectURL) {
      URL.revokeObjectURL(this.currentObjectURL);
      this.currentObjectURL = null;
    }
    
    if (this.source) {
      this.source.disconnect();
    }
    
    if (this.audioContext) {
      this.audioContext.close();
    }
  }
}

// Export for use in modules (optional)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = AudioVisualiser;
}
