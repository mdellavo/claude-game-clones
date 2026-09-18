// On-screen controls for touch devices. They synthesize the same key events the keyboard uses.
const BUTTONS = [
  { cls: 'tc-up', code: 'ArrowUp', label: '▲' },
  { cls: 'tc-left', code: 'ArrowLeft', label: '◀' },
  { cls: 'tc-right', code: 'ArrowRight', label: '▶' },
  { cls: 'tc-down', code: 'ArrowDown', label: '▼' },
  { cls: 'tc-b', code: 'KeyX', label: 'B' },
  { cls: 'tc-a', code: 'KeyZ', label: 'A' },
  { cls: 'tc-select', code: 'KeyC', label: 'SELECT' },
  { cls: 'tc-start', code: 'Enter', label: 'START' },
];

export function installTouchControls() {
  const root = document.createElement('div');
  root.id = 'touch';
  root.setAttribute('aria-hidden', 'true');
  for (const b of BUTTONS) {
    const el = document.createElement('button');
    el.type = 'button';
    el.className = `tc ${b.cls}`;
    el.textContent = b.label;
    const down = (e) => {
      e.preventDefault();
      el.classList.add('on');
      window.dispatchEvent(new KeyboardEvent('keydown', { code: b.code }));
    };
    const up = (e) => {
      e.preventDefault();
      if (!el.classList.contains('on')) return;
      el.classList.remove('on');
      window.dispatchEvent(new KeyboardEvent('keyup', { code: b.code }));
    };
    el.addEventListener('pointerdown', down);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
    el.addEventListener('pointerleave', up);
    root.appendChild(el);
  }
  document.body.appendChild(root);
  // Tapping the title / game-over / win screens acts as START.
  document.getElementById('overlay').addEventListener('pointerdown', (e) => {
    if (e.target.closest('.pause')) return;
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Enter' }));
    setTimeout(() => window.dispatchEvent(new KeyboardEvent('keyup', { code: 'Enter' })), 80);
  });
}
