import * as THREE from '../vendor/three.module.min.js';

const TAU = Math.PI * 2;

export const KART_COLORS = [
  '#ff4d7d', '#ffd84d', '#51e6a4', '#51c8ff', '#a77bff', '#ff8b3d',
  '#ff8ea8', '#7df0d4'
];

export const BOT_NAMES = [
  'BLITZ', 'VORTEX', 'NOVA', 'RIPPER', 'GHOST', 'TURBO', 'REX', 'PIXEL',
  'ZENITH', 'FURY', 'COMET', 'SHARD'
];

function standard(color, opts = {}) {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: opts.roughness ?? 0.62,
    metalness: opts.metalness ?? 0.05,
    emissive: opts.emissive ?? 0x000000,
    emissiveIntensity: opts.emissiveIntensity ?? 1
  });
}

export class Kart {
  constructor({ name, color, isPlayer, index = 0 }) {
    this.name = name;
    this.color = color;
    this.isPlayer = isPlayer;
    this.index = index;

    this.position = new THREE.Vector3(0, 0, 0);
    this.velocity = new THREE.Vector3(0, 0, 0);
    this.angle = 0;
    this.angularVelocity = 0;

    this.maxHealth = 100;
    this.health = 100;
    this.alive = true;
    this.respawnTimer = 0;
    this.spawnPoint = null;

    this.score = 0;
    this.kills = 0;
    this.deaths = 0;

    this.boost = 1;
    this.boosting = false;
    this.boostCooldown = 0;

    this.powerups = { rapid: 0, triple: 0, shield: 0, speed: 0 };

    this.shootCooldown = 0;
    this.aimAngle = 0; // relative to kart forward? world angle
    this.targetAngle = 0;

    this.invulnerable = 0;
    this.hitFlash = 0;
    this.smashAnim = 0;

    this.aiState = 'seek';
    this.aiTarget = null;
    this.aiTimer = 0;
    this.aiWander = Math.random() * TAU;

    this.group = new THREE.Group();
    this.buildMesh();
  }

  buildMesh() {
    const color = this.color;
    const bodyMat = standard(color, { roughness: 0.5, metalness: 0.12 });
    const darkMat = standard('#1b1838', { roughness: 0.7 });
    const accentMat = standard('#fff2c7', { roughness: 0.5 });
    const wheelMat = standard('#11101f', { roughness: 0.85 });

    const chassis = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.55, 2.6), bodyMat);
    chassis.position.y = 0.45;
    chassis.castShadow = true;
    this.group.add(chassis);

    const hood = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.32, 1.1), bodyMat);
    hood.position.set(0, 0.78, -0.55);
    hood.castShadow = true;
    this.group.add(hood);

    const spoiler = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.12, 0.7), accentMat);
    spoiler.position.set(0, 1.05, 1.05);
    this.group.add(spoiler);
    const spoilerSupport = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.55, 0.12), darkMat);
    spoilerSupport.position.set(-0.7, 0.78, 1.05);
    this.group.add(spoilerSupport);
    const spoilerSupport2 = spoilerSupport.clone();
    spoilerSupport2.position.x = 0.7;
    this.group.add(spoilerSupport2);

    // seat / driver
    const seat = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.25, 0.9), darkMat);
    seat.position.set(0, 0.78, 0.35);
    this.group.add(seat);
    const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.26, 12, 10), standard(color, { roughness: 0.4, metalness: 0.2 }));
    helmet.position.set(0, 1.12, 0.35);
    helmet.castShadow = true;
    this.group.add(helmet);
    const visor = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.12, 0.18), standard('#1b1838', { roughness: 0.3, metalness: 0.3 }));
    visor.position.set(0, 1.14, 0.18);
    this.group.add(visor);

    // wheels
    const wheelGeometry = new THREE.CylinderGeometry(0.32, 0.32, 0.28, 12);
    const wheelPositions = [
      [-1.05, 0.32, -0.95],
      [1.05, 0.32, -0.95],
      [-1.05, 0.32, 0.95],
      [1.05, 0.32, 0.95]
    ];
    this.wheels = [];
    for (const pos of wheelPositions) {
      const wheel = new THREE.Mesh(wheelGeometry, wheelMat);
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(...pos);
      wheel.castShadow = true;
      this.group.add(wheel);
      this.wheels.push(wheel);
    }

    // cannon
    const cannonBase = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 0.35, 10), darkMat);
    cannonBase.position.set(0, 0.95, -1.05);
    this.group.add(cannonBase);
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.13, 1.5, 10), standard('#ffe14f', { roughness: 0.4, metalness: 0.3, emissive: '#ff8b3d', emissiveIntensity: 0.25 }));
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 0.95, -1.75);
    this.group.add(barrel);
    this.barrel = barrel;
    this.cannonBase = cannonBase;

    // shield bubble (hidden)
    const shield = new THREE.Mesh(
      new THREE.SphereGeometry(1.9, 16, 12),
      new THREE.MeshBasicMaterial({ color: '#55e6ff', transparent: true, opacity: 0.22, depthWrite: false })
    );
    shield.position.y = 0.7;
    shield.visible = false;
    this.group.add(shield);
    this.shieldMesh = shield;

    // exhaust
    this.exhaust = new THREE.Group();
    this.exhaust.position.set(0, 0.4, 1.35);
    this.group.add(this.exhaust);

    // name label sprite
    this.label = createLabelSprite(this.name, color);
    this.label.position.set(0, 2.0, 0);
    this.group.add(this.label);
  }

  syncMesh() {
    this.group.position.copy(this.position);
    this.group.rotation.y = this.angle;
    if (this.shieldMesh) this.shieldMesh.visible = this.powerups.shield > 0;
    if (this.hitFlash > 0) {
      const s = 1 + Math.sin(this.hitFlash * 20) * 0.06;
      this.group.scale.setScalar(s);
    } else {
      this.group.scale.setScalar(1);
    }
    // wheels spin
    const speed = this.velocity.length();
    for (const w of this.wheels) w.rotation.x -= speed * 0.06;
    // barrel aim
    if (this.barrel) {
      this.barrel.rotation.y = 0;
      const aimRel = this.aimAngle - this.angle;
      this.cannonBase.rotation.y = aimRel;
      this.barrel.rotation.y = aimRel;
    }
    this.label.quaternion.copy(this.group.parent?.quaternion || new THREE.Quaternion());
  }

  reset(spawn) {
    this.position.set(spawn.x, 0, spawn.z);
    this.velocity.set(0, 0, 0);
    this.angle = spawn.angle;
    this.angularVelocity = 0;
    this.health = this.maxHealth;
    this.alive = true;
    this.respawnTimer = 0;
    this.boost = 1;
    this.boosting = false;
    this.boostCooldown = 0;
    this.powerups = { rapid: 0, triple: 0, shield: 0, speed: 0 };
    this.shootCooldown = 0;
    this.invulnerable = 1.2;
    this.hitFlash = 0;
    this.smashAnim = 0;
    this.spawnPoint = spawn;
    this.group.visible = true;
  }

  update(dt, input, world, game) {
    if (!this.alive) {
      this.respawnTimer -= dt;
      if (this.respawnTimer <= 0) {
        const spawn = this.spawnPoint || world.spawnPoints[this.index % world.spawnPoints.length];
        this.reset(spawn);
        game.onRespawn(this);
      }
      this.group.visible = false;
      return;
    }

    this.invulnerable = Math.max(0, this.invulnerable - dt);
    this.hitFlash = Math.max(0, this.hitFlash - dt);
    this.smashAnim = Math.max(0, this.smashAnim - dt);

    // powerup timers
    for (const key of Object.keys(this.powerups)) {
      if (this.powerups[key] > 0) this.powerups[key] = Math.max(0, this.powerups[key] - dt);
    }

    this.boostCooldown = Math.max(0, this.boostCooldown - dt);
    this.shootCooldown = Math.max(0, this.shootCooldown - dt);

    // input
    const moveX = input.moveX || 0;
    const moveZ = input.moveZ || 0;
    const aimX = input.aimX || 0;
    const aimZ = input.aimZ || 0;
    const shoot = input.shoot || false;
    const boostPressed = input.boost || false;

    // aim
    if (Math.abs(aimX) + Math.abs(aimZ) > 0.15) {
      this.aimAngle = Math.atan2(aimX, aimZ);
    } else {
      // default forward
      this.aimAngle = this.angle;
    }

    // drive
    const speedMul = this.powerups.speed > 0 ? 1.35 : 1;
    const accel = 18 * speedMul;
    const maxSpeed = (this.boosting ? 26 : 16) * speedMul;
    const turnSpeed = 3.6;

    // desired direction from stick
    const stickLen = Math.hypot(moveX, moveZ);
    let inputAngle = null;
    if (stickLen > 0.1) inputAngle = Math.atan2(moveX, moveZ);

    if (inputAngle !== null) {
      // turn toward input direction
      let diff = inputAngle - this.angle;
      while (diff > Math.PI) diff -= TAU;
      while (diff < -Math.PI) diff += TAU;
      const turn = Math.sign(diff) * Math.min(Math.abs(diff), turnSpeed * dt * (0.4 + Math.min(speedMul, 1.5)));
      this.angle += turn;
      // accelerate forward
      const forward = new THREE.Vector3(Math.sin(this.angle), 0, Math.cos(this.angle));
      const speed = this.velocity.dot(forward);
      if (speed < maxSpeed) {
        const add = accel * dt * Math.min(stickLen, 1);
        this.velocity.addScaledVector(forward, add);
      }
    }

    // friction
    const friction = 6.5;
    this.velocity.x *= Math.max(0, 1 - friction * dt);
    this.velocity.z *= Math.max(0, 1 - friction * dt);
    // cap
    const vlen = this.velocity.length();
    if (vlen > maxSpeed) {
      this.velocity.multiplyScalar(maxSpeed / vlen);
    }

    // boost
    this.boosting = false;
    if (boostPressed && this.boost >= 0.05 && this.boostCooldown <= 0) {
      this.boosting = true;
    }
    if (this.boosting) {
      this.boost = Math.max(0, this.boost - dt * 0.9);
      const forward = new THREE.Vector3(Math.sin(this.angle), 0, Math.cos(this.angle));
      this.velocity.addScaledVector(forward, 30 * dt);
      if (this.boost <= 0) { this.boosting = false; this.boostCooldown = 1.2; }
    } else {
      this.boost = Math.min(1, this.boost + dt * 0.35);
    }

    // integrate
    const nextX = this.position.x + this.velocity.x * dt;
    const nextZ = this.position.z + this.velocity.z * dt;

    // collision with world
    let blocked = world.isBlocked(nextX, nextZ, 1.05);
    if (blocked) {
      // slide
      const slideX = world.isBlocked(nextX, this.position.z, 1.05);
      const slideZ = world.isBlocked(this.position.x, nextZ, 1.05);
      if (!slideX) this.position.x = nextX;
      if (!slideZ) this.position.z = nextZ;
      this.velocity.x *= 0.3;
      this.velocity.z *= 0.3;
    } else {
      this.position.x = nextX;
      this.position.z = nextZ;
    }

    // bounds
    this.position.x = Math.max(-38, Math.min(38, this.position.x));
    this.position.z = Math.max(-38, Math.min(38, this.position.z));

    // boost pads
    for (const pad of world.boostPads) {
      const dx = this.position.x - pad.x;
      const dz = this.position.z - pad.z;
      const dist = Math.hypot(dx, dz);
      if (dist < 3.2 && pad.cooldown <= 0) {
        this.boost = Math.min(1, this.boost + 0.45);
        this.velocity.x += Math.sin(pad.rotation) * 0; // noop
        const forward = new THREE.Vector3(Math.sin(this.angle), 0, Math.cos(this.angle));
        this.velocity.addScaledVector(forward, 6);
        pad.cooldown = 1.5;
        game.onBoostPad(this);
      }
    }
    for (const pad of world.boostPads) pad.cooldown = Math.max(0, pad.cooldown - dt);

    // shoot
    if (shoot && this.shootCooldown <= 0) {
      this.fire(game);
    }

    // kart-kart collisions
    for (const other of game.karts) {
      if (other === this || !other.alive) continue;
      const dx = this.position.x - other.position.x;
      const dz = this.position.z - other.position.z;
      const dist = Math.hypot(dx, dz);
      if (dist < 2.1 && dist > 0.01) {
        const push = (2.1 - dist) * 0.5;
        const nx = dx / dist;
        const nz = dz / dist;
        this.position.x += nx * push;
        this.position.z += nz * push;
        other.position.x -= nx * push;
        other.position.z -= nz * push;
        this.velocity.x += nx * 1.5;
        this.velocity.z += nz * 1.5;
        other.velocity.x -= nx * 1.5;
        other.velocity.z -= nz * 1.5;
      }
    }

    this.syncMesh();
  }

  fire(game) {
    const rapid = this.powerups.rapid > 0;
    const triple = this.powerups.triple > 0;
    const cooldown = rapid ? 0.12 : (triple ? 0.22 : 0.32);
    this.shootCooldown = cooldown;

    const baseAngle = this.aimAngle;
    const angles = triple ? [baseAngle - 0.18, baseAngle, baseAngle + 0.18] : [baseAngle];
    for (const a of angles) {
      const origin = new THREE.Vector3(
        this.position.x + Math.sin(a) * 1.9,
        0.95,
        this.position.z + Math.cos(a) * 1.9
      );
      const dir = new THREE.Vector3(Math.sin(a), 0, Math.cos(a));
      game.spawnProjectile(origin, dir, this, rapid);
    }
    game.onShoot(this);
  }

  takeDamage(amount, attacker, game) {
    if (!this.alive) return;
    if (this.invulnerable > 0) return;
    if (this.powerups.shield > 0) {
      this.powerups.shield = 0;
      game.onShieldBlock(this);
      return;
    }
    this.health -= amount;
    this.hitFlash = 0.35;
    if (this.health <= 0) {
      this.health = 0;
      this.die(attacker, game);
    } else {
      game.onHit(this, attacker);
    }
  }

  die(attacker, game) {
    this.alive = false;
    this.deaths++;
    this.respawnTimer = 3.0;
    this.group.visible = false;
    if (attacker && attacker !== this) {
      attacker.score++;
      attacker.kills++;
      game.onSmash(attacker, this);
    }
    game.onDeath(this, attacker);
  }

  collectPickup(pickup, game) {
    const types = ['rapid', 'triple', 'shield', 'speed', 'heal'];
    const choice = types[Math.floor(Math.random() * types.length)];
    if (choice === 'heal') {
      this.health = Math.min(this.maxHealth, this.health + 35);
    } else {
      this.powerups[choice] = choice === 'shield' ? 999 : 8;
    }
    game.onPickup(this, choice);
    pickup.active = false;
    pickup.mesh.visible = false;
    pickup.respawnTimer = 9;
  }
}

function createLabelSprite(name, color) {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, 256, 64);
  ctx.font = 'bold 26px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(40, 14, 176, 36);
  ctx.fillStyle = color;
  ctx.fillText(name, 128, 32);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(2.6, 0.65, 1);
  return sprite;
}

export function makeKartMeshLabel() { return null; }
export function randomBotName(used) {
  const pool = BOT_NAMES.filter(n => !used.has(n));
  return pool[Math.floor(Math.random() * pool.length)] || ('BOT' + Math.floor(Math.random() * 99));
}
