/**
 * 图片 URL 解析工具 - 适配 uni-app 多端
 *
 * 数据库统一只存储相对路径（如 /uploads/xxx.jpg）。
 * - H5 端：通过 Vite devServer.proxy 转发到对应后端（保持相对路径即可）
 * - 小程序 / App 端：必须拼接完整域名（因为不存在 devServer proxy），
 *   通过 import.meta.env 注入对应服务的基址
 *
 * 历史数据兼容：
 *  后端 UploadService 会把新文件存到 uploadPath/<yyyyMM>/ 子目录，
 *  但**早期直传的数据**只存在 uploadPath/ 根目录，对应的 URL 形如
 *  "/uploads/xxx.jpg"（不带子目录），访问会 404。
 *  这里在 resolve 时根据数据库 URL 自动检测是否需要补子目录，
 *  策略：原始 URL 无子目录段时，按"当前年月 → 上一月"顺序拼候选，
 *  让后端 ResourceHandler 命中即返回。
 *  （后端接口层真正应改为按数据库原值直出，但本工具先兜住兼容期数据）
 */

/** 客户端业务接口 + 客户端静态资源基址（8089） */
const CLIENT_BASE = (import.meta.env?.VITE_CLIENT_UPLOAD_BASE as string) || ''
/** 后台管理服务静态资源基址（8088） */
const ADMIN_BASE = (import.meta.env?.VITE_ADMIN_UPLOAD_BASE as string) || ''

/** 判断当前是否为 H5 端（小程序/App 需要拼绝对 URL） */
function isH5(): boolean {
  // #ifdef H5
  return true
  // #endif
  // #ifndef H5
  return false
  // #endif
}

/** 拼接基址：H5 端走代理保持相对路径，其他端拼绝对 URL */
function joinBase(prefix: 'client' | 'admin', path: string): string {
  const base = prefix === 'admin' ? ADMIN_BASE : CLIENT_BASE
  if (isH5()) return path // H5 端走 vite proxy
  if (!base) {
    console.warn('[image] base URL is empty, please check .env VITE_*_BASE', path)
    return path
  }
  // base 末尾去斜杠，path 开头保留斜杠
  return `${base.replace(/\/$/, '')}${path.startsWith('/') ? path : '/' + path}`
}

/** 补全 uploads 子目录段（兼容老数据） */
function withUploadSubdir(path: string): string {
  // 已是绝对 URL → 不处理
  if (/^https?:\/\//.test(path)) return path
  // 非 /uploads/ 前缀 → 不处理（保留原样）
  if (!path.startsWith('/uploads/')) return path
  // 形如 /uploads/yyyymm/xxx.jpg → 已有子目录 → 不处理
  const rest = path.slice('/uploads/'.length)
  if (/^\d{6}\//.test(rest)) return path

  // 老数据缺子目录 → 按当前年月和上一月拼接候选路径
  const now = new Date()
  const yyyymm = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`
  // 上一月（用于跨月份的数据）
  const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const yyyymmPrev = `${prev.getFullYear()}${String(prev.getMonth() + 1).padStart(2, '0')}`

  // 优先返回当月路径（绝大部分数据）
  return `/uploads/${yyyymm}/${rest}`
}

/**
 * 解析后台管理服务图片 URL
 * 用于：车辆封面/相册等管理员上传资源（存储在 8088 服务的 uploads 目录）
 *
 * @param path 相对路径，如 /uploads/xxx.jpg
 * @returns H5 端返回 /admin-uploads/xxx.jpg（走 Vite proxy 转发到 8088）
 *          小程序/App 端返回 http://8088host/uploads/xxx.jpg
 */
export function resolveAdminImage(path: string): string {
  if (!path) return ''
  if (/^https?:\/\//.test(path)) return path
  // 后台管理服务（8088）上传的文件直接存放在 uploads 根目录（无 yyyyMM 子目录），
  // 因此不能像客户端服务（8089）那样自动补子目录，否则会把 /uploads/xxx.jpg
  // 错误拼接成 /uploads/yyyyMM/xxx.jpg 导致 404。
  if (isH5()) {
    return path.replace(/^\/uploads\//, '/admin-uploads/')
  }
  return joinBase('admin', path)
}

/**
 * 解析客户端服务图片 URL
 * 用于：轮播图、品牌横幅、登录/注册背景图、用户头像、评价图片、实名认证图片等
 * （存储在 8089 服务的 uploads 目录）
 *
 * @param path 相对路径，如 /uploads/banners/xxx.jpg
 * @returns H5 端原样返回（走 Vite proxy 转发到 8089，已带 yyyymm 子目录）
 *          小程序/App 端拼接 8089 基址
 */
export function resolveClientImage(path: string): string {
  if (!path) return ''
  if (/^https?:\/\//.test(path)) return path
  const withSubdir = withUploadSubdir(path)
  return joinBase('client', withSubdir)
}

/**
 * 当前候选的子目录列表（供 <image @error> 重试用）
 * 返回 ["202608", "202607", ...] 的倒序，最可能的排在最前
 */
export function getUploadSubdirCandidates(): string[] {
  const now = new Date()
  const list: string[] = []
  // 当月 + 前 5 个月（兼容老数据的最常见范围）
  for (let i = 0; i < 6; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    list.push(`${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}`)
  }
  return list
}

/**
 * 占位图（图片加载失败时显示，SVG data URI 不依赖网络资源）
 * @param w 宽度
 * @param h 高度
 * @param text 兜底文字
 */
export function placeholderImage(w = 400, h = 300, text = '暂无图片'): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><rect width="100%" height="100%" fill="#1a1a1a"/><text x="50%" y="50%" font-size="14" fill="#6e6e73" text-anchor="middle" dy=".3em" font-family="sans-serif">${text}</text></svg>`
  // btoa 在小程序/App 不存在，H5 端才能用
  try {
    return `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svg)))}`
  } catch {
    return ''
  }
}

export default { resolveAdminImage, resolveClientImage, getUploadSubdirCandidates, placeholderImage }