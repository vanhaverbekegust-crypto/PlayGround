import * as THREE from 'three'

function makeGlowTexture() {
  const size = 128
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
  gradient.addColorStop(0, 'rgba(255,255,255,1)')
  gradient.addColorStop(0.25, 'rgba(255,255,255,0.85)')
  gradient.addColorStop(0.55, 'rgba(255,255,255,0.25)')
  gradient.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, size, size)
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  return texture
}

const PARTICLE_VERTEX = `
  attribute float aSize;
  attribute float aAlpha;
  attribute vec3 aColor;
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    vColor = aColor;
    vAlpha = aAlpha;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = aSize * (320.0 / max(0.001, -mv.z));
    gl_Position = projectionMatrix * mv;
  }
`

const PARTICLE_FRAGMENT = `
  uniform sampler2D uMap;
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    vec4 tex = texture2D(uMap, gl_PointCoord);
    gl_FragColor = vec4(vColor, vAlpha * tex.a);
  }
`

const tmpColor = new THREE.Color()

export class Effects {
  constructor(scene) {
    this.scene = scene
    this.texture = makeGlowTexture()
    this.maxParticles = 1100
    this.cursor = 0

    this.positions = new Float32Array(this.maxParticles * 3)
    this.colors = new Float32Array(this.maxParticles * 3)
    this.sizes = new Float32Array(this.maxParticles)
    this.alphas = new Float32Array(this.maxParticles)
    this.velocities = new Float32Array(this.maxParticles * 3)
    this.life = new Float32Array(this.maxParticles)
    this.maxLife = new Float32Array(this.maxParticles)
    this.gravity = new Float32Array(this.maxParticles)
    this.drag = new Float32Array(this.maxParticles)
    this.baseSize = new Float32Array(this.maxParticles)

    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3))
    geometry.setAttribute('aColor', new THREE.BufferAttribute(this.colors, 3))
    geometry.setAttribute('aSize', new THREE.BufferAttribute(this.sizes, 1))
    geometry.setAttribute('aAlpha', new THREE.BufferAttribute(this.alphas, 1))
    geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 500)

    const material = new THREE.ShaderMaterial({
      uniforms: { uMap: { value: this.texture } },
      vertexShader: PARTICLE_VERTEX,
      fragmentShader: PARTICLE_FRAGMENT,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    })
    this.points = new THREE.Points(geometry, material)
    this.points.frustumCulled = false
    this.points.renderOrder = 3
    scene.add(this.points)
    this.geometry = geometry

    this.rings = []
    this.flashes = []
    this.flashPool = []
    for (let i = 0; i < 16; i += 1) {
      const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
        map: this.texture,
        color: 0xffffff,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      }))
      sprite.visible = false
      sprite.renderOrder = 4
      scene.add(sprite)
      this.flashPool.push(sprite)
    }
  }

  spawn(x, y, z, options = {}) {
    const count = options.count ?? 8
    const color = options.color ?? 0xffd23f
    const speed = options.speed ?? 8
    const spread = options.spread ?? 1
    const size = options.size ?? 2.2
    const life = options.life ?? 0.6
    const gravity = options.gravity ?? 10
    const drag = options.drag ?? 2.2
    const up = options.up ?? 0.35

    for (let i = 0; i < count; i += 1) {
      const index = this.cursor
      this.cursor = (this.cursor + 1) % this.maxParticles

      const theta = Math.random() * Math.PI * 2
      const phi = Math.acos(2 * Math.random() - 1)
      const dirX = Math.sin(phi) * Math.cos(theta)
      const dirY = Math.cos(phi)
      const dirZ = Math.sin(phi) * Math.sin(theta)
      const power = speed * (0.35 + Math.random() * 0.85)

      this.positions[index * 3] = x + dirX * spread * Math.random()
      this.positions[index * 3 + 1] = y + dirY * spread * Math.random()
      this.positions[index * 3 + 2] = z + dirZ * spread * Math.random()
      this.velocities[index * 3] = dirX * power
      this.velocities[index * 3 + 1] = Math.abs(dirY) * power * up + (options.rise ?? 0)
      this.velocities[index * 3 + 2] = dirZ * power

      tmpColor.set(color)
      if (options.color2 !== undefined && Math.random() > 0.5) tmpColor.set(options.color2)
      this.colors[index * 3] = tmpColor.r
      this.colors[index * 3 + 1] = tmpColor.g
      this.colors[index * 3 + 2] = tmpColor.b

      const scale = size * (0.55 + Math.random() * 0.9)
      this.baseSize[index] = scale
      this.sizes[index] = scale
      this.alphas[index] = 1
      this.life[index] = life * (0.6 + Math.random() * 0.8)
      this.maxLife[index] = this.life[index]
      this.gravity[index] = gravity
      this.drag[index] = drag
    }
  }

  trail(x, y, z, color, size = 1.4) {
    const index = this.cursor
    this.cursor = (this.cursor + 1) % this.maxParticles
    this.positions[index * 3] = x + (Math.random() - 0.5) * 0.18
    this.positions[index * 3 + 1] = y + (Math.random() - 0.5) * 0.18
    this.positions[index * 3 + 2] = z + (Math.random() - 0.5) * 0.18
    this.velocities[index * 3] = (Math.random() - 0.5) * 0.6
    this.velocities[index * 3 + 1] = (Math.random() - 0.5) * 0.6 + 0.6
    this.velocities[index * 3 + 2] = (Math.random() - 0.5) * 0.6
    tmpColor.set(color)
    this.colors[index * 3] = tmpColor.r
    this.colors[index * 3 + 1] = tmpColor.g
    this.colors[index * 3 + 2] = tmpColor.b
    this.baseSize[index] = size
    this.sizes[index] = size
    this.alphas[index] = 0.9
    this.life[index] = 0.28
    this.maxLife[index] = 0.28
    this.gravity[index] = 0
    this.drag[index] = 5
  }

  ring(x, z, color, startRadius = 0.6, endRadius = 8, life = 0.42, y = 0.08) {
    const geometry = new THREE.RingGeometry(0.82, 1, 48)
    const material = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.95,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    })
    const mesh = new THREE.Mesh(geometry, material)
    mesh.rotation.x = -Math.PI / 2
    mesh.position.set(x, y, z)
    mesh.scale.setScalar(startRadius)
    mesh.renderOrder = 2
    this.scene.add(mesh)
    this.rings.push({ mesh, life, maxLife: life, startRadius, endRadius })
  }

  flash(x, y, z, color, size = 6, life = 0.28, sprite = null) {
    const target = sprite || this.flashPool.find((item) => !item.visible)
    if (!target) return null
    target.visible = true
    target.position.set(x, y, z)
    target.material.color.set(color)
    target.material.opacity = 1
    target.scale.setScalar(size)
    target.userData.life = life
    target.userData.maxLife = life
    target.userData.size = size
    return target
  }

  muzzle(x, y, z, color) {
    this.flash(x, y, z, color, 1.9, 0.09)
  }

  impact(x, y, z, color) {
    this.spawn(x, y, z, { count: 14, color, color2: 0xffffff, speed: 12, size: 1.4, life: 0.4, gravity: 16, spread: 0.25 })
    this.flash(x, y, z, color, 2.6, 0.16)
  }

  explosion(x, y, z, color) {
    this.spawn(x, y, z, { count: 42, color, color2: 0xfff2a8, speed: 17, size: 3.4, life: 0.85, gravity: 14, spread: 0.6, rise: 1.5 })
    this.spawn(x, y, z, { count: 22, color: 0x2a2440, speed: 7, size: 6, life: 1.4, gravity: -1.2, spread: 1.1, drag: 1.6 })
    this.ring(x, z, color, 0.8, 13, 0.5)
    this.ring(x, z, 0xffffff, 0.4, 8, 0.34)
    this.flash(x, y + 1, z, 0xfff2a8, 18, 0.4)
  }

  update(dt) {
    const pos = this.positions
    const vel = this.velocities
    for (let i = 0; i < this.maxParticles; i += 1) {
      if (this.life[i] <= 0) {
        this.alphas[i] = 0
        this.sizes[i] = 0
        continue
      }
      this.life[i] -= dt
      if (this.life[i] <= 0) {
        this.alphas[i] = 0
        this.sizes[i] = 0
        continue
      }
      const dragFactor = Math.exp(-this.drag[i] * dt)
      vel[i * 3] *= dragFactor
      vel[i * 3 + 1] = vel[i * 3 + 1] * dragFactor - this.gravity[i] * dt
      vel[i * 3 + 2] *= dragFactor
      pos[i * 3] += vel[i * 3] * dt
      pos[i * 3 + 1] += vel[i * 3 + 1] * dt
      pos[i * 3 + 2] += vel[i * 3 + 2] * dt
      if (pos[i * 3 + 1] < 0.06) {
        pos[i * 3 + 1] = 0.06
        vel[i * 3 + 1] *= -0.32
        vel[i * 3] *= 0.72
        vel[i * 3 + 2] *= 0.72
      }
      const t = this.life[i] / this.maxLife[i]
      this.alphas[i] = Math.min(1, t * 1.5)
      this.sizes[i] = this.baseSize[i] * (0.35 + t * 0.9)
    }

    const posAttr = this.geometry.getAttribute('position')
    const colorAttr = this.geometry.getAttribute('aColor')
    const sizeAttr = this.geometry.getAttribute('aSize')
    const alphaAttr = this.geometry.getAttribute('aAlpha')
    posAttr.needsUpdate = true
    colorAttr.needsUpdate = true
    sizeAttr.needsUpdate = true
    alphaAttr.needsUpdate = true

    for (let i = this.rings.length - 1; i >= 0; i -= 1) {
      const ring = this.rings[i]
      ring.life -= dt
      if (ring.life <= 0) {
        this.scene.remove(ring.mesh)
        ring.mesh.geometry.dispose()
        ring.mesh.material.dispose()
        this.rings.splice(i, 1)
        continue
      }
      const t = 1 - ring.life / ring.maxLife
      const eased = 1 - Math.pow(1 - t, 2)
      const radius = ring.startRadius + (ring.endRadius - ring.startRadius) * eased
      ring.mesh.scale.setScalar(radius)
      ring.mesh.material.opacity = (1 - t) * 0.95
    }

    for (const flash of this.flashPool) {
      if (!flash.visible) continue
      flash.userData.life -= dt
      if (flash.userData.life <= 0) {
        flash.visible = false
        flash.material.opacity = 0
        continue
      }
      const t = flash.userData.life / flash.userData.maxLife
      flash.material.opacity = t
      flash.scale.setScalar(flash.userData.size * (1.2 - t * 0.25))
    }
  }
}
