/**
 * AudioVisualiser - A reusable audio visualization component
 * Creates animated circles modulated by audio input (file or microphone)
 */
class AudioVisualiser {
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
    
    // Rotation tracking
    this.rotationStartTime = null;
    
    // Audio context and analysers
    this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
    this.source = null;
    
    // Fast analyser (~1/32 second window)
    this.analyser = this.audioContext.createAnalyser();
    this.analyser.fftSize = 2048;
    this.bufferLength = this.analyser.frequencyBinCount;
    this.dataArray = new Uint8Array(this.bufferLength);
    
    // Slow analyser (~1/8 second window)
    this.analyser2 = this.audioContext.createAnalyser();
    this.analyser2.fftSize = 8192;
    this.bufferLength2 = this.analyser2.frequencyBinCount;
    this.dataArray2 = new Uint8Array(this.bufferLength2);
    
    this.analyser.connect(this.audioContext.destination);
    
    // Current RMS values
    this.currentRMS = 0;
    this.currentRMS2 = 0;
    
    // Animation state
    this.animationInterval = null;
    this.isRecording = false;
    
    // Microphone state
    this.micStream = null;
    this.micSource = null;
    
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
    
    // Draw initial state
    this.drawCircle(0, 0);
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
      c.fade.addEventListener('input', () => {
        c.fadeValue.textContent = c.fade.value;
        this.settings.fade = parseFloat(c.fade.value);
      });
    }
    
    // Update opacity displays and settings
    if (c.opacity1 && c.opacity1Value) {
      c.opacity1.addEventListener('input', () => {
        c.opacity1Value.textContent = c.opacity1.value;
        this.settings.opacity1 = parseFloat(c.opacity1.value);
      });
    }
    
    if (c.opacity2 && c.opacity2Value) {
      c.opacity2.addEventListener('input', () => {
        c.opacity2Value.textContent = c.opacity2.value;
        this.settings.opacity2 = parseFloat(c.opacity2.value);
      });
    }
    
    // File input handler
    if (c.fileInput && c.audioPlayer) {
      c.fileInput.addEventListener('change', (e) => this.handleFileSelect(e));
    }
    
    // Audio player handlers
    if (c.audioPlayer) {
      c.audioPlayer.addEventListener('play', () => this.handleAudioPlay());
      c.audioPlayer.addEventListener('pause', () => this.stopAnimation());
      c.audioPlayer.addEventListener('ended', () => this.stopAnimation());
      c.audioPlayer.addEventListener('error', (e) => {
        console.error('Error loading audio file:', e);
        alert('Error loading audio file.');
      });
      c.audioPlayer.addEventListener('loadeddata', () => {
        console.log('Audio loaded successfully');
      });
    }
    
    // Record button handler
    if (c.recordBtn) {
      c.recordBtn.addEventListener('click', () => this.toggleRecording());
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
    if (this.animationInterval) {
      clearInterval(this.animationInterval);
      this.animationInterval = null;
    }
    
    // Stop microphone if recording
    this.stopMicrophone();
    
    // Reconnect analyser to destination for audio playback
    try {
      this.analyser.connect(this.audioContext.destination);
    } catch (e) {
      // Already connected, ignore
    }
    
    // Create object URL for the audio player
    const objectURL = URL.createObjectURL(file);
    this.controls.audioPlayer.src = objectURL;
    this.controls.audioPlayer.classList.add('visible');
    
    // Create media element source if not already created
    if (!this.source) {
      this.source = this.audioContext.createMediaElementSource(this.controls.audioPlayer);
      this.source.connect(this.analyser);
      this.source.connect(this.analyser2);
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
    try {
      this.analyser.connect(this.audioContext.destination);
    } catch (e) {
      // Already connected, ignore
    }
    
    // Reconnect source if it was disconnected
    if (this.source) {
      try {
        this.source.connect(this.analyser);
        this.source.connect(this.analyser2);
      } catch (e) {
        // Already connected, ignore
      }
    }
    
    // Resume audio context if needed
    if (this.audioContext.state === 'suspended') {
      this.audioContext.resume();
    }
    
    // Start animation after brief delay
    setTimeout(() => {
      this.startAnimation();
    }, 62.5);
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
        if (this.animationInterval) {
          clearInterval(this.animationInterval);
          this.animationInterval = null;
        }
        
        // Disconnect audio player source
        if (this.source) {
          this.source.disconnect();
        }
        
        // Disconnect analyser from destination (no playback)
        this.analyser.disconnect();
        
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
      const normalized = (this.dataArray[i] - 128) / 128;
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
      const normalized = (this.dataArray2[i] - 128) / 128;
      sum += normalized * normalized;
    }
    return Math.sqrt(sum / this.bufferLength2);
  }
  
  /**
   * Draw a single modulated circle
   */
  drawModulatedCircle(rmsModulation, sineFreq, rotationOffset, color, opacity, lineWidth) {
    this.ctx.beginPath();
    const numPoints = 360;
    
    for (let i = 0; i <= numPoints; i++) {
      const angle = (i / numPoints) * 2 * Math.PI;
      
      const modulatedAmplitude = this.sineAmplitude * rmsModulation * 2;
      const radiusModulation = modulatedAmplitude * Math.cos(sineFreq * angle + rotationOffset);
      const radius = this.baseRadius + radiusModulation;
      
      const x = this.centerX + radius * Math.cos(angle);
      const y = this.centerY + radius * Math.sin(angle);
      
      if (i === 0) {
        this.ctx.moveTo(x, y);
      } else {
        this.ctx.lineTo(x, y);
      }
    }
    
    this.ctx.closePath();
    this.ctx.strokeStyle = color;
    this.ctx.lineWidth = lineWidth;
    this.ctx.stroke();
    
    // Fill with opacity
    const colorRGB = this.hexToRgb(color);
    this.ctx.fillStyle = `rgba(${colorRGB.r}, ${colorRGB.g}, ${colorRGB.b}, ${opacity})`;
    this.ctx.fill();
  }
  
  /**
   * Draw the visualization
   */
  drawCircle(rmsModulation, rmsModulation2) {
    // Create trail effect with semi-transparent background
    const fadeAlpha = this.controls?.fade 
      ? parseFloat(this.controls.fade.value) 
      : this.settings.fade;
    const bgColor = this.controls?.bgColor?.value || this.settings.bgColor;
    const bgRGB = this.hexToRgb(bgColor);
    this.ctx.fillStyle = `rgba(${bgRGB.r}, ${bgRGB.g}, ${bgRGB.b}, ${fadeAlpha})`;
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    
    // Calculate rotation offsets
    let rotationOffset = 0;
    let rotationOffset2 = 0;
    
    if (this.rotationStartTime !== null) {
      const elapsed = Date.now() - this.rotationStartTime;
      rotationOffset = (elapsed / this.getRotationPeriod()) * 2 * Math.PI * this.sineFrequency;
      rotationOffset2 = (elapsed / this.getRotationPeriod2()) * 2 * Math.PI * this.sineFrequency2;
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
    this.drawModulatedCircle(rmsModulation2, this.sineFrequency2, rotationOffset2, color2, opacity2, 1.5);
    
    // Draw first circle on top
    this.drawModulatedCircle(rmsModulation, this.sineFrequency, rotationOffset, color1, opacity1, 2);
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
   * Start animation loop
   */
  startAnimation() {
    if (this.animationInterval) {
      clearInterval(this.animationInterval);
    }
    
    this.rotationStartTime = Date.now();
    
    this.animationInterval = setInterval(() => {
      this.currentRMS = this.calculateRMS();
      this.currentRMS2 = this.calculateRMS2();
      this.drawCircle(this.currentRMS, this.currentRMS2);
    }, 62.5);  // 16 times per second
  }
  
  /**
   * Stop animation loop
   */
  stopAnimation() {
    if (this.animationInterval) {
      clearInterval(this.animationInterval);
      this.animationInterval = null;
    }
    this.rotationStartTime = null;
    this.drawCircle(0, 0);
  }
  
  /**
   * Clean up resources
   */
  destroy() {
    this.stopAnimation();
    this.stopMicrophone();
    
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
