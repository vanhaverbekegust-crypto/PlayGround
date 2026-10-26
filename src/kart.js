import * as THREE from 'three'
import { ARENA, PHYSICS, COMBAT } from './config.js'
import { clamp, angleDelta, steerToward, resolveCircleAABB, circleVsCircleResolve } from './logic.js'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

function makeGlowTexture() {
  const size = 64
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
  g.addColorStop(0, 'rgba(255,255,255,1)')
  g.addColorStop(0.4, 'rgba(255,255,255,0.55)')
  g.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, size, size)
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  return texture
}

const glowTexture = makeGlowTexture()
const tmpForward = new THREE.Vector3()
const tmpVec = new THREE.Vector3()

export class Kart {
  constructor(scene, options) {
    this.scene = scene
    this.name = options.name
    this.color = options.color
    this.css = options.css
    this.isPlayer = Boolean(options.isPlayer)
    this.id = options.id ?? 0

    this.position = new THREE.Vector3()
    this.velocity = new THREE.Vector3()
    this.heading = 0
    this.aimYaw = 0
    this.speed = 0
    this.health = COMBAT.maxHealth
    this.boost = 100
    this.boostActive = false
    this.fireTimer = 0
    this.overdrive = 0
    this.kills = 0
    this.deaths = 0
    this.damageDealt = 0
    this.alive = true
    this.respawnTimer = 0
    this.invulnerable = 0
    this.hitFlash = 0
    this.lastAttacker = null
    this.streak = 0
    this.streakTimer = 0
    this.smokeTimer = 0
    this.wreckTilt = 0
    this.wheelSpin = 0
    this.bodyLean = 0
    this.bodyPitch = 0
    this.engineWobble = Math.random() * 10
    this.showHealthBar = false

    this.ai = {
      target: null,
      thinkTimer: Math.random() * 0.6,
      strafeDir: Math.random() > 0.5 ? 1 : -1,
      stuckTimer: 0,
      reverseTimer: 0,
      aimError: 0.05 + Math.random() * 0.09,
      aggression: 0.55 + Math.random() * 0.45,
      preferredRange: 17 + Math.random() * 9,
      reaction: 0.25 + Math.random() * 0.35,
      lineOfSight: false,
      boostTimer: 0,
      wander: new THREE.Vector3(),
      wanderTimer: 0
    }

    this.buildMesh()
    scene.add(this.root)
  }

  buildMesh() {
    const color = new THREE.Color(this.color)
    const accent = color.clone().offsetHSL(0.02, 0.05, 0.12)
    const dark = new THREE.Color(0x16122c)
    const metal = new THREE.Color(0x2a2550)

    this.colorMaterial = new THREE.MeshStandardMaterial({ color: this.color, roughness: 0.38, metalness: 0.45 })
    this.accentMaterial = new THREE.MeshStandardMaterial({ color: accent, roughness: 0.4, metalness: 0.4 })
    this.darkMaterial = new THREE.MeshStandardMaterial({ color: dark, roughness: 0.6, metalness: 0.45 })
    this.metalMaterial = new THREE.MeshStandardMaterial({ color: metal, roughness: 0.45, metalness: 0.65 })
    this.rubberMaterial = new THREE.MeshStandardMaterial({ color: 0x100d20, roughness: 0.92, metalness: 0.02 })
    this.glassMaterial = new THREE.MeshStandardMaterial({ color: 0x9be8ff, roughness: 0.15, metalness: 0.8, emissive: 0x1b6f8a, emissiveIntensity: 0.45 })
    this.emissiveMaterial = new THREE.MeshBasicMaterial({ color: this.color })
    this.flashMaterials = [this.colorMaterial, this.accentMaterial]
    this.baseEmissive = this.colorMaterial.emissive.clone()

    const root = new THREE.Group()
    root.rotation.order = 'YXZ'
    this.root = root
    this.visual = new THREE.Group()
    root.add(this.visual)

    const add = (geometry, material, x, y, z, parent = this.visual) => {
      const mesh = new THREE.Mesh(geometry, material)
      mesh.position.set(x, y, z)
      mesh.castShadow = true
      mesh.receiveShadow = true
      parent.add(mesh)
      return mesh
    }

    add(new THREE.BoxGeometry(1.84, 0.34, 3.15), this.darkMaterial, 0, 0.52, 0)
    add(new THREE.BoxGeometry(1.72, 0.58, 2.5), this.colorMaterial, 0, 0.94, 0.05)
    add(new THREE.BoxGeometry(1.58, 0.26, 1.15), this.colorMaterial, 0, 1.14, 1.02).rotation.x = -0.24
    add(new THREE.BoxGeometry(1.44, 0.24, 0.36), this.darkMaterial, 0, 0.72, 1.84)
    add(new THREE.BoxGeometry(0.36, 0.42, 1.55), this.accentMaterial, 1.02, 0.82, -0.02)
    add(new THREE.BoxGeometry(0.36, 0.42, 1.55), this.accentMaterial, -1.02, 0.82, -0.02)
    add(new THREE.BoxGeometry(1.5, 0.52, 0.92), this.accentMaterial, 0, 1.08, -1.12)
    add(new THREE.BoxGeometry(1.25, 0.12, 0.72), this.darkMaterial, 0, 1.37, -1.12)
    add(new THREE.BoxGeometry(1.86, 0.2, 0.24), this.colorMaterial, 0, 0.92, -1.6)
    add(new THREE.BoxGeometry(0.14, 0.56, 0.14), this.metalMaterial, 0.62, 1.58, -1.4)
    add(new THREE.BoxGeometry(0.14, 0.56, 0.14), this.metalMaterial, -0.62, 1.58, -1.4)
    add(new THREE.BoxGeometry(2.3, 0.12, 0.55), this.accentMaterial, 0, 1.86, -1.45)
    add(new THREE.BoxGeometry(2.42, 0.05, 0.18), this.colorMaterial, 0, 1.93, -1.45)
    add(new THREE.BoxGeometry(0.12, 0.34, 0.62), this.colorMaterial, 1.17, 1.86, -1.45)
    add(new THREE.BoxGeometry(0.12, 0.34, 0.62), this.colorMaterial, -1.17, 1.86, -1.45)

    add(new THREE.BoxGeometry(0.62, 0.2, 0.7), this.darkMaterial, 0, 1.27, -0.28)
    const seat = add(new THREE.BoxGeometry(0.66, 0.6, 0.24), this.darkMaterial, 0, 1.5, -0.56)
    seat.rotation.x = -0.12
    add(new THREE.CylinderGeometry(0.24, 0.31, 0.56, 10), this.accentMaterial, 0, 1.68, -0.3)
    add(new THREE.BoxGeometry(0.56, 0.14, 0.34), this.darkMaterial, 0, 1.86, -0.32)
    const head = add(new THREE.SphereGeometry(0.28, 14, 12), new THREE.MeshStandardMaterial({ color: 0xf2b98f, roughness: 0.7 }), 0, 2.12, -0.3)
    head.castShadow = true
    const helmet = add(new THREE.SphereGeometry(0.33, 16, 12), this.accentMaterial, 0, 2.15, -0.3)
    helmet.scale.set(1, 0.94, 1)
    add(new THREE.BoxGeometry(0.5, 0.17, 0.18), this.glassMaterial, 0, 2.12, -0.01)
    add(new THREE.BoxGeometry(0.47, 0.13, 0.07), this.colorMaterial, 0, 2.13, 0.06)
    add(new THREE.BoxGeometry(0.16, 0.1, 0.62), new THREE.MeshStandardMaterial({ color: 0xf7f7ff, roughness: 0.4 }), 0, 2.42, -0.3)
    add(new THREE.BoxGeometry(0.26, 0.1, 0.42), new THREE.MeshStandardMaterial({ color: 0xf7f7ff, roughness: 0.4 }), 0, 2.36, -0.3)
    const wheelColumn = add(new THREE.CylinderGeometry(0.03, 0.03, 0.34, 6), this.metalMaterial, 0, 1.48, 0.18)
    wheelColumn.rotation.x = 1.05
    const steeringWheel = add(new THREE.TorusGeometry(0.2, 0.035, 6, 14), this.darkMaterial, 0, 1.6, 0.3)
    steeringWheel.rotation.x = 1.2
    for (const side of [-1, 1]) {
      const arm = add(new THREE.CylinderGeometry(0.055, 0.06, 0.52, 6), this.colorMaterial, side * 0.24, 1.72, 0.0)
      arm.rotation.x = 1.0
      arm.rotation.z = side * 0.16
      add(new THREE.SphereGeometry(0.09, 8, 6), this.darkMaterial, side * 0.15, 1.63, 0.24)
    }

    const wheelPositions = [
      [1.04, 1.06, true], [-1.04, 1.06, true], [1.08, -1.02, false], [-1.08, -1.02, false]
    ]
    this.wheels = []
    this.frontWheels = []
    for (const [x, z, front] of wheelPositions) {
      const pivot = new THREE.Group()
      pivot.position.set(x, 0.52, z)
      const spin = new THREE.Group()
      const tire = new THREE.Mesh(new THREE.CylinderGeometry(0.52, 0.52, 0.42, 16), this.rubberMaterial)
      tire.rotation.z = Math.PI / 2
      tire.castShadow = true
      const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.44, 10), this.accentMaterial)
      rim.rotation.z = Math.PI / 2
      rim.castShadow = true
      const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.46, 8), this.metalMaterial)
      hub.rotation.z = Math.PI / 2
      spin.add(tire, rim, hub)
      pivot.add(spin)
      this.visual.add(pivot)
      this.wheels.push({ pivot, spin })
      if (front) this.frontWheels.push(pivot)
    }

    const exhaustMaterial = new THREE.MeshStandardMaterial({ color: 0x3a3560, roughness: 0.4, metalness: 0.8 })
    for (const x of [-0.44, 0.44]) {
      const pipe = add(new THREE.CylinderGeometry(0.13, 0.15, 0.5, 8), exhaustMaterial, x, 1.05, -1.62)
      pipe.rotation.x = Math.PI / 2
      const tip = add(new THREE.CircleGeometry(0.11, 8), new THREE.MeshBasicMaterial({ color: 0xffb01f, side: THREE.DoubleSide }), x, 1.05, -1.89)
      tip.rotation.y = Math.PI
    }

    this.flames = []
    for (const x of [-0.44, 0.44]) {
      const flame = new THREE.Mesh(
        new THREE.ConeGeometry(0.18, 1.05, 8, 1, true),
        new THREE.MeshBasicMaterial({ color: 0xff8a1f, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })
      )
      flame.rotation.x = -Math.PI / 2
      flame.position.set(x, 1.05, -2.3)
      flame.visible = false
      this.visual.add(flame)
      this.flames.push(flame)
    }

    this.turret = new THREE.Group()
    this.turret.position.set(0, 1.6, 0.4)
    const turretBase = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.38, 0.24, 10), this.metalMaterial)
    turretBase.castShadow = true
    this.turret.add(turretBase)
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.13, 1.15, 10), this.darkMaterial)
    barrel.rotation.x = Math.PI / 2
    barrel.position.set(0, 0.08, 0.6)
    barrel.castShadow = true
    this.turret.add(barrel)
    const barrelTip = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.18, 10), this.emissiveMaterial)
    barrelTip.rotation.x = Math.PI / 2
    barrelTip.position.set(0, 0.08, 1.14)
    this.turret.add(barrelTip)
    this.muzzle = new THREE.Object3D()
    this.muzzle.position.set(0, 0.08, 1.3)
    this.turret.add(this.muzzle)
    for (const side of [-1, 1]) {
      const fin = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.22, 0.5), this.accentMaterial)
      fin.position.set(side * 0.24, 0.12, 0.1)
      this.turret.add(fin)
    }
    this.visual.add(this.turret)

    const underglow = new THREE.Mesh(
      new THREE.PlaneGeometry(3.4, 4.7),
      new THREE.MeshBasicMaterial({
        map: glowTexture,
        color: this.color,
        transparent: true,
        opacity: 0.55,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      })
    )
    underglow.rotation.x = -Math.PI / 2
    underglow.position.y = 0.06
    underglow.renderOrder = 1
    this.underglow = underglow
    root.add(underglow)

    const headlightMaterial = new THREE.MeshBasicMaterial({ color: 0xfff6da })
    for (const x of [-0.58, 0.58]) {
      const light = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.12, 0.08), headlightMaterial)
      light.position.set(x, 1.02, 1.82)
      this.visual.add(light)
    }

    const shieldMaterial = new THREE.ShaderMaterial({
      uniforms: {
        uColor: { value: new THREE.Color(0x38e8ff) },
        uTime: { value: 0 }
      },
      vertexShader: `
        varying vec3 vNormalW;
        varying vec3 vViewW;
        void main() {
          vNormalW = normalize(normalMatrix * normal);
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          vViewW = normalize(-mv.xyz);
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: `
        uniform vec3 uColor;
        uniform float uTime;
        varying vec3 vNormalW;
        varying vec3 vViewW;
        void main() {
          float rim = pow(1.0 - abs(dot(vNormalW, vViewW)), 2.4);
          float pulse = 0.8 + 0.2 * sin(uTime * 5.0);
          gl_FragColor = vec4(uColor, rim * 0.5 * pulse);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide
    })
    this.shield = new THREE.Mesh(new THREE.SphereGeometry(2.3, 24, 16), shieldMaterial)
    this.shield.position.y = 1.15
    this.shield.visible = false
    root.add(this.shield)

    this.shieldRing = new THREE.Mesh(
      new THREE.TorusGeometry(2.05, 0.035, 6, 40),
      new THREE.MeshBasicMaterial({ color: 0x38e8ff, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false })
    )
    this.shieldRing.rotation.x = Math.PI / 2
    this.shieldRing.position.y = 0.16
    this.shieldRing.visible = false
    root.add(this.shieldRing)

    const barGroup = new THREE.Group()
    barGroup.position.y = 3.55
    const bg = new THREE.Mesh(new THREE.PlaneGeometry(1.9, 0.2), new THREE.MeshBasicMaterial({ color: 0x07040f, transparent: true, opacity: 0.72, depthWrite: false }))
    barGroup.add(bg)
    const fill = new THREE.Mesh(new THREE.PlaneGeometry(1.78, 0.11), new THREE.MeshBasicMaterial({ color: 0x55e879, depthWrite: false }))
    fill.position.z = 0.01
    barGroup.add(fill)
    this.healthFill = fill
    const nameTag = this.makeNameTag()
    nameTag.position.set(0, 0.28, 0)
    barGroup.add(nameTag)
    this.healthBar = barGroup
    this.nameTag = nameTag
    root.add(barGroup)

    const shadowBlob = new THREE.Mesh(
      new THREE.PlaneGeometry(3.2, 4),
      new THREE.MeshBasicMaterial({ map: glowTexture, color: 0x000000, transparent: true, opacity: 0.45, depthWrite: false })
    )
    shadowBlob.rotation.x = -Math.PI / 2
    shadowBlob.position.y = 0.045
    root.add(shadowBlob)

    this.mergeStaticParts()
    this.visual.traverse((object) => {
      if (!object.isMesh) return
      if (object === this.underglow || object === this.shield) return
      object.geometry.computeBoundingSphere()
      object.castShadow = Boolean(object.geometry.boundingSphere && object.geometry.boundingSphere.radius > 0.45)
      object.receiveShadow = object.castShadow
    })
    for (const flame of this.flames) flame.castShadow = false
    this.underglow.castShadow = false
    this.shield.castShadow = false
    this.shieldRing.castShadow = false
    shadowBlob.castShadow = false
  }

  mergeStaticParts() {
    const keep = new Set()
    this.turret.traverse((object) => keep.add(object))
    for (const flame of this.flames) flame.traverse((object) => keep.add(object))
    for (const wheel of this.wheels) wheel.pivot.traverse((object) => keep.add(object))

    this.visual.updateMatrixWorld(true)
    const buckets = new Map()
    const remove = []
    this.visual.traverse((object) => {
      if (!object.isMesh || keep.has(object)) return
      if (Array.isArray(object.material) || !object.material) return
      const geometry = object.geometry.clone().applyMatrix4(object.matrixWorld)
      const key = object.material.uuid
      if (!buckets.has(key)) buckets.set(key, { material: object.material, geometries: [] })
      buckets.get(key).geometries.push(geometry)
      remove.push(object)
    })

    for (const { material, geometries } of buckets.values()) {
      if (geometries.length < 2) {
        for (const geometry of geometries) geometry.dispose()
        continue
      }
      const merged = mergeGeometries(geometries, false)
      for (const geometry of geometries) geometry.dispose()
      if (!merged) continue
      const mesh = new THREE.Mesh(merged, material)
      mesh.castShadow = true
      mesh.receiveShadow = true
      this.visual.add(mesh)
    }
    for (const object of remove) object.parent?.remove(object)
  }

  setColor(colorDef) {
    this.color = colorDef.hex
    this.css = colorDef.css
    const color = new THREE.Color(this.color)
    const accent = color.clone().offsetHSL(0.02, 0.05, 0.12)
    this.colorMaterial.color.copy(color)
    this.accentMaterial.color.copy(accent)
    this.emissiveMaterial.color.copy(color)
    this.underglow.material.color.copy(color)
    this.baseEmissive.copy(this.colorMaterial.emissive)
    const oldTag = this.nameTag
    this.healthBar.remove(oldTag)
    oldTag.material.map.dispose()
    oldTag.material.dispose()
    const tag = this.makeNameTag()
    tag.position.set(0, 0.28, 0)
    this.healthBar.add(tag)
    this.nameTag = tag
  }

  makeNameTag() {
    const canvas = document.createElement('canvas')
    canvas.width = 256
    canvas.height = 64
    const ctx = canvas.getContext('2d')
    ctx.font = '900 34px Arial Black, Arial, sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.lineWidth = 6
    ctx.strokeStyle = 'rgba(8,5,22,0.9)'
    ctx.strokeText(this.name, 128, 34)
    ctx.fillStyle = this.css
    ctx.fillText(this.name, 128, 34)
    const texture = new THREE.CanvasTexture(canvas)
    texture.colorSpace = THREE.SRGBColorSpace
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false }))
    sprite.scale.set(2.8, 0.7, 1)
    return sprite
  }

  spawnAt(spawn) {
    this.position.set(spawn.x, 0, spawn.z)
    this.velocity.set(0, 0, 0)
    this.heading = spawn.heading
    this.aimYaw = spawn.heading
    this.speed = 0
    this.health = COMBAT.maxHealth
    this.boost = 100
    this.boostActive = false
    this.fireTimer = 0
    this.overdrive = 0
    this.alive = true
    this.respawnTimer = 0
    this.invulnerable = COMBAT.spawnProtection
    this.hitFlash = 0
    this.streak = 0
    this.streakTimer = 0
    this.visual.visible = true
    this.root.visible = true
    this.shield.visible = true
    this.shieldRing.visible = true
    this.healthBar.visible = this.showHealthBar && !this.isPlayer
    this.root.position.copy(this.position)
    this.root.rotation.set(0, this.heading, 0)
    this.visual.rotation.set(0, 0, 0)
    this.visual.position.y = 0
    this.bodyLean = 0
    this.turret.rotation.y = 0
    this.healthFill.scale.x = 1
    this.healthFill.position.x = 0
    this.healthFill.material.color.setHex(0x55e879)
  }

  get forward() {
    return tmpForward.set(Math.sin(this.heading), 0, Math.cos(this.heading))
  }

  get maxSpeed() {
    return this.boostActive ? PHYSICS.boostSpeed : PHYSICS.maxSpeed
  }

  drive(dt, controls, colliders, karts) {
    if (!this.alive) {
      this.respawnTimer -= dt
      return
    }
    this.fireTimer = Math.max(0, this.fireTimer - dt)
    if (this.overdrive > 0) this.overdrive = Math.max(0, this.overdrive - dt)
    if (this.invulnerable > 0) this.invulnerable = Math.max(0, this.invulnerable - dt)
    if (this.streakTimer > 0) {
      this.streakTimer -= dt
      if (this.streakTimer <= 0) this.streak = 0
    }

    const throttle = controls.throttle
    const steer = controls.steer
    this.steerInput = steer
    this.boostActive = Boolean(controls.boost) && this.boost > 1 && throttle > 0 && !controls.overheated

    if (this.boostActive) {
      this.boost = Math.max(0, this.boost - PHYSICS.boostDrain * dt)
    } else {
      this.boost = Math.min(100, this.boost + PHYSICS.boostRegen * dt)
    }

    const forward = this.forward
    const signed = this.velocity.dot(forward)
    const speedFactor = clamp(Math.abs(signed) / 7, 0, 1)
    const reverse = signed < -0.5 ? -1 : 1
    const turn = steer * PHYSICS.turnRate * dt * speedFactor * reverse * (this.boostActive ? 0.92 : 1)
    this.heading += turn

    const engineForce = this.boostActive ? PHYSICS.boostAccel : PHYSICS.accel
    if (throttle > 0) {
      this.velocity.addScaledVector(forward, engineForce * throttle * dt)
    } else if (throttle < 0) {
      this.velocity.addScaledVector(forward, PHYSICS.brake * throttle * dt)
    } else {
      this.velocity.multiplyScalar(Math.exp(-1.2 * dt))
    }

    const forwardSpeed = this.velocity.dot(forward)
    const lateral = tmpVec.copy(this.velocity).addScaledVector(forward, -forwardSpeed)
    lateral.multiplyScalar(Math.exp(-PHYSICS.grip * dt))
    this.velocity.copy(lateral).addScaledVector(forward, forwardSpeed)

    const maxForward = this.maxSpeed
    if (forwardSpeed > maxForward) this.velocity.addScaledVector(forward, maxForward - forwardSpeed)
    if (forwardSpeed < -PHYSICS.reverseSpeed) this.velocity.addScaledVector(forward, -PHYSICS.reverseSpeed - forwardSpeed)

    this.velocity.multiplyScalar(Math.exp(-PHYSICS.drag * 0.24 * dt))

    this.position.addScaledVector(this.velocity, dt)

    const limit = ARENA.half - PHYSICS.kartRadius - 0.9
    if (this.position.x > limit) { this.position.x = limit; if (this.velocity.x > 0) this.velocity.x *= -0.35 }
    if (this.position.x < -limit) { this.position.x = -limit; if (this.velocity.x < 0) this.velocity.x *= -0.35 }
    if (this.position.z > limit) { this.position.z = limit; if (this.velocity.z > 0) this.velocity.z *= -0.35 }
    if (this.position.z < -limit) { this.position.z = -limit; if (this.velocity.z < 0) this.velocity.z *= -0.35 }

    this.resolveCollisions(colliders)
    this.resolveKarts(karts)

    this.speed = this.velocity.dot(this.forward)
    this.wheelSpin += this.speed * dt * 2.8
  }

  resolveCollisions(colliders) {
    const radius = PHYSICS.kartRadius
    for (const collider of colliders) {
      if (collider.type === 'circle') {
        const hit = circleVsCircleResolve(this.position.x, this.position.z, radius, collider.x, collider.z, collider.r)
        if (hit) {
          this.position.x += hit.x * hit.depth
          this.position.z += hit.z * hit.depth
          const dot = this.velocity.x * hit.x + this.velocity.z * hit.z
          if (dot < 0) {
            this.velocity.x -= hit.x * dot * 1.35
            this.velocity.z -= hit.z * dot * 1.35
          }
        }
      } else {
        const hit = resolveCircleAABB(this.position.x, this.position.z, radius, collider.minX, collider.maxX, collider.minZ, collider.maxZ)
        if (hit) {
          this.position.x += hit.x * hit.depth
          this.position.z += hit.z * hit.depth
          const dot = this.velocity.x * hit.x + this.velocity.z * hit.z
          if (dot < 0) {
            this.velocity.x -= hit.x * dot * 1.35
            this.velocity.z -= hit.z * dot * 1.35
          }
        }
      }
    }
  }

  resolveKarts(karts) {
    for (const other of karts) {
      if (other === this || !other.alive) continue
      const hit = circleVsCircleResolve(this.position.x, this.position.z, PHYSICS.kartRadius, other.position.x, other.position.z, PHYSICS.kartRadius)
      if (!hit) continue
      const push = hit.depth * 0.5
      this.position.x += hit.x * push
      this.position.z += hit.z * push
      other.position.x -= hit.x * push
      other.position.z -= hit.z * push
      const relative = (this.velocity.x - other.velocity.x) * hit.x + (this.velocity.z - other.velocity.z) * hit.z
      if (relative < 0) {
        this.velocity.x -= hit.x * relative * 0.65
        this.velocity.z -= hit.z * relative * 0.65
        other.velocity.x += hit.x * relative * 0.65
        other.velocity.z += hit.z * relative * 0.65
      }
    }
  }

  aimAt(target) {
    this.aimYaw = seqAngle(this.aimYaw, Math.atan2(target.x - this.position.x, target.z - this.position.z), 12)
  }

  getMuzzleWorld(out) {
    this.turret.updateWorldMatrix(true, false)
    return this.muzzle.getWorldPosition(out)
  }

  muzzleDirection(out) {
    return out.set(Math.sin(this.aimYaw), 0.012, Math.cos(this.aimYaw)).normalize()
  }

  takeDamage(amount, attacker) {
    if (!this.alive || this.invulnerable > 0) return false
    this.health -= amount
    this.hitFlash = 0.16
    this.lastAttacker = attacker
    if (this.health <= 0) {
      this.health = 0
      this.die()
      return true
    }
    return false
  }

  heal(amount) {
    this.health = Math.min(COMBAT.maxHealth, this.health + amount)
  }

  die() {
    this.alive = false
    this.shield.visible = false
    this.shieldRing.visible = false
    this.healthBar.visible = false
    this.respawnTimer = COMBAT.respawnDelay
    this.deaths += 1
    this.velocity.set(0, 0, 0)
    this.smokeTimer = 0
    this.wreckTilt = (Math.random() > 0.5 ? 1 : -1) * (0.9 + Math.random() * 0.35)
    for (const flame of this.flames) flame.visible = false
  }

  updateVisual(dt, time, camera) {
    this.root.position.copy(this.position)
    this.root.rotation.y = this.heading

    if (this.hitFlash > 0) {
      this.hitFlash -= dt
      const flash = Math.max(0, this.hitFlash / 0.16)
      for (const material of this.flashMaterials) {
        material.emissive.setRGB(flash, flash, flash)
        material.emissiveIntensity = 1
      }
    } else {
      this.colorMaterial.emissive.copy(this.baseEmissive)
      this.colorMaterial.emissiveIntensity = 0.08
      this.accentMaterial.emissive.setRGB(0, 0, 0)
    }

    if (!this.alive) {
      const blend = Math.min(1, dt * 5)
      this.visual.rotation.z += (this.wreckTilt - this.visual.rotation.z) * blend
      this.visual.rotation.x += (0 - this.visual.rotation.x) * blend
      this.visual.position.y += (-0.32 - this.visual.position.y) * blend
      this.turret.rotation.y += dt * 1.4
      this.underglow.material.opacity *= Math.max(0, 1 - dt * 3)
    }

    if (this.alive) {
      const speedNorm = clamp(Math.abs(this.speed) / PHYSICS.maxSpeed, 0, 1.4)
      const targetLean = -clamp(this.aimYaw - this.heading, -0.6, 0.6) * 0.05 - (this.velocity.length() > 1 ? 0 : 0)
      this.bodyLean += (targetLean - this.bodyLean) * Math.min(1, dt * 8)
      this.visual.rotation.z = this.bodyLean
      this.visual.rotation.x = -speedNorm * 0.012 + Math.sin(time * 8 + this.engineWobble) * 0.006 * speedNorm
      this.visual.position.y = Math.sin(time * 10 + this.engineWobble) * 0.02 * speedNorm

      const spin = this.wheelSpin
      for (const wheel of this.wheels) wheel.spin.rotation.x = spin
      const steerVisual = clamp(this.steerInput ?? 0, -1, 1) * 0.42
      for (const wheel of this.frontWheels) wheel.rotation.y = steerVisual

      this.underglow.material.opacity = 0.32 + Math.sin(time * 5 + this.engineWobble) * 0.1 + (this.boostActive ? 0.28 : 0)
      this.shield.visible = this.invulnerable > 0 && (this.isPlayer || this.invulnerable < 0.5)
      this.shieldRing.visible = this.invulnerable > 0
      if (this.shield.visible) {
        this.shield.rotation.y += dt * 0.7
        this.shield.material.uniforms.uTime.value = time
      }
      if (this.shieldRing.visible) {
        this.shieldRing.rotation.z += dt * 1.8
        this.shieldRing.material.opacity = 0.24 + Math.sin(time * 6) * 0.1
      }

      for (const flame of this.flames) {
        flame.visible = this.boostActive
        if (flame.visible) {
          flame.scale.setScalar(0.75 + Math.random() * 0.65)
          flame.material.opacity = 0.6 + Math.random() * 0.4
        }
      }
      this.turret.rotation.y = this.aimYaw - this.heading
    }

    this.healthBar.visible = this.alive && this.showHealthBar && !this.isPlayer
    if (this.healthBar.visible) {
      const ratio = clamp(this.health / COMBAT.maxHealth, 0, 1)
      this.healthFill.scale.x = Math.max(0.001, ratio)
      this.healthFill.position.x = -(1 - ratio) * 0.89
      this.healthFill.material.color.setHex(ratio > 0.55 ? 0x55e879 : ratio > 0.28 ? 0xffb01f : 0xff4d55)
      this.healthBar.quaternion.copy(camera.quaternion)
    }
  }

  dispose() {
    this.scene.remove(this.root)
    this.root.traverse((object) => {
      if (object.geometry) object.geometry.dispose()
      if (object.material) {
        const materials = Array.isArray(object.material) ? object.material : [object.material]
        for (const material of materials) material.dispose()
      }
    })
  }
}

function seqAngle(current, target, speed) {
  return steerToward(current, target, speed * 0.016)
}

export function runBotAI(bot, dt, karts, colliders, arena) {
  const ai = bot.ai
  const output = { throttle: 0, steer: 0, fire: false, boost: false, overheated: false, aimYaw: bot.aimYaw }
  if (!bot.alive) {
    ai.target = null
    return output
  }

  ai.thinkTimer -= dt
  if (ai.thinkTimer <= 0) {
    ai.thinkTimer = 0.45 + Math.random() * 0.5
    let best = null
    let bestDist = Infinity
    for (const other of karts) {
      if (other === bot || !other.alive) continue
      const dist = bot.position.distanceToSquared(other.position)
      const weight = other.isPlayer ? 0.82 : 1
      if (dist * weight < bestDist) {
        bestDist = dist * weight
        best = other
      }
    }
    ai.target = best
    if (Math.random() < 0.16) ai.strafeDir *= -1
    ai.lineOfSight = best ? hasLineOfSight(bot.position, best.position, colliders) : false
  }

  const target = ai.target
  let moveX = 0
  let moveZ = 0

  if (target && target.alive) {
    const dx = target.position.x - bot.position.x
    const dz = target.position.z - bot.position.z
    const dist = Math.hypot(dx, dz) || 0.001
    const dirX = dx / dist
    const dirZ = dz / dist
    const lead = Math.min(0.7, dist / (COMBAT.projectileSpeed * 1.2)) * ai.aggression
    const predictedX = target.position.x + target.velocity.x * lead
    const predictedZ = target.position.z + target.velocity.z * lead
    const aimAngle = Math.atan2(predictedX - bot.position.x, predictedZ - bot.position.z)
    const sway = Math.sin(performance.now() * 0.0017 + bot.engineWobble) * ai.aimError
    output.aimYaw = steerToward(bot.aimYaw, aimAngle + sway, 4.4 * dt)
    bot.aimYaw = output.aimYaw

    if (dist > ai.preferredRange + 7) {
      moveX = dirX
      moveZ = dirZ
    } else if (dist < ai.preferredRange - 7) {
      moveX = -dirX
      moveZ = -dirZ
    } else {
      const orbitX = -dirZ * ai.strafeDir
      const orbitZ = dirX * ai.strafeDir
      moveX = orbitX + dirX * 0.25
      moveZ = orbitZ + dirZ * 0.25
    }

    const toTarget = Math.abs(angleDelta(bot.heading, Math.atan2(dirX, dirZ)))
    output.fire = ai.lineOfSight && dist < 52 && toTarget < 0.5 && Math.random() > 0.08
    if (bot.boost > 45 && dist > 24 && ai.aggression > 0.6 && bot.boostActive === false) {
      output.boost = Math.random() < 0.02 + ai.aggression * 0.015
    }
  } else {
    ai.wanderTimer -= dt
    if (ai.wanderTimer <= 0) {
      ai.wanderTimer = 2.5 + Math.random() * 3
      const radius = 12 + Math.random() * 22
      const angle = Math.random() * Math.PI * 2
      ai.wander.set(Math.cos(angle) * radius, 0, Math.sin(angle) * radius)
    }
    const dx = ai.wander.x - bot.position.x
    const dz = ai.wander.z - bot.position.z
    const dist = Math.hypot(dx, dz) || 0.001
    moveX = dx / dist
    moveZ = dz / dist
    if (dist < 4) ai.wanderTimer = 0
  }

  const avoid = avoidObstacles(bot, moveX, moveZ, colliders)
  moveX += avoid.x * 1.5
  moveZ += avoid.z * 1.5

  const edge = ARENA.half - 7
  if (Math.abs(bot.position.x) > edge || Math.abs(bot.position.z) > edge) {
    moveX += -bot.position.x * 0.08
    moveZ += -bot.position.z * 0.08
  }

  const separation = separationForce(bot, karts)
  moveX += separation.x * 0.8
  moveZ += separation.z * 0.8

  const moveLength = Math.hypot(moveX, moveZ) || 1
  moveX /= moveLength
  moveZ /= moveLength

  const desiredHeading = Math.atan2(moveX, moveZ)
  const diff = angleDelta(bot.heading, desiredHeading)
  output.steer = clamp(diff * 2.3, -1, 1)

  const speedRatio = Math.abs(bot.speed) / PHYSICS.maxSpeed
  output.throttle = 1
  if (Math.abs(output.steer) > 0.82 && speedRatio > 0.55) output.throttle = 0.22
  if (Math.abs(output.steer) > 0.95 && speedRatio > 0.8) output.throttle = -0.35

  if (ai.reverseTimer > 0) {
    ai.reverseTimer -= dt
    output.throttle = -1
    output.steer = ai.strafeDir
    output.fire = false
  } else if (Math.abs(bot.speed) < 1.6 && output.throttle > 0.4) {
    ai.stuckTimer += dt
    if (ai.stuckTimer > 1.1) {
      ai.stuckTimer = 0
      ai.reverseTimer = 0.85
      ai.strafeDir *= -1
    }
  } else {
    ai.stuckTimer = Math.max(0, ai.stuckTimer - dt * 0.5)
  }

  return output
}

function hasLineOfSight(from, to, colliders) {
  const steps = 10
  for (let i = 1; i < steps; i += 1) {
    const t = i / steps
    const x = from.x + (to.x - from.x) * t
    const z = from.z + (to.z - from.z) * t
    for (const collider of colliders) {
      if (collider.kind === 'reactor' || collider.kind === 'crate' || collider.kind === 'barrel' || collider.kind === 'pillar') {
        if (collider.type === 'circle') {
          const dx = x - collider.x
          const dz = z - collider.z
          if (dx * dx + dz * dz < collider.r * collider.r) return false
        } else if (x > collider.minX && x < collider.maxX && z > collider.minZ && z < collider.maxZ) {
          return false
        }
      }
    }
  }
  return true
}

function avoidObstacles(bot, dirX, dirZ, colliders) {
  let ax = 0
  let az = 0
  const lookX = bot.position.x + dirX * 6
  const lookZ = bot.position.z + dirZ * 6
  for (const collider of colliders) {
    let cx
    let cz
    let radius
    if (collider.type === 'circle') {
      cx = collider.x
      cz = collider.z
      radius = collider.r + 2.4
    } else {
      cx = (collider.minX + collider.maxX) / 2
      cz = (collider.minZ + collider.maxZ) / 2
      radius = Math.max(collider.maxX - collider.minX, collider.maxZ - collider.minZ) / 2 + 2.4
    }
    const dx = lookX - cx
    const dz = lookZ - cz
    const distSq = dx * dx + dz * dz
    if (distSq < radius * radius && distSq > 0.001) {
      const dist = Math.sqrt(distSq)
      const strength = (radius - dist) / radius
      ax += (dx / dist) * strength
      az += (dz / dist) * strength
    }
  }
  return { x: ax, z: az }
}

function separationForce(bot, karts) {
  let x = 0
  let z = 0
  for (const other of karts) {
    if (other === bot || !other.alive) continue
    const dx = bot.position.x - other.position.x
    const dz = bot.position.z - other.position.z
    const distSq = dx * dx + dz * dz
    if (distSq < 36 && distSq > 0.01) {
      const dist = Math.sqrt(distSq)
      x += (dx / dist) * (6 - dist) * 0.2
      z += (dz / dist) * (6 - dist) * 0.2
    }
  }
  return { x, z }
}
