import * as THREE from 'three'
import { ARENA } from './config.js'
import { circlesOverlap, resolveCircleAABB } from './logic.js'

function makeGlow() {
  const size = 128
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
  g.addColorStop(0, 'rgba(255,255,255,1)')
  g.addColorStop(0.35, 'rgba(255,255,255,0.5)')
  g.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, size, size)
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  return texture
}

function makeFloorTexture() {
  const size = 1024
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')

  ctx.fillStyle = '#191533'
  ctx.fillRect(0, 0, size, size)

  for (let i = 0; i < 5200; i += 1) {
    const x = Math.random() * size
    const y = Math.random() * size
    const shade = Math.random()
    ctx.fillStyle = shade > 0.5 ? 'rgba(255,255,255,0.028)' : 'rgba(0,0,0,0.14)'
    ctx.fillRect(x, y, 2 + Math.random() * 2, 2 + Math.random() * 2)
  }

  const cell = size / 16
  ctx.lineWidth = 2
  for (let i = 0; i <= 16; i += 1) {
    const p = i * cell
    ctx.strokeStyle = i % 4 === 0 ? 'rgba(56,232,255,0.2)' : 'rgba(56,232,255,0.075)'
    ctx.beginPath()
    ctx.moveTo(p, 0)
    ctx.lineTo(p, size)
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(0, p)
    ctx.lineTo(size, p)
    ctx.stroke()
  }

  ctx.strokeStyle = 'rgba(255,210,63,0.5)'
  ctx.lineWidth = 8
  ctx.beginPath()
  ctx.arc(size / 2, size / 2, size * 0.175, 0, Math.PI * 2)
  ctx.stroke()
  ctx.strokeStyle = 'rgba(255,210,63,0.18)'
  ctx.lineWidth = 22
  ctx.beginPath()
  ctx.arc(size / 2, size / 2, size * 0.21, 0, Math.PI * 2)
  ctx.stroke()

  ctx.save()
  ctx.translate(size / 2, size / 2)
  ctx.rotate(-Math.PI / 4)
  ctx.fillStyle = 'rgba(255,255,255,0.05)'
  for (let i = -4; i <= 4; i += 1) {
    ctx.fillRect(i * 96 - 28, -size, 30, size * 2)
  }
  ctx.restore()

  ctx.strokeStyle = 'rgba(255,255,255,0.1)'
  ctx.lineWidth = 4
  ctx.strokeRect(16, 16, size - 32, size - 32)

  ctx.font = '900 44px Arial Black, Arial, sans-serif'
  ctx.textAlign = 'center'
  ctx.fillStyle = 'rgba(255,210,63,0.22)'
  ctx.save()
  ctx.translate(size / 2, size / 2 + 12)
  ctx.fillText('SMASH', 0, 0)
  ctx.restore()

  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = 8
  return texture
}

function makeHazardTexture() {
  const w = 512
  const h = 128
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = '#1b1636'
  ctx.fillRect(0, 0, w, h)
  ctx.fillStyle = '#ffb01f'
  const step = 64
  ctx.save()
  ctx.beginPath()
  ctx.rect(0, 0, w, h)
  ctx.clip()
  for (let x = -h; x < w + h; x += step) {
    ctx.beginPath()
    ctx.moveTo(x, h)
    ctx.lineTo(x + h, 0)
    ctx.lineTo(x + h + step / 2, 0)
    ctx.lineTo(x + step / 2, h)
    ctx.closePath()
    ctx.fill()
  }
  ctx.restore()
  ctx.fillStyle = 'rgba(255,255,255,0.16)'
  ctx.fillRect(0, 0, w, 8)
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.wrapS = THREE.RepeatWrapping
  texture.repeat.set(2, 1)
  return texture
}

function makeWindowTexture() {
  const size = 256
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = '#0a0818'
  ctx.fillRect(0, 0, size, size)
  for (let y = 8; y < size; y += 22) {
    for (let x = 8; x < size; x += 22) {
      if (Math.random() > 0.52) {
        const palette = ['#38e8ff', '#ffd23f', '#ff8a1f', '#ff3d9f', '#8a7bff']
        ctx.fillStyle = palette[Math.floor(Math.random() * palette.length)]
        ctx.globalAlpha = 0.35 + Math.random() * 0.55
        ctx.fillRect(x, y, 11, 13)
      }
    }
  }
  ctx.globalAlpha = 1
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  return texture
}

export function createArena(scene) {
  const group = new THREE.Group()
  scene.add(group)

  const colliders = []
  const spawnPoints = []
  const boostPads = []
  const healthSpots = []
  const animated = []

  const glowTexture = makeGlow()
  const floorTexture = makeFloorTexture()
  const hazardTexture = makeHazardTexture()
  const windowTexture = makeWindowTexture()

  const skyMaterial = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      topColor: { value: new THREE.Color('#05030f') },
      midColor: { value: new THREE.Color('#1b1340') },
      horizonColor: { value: new THREE.Color('#642a63') }
    },
    vertexShader: `
      varying vec3 vWorld;
      void main() {
        vec4 world = modelMatrix * vec4(position, 1.0);
        vWorld = normalize(world.xyz);
        gl_Position = projectionMatrix * viewMatrix * world;
      }
    `,
    fragmentShader: `
      uniform vec3 topColor;
      uniform vec3 midColor;
      uniform vec3 horizonColor;
      varying vec3 vWorld;
      void main() {
        float h = clamp(vWorld.y * 0.5 + 0.5, 0.0, 1.0);
        vec3 color = mix(horizonColor, midColor, smoothstep(0.42, 0.62, h));
        color = mix(color, topColor, smoothstep(0.6, 1.0, h));
        gl_FragColor = vec4(color, 1.0);
      }
    `
  })
  const sky = new THREE.Mesh(new THREE.SphereGeometry(320, 32, 16), skyMaterial)
  scene.add(sky)

  const starPositions = new Float32Array(900 * 3)
  for (let i = 0; i < 900; i += 1) {
    const theta = Math.random() * Math.PI * 2
    const y = 0.12 + Math.random() * 0.85
    const r = Math.sqrt(1 - y * y)
    starPositions[i * 3] = Math.cos(theta) * r * 290
    starPositions[i * 3 + 1] = y * 290
    starPositions[i * 3 + 2] = Math.sin(theta) * r * 290
  }
  const starGeometry = new THREE.BufferGeometry()
  starGeometry.setAttribute('position', new THREE.BufferAttribute(starPositions, 3))
  const stars = new THREE.Points(starGeometry, new THREE.PointsMaterial({
    color: 0xbcd8ff,
    size: 1.5,
    sizeAttenuation: true,
    transparent: true,
    opacity: 0.75,
    depthWrite: false
  }))
  scene.add(stars)

  const sunSprite = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowTexture,
    color: 0xff7a3d,
    transparent: true,
    opacity: 0.85,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  }))
  sunSprite.position.set(-150, 62, -210)
  sunSprite.scale.setScalar(120)
  scene.add(sunSprite)

  const outerFloor = new THREE.Mesh(
    new THREE.CircleGeometry(280, 64),
    new THREE.MeshStandardMaterial({ color: 0x0d0a22, roughness: 0.95, metalness: 0.05 })
  )
  outerFloor.rotation.x = -Math.PI / 2
  outerFloor.position.y = -0.12
  outerFloor.receiveShadow = true
  group.add(outerFloor)

  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(ARENA.half * 2 + 3, ARENA.half * 2 + 3),
    new THREE.MeshStandardMaterial({ map: floorTexture, roughness: 0.82, metalness: 0.22 })
  )
  floor.rotation.x = -Math.PI / 2
  floor.position.y = 0
  floor.receiveShadow = true
  group.add(floor)

  const gridGlow = new THREE.Mesh(
    new THREE.RingGeometry(ARENA.half - 1.4, ARENA.half - 0.2, 96),
    new THREE.MeshBasicMaterial({ color: 0x38e8ff, transparent: true, opacity: 0.35, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false })
  )
  gridGlow.rotation.x = -Math.PI / 2
  gridGlow.position.y = 0.03
  group.add(gridGlow)

  const wallMaterial = new THREE.MeshStandardMaterial({ color: 0x241d4c, roughness: 0.55, metalness: 0.45 })
  const wallAccent = new THREE.MeshBasicMaterial({ color: 0x38e8ff })
  const wallAccentPink = new THREE.MeshBasicMaterial({ color: 0xff3d9f })

  const half = ARENA.half
  const wallH = ARENA.wallHeight
  const thickness = ARENA.wallThickness

  const wallSpecs = [
    { x: 0, z: half, w: half * 2 + thickness, d: thickness, accent: wallAccent },
    { x: 0, z: -half, w: half * 2 + thickness, d: thickness, accent: wallAccentPink },
    { x: half, z: 0, w: thickness, d: half * 2 + thickness, accent: wallAccentPink },
    { x: -half, z: 0, w: thickness, d: half * 2 + thickness, accent: wallAccent }
  ]

  for (const spec of wallSpecs) {
    const wall = new THREE.Mesh(new THREE.BoxGeometry(spec.w, wallH, spec.d), wallMaterial)
    wall.position.set(spec.x, wallH / 2, spec.z)
    wall.castShadow = true
    wall.receiveShadow = true
    group.add(wall)

    const strip = new THREE.Mesh(new THREE.BoxGeometry(spec.w, 0.14, 0.18), spec.accent)
    strip.position.set(spec.x, wallH + 0.02, spec.z)
    if (spec.w < spec.d) strip.rotation.y = Math.PI / 2
    group.add(strip)

    const base = new THREE.Mesh(new THREE.BoxGeometry(spec.w, 0.35, spec.d + 0.2), new THREE.MeshStandardMaterial({
      color: 0x140f2c, roughness: 0.7, metalness: 0.4
    }))
    base.position.set(spec.x, 0.17, spec.z)
    base.receiveShadow = true
    group.add(base)
  }

  const corners = [
    [half, half], [-half, half], [half, -half], [-half, -half]
  ]
  for (const [x, z] of corners) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.65, wallH + 3.2, 8), new THREE.MeshStandardMaterial({
      color: 0x2c2458, roughness: 0.45, metalness: 0.6
    }))
    post.position.set(x, (wallH + 3.2) / 2, z)
    post.castShadow = true
    group.add(post)
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.55, 12, 10), new THREE.MeshBasicMaterial({ color: 0xffd23f }))
    lamp.position.set(x, wallH + 3.4, z)
    group.add(lamp)
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowTexture, color: 0xffc23f, transparent: true, opacity: 0.85,
      blending: THREE.AdditiveBlending, depthWrite: false
    }))
    halo.position.set(x, wallH + 3.4, z)
    halo.scale.setScalar(7)
    group.add(halo)
  }

  const crateBody = new THREE.MeshStandardMaterial({ color: 0x2e6f8f, roughness: 0.72, metalness: 0.18 })
  const cratePanel = new THREE.MeshStandardMaterial({ color: 0xf2a93b, roughness: 0.6, metalness: 0.15 })
  const crateDark = new THREE.MeshStandardMaterial({ color: 0x1a1636, roughness: 0.8, metalness: 0.2 })

  function addCrate(x, z, size = 3, y = 0, rot = 0) {
    const crate = new THREE.Group()
    crate.position.set(x, y, z)
    crate.rotation.y = rot

    const box = new THREE.Mesh(new THREE.BoxGeometry(size, size, size), crateBody)
    box.castShadow = true
    box.receiveShadow = true
    crate.add(box)

    const bandGeo = new THREE.BoxGeometry(size + 0.08, size * 0.17, size + 0.08)
    for (const offset of [-size * 0.28, size * 0.28]) {
      const band = new THREE.Mesh(bandGeo, cratePanel)
      band.position.y = offset
      crate.add(band)
    }
    const cross = new THREE.Mesh(new THREE.BoxGeometry(size * 0.16, size * 0.9, size + 0.1), crateDark)
    crate.add(cross)
    const cross2 = new THREE.Mesh(new THREE.BoxGeometry(size + 0.1, size * 0.9, size * 0.16), crateDark)
    crate.add(cross2)

    group.add(crate)
    if (y < 0.5) {
      colliders.push({ type: 'box', minX: x - size / 2, maxX: x + size / 2, minZ: z - size / 2, maxZ: z + size / 2, kind: 'crate' })
    }
    return crate
  }

  const hazardStripeMaterial = new THREE.MeshStandardMaterial({ map: hazardTexture, roughness: 0.6, metalness: 0.1, side: THREE.DoubleSide })
  const barrelSide = new THREE.MeshStandardMaterial({ color: 0xd94a2c, roughness: 0.6, metalness: 0.25 })
  const barrelBand = new THREE.MeshStandardMaterial({ color: 0x1d1736, roughness: 0.55, metalness: 0.4 })

  function addBarrel(x, z, r = 1.15, h = 2.3) {
    const barrel = new THREE.Group()
    barrel.position.set(x, 0, z)
    const body = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 14), barrelSide)
    body.position.y = h / 2
    body.castShadow = true
    body.receiveShadow = true
    barrel.add(body)
    for (const y of [h * 0.24, h * 0.52, h * 0.8]) {
      const band = new THREE.Mesh(new THREE.CylinderGeometry(r + 0.06, r + 0.06, h * 0.1, 14), barrelBand)
      band.position.y = y
      barrel.add(band)
    }
    const top = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.94, r * 0.94, 0.14, 14), barrelBand)
    top.position.y = h + 0.02
    barrel.add(top)
    group.add(barrel)
    colliders.push({ type: 'circle', x, z, r: r + 0.15, kind: 'barrel' })
    return barrel
  }

  function addBarrier(x, z, rot = 0) {
    const w = 8
    const d = 1.5
    const barrier = new THREE.Group()
    barrier.position.set(x, 0, z)
    barrier.rotation.y = rot
    const body = new THREE.Mesh(new THREE.BoxGeometry(w, 1.6, d), new THREE.MeshStandardMaterial({
      color: 0x3a3266, roughness: 0.6, metalness: 0.3
    }))
    body.position.y = 0.8
    body.castShadow = true
    body.receiveShadow = true
    barrier.add(body)

    const stripe = new THREE.Mesh(new THREE.PlaneGeometry(w, 0.62), hazardStripeMaterial)
    stripe.position.set(0, 0.92, d / 2 + 0.02)
    barrier.add(stripe)
    const stripeBack = stripe.clone()
    stripeBack.position.z = -d / 2 - 0.02
    stripeBack.rotation.y = Math.PI
    barrier.add(stripeBack)

    const cap = new THREE.Mesh(new THREE.BoxGeometry(w + 0.15, 0.14, d + 0.15), new THREE.MeshBasicMaterial({ color: 0xffd23f }))
    cap.position.y = 1.62
    barrier.add(cap)

    group.add(barrier)
    const cos = Math.abs(Math.cos(rot))
    const sin = Math.abs(Math.sin(rot))
    const halfW = (w / 2) * cos + (d / 2) * sin
    const halfD = (w / 2) * sin + (d / 2) * cos
    colliders.push({ type: 'box', minX: x - halfW, maxX: x + halfW, minZ: z - halfD, maxZ: z + halfD, kind: 'barrier' })
    return barrier
  }

  function addPillar(x, z) {
    const pillar = new THREE.Group()
    pillar.position.set(x, 0, z)
    const base = new THREE.Mesh(new THREE.CylinderGeometry(2.1, 2.5, 0.7, 10), new THREE.MeshStandardMaterial({
      color: 0x241d4c, roughness: 0.55, metalness: 0.45
    }))
    base.position.y = 0.35
    base.castShadow = true
    base.receiveShadow = true
    pillar.add(base)

    const column = new THREE.Mesh(new THREE.CylinderGeometry(1.45, 1.7, 7.5, 10), new THREE.MeshStandardMaterial({
      color: 0x3b3270, roughness: 0.5, metalness: 0.5
    }))
    column.position.y = 4.1
    column.castShadow = true
    pillar.add(column)

    const ringMaterial = new THREE.MeshBasicMaterial({ color: 0x38e8ff })
    for (const y of [1.2, 4.2, 7.4]) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(1.62, 0.09, 6, 20), ringMaterial)
      ring.rotation.x = Math.PI / 2
      ring.position.y = y
      pillar.add(ring)
    }
    const top = new THREE.Mesh(new THREE.SphereGeometry(0.55, 12, 10), new THREE.MeshBasicMaterial({ color: 0x38e8ff }))
    top.position.y = 8.1
    pillar.add(top)
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowTexture, color: 0x38e8ff, transparent: true, opacity: 0.8,
      blending: THREE.AdditiveBlending, depthWrite: false
    }))
    halo.position.y = 8.1
    halo.scale.setScalar(8)
    pillar.add(halo)

    group.add(pillar)
    colliders.push({ type: 'circle', x, z, r: 2.35, kind: 'pillar' })
    return pillar
  }

  addPillar(24, 24)
  addPillar(-24, 24)
  addPillar(24, -24)
  addPillar(-24, -24)

  addCrate(12, 0, 3, 0, 0.15)
  addCrate(12.1, 0, 2.2, 3, 0.7)
  addCrate(-12, 0, 3, 0, -0.2)
  addCrate(0, 12, 3, 0, Math.PI / 4)
  addCrate(0, -12, 3, 0, Math.PI / 3)
  addCrate(0, -12.2, 2.4, 3, 0)

  addBarrel(31, 17)
  addBarrel(33.2, 14.5)
  addBarrel(30.2, 13.4)
  addBarrel(-31, 17)
  addBarrel(-33.2, 14.5)
  addBarrel(-31, -17)
  addBarrel(-33.2, -14.5)
  addBarrel(31, -17)
  addBarrel(33.2, -14.5)

  addBarrier(10, 32, 0)
  addBarrier(-10, -32, 0)
  addBarrier(32, -10, Math.PI / 2)
  addBarrier(-32, 10, Math.PI / 2)
  addBarrier(18, -31, 0.25)
  addBarrier(-18, 31, 0.25)

  const reactor = new THREE.Group()
  const reactorBase = new THREE.Mesh(new THREE.CylinderGeometry(5.2, 5.8, 0.9, 24), new THREE.MeshStandardMaterial({
    color: 0x231b4c, roughness: 0.5, metalness: 0.55
  }))
  reactorBase.position.y = 0.45
  reactorBase.castShadow = true
  reactorBase.receiveShadow = true
  reactor.add(reactorBase)

  const reactorRingMat = new THREE.MeshBasicMaterial({ color: 0xff8a1f })
  for (const y of [0.95, 1.5]) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(5.1, 0.1, 6, 40), reactorRingMat)
    ring.rotation.x = Math.PI / 2
    ring.position.y = y
    reactor.add(ring)
  }

  const core = new THREE.Mesh(new THREE.IcosahedronGeometry(1.6, 1), new THREE.MeshBasicMaterial({ color: 0xffd23f }))
  core.position.y = 4.6
  reactor.add(core)
  const coreGlow = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowTexture, color: 0xffb01f, transparent: true, opacity: 0.9,
    blending: THREE.AdditiveBlending, depthWrite: false
  }))
  coreGlow.position.y = 4.6
  coreGlow.scale.setScalar(13)
  reactor.add(coreGlow)

  const orbit = new THREE.Group()
  orbit.position.y = 4.6
  const orbitRing = new THREE.Mesh(new THREE.TorusGeometry(2.6, 0.08, 6, 48), new THREE.MeshBasicMaterial({ color: 0x38e8ff }))
  orbit.add(orbitRing)
  const orbitRing2 = new THREE.Mesh(new THREE.TorusGeometry(3.2, 0.05, 6, 48), new THREE.MeshBasicMaterial({ color: 0xff3d9f }))
  orbitRing2.rotation.x = Math.PI / 2.4
  orbit.add(orbitRing2)
  reactor.add(orbit)

  const reactorLight = new THREE.PointLight(0xff8a1f, 60, 40, 2)
  reactorLight.position.set(0, 5, 0)
  reactor.add(reactorLight)
  group.add(reactor)
  colliders.push({ type: 'circle', x: 0, z: 0, r: 5.55, kind: 'reactor' })

  animated.push((dt, time) => {
    core.rotation.y += dt * 0.8
    core.rotation.x = Math.sin(time * 0.7) * 0.2
    coreGlow.scale.setScalar(12 + Math.sin(time * 3) * 1.4)
    orbit.rotation.y += dt * 1.2
    orbitRing2.rotation.z += dt * 0.9
    reactorLight.intensity = 52 + Math.sin(time * 4) * 12
    gridGlow.material.opacity = 0.25 + Math.sin(time * 1.8) * 0.08
  })

  const padMaterial = new THREE.MeshBasicMaterial({ color: 0xffd23f, transparent: true, opacity: 0.9, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false })
  const chevronShape = new THREE.Shape()
  chevronShape.moveTo(-1.1, -0.35)
  chevronShape.lineTo(0, 0.6)
  chevronShape.lineTo(1.1, -0.35)
  chevronShape.lineTo(1.1, 0.05)
  chevronShape.lineTo(0, 1.0)
  chevronShape.lineTo(-1.1, 0.05)
  chevronShape.closePath()
  const chevronGeometry = new THREE.ShapeGeometry(chevronShape)
  const padPositions = [[18, 18], [-18, 18], [18, -18], [-18, -18]]
  for (const [x, z] of padPositions) {
    const pad = new THREE.Group()
    pad.position.set(x, 0.03, z)
    const glow = new THREE.Mesh(new THREE.CircleGeometry(2.4, 24), new THREE.MeshBasicMaterial({
      map: glowTexture, color: 0xffd23f, transparent: true, opacity: 0.18,
      blending: THREE.AdditiveBlending, depthWrite: false
    }))
    glow.rotation.x = -Math.PI / 2
    pad.add(glow)
    const chevrons = []
    for (let i = 0; i < 2; i += 1) {
      const chevron = new THREE.Mesh(chevronGeometry, padMaterial)
      chevron.rotation.x = -Math.PI / 2
      chevron.scale.setScalar(0.7)
      chevron.position.z = 0.5 - i * 1.2
      pad.add(chevron)
      chevrons.push(chevron)
    }
    group.add(pad)
    boostPads.push({ x, z, radius: 2.4, cooldown: 0 })
    animated.push((dt, time) => {
      chevrons[0].position.z = 0.5 + Math.sin(time * 2.5) * 0.22
      chevrons[1].position.z = -0.7 + Math.sin(time * 2.5) * 0.22
      glow.material.opacity = 0.13 + Math.sin(time * 3) * 0.05
    })
  }

  const healthPositions = [[0, 34], [34, 0], [0, -34], [-34, 0]]
  for (const [x, z] of healthPositions) {
    healthSpots.push({ x, z, radius: 1.9 })
  }

  const spawnCandidates = []
  for (let i = 0; i < 16; i += 1) {
    const angle = (i / 16) * Math.PI * 2 + Math.PI / 16
    spawnCandidates.push({ x: Math.cos(angle) * 28, z: Math.sin(angle) * 28, angle: angle + Math.PI })
  }
  for (const candidate of spawnCandidates) {
    let blocked = false
    for (const c of colliders) {
      if (c.type === 'circle' && circlesOverlap(candidate.x, candidate.z, 3, c.x, c.z, c.r)) blocked = true
      if (c.type === 'box' && resolveCircleAABB(candidate.x, candidate.z, 3, c.minX, c.maxX, c.minZ, c.maxZ)) blocked = true
    }
    if (!blocked) spawnPoints.push(candidate)
  }
  if (spawnPoints.length < 8) {
    for (const candidate of spawnCandidates) {
      if (!spawnPoints.includes(candidate)) spawnPoints.push(candidate)
      if (spawnPoints.length >= 8) break
    }
  }

  const buildingMaterial = new THREE.MeshStandardMaterial({
    color: 0x151033,
    roughness: 0.85,
    metalness: 0.15,
    map: windowTexture,
    emissiveMap: windowTexture,
    emissive: 0xffffff,
    emissiveIntensity: 0.3
  })
  const buildingGeometry = new THREE.BoxGeometry(1, 1, 1)
  const buildingCount = 44
  const buildings = new THREE.InstancedMesh(buildingGeometry, buildingMaterial, buildingCount)
  buildings.frustumCulled = false
  const dummy = new THREE.Object3D()
  const beaconData = []
  for (let i = 0; i < buildingCount; i += 1) {
    const angle = (i / buildingCount) * Math.PI * 2 + Math.random() * 0.05
    const radius = 75 + Math.random() * 55
    const height = 10 + Math.random() * 42
    const width = 7 + Math.random() * 12
    const depth = 7 + Math.random() * 12
    dummy.position.set(Math.cos(angle) * radius, height / 2 - 1, Math.sin(angle) * radius)
    dummy.scale.set(width, height, depth)
    dummy.rotation.y = Math.random() * 0.3
    dummy.updateMatrix()
    buildings.setMatrixAt(i, dummy.matrix)
    if (height > 30) beaconData.push({ x: dummy.position.x, y: height + 0.4, z: dummy.position.z, color: Math.random() > 0.5 ? 0xff3d9f : 0x38e8ff })
  }
  buildings.instanceMatrix.needsUpdate = true
  group.add(buildings)

  if (beaconData.length) {
    const beaconGeometry = new THREE.SphereGeometry(0.35, 6, 6)
    const beaconMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff })
    const beacons = new THREE.InstancedMesh(beaconGeometry, beaconMaterial, beaconData.length)
    beacons.frustumCulled = false
    const color = new THREE.Color()
    beaconData.forEach((data, index) => {
      dummy.position.set(data.x, data.y, data.z)
      dummy.scale.set(1, 1, 1)
      dummy.rotation.set(0, 0, 0)
      dummy.updateMatrix()
      beacons.setMatrixAt(index, dummy.matrix)
      beacons.setColorAt(index, color.set(data.color))
    })
    beacons.instanceMatrix.needsUpdate = true
    if (beacons.instanceColor) beacons.instanceColor.needsUpdate = true
    group.add(beacons)
  }

  const hemi = new THREE.HemisphereLight(0x9d8bff, 0x201437, 1.15)
  scene.add(hemi)

  const sun = new THREE.DirectionalLight(0xffe0b8, 2.35)
  sun.position.set(42, 70, 26)
  sun.castShadow = true
  sun.shadow.mapSize.set(2048, 2048)
  sun.shadow.camera.left = -62
  sun.shadow.camera.right = 62
  sun.shadow.camera.top = 62
  sun.shadow.camera.bottom = -62
  sun.shadow.camera.near = 5
  sun.shadow.camera.far = 180
  sun.shadow.bias = -0.0006
  sun.shadow.normalBias = 0.05
  scene.add(sun)
  scene.add(sun.target)

  const rim = new THREE.DirectionalLight(0x38e8ff, 0.85)
  rim.position.set(-30, 22, -45)
  scene.add(rim)

  const fill = new THREE.DirectionalLight(0xff3d9f, 0.42)
  fill.position.set(25, 12, -35)
  scene.add(fill)

  scene.fog = new THREE.Fog(0x171034, 85, 205)

  return {
    group,
    colliders,
    spawnPoints,
    boostPads,
    healthSpots,
    update(dt, time) {
      for (const fn of animated) fn(dt, time)
      sun.target.position.set(0, 0, 0)
    }
  }
}
