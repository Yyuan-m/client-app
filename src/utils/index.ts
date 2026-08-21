/**
 * 全局工具函数库 - 配套 dayjs，满足租车业务场景
 *
 * 适配 uni-app 多端：
 * - storage：使用 uni.getStorageSync / uni.setStorageSync / uni.removeStorageSync
 * - imageUtil.lazyLoad：移除浏览器 IntersectionObserver（uni 组件 image 自带 lazy-load 属性）
 * - browserUtil：navigator.clipboard → uni.setClipboardData；window.scrollTo → uni.pageScrollTo
 */

import dayjs from 'dayjs'

// ====================== 1. 本地存储封装 ======================
export const storage = {
  set<T>(key: string, value: T): void {
    try {
      uni.setStorageSync(key, JSON.stringify(value))
    } catch (e) {
      console.error('[storage] set failed:', key, e)
    }
  },
  get<T = any>(key: string, defaultValue: T | null = null): T | null {
    try {
      const raw = uni.getStorageSync(key)
      if (!raw) return defaultValue
      return typeof raw === 'string' ? (JSON.parse(raw) as T) : (raw as T)
    } catch {
      return defaultValue
    }
  },
  remove(key: string): void {
    try {
      uni.removeStorageSync(key)
    } catch (e) {
      console.error('[storage] remove failed:', key, e)
    }
  },
  clear(): void {
    try {
      uni.clearStorageSync()
    } catch (e) {
      console.error('[storage] clear failed:', e)
    }
  }
}

// ====================== 2. 时间工具 ======================
export const dateUtil = {
  /** 格式化日期 */
  format(date: dayjs.ConfigType, fmt: string = 'YYYY-MM-DD HH:mm:ss'): string {
    if (!date) return ''
    return dayjs(date).format(fmt)
  },
  /** 计算两个日期间隔天数（不含起止日，即 end - start） */
  daysBetween(start: dayjs.ConfigType, end: dayjs.ConfigType): number {
    if (!start || !end) return 0
    const diff = dayjs(end).diff(dayjs(start), 'day')
    return Math.max(0, diff)
  },
  /** 获取未来某天 */
  addDays(date: dayjs.ConfigType, days: number): string {
    return dayjs(date).add(days, 'day').format('YYYY-MM-DD')
  },
  /** 今天 */
  today(): string {
    return dayjs().format('YYYY-MM-DD')
  },
  /** 租期规则校验：是否满足最少/最长租期（maxDays 传 null/undefined 表示不限） */
  validateRentDays(
    start: dayjs.ConfigType,
    end: dayjs.ConfigType,
    minDays: number = 1,
    maxDays: number | null | undefined = null
  ): { valid: boolean; days: number; msg?: string } {
    const days = this.daysBetween(start, end)
    if (days < minDays) return { valid: false, days, msg: `最少租期 ${minDays} 天` }
    if (maxDays != null && days > maxDays) return { valid: false, days, msg: `最长租期 ${maxDays} 天` }
    return { valid: true, days }
  }
}

// ====================== 3. 金额工具 ======================
/** 优惠券标准化结构（用于 moneyUtil 计算） */
export interface CouponForCalc {
  /** 折扣 deduction 满减 duration 时长 reduction 兼容旧模型 */
  type: 'discount' | 'deduction' | 'duration' | 'reduction'
  /** 折扣填 0.88 / 满减填金额 / 时长填天数 */
  value: number
  /** 最低消费门槛 */
  minAmount?: number | null
  /** 折扣券封顶优惠金额（仅 discount 有效，NULL=不封顶） */
  discountCap?: number | null
  /** 是否可叠加（duration 不可叠加，业务层校验） */
  stackable?: 0 | 1 | null
}

export const moneyUtil = {
  /** 千分位格式化 */
  format(amount: number | null | undefined): string {
    if (amount == null || isNaN(Number(amount))) return '0.00'
    // toLocaleString 在小程序部分环境不稳定，使用手动格式化
    const num = Number(amount)
    const fixed = num.toFixed(2)
    const [intPart, decPart] = fixed.split('.')
    const intStr = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
    return `${intStr}.${decPart}`
  },
  /** 租金总价 = 日租金 × 天数 */
  calcRent(dailyPrice: number | string | null | undefined, days: number | null | undefined): number {
    return Number(dailyPrice || 0) * Number(days || 0)
  },
  /** 优惠券抵扣计算（v2 模型，与后端 CouponService.doCalculate 对齐） */
  calcCouponDiscount(amount: number, coupon: CouponForCalc | null | undefined): number {
    if (!coupon || !amount) return 0
    const value = Number(coupon.value ?? 0)
    const minAmount = Number(coupon.minAmount ?? 0)
    if (minAmount > 0 && amount < minAmount) return 0
    let discount = 0
    if (coupon.type === 'discount') {
      // 折扣值 0.88 表示88折，优惠 = 原价 * (1 - 0.88)
      discount = +(amount * (1 - value)).toFixed(2)
      if (coupon.discountCap != null && discount > Number(coupon.discountCap)) {
        discount = Number(coupon.discountCap)
      }
    } else if (coupon.type === 'deduction') {
      discount = value
    } else if (coupon.type === 'duration') {
      // 时长券不抵扣金额（由订单层处理加天数）
      discount = 0
    } else if (coupon.type === 'reduction') {
      // 兼容旧模型：reduction 类型，value 字段可能存的是减免金额
      discount = value
    }
    return Math.min(discount, amount)
  },
  /** 最终应付 = 租金 - 优惠券抵扣 */
  calcTotal(rent: number, couponDiscount: number = 0): number {
    return Math.max(0, rent - couponDiscount)
  },
  /** 批量叠加优惠券抵扣（v3，与后端 CouponService.calculateDiscountForOrderBatch 对齐） */
  calcCouponDiscountBatch(amount: number, coupons: CouponForCalc[] | null | undefined): number {
    if (!coupons || !coupons.length || !amount) return 0
    let total = 0
    for (const c of coupons) {
      total += this.calcCouponDiscount(amount, c)
    }
    return Math.min(total, amount)
  }
}

// ====================== 4. 图片工具 ======================
export const imageUtil = {
  /**
   * 懒加载 - uni-app 中 image 组件自带 lazy-load 属性，无需 JS 监听
   * 此方法保留兼容签名，在 H5 端也无需 JS 干预
   */
  lazyLoad(): void {
    // uni image 组件自带 lazy-load，无需实现
  },
  /** 拼接图片地址（补全 base url） */
  resolve(url: string, baseUrl: string = ''): string {
    if (!url) return ''
    if (url.startsWith('http')) return url
    return baseUrl + url
  },
  /** 默认兜底图（小程序不支持 SVG data URI 在 image src，使用空字符串占位） */
  placeholder(_text: string = '暂无图片'): string {
    // #ifdef H5
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300"><rect width="100%" height="100%" fill="#1a1a1a"/><text x="50%" y="50%" font-size="14" fill="#aeaeb2" text-anchor="middle" dy=".3em">${_text}</text></svg>`
    return `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svg)))}`
    // #endif
    // #ifndef H5
    return ''
    // #endif
  }
}

// ====================== 5. 表单校验正则 ======================
export const validators = {
  phone: /^1[3-9]\d{9}$/,
  username: /^[a-zA-Z][a-zA-Z0-9_]{2,19}$/,
  idCard: /^[1-9]\d{5}(18|19|20)\d{2}(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])\d{3}[\dXx]$/,
  password: /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d]{6,20}$/,
  email: /^[\w.-]+@[\w-]+(\.[\w-]+)+$/,
  isPhone(val: string): boolean {
    return this.phone.test(val)
  },
  isUsername(val: string): boolean {
    return this.username.test(val)
  },
  isIdCard(val: string): boolean {
    return this.idCard.test(val)
  },
  isPassword(val: string): boolean {
    return this.password.test(val)
  },
  isEmail(val: string): boolean {
    return this.email.test(val)
  }
}

// ====================== 6. 平台工具（原 browserUtil） ======================
export const browserUtil = {
  /** 复制文本到剪贴板 */
  copyText(text: string): Promise<void> {
    return new Promise((resolve, reject) => {
      uni.setClipboardData({
        data: text,
        success: () => resolve(),
        fail: (err) => reject(err)
      })
    })
  },
  /** 平滑滚动到顶部 */
  scrollTop(_behavior: 'smooth' | 'auto' = 'smooth'): void {
    uni.pageScrollTo({
      scrollTop: 0,
      duration: 300
    })
  },
  /** 防抖 */
  debounce<T extends (...args: any[]) => any>(fn: T, delay: number = 300): (...args: Parameters<T>) => void {
    let timer: ReturnType<typeof setTimeout> | null = null
    return function (this: any, ...args: Parameters<T>) {
      if (timer) clearTimeout(timer)
      timer = setTimeout(() => fn.apply(this, args), delay)
    }
  },
  /** 节流 */
  throttle<T extends (...args: any[]) => any>(fn: T, delay: number = 300): (...args: Parameters<T>) => void {
    let last = 0
    return function (this: any, ...args: Parameters<T>) {
      const now = Date.now()
      if (now - last >= delay) {
        last = now
        fn.apply(this, args)
      }
    }
  }
}

// ====================== 7. 租赁统计分级（已租次数/天数） ======================
/** 返回 'high' | 'mid' | 'low'，对应 着重 / 次重 / 轻微 显示等级 */
export function rentCountLevel(count: number | string | null | undefined): 'high' | 'mid' | 'low' {
  const v = Number(count) || 0
  if (v > 50) return 'high'
  if (v > 10) return 'mid'
  return 'low'
}

/** 返回 'high' | 'mid' | 'low'，对应 着重 / 次重 / 轻微 显示等级 */
export function rentDaysLevel(days: number | string | null | undefined): 'high' | 'mid' | 'low' {
  const v = Number(days) || 0
  if (v > 500) return 'high'
  if (v > 50) return 'mid'
  return 'low'
}

export default {
  storage,
  dateUtil,
  moneyUtil,
  imageUtil,
  validators,
  browserUtil,
  rentCountLevel,
  rentDaysLevel
}
