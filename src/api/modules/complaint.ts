/**
 * 售后投诉 API 模块
 */
import { get, post } from '@/api/request'
import type { PageResult, ComplaintVO } from '@/api/types'

/** 投诉提交入参 */
export interface SubmitComplaintPayload {
  /** 投诉类型（字典 complaint_type 的 dictValue） */
  type: string
  /** 关联订单号（选填） */
  orderNo?: string
  /** 投诉描述（≤1000字） */
  description: string
  /** 凭证图片相对路径列表（≤9张） */
  images?: string[]
}

/** 提交投诉（需登录） */
export function submitComplaintApi(data: SubmitComplaintPayload): Promise<void> {
  return post('/api/complaint/submit', data)
}

/** 我的投诉记录查询参数 */
export interface MyComplaintQuery {
  page?: number
  pageSize?: number
  /** 投诉类型筛选（dictValue，不传查全部） */
  type?: string
}

/** 我的投诉记录（分页 + 类型筛选，需登录） */
export function getMyComplaintsApi(params: MyComplaintQuery = {}): Promise<PageResult<ComplaintVO>> {
  return get<PageResult<ComplaintVO>>('/api/complaint/mine', params)
}

/** 投诉详情（仅本人） */
export function getComplaintDetailApi(id: number | string): Promise<ComplaintVO> {
  return get<ComplaintVO>(`/api/complaint/${id}`)
}

/** 对已处理投诉评分（1-5星，仅本人 + 已解决状态） */
export function rateComplaintApi(id: number, satisfaction: number): Promise<void> {
  return post(`/api/complaint/${id}/rate`, { satisfaction })
}

export default { submitComplaintApi, getMyComplaintsApi, getComplaintDetailApi, rateComplaintApi }
