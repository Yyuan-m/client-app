/**
 * useSystemConfig - 系统配置组合式函数
 *
 * 解决：多组件并发请求时被 request.ts GET 去重机制取消的问题
 * 三态处理：
 *   - 已加载 → 返回缓存
 *   - 请求中 → 复用同一 Promise
 *   - 未加载 → 发起请求，finally 清空 pendingPromise
 *
 * 错误处理：被去重取消的请求（__canceled）静默处理
 */
import { ref } from 'vue'
import { getSystemConfigApi } from '@/api/modules/system'
import type { SystemConfigVO } from '@/api/types'

// 模块级状态
let config = ref<SystemConfigVO | null>(null)
let loaded = false
let pendingPromise: Promise<SystemConfigVO> | null = null

/** 加载系统配置（带缓存 + 防并发） */
function loadConfig(): Promise<SystemConfigVO> {
  // 已加载，返回缓存
  if (loaded && config.value) {
    return Promise.resolve(config.value)
  }
  // 正在请求，复用同一 Promise（避免触发 request.ts GET 去重被取消）
  if (pendingPromise) {
    return pendingPromise
  }
  // 发起请求
  pendingPromise = getSystemConfigApi()
    .then((res) => {
      config.value = res
      loaded = true
      return res
    })
    .catch((e: any) => {
      // 被去重取消的请求静默处理
      if (!e?.__canceled) {
        console.error('[useSystemConfig] loadConfig failed:', e)
      }
      throw e
    })
    .finally(() => {
      pendingPromise = null
    })
  return pendingPromise
}

/** 重置（用于配置失效场景） */
function resetConfig() {
  config.value = null
  loaded = false
  pendingPromise = null
}

export function useSystemConfig() {
  return { config, loadConfig, resetConfig }
}
