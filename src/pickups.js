import * as THREE from 'three'
import { COMBAT } from './config.js'

function makeIconTexture(text, background, foreground) {
  const size = 128
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = background
  ctx.fillRect(0, 0, size, size)
  ctx.strokeStyle = foreground
  ctx.lineWidth = 9
  ctx.strokeRect(7, 7, size - 14, size - 14)
  ctx.fillStyle = foreground
  ctx.font = '900 64px Arial Black, Arial, sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(text, size / 2, size / 2 + 4)
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  return texture
}

function makeGlowTexture() {
  const size = 96
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
  g.addColorStop(0, 'rgba(255,255,255,1)')
  g.addColorStop(0.35, 'rgba(255,255,255,0.55)')
  g.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, size, size)
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  return texture
}

const glowTexture = makeGlowTexture()

export class PickupSystem {
  constructor(scene, arena) {
    this.items = []
    this.scene = scene

    const healthMaterial = new THREE.MeshStandardMaterial({ color: 0x55e879, emissive: 0x1f9e46, emissiveIntensity: 0.9, roughness: 0.35, metalness: 0.2 })
    for (const spot of arena.healthSpots) {
      const group = new THREE.Group()
      group.position.set(spot.x, 0.7, spot.z)

      const pad = new THREE.Mesh(
        new THREE.CylinderGeometry(1.5, 1.7, 0.12, 16),
        new THREE.MeshStandardMaterial({ color: 0x112a1e, roughness: 0.7, metalness: 0.3 })
      )
      pad.position.y = -0.6
      pad.receiveShadow = true
      group.add(pad)

      const spinner = new THREE.Group()
      const boxA = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.34, 0.34), healthMaterial)
      boxA.castShadow = true
      const boxB = new THREE.Mesh(new THREE.BoxGeometry(0.34, 1.15, 0.34), healthMaterial)
      boxB.castShadow = true
      const boxC = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.34, 1.15), healthMaterial)
      boxC.castShadow = true
      spinner.add(boxA, boxB, boxC)

      const glow = new THREE.Sprite(new THREE.SpriteMaterial({
        map: glowTexture, color: 0x55e879, transparent: true, opacity: 0.7,
        blending: THREE.AdditiveBlending, depthWrite: false
      }))
      glow.scale.setScalar(4.6)
      spinner.add(glow)
      group.add(spinner)

      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(1.5, 0.05, 5, 24),
        new THREE.MeshBasicMaterial({ color: 0x55e879, transparent: true, opacity: 0.55 })
      )
      ring.rotation.x = Math.PI / 2
      ring.position.y = -0.5
      group.add(ring)

      this.scene.add(group)
      this.items.push({ type: 'health', x: spot.x, z: spot.z, radius: 2.1, group, spinner, glow, ring, active: true, timer: 0, respawn: 14 })
    }

    const crateMaterial = new THREE.MeshStandardMaterial({ color: 0xff8a1f, emissive: 0x9e4300, emissiveIntensity: 0.6, roughness: 0.4, metalness: 0.3 })
    const starTexture = makeIconTexture('x3', '#ff8a1f', '#1a1030')
    for (const [x, z] of [[0, 22], [0, -22], [22, 0], [-22, 0]]) {
      const group = new THREE.Group()
      group.position.set(x, 1.1, z)
      const box = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.5, 1.5), crateMaterial)
      box.castShadow = true
      group.add(box)

      const label = new THREE.Mesh(
        new THREE.PlaneGeometry(1.15, 1.15),
        new THREE.MeshBasicMaterial({ map: starTexture, transparent: true })
      )
      label.position.z = 0.77
      group.add(label)
      const labelBack = label.clone()
      labelBack.position.z = -0.77
      labelBack.rotation.y = Math.PI
      group.add(labelBack)

      const glow = new THREE.Sprite(new THREE.SpriteMaterial({
        map: glowTexture, color: 0xffb01f, transparent: true, opacity: 0.6,
        blending: THREE.AdditiveBlending, depthWrite: false
      }))
      glow.scale.setScalar(5.4)
      group.add(glow)

      this.scene.add(group)
      this.items.push({ type: 'overdrive', x, z, radius: 2.2, group, spinner: group, glow, ring: null, active: true, timer: 0, respawn: 20 })
    }
  }

  update(dt, time, karts, callbacks) {
    for (const item of this.items) {
      if (!item.active) {
        item.timer -= dt
        item.group.visible = false
        if (item.timer <= 0) {
          item.active = true
          item.group.visible = true
          item.group.scale.setScalar(0.01)
        }
        continue
      }
      if (item.group.scale.x < 1) {
        item.group.scale.setScalar(Math.min(1, item.group.scale.x + dt * 3.2))
      }
      item.group.position.y = (item.type === 'health' ? 0.7 : 1.1) + Math.sin(time * 2.2 + item.x) * 0.18
      item.spinner.rotation.y += dt * (item.type === 'health' ? 1.4 : 0.9)
      item.glow.material.opacity = 0.45 + Math.sin(time * 3 + item.z) * 0.18
      if (item.ring) item.ring.rotation.z += dt * 0.9

      for (const kart of karts) {
        if (!kart.alive) continue
        const dx = kart.position.x - item.x
        const dz = kart.position.z - item.z
        if (dx * dx + dz * dz > item.radius * item.radius) continue

        if (item.type === 'health') {
          if (kart.health >= COMBAT.maxHealth) continue
          kart.heal(40)
        } else {
          if (kart.overdrive > 2) continue
          kart.overdrive = 9
        }
        item.active = false
        item.timer = item.respawn
        item.group.visible = false
        callbacks?.onPickup?.(kart, item)
        break
      }
    }

  }

  checkBoostPads(arena, karts, dt, callbacks) {
    for (const pad of arena.boostPads) {
      if (pad.cooldown > 0) {
        pad.cooldown = Math.max(0, pad.cooldown - dt)
        continue
      }
      for (const kart of karts) {
        if (!kart.alive) continue
        const dx = kart.position.x - pad.x
        const dz = kart.position.z - pad.z
        if (dx * dx + dz * dz > pad.radius * pad.radius) continue
        kart.boost = 100
        kart.velocity.addScaledVector(kart.forward, 5.5)
        pad.cooldown = 4
        callbacks?.onBoostPad?.(kart, pad)
        break
      }
    }
  }

  reset() {
    for (const item of this.items) {
      item.active = true
      item.timer = 0
      item.group.visible = true
      item.group.scale.setScalar(1)
    }
  }
}
