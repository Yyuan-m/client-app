/**
 * user store - 用户/鉴权
 *
 * 无 persist 配置（与原 Web 项目对齐），登录态由 auth utils 管理 uni.storage
 */
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { auth } from '@/utils/auth'
import { loginApi, registerApi, getUserInfoApi, logoutApi } from '@/api/modules/auth'
import { useCartStore } from '@/stores/cart'
import type { LoginPayload, RegisterPayload, MemberInfoVO } from '@/api/types'
import type { UserInfo } from '@/utils/auth'

export const useUserStore = defineStore('user', () => {
  /** token（从 uni.storage 初始化） */
  const token = ref<string>(auth.getToken())
  /** 用户信息（从 uni.storage 初始化） */
  const user = ref<MemberInfoVO | null>(auth.getUser<MemberInfoVO>())

  /** 是否已登录 */
  const isLoggedIn = computed(() => !!token.value)
  /** 昵称 */
  const nickname = computed(() => user.value?.nickname || user.value?.phone || '游客')

  /** 登录：调 loginApi，存 token/user/refreshToken，登录后调 initCart 同步购物车 */
  async function login(loginData: LoginPayload) {
    const res = await loginApi(loginData)
    token.value = res.token
    user.value = res.user
    auth.setToken(res.token)
    auth.setRefreshToken(res.refreshToken)
    auth.setUser(res.user as UserInfo)
    // 静态 import cart store（cart store 不引用 user store，无循环依赖问题；用动态 import 在微信小程序下会导致 useCartStore 非函数）
    const cartStore = useCartStore()
    cartStore.initCart().catch((e) => console.error('[user.login] initCart failed:', e))
    return res
  }

  /** 注册 */
  async function register(registerData: RegisterPayload) {
    return await registerApi(registerData)
  }

  /** 拉取最新用户信息并同步 store + uni.storage */
  async function fetchUserInfo() {
    const info = await getUserInfoApi()
    user.value = info
    auth.setUser(info as UserInfo)
    return info
  }

  /** 编辑资料后本地合并更新（不调后端） */
  function updateUserInfo(partial: Partial<MemberInfoVO>) {
    if (!user.value) return
    user.value = { ...user.value, ...partial }
    auth.setUser(user.value as UserInfo)
  }

  /** 登出：先调 logoutApi（失败不阻断本地清理），再清空内存和 storage */
  async function logout() {
    try {
      await logoutApi(auth.getRefreshToken())
    } catch (e) {
      console.error('[user.logout] logoutApi failed:', e)
    }
    // 清空内存
    token.value = ''
    user.value = null
    // 先重置 cart store 的 items（避免 persist 插件回写脏数据）
    const cartStore = useCartStore()
    cartStore.items.splice(0, cartStore.items.length)
    cartStore.selectedIds.splice(0, cartStore.selectedIds.length)
    // 再清 storage
    auth.clearAll()
  }

  return {
    token,
    user,
    isLoggedIn,
    nickname,
    login,
    register,
    fetchUserInfo,
    updateUserInfo,
    logout
  }
  // 无 persist 配置
})
