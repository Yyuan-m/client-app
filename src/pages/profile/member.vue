<template>
  <view class="member-page" :class="themeClass">
    <!-- 等级徽章卡片（与 Web 端个人中心 user-card 风格对齐） -->
    <view class="level-card" :style="cardGradStyle">
      <view class="card-shine"></view>
      <view class="card-top">
        <text class="card-brand">LUX·RENT</text>
        <text class="card-tag">{{ levelName }}</text>
      </view>
      <view class="card-bottom">
        <text class="card-level">{{ levelName }}</text>
        <text class="card-no">会员编号 NO.{{ memberNo }}</text>
      </view>
    </view>

    <!-- 距下一等级 -->
    <view class="section-card">
      <view class="section-title">等级成长</view>
      <block v-if="nextInfo.next">
        <!-- 双维度进度（任一达标即升级） -->
        <view class="progress-row">
          <view class="progress-head">
            <text class="progress-label">完成租赁次数</text>
            <text class="progress-value">{{ completedOrders }} / {{ nextInfo.next.minOrders }} 次</text>
          </view>
          <view class="progress-track">
            <view class="progress-bar" :style="ordersBarStyle"></view>
          </view>
          <text class="progress-gap">再完成 {{ nextInfo.ordersGap }} 次租赁可达 {{ nextInfo.next.name }}</text>
        </view>
        <view class="progress-row">
          <view class="progress-head">
            <text class="progress-label">累计消费金额</text>
            <text class="progress-value">￥{{ formatMoney(totalSpent) }} / ￥{{ formatMoney(nextInfo.next.minSpent) }}</text>
          </view>
          <view class="progress-track">
            <view class="progress-bar" :style="spentBarStyle"></view>
          </view>
          <text class="progress-gap">或累计消费 ￥{{ formatMoney(nextInfo.spentGap) }} 可达 {{ nextInfo.next.name }}</text>
        </view>
      </block>
      <view v-else class="max-level">
        <text class="max-level-icon">👑</text>
        <text class="max-level-text">您已是最高等级，尊享黑卡礼遇</text>
      </view>
      <view class="section-note">
        <text>· 升级条件：完成租赁次数或累计消费金额任一达标即可升级</text>
        <text>· 统计口径：已完成订单（status=completed），消费为实付净额（已扣优惠券）</text>
      </view>
    </view>

    <!-- 等级规则一览 -->
    <view class="section-card">
      <view class="section-title">等级规则</view>
      <view
        v-for="(rule, idx) in LEVEL_RULES"
        :key="rule.key"
        class="rule-row"
        :class="{ active: idx === currentIdx }"
      >
        <view class="rule-dot" :style="{ background: rule.grad[0] }"></view>
        <view class="rule-main">
          <text class="rule-name">{{ rule.name }}</text>
          <text class="rule-desc">{{ ruleDesc(idx) }}</text>
        </view>
        <text v-if="idx === currentIdx" class="rule-now">当前</text>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
/**
 * 我的会员页 - 会员等级展示与成长进度
 *
 * 内容：等级徽章卡片（与 Web 端个人中心 user-card 风格对齐）
 * + 距下一等级双条件进度（租赁次数/累计消费任一达标即升级）
 * + 五档等级规则一览（当前等级高亮）
 *
 * 数据源：user-info 接口的 level/levelName/completedOrders/totalSpent
 */
import { computed } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { useUserStore } from '@/stores/user'
import { useThemeClass } from '@/composables/useThemeClass'
import { useNavigationBar } from '@/composables/useNavigationBar'
import { LEVEL_RULES, getLevelRule, getLevelIndex, getNextLevelInfo, formatMoney } from '@/utils/memberLevel'

const userStore = useUserStore()
const { themeClass } = useThemeClass()
/** 原生导航栏随主题切换 */
useNavigationBar()

/** 等级中文名：优先后端 levelName */
const levelName = computed(() => userStore.user?.levelName || getLevelRule(userStore.user?.level).name)

/** 会员编号：由会员 id 补零生成 */
const memberNo = computed(() => String(Number(userStore.user?.id) || 0).padStart(6, '0'))

/** 已完成订单数（等级计算口径） */
const completedOrders = computed(() => Number(userStore.user?.completedOrders ?? userStore.user?.totalOrders ?? 0))

/** 累计消费 */
const totalSpent = computed(() => Number(userStore.user?.totalSpent ?? 0))

/** 徽章卡片渐变背景 */
const cardGradStyle = computed(() => {
  const [c1, c2] = getLevelRule(userStore.user?.level).grad
  return { background: `linear-gradient(135deg, ${c1} 0%, ${c2} 100%)` } as Record<string, string>
})

/** 当前档位序号 */
const currentIdx = computed(() => getLevelIndex(userStore.user?.level, userStore.user?.levelName))

/** 距下一等级差距 */
const nextInfo = computed(() => getNextLevelInfo(completedOrders.value, totalSpent.value))

/** 次数进度条宽度（相对下一级门槛，封顶 100%） */
const ordersBarStyle = computed(() => {
  const target = nextInfo.value.next?.minOrders || 1
  const pct = Math.min(100, Math.round((completedOrders.value / target) * 100))
  const [c1] = getLevelRule(userStore.user?.level).grad
  return { width: `${pct}%`, background: `linear-gradient(90deg, ${c1}, #ff5a3c)` } as Record<string, string>
})

/** 金额进度条宽度 */
const spentBarStyle = computed(() => {
  const target = nextInfo.value.next?.minSpent || 1
  const pct = Math.min(100, Math.round((totalSpent.value / target) * 100))
  const [c1] = getLevelRule(userStore.user?.level).grad
  return { width: `${pct}%`, background: `linear-gradient(90deg, ${c1}, #ff5a3c)` } as Record<string, string>
})

/** 等级规则描述文案 */
function ruleDesc(idx: number): string {
  const r = LEVEL_RULES[idx]
  if (idx === 0) return '未租赁过车辆或消费金额为 0'
  const prev = LEVEL_RULES[idx - 1]
  const orders = `租赁 ${prev.minOrders}~${r.minOrders} 次`
  const spent = `消费 ￥${formatMoney(prev.minSpent)}~￥${formatMoney(r.minSpent)}`
  return `${orders} 或 ${spent}（区间左开右闭）`
}

onShow(() => {
  // 刷新用户信息（等级/统计可能已变化）
  if (userStore.isLoggedIn) {
    userStore.fetchUserInfo().catch((e) => console.error('[member] fetchUserInfo failed:', e))
  }
})
</script>

<style lang="scss" scoped>
.member-page {
  min-height: 100vh;
  padding: 24rpx;
  background-color: var(--page-bg);
}

/* ---------- 等级徽章卡片 ---------- */
.level-card {
  position: relative;
  border-radius: 28rpx;
  padding: 36rpx 40rpx;
  margin-bottom: 24rpx;
  overflow: hidden;
  box-shadow: 0 16rpx 40rpx rgba(0, 0, 0, 0.25);
}

/* 高光扫过动画 */
.card-shine {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(115deg, transparent 30%, rgba(255, 255, 255, 0.22) 48%, transparent 62%);
  transform: translateX(-120%);
  animation: card-shine-sweep 3.6s ease-in-out 1s infinite;
}

@keyframes card-shine-sweep {
  0% { transform: translateX(-120%); }
  55% { transform: translateX(120%); }
  100% { transform: translateX(120%); }
}

.card-top {
  position: relative;
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 48rpx;

  .card-brand {
    font-size: 22rpx;
    letter-spacing: 8rpx;
    color: rgba(255, 255, 255, 0.72);
    font-weight: 500;
  }

  .card-tag {
    font-size: 22rpx;
    color: #fff;
    background: rgba(255, 255, 255, 0.18);
    padding: 6rpx 20rpx;
    border-radius: 999rpx;
  }
}

.card-bottom {
  position: relative;
  display: flex;
  justify-content: space-between;
  align-items: flex-end;

  .card-level {
    font-size: 52rpx;
    font-weight: 700;
    color: #fff;
    letter-spacing: 6rpx;
    text-shadow: 0 4rpx 16rpx rgba(0, 0, 0, 0.3);
  }

  .card-no {
    font-size: 22rpx;
    color: rgba(255, 255, 255, 0.65);
    letter-spacing: 2rpx;
  }
}

/* ---------- 通用 section 卡片 ---------- */
.section-card {
  background-color: var(--card-bg);
  border: 1rpx solid var(--border-color);
  border-radius: 20rpx;
  padding: 28rpx;
  margin-bottom: 24rpx;
}

.section-title {
  font-size: 30rpx;
  font-weight: 600;
  color: var(--text-main);
  margin-bottom: 24rpx;
}

/* ---------- 进度行 ---------- */
.progress-row {
  margin-bottom: 32rpx;

  &:last-of-type {
    margin-bottom: 16rpx;
  }
}

.progress-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 14rpx;

  .progress-label {
    font-size: 26rpx;
    color: var(--text-sub);
  }

  .progress-value {
    font-size: 26rpx;
    font-weight: 600;
    color: var(--text-main);
  }
}

.progress-track {
  height: 16rpx;
  border-radius: 999rpx;
  background-color: var(--border-color);
  overflow: hidden;
}

.progress-bar {
  height: 100%;
  border-radius: 999rpx;
  transition: width 0.6s ease;
}

.progress-gap {
  display: block;
  margin-top: 12rpx;
  font-size: 22rpx;
  color: var(--text-dim);
}

/* 最高等级态 */
.max-level {
  display: flex;
  align-items: center;
  gap: 16rpx;
  padding: 24rpx 0;

  .max-level-icon {
    font-size: 44rpx;
  }

  .max-level-text {
    font-size: 28rpx;
    font-weight: 600;
    color: #fbbf24;
  }
}

/* 口径说明 */
.section-note {
  display: flex;
  flex-direction: column;
  gap: 8rpx;
  margin-top: 20rpx;
  padding-top: 20rpx;
  border-top: 1rpx solid var(--border-color);

  text {
    font-size: 22rpx;
    color: var(--text-dim);
    line-height: 1.6;
  }
}

/* ---------- 等级规则列表 ---------- */
.rule-row {
  display: flex;
  align-items: center;
  gap: 20rpx;
  padding: 20rpx 16rpx;
  border-radius: 14rpx;

  &.active {
    background-color: var(--border-color);
  }

  & + .rule-row {
    margin-top: 8rpx;
  }
}

.rule-dot {
  width: 20rpx;
  height: 20rpx;
  border-radius: 50%;
  flex-shrink: 0;
}

.rule-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 6rpx;

  .rule-name {
    font-size: 28rpx;
    font-weight: 600;
    color: var(--text-main);
  }

  .rule-desc {
    font-size: 22rpx;
    color: var(--text-dim);
    line-height: 1.5;
  }
}

.rule-now {
  flex-shrink: 0;
  font-size: 22rpx;
  color: #ff5a3c;
  border: 1rpx solid #ff5a3c;
  padding: 4rpx 16rpx;
  border-radius: 999rpx;
}
</style>
