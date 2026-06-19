import { Geometry, Mesh, Program } from 'ogl'
import type { OGLRenderingContext } from 'ogl'
import {
  STAR_COUNT,
  STAR_EMITTER_X_HALF_SIZE,
  STAR_EMITTER_Z_HALF_SIZE,
  STAR_LIFE_TIME,
  STAR_SPEED,
  STAR_WORLD_SIZE_MAX,
  STAR_WORLD_SIZE_MIN,
} from './constants'
import { loadTexture } from './texture'
import starPicUrl from '/src/assets/textures/star.jpg?url'

export function createStarfield(gl: OGLRenderingContext): Mesh {
  // 准备 billboard 基础面片和实例化属性
  const corners = new Float32Array([
    -0.5, -0.5,
    0.5, -0.5,
    -0.5, 0.5,
    0.5, 0.5,
  ])
  const uvs = new Float32Array([
    0, 0,
    1, 0,
    0, 1,
    1, 1,
  ])
  const indices = new Uint16Array([0, 1, 2, 2, 1, 3])
  const basePositions = new Float32Array(STAR_COUNT * 3)
  const colors = new Float32Array(STAR_COUNT * 3)
  const worldSizes = new Float32Array(STAR_COUNT)
  const phases = new Float32Array(STAR_COUNT)

  // 随机生成每颗星星的初始位置、颜色、尺寸和生命周期相位
  for (let index = 0; index < STAR_COUNT; index++) {
    const positionOffset = index * 3
    const colorOffset = index * 3
    const colorMix = Math.random()

    // 生成星星在发射平面上的初始位置
    basePositions[positionOffset] =
      Math.random() * STAR_EMITTER_X_HALF_SIZE * 2 - STAR_EMITTER_X_HALF_SIZE
    basePositions[positionOffset + 1] = 0
    basePositions[positionOffset + 2] =
      Math.random() * STAR_EMITTER_Z_HALF_SIZE * 2 - STAR_EMITTER_Z_HALF_SIZE

    // 在紫色和青色之间插值生成星星颜色
    colors[colorOffset] = (134 + (8 - 134) * colorMix) / 255
    colors[colorOffset + 1] = (13 + (255 - 13) * colorMix) / 255
    colors[colorOffset + 2] = (255 + (214 - 255) * colorMix) / 255

    // 设置基础尺寸和生命周期偏移，避免所有星星同步闪烁
    worldSizes[index] =
      Math.random() * (STAR_WORLD_SIZE_MAX - STAR_WORLD_SIZE_MIN) +
      STAR_WORLD_SIZE_MIN
    phases[index] = Math.random() * STAR_LIFE_TIME
  }

  // 加载星星贴图，使用红色通道作为亮度和透明度权重
  const starTexture = loadTexture(gl, starPicUrl, {
    generateMipmaps: true,
    minFilter: gl.LINEAR_MIPMAP_LINEAR,
    magFilter: gl.LINEAR,
  })

  // 组装实例化 billboard 几何属性
  const geometry = new Geometry(gl, {
    corner: { size: 2, data: corners },
    uv: { size: 2, data: uvs },
    index: { data: indices },
    basePosition: { size: 3, data: basePositions, instanced: 1 },
    color: { size: 3, data: colors, instanced: 1 },
    worldSize: { size: 1, data: worldSizes, instanced: 1 },
    phase: { size: 1, data: phases, instanced: 1 },
  })

  // 创建星星 shader，在 view space 中展开面向相机的世界空间 billboard
  const program = new Program(gl, {
    vertex: /* glsl */ `
      precision highp float;

      attribute vec2 corner;
      attribute vec2 uv;
      attribute vec3 basePosition;
      attribute vec3 color;
      attribute float worldSize;
      attribute float phase;

      uniform mat4 modelMatrix;
      uniform mat4 viewMatrix;
      uniform mat4 projectionMatrix;
      uniform float uTime;

      varying vec2 vUv;
      varying vec3 vColor;
      varying float vAgeAlpha;

      const float LIFE_TIME = ${STAR_LIFE_TIME.toFixed(1)};
      const float STAR_SPEED = ${STAR_SPEED.toFixed(1)};

      void main(void) {
        float age = mod(uTime + phase, LIFE_TIME);
        float glow = smoothstep(0.0, 1.5, age);
        float gloom = 1.0 - smoothstep(LIFE_TIME - 2.0, LIFE_TIME, age);
        vec3 worldPosition = vec3(basePosition.x, age * STAR_SPEED, basePosition.z);

        vUv = uv;
        vColor = color;
        vAgeAlpha = glow * gloom;

        vec4 viewPosition = viewMatrix * modelMatrix * vec4(worldPosition, 1.0);
        viewPosition.xy += corner * worldSize;

        gl_Position = projectionMatrix * viewPosition;
      }
    `,
    fragment: /* glsl */ `
      precision highp float;

      uniform sampler2D tMap;
      uniform float uGlobalAlpha;

      varying vec2 vUv;
      varying vec3 vColor;
      varying float vAgeAlpha;

      void main(void) {
        vec4 texel = texture2D(tMap, vUv);
        float alpha = texel.r * vAgeAlpha;
        vec3 color = mix(vColor, vec3(1.0, 0.8, 0.3), texel.r) * alpha * uGlobalAlpha;

        gl_FragColor = vec4(color, 1.0);
      }
    `,
    uniforms: {
      tMap: { value: starTexture },
      uTime: { value: 0 },
      uGlobalAlpha: { value: 0 },
    },
    transparent: true,
    depthTest: false,
    depthWrite: false,
    cullFace: false,
  })
  // 星星使用加法混合，叠加出发光效果
  program.setBlendFunc(gl.ONE, gl.ONE)

  // 返回以实例化三角面绘制的世界空间 billboard 星星网格
  return new Mesh(gl, {
    geometry,
    program,
    mode: gl.TRIANGLES,
    frustumCulled: false,
    renderOrder: 1,
  })
}
