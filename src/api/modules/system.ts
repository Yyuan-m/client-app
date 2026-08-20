/**
 * 系统配置 API 模块
 */
import { get } from '@/api/request'
import type {
  SystemConfigVO,
  StoreVO,
  CityVO,
  AdvantageVO,
  CustomerReviewVO,
  DictDataVO
} from '@/api/types'

/** 网站配置 */
export function getSystemConfigApi(): Promise<SystemConfigVO> {
  return get<SystemConfigVO>('/api/system/config')
}

/** 门店列表 */
export function getStoresApi(): Promise<StoreVO[]> {
  return get<StoreVO[]>('/api/system/stores')
}

/** 城市列表 */
export function getCitiesApi(): Promise<CityVO[]> {
  return get<CityVO[]>('/api/system/cities')
}

/** 服务优势 */
export function getAdvantagesApi(): Promise<AdvantageVO[]> {
  return get<AdvantageVO[]>('/api/system/advantages')
}

/** 客户评价（首页展示） */
export function getReviewsApi(): Promise<CustomerReviewVO[]> {
  return get<CustomerReviewVO[]>('/api/system/reviews')
}

/** 字典数据（vehicle_type / vehicle_brand 等） */
export function getDictByTypeApi(dictType: string): Promise<DictDataVO[]> {
  return get<DictDataVO[]>(`/api/system/dict/${dictType}`)
}

export default {
  getSystemConfigApi,
  getStoresApi,
  getCitiesApi,
  getAdvantagesApi,
  getReviewsApi,
  getDictByTypeApi
}
