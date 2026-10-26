import * as THREE from 'three'
import { ARENA, COMBAT, MATCH, KART_COLORS, BOT_NAMES, PHYSICS } from './config.js'
import { createArena } from './arena.js'
import { Effects } from './effects.js'
import { ProjectileSystem } from './projectiles.js'
import { PickupSystem } from './pickups.js'
import { Kart, runBotAI } from './kart.js'
import { Input } from './input.js'
import { AudioEngine } from './audio.js'
import { UI } from './ui.js'
import { clamp, damp, ranking, steerToward, angleDelta } from './logic.js'

const aimPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -1)
const raycaster = new THREE.Raycaster()
const ndc = new THREE.Vector2()
const tempA = new THREE.Vector3()
const tempB = new THREE.Vector3()
const tempC = new THREE.Vector3()

export class Game {
  constructor(host) {
    this.host = host
    this.scene = new THREE.Scene()
    this.camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 600)
    this.camera.position.set(0, 30, 62)

    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
    this.renderer.setSize(window.innerWidth, window.innerHeight)
    this.renderer.outputColorSpace = THREE.SRGBColorSpace
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 1.12
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type = THREE.PCFShadowMap
    host.appendChild(this.renderer.domElement)

    this.clock = new THREE.Clock()
    this.time = 0
    this.state = 'menu'
    this.previousState = 'playing'
    this.timeLeft = MATCH.duration
    this.matchTime = 0
    this.countdownLeft = 0
    this.lastCountdown = null
    this.endTimer = 0
    this.endShown = false
    this.firstBlood = false
    this.shake = 0
    this.hitShake = 0
    this.menuAngle = 0.8
    this.cameraSnap = true
    this.camPos = new THREE.Vector3(0, 30, 62)
    this.camLook = new THREE.Vector3(0, 1, 0)
    this.cameraTarget = new THREE.Vector3(0, 1, 0)
    this.aimPoint = new THREE.Vector3()
    this.hudTimer = 0
    this.scoreTimer = 0
    this.minimapTimer = 0
    this.respawnNotice = null
    this.fps = 60
    this.menuFreezeUntil = 0

    this.audio = new AudioEngine()
    this.ui = new UI(this.audio)
    this.ui.onColorSelect = (color) => {
      if (this.player) this.player.setColor(color)
    }

    this.arena = createArena(this.scene)
    this.effects = new Effects(this.scene)
    this.projectiles = new ProjectileSystem(this.scene, this.effects, this.audio)
    this.pickups = new PickupSystem(this.scene, this.arena)
    this.input = new Input(this.host, this.renderer.domElement)

    this.setupKarts()
    this.ui.bind({
      onStart: () => this.startMatch(),
      onRestart: () => this.startMatch(),
      onResume: () => this.resume(),
      onQuit: () => this.quitToMenu(),
      onPause: () => this.togglePause()
    })

    this.bindEvents()
    this.placeForMenu()
    this.ui.showStart()
    this.animate()
    this.menuFreezeUntil = performance.now() + 8000
  }

  setupKarts() {
    this.karts = []
    const playerColor = this.ui.selected
    this.player = new Kart(this.scene, {
      id: 0,
      name: MATCH.playerName,
      color: playerColor.hex,
      css: playerColor.css,
      isPlayer: true
    })
    this.karts.push(this.player)

    const available = KART_COLORS.filter((color) => color.id !== playerColor.id)
    const names = [...BOT_NAMES]
    for (let i = 0; i < 7; i += 1) {
      const color = available[i % available.length]
      const name = names.splice(Math.floor(Math.random() * names.length), 1)[0]
      const bot = new Kart(this.scene, {
        id: i + 1,
        name,
        color: color.hex,
        css: color.css,
        isPlayer: false
      })
      bot.ai.aggression = 0.5 + Math.random() * 0.5
      this.karts.push(bot)
    }
  }

  bindEvents() {
    window.addEventListener('resize', () => this.onResize())
    window.addEventListener('keydown', (event) => {
      if (event.code === 'Escape') {
        if (this.state === 'playing' || this.state === 'countdown') this.togglePause()
        else if (this.state === 'paused') this.resume()
      }
      if (event.code === 'KeyM') {
        this.audio.setMuted(!this.audio.muted)
        const label = this.audio.muted ? 'SOUND OFF' : 'SOUND ON'
        const toggle = document.querySelector('#sound-toggle')
        if (toggle) toggle.textContent = label
      }
    })
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && this.state === 'playing') this.togglePause()
    })
    this.renderer.domElement.addEventListener('pointerdown', () => {
      if (this.state === 'playing') this.audio.ensure()
    })
  }

  onResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight
    this.camera.updateProjectionMatrix()
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
    this.renderer.setSize(window.innerWidth, window.innerHeight)
  }

  randomSpawn(exclude = []) {
    const points = this.arena.spawnPoints
    let best = points[0]
    let bestScore = -Infinity
    for (const point of points) {
      let score = Math.random() * 6
      for (const kart of this.karts) {
        if (!kart.alive || exclude.includes(kart)) continue
        score += Math.min(30, Math.hypot(kart.position.x - point.x, kart.position.z - point.z))
      }
      if (score > bestScore) {
        bestScore = score
        best = point
      }
    }
    return {
      x: best.x,
      z: best.z,
      heading: Math.atan2(-best.x, -best.z)
    }
  }

  placeForMenu() {
    const points = this.arena.spawnPoints
    this.karts.forEach((kart, index) => {
      const point = points[index % points.length]
      kart.spawnAt({ x: point.x, z: point.z, heading: Math.atan2(-point.x, -point.z) })
      kart.invulnerable = 0
      kart.shield.visible = false
      kart.healthBar.visible = false
      kart.showHealthBar = false
      kart.speed = 0
    })
    this.player.root.visible = true
  }

  assignSpawns() {
    const points = [...this.arena.spawnPoints].sort(() => Math.random() - 0.5)
    this.karts.forEach((kart, index) => {
      const point = points[index % points.length]
      kart.spawnAt({ x: point.x, z: point.z, heading: Math.atan2(-point.x, -point.z) })
      kart.showHealthBar = !kart.isPlayer
      kart.kills = 0
      kart.deaths = 0
      kart.damageDealt = 0
      kart.streak = 0
      kart.streakTimer = 0
    })
  }

  startMatch() {
    this.audio.ensure()
    if (this.player) this.player.setColor(this.ui.selected)
    this.projectiles.clear()
    this.pickups.reset()
    this.ui.clearFeed()
    this.firstBlood = false
    this.firstBloodAnnounced = false
    this.endShown = false
    this.endTimer = 0
    this.shake = 0
    this.hitShake = 0
    this.assignSpawns()
    this.timeLeft = MATCH.duration
    this.matchTime = 0
    this.countdownLeft = MATCH.countdown
    this.lastCountdown = MATCH.countdown
    this.respawnNotice = null
    this.state = 'countdown'
    this.cameraSnap = true
    this.ui.showGame()
    this.ui.showPause(false)
    this.ui.announce('')
    this.ui.el.announce.classList.add('hidden')
    this.ui.countdown(String(MATCH.countdown))
    this.ui.setScoreboard(this.karts, this.player)
    this.ui.setHud(this.player, this.timeLeft)
    this.ui.updateMinimap(this.karts, this.arena, this.player)
    this.audio.startEngine()
    this.audio.countdown(false)
  }

  quitToMenu() {
    this.state = 'menu'
    this.ui.showStart()
    this.ui.showPause(false)
    this.ui.countdown('', true)
    this.ui.el.countdown.classList.add('hidden')
    this.ui.el.announce.classList.add('hidden')
    this.ui.clearFeed()
    this.projectiles.clear()
    this.pickups.reset()
    this.audio.stopEngine()
    this.placeForMenu()
    this.cameraSnap = true
    this.camera.position.set(0, 30, 62)
  }

  togglePause() {
    if (this.state === 'playing' || this.state === 'countdown') {
      this.previousState = this.state
      this.state = 'paused'
      this.input.clearTransient()
      this.ui.showPause(true)
      this.audio.updateEngine(0, false, false)
    } else if (this.state === 'paused') {
      this.resume()
    }
  }

  resume() {
    if (this.state !== 'paused') return
    this.state = this.previousState
    this.ui.showPause(false)
    this.clock.getDelta()
  }

  fireKart(kart) {
    if (!kart.alive || kart.fireTimer > 0) return
    const overdrive = kart.overdrive > 0
    kart.fireTimer = overdrive ? 0.09 : COMBAT.fireCooldown
    const origin = kart.getMuzzleWorld(tempA)
    const baseYaw = kart.aimYaw + (Math.random() - 0.5) * COMBAT.spread * 2
    const damage = overdrive ? 9 : COMBAT.projectileDamage
    const speed = overdrive ? COMBAT.projectileSpeed + 8 : COMBAT.projectileSpeed
    const yawOffsets = overdrive ? [-0.085, 0, 0.085] : [0]
    for (const offset of yawOffsets) {
      const yaw = baseYaw + offset
      const direction = tempB.set(Math.sin(yaw), 0.014, Math.cos(yaw)).normalize().clone()
      this.projectiles.spawn(kart, origin, direction, kart.color, speed, { damage, scale: overdrive ? 0.85 : 1 })
    }
    this.effects.muzzle(origin.x, origin.y, origin.z, kart.color)
    if (kart.isPlayer) {
      this.audio.shoot()
      this.addShake(0.055)
      this.ui.crosshairKick?.()
    } else {
      const distance = kart.position.distanceTo(this.player.position)
      if (distance < 26) this.audio.blip(420 + Math.random() * 120, 0.07, 'square', 0.025, -160)
    }
  }

  hitKart(target, projectile) {
    if (!target.alive || target.invulnerable > 0) return false
    const source = projectile.owner
    const damage = projectile.damage
    const died = target.takeDamage(damage, source)
    if (source && source !== target) source.damageDealt += Math.min(damage, damage + target.health)

    if (source?.isPlayer) {
      this.ui.hitmarker(died)
      this.audio.hit()
    }
    if (target.isPlayer) {
      this.ui.damageFlash()
      this.addShake(died ? 1.1 : 0.36)
      this.audio.hurt()
      if (!died) this.ui.announce('ARMOR HIT', true)
    } else if (died) {
      this.addShake(0.18)
    }

    if (died) {
      this.effects.explosion(target.position.x, 0.9, target.position.z, target.color)
      this.audio.explosion()
      this.handleKill(source, target)
    }
    return true
  }

  handleKill(attacker, victim) {
    if (!this.firstBlood) {
      this.firstBlood = true
    }
    if (attacker && attacker !== victim) {
      attacker.kills += 1
      attacker.streak += 1
      attacker.streakTimer = 3.5
    }

    this.ui.feed(attacker, victim, this.player)
    this.ui.setScoreboard(this.karts, this.player)

    if (attacker?.isPlayer) {
      const streak = attacker.streak
      if (streak === 1 && !this.firstBloodAnnounced) {
        this.ui.announce('FIRST BLOOD')
        this.firstBloodAnnounced = true
      } else if (streak >= 3) {
        this.ui.announce('TRIPLE SMASH')
      } else if (streak === 2) {
        this.ui.announce('DOUBLE SMASH')
      } else {
        this.ui.announce(`SMASHED ${victim.name}`)
      }
    } else if (victim.isPlayer) {
      this.ui.announce('WRECKED', true)
      this.respawnNotice = 3
    }
  }

  updateWreckSmoke(kart, dt) {
    kart.smokeTimer -= dt
    if (kart.smokeTimer > 0) return
    kart.smokeTimer = 0.16 + Math.random() * 0.14
    const x = kart.position.x + (Math.random() - 0.5) * 1.4
    const z = kart.position.z + (Math.random() - 0.5) * 1.4
    this.effects.spawn(x, 1.05, z, {
      count: 2,
      color: 0x8a7f96,
      color2: 0x4a4157,
      speed: 1.5,
      spread: 0.45,
      size: 4,
      life: 1.15,
      gravity: -1.4,
      drag: 1.5,
      rise: 1.6
    })
    if (Math.random() < 0.4) {
      this.effects.spawn(x, 0.7, z, {
        count: 1,
        color: 0xff8a2a,
        color2: 0xffd23f,
        speed: 1.5,
        spread: 0.25,
        size: 2.2,
        life: 0.4,
        gravity: -0.4,
        drag: 2,
        rise: 1.1
      })
    }
  }

  respawn(kart) {
    const spawn = this.randomSpawn([kart])
    kart.spawnAt(spawn)
    kart.invulnerable = COMBAT.spawnProtection
    kart.shield.visible = true
    if (kart.isPlayer) {
      this.cameraSnap = true
      this.ui.announce('BACK IN THE FIGHT')
      this.respawnNotice = null
    } else {
      this.effects.ring(spawn.x, spawn.z, kart.color, 0.6, 5, 0.4)
    }
  }

  updatePlayerAim(dt) {
    const player = this.player
    if (!player.alive) {
      this.ui.el.crosshair.classList.remove('active')
      return
    }

    if (this.input.isTouch) {
      let best = null
      let bestDist = Infinity
      for (const kart of this.karts) {
        if (kart === player || !kart.alive) continue
        const dist = player.position.distanceToSquared(kart.position)
        if (dist < bestDist) {
          bestDist = dist
          best = kart
        }
      }
      if (best && bestDist < 75 * 75) {
        const desired = Math.atan2(best.position.x - player.position.x, best.position.z - player.position.z)
        player.aimYaw = steerToward(player.aimYaw, desired, 9 * dt)
      } else {
        player.aimYaw = steerToward(player.aimYaw, player.heading, 5 * dt)
      }
      return
    }

    if (this.input.mouse.seen) {
      ndc.set((this.input.mouse.x / window.innerWidth) * 2 - 1, -(this.input.mouse.y / window.innerHeight) * 2 + 1)
      raycaster.setFromCamera(ndc, this.camera)
      const hit = raycaster.ray.intersectPlane(aimPlane, this.aimPoint)
      if (hit) {
        let desired = Math.atan2(hit.x - player.position.x, hit.z - player.position.z)
        let assistTarget = null
        let assistScore = Infinity
        for (const other of this.karts) {
          if (other === player || !other.alive) continue
          const dx = other.position.x - player.position.x
          const dz = other.position.z - player.position.z
          const dist = Math.hypot(dx, dz)
          if (dist > 62) continue
          const targetYaw = Math.atan2(dx, dz)
          const angle = Math.abs(angleDelta(desired, targetYaw))
          if (angle > 0.3) continue
          const score = angle * 3 + dist * 0.01
          if (score < assistScore) {
            assistScore = score
            assistTarget = other
          }
        }
        if (assistTarget) {
          const dist = player.position.distanceTo(assistTarget.position)
          const lead = Math.min(0.75, dist / COMBAT.projectileSpeed) * 0.85
          const targetYaw = Math.atan2(
            assistTarget.position.x + assistTarget.velocity.x * lead - player.position.x,
            assistTarget.position.z + assistTarget.velocity.z * lead - player.position.z
          )
          const blend = angleDelta(desired, targetYaw) * 0.6
          if (Math.abs(blend) < 0.42) desired += blend
        }
        player.aimYaw = steerToward(player.aimYaw, desired, 20 * dt)
      }
      this.ui.setCrosshair(this.input.mouse.x, this.input.mouse.y, true)
    } else {
      player.aimYaw = steerToward(player.aimYaw, player.heading, 8 * dt)
      this.ui.setCrosshair(window.innerWidth / 2, window.innerHeight / 2, true)
    }
  }

  addShake(amount) {
    this.shake = Math.min(1.4, this.shake + amount)
  }

  updateCountdown(dt) {
    const player = this.player
    this.countdownLeft -= dt
    const current = Math.ceil(this.countdownLeft)
    if (current !== this.lastCountdown && current > 0) {
      this.lastCountdown = current
      this.ui.countdown(String(current))
      this.audio.countdown(current === 1)
    }
    if (this.countdownLeft <= 0) {
      this.state = 'playing'
      this.ui.countdown('GO!', true)
      this.audio.countdown(true)
      this.matchTime = 0
    }
    this.updateAimVisual(player, dt)
    for (const kart of this.karts) {
      kart.updateVisual(dt, this.time, this.camera)
    }
    this.pickups.update(dt, this.time, [], {})
    this.arena.update(dt, this.time)
    this.effects.update(dt)
    this.updateCamera(dt)
    this.ui.setHud(player, this.timeLeft)
  }

  updateAimVisual(player, dt) {
    if (this.state === 'countdown') {
      player.aimYaw = steerToward(player.aimYaw, player.heading, 4 * dt)
    }
  }

  updatePlaying(dt) {
    this.matchTime += dt
    this.timeLeft = Math.max(0, this.timeLeft - dt)

    this.updatePlayerAim(dt)

    const playerControls = {
      throttle: this.input.throttle,
      steer: this.input.steer,
      fire: this.input.firing,
      boost: this.input.boosting,
      overheated: false
    }
    if (this.input.firing) this.fireKart(this.player)
    this.player.drive(dt, playerControls, this.arena.colliders, this.karts)

    for (const bot of this.karts) {
      if (bot.isPlayer) continue
      const controls = runBotAI(bot, dt, this.karts, this.arena.colliders, this.arena)
      if (controls.fire) this.fireKart(bot)
      bot.drive(dt, controls, this.arena.colliders, this.karts)
    }

    for (const kart of this.karts) {
      if (!kart.alive && kart.respawnTimer <= 0) this.respawn(kart)
      kart.updateVisual(dt, this.time, this.camera)
      if (!kart.alive) this.updateWreckSmoke(kart, dt)
    }

    this.projectiles.update(dt, this.karts, this.arena.colliders, {
      onKartHit: (kart, projectile) => this.hitKart(kart, projectile)
    })

    this.pickups.update(dt, this.time, this.karts, {
      onPickup: (kart, item) => this.onPickup(kart, item),
      onBoostPad: (kart, pad) => this.onBoostPad(kart, pad)
    })
    this.pickups.checkBoostPads(this.arena, this.karts, dt, {
      onBoostPad: (kart, pad) => this.onBoostPad(kart, pad)
    })

    this.arena.update(dt, this.time)
    this.effects.update(dt)
    this.audio.updateEngine(this.player.speed, this.player.boostActive, this.player.alive)

    if (!this.player.alive) {
      this.respawnNotice = Math.max(0, Math.ceil(this.player.respawnTimer))
    }

    this.updateCamera(dt)

    this.hudTimer -= dt
    if (this.hudTimer <= 0) {
      this.hudTimer = 0.06
      this.ui.setHud(this.player, this.timeLeft)
    }
    this.scoreTimer -= dt
    if (this.scoreTimer <= 0) {
      this.scoreTimer = 0.3
      this.ui.setScoreboard(this.karts, this.player)
    }
    this.minimapTimer -= dt
    if (this.minimapTimer <= 0) {
      this.minimapTimer = 0.05
      this.ui.updateMinimap(this.karts, this.arena, this.player)
    }

    if (this.timeLeft <= 0) this.endMatch()
  }

  onPickup(kart, item) {
    if (item.type === 'health') {
      this.effects.ring(item.x, item.z, 0x55e879, 0.5, 4.5, 0.4)
      this.effects.spawn(kart.position.x, 1.2, kart.position.z, { count: 14, color: 0x55e879, speed: 6, size: 2, life: 0.6, gravity: -1 })
      if (kart.isPlayer) this.ui.announce('ARMOR RESTORED')
    } else {
      this.effects.ring(item.x, item.z, 0xffb01f, 0.5, 5, 0.4)
      this.effects.spawn(kart.position.x, 1.4, kart.position.z, { count: 18, color: 0xffb01f, speed: 8, size: 2.2, life: 0.7, gravity: 2 })
      if (kart.isPlayer) this.ui.announce('TRIPLE SHOT')
    }
    this.audio.pickup()
  }

  onBoostPad(kart, pad) {
    this.effects.ring(pad.x, pad.z, 0xffd23f, 0.6, 4, 0.35)
    if (kart.isPlayer) {
      this.addShake(0.12)
      this.audio.blip(520, 0.12, 'sawtooth', 0.06, 240)
    }
  }

  endMatch() {
    if (this.state !== 'playing') return
    this.state = 'ending'
    this.endTimer = 1.4
    this.projectiles.clear()
    this.audio.updateEngine(0, false, false)
    this.ui.announce('TIME UP')
    this.ui.el.crosshair.classList.remove('active')
    this.audio.countdown(true)
  }

  finishMatch() {
    const board = ranking(this.karts)
    const place = board.indexOf(this.player) + 1
    this.state = 'ended'
    this.endShown = true
    this.audio.stopEngine()
    this.ui.showEnd({
      victory: place === 1,
      place,
      stats: { kills: this.player.kills, deaths: this.player.deaths },
      board,
      playerKart: this.player
    })
    if (place === 1) {
      this.audio.blip(660, 0.18, 'square', 0.1)
      setTimeout(() => this.audio.blip(880, 0.18, 'square', 0.1), 160)
      setTimeout(() => this.audio.blip(1320, 0.4, 'square', 0.12), 320)
    }
  }

  updateEnding(dt) {
    this.endTimer -= dt
    this.effects.update(dt)
    this.arena.update(dt, this.time)
    for (const kart of this.karts) kart.updateVisual(dt, this.time, this.camera)
    this.updateCamera(dt)
    if (this.endTimer <= 0 && !this.endShown) this.finishMatch()
  }

  updateMenu(dt) {
    this.menuAngle += dt * 0.09
    for (const kart of this.karts) {
      kart.aimYaw = kart.heading + Math.sin(this.time * 0.6 + kart.id * 1.7) * 0.55
      kart.updateVisual(dt, this.time, this.camera)
    }
    this.pickups.update(dt, this.time, [], {})
    this.arena.update(dt, this.time)
    this.effects.update(dt)
    this.updateCamera(dt)
  }

  deathCamBlocked(x, z) {
    if (Math.abs(x) > ARENA.half - 1.6 || Math.abs(z) > ARENA.half - 1.6) return true
    for (const collider of this.arena.colliders) {
      if (collider.type === 'circle') {
        const dx = x - collider.x
        const dz = z - collider.z
        const r = collider.r + 1.1
        if (dx * dx + dz * dz < r * r) return true
      } else if (x > collider.minX - 1.1 && x < collider.maxX + 1.1 && z > collider.minZ - 1.1 && z < collider.maxZ + 1.1) {
        return true
      }
    }
    return false
  }

  cameraBlocked(x, z) {
    if (Math.abs(x) > ARENA.half - 1.2 || Math.abs(z) > ARENA.half - 1.2) return true
    for (const collider of this.arena.colliders) {
      if (collider.kind === 'crate' || collider.kind === 'barrel' || collider.kind === 'barrier') continue
      if (collider.type === 'circle') {
        const dx = x - collider.x
        const dz = z - collider.z
        const r = collider.r + 0.5
        if (dx * dx + dz * dz < r * r) return true
      } else if (x > collider.minX - 0.5 && x < collider.maxX + 0.5 && z > collider.minZ - 0.5 && z < collider.maxZ + 0.5) {
        return true
      }
    }
    return false
  }

  updateCamera(dt) {
    const player = this.player
    let desiredPos
    let desiredLook
    let fovTarget = 62

    if (this.state === 'menu') {
      const radius = 58 + Math.sin(this.time * 0.23) * 4
      desiredPos = tempA.set(Math.cos(this.menuAngle) * radius, 27 + Math.sin(this.time * 0.4) * 2.5, Math.sin(this.menuAngle) * radius)
      desiredLook = tempB.set(0, 1.8, 0)
      fovTarget = 56
    } else if (!player.alive) {
      let angle = this.time * 0.7
      for (let i = 0; i < 8; i += 1) {
        const candidate = angle + i * (Math.PI / 4)
        let clear = true
        for (let step = 2; step <= 10; step += 1) {
          const t = step / 10
          if (this.deathCamBlocked(player.position.x + Math.cos(candidate) * 9.5 * t, player.position.z + Math.sin(candidate) * 9.5 * t)) {
            clear = false
            break
          }
        }
        if (clear) {
          angle = candidate
          break
        }
      }
      desiredPos = tempA.set(
        player.position.x + Math.cos(angle) * 9.5,
        8.4,
        player.position.z + Math.sin(angle) * 9.5
      )
      desiredLook = tempB.set(player.position.x, 1.1, player.position.z)
      fovTarget = 60
    } else {
      const forward = tempC.set(Math.sin(player.heading), 0, Math.cos(player.heading))
      const boosting = player.boostActive
      const distance = boosting ? 13.4 : 11.8
      const height = boosting ? 6.4 : 5.8
      desiredPos = tempA.set(
        player.position.x - forward.x * distance,
        height,
        player.position.z - forward.z * distance
      )
      const aimBias = clamp(Math.sin(player.aimYaw - player.heading), -1, 1) * 1.4
      desiredLook = tempB.set(
        player.position.x + forward.x * 6 + Math.cos(player.heading) * aimBias,
        1.35,
        player.position.z + forward.z * 6 - Math.sin(player.heading) * aimBias
      )
      fovTarget = boosting ? 72 : 64
      if (this.state === 'countdown') {
        desiredPos.y += 2.2
        desiredPos.x -= forward.x * 2.5
        desiredPos.z -= forward.z * 2.5
        fovTarget = 58
      }
    }

    if (this.state !== 'menu') {
      const originX = player.position.x
      const originZ = player.position.z
      let blockedAt = 1
      const steps = 14
      for (let i = 2; i <= steps; i += 1) {
        const t = i / steps
        const x = originX + (desiredPos.x - originX) * t
        const z = originZ + (desiredPos.z - originZ) * t
        if (this.cameraBlocked(x, z)) {
          blockedAt = Math.max(0.5, (i - 1) / steps - 0.04)
          break
        }
      }
      if (blockedAt < 1) {
        desiredPos.x = originX + (desiredPos.x - originX) * blockedAt
        desiredPos.z = originZ + (desiredPos.z - originZ) * blockedAt
        desiredPos.y += (1 - blockedAt) * 4.6
      }
    }

    if (this.cameraSnap) {
      this.camPos.copy(desiredPos)
      this.camLook.copy(desiredLook)
      this.fov = fovTarget
      this.cameraSnap = false
    } else {
      const lambda = this.state === 'menu' ? 1.6 : 5.5
      this.camPos.x = damp(this.camPos.x, desiredPos.x, lambda, dt)
      this.camPos.y = damp(this.camPos.y, desiredPos.y, lambda, dt)
      this.camPos.z = damp(this.camPos.z, desiredPos.z, lambda, dt)
      this.camLook.x = damp(this.camLook.x, desiredLook.x, lambda * 1.4, dt)
      this.camLook.y = damp(this.camLook.y, desiredLook.y, lambda * 1.4, dt)
      this.camLook.z = damp(this.camLook.z, desiredLook.z, lambda * 1.4, dt)
      this.fov = damp(this.fov, fovTarget, 4, dt)
    }

    this.shake = Math.max(0, this.shake - dt * 2.4)
    const shakeAmount = this.shake * this.shake
    this.camera.position.copy(this.camPos)
    if (shakeAmount > 0.001) {
      this.camera.position.x += (Math.random() - 0.5) * shakeAmount * 0.85
      this.camera.position.y += (Math.random() - 0.5) * shakeAmount * 0.6
      this.camera.position.z += (Math.random() - 0.5) * shakeAmount * 0.85
    }
    this.camera.fov = this.fov
    this.camera.updateProjectionMatrix()
    this.camera.lookAt(
      this.camLook.x + (Math.random() - 0.5) * shakeAmount * 0.3,
      this.camLook.y + (Math.random() - 0.5) * shakeAmount * 0.3,
      this.camLook.z + (Math.random() - 0.5) * shakeAmount * 0.3
    )
  }

  animate() {
    requestAnimationFrame(() => this.animate())
    const rawDt = this.clock.getDelta()
    const dt = Math.min(rawDt, 0.05)
    this.time += dt

    if (this.state === 'menu') {
      this.updateMenu(dt)
    } else if (this.state === 'countdown') {
      this.updateCountdown(dt)
    } else if (this.state === 'playing') {
      this.updatePlaying(dt)
    } else if (this.state === 'paused') {
      this.arena.update(0, this.time)
      this.effects.update(0)
    } else if (this.state === 'ending') {
      this.updateEnding(dt)
    } else if (this.state === 'ended') {
      this.time += dt * 0
      this.arena.update(dt, this.time)
      this.effects.update(dt)
      for (const kart of this.karts) kart.updateVisual(dt, this.time, this.camera)
      this.updateCamera(dt)
    }

    if (this.state === 'menu' && performance.now() < this.menuFreezeUntil) return
    this.renderer.render(this.scene, this.camera)
  }
}
