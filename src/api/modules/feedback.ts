/**
 * 反馈 API 模块
 */
import { get, post } from '@/api/request'
import type { SubmitFeedbackPayload, AppointmentPageVO } from '@/api/types'

/**
 * 提交反馈
 * type=appointment 预约咨询 / type=feedback 留言反馈
 */
export function submitFeedbackApi(data: SubmitFeedbackPayload): Promise<any> {
  return post('/api/feedback/submit', data)
}

/** 我的预约列表查询参数 */
export interface MyAppointmentQuery {
  page?: number
  pageSize?: number
  /** 状态筛选：pending/confirmed/finished/cancelled/rejected，不传查全部 */
  status?: string
}

/** 我的预约列表（分页 + 状态筛选，需登录） */
export function getMyAppointmentsApi(params: MyAppointmentQuery = {}): Promise<AppointmentPageVO> {
  return get('/api/feedback/appointments', params)
}

/** 取消预约（仅待处理/已确认状态可取消） */
export function cancelAppointmentApi(id: number): Promise<void> {
  return post(`/api/feedback/appointments/${id}/cancel`)
}

export default { submitFeedbackApi, getMyAppointmentsApi, cancelAppointmentApi }
