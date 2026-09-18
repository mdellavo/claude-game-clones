import * as THREE from 'three';

// Shared uniforms: the active screen rectangle (everything outside is dimmed, like the
// NES only ever showing one screen) and a clock for water shimmer.
export const worldUniforms = {
  uBounds: { value: new THREE.Vector4(0, 0, 16, 11) },
  uDim: { value: 0.28 },
  uTime: { value: 0 },
};

export function patchWorldMaterial(mat, { water = false } = {}) {
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uBounds = worldUniforms.uBounds;
    shader.uniforms.uDim = worldUniforms.uDim;
    shader.uniforms.uTime = worldUniforms.uTime;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWorldPosZ;')
      .replace(
        '#include <project_vertex>',
        `#include <project_vertex>
        vec4 zwp = vec4(transformed, 1.0);
        #ifdef USE_INSTANCING
        zwp = instanceMatrix * zwp;
        #endif
        vWorldPosZ = (modelMatrix * zwp).xyz;`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWorldPosZ;\nuniform vec4 uBounds;\nuniform float uDim;\nuniform float uTime;')
      .replace(
        '#include <dithering_fragment>',
        `#include <dithering_fragment>
        ${water ? `
        float wv = sin(vWorldPosZ.x * 2.7 + uTime * 1.7) * sin(vWorldPosZ.z * 2.3 - uTime * 1.3);
        float sparkle = smoothstep(0.82, 1.0, wv);
        gl_FragColor.rgb += vec3(0.05, 0.08, 0.12) * wv + vec3(0.5) * sparkle * 0.35;` : ''}
        float dx = max(max(uBounds.x - vWorldPosZ.x, vWorldPosZ.x - uBounds.z), 0.0);
        float dz = max(max(uBounds.y - vWorldPosZ.z, vWorldPosZ.z - uBounds.w), 0.0);
        float outside = smoothstep(0.0, 0.6, max(dx, dz));
        gl_FragColor.rgb *= mix(1.0, uDim, outside);`,
      );
  };
  mat.customProgramCacheKey = () => (water ? 'zworld-water' : 'zworld');
  return mat;
}
