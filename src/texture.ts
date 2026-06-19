import { Texture } from 'ogl'
import type { OGLRenderingContext, TextureOptions } from 'ogl'

export function loadTexture(
  gl: OGLRenderingContext,
  source: string,
  options: Partial<TextureOptions> = {}
): Texture {
  // 先创建空纹理，图片加载完成后由 OGL 上传到 GPU
  const texture = new Texture(gl, options)
  const image = new Image()
  image.onload = function () {
    texture.image = image
  }
  image.src = source
  return texture
}
