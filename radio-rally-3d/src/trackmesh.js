import * as THREE from 'three';
import { grassTexture, roadTexture, checkerTexture, stripeTexture, textSprite } from './textures.js';

function rand(seed) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

// Build a non-indexed quad strip along the track. edge(i, side) -> [x,y,z], side 0 or 1.
function stripGeometry(track, rows, edge, colorFn, uvFn) {
  const pos = [], col = [], uv = [];
  const c = new THREE.Color();
  for (let i = 0; i < rows; i++) {
    const a0 = edge(i, 0), a1 = edge(i, 1), b0 = edge(i + 1, 0), b1 = edge(i + 1, 1);
    pos.push(...a0, ...b0, ...a1, ...a1, ...b0, ...b1);
    if (colorFn) {
      c.set(colorFn(i));
      for (let k = 0; k < 6; k++) col.push(c.r, c.g, c.b);
    }
    if (uvFn) {
      const [u0, v0] = uvFn(i, 0), [u1] = uvFn(i, 1), [, v1] = uvFn(i + 1, 0);
      uv.push(u0, v0, u0, v1, u1, v0, u1, v0, u0, v1, u1, v1);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  if (colorFn) g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  if (uvFn) g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.computeVertexNormals();
  return g;
}

function samplePoint(track, i, lat, yOff, useRamp = false) {
  const n = track.N;
  const j = ((i % n) + n) % n;
  const rx = -track.tz[j], rz = track.tx[j];
  const y = (useRamp ? track.groundHeight(j * track.step) : track.h[j]) + yOff;
  return [track.x[j] + rx * lat, y, track.z[j] + rz * lat];
}

// Quad that follows the track surface between s0..s1 and lateral l0..l1.
export function trackQuad(track, s0, s1, l0, l1, material, lift = 0.04) {
  const segs = Math.max(1, Math.ceil((s1 - s0) / 0.8));
  const p = {};
  const edge = (k, side) => {
    const s = s0 + ((s1 - s0) * k) / segs;
    track.posAt(s, side ? l1 : l0, p);
    return [p.x, p.y + lift, p.z];
  };
  const g = stripGeometry(track, segs, edge, null, (k, side) => [side, k / segs]);
  const m = new THREE.Mesh(g, material);
  m.receiveShadow = true;
  return m;
}

export function buildWorld(track, theme) {
  const group = new THREE.Group();
  const hw = track.hw;
  const N = track.N;
  const r = rand(track.def.name.length * 97 + N);

  // --- sky dome
  const skyGeo = new THREE.SphereGeometry(900, 24, 12);
  const top = new THREE.Color(theme.sky).multiplyScalar(theme.night ? 0.5 : 0.85);
  const bottom = new THREE.Color(theme.fog);
  const sky = new THREE.Mesh(
    skyGeo,
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      uniforms: { top: { value: top }, bottom: { value: bottom } },
      vertexShader: 'varying vec3 vp; void main(){ vp = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader:
        'uniform vec3 top; uniform vec3 bottom; varying vec3 vp; void main(){ float h = clamp(normalize(vp).y*1.6+0.05,0.0,1.0); gl_FragColor = vec4(mix(bottom, top, h),1.0); }',
    })
  );
  sky.renderOrder = -1;
  group.add(sky);
  group.userData.sky = sky;

  // --- ground
  const b = track.bounds;
  const cx = (b.minX + b.maxX) / 2, cz = (b.minZ + b.maxZ) / 2;
  const size = Math.max(b.maxX - b.minX, b.maxZ - b.minZ) + 700;
  const gtex = grassTexture(theme.grass);
  gtex.repeat.set(size / 16, size / 16);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(size, size), new THREE.MeshLambertMaterial({ map: gtex }));
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(cx, -0.05, cz);
  ground.receiveShadow = true;
  group.add(ground);

  // --- road
  const rtex = roadTexture(theme.road);
  const road = new THREE.Mesh(
    stripGeometry(
      track,
      N,
      (i, side) => samplePoint(track, i, side ? hw : -hw, 0.02),
      null,
      (i, side) => [side, (i * track.step) / 12]
    ),
    new THREE.MeshLambertMaterial({ map: rtex, side: THREE.DoubleSide })
  );
  road.receiveShadow = true;
  group.add(road);

  // --- curbs
  const curbW = 1.1;
  const curbMat = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });
  for (const sgn of [-1, 1]) {
    const curb = new THREE.Mesh(
      stripGeometry(
        track,
        N,
        (i, side) => samplePoint(track, i, sgn * (hw + (side ? curbW : 0)), 0.06 + (side ? 0.05 : 0)),
        (i) => (Math.floor(i / 2) % 2 ? 0xffffff : 0xd32f2f)
      ),
      curbMat
    );
    curb.receiveShadow = true;
    group.add(curb);
  }

  // --- walls (tire-barrier look) with embankment down to the ground
  const wallMat = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });
  const wallH = 1.4, wallT = 0.9;
  const wc = (i) => (Math.floor(i / 3) % 2 ? theme.wallA : theme.wallB);
  const wcDark = (i) => new THREE.Color(wc(i)).multiplyScalar(0.7).getHex();
  for (const sgn of [-1, 1]) {
    const w0 = hw + curbW, w1 = w0 + wallT;
    const faces = [
      [(i, s) => samplePoint(track, i, sgn * w0, s ? wallH : -0.1), wc],
      [(i, s) => samplePoint(track, i, sgn * (s ? w1 : w0), wallH), wcDark],
      [(i, s) => { const p = samplePoint(track, i, sgn * w1, wallH); if (!s) p[1] = -0.3; return p; }, wc],
    ];
    for (const [edge, colorFn] of faces) {
      const m = new THREE.Mesh(stripGeometry(track, N, edge, colorFn), wallMat);
      m.castShadow = true;
      m.receiveShadow = true;
      group.add(m);
    }
  }

  // --- start / finish
  const chk = checkerTexture();
  chk.repeat.set(3, 1);
  group.add(trackQuad(track, -1.2, 1.2, -hw, hw, new THREE.MeshLambertMaterial({ map: chk, side: THREE.DoubleSide }), 0.05));
  const sp = track.posAt(0, 0);
  const banner = new THREE.Group();
  banner.position.set(sp.x, sp.y, sp.z);
  banner.rotation.y = sp.heading;
  const postMat = new THREE.MeshLambertMaterial({ color: 0xeeeeee });
  for (const sgn of [-1, 1]) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.6, 7, 0.6), postMat);
    post.position.set(sgn * (hw + 2.4), 3.5, 0);
    post.castShadow = true;
    banner.add(post);
  }
  const bannerTex = textSprite('START  FINISH', '#fff', '#c62828');
  const beam = new THREE.Mesh(
    new THREE.BoxGeometry((hw + 2.4) * 2 + 0.6, 1.6, 0.4),
    [postMat, postMat, postMat, postMat, new THREE.MeshLambertMaterial({ map: bannerTex }), new THREE.MeshLambertMaterial({ map: bannerTex })]
  );
  beam.position.y = 7;
  beam.castShadow = true;
  banner.add(beam);
  group.add(banner);

  // --- grandstand beside the start straight
  const stand = new THREE.Group();
  const standPos = track.posAt(8, -(hw + 9));
  if (track.nearest(standPos.x, standPos.z).dist > hw + 7) {
    stand.position.set(standPos.x, 0, standPos.z);
    stand.rotation.y = standPos.heading;
    const tierMat = new THREE.MeshLambertMaterial({ color: 0x90a4ae });
    const crowdGeo = new THREE.BoxGeometry(0.6, 0.8, 0.6);
    const crowd = new THREE.InstancedMesh(crowdGeo, new THREE.MeshLambertMaterial(), 5 * 40);
    let ci = 0;
    const mtx = new THREE.Matrix4(), col = new THREE.Color();
    for (let t = 0; t < 5; t++) {
      const tier = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.8 + t * 0.8, 30), tierMat);
      tier.position.set(t * 1.4, (0.8 + t * 0.8) / 2, 0);
      tier.castShadow = tier.receiveShadow = true;
      stand.add(tier);
      for (let k = 0; k < 40; k++) {
        if (r() < 0.25) continue;
        mtx.makeTranslation(t * 1.4, 0.8 + t * 0.8 + 0.4, -14.5 + k * 0.74);
        crowd.setMatrixAt(ci, mtx);
        crowd.setColorAt(ci, col.setHSL(r(), 0.7, 0.55));
        ci++;
      }
    }
    crowd.count = ci;
    crowd.castShadow = true;
    stand.add(crowd);
    const roof = new THREE.Mesh(new THREE.BoxGeometry(8, 0.3, 31), new THREE.MeshLambertMaterial({ color: theme.wallA }));
    roof.position.set(3, 6.2, 0);
    roof.castShadow = true;
    stand.add(roof);
    group.add(stand);
    group.userData.crowd = crowd;
  }

  // --- scenery (trees / cacti / tanks), instanced
  const spots = [];
  const margin = 70;
  for (let x = b.minX - margin; x < b.maxX + margin; x += 7)
    for (let z = b.minZ - margin; z < b.maxZ + margin; z += 7) {
      const px = x + (r() - 0.5) * 6, pz = z + (r() - 0.5) * 6;
      const q = track.nearest(px, pz);
      if (q.dist < hw + 5.5) continue;
      const density = q.dist < 30 ? 0.35 : 0.14;
      if (r() > density) continue;
      if (Math.hypot(px - standPos.x, pz - standPos.z) < 22) continue;
      spots.push([px, pz, 0.7 + r() * 0.8, r() * Math.PI * 2]);
    }
  const mtx = new THREE.Matrix4(), quat = new THREE.Quaternion(), scl = new THREE.Vector3(), v = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0);
  const place = (mesh, i, x, y, z, s, rot, sy = s) => {
    quat.setFromAxisAngle(up, rot);
    mtx.compose(v.set(x, y, z), quat, scl.set(s, sy, s));
    mesh.setMatrixAt(i, mtx);
  };
  if (theme.industrial) {
    const tankGeo = new THREE.CylinderGeometry(3, 3, 5, 16);
    const tanks = new THREE.InstancedMesh(tankGeo, new THREE.MeshLambertMaterial({ color: 0xcfd8dc }), spots.length);
    const pipeGeo = new THREE.CylinderGeometry(0.5, 0.7, 14, 8);
    const pipes = new THREE.InstancedMesh(pipeGeo, new THREE.MeshLambertMaterial({ color: 0xb71c1c }), spots.length);
    let ti = 0, pi = 0;
    spots.forEach(([x, z, s, rot], i) => {
      if (i % 2) return;
      if (i % 5 === 0) place(pipes, pi++, x, 7 * s, z, s, rot);
      else place(tanks, ti++, x, 2.5 * s, z, s, rot);
    });
    tanks.count = ti; pipes.count = pi;
    for (const m of [tanks, pipes]) { m.castShadow = true; m.receiveShadow = true; group.add(m); }
  } else if (theme.cactus) {
    const cGeo = new THREE.CylinderGeometry(0.45, 0.55, 4, 8);
    const armGeo = new THREE.CylinderGeometry(0.3, 0.3, 2, 6);
    const mat = new THREE.MeshLambertMaterial({ color: theme.tree });
    const cac = new THREE.InstancedMesh(cGeo, mat, spots.length);
    const arms = new THREE.InstancedMesh(armGeo, mat, spots.length);
    const rockGeo = new THREE.DodecahedronGeometry(1.2, 0);
    const rocks = new THREE.InstancedMesh(rockGeo, new THREE.MeshLambertMaterial({ color: 0xa1887f, flatShading: true }), spots.length);
    let ci = 0, ri = 0;
    spots.forEach(([x, z, s, rot], i) => {
      if (i % 3 === 0) { place(rocks, ri++, x, 0.4 * s, z, s * 1.4, rot); return; }
      place(cac, ci, x, 2 * s, z, s, rot);
      mtx.compose(v.set(x + Math.cos(rot) * 0.8 * s, 2.4 * s, z + Math.sin(rot) * 0.8 * s), quat.setFromAxisAngle(up, rot), scl.set(s, s, s));
      arms.setMatrixAt(ci, mtx);
      ci++;
    });
    cac.count = ci; arms.count = ci; rocks.count = ri;
    for (const m of [cac, arms, rocks]) { m.castShadow = true; m.receiveShadow = true; group.add(m); }
  } else {
    const trunkGeo = new THREE.CylinderGeometry(0.3, 0.4, 1.6, 6);
    const leafGeo = new THREE.ConeGeometry(2, 4.5, 7);
    const leaf2Geo = new THREE.ConeGeometry(1.5, 3.2, 7);
    const trunks = new THREE.InstancedMesh(trunkGeo, new THREE.MeshLambertMaterial({ color: theme.trunk }), spots.length);
    const leaves = new THREE.InstancedMesh(leafGeo, new THREE.MeshLambertMaterial({ color: theme.tree, flatShading: true }), spots.length);
    const leaves2 = new THREE.InstancedMesh(leaf2Geo, new THREE.MeshLambertMaterial({ color: theme.snowy ? 0xffffff : new THREE.Color(theme.tree).multiplyScalar(1.25), flatShading: true }), spots.length);
    spots.forEach(([x, z, s, rot], i) => {
      place(trunks, i, x, 0.8 * s, z, s, rot);
      place(leaves, i, x, 3.4 * s, z, s, rot);
      place(leaves2, i, x, 5.2 * s, z, s, rot + 0.4);
    });
    for (const m of [trunks, leaves, leaves2]) { m.castShadow = true; m.receiveShadow = true; group.add(m); }
  }

  // --- lamp posts for night tracks
  if (theme.night) {
    const count = Math.floor(N / 30);
    const poleGeo = new THREE.CylinderGeometry(0.15, 0.2, 6, 6);
    const bulbGeo = new THREE.SphereGeometry(0.45, 8, 6);
    const poles = new THREE.InstancedMesh(poleGeo, new THREE.MeshLambertMaterial({ color: 0x455a64 }), count);
    const bulbs = new THREE.InstancedMesh(bulbGeo, new THREE.MeshBasicMaterial({ color: 0xfff59d }), count);
    const p = {};
    for (let k = 0; k < count; k++) {
      const sgn = k % 2 ? 1 : -1;
      track.posAt(k * 30 + 5, sgn * (hw + 3.2), p);
      place(poles, k, p.x, p.y + 3, p.z, 1, 0);
      place(bulbs, k, p.x, p.y + 6.2, p.z, 1, 0);
    }
    group.add(poles, bulbs);
  }

  // --- distant mountains / hills ring
  const hillGeo = new THREE.ConeGeometry(1, 1, 6);
  const hills = new THREE.InstancedMesh(
    hillGeo,
    new THREE.MeshLambertMaterial({ color: theme.snowy ? 0xdfe9f2 : new THREE.Color(theme.grass[1]).multiplyScalar(0.75), flatShading: true }),
    40
  );
  const radius = Math.max(b.maxX - b.minX, b.maxZ - b.minZ) / 2 + 160;
  for (let k = 0; k < 40; k++) {
    const a = (k / 40) * Math.PI * 2 + r() * 0.1;
    const w = 50 + r() * 60, hgt = 25 + r() * 60;
    mtx.compose(v.set(cx + Math.cos(a) * radius * (1 + r() * 0.3), hgt / 2 - 2, cz + Math.sin(a) * radius * (1 + r() * 0.3)), quat.setFromAxisAngle(up, r() * 3), scl.set(w, hgt, w));
    hills.setMatrixAt(k, mtx);
  }
  group.add(hills);

  // --- ramps & bumps
  const stripeTex = stripeTexture();
  const rampMat = new THREE.MeshLambertMaterial({ map: stripeTex, side: THREE.DoubleSide });
  const bumpMat = new THREE.MeshLambertMaterial({ color: new THREE.Color(theme.road).multiplyScalar(0.85), side: THREE.DoubleSide });
  for (const f of track.ramps) {
    const segs = Math.ceil(f.len / 0.5);
    const mat = f.type === 'ramp' ? rampMat : bumpMat;
    const p = {};
    const at = (k, lat, top) => {
      const s = f.s + (f.len * Math.min(k, segs)) / segs;
      track.posAt(s, lat, p);
      const base = track.baseHeight(s) + 0.02;
      return [p.x, top ? base + track.rampHeight(Math.min(s, f.s + f.len - 0.001)) + 0.03 : base, p.z];
    };
    const topG = stripGeometry(track, segs, (k, side) => at(k, side ? hw : -hw, true), null, (k, side) => [side * 3, k / segs]);
    group.add(Object.assign(new THREE.Mesh(topG, mat), { castShadow: true, receiveShadow: true }));
    for (const sgn of [-1, 1]) {
      const sideG = stripGeometry(track, segs, (k, side) => at(k, sgn * hw, side === 1), null, null);
      group.add(new THREE.Mesh(sideG, mat));
    }
    if (f.type === 'ramp') {
      const backG = stripGeometry(track, 1, (k, side) => at(segs, k ? hw : -hw, side === 1), null, null);
      group.add(new THREE.Mesh(backG, new THREE.MeshLambertMaterial({ color: 0x333333, side: THREE.DoubleSide })));
    }
  }

  return group;
}
