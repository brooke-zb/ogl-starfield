import './style.css'
import { Camera, Renderer, Transform } from 'ogl'
import {
  CAMERA_BASE_POSITION,
  CAMERA_BASE_TARGET,
  CAMERA_FOV,
  CAMERA_SENSIBILITY,
  CLEAR_COLOR,
} from './constants'
import { createCloudCone } from './cloudCone'
import { createStarfield } from './starfield'

// 创建全屏 canvas，作为 WebGL 渲染目标
const canvas = document.createElement('canvas')
canvas.id = 'bg'
canvas.setAttribute('aria-label', 'WebGL Starfield')
canvas.style.position = 'fixed'
canvas.style.top = '0'
canvas.style.left = '0'
canvas.style.zIndex = '-1'
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
gl.clearColor(...CLEAR_COLOR)

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

function transitionAnimation(from: number, to: number, rate: number): number {
  return from + (to - from) * Math.min(rate, 1)
}

function updatePointer(clientX: number, clientY: number): void {
  // 将鼠标位置转换为以屏幕中心为原点的相机平移目标
  inputTarget.x = clientX / document.body.clientWidth - 0.5
  inputTarget.z = clientY / document.body.clientHeight - 0.5
}

// 创建星云层和星星层，并挂载到同一个场景根节点
const cloudCone = createCloudCone(gl)
const starfield = createStarfield(gl)
cloudCone.setParent(scene)
starfield.setParent(scene)

function resize(): void {
  // 同步 canvas 像素尺寸和相机投影比例
  renderer.setSize(window.innerWidth, window.innerHeight)
  camera.perspective({
    aspect: gl.canvas.width / gl.canvas.height,
  })
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
window.addEventListener('touchmove', function (event) {
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
