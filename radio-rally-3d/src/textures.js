import * as THREE from 'three';

function canvas(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

function rand(seed) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

export function grassTexture(colors) {
  const t = canvas(256, 256, (g, w, h) => {
    const r = rand(7);
    const cell = 32;
    for (let y = 0; y < h; y += cell)
      for (let x = 0; x < w; x += cell) {
        g.fillStyle = colors[((x + y) / cell) % 2];
        g.fillRect(x, y, cell, cell);
      }
    for (let i = 0; i < 1800; i++) {
      g.fillStyle = `rgba(${r() < 0.5 ? '0,0,0' : '255,255,255'},${0.04 + r() * 0.06})`;
      g.fillRect(r() * w, r() * h, 2, 2 + r() * 3);
    }
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

export function roadTexture(base) {
  const t = canvas(128, 256, (g, w, h) => {
    g.fillStyle = base;
    g.fillRect(0, 0, w, h);
    const r = rand(3);
    for (let i = 0; i < 2500; i++) {
      const v = r();
      g.fillStyle = `rgba(${v < 0.5 ? '0,0,0' : '255,255,255'},${0.05 + r() * 0.08})`;
      g.fillRect(r() * w, r() * h, 1 + r() * 2, 1 + r() * 2);
    }
    // edge lines
    g.fillStyle = 'rgba(255,255,255,0.85)';
    g.fillRect(3, 0, 4, h);
    g.fillRect(w - 7, 0, 4, h);
    // center dashes
    g.fillStyle = 'rgba(255,230,120,0.55)';
    g.fillRect(w / 2 - 2, 0, 4, h / 2);
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

export function checkerTexture() {
  const t = canvas(128, 32, (g, w, h) => {
    const n = 8;
    for (let y = 0; y < 2; y++)
      for (let x = 0; x < n; x++) {
        g.fillStyle = (x + y) % 2 ? '#111' : '#fff';
        g.fillRect((x * w) / n, (y * h) / 2, w / n, h / 2);
      }
  });
  t.wrapS = THREE.RepeatWrapping;
  t.magFilter = THREE.NearestFilter;
  return t;
}

export function stripeTexture(a = '#ffd600', b = '#222') {
  const t = canvas(64, 64, (g, w, h) => {
    g.fillStyle = a;
    g.fillRect(0, 0, w, h);
    g.fillStyle = b;
    for (let i = -2; i < 4; i++) {
      g.beginPath();
      g.moveTo(i * 32, 0);
      g.lineTo(i * 32 + 16, 0);
      g.lineTo(i * 32 + 16 + 64, h);
      g.lineTo(i * 32 + 64, h);
      g.fill();
    }
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

export function zipperTexture() {
  return canvas(64, 128, (g, w, h) => {
    g.fillStyle = 'rgba(0,0,0,0)';
    g.clearRect(0, 0, w, h);
    for (let k = 0; k < 3; k++) {
      const y = h - 12 - k * 40;
      g.fillStyle = k % 2 ? '#ffee58' : '#ff7043';
      g.beginPath();
      g.moveTo(6, y);
      g.lineTo(w / 2, y - 30);
      g.lineTo(w - 6, y);
      g.lineTo(w - 18, y);
      g.lineTo(w / 2, y - 16);
      g.lineTo(18, y);
      g.closePath();
      g.fill();
    }
  });
}

export function blobTexture(inner, outer) {
  return canvas(128, 128, (g, w, h) => {
    const r = rand(11);
    g.fillStyle = inner;
    g.beginPath();
    for (let i = 0; i <= 24; i++) {
      const a = (i / 24) * Math.PI * 2;
      const rr = w * (0.38 + r() * 0.1);
      const x = w / 2 + Math.cos(a) * rr, y = h / 2 + Math.sin(a) * rr;
      i ? g.lineTo(x, y) : g.moveTo(x, y);
    }
    g.fill();
    g.strokeStyle = outer;
    g.lineWidth = 5;
    g.stroke();
    g.fillStyle = 'rgba(255,255,255,0.35)';
    g.beginPath();
    g.ellipse(w * 0.4, h * 0.38, w * 0.12, h * 0.05, -0.5, 0, Math.PI * 2);
    g.fill();
  });
}

const ICON_CACHE = new Map();
export function iconTexture(kind) {
  if (ICON_CACHE.has(kind)) return ICON_CACHE.get(kind);
  const t = canvas(128, 128, (g, w, h) => {
    const bg = { missile: '#e53935', bomb: '#546e7a', engine: '#fb8c00', tires: '#43a047', battery: '#1e88e5' }[kind] || '#fdd835';
    g.fillStyle = bg;
    g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(255,255,255,0.9)';
    g.lineWidth = 8;
    g.strokeRect(6, 6, w - 12, h - 12);
    g.fillStyle = '#fff';
    g.strokeStyle = '#fff';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    if (kind === 'missile') {
      g.save();
      g.translate(w / 2, h / 2);
      g.rotate(-Math.PI / 4);
      g.fillRect(-10, -30, 20, 55);
      g.beginPath(); g.moveTo(-10, -30); g.lineTo(0, -48); g.lineTo(10, -30); g.fill();
      g.beginPath(); g.moveTo(-10, 12); g.lineTo(-22, 30); g.lineTo(-10, 25); g.fill();
      g.beginPath(); g.moveTo(10, 12); g.lineTo(22, 30); g.lineTo(10, 25); g.fill();
      g.restore();
    } else if (kind === 'bomb') {
      g.fillStyle = '#111';
      g.beginPath(); g.arc(w / 2 - 4, h / 2 + 8, 30, 0, Math.PI * 2); g.fill();
      g.strokeStyle = '#ffcc80'; g.lineWidth = 5;
      g.beginPath(); g.moveTo(w / 2 + 16, h / 2 - 16); g.quadraticCurveTo(w / 2 + 30, h / 2 - 40, w / 2 + 40, h / 2 - 34); g.stroke();
      g.fillStyle = '#ffeb3b'; g.beginPath(); g.arc(w / 2 + 42, h / 2 - 34, 6, 0, Math.PI * 2); g.fill();
    } else if (kind === 'tires') {
      g.fillStyle = '#111'; g.beginPath(); g.arc(w / 2, h / 2, 38, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#bbb'; g.beginPath(); g.arc(w / 2, h / 2, 16, 0, Math.PI * 2); g.fill();
    } else if (kind === 'battery') {
      g.fillRect(w / 2 - 34, h / 2 - 20, 62, 44);
      g.fillRect(w / 2 + 28, h / 2 - 8, 8, 20);
      g.fillStyle = '#1e88e5';
      g.font = 'bold 36px monospace';
      g.fillText('+', w / 2 - 4, h / 2 + 3);
    } else if (kind === 'engine') {
      g.save(); g.translate(w / 2, h / 2);
      for (let i = 0; i < 8; i++) { g.rotate(Math.PI / 4); g.fillRect(-7, -40, 14, 16); }
      g.beginPath(); g.arc(0, 0, 28, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#fb8c00'; g.beginPath(); g.arc(0, 0, 11, 0, Math.PI * 2); g.fill();
      g.restore();
    } else {
      g.fillStyle = '#c62828';
      g.font = 'bold 84px "Press Start 2P", monospace';
      g.fillText(kind, w / 2, h / 2 + 6);
    }
  });
  ICON_CACHE.set(kind, t);
  return t;
}

export function textSprite(text, color = '#fff', bg = 'rgba(0,0,0,0.6)') {
  const t = canvas(256, 64, (g, w, h) => {
    g.fillStyle = bg;
    g.fillRect(0, 0, w, h);
    g.fillStyle = color;
    g.font = 'bold 30px "Press Start 2P", monospace';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(text, w / 2, h / 2 + 2);
  });
  return t;
}
