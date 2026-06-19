import { Post } from 'ogl'
import type { Camera, OGLRenderingContext, Transform } from 'ogl'
import { SHARPEN_STRENGTH } from './constants'

type SharpenRenderOptions = {
  scene: Transform
  camera: Camera
  sort?: boolean
}

type SharpenPost = {
  resize: () => void
  render: (options: SharpenRenderOptions) => void
}

export function createSharpenPost(gl: OGLRenderingContext): SharpenPost {
  const post = new Post(gl, {
    depth: true,
  })

  // 使用四邻域锐化核，模拟原版 Babylon 后处理中的锐化观感
  const pass = post.addPass({
    fragment: /* glsl */ `
      precision highp float;

      uniform sampler2D tMap;
      uniform vec2 uResolution;
      uniform float uStrength;

      varying vec2 vUv;

      void main(void) {
        vec2 texel = 1.0 / uResolution;
        vec3 center = texture2D(tMap, vUv).rgb;
        vec3 top = texture2D(tMap, vUv + vec2(0.0, texel.y)).rgb;
        vec3 bottom = texture2D(tMap, vUv - vec2(0.0, texel.y)).rgb;
        vec3 left = texture2D(tMap, vUv - vec2(texel.x, 0.0)).rgb;
        vec3 right = texture2D(tMap, vUv + vec2(texel.x, 0.0)).rgb;
        vec3 sharpened = center * (1.0 + 4.0 * uStrength) - (top + bottom + left + right) * uStrength;

        gl_FragColor = vec4(max(sharpened, 0.0), 1.0);
      }
    `,
    uniforms: {
      uResolution: { value: [1, 1] },
      uStrength: { value: SHARPEN_STRENGTH },
    },
  })

  function syncResolution(): void {
    pass.uniforms.uResolution.value = [post.resolutionWidth, post.resolutionHeight]
  }

  syncResolution()

  return {
    resize() {
      // 同步离屏渲染目标尺寸，确保采样步长匹配当前 DPR
      post.resize()
      syncResolution()
    },
    render(options: SharpenRenderOptions) {
      // 先渲染场景到离屏纹理，再执行锐化 pass 输出到画布
      post.render(options)
    },
  }
}
