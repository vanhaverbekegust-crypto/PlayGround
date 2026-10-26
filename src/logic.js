export const TAU = Math.PI * 2

export function clamp(value, min, max) {
  return value < min ? min : value > max ? max : value
}

export function lerp(a, b, t) {
  return a + (b - a) * t
}

export function damp(current, target, lambda, dt) {
  return lerp(current, target, 1 - Math.exp(-lambda * dt))
}

export function normalizeAngle(angle) {
  let a = angle % TAU
  if (a > Math.PI) a -= TAU
  if (a < -Math.PI) a += TAU
  return a
}

export function angleDelta(from, to) {
  return normalizeAngle(to - from)
}

export function steerToward(current, target, maxStep) {
  const delta = angleDelta(current, target)
  if (Math.abs(delta) <= maxStep) return normalizeAngle(target)
  return normalizeAngle(current + Math.sign(delta) * maxStep)
}

export function ranking(entries) {
  return [...entries].sort((a, b) => {
    if (b.kills !== a.kills) return b.kills - a.kills
    if (a.deaths !== b.deaths) return a.deaths - b.deaths
    if (b.damage !== a.damage) return b.damage - a.damage
    return a.id - b.id
  })
}

export function circlesOverlap(ax, az, ar, bx, bz, br) {
  const dx = ax - bx
  const dz = az - bz
  const rr = ar + br
  return dx * dx + dz * dz <= rr * rr
}

export function resolveCircleAABB(cx, cz, radius, minX, maxX, minZ, maxZ) {
  const nx = clamp(cx, minX, maxX)
  const nz = clamp(cz, minZ, maxZ)
  let dx = cx - nx
  let dz = cz - nz
  let distSq = dx * dx + dz * dz
  if (distSq >= radius * radius) return null

  if (distSq > 1e-8) {
    const dist = Math.sqrt(distSq)
    return { x: dx / dist, z: dz / dist, depth: radius - dist }
  }

  const left = cx - minX
  const right = maxX - cx
  const front = cz - minZ
  const back = maxZ - cz
  const min = Math.min(left, right, front, back)
  if (min === left) return { x: -1, z: 0, depth: radius + left }
  if (min === right) return { x: 1, z: 0, depth: radius + right }
  if (min === front) return { x: 0, z: -1, depth: radius + front }
  return { x: 0, z: 1, depth: radius + back }
}

export function circleVsCircleResolve(cx, cz, radius, ox, oz, oradius) {
  const dx = cx - ox
  const dz = cz - oz
  const rr = radius + oradius
  const distSq = dx * dx + dz * dz
  if (distSq >= rr * rr) return null
  const dist = Math.sqrt(distSq) || 0.0001
  return { x: dx / dist, z: dz / dist, depth: rr - dist }
}

export function formatTime(seconds) {
  const s = Math.max(0, Math.ceil(seconds))
  const m = Math.floor(s / 60)
  return `${m}:${String(s % 60).padStart(2, '0')}`
}

export function placeSuffix(place) {
  if (place % 100 >= 11 && place % 100 <= 13) return 'TH'
  const last = place % 10
  if (last === 1) return 'ST'
  if (last === 2) return 'ND'
  if (last === 3) return 'RD'
  return 'TH'
}
