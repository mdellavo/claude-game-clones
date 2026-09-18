import * as THREE from 'three';

const unitBox = new THREE.BoxGeometry(1, 1, 1);

// A voxel model: a Group of boxes that owns its materials (so it can flash independently).
export class VoxelModel {
  constructor() {
    this.group = new THREE.Group();
    this.mats = new Map();
    this.parts = {};
  }

  mat(color, emissive = 0) {
    const key = `${color}:${emissive}`;
    if (!this.mats.has(key)) {
      const m = new THREE.MeshLambertMaterial({ color });
      if (emissive) m.emissive = new THREE.Color(color).multiplyScalar(emissive);
      m.userData.baseEmissive = m.emissive.clone();
      this.mats.set(key, m);
    }
    return this.mats.get(key);
  }

  // box centred at (x, y, z) with size (w, h, d), added to parent (default: root group)
  box(w, h, d, color, x = 0, y = 0, z = 0, parent = null, { emissive = 0, shadow = true, name } = {}) {
    const m = new THREE.Mesh(unitBox, this.mat(color, emissive));
    m.scale.set(w, h, d);
    m.position.set(x, y, z);
    m.castShadow = shadow;
    (parent || this.group).add(m);
    if (name) this.parts[name] = m;
    return m;
  }

  pivot(name, x = 0, y = 0, z = 0, parent = null) {
    const g = new THREE.Group();
    g.position.set(x, y, z);
    (parent || this.group).add(g);
    this.parts[name] = g;
    return g;
  }

  // Set a flash tint: 0 = normal. Cycles through NES-style damage palettes.
  flash(on, t = 0) {
    const palette = [0xffffff, 0xff2020, 0x2040ff, 0xffe040];
    const c = palette[Math.floor(t * 30) % palette.length];
    for (const m of this.mats.values()) {
      if (on) m.emissive.setHex(c).multiplyScalar(0.6);
      else m.emissive.copy(m.userData.baseEmissive);
    }
  }

  setOpacity(a) {
    for (const m of this.mats.values()) {
      m.transparent = a < 1;
      m.opacity = a;
    }
  }

  dispose() {
    for (const m of this.mats.values()) m.dispose();
  }
}
