/**
 * 价格计算 API 模块
 * 所有计算统一调用后端 PriceService，确保前端展示与下单价格一致
 * 注意：本模块未在 api/index.js 统一导出，调用方需直接 import
 */
import { post } from '@/api/request'
import type { CalcCarPricePayload, CalcCartPricePayload, PriceDetailVO } from '@/api/types'

/** 单辆车价格（payload：carId、startDate、endDate，返回 PriceDetailVO） */
export function calcCarPriceApi(data: CalcCarPricePayload): Promise<PriceDetailVO> {
  return post<PriceDetailVO>('/api/price/car', data)
}

/** 购物车批量价格（items: [{ carId, startDate, endDate }]，返回 PriceDetailVO[]） */
export function calcCartPriceApi(data: CalcCartPricePayload): Promise<PriceDetailVO[]> {
  return post<PriceDetailVO[]>('/api/price/cart', data)
}

export default { calcCarPriceApi, calcCartPriceApi }
