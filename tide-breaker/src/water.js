import * as THREE from 'three';
import { WAVE_GLSL } from './waves.js';
import { SKY_GLSL, NOISE_GLSL } from './sky.js';

function warpedGrid(N, R, a) {
  const pos = new Float32Array((N + 1) * (N + 1) * 3);
  const warp = (u) => R * (a * u + (1 - a) * u * u * u);
  let k = 0;
  for (let j = 0; j <= N; j++) {
    const z = warp((j / N) * 2 - 1);
    for (let i = 0; i <= N; i++) {
      pos[k++] = warp((i / N) * 2 - 1);
      pos[k++] = 0;
      pos[k++] = z;
    }
  }
  const idx = new Uint32Array(N * N * 6);
  k = 0;
  for (let j = 0; j < N; j++) {
    for (let i = 0; i < N; i++) {
      const a0 = j * (N + 1) + i, b = a0 + 1, c = a0 + N + 1, d = c + 1;
      idx[k++] = a0; idx[k++] = c; idx[k++] = b;
      idx[k++] = b; idx[k++] = c; idx[k++] = d;
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setIndex(new THREE.BufferAttribute(idx, 1));
  return g;
}

export function createWater({ waves, heightTex, hBounds, skyUniforms, course, timeUniform, ampUniform, fogDensity }) {
  const uniforms = {
    ...skyUniforms,
    uTime: timeUniform,
    uAmpScale: ampUniform,
    uWA: { value: waves.uA },
    uWB: { value: waves.uB },
    uHeight: { value: heightTex },
    uHBounds: { value: hBounds },
    uDeep: { value: new THREE.Color(course.water.deep) },
    uShallow: { value: new THREE.Color(course.water.shallow) },
    uFoam: { value: new THREE.Color(course.water.foam) },
    uFogColor: { value: new THREE.Color(course.sky.horizon) },
    uFogDensity: { value: fogDensity },
    uCrest: { value: Math.max(0.3, waves.maxAmp * 0.8) },
  };

  const mat = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: /* glsl */ `
      ${WAVE_GLSL}
      varying vec3 vWorld;
      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        wp.y = waterH(wp.xz);
        vWorld = wp.xyz;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }`,
    fragmentShader: /* glsl */ `
      ${WAVE_GLSL}
      ${NOISE_GLSL}
      ${SKY_GLSL}
      uniform vec3 uDeep;
      uniform vec3 uShallow;
      uniform vec3 uFoam;
      uniform vec3 uFogColor;
      uniform float uFogDensity;
      uniform float uCrest;
      varying vec3 vWorld;

      vec2 rippleGrad(vec2 p) {
        vec2 g = vec2(0.0);
        vec3 R[6];
        R[0] = vec3(0.8, 0.6, 2.9); R[1] = vec3(-0.5, 0.86, 2.1); R[2] = vec3(0.2, -0.98, 1.6);
        R[3] = vec3(-0.95, -0.3, 1.25); R[4] = vec3(0.6, -0.8, 3.7); R[5] = vec3(-0.1, 1.0, 4.6);
        for (int i = 0; i < 6; i++) {
          float k = 6.2831 / R[i].z;
          float w = sqrt(9.81 * k);
          float c = cos(dot(R[i].xy, p) * k - w * uTime + float(i) * 1.7);
          float a = 0.022 * R[i].z;
          g += R[i].xy * (a * k * c);
        }
        return g;
      }

      void main() {
        vec2 p = vWorld.xz;
        vec3 toCam = cameraPosition - vWorld;
        float dist = length(toCam);
        vec3 V = toCam / dist;
        float th = terrainH(p);
        float att = waveAtten(th);
        float e = 0.15 + dist * 0.004;
        float hx0 = waveRaw(p - vec2(e, 0.0)), hx1 = waveRaw(p + vec2(e, 0.0));
        float hz0 = waveRaw(p - vec2(0.0, e)), hz1 = waveRaw(p + vec2(0.0, e));
        vec3 n = normalize(vec3((hx0 - hx1) * att, 2.0 * e, (hz0 - hz1) * att));
        float fade = 1.0 - smoothstep(10.0, 240.0, dist);
        vec2 rg = rippleGrad(p);
        n = normalize(n + vec3(-rg.x, 0.0, -rg.y) * fade);

        float h = vWorld.y;
        float fres = 0.02 + 0.98 * pow(1.0 - max(dot(n, V), 0.0), 5.0);
        vec3 R = reflect(-V, n);
        R.y = abs(R.y);
        vec3 refl = skyColor(normalize(R));

        float depth = max(-th, 0.0);
        vec3 body = mix(uShallow, uDeep, smoothstep(0.3, 11.0, depth));
        float crestT = clamp(h / uCrest, -1.0, 1.0) * 0.5 + 0.5;
        body = mix(body, uShallow * 1.3, pow(crestT, 3.0) * 0.5 * smoothstep(2.0, 9.0, depth));
        float diff = max(dot(n, uSunDir), 0.0);
        body *= 0.5 + 0.65 * diff;

        vec3 col = mix(body, refl, clamp(fres, 0.0, 1.0) * 0.8);
        float spec = pow(max(dot(R, uSunDir), 0.0), 320.0);
        col += uSunColor * spec * 6.0 * uSunStrength;

        float fn = vnoise(p * 0.42 + vec2(uTime * 0.15, uTime * 0.07)) * 0.6 + vnoise(p * 1.6 - vec2(uTime * 0.3, -uTime * 0.2)) * 0.4;
        float crest = smoothstep(0.62, 0.95, crestT + (fn - 0.5) * 0.3) * smoothstep(0.4, 0.7, fn);
        float shoreBand = 1.0 - smoothstep(0.0, 2.4, depth + (fn - 0.5) * 1.4);
        float shoreWave = 0.5 + 0.5 * sin(depth * 4.0 - uTime * 2.0 + fn * 5.0);
        float shore = shoreBand * smoothstep(0.3, 0.65, shoreWave * (0.4 + fn) + shoreBand * 0.25);
        float foam = clamp(crest + shore, 0.0, 1.0) * (1.0 - 0.6 * smoothstep(300.0, 900.0, dist));
        col = mix(col, uFoam * (0.7 + 0.4 * diff), foam * 0.9);

        float fog = 1.0 - exp(-pow(uFogDensity * dist, 2.0));
        col = mix(col, uFogColor, fog);
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });

  const mesh = new THREE.Mesh(warpedGrid(300, 3200, 0.04), mat);
  mesh.frustumCulled = false;
  mesh.update = (camera) => {
    mesh.position.x = Math.round(camera.position.x);
    mesh.position.z = Math.round(camera.position.z);
  };
  return mesh;
}
