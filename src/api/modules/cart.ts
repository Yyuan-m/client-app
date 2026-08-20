/**
 * 购物车 API 模块
 */
import { get, post, put, del } from '@/api/request'
import type { CartVO, AddCartPayload, UpdateCartPayload } from '@/api/types'

/** 购物车列表（noDedup 跳过 GET 去重，保证实时性） */
export function getCartListApi(): Promise<CartVO[]> {
  return get<CartVO[]>('/api/cart/list', {}, { noDedup: true })
}

/** 购物车数量（noDedup） */
export function getCartCountApi(): Promise<number> {
  return get<number>('/api/cart/count', {}, { noDedup: true })
}

/** 加入购物车 */
export function addCartApi(data: AddCartPayload): Promise<CartVO> {
  return post<CartVO>('/api/cart/add', data)
}

/** 更新购物车项 */
export function updateCartApi(id: number | string, data: UpdateCartPayload): Promise<any> {
  return put(`/api/cart/update/${id}`, data)
}

/** 移除单项 */
export function removeCartApi(id: number | string): Promise<any> {
  return del(`/api/cart/${id}`)
}

/** 清空购物车 */
export function clearCartApi(): Promise<any> {
  return del('/api/cart/clear')
}

export default {
  getCartListApi,
  getCartCountApi,
  addCartApi,
  updateCartApi,
  removeCartApi,
  clearCartApi
}
