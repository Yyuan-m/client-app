/**
 * 优惠券 v2 API 模块
 * 覆盖完整券生命周期：可领券列表 / 券详情 / 我的券 / 下单可用券 / 领取 / 锁定 / 取消锁定 / 核销 / 计算优惠 / 已领取 ID
 */
import { get, post } from '@/api/request'
import type {
  CouponVO,
  MemberCouponVO,
  UsableCouponQuery,
  LockCouponPayload,
  VerifyCouponPayload,
  CalculateCouponPayload
} from '@/api/types'

/** 可领券列表（公开） */
export function getAvailableCouponsApi(): Promise<CouponVO[]> {
  return get<CouponVO[]>('/api/coupon/available')
}

/** 券详情（含关联车辆） */
export function getCouponDetailApi(id: number | string): Promise<CouponVO> {
  return get<CouponVO>(`/api/coupon/${id}`)
}

/** 我的券（status: unused/locked/used/expired） */
export function getMyCouponsApi(status?: 'unused' | 'locked' | 'used' | 'expired'): Promise<MemberCouponVO[]> {
  return get<MemberCouponVO[]>('/api/coupon/mine', { status })
}

/** 下单可用券 */
export function getUsableCouponsApi(params: UsableCouponQuery): Promise<MemberCouponVO[]> {
  return get<MemberCouponVO[]>('/api/coupon/usable', params)
}

/** 领取，返回 member_coupon.id */
export function receiveCouponApi(couponId: number | string): Promise<{ id: number }> {
  return post<{ id: number }>(`/api/coupon/receive/${couponId}`, { source: 'manual' })
}

/** 锁定（unused → locked） */
export function lockCouponApi(data: LockCouponPayload): Promise<any> {
  return post('/api/coupon/lock', data)
}

/** 取消锁定 */
export function cancelLockCouponApi(data: LockCouponPayload): Promise<any> {
  return post('/api/coupon/cancel-lock', data)
}

/** 核销（幂等，locked → used） */
export function verifyCouponApi(data: VerifyCouponPayload): Promise<any> {
  return post('/api/coupon/verify', data)
}

/** 计算优惠（不实际核销） */
export function calculateCouponDiscountApi(data: CalculateCouponPayload): Promise<{ discount: number }> {
  return post<{ discount: number }>('/api/coupon/calculate', data)
}

/** 当前用户已领取 ID 列表 */
export function getClaimedCouponIdsApi(): Promise<number[]> {
  return get<number[]>('/api/coupon/claimed-ids')
}

// ========== 兼容旧名 ==========
export const getCouponListApi = getAvailableCouponsApi
export function claimCouponApi(couponId: number | string): Promise<{ id: number }> {
  return receiveCouponApi(couponId)
}

export default {
  getAvailableCouponsApi,
  getCouponDetailApi,
  getMyCouponsApi,
  getUsableCouponsApi,
  receiveCouponApi,
  lockCouponApi,
  cancelLockCouponApi,
  verifyCouponApi,
  calculateCouponDiscountApi,
  getClaimedCouponIdsApi,
  getCouponListApi,
  claimCouponApi
}
