const noteToFrequency = (note) => 440 * Math.pow(2, note/12);

const customWave = () => {
  // const real = new Float32Array([0, 1, 0, -0.9, 0, 0.85, 0, -0.8, 0, 0.775, 0, -0.75, 0, 0.725, 0, -0.7, 0, 0.675, 0, -0.65, 0]);
  // const imag = new Float32Array([0, 0, -1, 0, 0.9, 0, -0.85, 0, 0.8, 0, -0.775, 0, 0.75, 0, -0.725, 0, 0.7, 0, -0.675, 0, 0.65]);
  const real = new Float32Array([0, 1, 0]);
  const imag = new Float32Array([0, 0, 1]);
  return {real, imag};
};

class AudioHandler {
  audioContext;
  oscillator;
  gainNode;
  analyser;
  buffer;

  constructor() {
    this.audioContext = new AudioContext();
    this.oscillator = this.audioContext.createOscillator();
    this.gainNode = this.audioContext.createGain();
    this.analyser = this.audioContext.createAnalyser();
    this.buffer = new Float32Array(1024);
  
    this.oscillator.frequency.value = noteToFrequency(0);
    const {real, imag} = customWave();
    const waveform = this.audioContext.createPeriodicWave(real, imag);
    this.oscillator.setPeriodicWave(waveform);
    // this.oscillator.type = 'square';
    this.gainNode.connect(this.analyser);
    this.gainNode.gain.value = 0.5;
    this.analyser.connect(this.audioContext.destination);
    this.oscillator.connect(this.gainNode);
    this.oscillator.start();
  }

  setNote(note) {
    this.oscillator.frequency.value = noteToFrequency(note ?? 0);
  }
  
  update() {
    this.analyser.getFloatTimeDomainData(this.buffer);
  }
}

class Loop {
  #callback;
  #interval;
  #previous = 0;
  #handle;

  constructor(callback, interval) {
    this.#callback = callback;
    this.#interval = interval;
  }

  #tick(timestamp) {
    if (timestamp - this.#previous >= this.#interval) {
      this.#previous = timestamp;
      this.#callback();
    }
    this.#update();
  }

  #update() {
    this.#handle = window.requestAnimationFrame(this.#tick.bind(this));
  }

  #clear() {
    window.cancelAnimationFrame(this.#handle);
    this.#handle = null;
  }

  resume() {
    if (this.#handle != null) {
      return;
    }
    this.#update();
  }

  suspend() {
    if (this.#handle == null) {
      return;
    }
    this.#clear();
  }
}

class ScopeProperties {
  centerLineColor = 'white';
  centerLineDash = [1, 1];
  mainColor = 'white';
  mainDash = [];
}

class Scope {
  #canvas;
  #ctx;
  #audio;
  #props;

  constructor(canvas, props = new ScopeProperties()) {
    this.#canvas = canvas;
    this.#ctx = canvas.getContext('2d');
    this.#props = props;
  }

  attachAudio(audio) {
    this.#audio = audio;
  }

  resizeToParent() {
    this.#canvas.width = this.#canvas.parentElement.clientWidth;
    this.#canvas.height = this.#canvas.parentElement.clientHeight;
  }

  clear() {
    const ctx = this.#ctx;
    const {width, height} = ctx.canvas;
    ctx.clearRect(0, 0, width, height);
    ctx.lineWidth = 2;
  }
  
  drawCenterLine() {
    const ctx = this.#ctx;
    const {width, height} = ctx.canvas;
    ctx.strokeStyle = this.#props.centerLineColor;
    ctx.setLineDash(this.#props.centerLineDash);
    ctx.beginPath();
    ctx.moveTo(0, height*0.5);
    ctx.lineTo(width, height*0.5);
    ctx.stroke();
  }

  drawWave() {
    if (!this.#audio) {
      return;
    }
    const ctx = this.#ctx;
    const {buffer} = this.#audio;
    const {width, height} = this.#canvas;
    const dx = width / buffer.length;
    ctx.strokeStyle = this.#props.mainColor;
    ctx.setLineDash(this.#props.mainDash);
    ctx.beginPath();
    ctx.moveTo(0, buffer[0]*height + height*0.5);
    for (let b = 1; b <= buffer.length; b++) {
      ctx.lineTo(b*dx, buffer[b]*height + height * 0.5);
    }
    ctx.stroke();
  }
}

class Application {
  #notes = [];
  #audio;
  #scope;
  #keyNotes = {
    // Bottom keys
    'z': -9, // B#/C
    's': -8, // C#/Db
    'x': -7, // D
    'd': -6, // D#/Eb
    'c': -5, // E/Fb
    'v': -4, // E#/F
    'g': -3, // F#/Gb
    'b': -2, // G
    'h': -1, // G#/Ab
    'n': 0, // A
    'j': 1, // A#/Bb
    'm': 2, // B/Cb
    ',': 3, // B#/C
    'l': 4, // C#/Db
    '.': 5, // D
    ';': 6, // D#/Eb
    '/': 7, // E/Fb
  
    // Top keys
    'q': 3, // B#/C
    '2': 4, // C#/Db
    'w': 5, // D
    '3': 6, // D#/Eb
    'e': 7, // E/Fb
    'r': 8, // E#/F
    '5': 9, // F#/Gb
    't': 10, // G
    '6': 11, // G#/Ab
    'y': 12, // A
    '7': 13, // A#/Bb
    'u': 14, // B/Cb
    'i': 15, // B#/C
    '9': 16, // C#/Db
    'o': 17, // D
    '0': 18, // D#/Eb
    'p': 19, // E/Fb
    '[': 20, // E#/F
    '=': 21, // F#/Gb
    ']': 22, // G
    '\\': 24, // A
  };

  #loop = new Loop((_timestamp) => {
    if (this.#audio == null) {
      return;
    }
    this.#audio.update();
    this.#scope.clear();
    this.#scope.drawCenterLine();
    this.#scope.drawWave();
  }, 1);

  constructor(canvas, scopeProps) {
    this.#scope = new Scope(canvas, scopeProps);
    this.#scope.resizeToParent();
    this.#scope.clear();
    this.#scope.drawCenterLine();
  }

  async onKeyDown(key) {
    if (!this.#audio) {
      this.#audio = new AudioHandler();
      this.#scope.attachAudio(this.#audio);
    }
    const note = this.#keyNotes[key];
    if (note != null) {
      if (this.#notes.indexOf(note) >= 0) {
        return;
      }
      this.#notes.push(note);
      this.#audio.oscillator.frequency.value = noteToFrequency(note);
      await this.#audio.audioContext.resume();
      this.#loop.resume();
    }
  }
  
  async onKeyUp(key) {
    const note = this.#keyNotes[key];
    const index = (note != null) ? this.#notes.indexOf(note) : -1;
    if (index >= 0) {
      this.#notes.splice(index, 1);
    }
    if (this.#notes.length === 0) {
      await this.#audio?.audioContext.suspend();
      this.#loop.suspend();
    } else {
      const newNote = this.#notes.at(-1);
      this.#audio?.setNote(newNote);
    }
  }
  
  async releaseAllKeys() {
    this.#notes = [];
    await this.#audio?.audioContext.suspend();
  }

  onResize() {
    this.#scope.resizeToParent();
    this.#scope.clear();
    this.#scope.drawCenterLine();
    this.#scope.drawWave();
  }

  async onBlur() {
    this.#loop.suspend();
    this.#scope.clear();
    this.#scope.drawCenterLine();
    this.#scope.drawWave();
    await this.releaseAllKeys();
  }
}

window.addEventListener('load', () => {
  const canvas = document.getElementById('scope');
  const bodyStyles = window.getComputedStyle(document.body);;
  const scopeProps = new ScopeProperties();
  scopeProps.centerLineColor = bodyStyles.getPropertyValue('--scope-center-line-color');
  scopeProps.mainColor = bodyStyles.getPropertyValue('--scope-main-color');
  scopeProps.centerLineDash = [5, 2];
  const app = new Application(canvas, scopeProps);

  window.addEventListener('keydown', async (event) => {
    event.preventDefault();
    await app.onKeyDown(event.key);
  });
  
  window.addEventListener('keyup', async (event) => {
    await app.onKeyUp(event.key);
  });
  
  window.addEventListener('blur', () => {
    app.onBlur();
  });
  
  window.addEventListener('resize', () => {
    app.onResize();
  });
});
