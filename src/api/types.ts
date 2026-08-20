/**
 * API 统一类型定义
 * 完整复刻原 Web 项目所有 VO / 入参类型，与后端 customer-server 实体对齐
 */

// ============ 通用 ============
/** 分页结果 */
export interface PageResult<T> {
  /** 当前页数据列表 */
  list: T[]
  /** 总记录数 */
  total: number
  /** 当前页码 */
  page: number
  /** 每页大小 */
  pageSize: number
}

/** 后端统一响应（request.ts 内部使用，业务代码一般直接拿 data） */
export interface ApiResult<T = any> {
  code: number
  msg: string
  data: T
}

// ============ 1. auth 模块 ============
export interface LoginPayload {
  username: string
  password: string
}

export interface LoginResultVO {
  token: string
  refreshToken: string
  user: MemberInfoVO
}

export interface RegisterPayload {
  username: string
  password: string
  nickname?: string
}

export interface SendSmsCodePayload {
  phone: string
  type?: 'register' | 'forgot'
}

export interface ForgotPasswordPayload {
  phone: string
  code: string
  password: string
}

// ============ 2. user 模块 ============
export interface MemberInfoVO {
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

export interface UpdateProfilePayload extends Partial<MemberInfoVO> {}

export interface ChangePasswordPayload {
  oldPassword?: string
  old?: string
  password?: string
  newPassword?: string
}

export interface FavoriteVO {
  id?: number
  carId: number
  carName?: string
  carCover?: string
  dailyPrice?: number | string
  [key: string]: any
}

export interface UploadResultVO {
  url: string
  [key: string]: any
}

// ============ 3. car 模块 ============
export interface CarListQuery {
  keyword?: string
  type?: string
  city?: string
  minPrice?: number | null
  maxPrice?: number | null
  sort?: 'hot' | 'price-asc' | 'price-desc'
  page?: number
  pageSize?: number
}

export interface CarVO {
  id: number
  name: string
  brand?: string
  type?: string
  cover?: string
  dailyPrice: number | string
  status?: 'available' | 'rented' | 'maintenance'
  availableDate?: string | null
  seats?: number
  displacement?: string
  year?: number
  rating?: number | string
  rentCount?: number
  tags?: string[]
  isHot?: boolean
  isRecommend?: boolean
  /** 最少租期（天） */
  minRentDays?: number
  /** 长租折扣配置 */
  weeklyDiscount?: number
  monthlyDiscount?: number
  /** 节假日溢价 */
  holidaySurcharge?: number
  /** 是否被当前用户收藏 */
  isFavorite?: boolean
  [key: string]: any
}

export interface CarDetailVO extends CarVO {
  description?: string
  imageList?: string[]
  /** 4 大参数配置块 */
  configList?: CarConfigVO[]
  [key: string]: any
}

export interface CarConfigVO {
  id?: number
  carId?: number
  category?: string
  itemName?: string
  itemValue?: string
  [key: string]: any
}

export interface CarImageGroupVO {
  category: string
  images: string[]
}

// ============ 4. carousel 模块 ============
export interface CarouselVO {
  id: number
  title?: string
  imageUrl: string
  linkUrl?: string
  sort?: number
  [key: string]: any
}

// ============ 5. cart 模块 ============
export interface CartVO {
  id?: number
  carId: number
  carName?: string
  carCover?: string
  dailyPrice?: number | string
  tagList?: string[]
  startDate?: string
  endDate?: string
  days?: number
  [key: string]: any
}

export interface AddCartPayload {
  carId: number
  startDate?: string
  endDate?: string
  days?: number
}

export interface UpdateCartPayload {
  startDate?: string
  endDate?: string
  days?: number
}

// ============ 6. coupon 模块 ============
export type CouponType = 'discount' | 'deduction' | 'duration' | 'reduction'

export interface CouponVO {
  id: number
  couponName?: string
  /** 优惠券类型：discount 折扣 / deduction 满减 / duration 时长 / reduction 兼容 */
  couponType?: CouponType
  type?: CouponType
  /** 折扣值（0.88）/金额/天数 */
  couponValue?: number
  value?: number
  minAmount?: number | null
  /** 折扣券封顶优惠金额 */
  discountCap?: number | null
  /** 适用范围：all 全场通用 / specified 指定车型 */
  applyScope?: 'all' | 'specified'
  /** 适用车型 ID 列表（applyScope=specified 时） */
  carIds?: number[]
  /** 适用车型名称列表 */
  carNames?: string[]
  /** 库存（-1 表示不限量） */
  totalCount?: number
  receivedCount?: number
  remainCount?: number
  /** 是否可叠加（0 不可 / 1 可） */
  stackable?: 0 | 1
  validStartTime?: string
  validEndTime?: string
  validFrom?: string
  validTo?: string
  expireTime?: string
  [key: string]: any
}

export interface MemberCouponVO {
  id: number
  couponId: number
  coupon?: CouponVO
  status?: 'unused' | 'locked' | 'used' | 'expired'
  /** 优惠券字段冗余（后端可能在 member_coupon 表直接冗余存储） */
  couponType?: CouponType
  type?: CouponType
  couponValue?: number
  value?: number
  minAmount?: number | null
  discountCap?: number | null
  stackable?: 0 | 1
  validStartTime?: string
  validEndTime?: string
  validFrom?: string
  validTo?: string
  expireTime?: string
  [key: string]: any
}

export interface UsableCouponQuery {
  carId?: number
  amount: number
}

export interface LockCouponPayload {
  memberCouponId: number
}

export interface VerifyCouponPayload {
  memberCouponId: number
  orderId?: number | string
}

export interface CalculateCouponPayload {
  couponId: number
  amount: number
}

// ============ 7. order 模块 ============
export type OrderStatus = 'pending' | 'renting' | 'completed' | 'cancelled'

export interface CreateOrderPayload {
  items: Array<{
    carId: number
    startDate?: string
    endDate?: string
    days?: number
  }>
  cityId?: number
  city?: string
  store?: string
  storeId?: number
  name?: string
  phone?: string
  couponUserIds?: number[]
}

export interface OrderListQuery {
  status?: OrderStatus | 'all'
  page?: number
  pageSize?: number
}

export interface OrderVO {
  id: number
  orderNo?: string
  status: OrderStatus
  /** 评价状态：unreviewed 未评 / reviewed 已首评 / re-reviewed 已追评 */
  reviewStatus?: 'unreviewed' | 'reviewed' | 're-reviewed'
  carId?: number
  carName?: string
  carCover?: string
  startDate?: string
  endDate?: string
  days?: number
  storeId?: number
  store?: string
  city?: string
  createTime?: string
  payTime?: string
  dailyPrice?: number | string
  rentAmount?: number
  couponAmount?: number
  totalAmount?: number
  couponUserIds?: number[]
  [key: string]: any
}

// ============ 8. price 模块 ============
export interface CalcCarPricePayload {
  carId: number
  startDate: string
  endDate: string
}

export interface CalcCartPricePayload {
  items: Array<{
    carId: number
    startDate: string
    endDate: string
  }>
}

export interface PriceDetailVO {
  carId: number
  /** 工作日天数 */
  normalDays: number
  /** 节假日天数 */
  holidayDays: number
  /** 节假日溢价倍数（1.0 表示无溢价） */
  holidaySurcharge: number
  /** 节假日溢价金额 */
  holidaySurchargeAmount: number
  /** 节假日前小计 */
  subtotal: number
  /** 长租档位名 */
  durationTierName?: string
  /** 长租折扣系数（1.0 表示无折扣） */
  durationFactor: number
  /** 长租折扣优惠金额 */
  discountAmount: number
  /** 租金合计（节假日后 - 长租折扣） */
  rentAmount: number
  /** 应付合计（与 rentAmount 一致，未扣优惠券） */
  totalAmount: number
  [key: string]: any
}

// ============ 9. review 模块 ============
export interface SubmitReviewPayload {
  orderId: number | string
  round?: 1 | 2
  rating: number
  content: string
  images?: string
}

export interface ReviewVO {
  id: number
  orderId: number
  round?: 1 | 2
  rating: number
  content?: string
  images?: string
  memberName?: string
  memberAvatar?: string
  createTime?: string
  [key: string]: any
}

export interface CanReviewResult {
  canReviewRound: 1 | 2 | null
}

// ============ 10. system 模块 ============
export interface SystemConfigVO {
  siteName?: string
  siteSubtitle?: string
  hotline?: string
  email?: string
  address?: string
  intro?: string
  [key: string]: any
}

export interface StoreVO {
  id: number
  name?: string
  storeName?: string
  address?: string
  phone?: string
  cityId?: number
  cityName?: string
  [key: string]: any
}

export interface CityVO {
  id: number
  name?: string
  cityName?: string
  [key: string]: any
}

export interface AdvantageVO {
  id: number
  title?: string
  content?: string
  icon?: string
  [key: string]: any
}

export interface CustomerReviewVO {
  id: number
  memberName?: string
  memberAvatar?: string
  carName?: string
  rating: number
  content?: string
  images?: string
  createTime?: string
  [key: string]: any
}

export interface DictDataVO {
  dictType?: string
  dictLabel: string
  dictValue: string
  sort?: number
  [key: string]: any
}

// ============ 11. announcement 模块 ============
export type AnnouncementPriority = 'high' | 'normal' | 'low'

export interface AnnouncementVO {
  id: number
  title: string
  content?: string
  priority?: AnnouncementPriority
  publishTime?: string
  createTime?: string
  [key: string]: any
}

export interface AnnouncementPageQuery {
  page?: number
  pageSize?: number
  onlyHigh?: boolean
}

// ============ 12. feedback 模块 ============
export type FeedbackType = 'appointment' | 'feedback'

export interface SubmitFeedbackPayload {
  type: FeedbackType
  name?: string
  phone?: string
  carType?: string
  rentDate?: string
  content?: string
}
