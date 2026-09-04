/**
 * 反馈 API 模块
 */
import { get, post } from '@/api/request'
import type { SubmitFeedbackPayload, AppointmentPageVO, ContactInfoVO } from '@/api/types'

/**
 * 提交反馈
 * type=appointment 预约咨询 / type=feedback 留言反馈
 */
export function submitFeedbackApi(data: SubmitFeedbackPayload): Promise<any> {
  return post('/api/feedback/submit', data)
}

/** 我的预约/留言列表查询参数 */
export interface MyAppointmentQuery {
  page?: number
  pageSize?: number
  /** 状态筛选：pending/handled/cancelled，不传查全部 */
  status?: string
  /** 类型筛选：appointment 预约咨询 / feedback 留言反馈 / all 或 不传 查全部 */
  type?: string
}

/** 我的预约列表（分页 + 状态筛选，需登录） */
export function getMyAppointmentsApi(params: MyAppointmentQuery = {}): Promise<AppointmentPageVO> {
  return get('/api/feedback/appointments', params)
}

/** 取消预约（仅待处理/已确认状态可取消） */
export function cancelAppointmentApi(id: number): Promise<void> {
  return post(`/api/feedback/appointments/${id}/cancel`)
}

/** 查看联系人完整信息（仅本人可查，未脱敏） */
export function getContactInfoApi(id: number): Promise<ContactInfoVO> {
  return get(`/api/feedback/appointments/${id}/contact`)
}

export default { submitFeedbackApi, getMyAppointmentsApi, cancelAppointmentApi, getContactInfoApi }
