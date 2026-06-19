import { Geometry, Mesh, Program } from 'ogl'
import type { OGLRenderingContext } from 'ogl'
import {
  CLOUD_HEIGHT,
  CLOUD_HEIGHT_SEGMENTS,
  CLOUD_MAX_RADIUS,
  CLOUD_MIN_Y,
  CLOUD_RADIAL_SEGMENTS,
} from './constants'
import { loadTexture } from './texture'
import cloudTilePicUrl from '/src/assets/textures/tile.jpg?url'

function createConeGeometry(gl: OGLRenderingContext): Geometry {
  // 按圆周和高度分段生成锥体顶点、UV 和索引
  const vertexCount = (CLOUD_HEIGHT_SEGMENTS + 1) * (CLOUD_RADIAL_SEGMENTS + 1)
  const positions = new Float32Array(vertexCount * 3)
  const uvs = new Float32Array(vertexCount * 2)
  const indices = new Uint16Array(
    CLOUD_HEIGHT_SEGMENTS * CLOUD_RADIAL_SEGMENTS * 6
  )

  let vertexIndex = 0
  let uvIndex = 0
  // 生成从锥尖到外圈的顶点和 UV
  for (let yIndex = 0; yIndex <= CLOUD_HEIGHT_SEGMENTS; yIndex++) {
    const v = yIndex / CLOUD_HEIGHT_SEGMENTS
    const y = CLOUD_MIN_Y + v * CLOUD_HEIGHT
    const radius = v * CLOUD_MAX_RADIUS

    for (let radialIndex = 0; radialIndex <= CLOUD_RADIAL_SEGMENTS; radialIndex++) {
      const u = radialIndex / CLOUD_RADIAL_SEGMENTS
      const angle = u * Math.PI * 2

      positions[vertexIndex] = Math.cos(angle) * radius
      positions[vertexIndex + 1] = y
      positions[vertexIndex + 2] = Math.sin(angle) * radius
      vertexIndex += 3

      uvs[uvIndex] = u
      uvs[uvIndex + 1] = v
      uvIndex += 2
    }
  }

  let indexOffset = 0
  // 将相邻两圈顶点连接成三角面
  for (let yIndex = 0; yIndex < CLOUD_HEIGHT_SEGMENTS; yIndex++) {
    for (let radialIndex = 0; radialIndex < CLOUD_RADIAL_SEGMENTS; radialIndex++) {
      const rowStart = yIndex * (CLOUD_RADIAL_SEGMENTS + 1)
      const nextRowStart = (yIndex + 1) * (CLOUD_RADIAL_SEGMENTS + 1)
      const a = rowStart + radialIndex
      const b = nextRowStart + radialIndex
      const c = nextRowStart + radialIndex + 1
      const d = rowStart + radialIndex + 1

      indices[indexOffset] = a
      indices[indexOffset + 1] = b
      indices[indexOffset + 2] = d
      indices[indexOffset + 3] = b
      indices[indexOffset + 4] = c
      indices[indexOffset + 5] = d
      indexOffset += 6
    }
  }

  // 组装锥体几何，作为星云 shader 的空间载体
  return new Geometry(gl, {
    position: { size: 3, data: positions },
    uv: { size: 2, data: uvs },
    index: { data: indices },
  })
}

export function createCloudCone(gl: OGLRenderingContext): Mesh {
  // 加载可平铺云纹理，作为星云密度采样源
  const cloudTexture = loadTexture(gl, cloudTilePicUrl, {
    wrapS: gl.REPEAT,
    wrapT: gl.REPEAT,
    generateMipmaps: true,
    minFilter: gl.LINEAR_MIPMAP_LINEAR,
    magFilter: gl.LINEAR,
  })

  // 创建星云 shader，通过滚动 UV 和调色函数生成动态云雾
  const program = new Program(gl, {
    vertex: /* glsl */ `
      precision highp float;

      attribute vec3 position;
      attribute vec2 uv;

      uniform mat4 modelMatrix;
      uniform mat4 viewMatrix;
      uniform mat4 projectionMatrix;

      varying vec2 vUv;
      varying float vCost;

      void main(void) {
        vUv = uv;
        vCost = 1.0 - max(-position.y, 0.0) / 3.5;
        gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(position, 1.0);
      }
    `,
    fragment: /* glsl */ `
      precision highp float;

      uniform sampler2D tMap;
      uniform float uTime;
      uniform float uGlobalAlpha;

      varying vec2 vUv;
      varying float vCost;

      vec3 palette(float t) {
        vec3 a = vec3(0.300, 0.460, 0.830);
        vec3 b = vec3(0.240, 0.158, 0.298);
        vec3 c = vec3(1.000, 1.000, 1.000);
        vec3 d = vec3(0.710, 1.323, 0.788);

        return a + b * cos(6.28318 * (c * t + d));
      }

      void main(void) {
        vec4 texel = texture2D(tMap, vec2(vUv.x, vUv.y - uTime));
        float alpha = texel.r * 0.7 * vCost * uGlobalAlpha;
        vec3 color = palette(vUv.x + vUv.y - uTime) * alpha;

        gl_FragColor = vec4(color, alpha);
      }
    `,
    uniforms: {
      tMap: { value: cloudTexture },
      uTime: { value: 0 },
      uGlobalAlpha: { value: 0 },
    },
    transparent: true,
    depthTest: false,
    depthWrite: false,
    cullFace: false,
  })
  // 星云使用加法混合，叠加到深色背景和星点上
  program.setBlendFunc(gl.ONE, gl.ONE)

  // 返回锥体网格，锥体本身只作为 shader 承载面
  return new Mesh(gl, {
    geometry: createConeGeometry(gl),
    program,
    frustumCulled: false,
    renderOrder: 0,
  })
}
