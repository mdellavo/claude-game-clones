import { itemDef } from '../data/items.js';

// Draws a small pixel-art style icon for an item into a canvas.
export function itemIcon(item, cw, ch, scale = 1) {
  const d = itemDef(item.id);
  const c = document.createElement('canvas');
  c.width = cw;
  c.height = ch;
  const g = c.getContext('2d');
  const col = d.color || (item.color != null ? '#' + item.color.toString(16).padStart(6, '0') : '#888');
  const dark = shadeHex(col, 0.55);
  const light = shadeHex(col, 1.35);
  g.imageSmoothingEnabled = false;
  const cx = cw / 2, cy = ch / 2;
  const s = scale;
  const rect = (x, y, w, h, color) => {
    g.fillStyle = color;
    g.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
  };
  const shape = d.shape || d.kind;
  switch (shape) {
    case 'rifle':
      rect(cx - 3 * s, cy - 40 * s, 6 * s, 72 * s, col);
      rect(cx - 3 * s, cy - 40 * s, 2 * s, 72 * s, light);
      rect(cx - 7 * s, cy + 10 * s, 14 * s, 26 * s, dark);
      rect(cx + 3 * s, cy - 8 * s, 8 * s, 12 * s, dark);
      break;
    case 'pistol':
      rect(cx - 4 * s, cy - 18 * s, 8 * s, 26 * s, col);
      rect(cx - 4 * s, cy - 18 * s, 2 * s, 26 * s, light);
      rect(cx + 2 * s, cy + 2 * s, 10 * s, 8 * s, dark);
      break;
    case 'cannon':
      rect(cx - 10 * s, cy - 42 * s, 20 * s, 78 * s, col);
      rect(cx - 10 * s, cy - 42 * s, 4 * s, 78 * s, light);
      rect(cx - 4 * s, cy - 50 * s, 8 * s, 10 * s, dark);
      rect(cx + 10 * s, cy, 8 * s, 18 * s, dark);
      break;
    case 'launcher':
      rect(cx - 9 * s, cy - 44 * s, 18 * s, 84 * s, col);
      rect(cx - 9 * s, cy - 44 * s, 4 * s, 84 * s, light);
      rect(cx - 12 * s, cy - 46 * s, 24 * s, 6 * s, dark);
      rect(cx + 9 * s, cy + 4 * s, 8 * s, 14 * s, dark);
      break;
    case 'ammo':
      if (d.w === 1 && d.h === 3) {
        rect(cx - 5 * s, cy - 36 * s, 10 * s, 60 * s, col);
        g.fillStyle = dark;
        g.beginPath();
        g.moveTo(cx - 5 * s, cy - 36 * s);
        g.lineTo(cx, cy - 46 * s);
        g.lineTo(cx + 5 * s, cy - 36 * s);
        g.fill();
        rect(cx - 9 * s, cy + 22 * s, 18 * s, 8 * s, dark);
      } else {
        rect(cx - 8 * s, cy - 11 * s, 16 * s, 22 * s, col);
        rect(cx - 8 * s, cy - 11 * s, 16 * s, 4 * s, light);
        rect(cx - 6 * s, cy - 5 * s, 12 * s, 2 * s, dark);
      }
      break;
    case 'grenade':
      g.fillStyle = col;
      g.beginPath();
      g.arc(cx, cy + 2 * s, (d.w > 1 ? 18 : 9) * s, 0, Math.PI * 2);
      g.fill();
      rect(cx - 3 * s, cy - (d.w > 1 ? 22 : 12) * s, 6 * s, 6 * s, dark);
      rect(cx - 4 * s, cy - 2 * s, 3 * s, 3 * s, light);
      break;
    case 'melee':
      rect(cx - 3 * s, cy - 40 * s, 6 * s, 76 * s, col);
      rect(cx - 5 * s, cy + 18 * s, 10 * s, 20 * s, dark);
      rect(cx - 1 * s, cy - 40 * s, 2 * s, 30 * s, '#bfe0ff');
      break;
    case 'medikit':
      rect(cx - 26 * s, cy - 11 * s, 52 * s, 22 * s, '#e8e8e8');
      rect(cx - 3 * s, cy - 8 * s, 6 * s, 16 * s, '#d02020');
      rect(cx - 8 * s, cy - 3 * s, 16 * s, 6 * s, '#d02020');
      break;
    case 'flare':
      rect(cx - 4 * s, cy - 12 * s, 8 * s, 24 * s, '#606060');
      rect(cx - 4 * s, cy - 14 * s, 8 * s, 5 * s, col);
      break;
    case 'corpse':
      g.fillStyle = col;
      g.beginPath();
      g.ellipse(cx, cy, 14 * s, 36 * s, 0, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = dark;
      g.beginPath();
      g.arc(cx, cy - 34 * s, 10 * s, 0, Math.PI * 2);
      g.fill();
      break;
    default:
      rect(cx - 10 * s, cy - 10 * s, 20 * s, 20 * s, col);
  }
  return c;
}

function shadeHex(hex, f) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.min(255, Math.round(((n >> 16) & 255) * f));
  const gg = Math.min(255, Math.round(((n >> 8) & 255) * f));
  const b = Math.min(255, Math.round((n & 255) * f));
  return `rgb(${r},${gg},${b})`;
}
