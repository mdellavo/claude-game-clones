import * as THREE from 'three';
import { clamp } from './noise.js';

// Speed-driven camera motion blur. The scene is rendered into an HDR target with
// a depth texture; a fullscreen pass reconstructs each pixel's view-space position
// and reprojects it into a "virtual previous camera" displaced backwards along the
// focus craft's velocity. The resulting screen-space vector is the blur direction.
// The craft itself travels with the camera, so it is masked out (and excluded from
// the taps) to keep the rider sharp while the water and scenery streak past.

const BLUR_START = 17; // m/s — no blur below this
const BLUR_FULL = 29; // m/s — full strength
const SHUTTER = 0.05; // seconds of virtual exposure at full strength
const MAX_BLUR = 0.05; // clamp on blur vector length, in UV units
const TAPS = 12;

const _v = new THREE.Vector3();
const _q = new THREE.Quaternion();

export class MotionBlur {
  constructor(renderer) {
    this.renderer = renderer;
    this.strength = 0;
    this.target = new THREE.WebGLRenderTarget(1, 1, {
      type: THREE.HalfFloatType,
      samples: 4,
      depthTexture: new THREE.DepthTexture(1, 1, THREE.UnsignedIntType),
    });

    this.material = new THREE.ShaderMaterial({
      uniforms: {
        tColor: { value: this.target.texture },
        tDepth: { value: this.target.depthTexture },
        uProjInv: { value: new THREE.Matrix4() },
        uProj: { value: new THREE.Matrix4() },
        uOffset: { value: new THREE.Vector3() },
        uStrength: { value: 0 },
        uCraftUv: { value: new THREE.Vector2(0.5, 0.5) },
        uCraftDepth: { value: 8 },
        uCraftRadius: { value: new THREE.Vector2(0.1, 0.1) },
      },
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = vec4(position.xy, 0.0, 1.0);
        }`,
      fragmentShader: /* glsl */ `
        #define TAPS ${TAPS}
        uniform sampler2D tColor;
        uniform sampler2D tDepth;
        uniform mat4 uProjInv;
        uniform mat4 uProj;
        uniform vec3 uOffset;
        uniform float uStrength;
        uniform vec2 uCraftUv;
        uniform float uCraftDepth;
        uniform vec2 uCraftRadius;
        varying vec2 vUv;

        vec3 viewPos(vec2 uv, float d) {
          vec4 p = uProjInv * vec4(vec3(uv, d) * 2.0 - 1.0, 1.0);
          return p.xyz / p.w;
        }

        // 1 where the pixel belongs to the focus craft (near its screen spot and depth).
        float craftMask(vec2 uv, float viewDepth) {
          vec2 e = (uv - uCraftUv) / uCraftRadius;
          float inside = 1.0 - smoothstep(0.7, 1.0, dot(e, e));
          float near = 1.0 - smoothstep(uCraftDepth + 1.5, uCraftDepth + 3.5, viewDepth);
          return inside * near;
        }

        void main() {
          vec3 base = texture2D(tColor, vUv).rgb;
          if (uStrength <= 0.001) {
            gl_FragColor = vec4(base, 1.0);
          } else {
            float d = texture2D(tDepth, vUv).x;
            vec3 vp = viewPos(vUv, d);
            vec4 prev = uProj * vec4(vp + uOffset, 1.0);
            vec2 vel = vUv - (prev.xy / prev.w * 0.5 + 0.5);
            if (prev.w <= 0.0) vel = vec2(0.0);
            float len = length(vel);
            if (len > ${MAX_BLUR.toFixed(4)}) vel *= ${MAX_BLUR.toFixed(4)} / len;
            vel *= uStrength * (1.0 - craftMask(vUv, -vp.z));

            if (dot(vel, vel) < 1e-8) {
              gl_FragColor = vec4(base, 1.0);
            } else {
              float jitter = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453) - 0.5;
              vec3 sum = base;
              float wsum = 1.0;
              for (int i = 0; i < TAPS; i++) {
                float s = (float(i) + 0.5 + jitter) / float(TAPS) - 0.5;
                vec2 uv = clamp(vUv + vel * s, vec2(0.0), vec2(1.0));
                float td = texture2D(tDepth, uv).x;
                float w = 1.0 - craftMask(uv, -viewPos(uv, td).z);
                sum += texture2D(tColor, uv).rgb * w;
                wsum += w;
              }
              gl_FragColor = vec4(sum / wsum, 1.0);
            }
          }
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
      depthTest: false,
      depthWrite: false,
    });

    this.quadScene = new THREE.Scene();
    this.quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.material);
    quad.frustumCulled = false;
    this.quadScene.add(quad);
  }

  setSize(w, h) {
    const pr = this.renderer.getPixelRatio();
    this.target.setSize(Math.floor(w * pr), Math.floor(h * pr));
  }

  // craft: the craft the camera is chasing, or null when blur should fade out.
  update(dt, camera, craft) {
    const speed = craft && craft.crashTime <= 0 ? craft.speed : 0;
    const want = clamp((speed - BLUR_START) / (BLUR_FULL - BLUR_START), 0, 1);
    this.strength += (want - this.strength) * Math.min(1, dt * 4);
    const u = this.material.uniforms;
    u.uStrength.value = this.strength < 0.01 ? 0 : this.strength * this.strength * (3 - 2 * this.strength);
    if (!craft || u.uStrength.value === 0) return;

    camera.updateMatrixWorld();
    u.uProj.value.copy(camera.projectionMatrix);
    u.uProjInv.value.copy(camera.projectionMatrixInverse);

    // Previous camera = current camera moved back along the craft's velocity.
    // A static point's view position in that camera is vp + R^-1 * (vel * shutter).
    _v.copy(craft.vel).multiplyScalar(SHUTTER);
    camera.getWorldQuaternion(_q).invert();
    u.uOffset.value.copy(_v.applyQuaternion(_q));

    // Screen-space footprint of the craft for masking.
    _v.set(craft.pos.x, craft.pos.y + 0.7, craft.pos.z).applyMatrix4(camera.matrixWorldInverse);
    const depth = Math.max(0.5, -_v.z);
    _v.applyMatrix4(camera.projectionMatrix);
    u.uCraftUv.value.set(_v.x * 0.5 + 0.5, _v.y * 0.5 + 0.5);
    u.uCraftDepth.value = depth;
    const ry = 2.4 / (depth * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2)) * 0.5;
    u.uCraftRadius.value.set(ry / camera.aspect, ry);
  }

  render(scene, camera) {
    const r = this.renderer;
    r.setRenderTarget(this.target);
    r.render(scene, camera);
    r.setRenderTarget(null);
    r.render(this.quadScene, this.quadCam);
  }
}
