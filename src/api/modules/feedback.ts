/**
 * 反馈 API 模块
 */
import { post } from '@/api/request'
import type { SubmitFeedbackPayload } from '@/api/types'

/**
 * 提交反馈
 * type=appointment 预约咨询 / type=feedback 留言反馈
 */
export function submitFeedbackApi(data: SubmitFeedbackPayload): Promise<any> {
  return post('/api/feedback/submit', data)
}

export default { submitFeedbackApi }
