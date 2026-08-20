/**
 * 轮播 API 模块
 */
import { get } from '@/api/request'
import type { CarouselVO } from '@/api/types'

/** 首页启用轮播图 */
export function getActiveCarouselApi(): Promise<CarouselVO[]> {
  return get<CarouselVO[]>('/api/carousel/active')
}

export default { getActiveCarouselApi }
