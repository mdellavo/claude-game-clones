// Low-poly scenery models from Poly Pizza (credits in the README). Each ships as models/<name>.js, a module
// wrapping the GLB in base64 (artifacts do not serve .glb), loaded once at startup; anything that fails to load
// leaves the hand-built scenery in place.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';

export const MDL = {};
async function loadModels(names) {
  const loader = new GLTFLoader();
  loader.register((parser) => { parser.textureLoader = new THREE.TextureLoader(parser.options.manager); return { name: 'image_element_textures' }; });
  await Promise.all(names.map(async (n) => {
    try {
      // resolved against the page, so the same path works from src/ in development and from the bundled page
      const { default: b64 } = await import(new URL('models/' + n + '.js', document.baseURI).href);
      const s = atob(b64), u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i);
      MDL[n] = await loader.parseAsync(u.buffer, '');
    } catch (e) { console.warn('model failed to load:', n, e && e.message); }
  }));
}
await loadModels(['tree', 'pine-snow', 'rock']);
// bake(gltf, { parts: { name: /material/ }, clip, time, lift }) -> { name: geometry }: the model posed and flattened
// into plain vertex-coloured triangles (material colour x texture x vertex colour), ready for merging or instancing
const _texReaders = new Map();
function texReader(tex) {
  let r = _texReaders.get(tex); if (r) return r;
  const img = tex.image, c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
  const x = c.getContext('2d'); x.drawImage(img, 0, 0); const d = x.getImageData(0, 0, c.width, c.height).data, w = c.width, h = c.height;
  r = (u, v, out) => { const px = Math.min(w - 1, Math.floor((u - Math.floor(u)) * w)), py = Math.min(h - 1, Math.floor((v - Math.floor(v)) * h)), i = (py * w + px) * 4; return out.setRGB(d[i] / 255, d[i + 1] / 255, d[i + 2] / 255, THREE.SRGBColorSpace); };
  _texReaders.set(tex, r); return r;
}
export function bake(gltf, { parts = { all: /.*/ }, clip = null, time = 0, lift = 0, byNode = false } = {}) {
  const obj = SkeletonUtils.clone(gltf.scene);
  if (clip && gltf.animations.length) { const a = gltf.animations.find(x => clip.test(x.name)) || gltf.animations[0]; const mx = new THREE.AnimationMixer(obj); mx.clipAction(a).play(); mx.update(time); }
  obj.updateMatrixWorld(true);
  const acc = {}; for (const k in parts) acc[k] = { p: [], c: [] };
  const v = new THREE.Vector3(), tc = new THREE.Color(), cc = new THREE.Color();
  obj.traverse(m => {
    if (!m.isMesh) return;
    if (m.isSkinnedMesh) m.skeleton.update();
    const mats = Array.isArray(m.material) ? m.material : [m.material], g = m.geometry, pos = g.attributes.position, uv = g.attributes.uv, vcol = g.attributes.color, idx = g.index;
    const groups = g.groups.length ? g.groups : [{ start: 0, count: idx ? idx.count : pos.count, materialIndex: 0 }];
    for (const gr of groups) {
      const mat = mats[gr.materialIndex] || mats[0];
      let name = mat.name || ''; if (byNode) { name = ''; for (let o = m; o; o = o.parent) name += o.name + '/'; }
      const key = Object.keys(parts).find(k => parts[k].test(name)); if (!key) continue;
      const out = acc[key], samp = mat.map ? texReader(mat.map) : null;
      for (let i = gr.start; i < gr.start + gr.count; i++) {
        const vi = idx ? idx.getX(i) : i;
        m.getVertexPosition(vi, v).applyMatrix4(m.matrixWorld); out.p.push(v.x, v.y, v.z);
        tc.copy(mat.color || cc.setRGB(1, 1, 1));
        if (samp && uv) tc.multiply(samp(uv.getX(vi), uv.getY(vi), cc));
        if (vcol) tc.multiply(cc.fromBufferAttribute(vcol, vi));
        if (lift) { const k = 1 - lift * 0.25, f = 1 + lift * 0.2; tc.setRGB(Math.min(1, tc.r ** k * f), Math.min(1, tc.g ** k * f), Math.min(1, tc.b ** k * f)); }
        out.c.push(tc.r, tc.g, tc.b);
      }
    }
  });
  const res = {};
  for (const k in acc) { const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(acc[k].p, 3)); geo.setAttribute('color', new THREE.Float32BufferAttribute(acc[k].c, 3)); geo.computeVertexNormals(); res[k] = geo; }
  return res;
}
// stand baked parts on the ground, centred, scaled so one dimension hits a target; returns parts with .size
export function fitBaked(parts, { height, width, length, rotY = 0 }) {
  const box = new THREE.Box3(), geos = Object.values(parts).filter(g => g.attributes.position.count);
  if (rotY) geos.forEach(g => g.rotateY(rotY));
  geos.forEach(g => { g.computeBoundingBox(); box.union(g.boundingBox); });
  const size = box.getSize(new THREE.Vector3()), s = height ? height / size.y : width ? width / size.x : length / size.z;
  geos.forEach(g => { g.translate(-(box.min.x + box.max.x) / 2, -box.min.y, -(box.min.z + box.max.z) / 2); g.scale(s, s, s); g.computeBoundingBox(); });
  parts.size = size.multiplyScalar(s);
  return parts;
}
// one baked geometry at a target size: bakedGeo(gltf, { height: 5 })
export const bakedGeo = (gltf, size, opts) => fitBaked(bake(gltf, opts), size).all;
// a baked model with its longest horizontal side laid along 'x' or 'z', scaled to that length
function along(gltf, axis, length, opts = {}) {
  const raw = bake(gltf, opts); const all = Object.values(raw); const b = new THREE.Box3(); all.forEach(g => { g.computeBoundingBox(); b.union(g.boundingBox); });
  const xLong = b.max.x - b.min.x > b.max.z - b.min.z, turn = (axis === 'x') !== xLong ? Math.PI / 2 : 0;
  return fitBaked(raw, axis === 'x' ? { width: length, rotY: turn } : { length, rotY: turn });
}
