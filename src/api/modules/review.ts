/**
 * 评价 API 模块
 * 注意：本模块未在 api/index.js 统一导出，调用方需直接 import
 */
import { get, post } from '@/api/request'
import type { SubmitReviewPayload, ReviewVO, CanReviewResult } from '@/api/types'

/** 提交评价（首评/追评，每单最多 2 次） */
export function submitReviewApi(data: SubmitReviewPayload): Promise<ReviewVO> {
  return post<ReviewVO>('/api/review/submit', data)
}

/** 订单评价列表（按轮次升序） */
export function getOrderReviewsApi(orderId: number | string): Promise<ReviewVO[]> {
  return get<ReviewVO[]>(`/api/review/order/${orderId}`)
}

/** 可评价轮次（1/2/null） */
export function getCanReviewRoundApi(orderId: number | string): Promise<CanReviewResult> {
  return get<CanReviewResult>(`/api/review/can-review/${orderId}`)
}

export default { submitReviewApi, getOrderReviewsApi, getCanReviewRoundApi }
