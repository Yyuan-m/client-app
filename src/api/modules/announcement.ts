/**
 * 公告 API 模块
 * 注意：本模块未在 api/index.js 统一导出，调用方需直接 import { getTopAnnouncementsApi } from '@/api/modules/announcement'
 */
import { get } from '@/api/request'
import type { AnnouncementVO, AnnouncementPageQuery, PageResult } from '@/api/types'

/** 头部下拉，3 条高优先级 */
export function getTopAnnouncementsApi(): Promise<AnnouncementVO[]> {
  return get<AnnouncementVO[]>('/api/announcement/top')
}

/** 公告分页（page、pageSize、onlyHigh） */
export function getAnnouncementPageApi(
  query: AnnouncementPageQuery,
  config: Record<string, any> = {}
): Promise<PageResult<AnnouncementVO>> {
  return get<PageResult<AnnouncementVO>>('/api/announcement/page', query, config)
}

/** 公告详情 */
export function getAnnouncementDetailApi(id: number | string): Promise<AnnouncementVO> {
  return get<AnnouncementVO>(`/api/announcement/${id}`)
}

export default { getTopAnnouncementsApi, getAnnouncementPageApi, getAnnouncementDetailApi }
