# AudioVisualiser

A reusable JavaScript audio visualization component that creates beautiful animated circles modulated by audio input. Works with both audio files and live microphone input.

![Audio Visualiser Demo](https://img.shields.io/badge/demo-live-brightgreen)

## Features

- 🎵 **Dual Audio Sources**: Works with audio files or live microphone input
- 🌊 **Dual Frequency Analysis**: Uses fast and slow analyzers for dynamic visual effects
- 🎨 **Fully Customizable**: Control colors, rotation speed, opacity, and fade effects
- 🔄 **Smooth Animations**: Creates mesmerizing rotating patterns with trail effects
- 📦 **Zero Dependencies**: Pure vanilla JavaScript using the Web Audio API
- 🎮 **Interactive Controls**: Easy-to-use API for connecting HTML controls

## Demo

See the included example files:
- `circle-player.html` - Audio file player with controls
- `circle.html` - Basic circle visualization

## Installation

### Direct Download
Simply download `audiovisualiser.js` and include it in your HTML:

```html
<script src="audiovisualiser.js"></script>
```

### CDN (when published to npm)
```html
<script src="https://cdn.jsdelivr.net/npm/audiovisualiser/audiovisualiser.js"></script>
```

### npm (when published)
```bash
npm install audiovisualiser
```

```javascript
import AudioVisualiser from 'audiovisualiser';
```

## Quick Start

### Basic Usage

```html
<!DOCTYPE html>
<html>
<head>
  <title>Audio Visualiser</title>
</head>
<body>
  <canvas id="visualiser"></canvas>
  <input type="file" id="audioFile" accept="audio/*">
  <audio id="audioPlayer" controls></audio>
  <button id="recordBtn">Start Recording</button>
  
  <script src="audiovisualiser.js"></script>
  <script>
    // Create visualiser
    const visualiser = new AudioVisualiser('visualiser', {
      width: 500,
      height: 500,
      baseRadius: 150,
      sineAmplitude: 25,
      sineFrequency: 10,
      sineFrequency2: 6
    });
    
    // Connect to HTML controls
    visualiser.connectControls({
      fileInput: 'audioFile',
      audioPlayer: 'audioPlayer',
      recordBtn: 'recordBtn'
    });
  </script>
</body>
</html>
```

## API Reference

### Constructor

```javascript
new AudioVisualiser(canvasId, options)
```

**Parameters:**
- `canvasId` (string): ID of the canvas element to render to
- `options` (object, optional): Configuration options

**Options:**
| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `width` | number | 500 | Canvas width in pixels |
| `height` | number | 500 | Canvas height in pixels |
| `baseRadius` | number | 150 | Base radius of the circles |
| `sineAmplitude` | number | 25 | Amplitude of the sine wave modulation |
| `sineFrequency` | number | 10 | Number of "petals" on the first circle |
| `sineFrequency2` | number | 6 | Number of "petals" on the second circle |

### Methods

#### `connectControls(controlIds)`

Connect the visualiser to HTML control elements for interactive manipulation.

```javascript
visualiser.connectControls({
  rotationSpeed: 'rotationSpeed',      // Input for first circle rotation speed
  rotationSpeed2: 'rotationSpeed2',    // Input for second circle rotation speed
  fade: 'fade',                        // Range input for trail fade
  fadeValue: 'fadeValue',              // Element to display fade value
  color1: 'color1',                    // Color picker for first circle
  color2: 'color2',                    // Color picker for second circle
  bgColor: 'bgColor',                  // Color picker for background
  opacity1: 'opacity1',                // Range input for first circle opacity
  opacity1Value: 'opacity1Value',      // Element to display opacity1 value
  opacity2: 'opacity2',                // Range input for second circle opacity
  opacity2Value: 'opacity2Value',      // Element to display opacity2 value
  fileInput: 'fileInput',              // File input for audio files
  audioPlayer: 'audioPlayer',          // Audio element for playback
  recordBtn: 'recordBtn'               // Button to toggle microphone
});
```

#### `startAnimation()`

Starts the visualization animation loop.

```javascript
visualiser.startAnimation();
```

#### `stopAnimation()`

Stops the animation and resets to static state.

```javascript
visualiser.stopAnimation();
```

#### `toggleRecording()`

Toggles microphone recording on/off.

```javascript
visualiser.toggleRecording();
```

#### `destroy()`

Cleans up all resources (audio context, streams, animation loops).

```javascript
visualiser.destroy();
```

### Default Settings

The visualiser comes with these default settings (can be overridden via `connectControls`):

```javascript
{
  rotationSpeed: 8,        // seconds per revolution
  rotationSpeed2: 12,      // seconds per revolution for second circle
  fade: 0.3,              // trail fade amount
  color1: '#2563eb',      // first circle color (blue)
  color2: '#a02ced',      // second circle color (purple)
  bgColor: '#f7f7f9',     // background color (light gray)
  opacity1: 0.1,          // first circle opacity
  opacity2: 0.05          // second circle opacity
}
```

## Advanced Example

Complete example with all controls:

```html
<!DOCTYPE html>
<html>
<head>
  <title>Advanced Audio Visualiser</title>
  <link rel="stylesheet" href="audiovisualiser.css">
</head>
<body>
  <div class="container">
    <canvas id="visualiser"></canvas>
    
    <div class="controls">
      <label>
        Rotation Speed 1:
        <input type="number" id="rotationSpeed" value="8" min="1" max="30" step="0.5">
      </label>
      
      <label>
        Rotation Speed 2:
        <input type="number" id="rotationSpeed2" value="12" min="1" max="30" step="0.5">
      </label>
      
      <label>
        Trail Fade:
        <input type="range" id="fade" min="0" max="1" step="0.1" value="0.3">
        <span id="fadeValue">0.3</span>
      </label>
      
      <label>
        Color 1:
        <input type="color" id="color1" value="#2563eb">
      </label>
      
      <label>
        Color 2:
        <input type="color" id="color2" value="#a02ced">
      </label>
      
      <label>
        Background:
        <input type="color" id="bgColor" value="#f7f7f9">
      </label>
      
      <label>
        Opacity 1:
        <input type="range" id="opacity1" min="0" max="0.5" step="0.01" value="0.1">
        <span id="opacity1Value">0.1</span>
      </label>
      
      <label>
        Opacity 2:
        <input type="range" id="opacity2" min="0" max="0.5" step="0.01" value="0.05">
        <span id="opacity2Value">0.05</span>
      </label>
    </div>
    
    <div class="audio-controls">
      <input type="file" id="fileInput" accept="audio/*">
      <audio id="audioPlayer" controls></audio>
      <button id="recordBtn">Start Recording</button>
    </div>
  </div>
  
  <script src="audiovisualiser.js"></script>
  <script>
    const visualiser = new AudioVisualiser('visualiser', {
      width: 500,
      height: 500,
      baseRadius: 150,
      sineAmplitude: 25,
      sineFrequency: 10,
      sineFrequency2: 6
    });
    
    visualiser.connectControls({
      rotationSpeed: 'rotationSpeed',
      rotationSpeed2: 'rotationSpeed2',
      fade: 'fade',
      fadeValue: 'fadeValue',
      color1: 'color1',
      color2: 'color2',
      bgColor: 'bgColor',
      opacity1: 'opacity1',
      opacity1Value: 'opacity1Value',
      opacity2: 'opacity2',
      opacity2Value: 'opacity2Value',
      fileInput: 'fileInput',
      audioPlayer: 'audioPlayer',
      recordBtn: 'recordBtn'
    });
  </script>
</body>
</html>
```

## How It Works

AudioVisualiser uses the **Web Audio API** to analyze audio in real-time:

1. **Dual Analyzers**: Uses two analyzers with different FFT sizes:
   - Fast analyzer (2048): ~1/32 second window for quick response
   - Slow analyzer (8192): ~1/8 second window for smooth, averaged response

2. **RMS Calculation**: Calculates Root Mean Square (RMS) values from time domain data to determine audio intensity

3. **Sine Wave Modulation**: Creates petal patterns using `radius = baseRadius + amplitude * cos(frequency * angle + rotation)`

4. **Trail Effect**: Uses semi-transparent overlays to create smooth motion trails

5. **Dual Circles**: Renders two independent circles with different frequencies and rotation speeds for visual depth

## Browser Support

- ✅ Chrome/Edge (recommended)
- ✅ Firefox
- ✅ Safari (may require user gesture to start audio context)
- ✅ Opera

Requires a modern browser with Web Audio API support.

## Microphone Permissions

When using microphone input, the browser will request permission. Users must grant permission for the visualizer to access the microphone.

## License

MIT License - feel free to use in your projects!

## Contributing

Contributions welcome! Please feel free to submit a Pull Request.

## Author

Ian McGuire

## Changelog

### v1.0.0
- Initial release
- Dual circle visualization
- Audio file and microphone support
- Customizable colors, rotation, and effects
