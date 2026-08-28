/**
 * 会员等级规则表（与后台 CustomerInfoMapper.recalcMemberLevel 口径一致）
 *
 * 规则（两维度取较高等级，任一达标即升级）：
 *   普通会员：无已完成订单且消费为 0
 *   银卡会员：0 < 已完成订单数 <= 10   或 0 < 累计消费 <= 10000
 *   金卡会员：10 < 已完成订单数 <= 50  或 10000 < 累计消费 <= 50000
 *   钻石会员：50 < 已完成订单数 <= 500 或 50000 < 累计消费 <= 500000
 *   黑卡会员：已完成订单数 > 500        或 累计消费 > 500000
 *
 * 扩展方式：在 LEVEL_RULES 中按升序插入新档位（minOrders/minSpent 为"达级门槛"），
 * 同步补充 grad 渐变色即可，其余逻辑（等级判定/差距计算/动画触发）无需改动。
 */

/** 等级规则项 */
export interface LevelRule {
  key: string
  name: string
  /** 达级门槛：已完成订单数 */
  minOrders: number
  /** 达级门槛：累计消费（元） */
  minSpent: number
  /** 卡片渐变色（与个人中心会员卡片颜色一致） */
  grad: [string, string]
}

/** 等级规则表（严格按档位升序排列） */
export const LEVEL_RULES: LevelRule[] = [
  { key: 'normal', name: '普通会员', minOrders: 0, minSpent: 0, grad: ['#4b5563', '#111827'] },
  { key: 'silver', name: '银卡会员', minOrders: 1, minSpent: 0.01, grad: ['#cbd5e1', '#64748b'] },
  { key: 'gold', name: '金卡会员', minOrders: 11, minSpent: 10000.01, grad: ['#f59e0b', '#92400e'] },
  { key: 'diamond', name: '钻石会员', minOrders: 51, minSpent: 50000.01, grad: ['#6366f1', '#1e1b4b'] },
  { key: 'black', name: '黑卡会员', minOrders: 501, minSpent: 500000.01, grad: ['#fbbf24', '#18181b'] }
]

/** 按 key 取规则（未命中返回 normal 兜底） */
export function getLevelRule(key?: string | null): LevelRule {
  const k = String(key || '').toLowerCase()
  return LEVEL_RULES.find((r) => r.key === k) || LEVEL_RULES[0]
}

/** 按 key 取档位序号（越大等级越高；未命中按名称兜底） */
export function getLevelIndex(key?: string | null, levelName?: string | null): number {
  const k = String(key || '').toLowerCase()
  let idx = LEVEL_RULES.findIndex((r) => r.key === k)
  if (idx < 0) {
    const name = levelName || ''
    if (name.includes('黑卡')) idx = 4
    else if (name.includes('钻石')) idx = 3
    else if (name.includes('金卡') || name.includes('黄金')) idx = 2
    else if (name.includes('银卡') || name.includes('白银')) idx = 1
    else idx = 0
  }
  return idx
}

/**
 * 按统计值计算应处档位（与后端 CASE 口径一致：两维度取较高等级）
 * @param completedOrders 已完成订单数（等级计算口径，非 totalOrders）
 * @param totalSpent 累计消费（仅 completed 订单金额）
 */
export function calcLevelIndex(completedOrders?: number, totalSpent?: number): number {
  const orders = Number(completedOrders) || 0
  const spent = Number(totalSpent) || 0
  let idx = 0
  LEVEL_RULES.forEach((r, i) => {
    if ((r.minOrders > 0 && orders >= r.minOrders) || (r.minSpent > 0 && spent >= r.minSpent)) {
      idx = Math.max(idx, i)
    }
  })
  return idx
}

/** 距下一等级差距信息 */
export interface NextLevelInfo {
  current: LevelRule
  next: LevelRule | null
  ordersGap: number
  spentGap: number
}

/** 计算距下一等级的差距（双条件并列：任一达标即升级） */
export function getNextLevelInfo(completedOrders?: number, totalSpent?: number): NextLevelInfo {
  const currentIdx = calcLevelIndex(completedOrders, totalSpent)
  const current = LEVEL_RULES[currentIdx]
  const next = LEVEL_RULES[currentIdx + 1] || null
  if (!next) return { current, next: null, ordersGap: 0, spentGap: 0 }
  const orders = Number(completedOrders) || 0
  const spent = Number(totalSpent) || 0
  return {
    current,
    next,
    ordersGap: Math.max(0, Math.ceil(next.minOrders - orders)),
    spentGap: Math.max(0, Math.ceil(next.minSpent - spent))
  }
}

/** 金额格式化：千分位 */
export function formatMoney(n: number): string {
  const v = Number(n) || 0
  return v.toLocaleString('zh-CN', { maximumFractionDigits: 2 })
}
