// Keyboard + gamepad input with "pressed this frame" edge detection.
const KEYMAP = {
  ArrowUp: 'up', KeyW: 'up',
  ArrowDown: 'down', KeyS: 'down',
  ArrowLeft: 'left', KeyA: 'left',
  ArrowRight: 'right', KeyD: 'right',
  KeyZ: 'a', KeyJ: 'a', Space: 'a',
  KeyX: 'b', KeyK: 'b',
  KeyC: 'select', Tab: 'select', ShiftLeft: 'select',
  Enter: 'start', Escape: 'start', KeyP: 'start',
  KeyV: 'view',
  KeyM: 'mute',
};

export class Input {
  constructor() {
    this.down = new Set();
    this.prev = new Set();
    this.keys = new Set();
    this.latched = new Set(); // pressed since last update (catches taps shorter than a frame)
    this.order = []; // most recent direction last
    window.addEventListener('keydown', (e) => {
      const b = KEYMAP[e.code];
      if (!b) return;
      e.preventDefault();
      if (!e.repeat) this.latched.add(b);
      this.keys.add(b);
      if (['up', 'down', 'left', 'right'].includes(b)) {
        this.order = this.order.filter((d) => d !== b);
        this.order.push(b);
      }
    });
    window.addEventListener('keyup', (e) => {
      const b = KEYMAP[e.code];
      if (!b) return;
      this.keys.delete(b);
      this.order = this.order.filter((d) => d !== b);
    });
    window.addEventListener('blur', () => { this.keys.clear(); this.order = []; });
  }

  update() {
    this.prev = this.down;
    this.down = new Set(this.keys);
    this.tapped = this.latched;
    this.latched = new Set();
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    for (const p of pads) {
      if (!p) continue;
      const btn = (i) => p.buttons[i] && p.buttons[i].pressed;
      const ax = p.axes[0] || 0, ay = p.axes[1] || 0;
      if (btn(12) || ay < -0.5) this.down.add('up');
      if (btn(13) || ay > 0.5) this.down.add('down');
      if (btn(14) || ax < -0.5) this.down.add('left');
      if (btn(15) || ax > 0.5) this.down.add('right');
      if (btn(0)) this.down.add('a');
      if (btn(2) || btn(1)) this.down.add('b');
      if (btn(8) || btn(3)) this.down.add('select');
      if (btn(9)) this.down.add('start');
    }
  }

  held(b) { return this.down.has(b); }
  pressed(b) { return (this.down.has(b) && !this.prev.has(b)) || (this.tapped && this.tapped.has(b) && !this.prev.has(b)); }

  // The single most recently pressed direction that is still held.
  direction() {
    for (let i = this.order.length - 1; i >= 0; i--) if (this.down.has(this.order[i])) return this.order[i];
    for (const d of ['up', 'down', 'left', 'right']) if (this.down.has(d)) return d;
    return null;
  }
}
