export class AudioEngine {
  constructor() {
    this.ctx = null
    this.master = null
    this.engine = null
    this.muted = false
    this.started = false
    this.noiseBuffer = null
  }

  ensure() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume()
      return this.ctx
    }
    const Ctx = window.AudioContext || window.webkitAudioContext
    if (!Ctx) return null
    this.ctx = new Ctx()
    this.master = this.ctx.createGain()
    this.master.gain.value = this.muted ? 0 : 0.55
    this.master.connect(this.ctx.destination)
    this.noiseBuffer = this.createNoise()
    return this.ctx
  }

  createNoise() {
    const length = this.ctx.sampleRate * 1.2
    const buffer = this.ctx.createBuffer(1, length, this.ctx.sampleRate)
    const data = buffer.getChannelData(0)
    for (let i = 0; i < length; i += 1) data[i] = Math.random() * 2 - 1
    return buffer
  }

  setMuted(muted) {
    this.muted = muted
    if (this.master) this.master.gain.setTargetAtTime(muted ? 0 : 0.55, this.ctx.currentTime, 0.03)
  }

  startEngine() {
    const ctx = this.ensure()
    if (!ctx || this.engine) return
    const oscA = ctx.createOscillator()
    const oscB = ctx.createOscillator()
    const filter = ctx.createBiquadFilter()
    const gain = ctx.createGain()
    oscA.type = 'sawtooth'
    oscB.type = 'square'
    oscA.frequency.value = 55
    oscB.frequency.value = 27
    filter.type = 'lowpass'
    filter.frequency.value = 320
    filter.Q.value = 3
    gain.gain.value = 0
    oscA.connect(filter)
    oscB.connect(filter)
    filter.connect(gain)
    gain.connect(this.master)
    oscA.start()
    oscB.start()
    this.engine = { oscA, oscB, filter, gain }
    this.started = true
  }

  stopEngine() {
    if (!this.engine || !this.ctx) return
    const { oscA, oscB, gain } = this.engine
    const t = this.ctx.currentTime
    gain.gain.setTargetAtTime(0, t, 0.08)
    oscA.stop(t + 0.4)
    oscB.stop(t + 0.4)
    this.engine = null
    this.started = false
  }

  updateEngine(speed, boosting, active) {
    if (!this.engine || !this.ctx) return
    const t = this.ctx.currentTime
    const normalized = Math.min(1, speed / 40)
    const pitch = 42 + normalized * 96 + (boosting ? 26 : 0)
    this.engine.oscA.frequency.setTargetAtTime(pitch, t, 0.07)
    this.engine.oscB.frequency.setTargetAtTime(pitch * 0.5, t, 0.07)
    this.engine.filter.frequency.setTargetAtTime(220 + normalized * 900 + (boosting ? 420 : 0), t, 0.08)
    this.engine.gain.gain.setTargetAtTime(active ? 0.045 + normalized * 0.05 : 0, t, 0.12)
  }

  blip(freq = 660, duration = 0.09, type = 'square', gainValue = 0.12, slide = 0) {
    const ctx = this.ensure()
    if (!ctx) return
    const t = ctx.currentTime
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = type
    osc.frequency.setValueAtTime(freq, t)
    if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), t + duration)
    gain.gain.setValueAtTime(gainValue, t)
    gain.gain.exponentialRampToValueAtTime(0.0001, t + duration)
    osc.connect(gain)
    gain.connect(this.master)
    osc.start(t)
    osc.stop(t + duration + 0.02)
  }

  shoot() {
    this.blip(880, 0.11, 'square', 0.07, -520)
    this.noise(0.06, 0.05, 1200)
  }

  hit() {
    this.blip(220, 0.08, 'triangle', 0.1, -120)
  }

  hurt() {
    this.noise(0.18, 0.16, 600)
    this.blip(140, 0.16, 'sawtooth', 0.08, -80)
  }

  explosion() {
    this.noise(0.7, 0.34, 420)
    this.blip(110, 0.5, 'sine', 0.18, -80)
  }

  pickup() {
    this.blip(620, 0.1, 'sine', 0.12, 260)
    setTimeout(() => this.blip(940, 0.14, 'sine', 0.1, 180), 70)
  }

  countdown(final = false) {
    this.blip(final ? 1040 : 620, final ? 0.4 : 0.14, 'square', 0.1)
  }

  uiClick() {
    this.blip(520, 0.07, 'square', 0.06, 180)
  }

  noise(duration, gainValue, cutoff) {
    const ctx = this.ensure()
    if (!ctx) return
    const t = ctx.currentTime
    const src = ctx.createBufferSource()
    src.buffer = this.noiseBuffer
    const filter = ctx.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.setValueAtTime(cutoff, t)
    filter.frequency.exponentialRampToValueAtTime(Math.max(60, cutoff * 0.25), t + duration)
    const gain = ctx.createGain()
    gain.gain.setValueAtTime(gainValue, t)
    gain.gain.exponentialRampToValueAtTime(0.0001, t + duration)
    src.connect(filter)
    filter.connect(gain)
    gain.connect(this.master)
    src.start(t)
    src.stop(t + duration + 0.02)
  }
}
