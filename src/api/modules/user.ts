/**
 * 用户 API 模块
 */
import { get, post, put, upload } from '@/api/request'
import type { MemberInfoVO, UpdateProfilePayload, ChangePasswordPayload, FavoriteVO, UploadResultVO, VerifySubmitPayload } from '@/api/types'

/** 更新个人信息 */
export function updateProfileApi(data: UpdateProfilePayload): Promise<any> {
  return put('/api/user/profile', data)
}

/** 更新头像 */
export function updateAvatarApi(filePath: string): Promise<MemberInfoVO> {
  return upload<MemberInfoVO>('/api/user/avatar', filePath)
}

/** 修改密码 */
export function changePasswordApi(data: ChangePasswordPayload): Promise<any> {
  return put('/api/user/password', data)
}

/** 收藏列表 */
export function getFavoritesApi(): Promise<FavoriteVO[]> {
  return get<FavoriteVO[]>('/api/user/favorites')
}

/** 添加收藏 */
export function addFavoriteApi(carId: number): Promise<any> {
  return post('/api/user/favorite', { carId })
}

/** 移除收藏（body: { carId, action: 'remove' }） */
export function removeFavoriteApi(carId: number): Promise<any> {
  return post('/api/user/favorite', { carId, action: 'remove' })
}

/** 通用图片上传（身份证/驾驶证等） */
export function uploadImageApi(filePath: string): Promise<UploadResultVO> {
  return upload<UploadResultVO>('/api/upload', filePath)
}

/** 提交实名认证（进入人工审核，成功后 verifyStatus -> pending） */
export function submitVerifyApi(data: VerifySubmitPayload): Promise<any> {
  return post('/api/user/verify', data)
}

export default {
  updateProfileApi,
  updateAvatarApi,
  changePasswordApi,
  getFavoritesApi,
  addFavoriteApi,
  removeFavoriteApi,
  uploadImageApi,
  submitVerifyApi
}
