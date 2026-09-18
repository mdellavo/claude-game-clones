import * as THREE from 'three';

export const NOISE_GLSL = /* glsl */ `
float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash12(i), hash12(i + vec2(1.0, 0.0)), u.x),
             mix(hash12(i + vec2(0.0, 1.0)), hash12(i + vec2(1.0, 1.0)), u.x), u.y);
}
float fbm(vec2 p) {
  float s = 0.0, a = 0.5;
  for (int i = 0; i < 5; i++) { s += a * vnoise(p); p = p * 2.03 + 17.1; a *= 0.5; }
  return s;
}
`;

export const SKY_GLSL = /* glsl */ `
uniform vec3 uZenith;
uniform vec3 uHorizon;
uniform vec3 uSunColor;
uniform vec3 uSunDir;
uniform float uSunStrength;

vec3 skyColor(vec3 d) {
  float y = d.y;
  vec3 col = mix(uHorizon, uZenith, pow(clamp(y, 0.0, 1.0), 0.45));
  if (y < 0.0) col = mix(uHorizon, uHorizon * 0.7, clamp(-y * 3.0, 0.0, 1.0));
  float sd = max(dot(d, uSunDir), 0.0);
  col += uSunColor * uSunStrength * (pow(sd, 900.0) * 40.0 + pow(sd, 12.0) * 0.4 + pow(sd, 3.0) * 0.12);
  return col;
}
`;

export function makeSkyUniforms(course) {
  const s = course.sky;
  return {
    uZenith: { value: new THREE.Color(s.zenith) },
    uHorizon: { value: new THREE.Color(s.horizon) },
    uSunColor: { value: new THREE.Color(s.sun) },
    uSunDir: { value: new THREE.Vector3(...s.sunDir).normalize() },
    uSunStrength: { value: s.sunStrength },
  };
}

export function createSky(skyUniforms, course, timeUniform) {
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      ...skyUniforms,
      uTime: timeUniform,
      uClouds: { value: course.sky.clouds },
      uCloudColor: { value: new THREE.Color(course.sky.cloudColor) },
    },
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        vDir = position;
        vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        gl_Position = p.xyww;
      }`,
    fragmentShader: /* glsl */ `
      varying vec3 vDir;
      uniform float uTime;
      uniform float uClouds;
      uniform vec3 uCloudColor;
      ${NOISE_GLSL}
      ${SKY_GLSL}
      void main() {
        vec3 d = normalize(vDir);
        vec3 col = skyColor(d);
        if (d.y > 0.0) {
          vec2 uv = d.xz / (d.y + 0.12) * 1.4 + vec2(uTime * 0.01, uTime * 0.004);
          float c = fbm(uv);
          float cover = smoothstep(1.0 - uClouds, 1.0 - uClouds + 0.32, c);
          float shade = 0.75 + 0.35 * smoothstep(0.3, 0.8, fbm(uv * 1.7 + 3.0));
          vec3 cc = uCloudColor * shade + uSunColor * uSunStrength * 0.25 * pow(max(dot(d, uSunDir), 0.0), 6.0);
          col = mix(col, cc, cover * smoothstep(0.0, 0.2, d.y) * 0.9);
        }
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
    side: THREE.BackSide,
    depthWrite: false,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(4000, 32, 16), mat);
  mesh.frustumCulled = false;
  mesh.renderOrder = -1000;
  return mesh;
}
