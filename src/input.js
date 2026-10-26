import { clamp } from './logic.js'

export class Input {
  constructor(host, canvas) {
    this.host = host.closest?.('#app') ?? host
    this.canvas = canvas
    this.keys = new Set()
    this.mouse = { x: 0, y: 0, down: false, seen: false }
    this.touch = { steerX: 0, steerY: 0, fire: false, boost: false, active: false }
    this.enabled = false
    this.isTouch = window.matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window

    this.onKeyDown = (event) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(event.code)) event.preventDefault()
      this.keys.add(event.code)
    }
    this.onKeyUp = (event) => this.keys.delete(event.code)
    this.onBlur = () => this.keys.clear()
    this.onMouseMove = (event) => {
      this.mouse.x = event.clientX
      this.mouse.y = event.clientY
      this.mouse.seen = true
    }
    this.onMouseDown = (event) => {
      if (event.button === 0) this.mouse.down = true
    }
    this.onMouseUp = () => { this.mouse.down = false }
    this.onContextMenu = (event) => event.preventDefault()

    window.addEventListener('keydown', this.onKeyDown, { passive: false })
    window.addEventListener('keyup', this.onKeyUp)
    window.addEventListener('blur', this.onBlur)
    window.addEventListener('mousemove', this.onMouseMove)
    window.addEventListener('mousedown', this.onMouseDown)
    window.addEventListener('mouseup', this.onMouseUp)
    window.addEventListener('contextmenu', this.onContextMenu)

    this.setupJoystick()
    this.setupButtons()
  }

  setupJoystick() {
    const stick = this.host.querySelector('#joystick')
    const knob = this.host.querySelector('#joystick-knob')
    if (!stick || !knob) return
    let pointerId = null

    const move = (event) => {
      if (event.pointerId !== pointerId) return
      const rect = stick.getBoundingClientRect()
      const cx = rect.left + rect.width / 2
      const cy = rect.top + rect.height / 2
      let dx = event.clientX - cx
      let dy = event.clientY - cy
      const limit = rect.width * 0.36
      const length = Math.hypot(dx, dy)
      if (length > limit) {
        dx = (dx / length) * limit
        dy = (dy / length) * limit
      }
      knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`
      this.touch.steerX = clamp(dx / limit, -1, 1)
      this.touch.steerY = clamp(-dy / limit, -1, 1)
    }

    const end = (event) => {
      if (event.pointerId !== pointerId) return
      pointerId = null
      knob.style.transform = 'translate(-50%, -50%)'
      this.touch.steerX = 0
      this.touch.steerY = 0
    }

    stick.addEventListener('pointerdown', (event) => {
      pointerId = event.pointerId
      try { stick.setPointerCapture(pointerId) } catch { /* synthetic pointers cannot be captured */ }
      this.touch.active = true
      move(event)
    })
    stick.addEventListener('pointermove', move)
    stick.addEventListener('pointerup', end)
    stick.addEventListener('pointercancel', end)
  }

  setupButtons() {
    const bind = (selector, key) => {
      const el = this.host.querySelector(selector)
      if (!el) return
      const on = (event) => {
        event.preventDefault()
        this.touch.active = true
        this.touch[key] = true
      }
      const off = () => { this.touch[key] = false }
      el.addEventListener('pointerdown', on)
      el.addEventListener('pointerup', off)
      el.addEventListener('pointercancel', off)
      el.addEventListener('pointerleave', off)
    }
    bind('#touch-fire', 'fire')
    bind('#touch-boost', 'boost')
  }

  get throttle() {
    let value = 0
    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) value += 1
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) value -= 1
    if (this.touch.active) value += this.touch.steerY
    return clamp(value, -1, 1)
  }

  get steer() {
    let value = 0
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) value += 1
    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) value -= 1
    if (this.touch.active) value += this.touch.steerX
    return clamp(value, -1, 1)
  }

  get firing() {
    return this.mouse.down || this.keys.has('Space') || this.touch.fire
  }

  get boosting() {
    return this.keys.has('ShiftLeft') || this.keys.has('ShiftRight') || this.touch.boost
  }

  clearTransient() {
    this.mouse.down = false
    this.touch.fire = false
    this.touch.boost = false
    this.touch.steerX = 0
    this.touch.steerY = 0
  }

  dispose() {
    window.removeEventListener('keydown', this.onKeyDown)
    window.removeEventListener('keyup', this.onKeyUp)
    window.removeEventListener('blur', this.onBlur)
    window.removeEventListener('mousemove', this.onMouseMove)
    window.removeEventListener('mousedown', this.onMouseDown)
    window.removeEventListener('mouseup', this.onMouseUp)
    window.removeEventListener('contextmenu', this.onContextMenu)
  }
}
