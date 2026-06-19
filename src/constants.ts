// 星星总数，与原版 Babylon 粒子系统容量保持一致
export const STAR_COUNT = 1500

// 单颗星星的生命周期，单位秒
export const STAR_LIFE_TIME = 20

// 星星沿 Y 轴向相机移动的速度，单位为世界坐标每秒
export const STAR_SPEED = 2.5

// 星星 billboard 的最小世界空间尺寸
export const STAR_WORLD_SIZE_MIN = 0.2

// 星星 billboard 的最大世界空间尺寸
export const STAR_WORLD_SIZE_MAX = 0.5

// 星星发射平面在 X 轴方向的半宽度
export const STAR_EMITTER_X_HALF_SIZE = 50

// 星星发射平面在 Z 轴方向的半宽度
export const STAR_EMITTER_Z_HALF_SIZE = 30

// 星云锥体圆周方向分段数，越高轮廓越细腻
export const CLOUD_RADIAL_SEGMENTS = 96

// 星云锥体高度方向分段数，越高 UV 过渡越细腻
export const CLOUD_HEIGHT_SEGMENTS = 18

// 星云锥体最低点 Y 坐标
export const CLOUD_MIN_Y = -5

// 星云锥体从最低点向上的高度
export const CLOUD_HEIGHT = 80

// 星云锥体顶部最大半径
export const CLOUD_MAX_RADIUS = 50

// 相机视场角，使用角度值，等价于原版 Babylon 的 1.2 弧度
export const CAMERA_FOV = 1.2 * 180 / Math.PI

// 鼠标平移相机的灵敏度
export const CAMERA_SENSIBILITY = 5

// 相机基础位置
export const CAMERA_BASE_POSITION: [number, number, number] = [0, 50, 0]

// 相机基础观察目标
export const CAMERA_BASE_TARGET: [number, number, number] = [0, 0, 0]

// 场景清屏背景色，取值范围为 0 到 1 的 RGBA
export const CLEAR_COLOR = [2 / 255, 6 / 255, 25 / 255, 1] as const
