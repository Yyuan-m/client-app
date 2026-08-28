/**
 * 订单 API 模块
 */
import { get, post, put } from '@/api/request'
import type { CreateOrderPayload, OrderListQuery, OrderVO, PageResult } from '@/api/types'

/** 创建订单 */
export function createOrderApi(data: CreateOrderPayload): Promise<{ id: number; orderIds?: number[] }> {
  return post<{ id: number; orderIds?: number[] }>('/api/order/create', data)
}

/** 订单列表（支持 status 筛选，config 默认 {}） */
export function getOrderListApi(
  params: OrderListQuery,
  config: Record<string, any> = {}
): Promise<PageResult<OrderVO>> {
  return get<PageResult<OrderVO>>('/api/order/list', params, config)
}

/** 订单详情 */
export function getOrderDetailApi(id: number | string): Promise<OrderVO> {
  return get<OrderVO>(`/api/order/detail/${id}`)
}

/** 取消订单 */
export function cancelOrderApi(id: number | string): Promise<any> {
  return put(`/api/order/cancel/${id}`)
}

/** 支付（pending → renting） */
export function payOrderApi(id: number | string): Promise<any> {
  return put(`/api/order/pay/${id}`)
}

/** 批量支付（多车合并结算，一次性支付同一批次创建的多个待支付订单） */
export function payOrderBatchApi(orderIds: number[]): Promise<any> {
  return put('/api/order/pay-batch', { orderIds })
}

/** 确认还车（renting → completed） */
export function completeOrderApi(id: number | string): Promise<any> {
  return put(`/api/order/complete/${id}`)
}

/** 进行中订单（首页用，limit 默认 6） */
export function getMyActiveOrdersApi(limit: number = 6): Promise<OrderVO[]> {
  return get<OrderVO[]>('/api/order/active', { limit })
}

/** 可评价订单（个人中心） */
export function getReviewableOrdersApi(): Promise<OrderVO[]> {
  return get<OrderVO[]>('/api/order/reviewable')
}

export default {
  createOrderApi,
  getOrderListApi,
  getOrderDetailApi,
  cancelOrderApi,
  payOrderApi,
  payOrderBatchApi,
  completeOrderApi,
  getMyActiveOrdersApi,
  getReviewableOrdersApi
}
