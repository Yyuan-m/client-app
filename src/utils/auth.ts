/**
 * 鉴权工具 - token / refresh token / 用户信息 / 清理缓存
 *
 * 适配 uni-app 多端存储：通过 uni.getStorageSync / uni.setStorageSync / uni.removeStorageSync
 * （小程序 / App / H5 三端通用，H5 端 uni 实现底层仍走 localStorage）
 */

const TOKEN_KEY = 'lux_customer_token'
const REFRESH_TOKEN_KEY = 'lux_customer_refresh_token'
const USER_KEY = 'lux_customer_user'
const CART_KEY = 'lux_customer_cart'
const FAVORITES_KEY = 'lux_customer_favorites'

/** 用户信息类型（与后端 LoginMemberVO / MemberInfoVO 对齐） */
export interface UserInfo {
  id?: number
  username?: string
  nickname?: string
  phone?: string
  email?: string
  avatar?: string
  realName?: string
  idCard?: string
  driverLicense?: string
  idCardFront?: string
  idCardBack?: string
  driverLicenseFront?: string
  driverLicenseBack?: string
  birthDate?: string
  driverLicenseExpire?: string
  verifyStatus?: 'unverified' | 'pending' | 'verified' | 'rejected'
  [key: string]: any
}

/** uni storage 同步读写封装（uni 端原生 API） */
function getSync(key: string): string {
  try {
    const v = uni.getStorageSync(key)
    return v ?? ''
  } catch {
    return ''
  }
}

function setSync(key: string, value: string): void {
  try {
    uni.setStorageSync(key, value)
  } catch (e) {
    console.error('[auth] setStorage failed:', key, e)
  }
}

function removeSync(key: string): void {
  try {
    uni.removeStorageSync(key)
  } catch (e) {
    console.error('[auth] removeStorage failed:', key, e)
  }
}

export const auth = {
  /** ---------- Access Token ---------- */
  getToken(): string {
    return getSync(TOKEN_KEY)
  },
  setToken(token: string): void {
    setSync(TOKEN_KEY, token)
  },
  removeToken(): void {
    removeSync(TOKEN_KEY)
  },

  /** ---------- Refresh Token ---------- */
  getRefreshToken(): string {
    return getSync(REFRESH_TOKEN_KEY)
  },
  setRefreshToken(token: string): void {
    setSync(REFRESH_TOKEN_KEY, token)
  },
  removeRefreshToken(): void {
    removeSync(REFRESH_TOKEN_KEY)
  },

  /** ---------- 用户信息 ---------- */
  getUser<T extends UserInfo = UserInfo>(): T | null {
    const raw = getSync(USER_KEY)
    if (!raw) return null
    try {
      return JSON.parse(raw) as T
    } catch {
      return null
    }
  },
  setUser(user: UserInfo): void {
    setSync(USER_KEY, JSON.stringify(user))
  },
  removeUser(): void {
    removeSync(USER_KEY)
  },

  /** ---------- 登录状态 ---------- */
  isLoggedIn(): boolean {
    return !!this.getToken()
  },

  /** ---------- 清理全部登录缓存 ---------- */
  clearAll(): void {
    this.removeToken()
    this.removeRefreshToken()
    this.removeUser()
    removeSync(CART_KEY)
    removeSync(FAVORITES_KEY)
  }
}

/** 路由白名单（无需登录可访问） */
export const WHITE_LIST: string[] = [
  '/',
  '/pages/home/index',
  '/pages/vehicle/list',
  '/pages/vehicle/detail',
  '/pages/about/index',
  '/pages/contact/index',
  '/pages/announcement/list',
  '/pages/announcement/detail',
  '/pages/auth/login',
  '/pages/auth/register',
  '/pages/auth/forgot-password'
]

/** 路由白名单判断（精确或前缀匹配，除根路径外） */
export function isWhitePath(path: string): boolean {
  return WHITE_LIST.some((p) => path === p || (p !== '/' && path.startsWith(p)))
}
