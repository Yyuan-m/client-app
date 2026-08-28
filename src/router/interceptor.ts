/**
 * 全局路由拦截器 - 复刻原 Web 项目 router/guard.js 逻辑
 *
 * uni-app 原生路由通过 pages.json + uni.navigateTo / uni.redirectTo / uni.reLaunch / uni.switchTab
 * 没有 Vue Router 的全局 beforeEach 守卫，这里通过包装 uni 路由方法实现等价守卫
 *
 * 实现策略：
 *  1. 拦截 uni.navigateTo / uni.redirectTo / uni.reLaunch / uni.switchTab
 *  2. 通过路径判断 meta（requiresAuth / guest / title）
 *  3. requiresAuth 且未登录 → 重定向到 /pages/auth/login?redirect=...
 *  4. guest 且已登录 → 重定向到首页
 *  （导航栏标题交给各页面自身，见下方「说明」，拦截器不再改动标题）
 */
import { useUserStore } from '@/stores/user'

/** 路由 meta 表（与原 Web router/index.js 对齐） */
interface RouteMeta {
  title?: string
  requiresAuth?: boolean
  guest?: boolean
}

/** 路由路径 → meta 映射（与原 Web 路由表对齐） */
const ROUTE_TABLE: Record<string, RouteMeta> = {
  '/pages/home/index': { title: '首页' },
  '/pages/vehicle/list': { title: '车辆列表' },
  '/pages/vehicle/detail': { title: '车辆详情' },
  '/pages/cart/index': { title: '租车购物车' },
  '/pages/about/index': { title: '关于我们' },
  '/pages/contact/index': { title: '联系客服' },
  '/pages/announcement/list': { title: '公告' },
  '/pages/announcement/detail': { title: '公告详情' },
  '/pages/auth/login': { title: '登录', guest: true },
  '/pages/auth/register': { title: '注册', guest: true },
  '/pages/auth/forgot-password': { title: '忘记密码', guest: true },
  '/pages/order/checkout': { title: '确认下单', requiresAuth: true },
  '/pages/order/list': { title: '我的订单', requiresAuth: true },
  '/pages/order/detail': { title: '订单详情', requiresAuth: true },
  '/pages/profile/index': { title: '个人中心' },
  '/pages/profile/info': { title: '个人信息', requiresAuth: true },
  '/pages/profile/verify': { title: '实名认证', requiresAuth: true },
  '/pages/profile/reviews': { title: '我的评价', requiresAuth: true },
  '/pages/profile/coupons': { title: '我的优惠券', requiresAuth: true },
  '/pages/profile/settings': { title: '设置', requiresAuth: true }
}

/** 从 url 字符串解析 path（不含 query） */
function parsePath(url: string): string {
  const u = url.split('?')[0]
  return u.startsWith('/') ? u : '/' + u
}

/** 根据 path 获取 meta */
function getMetaByPath(path: string): RouteMeta {
  // 精确匹配
  if (ROUTE_TABLE[path]) return ROUTE_TABLE[path]
  // 详情页前缀匹配（如 /pages/vehicle/detail?id=1 → /pages/vehicle/detail）
  for (const key of Object.keys(ROUTE_TABLE)) {
    if (path === key) return ROUTE_TABLE[key]
  }
  return {}
}

/**
 * 说明：不再由拦截器在跳转前调用 setNavigationBarTitle。
 * 跳转前调用 uni.setNavigationBarTitle 作用的是「当前页」，会把目标页标题写到源页，
 * 导致返回后标题卡住（如登录↔忘记密码）。标题交给各页面自身（pages.json 声明 +
 * 页面 onShow/onLoad 自定义），原生导航栏返回时会自动还原。
 */

/** 拦截检查：返回 true 允许通过，false 拒绝 */
function beforeNavigate(url: string): boolean {
  const path = parsePath(url)
  const meta = getMetaByPath(path)
  const userStore = useUserStore()

  // requiresAuth：未登录跳登录页
  if (meta.requiresAuth && !userStore.isLoggedIn) {
    const redirect = encodeURIComponent(url)
    uni.redirectTo({
      url: `/pages/auth/login?redirect=${redirect}`
    })
    return false
  }

  // guest：已登录重定向首页
  if (meta.guest && userStore.isLoggedIn) {
    uni.switchTab?.({ url: '/pages/home/index' }) || uni.reLaunch({ url: '/pages/home/index' })
    return false
  }

  return true
}

/** 原生路由方法引用 */
const originNavigateTo = uni.navigateTo
const originRedirectTo = uni.redirectTo
const originReLaunch = uni.reLaunch
const originSwitchTab = uni.switchTab

/** 包装 uni.navigateTo */
function wrapNavigateTo() {
  uni.navigateTo = (options: UniApp.NavigateToOptions) => {
    if (!beforeNavigate(options.url as string)) {
      options.fail?.({ errMsg: 'navigateTo:fail blocked by guard' } as any)
      return
    }
    originNavigateTo(options)
  }
}

/** 包装 uni.redirectTo */
function wrapRedirectTo() {
  uni.redirectTo = (options: UniApp.RedirectToOptions) => {
    if (!beforeNavigate(options.url as string)) {
      options.fail?.({ errMsg: 'redirectTo:fail blocked by guard' } as any)
      return
    }
    originRedirectTo(options)
  }
}

/** 包装 uni.reLaunch */
function wrapReLaunch() {
  uni.reLaunch = (options: UniApp.ReLaunchOptions) => {
    if (!beforeNavigate(options.url as string)) {
      options.fail?.({ errMsg: 'reLaunch:fail blocked by guard' } as any)
      return
    }
    originReLaunch(options)
  }
}

/** 包装 uni.switchTab */
function wrapSwitchTab() {
  uni.switchTab = (options: UniApp.SwitchTabOptions) => {
    if (!beforeNavigate(options.url as string)) {
      options.fail?.({ errMsg: 'switchTab:fail blocked by guard' } as any)
      return
    }
    originSwitchTab(options)
  }
}

/** 注册全局路由拦截器 */
export function setupRouteInterceptor() {
  wrapNavigateTo()
  wrapRedirectTo()
  wrapReLaunch()
  wrapSwitchTab()
}

/** 路由跳转工具（统一调用入口，便于业务使用） */
export const router = {
  push(url: string) {
    return new Promise<void>((resolve, reject) => {
      uni.navigateTo({
        url,
        success: () => resolve(),
        fail: (err) => reject(err)
      })
    })
  },
  replace(url: string) {
    return new Promise<void>((resolve, reject) => {
      uni.redirectTo({
        url,
        success: () => resolve(),
        fail: (err) => reject(err)
      })
    })
  },
  reLaunch(url: string) {
    return new Promise<void>((resolve, reject) => {
      uni.reLaunch({
        url,
        success: () => resolve(),
        fail: (err) => reject(err)
      })
    })
  },
  switchTab(url: string) {
    return new Promise<void>((resolve, reject) => {
      uni.switchTab({
        url,
        success: () => resolve(),
        fail: (err) => reject(err)
      })
    })
  },
  back(delta: number = 1) {
    return new Promise<void>((resolve) => {
      uni.navigateBack({
        delta,
        success: () => resolve(),
        fail: () => resolve()
      })
    })
  }
}

export default { setupRouteInterceptor, router }
