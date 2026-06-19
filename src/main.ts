import './style.css'
import {
  Camera,
  Geometry,
  Mesh,
  Program,
  Renderer,
  Texture,
  Transform,
} from 'ogl'
import type { TextureOptions } from 'ogl'

const STAR_COUNT = 1500
const STAR_LIFE_TIME = 20
const STAR_SPEED = 2
const STAR_SIZE_MIN = 20
const STAR_SIZE_MAX = 25
const STAR_SIZE_NEAR_DEPTH = 0
const STAR_SIZE_FAR_DEPTH = 55
const STAR_SIZE_DEPTH_CURVE = 1.4
const STAR_SIZE_FAR_SCALE = 0.08
const STAR_SIZE_NEAR_SCALE = 1.05
const CAMERA_FOV = 1.2 * 180 / Math.PI
const CAMERA_SENSIBILITY = 5
const CLEAR_COLOR = [2 / 255, 6 / 255, 25 / 255, 1] as const
const CAMERA_BASE_POSITION: [number, number, number] = [0, 50, 0]
const CAMERA_BASE_TARGET: [number, number, number] = [0, 0, 0]

// 创建全屏 canvas，作为 WebGL 渲染目标
const canvas = document.createElement('canvas')
canvas.id = 'bg'
canvas.setAttribute('aria-label', 'WebGL Starfield')
document.body.appendChild(canvas)

// 初始化 OGL 渲染器，并设置深空背景色
const renderer = new Renderer({
  canvas,
  antialias: true,
  dpr: Math.min(window.devicePixelRatio || 1, 2),
  alpha: false,
  depth: true,
})
const gl = renderer.gl
gl.clearColor(CLEAR_COLOR[0], CLEAR_COLOR[1], CLEAR_COLOR[2], CLEAR_COLOR[3])

// 初始化场景和俯视相机
const scene = new Transform()
const camera = new Camera(gl, {
  fov: CAMERA_FOV,
  near: 0.01,
  far: 1000,
})
camera.position.set(
  CAMERA_BASE_POSITION[0],
  CAMERA_BASE_POSITION[1],
  CAMERA_BASE_POSITION[2]
)
camera.up.set(0, 0, -1)
camera.lookAt(CAMERA_BASE_TARGET)

// 记录鼠标映射后的目标平移量
const inputTarget = {
  x: 0,
  z: 0,
}
let pageVisible = true

function loadTexture(
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

function transitionAnimation(from: number, to: number, rate: number): number {
  return from + (to - from) * Math.min(rate, 1)
}

function updatePointer(clientX: number, clientY: number): void {
  // 将鼠标位置转换为以屏幕中心为原点的相机平移目标
  inputTarget.x = clientX / document.body.clientWidth - 0.5
  inputTarget.z = clientY / document.body.clientHeight - 0.5
}

function createStarfield(): Mesh {
  // 准备点精灵需要的几何属性
  const positions = new Float32Array(STAR_COUNT * 3)
  const colors = new Float32Array(STAR_COUNT * 3)
  const sizes = new Float32Array(STAR_COUNT)
  const phases = new Float32Array(STAR_COUNT)

  // 随机生成每颗星星的初始位置、颜色、尺寸和生命周期相位
  for (let index = 0; index < STAR_COUNT; index++) {
    const positionOffset = index * 3
    const colorOffset = index * 3
    const colorMix = Math.random()

    // 生成星星在发射平面上的初始位置
    positions[positionOffset] = Math.random() * 100 - 50
    positions[positionOffset + 1] = 0
    positions[positionOffset + 2] = Math.random() * 60 - 30

    // 在紫色和青色之间插值生成星星颜色
    colors[colorOffset] = (134 + (8 - 134) * colorMix) / 255
    colors[colorOffset + 1] = (13 + (255 - 13) * colorMix) / 255
    colors[colorOffset + 2] = (255 + (214 - 255) * colorMix) / 255

    // 设置基础尺寸和生命周期偏移，避免所有星星同步闪烁
    sizes[index] = Math.random() * (STAR_SIZE_MAX - STAR_SIZE_MIN) + STAR_SIZE_MIN
    phases[index] = Math.random() * STAR_LIFE_TIME
  }

  // 加载星星贴图，使用红色通道作为亮度和透明度权重
  const starTexture = loadTexture('/assets/textures/star.jpg', {
    generateMipmaps: true,
    minFilter: gl.LINEAR_MIPMAP_LINEAR,
    magFilter: gl.LINEAR,
  })
  // 组装点精灵几何属性
  const geometry = new Geometry(gl, {
    position: { size: 3, data: positions },
    color: { size: 3, data: colors },
    size: { size: 1, data: sizes },
    phase: { size: 1, data: phases },
  })
  // 创建星星 shader，在 GPU 中计算生命周期、远近缩放和贴图着色
  const program = new Program(gl, {
    vertex: /* glsl */ `
      precision highp float;

      attribute vec3 position;
      attribute vec3 color;
      attribute float size;
      attribute float phase;

      uniform mat4 modelMatrix;
      uniform mat4 viewMatrix;
      uniform mat4 projectionMatrix;
      uniform float uTime;
      uniform float uPixelRatio;

      varying vec3 vColor;
      varying float vAgeAlpha;

      const float LIFE_TIME = ${STAR_LIFE_TIME.toFixed(1)};
      const float STAR_SPEED = ${STAR_SPEED.toFixed(1)};
      const float SIZE_NEAR_DEPTH = ${STAR_SIZE_NEAR_DEPTH.toFixed(1)};
      const float SIZE_FAR_DEPTH = ${STAR_SIZE_FAR_DEPTH.toFixed(1)};
      const float SIZE_DEPTH_CURVE = ${STAR_SIZE_DEPTH_CURVE.toFixed(1)};
      const float SIZE_FAR_SCALE = ${STAR_SIZE_FAR_SCALE.toFixed(2)};
      const float SIZE_NEAR_SCALE = ${STAR_SIZE_NEAR_SCALE.toFixed(2)};

      void main(void) {
        float age = mod(uTime + phase, LIFE_TIME);
        float glow = smoothstep(0.0, 1.5, age);
        float gloom = 1.0 - smoothstep(LIFE_TIME - 2.0, LIFE_TIME, age);
        vec3 worldPosition = vec3(position.x, age * STAR_SPEED, position.z);

        vColor = color;
        vAgeAlpha = glow * gloom;

        vec4 viewPosition = viewMatrix * modelMatrix * vec4(worldPosition, 1.0);
        float depth = max(-viewPosition.z, 0.001);
        float depthRange = max(SIZE_FAR_DEPTH - SIZE_NEAR_DEPTH, 0.001);
        float nearFactor = pow(clamp((SIZE_FAR_DEPTH - depth) / depthRange, 0.0, 1.0), SIZE_DEPTH_CURVE);
        float perspectiveScale = mix(SIZE_FAR_SCALE, SIZE_NEAR_SCALE, nearFactor);

        gl_Position = projectionMatrix * viewPosition;
        gl_PointSize = size * perspectiveScale * uPixelRatio;
      }
    `,
    fragment: /* glsl */ `
      precision highp float;

      uniform sampler2D tMap;
      uniform float uGlobalAlpha;

      varying vec3 vColor;
      varying float vAgeAlpha;

      void main(void) {
        vec4 texel = texture2D(tMap, gl_PointCoord);
        float alpha = texel.r * vAgeAlpha;
        vec3 color = mix(vColor, vec3(1.0, 0.8, 0.3), texel.r) * alpha * uGlobalAlpha;

        gl_FragColor = vec4(color, 1.0);
      }
    `,
    uniforms: {
      tMap: { value: starTexture },
      uTime: { value: 0 },
      uPixelRatio: { value: renderer.dpr },
      uGlobalAlpha: { value: 0 },
    },
    transparent: true,
    depthTest: false,
    depthWrite: false,
    cullFace: false,
  })
  // 星星使用加法混合，叠加出发光效果
  program.setBlendFunc(gl.ONE, gl.ONE)

  // 返回以 gl.POINTS 绘制的星星网格
  return new Mesh(gl, {
    geometry,
    program,
    mode: gl.POINTS,
    frustumCulled: false,
    renderOrder: 1,
  })
}

function createConeGeometry(): Geometry {
  // 按圆周和高度分段生成锥体顶点、UV 和索引
  const radialSegments = 96
  const heightSegments = 18
  const vertexCount = (heightSegments + 1) * (radialSegments + 1)
  const positions = new Float32Array(vertexCount * 3)
  const uvs = new Float32Array(vertexCount * 2)
  const indices = new Uint16Array(heightSegments * radialSegments * 6)

  let vertexIndex = 0
  let uvIndex = 0
  // 生成从锥尖到外圈的顶点和 UV
  for (let yIndex = 0; yIndex <= heightSegments; yIndex++) {
    const v = yIndex / heightSegments
    const y = -5 + v * 80
    const radius = v * 50

    for (let radialIndex = 0; radialIndex <= radialSegments; radialIndex++) {
      const u = radialIndex / radialSegments
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
  for (let yIndex = 0; yIndex < heightSegments; yIndex++) {
    for (let radialIndex = 0; radialIndex < radialSegments; radialIndex++) {
      const rowStart = yIndex * (radialSegments + 1)
      const nextRowStart = (yIndex + 1) * (radialSegments + 1)
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

function createCloudCone(): Mesh {
  // 加载可平铺云纹理，作为星云密度采样源
  const cloudTexture = loadTexture('/assets/textures/tile.jpg', {
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
    geometry: createConeGeometry(),
    program,
    frustumCulled: false,
    renderOrder: 0,
  })
}

// 创建星云层和星星层，并挂载到同一个场景根节点
const cloudCone = createCloudCone()
const starfield = createStarfield()
cloudCone.setParent(scene)
starfield.setParent(scene)

function resize(): void {
  // 同步 canvas 像素尺寸和相机投影比例
  renderer.setSize(window.innerWidth, window.innerHeight)
  camera.perspective({
    aspect: gl.canvas.width / gl.canvas.height,
  })
  // 同步 DPR，保证点精灵在高分屏上尺寸一致
  starfield.program.uniforms.uPixelRatio.value = renderer.dpr
}

function updateCamera(delta: number): void {
  // 页面不可见时跳过相机插值
  if (!pageVisible) {
    return
  }

  // 平滑移动相机位置，模拟视点在星空中轻微平移
  camera.position.x = transitionAnimation(
    camera.position.x,
    CAMERA_BASE_POSITION[0] + inputTarget.x * CAMERA_SENSIBILITY,
    delta * 3
  )
  camera.position.z = transitionAnimation(
    camera.position.z,
    CAMERA_BASE_POSITION[2] + inputTarget.z * CAMERA_SENSIBILITY,
    delta * 3
  )

  // 目标点跟随相机同步平移，保持视线方向不变
  camera.lookAt([
    CAMERA_BASE_TARGET[0] + camera.position.x - CAMERA_BASE_POSITION[0],
    CAMERA_BASE_TARGET[1],
    CAMERA_BASE_TARGET[2] + camera.position.z - CAMERA_BASE_POSITION[2],
  ])
}

function animate(now: number): void {
  requestAnimationFrame(animate)

  // 计算帧时间和整体淡入进度
  const time = now * 0.001
  const delta = Math.min(time - previousTime, 0.05)
  previousTime = time
  globalAlpha = Math.min(globalAlpha + delta, 1)

  // 更新相机位置
  updateCamera(delta)

  // 更新星星和星云 shader 时间参数
  starfield.program.uniforms.uTime.value = time
  starfield.program.uniforms.uGlobalAlpha.value = globalAlpha
  cloudCone.program.uniforms.uTime.value = time * 0.02
  cloudCone.program.uniforms.uGlobalAlpha.value = globalAlpha

  // 渲染当前帧
  renderer.render({
    scene,
    camera,
    sort: true,
  })
}

// 注册窗口尺寸变化和指针输入事件
window.addEventListener('resize', resize)
window.addEventListener('mousemove', function (event) {
  updatePointer(event.clientX, event.clientY)
})
window.addEventListener('touchstart', function (event) {
  if (event.touches.length === 1) {
    updatePointer(event.touches[0].clientX, event.touches[0].clientY)
  }
})
document.addEventListener('visibilitychange', function () {
  pageVisible = document.visibilityState === 'visible'
})

// 初始化尺寸后启动渲染循环
let previousTime = performance.now() * 0.001
let globalAlpha = 0
resize()
requestAnimationFrame(animate)
