/**
 * 车辆 API 模块
 */
import { get, put } from '@/api/request'
import type { CarListQuery, CarVO, CarDetailVO, CarImageGroupVO, PageResult } from '@/api/types'

/** 车辆列表筛选 */
export function getCarListApi(params: CarListQuery): Promise<PageResult<CarVO>> {
  return get<PageResult<CarVO>>('/api/car/list', params)
}

/** 车辆详情 */
export function getCarDetailApi(id: number | string): Promise<CarDetailVO> {
  return get<CarDetailVO>(`/api/car/detail/${id}`)
}

/** 热门推荐 */
export function getHotCarsApi(): Promise<CarVO[]> {
  return get<CarVO[]>('/api/car/hot')
}

/** 车辆素材图片（按分类分组） */
export function getCarImagesApi(id: number | string): Promise<CarImageGroupVO[]> {
  return get<CarImageGroupVO[]>(`/api/car/${id}/images`)
}

/** 切换推荐状态（后台配置用，客户端一般不调） */
export function toggleCarRecommendApi(id: number | string, isRecommend: boolean): Promise<any> {
  return put(`/api/car/recommend/${id}`, null, { params: { isRecommend } })
}

export default {
  getCarListApi,
  getCarDetailApi,
  getHotCarsApi,
  getCarImagesApi,
  toggleCarRecommendApi
}
