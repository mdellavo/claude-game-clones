const BINDINGS = {
  up: ['ArrowUp', 'KeyW', 'KeyX'],
  down: ['ArrowDown', 'KeyS', 'KeyZ'],
  left: ['ArrowLeft', 'KeyA'],
  right: ['ArrowRight', 'KeyD'],
  fire: ['Space', 'KeyJ', 'KeyC'],
  bomb: ['ShiftLeft', 'ShiftRight', 'KeyK', 'KeyB'],
  confirm: ['Enter', 'NumpadEnter'],
  pause: ['KeyP', 'Escape'],
  camera: ['KeyV'],
  mute: ['KeyM'],
};

export class Input {
  constructor() {
    this.down = new Set();
    this.pressed = new Set();
    this.anyKey = false;
    window.addEventListener('keydown', (e) => {
      if (Object.values(BINDINGS).some((b) => b.includes(e.code))) e.preventDefault();
      if (!e.repeat) {
        this.pressed.add(e.code);
        this.anyKey = true;
      }
      this.down.add(e.code);
    });
    window.addEventListener('keyup', (e) => this.down.delete(e.code));
    window.addEventListener('blur', () => this.down.clear());
    this.padPrev = {};
    this.touchHeld = new Set();
    this.touchHit = new Set();
    for (const el of document.querySelectorAll('[data-action]')) {
      const action = el.dataset.action;
      const release = () => this.touchHeld.delete(action);
      el.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        el.setPointerCapture?.(e.pointerId);
        this.touchHeld.add(action);
        this.touchHit.add(action);
        this.anyKey = true;
      });
      el.addEventListener('pointerup', release);
      el.addEventListener('pointercancel', release);
      el.addEventListener('lostpointercapture', release);
    }
  }

  held(action) {
    return BINDINGS[action].some((k) => this.down.has(k)) || this.touchHeld.has(action) || this.padHeld(action);
  }

  hit(action) {
    return BINDINGS[action].some((k) => this.pressed.has(k)) || this.touchHit.has(action) || this.padHit(action);
  }

  pad() {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    for (const p of pads) if (p && p.connected) return p;
    return null;
  }

  padState(action) {
    const p = this.pad();
    if (!p) return 0;
    const b = (i) => (p.buttons[i] ? p.buttons[i].value : 0);
    const ax = p.axes[0] || 0;
    switch (action) {
      case 'up': return Math.max(b(0), b(7), b(12));
      case 'down': return Math.max(b(2), b(6), b(13));
      case 'left': return Math.max(ax < -0.25 ? -ax : 0, b(14));
      case 'right': return Math.max(ax > 0.25 ? ax : 0, b(15));
      case 'fire': return b(1);
      case 'bomb': return Math.max(b(3), b(5));
      case 'confirm': return Math.max(b(9), b(0));
      case 'pause': return b(8);
      case 'camera': return b(4);
      default: return 0;
    }
  }

  padHeld(action) {
    return this.padState(action) > 0.3;
  }

  padHit(action) {
    return this.padHeld(action) && !this.padPrev[action];
  }

  axis() {
    const p = this.pad();
    let steer = (this.held('right') ? 1 : 0) - (this.held('left') ? 1 : 0);
    if (p && Math.abs(p.axes[0]) > 0.25) steer = p.axes[0];
    let throttle = (this.held('up') ? 1 : 0) - (this.held('down') ? 1 : 0);
    return { steer: Math.max(-1, Math.min(1, steer)), throttle };
  }

  endFrame() {
    this.pressed.clear();
    this.touchHit.clear();
    this.anyKey = false;
    for (const a of Object.keys(BINDINGS)) this.padPrev[a] = this.padHeld(a);
  }
}
