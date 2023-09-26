function noteToFrequency(note) {
  return 440 * Math.pow(2, note/12);
}

function customWave() {
  // const real = new Float32Array([0, 1, 0, -0.9, 0, 0.85, 0, -0.8, 0, 0.775, 0, -0.75, 0, 0.725, 0, -0.7, 0, 0.675, 0, -0.65, 0]);
  // const imag = new Float32Array([0, 0, -1, 0, 0.9, 0, -0.85, 0, 0.8, 0, -0.775, 0, 0.75, 0, -0.725, 0, 0.7, 0, -0.675, 0, 0.65]);
  const real = new Float32Array([0, 1, 0]);
  const imag = new Float32Array([0, 0, 1]);
  return {real, imag};
}

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

const keyNotes = {
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

class InputHandler {
  multimask = 0;
  notes = [];
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

let audio;
let ctx;
const input = new InputHandler();

function resizeCanvas() {
  const {canvas} = ctx;
  canvas.width = canvas.parentElement.clientWidth;
  canvas.height = canvas.parentElement.clientHeight;
}

function clearScope() {
  const {width, height} = ctx.canvas;
  ctx.clearRect(0, 0, width, height);
  ctx.lineWidth = 2;
}

function drawCenterLine() {
  const {width, height} = ctx.canvas;
  ctx.strokeStyle = '#f00';
  ctx.setLineDash([5, 5]);
  ctx.beginPath();
  ctx.moveTo(0, height*0.5);
  ctx.lineTo(width, height*0.5);
  ctx.stroke();
}

function drawWave() {
  const {buffer} = audio;
  const {width, height} = ctx.canvas;
  const dx = width / buffer.length;
  ctx.strokeStyle = '#000';
  ctx.setLineDash([]);
  ctx.beginPath();
  ctx.moveTo(0, buffer[0]*height + height*0.5);
  for (let b = 1; b <= buffer.length; b++) {
    ctx.lineTo(b*dx, buffer[b]*height + height * 0.5);
  }
  ctx.stroke();
}

const loop = new Loop((_timestamp) => {
  if (audio == null) {
    return;
  }
  audio.update();
  clearScope();
  drawCenterLine();
  drawWave();
}, 1);

async function pressKey(key) {
  if (!audio) {
    audio = new AudioHandler();
  }
  const note = keyNotes[key];
  if (note != null) {
    if (input.notes.indexOf(note) >= 0) {
      return;
    }
    input.notes.push(note);
    audio.oscillator.frequency.value = noteToFrequency(note);
    await audio.audioContext.resume();
    loop.resume();
  }
}

async function releaseKey(key) {
  const note = keyNotes[key];
  const index = (note != null) ? input.notes.indexOf(note) : -1;
  if (index >= 0) {
    input.notes.splice(index, 1);
  }
  if (input.notes.length === 0) {
    await audio?.audioContext.suspend();
    loop.suspend();
  } else {
    const newNote = input.notes.at(-1);
    audio?.setNote(newNote);
  }
}

async function releaseAllKeys() {
  input.notes = [];
  await audio?.audioContext.suspend();
}

window.addEventListener('load', () => {
  ctx = document.getElementById('cvs').getContext('2d');
  resizeCanvas();
  clearScope();
  drawCenterLine();
});

window.addEventListener('keydown', async (event) => {
  event.preventDefault();
  const {key} = event;
  await pressKey(key);
});

window.addEventListener('keyup', async (event) => {
  const {key} = event;
  await releaseKey(key);
});

window.addEventListener('blur', () => {
  releaseAllKeys();
});

window.addEventListener('resize', () => {
  resizeCanvas();
  clearScope();
  drawCenterLine();
  drawWave();
});
