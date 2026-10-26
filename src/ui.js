import { KART_COLORS } from './config.js'
import { clamp, formatTime, ranking, placeSuffix } from './logic.js'

const $ = (selector) => document.querySelector(selector)

export class UI {
  constructor(audio) {
    this.audio = audio
    this.selectedColor = 0
    this.feedTimers = []
    this.announceTimer = null
    this.countdownTimer = null
    this.minimap = $('#minimap')
    this.mctx = this.minimap.getContext('2d')

    this.el = {
      hud: $('#hud'),
      start: $('#start-screen'),
      end: $('#end-screen'),
      pause: $('#pause-screen'),
      healthFill: $('#health-fill'),
      healthText: $('#health-text'),
      boostFill: $('#boost-fill'),
      boostText: $('#boost-text'),
      timer: $('#timer'),
      timerLabel: $('#timer-label'),
      scoreboard: $('#scoreboard'),
      alive: $('#alive-count'),
      speed: $('#speed-value'),
      weapon: $('#weapon-state'),
      crosshair: $('#crosshair'),
      hitmarker: $('#hitmarker'),
      countdown: $('#countdown'),
      announce: $('#announce'),
      damage: $('#damage-flash'),
      killFeed: $('#kill-feed'),
      pickName: $('#pick-name'),
      colorPicker: $('#color-picker'),
      lobby: $('#lobby-text'),
      soundToggle: $('#sound-toggle'),
      pauseButton: $('#pause-button'),
      endTitle: $('#end-title'),
      endKicker: $('#end-kicker'),
      endSub: $('#end-sub'),
      endPlace: $('#end-place'),
      endKills: $('#end-kills'),
      endDeaths: $('#end-deaths'),
      endBoard: $('#end-board'),
      touch: $('#touch-controls')
    }

    this.buildColorPicker()
  }

  buildColorPicker() {
    this.el.colorPicker.innerHTML = ''
    KART_COLORS.forEach((color, index) => {
      const button = document.createElement('button')
      button.className = `swatch${index === this.selectedColor ? ' selected' : ''}`
      button.style.background = `linear-gradient(160deg, ${color.css}, ${shade(color.css, -28)})`
      button.style.color = color.css
      button.title = color.name
      button.setAttribute('aria-label', `Choose ${color.name} kart`)
      button.addEventListener('click', () => {
        this.selectedColor = index
        for (const swatch of this.el.colorPicker.children) swatch.classList.remove('selected')
        button.classList.add('selected')
        this.el.pickName.textContent = color.name
        this.audio.uiClick()
        this.onColorSelect?.(color)
      })
      button.addEventListener('mouseenter', () => {
        this.el.pickName.textContent = color.name
      })
      this.el.colorPicker.appendChild(button)
    })
    this.el.pickName.textContent = KART_COLORS[this.selectedColor].name
  }

  get selected() {
    return KART_COLORS[this.selectedColor]
  }

  bind(handlers) {
    $('#play-button').addEventListener('click', () => {
      this.audio.ensure()
      this.audio.uiClick()
      handlers.onStart?.()
    })
    $('#again-button').addEventListener('click', () => {
      this.audio.uiClick()
      handlers.onRestart?.()
    })
    $('#resume-button').addEventListener('click', () => {
      this.audio.uiClick()
      handlers.onResume?.()
    })
    $('#quit-button').addEventListener('click', () => {
      this.audio.uiClick()
      handlers.onQuit?.()
    })
    this.el.pauseButton.addEventListener('click', () => handlers.onPause?.())
    this.el.soundToggle.addEventListener('click', () => {
      this.audio.ensure()
      const muted = !this.audio.muted
      this.audio.setMuted(muted)
      this.el.soundToggle.textContent = muted ? 'SOUND OFF' : 'SOUND ON'
    })
  }

  showStart() {
    this.el.start.classList.remove('hidden')
    this.el.end.classList.add('hidden')
    this.el.pause.classList.add('hidden')
    this.el.hud.classList.add('hidden')
    this.el.pauseButton.classList.add('hidden')
    this.el.touch.classList.add('hidden')
    this.el.crosshair.classList.remove('active')
    document.body.classList.remove('playing')
  }

  showGame() {
    this.el.start.classList.add('hidden')
    this.el.end.classList.add('hidden')
    this.el.pause.classList.add('hidden')
    this.el.hud.classList.remove('hidden')
    this.el.pauseButton.classList.remove('hidden')
    this.el.crosshair.classList.add('active')
    document.body.classList.add('playing')
    if (this.isTouch) this.el.touch.classList.remove('hidden')
  }

  get isTouch() {
    return window.matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window
  }

  showEnd(result) {
    this.el.end.classList.remove('hidden')
    this.el.pauseButton.classList.add('hidden')
    this.el.crosshair.classList.remove('active')
    this.el.touch.classList.add('hidden')
    document.body.classList.remove('playing')
    this.el.endTitle.textContent = result.victory ? 'VICTORY' : 'DEFEAT'
    this.el.endTitle.classList.toggle('defeat', !result.victory)
    this.el.endKicker.textContent = result.victory ? 'ARENA CHAMPION' : 'MATCH COMPLETE'
    this.el.endSub.textContent = result.victory
      ? 'You smashed the competition.'
      : result.place <= 3
        ? 'So close. One more run?'
        : 'The arena demands a rematch.'
    this.el.endPlace.textContent = `${result.place}${placeSuffix(result.place)}`
    this.el.endKills.textContent = String(result.stats.kills)
    this.el.endDeaths.textContent = String(result.stats.deaths)
    this.el.endBoard.innerHTML = ''
    result.board.forEach((kart, index) => this.el.endBoard.appendChild(this.makeScoreRow(kart, index, result.playerKart)))
  }

  showPause(show) {
    this.el.pause.classList.toggle('hidden', !show)
    if (show) this.el.crosshair.classList.remove('active')
    else if (!this.el.hud.classList.contains('hidden')) this.el.crosshair.classList.add('active')
  }

  setHud(player, timeLeft) {
    const healthRatio = clamp(player.health / 100, 0, 1)
    this.el.healthFill.style.width = `${healthRatio * 100}%`
    this.el.healthFill.classList.toggle('low', healthRatio < 0.35)
    this.el.healthText.textContent = String(Math.ceil(player.health))
    this.el.boostFill.style.width = `${clamp(player.boost, 0, 100)}%`
    this.el.boostText.textContent = String(Math.round(player.boost))
    this.el.timer.textContent = formatTime(timeLeft)
    this.el.timer.classList.toggle('urgent', timeLeft <= 20)
    this.el.speed.textContent = String(Math.round(Math.abs(player.speed) * 3.6))
    if (!player.alive) {
      this.el.weapon.textContent = `RESPAWN IN ${Math.max(1, Math.ceil(player.respawnTimer))}S`
      this.el.weapon.classList.remove('reloading')
      this.el.weapon.classList.add('overheat')
      this.el.speed.textContent = '0'
    } else if (player.overdrive > 0) {
      this.el.weapon.textContent = `TRIPLE SHOT ${player.overdrive.toFixed(1)}S`
      this.el.weapon.classList.remove('reloading')
      this.el.weapon.classList.add('overheat')
    } else if (player.boostActive) {
      this.el.weapon.textContent = 'BOOSTING'
      this.el.weapon.classList.remove('reloading', 'overheat')
    } else {
      this.el.weapon.textContent = 'CANNON READY'
      this.el.weapon.classList.remove('reloading', 'overheat')
    }
  }

  setCrosshair(x, y, visible = true) {
    if (!visible) {
      this.el.crosshair.classList.remove('active')
      return
    }
    this.el.crosshair.classList.add('active')
    this.el.crosshair.style.left = `${x}px`
    this.el.crosshair.style.top = `${y}px`
  }

  setScoreboard(karts, player) {
    const ranked = ranking(karts)
    this.el.scoreboard.innerHTML = ''
    ranked.forEach((kart, index) => this.el.scoreboard.appendChild(this.makeScoreRow(kart, index, player)))
    const alive = karts.filter((kart) => kart.alive).length
    this.el.alive.textContent = `${alive} ALIVE`
    this.el.timerLabel.textContent = 'FREE FOR ALL'
    return ranked
  }

  makeScoreRow(kart, index, player) {
    const row = document.createElement('li')
    row.className = `score-row${kart === player ? ' player' : ''}${!kart.alive ? ' dead' : ''}`
    row.innerHTML = `
      <span class="score-rank">${index + 1}</span>
      <span class="score-swatch" style="background:${kart.css};color:${kart.css}"></span>
      <span class="score-name">${kart.name}</span>
      <span class="score-kills">${kart.kills}</span>
    `
    return row
  }

  feed(attacker, victim, player) {
    const item = document.createElement('div')
    item.className = 'feed-item'
    if (attacker) {
      const attackerClass = attacker === player ? 'you' : ''
      const victimClass = victim === player ? 'die' : ''
      item.innerHTML = `<span class="${attackerClass}">${attacker.name}</span><span class="sep">SMASHED</span><span class="${victimClass}">${victim.name}</span>`
    } else {
      item.innerHTML = `<span class="${victim === player ? 'die' : ''}">${victim.name}</span><span class="sep">WRECKED</span>`
    }
    this.el.killFeed.appendChild(item)
    while (this.el.killFeed.children.length > 4) this.el.killFeed.firstChild.remove()
    const timer = setTimeout(() => {
      item.classList.add('fade')
      setTimeout(() => item.remove(), 400)
    }, 3800)
    this.feedTimers.push(timer)
  }

  hitmarker(kill = false) {
    this.el.hitmarker.classList.remove('show', 'kill')
    void this.el.hitmarker.offsetWidth
    this.el.hitmarker.classList.add('show')
    if (kill) this.el.hitmarker.classList.add('kill')
  }

  damageFlash() {
    this.el.damage.classList.remove('hit')
    void this.el.damage.offsetWidth
    this.el.damage.classList.add('hit')
  }

  announce(text, danger = false) {
    this.el.announce.textContent = text
    this.el.announce.classList.remove('hidden', 'danger')
    if (danger) this.el.announce.classList.add('danger')
    this.el.announce.style.animation = 'none'
    void this.el.announce.offsetWidth
    this.el.announce.style.animation = ''
    clearTimeout(this.announceTimer)
    this.announceTimer = setTimeout(() => this.el.announce.classList.add('hidden'), 1500)
  }

  countdown(text, done = false) {
    this.el.countdown.textContent = text
    this.el.countdown.classList.remove('hidden', 'go')
    if (done) this.el.countdown.classList.add('go')
    this.el.countdown.style.animation = 'none'
    void this.el.countdown.offsetWidth
    this.el.countdown.style.animation = ''
    clearTimeout(this.countdownTimer)
    if (done) {
      this.countdownTimer = setTimeout(() => this.el.countdown.classList.add('hidden'), 800)
    }
  }

  updateMinimap(karts, arena, player) {
    const ctx = this.mctx
    const size = this.minimap.width
    const center = size / 2
    const scale = (center - 12) / (46 + 2)
    ctx.clearRect(0, 0, size, size)
    ctx.save()
    ctx.beginPath()
    ctx.arc(center, center, center - 4, 0, Math.PI * 2)
    ctx.clip()

    const gradient = ctx.createRadialGradient(center, center, 10, center, center, center)
    gradient.addColorStop(0, 'rgba(25,21,60,0.92)')
    gradient.addColorStop(1, 'rgba(8,6,24,0.95)')
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, size, size)

    ctx.strokeStyle = 'rgba(56,232,255,0.18)'
    ctx.lineWidth = 1
    for (let i = 1; i < 4; i += 1) {
      const r = (center - 8) * (i / 4)
      ctx.beginPath()
      ctx.arc(center, center, r, 0, Math.PI * 2)
      ctx.stroke()
    }

    ctx.strokeStyle = 'rgba(56,232,255,0.6)'
    ctx.lineWidth = 2
    ctx.strokeRect(center - 46 * scale, center - 46 * scale, 92 * scale, 92 * scale)

    for (const collider of arena.colliders) {
      ctx.fillStyle = collider.kind === 'reactor' ? 'rgba(255,138,31,0.5)' : 'rgba(160,150,220,0.32)'
      if (collider.type === 'circle') {
        ctx.beginPath()
        ctx.arc(center + collider.x * scale, center + collider.z * scale, Math.max(1.5, collider.r * scale), 0, Math.PI * 2)
        ctx.fill()
      } else {
        ctx.fillRect(
          center + collider.minX * scale,
          center + collider.minZ * scale,
          (collider.maxX - collider.minX) * scale,
          (collider.maxZ - collider.minZ) * scale
        )
      }
    }

    for (const spot of arena.healthSpots) {
      ctx.fillStyle = 'rgba(85,232,121,0.85)'
      ctx.beginPath()
      ctx.arc(center + spot.x * scale, center + spot.z * scale, 2.2, 0, Math.PI * 2)
      ctx.fill()
    }

    for (const pad of arena.boostPads) {
      ctx.fillStyle = 'rgba(255,210,63,0.55)'
      ctx.beginPath()
      ctx.arc(center + pad.x * scale, center + pad.z * scale, 2, 0, Math.PI * 2)
      ctx.fill()
    }

    for (const kart of karts) {
      if (!kart.alive) continue
      const x = center + kart.position.x * scale
      const y = center + kart.position.z * scale
      if (kart === player) {
        ctx.save()
        ctx.translate(x, y)
        ctx.rotate(-kart.heading + Math.PI)
        ctx.fillStyle = '#ffffff'
        ctx.beginPath()
        ctx.moveTo(0, -7)
        ctx.lineTo(5, 5)
        ctx.lineTo(0, 2.5)
        ctx.lineTo(-5, 5)
        ctx.closePath()
        ctx.fill()
        ctx.restore()
        ctx.strokeStyle = 'rgba(255,255,255,0.35)'
        ctx.beginPath()
        ctx.arc(x, y, 9, 0, Math.PI * 2)
        ctx.stroke()
      } else {
        ctx.fillStyle = kart.css
        ctx.beginPath()
        ctx.arc(x, y, 4, 0, Math.PI * 2)
        ctx.fill()
        ctx.strokeStyle = 'rgba(0,0,0,0.5)'
        ctx.lineWidth = 1
        ctx.stroke()
      }
    }

    ctx.restore()
    ctx.strokeStyle = 'rgba(255,210,63,0.55)'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.arc(center, center, center - 5, 0, Math.PI * 2)
    ctx.stroke()
  }

  clearFeed() {
    this.el.killFeed.innerHTML = ''
    for (const timer of this.feedTimers) clearTimeout(timer)
    this.feedTimers = []
  }
}

function shade(hex, amount) {
  const value = hex.replace('#', '')
  const num = parseInt(value, 16)
  const r = clamp((num >> 16) + amount, 0, 255)
  const g = clamp(((num >> 8) & 0xff) + amount, 0, 255)
  const b = clamp((num & 0xff) + amount, 0, 255)
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`
}

