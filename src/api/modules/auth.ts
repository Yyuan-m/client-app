/**
 * 认证 API 模块
 */
import { get, post } from '@/api/request'
import type {
  LoginPayload,
  LoginResultVO,
  RegisterPayload,
  MemberInfoVO,
  SendSmsCodePayload,
  ForgotPasswordPayload
} from '@/api/types'

/** 登录 */
export function loginApi(data: LoginPayload): Promise<LoginResultVO> {
  return post<LoginResultVO>('/api/auth/login', data)
}

/** 注册 */
export function registerApi(data: RegisterPayload): Promise<any> {
  return post('/api/auth/register', data)
}

/** 当前用户信息 */
export function getUserInfoApi(): Promise<MemberInfoVO> {
  return get<MemberInfoVO>('/api/auth/user-info')
}

/** 登出（携带 refresh token，带 skipBusinessError: true） */
export function logoutApi(refreshToken?: string): Promise<any> {
  return post(
    '/api/auth/logout',
    { refreshToken },
    { skipBusinessError: true }
  )
}

/** 发送短信验证码 */
export function sendSmsCodeApi(data: SendSmsCodePayload): Promise<any> {
  return post('/api/auth/sms-code', data)
}

/** 忘记密码 */
export function forgotPasswordApi(data: ForgotPasswordPayload): Promise<any> {
  return post('/api/auth/forgot-password', data)
}

/** 刷新 token（一般由 request.ts 自动调用，不直接对外暴露） */
export function refreshAuthTokenApi(refreshToken: string): Promise<{ token: string; refreshToken: string }> {
  return post<{ token: string; refreshToken: string }>(
    '/api/auth/refresh-token',
    { refreshToken },
    { skipBusinessError: true }
  )
}

export default {
  loginApi,
  registerApi,
  getUserInfoApi,
  logoutApi,
  sendSmsCodeApi,
  forgotPasswordApi,
  refreshAuthTokenApi
}
