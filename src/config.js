export const KART_COLORS = [
  { id: 'volt', name: 'VOLT', hex: 0xffd23f, css: '#ffd23f' },
  { id: 'blaze', name: 'BLAZE', hex: 0xff4d55, css: '#ff4d55' },
  { id: 'frost', name: 'FROST', hex: 0x38e8ff, css: '#38e8ff' },
  { id: 'toxin', name: 'TOXIN', hex: 0x55e879, css: '#55e879' },
  { id: 'nova', name: 'NOVA', hex: 0xff3d9f, css: '#ff3d9f' },
  { id: 'ghost', name: 'GHOST', hex: 0xc9d4ff, css: '#c9d4ff' },
  { id: 'ember', name: 'EMBER', hex: 0xff8a1f, css: '#ff8a1f' },
  { id: 'violet', name: 'VIOLET', hex: 0xa06bff, css: '#a06bff' }
]

export const BOT_NAMES = ['RIPTIDE', 'MAGNUM', 'JOLT', 'CINDER', 'PIXEL', 'HAVOC', 'ZEPHYR', 'NITRO', 'BOLT', 'WRENCH']

export const ARENA = {
  half: 46,
  wallHeight: 2.4,
  wallThickness: 1.6
}

export const PHYSICS = {
  maxSpeed: 34,
  reverseSpeed: 13,
  accel: 42,
  brake: 60,
  drag: 1.35,
  grip: 7.5,
  turnRate: 2.65,
  kartRadius: 1.55,
  boostSpeed: 50,
  boostAccel: 92,
  boostDrain: 34,
  boostRegen: 7.5,
  boostMin: 12
}

export const COMBAT = {
  maxHealth: 100,
  fireCooldown: 0.19,
  projectileSpeed: 74,
  projectileDamage: 15,
  projectileLife: 2.4,
  projectileRadius: 0.42,
  spread: 0.012,
  hitShake: 0.32,
  respawnDelay: 3.0,
  spawnProtection: 1.6
}

export const MATCH = {
  duration: 150,
  countdown: 3,
  playerName: 'YOU'
}

export const PLAYER_START = { x: 0, z: 30 }
