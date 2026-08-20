/**
 * API 模块统一出口
 *
 * 注意：与原 Web 项目对齐，仅 re-export 9 个模块：
 *   auth, car, order, coupon, user, carousel, system, cart, feedback
 *
 * announcement / price / review 三个模块未统一导出，
 * 调用方需直接 import：
 *   import { getTopAnnouncementsApi } from '@/api/modules/announcement'
 *   import { calcCarPriceApi } from '@/api/modules/price'
 *   import { submitReviewApi } from '@/api/modules/review'
 */
export * from './modules/auth'
export * from './modules/car'
export * from './modules/order'
export * from './modules/coupon'
export * from './modules/user'
export * from './modules/carousel'
export * from './modules/system'
export * from './modules/cart'
export * from './modules/feedback'

// 便捷 re-export（非原项目行为，但便于业务调用）
export * from './modules/announcement'
export * from './modules/price'
export * from './modules/review'

export * from './types'
export * from './request'
