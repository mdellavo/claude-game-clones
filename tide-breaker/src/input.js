const STEER_LEFT = ['ArrowLeft', 'KeyA'];
const STEER_RIGHT = ['ArrowRight', 'KeyD'];
const THROTTLE = ['ArrowUp', 'KeyW'];
const LEAN_BACK = ['ArrowDown', 'KeyS'];
const LEAN_FWD = ['ShiftLeft', 'ShiftRight'];
const STUNT = ['Space'];

export class Input {
  constructor() {
    this.keys = new Set();
    this.pressed = new Set();
    this.gpPrev = [];
    window.addEventListener('keydown', (e) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
      if (!this.keys.has(e.code)) this.pressed.add(e.code);
      this.keys.add(e.code);
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => this.keys.clear());
  }

  any(codes) {
    return codes.some((c) => this.keys.has(c));
  }

  // Edge-triggered press; also maps gamepad buttons to pseudo codes.
  wasPressed(...codes) {
    return codes.some((c) => this.pressed.has(c));
  }

  endFrame() {
    this.pressed.clear();
  }

  pollGamepad() {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    const gp = [...pads].find((p) => p && p.connected);
    this.gp = null;
    if (!gp) return null;
    const b = (i) => !!(gp.buttons[i] && gp.buttons[i].pressed);
    const map = { 0: 'PadA', 1: 'PadB', 2: 'PadX', 9: 'PadStart', 12: 'PadUp', 13: 'PadDown', 14: 'PadLeft', 15: 'PadRight' };
    for (const [i, code] of Object.entries(map)) {
      const now = b(+i);
      if (now && !this.gpPrev[i]) this.pressed.add(code);
      this.gpPrev[i] = now;
    }
    const dead = (v) => (Math.abs(v) < 0.18 ? 0 : v);
    return (this.gp = {
      steer: dead(gp.axes[0] || 0) || (b(14) ? -1 : 0) || (b(15) ? 1 : 0),
      lean: dead(gp.axes[1] || 0),
      throttle: b(0) || (gp.buttons[7] && gp.buttons[7].value > 0.2) ? 1 : 0,
      stunt: b(2) || b(1) || b(3),
      leanFwd: b(5) || b(4),
    });
  }

  // Call pollGamepad() once per frame before this.
  racing() {
    const gp = this.gp;
    let steer = (this.any(STEER_RIGHT) ? 1 : 0) - (this.any(STEER_LEFT) ? 1 : 0);
    let throttle = this.any(THROTTLE) ? 1 : 0;
    let leanBack = this.any(LEAN_BACK) ? 1 : 0;
    let leanFwd = this.any(LEAN_FWD) ? 1 : 0;
    let stunt = this.any(STUNT) ? 1 : 0;
    if (gp) {
      if (gp.steer) steer = gp.steer;
      throttle = Math.max(throttle, gp.throttle);
      if (gp.lean > 0.4) leanBack = 1;
      if (gp.lean < -0.4 || gp.leanFwd) leanFwd = 1;
      if (gp.stunt) stunt = 1;
    }
    return { steer, throttle, leanFwd, leanBack, stunt };
  }
}
