export class Entity {
  constructor(game, x, z) {
    this.game = game;
    this.x = x;
    this.z = z;
    this.y = 0;
    this.half = 0.35;
    this.dead = false;
    this.model = null;
    this.age = 0;
  }

  attach(model) {
    this.model = model;
    this.game.scene.add(model.group);
    this.syncModel();
  }

  syncModel() {
    if (!this.model) return;
    this.model.group.position.set(this.x, this.y, this.z);
  }

  remove() {
    this.dead = true;
    if (this.model) {
      this.game.scene.remove(this.model.group);
      this.model.dispose();
      this.model = null;
    }
  }

  // Axis-separated move against tiles & bounds. Returns which axes were blocked.
  move(dx, dz, opts = {}) {
    const g = this.game;
    let hitX = false, hitZ = false;
    if (dx) {
      if (!g.boxBlocked(this.x + dx, this.z, this.half, opts)) this.x += dx;
      else hitX = true;
    }
    if (dz) {
      if (!g.boxBlocked(this.x, this.z + dz, this.half, opts)) this.z += dz;
      else hitZ = true;
    }
    return { hitX, hitZ };
  }
}
