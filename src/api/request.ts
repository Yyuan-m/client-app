/**
 * Axios 等价请求封装 - 适配 uni.request / uni.uploadFile
 *
 * 完整复刻原 Web request.js 全部逻辑：
 *  - token 自动携带 Bearer 头
 *  - GET 请求去重 pendingMap（noDedup 配置可跳过）
 *  - 401 无感 refresh token 刷新 + pendingQueue 请求队列
 *  - 403 权限处理 + 倒计时跳转登录页
 *  - 业务错误统一拦截提示（skipBusinessError 配置可跳过）
 *  - 文件上传封装（uni.uploadFile，支持进度回调）
 *
 * 注意：uni-app 没有响应拦截器机制，采用 Promise 封装在内部统一处理
 */

import { auth } from '@/utils/auth'

/** 后端统一响应结构 { code, msg, data }（与 ./types 保持一致，此处不 export 避免与 types.ts 重复导出冲突） */
interface ApiResult<T = any> {
  code: number
  msg: string
  data: T
}

/** 请求配置（扩展 uniapp 自定义选项） */
export interface RequestOptions<T = any> {
  url?: string
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE'
  params?: Record<string, any>
  data?: any
  headers?: Record<string, string>
  noDedup?: boolean
  skipBusinessError?: boolean
  responseType?: 'text' | 'arraybuffer'
  timeout?: number
  /** 内部使用：标记挂起的去重 key */
  __pendingKey?: string
  /** 透传给 ts 的返回类型 */
  __respType?: T
}

/** 业务错误 */
export interface BusinessError {
  code: number
  msg: string
  response?: UniApp.RequestSuccessCallbackResult
}

/** 被去重取消的请求标记 */
export interface CanceledRequest {
  __canceled: true
}

// ============ 1. baseURL 处理 ============
/** 客户端业务 API 基址（小程序端必须填完整域名） */
const API_BASE: string = (import.meta.env?.VITE_API_BASE as string) || ''

function isH5(): boolean {
  // #ifdef H5
  return true
  // #endif
  // #ifndef H5
  return false
  // #endif
}

function buildUrl(url: string): string {
  if (/^https?:\/\//.test(url)) return url
  if (isH5()) return url // H5 走 vite proxy
  if (!API_BASE) {
    console.warn('[request] API_BASE is empty, please check .env VITE_API_BASE')
    return url
  }
  return `${API_BASE.replace(/\/$/, '')}${url.startsWith('/') ? url : '/' + url}`
}

// ============ 2. GET 请求去重 ============
const pendingMap = new Map<string, true>()

function getPendingKey(options: RequestOptions): string {
  const { method = 'GET', url, params } = options
  return [method, url, JSON.stringify(params || {})].join('&')
}

// ============ 3. 401 无感刷新状态 ============
let isRefreshing = false
let pendingQueue: Array<(newToken: string | null, err?: any) => void> = []
let isRedirecting = false

/** 用 refresh token 换新 token（内联调用，避免与 api/modules/auth 循环依赖） */
async function doRefreshToken(): Promise<{ token: string; refreshToken: string }> {
  const refreshToken = auth.getRefreshToken()
  if (!refreshToken) throw new Error('无 refresh token')
  const res = await request<{ token: string; refreshToken: string }>('/api/auth/refresh-token', {
    method: 'POST',
    data: { refreshToken },
    skipBusinessError: true
  })
  auth.setToken(res.token)
  auth.setRefreshToken(res.refreshToken)
  return res
}

function retryPendingQueue(newToken: string): void {
  pendingQueue.forEach((cb) => cb(newToken))
  pendingQueue = []
}

function rejectPendingQueue(error: any): void {
  pendingQueue.forEach((cb) => cb(null, error))
  pendingQueue = []
}

/** 倒计时 3 秒跳转登录页 */
function showCountdownRedirect(options: { title?: string; messagePrefix?: string } = {}): void {
  if (isRedirecting) return
  isRedirecting = true

  const title = options.title || '登录过期'
  const messagePrefix = options.messagePrefix || '登录状态已失效'

  let seconds = 3
  const updateText = () => `${messagePrefix}，${seconds} 秒后自动跳转登录页…`

  // uni 端使用 showModal 替代 ElMessageBox，但 showModal 不支持实时更新文案
  // 改用 showLoading + 自定义提示（每秒更新一次）
  let timer: ReturnType<typeof setInterval> | null = null

  uni.showModal({
    title,
    content: updateText(),
    showCancel: false,
    confirmText: '立即跳转',
    success: (res) => {
      if (res.confirm && seconds > 0 && timer) {
        clearInterval(timer)
        doRedirectToLogin()
      }
    }
  })

  timer = setInterval(() => {
    seconds--
    if (seconds <= 0) {
      if (timer) clearInterval(timer)
      doRedirectToLogin()
    }
  }, 1000)
}

function doRedirectToLogin(): void {
  if (!isRedirecting) return
  auth.clearAll()

  // 当前页路径
  const pages = getCurrentPages()
  const currentPage = pages[pages.length - 1]
  const currentPath = currentPage ? `/${currentPage.route}` : '/pages/home/index'
  const currentQuery = currentPage ? (currentPage as any).options || {} : {}
  const queryString = Object.keys(currentQuery)
    .map((k) => `${k}=${encodeURIComponent(currentQuery[k])}`)
    .join('&')
  const currentFullPath = queryString ? `${currentPath}?${queryString}` : currentPath

  // 已在登录页则不跳转
  if (currentPath === '/pages/auth/login') {
    isRedirecting = false
    return
  }

  // uni 端：使用 redirectTo 重定向到登录页（带 redirect 参数）
  // 注意：因 store 内存中 token ref 已被下面 setToken('') 等清空操作影响，
  // 这里采用 reLaunch 强制重置页面栈，避免守卫误判
  isRedirecting = false
  const redirect = encodeURIComponent(currentFullPath)
  uni.reLaunch({
    url: `/pages/auth/login?redirect=${redirect}`
  })
}

// ============ 4. 请求核心封装 ============
function isH5Env(): boolean {
  return isH5()
}

/**
 * 核心请求方法 - 完整复刻原 axios 行为
 */
export function request<T = any>(url: string, options: RequestOptions<T> = {}): Promise<T> {
  const {
    method = 'GET',
    params,
    data,
    headers = {},
    noDedup = false,
    skipBusinessError = false,
    responseType,
    timeout = 15000
  } = options

  // GET 请求去重
  if (method === 'GET' && !noDedup) {
    const key = getPendingKey({ ...options, url, method })
    if (pendingMap.has(key)) {
      return Promise.reject({ __canceled: true } as CanceledRequest)
    }
    pendingMap.set(key, true)
    options.__pendingKey = key
  }

  // 自动携带 token
  const token = auth.getToken()
  const finalHeaders: Record<string, string> = { ...headers }
  if (token) {
    finalHeaders.Authorization = `Bearer ${token}`
  }

  // URL + query string 拼接
  let finalUrl = buildUrl(url)
  if (params && Object.keys(params).length) {
    const qs = Object.keys(params)
      .filter((k) => params[k] !== undefined && params[k] !== null)
      .map((k) => `${encodeURIComponent(k)}=${encodeURIComponent(params[k])}`)
      .join('&')
    if (qs) finalUrl += (finalUrl.includes('?') ? '&' : '?') + qs
  }

  return new Promise<T>((resolve, reject) => {
    const isRefreshReq = /\/api\/auth\/refresh-token/.test(url)
    const isLogoutReq = /\/api\/auth\/logout/.test(url)

    uni.request({
      url: finalUrl,
      method,
      data,
      header: finalHeaders,
      responseType: responseType === 'arraybuffer' ? 'arraybuffer' : undefined,
      timeout,
      success: async (resp) => {
        // 清理去重标记
        if (options.__pendingKey) pendingMap.delete(options.__pendingKey)

        const statusCode = resp.statusCode
        const respData = resp.data as ApiResult<T>

        // 401 未授权：access token 过期 → 尝试无感刷新
        if (statusCode === 401 && !isRefreshReq && !isLogoutReq) {
          if (isRedirecting) {
            return reject({ code: 401, msg: '登录状态已失效' })
          }

          // 已有刷新在进行中：挂起当前请求
          if (isRefreshing) {
            return new Promise<T>((resolve2, reject2) => {
              pendingQueue.push((newToken, err) => {
                if (err) {
                  reject2(err)
                  return
                }
                const newHeaders = { ...finalHeaders, Authorization: `Bearer ${newToken}` }
                request<T>(url, { ...options, headers: newHeaders, noDedup: true })
                  .then(resolve2)
                  .catch(reject2)
              })
            }).then(resolve, reject)
          }

          // 发起刷新
          isRefreshing = true
          try {
            const { token: newToken } = await doRefreshToken()
            retryPendingQueue(newToken)
            // 重试原始请求
            const newHeaders = { ...finalHeaders, Authorization: `Bearer ${newToken}` }
            const result = await request<T>(url, { ...options, headers: newHeaders, noDedup: true })
            resolve(result)
          } catch (refreshErr) {
            rejectPendingQueue(refreshErr)
            showCountdownRedirect()
            reject(refreshErr)
          } finally {
            isRefreshing = false
          }
          return
        }

        // logout 请求的 401 静默处理
        if (statusCode === 401 && isLogoutReq) {
          return reject({ code: 401, msg: 'logout failed', response: resp })
        }

        // 403 无权限
        if (statusCode === 403) {
          if (!skipBusinessError && !isRedirecting) {
            showCountdownRedirect({
              title: '暂无权限访问',
              messagePrefix: '暂无权限访问，请重新登录'
            })
          }
          return reject({ code: 403, msg: '暂无权限访问', response: resp })
        }

        // 网络错误 / 其他 HTTP 错误
        if (statusCode < 200 || statusCode >= 300) {
          const msg = (respData && (respData as any).msg) || `请求错误（${statusCode}）`
          console.error('[request] HTTP error:', statusCode, msg)
          return reject({ code: statusCode, msg, response: resp })
        }

        // 成功码 0 或 200
        if (respData.code === 200 || respData.code === 0) {
          resolve(respData.data !== undefined ? respData.data : (respData as any))
          return
        }

        // 业务错误
        if (!skipBusinessError) {
          uni.showToast({ title: respData.msg || '请求失败', icon: 'none' })
        }
        reject({ code: respData.code, msg: respData.msg, response: resp })
      },
      fail: (err) => {
        // 清理去重标记
        if (options.__pendingKey) pendingMap.delete(options.__pendingKey)

        // 取消的请求静默处理
        if ((err as any)?.__canceled) {
          return reject(err)
        }

        const errMsg = err.errMsg || ''
        if (errMsg.includes('timeout')) {
          if (!skipBusinessError) {
            uni.showToast({ title: '请求超时，请重试', icon: 'none' })
          }
        } else {
          if (!skipBusinessError) {
            uni.showToast({ title: '网络异常，请检查网络连接', icon: 'none' })
          }
        }
        reject(err)
      }
    })
  })
}

// ============ 5. 便捷方法 ============
export function get<T = any>(url: string, params?: Record<string, any>, config: RequestOptions<T> = {}): Promise<T> {
  return request<T>(url, { ...config, method: 'GET', params })
}

export function post<T = any>(url: string, data?: any, config: RequestOptions<T> = {}): Promise<T> {
  return request<T>(url, { ...config, method: 'POST', data })
}

export function put<T = any>(url: string, data?: any, config: RequestOptions<T> = {}): Promise<T> {
  return request<T>(url, { ...config, method: 'PUT', data })
}

export function del<T = any>(url: string, config: RequestOptions<T> = {}): Promise<T> {
  return request<T>(url, { ...config, method: 'DELETE' })
}

/** 文件上传（适配 uni.uploadFile，支持进度回调） */
export interface UploadOptions {
  /** 文件字段名（默认 file） */
  name?: string
  /** 额外表单字段 */
  formData?: Record<string, any>
  /** 额外 headers */
  headers?: Record<string, string>
  /** 上传进度回调 */
  onProgress?: (progress: number) => void
  /** 是否跳过业务错误提示 */
  skipBusinessError?: boolean
  /** 超时 */
  timeout?: number
}

export function upload<T = any>(url: string, filePath: string, config: UploadOptions = {}): Promise<T> {
  const { name = 'file', formData = {}, headers = {}, onProgress, skipBusinessError = false, timeout = 60000 } = config

  return new Promise<T>((resolve, reject) => {
    const token = auth.getToken()
    const finalHeaders: Record<string, string> = { ...headers }
    if (token) {
      finalHeaders.Authorization = `Bearer ${token}`
    }

    const finalUrl = buildUrl(url)

    const task = uni.uploadFile({
      url: finalUrl,
      filePath,
      name,
      formData,
      header: finalHeaders,
      timeout,
      success: (resp) => {
        const statusCode = resp.statusCode
        let respData: ApiResult<T>
        try {
          respData = JSON.parse(resp.data) as ApiResult<T>
        } catch {
          return reject({ code: statusCode, msg: '响应解析失败', response: resp })
        }

        if (statusCode === 401) {
          return reject({ code: 401, msg: '登录状态已失效', response: resp })
        }
        if (statusCode === 403) {
          if (!skipBusinessError) {
            uni.showToast({ title: '暂无权限访问', icon: 'none' })
          }
          return reject({ code: 403, msg: '暂无权限访问', response: resp })
        }
        if (statusCode < 200 || statusCode >= 300) {
          if (!skipBusinessError) {
            uni.showToast({ title: respData.msg || `上传失败（${statusCode}）`, icon: 'none' })
          }
          return reject({ code: statusCode, msg: respData.msg, response: resp })
        }

        if (respData.code === 200 || respData.code === 0) {
          resolve(respData.data !== undefined ? respData.data : (respData as any))
        } else {
          if (!skipBusinessError) {
            uni.showToast({ title: respData.msg || '上传失败', icon: 'none' })
          }
          reject({ code: respData.code, msg: respData.msg, response: resp })
        }
      },
      fail: (err) => {
        const errMsg = err.errMsg || ''
        if (errMsg.includes('timeout')) {
          uni.showToast({ title: '上传超时', icon: 'none' })
        } else {
          uni.showToast({ title: '上传失败，请检查网络', icon: 'none' })
        }
        reject(err)
      }
    })

    if (onProgress && task && typeof (task as any).onProgressUpdate === 'function') {
      ;(task as any).onProgressUpdate((res: UniApp.OnProgressUpdateResult) => {
        onProgress(res.progress)
      })
    }
  })
}

export default { request, get, post, put, del, upload }
