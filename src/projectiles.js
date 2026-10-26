import * as THREE from 'three'
import { COMBAT, ARENA } from './config.js'
import { PHYSICS } from './config.js'
import { circlesOverlap } from './logic.js'

const sphereGeometry = new THREE.SphereGeometry(0.3, 10, 8)

function makeGlowTexture() {
  const size = 64
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
  g.addColorStop(0, 'rgba(255,255,255,1)')
  g.addColorStop(0.4, 'rgba(255,255,255,0.65)')
  g.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, size, size)
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  return texture
}

const glowTexture = makeGlowTexture()

export class ProjectileSystem {
  constructor(scene, effects, audio) {
    this.scene = scene
    this.effects = effects
    this.audio = audio
    this.projectiles = []
    this.pool = []
    this.materials = new Map()
  }

  getMaterial(color) {
    if (!this.materials.has(color)) {
      const glow = new THREE.SpriteMaterial({
        map: glowTexture,
        color,
        transparent: true,
        opacity: 0.95,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      })
      this.materials.set(color, { glow, basic: new THREE.MeshBasicMaterial({ color, toneMapped: false }) })
    }
    return this.materials.get(color)
  }

  acquire() {
    const pooled = this.pool.pop()
    if (pooled) {
      pooled.root.visible = true
      return pooled
    }
    const root = new THREE.Group()
    const materials = this.getMaterial(0xffffff)
    const sphere = new THREE.Mesh(sphereGeometry, materials.basic)
    sphere.scale.setScalar(1)
    root.add(sphere)
    const sprite = new THREE.Sprite(materials.glow)
    sprite.scale.setScalar(2.3)
    root.add(sprite)
    this.scene.add(root)
    return { root, sphere, sprite }
  }

  spawn(owner, origin, direction, color, speed = COMBAT.projectileSpeed, options = {}) {
    const visual = this.acquire()
    const materials = this.getMaterial(color)
    visual.sphere.material = materials.basic
    visual.sprite.material = materials.glow
    visual.root.position.copy(origin)
    visual.root.scale.setScalar(options.scale ?? 1)

    const projectile = {
      visual,
      root: visual.root,
      sphere: visual.sphere,
      owner,
      position: origin.clone(),
      previous: origin.clone(),
      velocity: direction.clone().multiplyScalar(speed),
      life: COMBAT.projectileLife,
      damage: options.damage ?? COMBAT.projectileDamage,
      radius: COMBAT.projectileRadius,
      color
    }
    this.projectiles.push(projectile)
    return projectile
  }

  release(projectile) {
    projectile.root.visible = false
    this.pool.push(projectile.visual)
  }

  update(dt, karts, colliders, callbacks) {
    for (let i = this.projectiles.length - 1; i >= 0; i -= 1) {
      const p = this.projectiles[i]
      p.previous.copy(p.position)
      p.position.addScaledVector(p.velocity, dt)
      p.life -= dt
      p.root.position.copy(p.position)
      p.sphere.rotation.x += dt * 12
      p.sphere.rotation.y += dt * 9

      this.effects.trail(p.position.x, p.position.y, p.position.z, p.color, 1.5)

      if (p.life <= 0) {
        this.remove(i)
        continue
      }

      let hitSomething = false
      for (const kart of karts) {
        if (kart === p.owner || !kart.alive || kart.invulnerable > 0) continue
        const hit = segmentHitsCircle(p.previous, p.position, kart.position, PHYSICS.kartRadius + p.radius)
        if (hit) {
          const result = callbacks?.onKartHit?.(kart, p, hit)
          if (result !== false) {
            this.effects.impact(p.position.x, p.position.y, p.position.z, p.color)
            this.remove(i)
            hitSomething = true
          }
          break
        }
      }
      if (hitSomething) continue

      for (const collider of colliders) {
        let blocked = false
        if (collider.type === 'circle') {
          blocked = segmentHitsCircle(p.previous, p.position, collider, collider.r + p.radius)
        } else {
          const minX = collider.minX - p.radius
          const maxX = collider.maxX + p.radius
          const minZ = collider.minZ - p.radius
          const maxZ = collider.maxZ + p.radius
          const mid = { x: (p.previous.x + p.position.x) / 2, z: (p.previous.z + p.position.z) / 2 }
          blocked = pointInBox(p.position.x, p.position.z, minX, maxX, minZ, maxZ) ||
            pointInBox(mid.x, mid.z, minX, maxX, minZ, maxZ) ||
            pointInBox(p.previous.x, p.previous.z, minX, maxX, minZ, maxZ)
        }
        if (blocked) {
          this.effects.impact(p.position.x, p.position.y, p.position.z, p.color)
          this.audio?.hit()
          this.remove(i)
          hitSomething = true
          break
        }
      }
      if (hitSomething) continue

      if (Math.abs(p.position.x) > ARENA.half + 2 || Math.abs(p.position.z) > ARENA.half + 2) {
        this.remove(i)
        continue
      }
      if (p.position.y < 0.12) {
        this.effects.impact(p.position.x, 0.2, p.position.z, p.color)
        this.remove(i)
      }
    }
  }

  remove(index) {
    const [projectile] = this.projectiles.splice(index, 1)
    if (projectile) this.release(projectile)
  }

  clear() {
    for (const projectile of this.projectiles) this.release(projectile)
    this.projectiles.length = 0
  }
}

function segmentHitsCircle(previous, current, circle, radius) {
  const dx = current.x - previous.x
  const dz = current.z - previous.z
  const fx = previous.x - circle.x
  const fz = previous.z - circle.z
  const a = dx * dx + dz * dz
  if (a < 0.000001) {
    return circlesOverlap(current.x, current.z, radius, circle.x, circle.z, 0)
  }
  const b = 2 * (fx * dx + fz * dz)
  const c = fx * fx + fz * fz - radius * radius
  const discriminant = b * b - 4 * a * c
  if (discriminant < 0) {
    const distSq = fx * fx + fz * fz
    return distSq <= radius * radius
  }
  const sqrt = Math.sqrt(discriminant)
  const t1 = (-b - sqrt) / (2 * a)
  const t2 = (-b + sqrt) / (2 * a)
  if ((t1 >= 0 && t1 <= 1) || (t2 >= 0 && t2 <= 1)) {
    return { x: circle.x, z: circle.z }
  }
  return null
}

function pointInBox(x, z, minX, maxX, minZ, maxZ) {
  return x >= minX && x <= maxX && z >= minZ && z <= maxZ
}

