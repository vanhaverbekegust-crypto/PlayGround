export class SoundEngine {
  constructor() {
    this.enabled = true;
    this.ctx = null;
    this.master = null;
    this.sfx = null;
    this.music = null;
    this.noiseBuffer = null;
    this.engine = null;
    this.musicTimer = null;
    this.musicStep = 0;
    this.nextNoteTime = 0;
    this.musicPlaying = false;
    this.melody = [0, 7, 12, 7, 5, 12, 15, 12, 3, 10, 15, 10, 7, 14, 19, 14];
  }

  init() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    this.ctx = new AudioContext();
    const compressor = this.ctx.createDynamicsCompressor();
    compressor.threshold.value = -18;
    compressor.knee.value = 18;
    compressor.ratio.value = 8;
    compressor.attack.value = 0.003;
    compressor.release.value = 0.24;
    compressor.connect(this.ctx.destination);

    this.master = this.ctx.createGain();
    this.master.gain.value = this.enabled ? 0.72 : 0;
    this.master.connect(compressor);

    this.sfx = this.ctx.createGain();
    this.sfx.gain.value = 0.9;
    this.sfx.connect(this.master);

    this.music = this.ctx.createGain();
    this.music.gain.value = 0.13;
    this.music.connect(this.master);

    const length = Math.floor(this.ctx.sampleRate * 0.7);
    this.noiseBuffer = this.ctx.createBuffer(1, length, this.ctx.sampleRate);
    const data = this.noiseBuffer.getChannelData(0);
    for (let i = 0; i < length; i++) {
      data[i] = Math.random() * 2 - 1;
    }
  }

  setEnabled(value) {
    this.enabled = value;
    this.init();
    if (this.master) {
      const time = this.ctx.currentTime;
      this.master.gain.cancelScheduledValues(time);
      this.master.gain.setTargetAtTime(value ? 0.72 : 0, time, 0.03);
    }
    if (value) this.resume();
  }

  resume() {
    if (!this.ctx) this.init();
    if (this.ctx?.state === 'suspended') this.ctx.resume();
  }

  tone(frequency, duration, options = {}) {
    if (!this.ctx || !this.enabled) return;
    const {
      type = 'sine',
      volume = 0.08,
      endFrequency = frequency,
      delay = 0,
      attack = 0.006,
      bus = this.sfx,
      detune = 0
    } = options;
    const now = this.ctx.currentTime + delay;
    const oscillator = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(Math.max(20, frequency), now);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(20, endFrequency), now + duration);
    oscillator.detune.value = detune;
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, volume), now + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    oscillator.connect(gain);
    gain.connect(bus || this.sfx);
    oscillator.start(now);
    oscillator.stop(now + duration + 0.03);
  }

  noise(duration = 0.2, options = {}) {
    if (!this.ctx || !this.enabled) return;
    const {
      volume = 0.08,
      frequency = 1200,
      type = 'lowpass',
      delay = 0,
      q = 0.8,
      bus = this.sfx
    } = options;
    const now = this.ctx.currentTime + delay;
    const source = this.ctx.createBufferSource();
    source.buffer = this.noiseBuffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.setValueAtTime(frequency, now);
    filter.Q.value = q;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(Math.max(0.0001, volume), now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(bus || this.sfx);
    source.start(now);
    source.stop(now + duration + 0.02);
  }

  shoot(distance = 0, powered = false) {
    const falloff = Math.max(0.12, 1 - distance / 65);
    this.tone(powered ? 760 : 580, 0.09, {
      type: powered ? 'sawtooth' : 'square',
      volume: 0.035 * falloff,
      endFrequency: powered ? 260 : 170
    });
    this.noise(0.045, { volume: 0.025 * falloff, frequency: 1800, type: 'highpass' });
  }

  hit() {
    this.tone(220, 0.05, { type: 'square', volume: 0.045, endFrequency: 120 });
    this.noise(0.05, { volume: 0.03, frequency: 2200, type: 'bandpass', q: 2 });
  }

  smash() {
    this.noise(0.55, { volume: 0.14, frequency: 900, type: 'lowpass', q: 0.9 });
    this.tone(90, 0.4, { type: 'sawtooth', volume: 0.1, endFrequency: 38 });
    this.tone(160, 0.22, { type: 'square', volume: 0.05, endFrequency: 45, delay: 0.03 });
    for (let i = 0; i < 3; i++) {
      this.noise(0.18, { volume: 0.04, frequency: 400 + i * 600, delay: 0.05 + i * 0.04, type: 'bandpass', q: 1.5 });
    }
  }

  pickup(type = 'heal') {
    const notes = type === 'shield' ? [440, 660, 880] : [523, 659, 784, 1046];
    notes.forEach((note, index) => {
      this.tone(note, 0.14, { type: 'triangle', volume: 0.05, delay: index * 0.055 });
    });
  }

  boost() {
    this.noise(0.36, { volume: 0.08, frequency: 320, type: 'bandpass', q: 1.2 });
    this.tone(180, 0.3, { type: 'sawtooth', volume: 0.04, endFrequency: 520 });
  }

  ui() {
    this.tone(360, 0.06, { type: 'square', volume: 0.035, endFrequency: 520 });
  }

  countdown(final = false) {
    this.tone(final ? 880 : 440, final ? 0.26 : 0.1, { type: 'square', volume: 0.055 });
  }

  startEngine() {
    this.init();
    if (!this.ctx || this.engine) return;
    const now = this.ctx.currentTime;
    const low = this.ctx.createOscillator();
    const high = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();
    low.type = 'sawtooth';
    high.type = 'triangle';
    low.frequency.value = 55;
    high.frequency.value = 110;
    high.detune.value = 7;
    filter.type = 'lowpass';
    filter.frequency.value = 360;
    filter.Q.value = 2.2;
    gain.gain.value = 0.0001;
    low.connect(filter);
    high.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfx);
    low.start(now);
    high.start(now);
    this.engine = { low, high, filter, gain };
  }

  updateEngine(speed = 0, boosting = false, active = true) {
    if (!this.engine || !this.ctx) return;
    const now = this.ctx.currentTime;
    const targetGain = !active || !this.enabled ? 0.0001 : 0.016 + Math.min(speed, 30) * 0.0012;
    this.engine.gain.gain.setTargetAtTime(targetGain, now, 0.08);
    const base = 50 + Math.min(speed, 30) * 5.2 + (boosting ? 18 : 0);
    this.engine.low.frequency.setTargetAtTime(base, now, 0.08);
    this.engine.high.frequency.setTargetAtTime(base * 2.02, now, 0.08);
    this.engine.filter.frequency.setTargetAtTime(280 + Math.min(speed, 30) * 32 + (boosting ? 500 : 0), now, 0.1);
  }

  stopEngine() {
    if (!this.engine || !this.ctx) return;
    const { low, high, gain } = this.engine;
    const now = this.ctx.currentTime;
    gain.gain.cancelScheduledValues(now);
    gain.gain.setTargetAtTime(0.0001, now, 0.04);
    low.stop(now + 0.25);
    high.stop(now + 0.25);
    this.engine = null;
  }

  startMusic() {
    this.init();
    if (!this.ctx || this.musicPlaying) return;
    this.musicPlaying = true;
    this.musicStep = 0;
    this.nextNoteTime = this.ctx.currentTime + 0.08;
    this.musicTimer = window.setInterval(() => this.scheduleMusic(), 60);
  }

  scheduleMusic() {
    if (!this.ctx || !this.musicPlaying) return;
    const stepDuration = 0.137;
    while (this.nextNoteTime < this.ctx.currentTime + 0.22) {
      const step = this.musicStep % 16;
      const bar = Math.floor(this.musicStep / 16) % 4;
      const root = [0, 0, 5, 3][bar];
      if (step % 2 === 0) {
        const note = [root, root + 7, root + 12, root + 7][(step / 2) % 4];
        this.musicNote(110 * Math.pow(2, note / 12), stepDuration * 1.5, 0.11, 'triangle', 0.045);
      }
      const melodyIndex = (step + bar * 3) % this.melody.length;
      if (step % 2 === 1 || step === 0) {
        const note = root + this.melody[melodyIndex];
        this.musicNote(220 * Math.pow(2, note / 12), stepDuration * 0.85, 0.08, 'square', 0.017);
      }
      if (step === 0 || step === 6 || step === 10) {
        this.musicKick(this.nextNoteTime, step === 0 ? 0.09 : 0.05);
      }
      if (step % 2 === 0) {
        this.musicHat(this.nextNoteTime + stepDuration * 0.5, step % 4 === 0 ? 0.02 : 0.01);
      }
      this.musicStep++;
      this.nextNoteTime += stepDuration;
    }
  }

  musicNote(frequency, duration, attack, type, volume) {
    const now = this.nextNoteTime;
    const oscillator = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, now);
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(type === 'square' ? 1700 : 900, now);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(volume, now + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    oscillator.connect(filter);
    filter.connect(gain);
    gain.connect(this.music);
    oscillator.start(now);
    oscillator.stop(now + duration + 0.02);
  }

  musicKick(time, volume) {
    const oscillator = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(120, time);
    oscillator.frequency.exponentialRampToValueAtTime(42, time + 0.18);
    gain.gain.setValueAtTime(volume, time);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.19);
    oscillator.connect(gain);
    gain.connect(this.music);
    oscillator.start(time);
    oscillator.stop(time + 0.2);
  }

  musicHat(time, volume) {
    const source = this.ctx.createBufferSource();
    source.buffer = this.noiseBuffer;
    const filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();
    filter.type = 'highpass';
    filter.frequency.value = 7200;
    gain.gain.setValueAtTime(volume, time);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.035);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.music);
    source.start(time);
    source.stop(time + 0.05);
  }

  stopMusic() {
    this.musicPlaying = false;
    if (this.musicTimer) window.clearInterval(this.musicTimer);
    this.musicTimer = null;
  }
}
