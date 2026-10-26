import * as THREE from '../vendor/three.module.min.js';

export class Projectile {
  constructor({ origin, dir, owner, rapid }) {
    this.position = origin.clone();
    this.velocity = dir.clone().multiplyScalar(rapid ? 46 : 38);
    this.owner = owner;
    this.rapid = rapid;
    this.damage = rapid ? 12 : 22;
    this.life = 1.6;
    this.alive = true;
    this.trail = [];
    this.mesh = null;
    this.buildMesh();
  }

  buildMesh() {
    const geometry = new THREE.SphereGeometry(this.rapid ? 0.16 : 0.24, 8, 6);
    const material = new THREE.MeshBasicMaterial({
      color: this.rapid ? '#55e6ff' : '#ffe14f'
    });
    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.position.copy(this.position);
    const glow = new THREE.Mesh(
      new THREE.SphereGeometry(this.rapid ? 0.32 : 0.42, 8, 6),
      new THREE.MeshBasicMaterial({ color: this.rapid ? '#55e6ff' : '#ffe14f', transparent: true, opacity: 0.25 })
    );
    this.mesh.add(glow);
  }

  update(dt, game) {
    if (!this.alive) return;
    this.life -= dt;
    if (this.life <= 0) { this.alive = false; return; }
    this.position.addScaledVector(this.velocity, dt);
    this.mesh.position.copy(this.position);

    // gravity slight
    this.velocity.y -= 2.5 * dt;
    this.position.y = Math.max(0.3, this.position.y);

    // collision with world bounds/obstacles
    if (Math.abs(this.position.x) > 38.5 || Math.abs(this.position.z) > 38.5) {
      this.alive = false; game.onProjectileHit(this, null, 'wall'); return;
    }

    // hit karts
    for (const kart of game.karts) {
      if (!kart.alive || kart === this.owner) continue;
      const dx = this.position.x - kart.position.x;
      const dz = this.position.z - kart.position.z;
      const dist = Math.hypot(dx, dz);
      if (dist < 1.5 && Math.abs(this.position.y - 0.9) < 1.4) {
        this.alive = false;
        game.onProjectileHit(this, kart, 'kart');
        return;
      }
    }
  }
}

export class Pickup {
  constructor({ x, z, index }) {
    this.position = new THREE.Vector3(x, 1.1, z);
    this.baseY = 1.1;
    this.active = true;
    this.respawnTimer = 0;
    this.index = index;
    this.mesh = null;
    this.buildMesh();
  }

  buildMesh() {
    const group = new THREE.Group();
    group.position.copy(this.position);

    const box = new THREE.Mesh(
      new THREE.BoxGeometry(1.5, 1.5, 1.5),
      new THREE.MeshStandardMaterial({ color: '#ffe14f', emissive: '#ff8b3d', emissiveIntensity: 0.6, roughness: 0.4, metalness: 0.2 })
    );
    box.rotation.set(Math.PI / 4, 0, Math.PI / 4);
    group.add(box);

    const ribbon = new THREE.Mesh(
      new THREE.TorusGeometry(1.05, 0.12, 8, 24),
      new THREE.MeshBasicMaterial({ color: '#ff4d7d' })
    );
    ribbon.rotation.x = Math.PI / 2;
    group.add(ribbon);

    const glow = new THREE.Mesh(
      new THREE.SphereGeometry(1.35, 12, 8),
      new THREE.MeshBasicMaterial({ color: '#ffe14f', transparent: true, opacity: 0.12, depthWrite: false })
    );
    group.add(glow);

    const q = new THREE.Mesh(
      new THREE.PlaneGeometry(0.9, 0.9),
      new THREE.MeshBasicMaterial({ color: '#fff9ec', transparent: true, opacity: 0.9, side: THREE.DoubleSide })
    );
    q.position.z = 0.76;
    group.add(q);

    this.mesh = group;
    this.box = box;
    this.ribbon = ribbon;
  }

  update(dt, time) {
    if (!this.active) {
      this.respawnTimer -= dt;
      if (this.respawnTimer <= 0) {
        this.active = true;
        this.mesh.visible = true;
      }
      return;
    }
    this.mesh.position.y = this.baseY + Math.sin(time * 2.2 + this.index) * 0.22;
    this.mesh.rotation.y += dt * 1.4;
    this.box.rotation.x += dt * 0.6;
    this.box.rotation.z += dt * 0.4;
  }
}
