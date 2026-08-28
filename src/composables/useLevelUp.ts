/**
 * 会员升级检测与动画触发控制（小程序端，uni.storage 持久化）
 *
 * 触发规则（严格防误触）：
 *  - 本地持久化"已提示等级"（按用户 ID 维度，uni.storage 同步读写）
 *  - 首次见到该用户（无记录）：只记录当前等级，不触发动画
 *  - 之后 user.level 档位序号 > 已记录值：触发一次蒙层动画，并更新记录
 *  - 降级 / 平级：永不触发
 *
 * 等级只在订单完成时由后端重算上调，因此需保证订单完成后
 * 有地方调用 userStore.fetchUserInfo()（订单详情页已完成）。
 */
import { ref, watch } from 'vue'
import { useUserStore } from '@/stores/user'
import { LEVEL_RULES, getLevelIndex } from '@/utils/memberLevel'
import type { LevelRule } from '@/utils/memberLevel'

/** storage key：已提示过的等级（按用户 ID 隔离，支持多账号切换） */
function seenKey(userId: number | string): string {
  return `memberLevel:seen:${userId}`
}

function readSeen(userId: number | string): number | null {
  try {
    const v = uni.getStorageSync(seenKey(userId))
    return v === '' || v === null || v === undefined ? null : Number(v)
  } catch {
    return null
  }
}

function writeSeen(userId: number | string, idx: number): void {
  try {
    uni.setStorageSync(seenKey(userId), String(idx))
  } catch (e) {
    console.error('[useLevelUp] write storage failed:', e)
  }
}

export function useLevelUp() {
  const userStore = useUserStore()

  /** 动画可见性 */
  const visible = ref(false)
  /** 动画展示的旧等级规则项 */
  const fromRule = ref<LevelRule | null>(null)
  /** 动画展示的新等级规则项 */
  const toRule = ref<LevelRule | null>(null)

  // 内存态：上一次处理的用户 ID + 等级序号（避免同会话重复弹）
  let lastUserId: number | string | null = null
  let lastIdx: number | null = null

  function evaluate(user: any) {
    if (!user || !user.id) return

    const userId = user.id
    const idx = getLevelIndex(user.level, user.levelName)

    // 用户切换：重置内存态，按新用户已有记录判定
    if (userId !== lastUserId) {
      lastUserId = userId
      lastIdx = readSeen(userId)
      // 首次见到该用户：静默记录，不触发
      if (lastIdx === null) {
        writeSeen(userId, idx)
        lastIdx = idx
        return
      }
    }

    if (idx <= (lastIdx ?? 0)) {
      lastIdx = idx
      return
    }

    // 档位上升 → 触发一次，并立刻更新已提示记录
    fromRule.value = LEVEL_RULES[lastIdx ?? 0] || LEVEL_RULES[0]
    toRule.value = LEVEL_RULES[idx] || LEVEL_RULES[0]
    lastIdx = idx
    writeSeen(userId, idx)
    visible.value = true
  }

  function close() {
    visible.value = false
  }

  watch(
    () => userStore.user,
    (user) => evaluate(user),
    { immediate: true }
  )

  return { visible, fromRule, toRule, close }
}
