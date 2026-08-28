<script setup lang="ts">
/**
 * CouponCard - 优惠券卡片组件（核心）
 *
 * 业务对齐原 Web 项目 CouponCard 组件：
 *  - Props：coupon、mode、showAction、isLoggedIn、claimed、loading、showStock、showStatus、compact
 *  - Emits：use / claim / login
 *  - 优惠券类型：discount（折扣）/ deduction（满减）/ reduction（兼容旧模型）/ duration（时长）
 *  - 双布局：compact（紧凑垂直，横向滚动）/ 经典（左 130rpx 面额区 + 虚线 + 右信息区，半圆缺口装饰）
 *  - 库存进度条：颜色按紧张程度变化（>=90% 红、>=70% 橙、其他绿），totalCount=-1 表示不限量
 *  - 状态判断：isExpired（validEndTime < now）/ isSoldOut（received >= totalCount）
 *  - 按钮策略按 mode 和状态分支
 *
 * 适配 uni-app 关键差异：
 *  - el-progress → 自定义 view + 百分比 view（uview-plus u-line-progress 颜色控制不灵活）
 *  - el-button → u-button
 *  - el-tag → 自定义 view 标签
 *  - 移动端：经典模式默认竖向堆叠（左右布局在小屏太挤，改为上下分块）
 *  - compact 模式 hover 浮层 → tap 弹出（移动端无 hover）
 */
import { computed } from 'vue'
import { moneyUtil } from '@/utils'
import type { CouponVO, MemberCouponVO, CouponType } from '@/api/types'

/** CouponCard Props */
export interface CouponCardProps {
  /** 优惠券数据（必填） */
  coupon: CouponVO | MemberCouponVO
  /** 展示模式：available 领券中心 / mine 我的券 */
  mode?: 'available' | 'mine'
  /** 是否展示操作按钮 */
  showAction?: boolean
  /** 领券中心模式：登录状态 */
  isLoggedIn?: boolean
  /** 领券中心模式：是否已领取 */
  claimed?: boolean
  /** 领券中心模式：领取中 loading */
  loading?: boolean
  /** 是否展示库存进度条 */
  showStock?: boolean
  /** 是否展示状态标签（"未使用/已使用"等），结算弹窗等场景可关闭 */
  showStatus?: boolean
  /** 紧凑模式：横向滚动 + tap 展开（移动端替代 hover） */
  compact?: boolean
}

const props = withDefaults(defineProps<CouponCardProps>(), {
  mode: 'available',
  showAction: true,
  isLoggedIn: false,
  claimed: false,
  loading: false,
  showStock: true,
  showStatus: true,
  compact: false
})

const emit = defineEmits<{
  (e: 'use', coupon: CouponVO | MemberCouponVO): void
  (e: 'claim', coupon: CouponVO | MemberCouponVO): void
  (e: 'login'): void
}>()

/** 统一字段访问器：兼容 CouponVO / MemberCouponVO 字段差异 */
function getField<T = any>(...keys: string[]): T | undefined {
  const c = props.coupon as any
  for (const k of keys) {
    if (c[k] != null) return c[k] as T
  }
  return undefined
}

/** 优惠券类型（统一从 coupon.type 或 coupon.couponType 取） */
const couponType = computed<CouponType | undefined>(() => {
  const t = getField<CouponType>('couponType', 'type')
  // 兼容旧模型：reduction 等同于 deduction
  return t
})

/** 优惠券面额值 */
const couponValue = computed<number>(() => {
  const v = getField<number>('value', 'couponValue', 'discountValue')
  return Number(v ?? 0)
})

/** 最低消费门槛 */
const minAmount = computed<number>(() => {
  const m = getField<number>('minAmount', 'threshold')
  return Number(m ?? 0)
})

/** 显示名称 */
const displayName = computed<string>(() => {
  return getField<string>('couponName', 'name') || '优惠券'
})

/** 折扣券面额：v2 用 value(0.88) 表示 88 折，旧版用 discountValue(0.8) */
const discountText = computed<string>(() => {
  const v = couponValue.value
  const times10 = v * 10
  return Number.isInteger(times10) ? String(times10) : times10.toFixed(1)
})

/** 满减券面额（格式化金额） */
const deductionText = computed<string>(() => {
  return moneyUtil.format(couponValue.value)
})

/** 时长券天数 */
const durationText = computed<number>(() => {
  return couponValue.value || 1
})

/** 门槛文案 */
const thresholdText = computed<string>(() => {
  if (minAmount.value > 0) return `满￥${moneyUtil.format(minAmount.value)}可用`
  return '无门槛'
})

/** 适用范围文案 */
const scopeText = computed<string>(() => {
  const scope = getField<string>('applyScope')
  if (scope === 'specified') {
    const names = getField<string[]>('carNames')
    if (names && names.length) {
      return names.length <= 2
        ? `仅限：${names.join('、')}`
        : `仅限：${names.slice(0, 2).join('、')} 等${names.length}款`
    }
    return '指定车型可用'
  }
  return '全场通用'
})

/** 时间文案（截取日期部分） */
const timeText = computed<string>(() => {
  const start = getField<string>('validStartTime', 'validFrom')
  const end = getField<string>('validEndTime', 'validTo', 'expireTime')
  if (!start && !end) return ''
  const fmt = (t?: string): string => {
    if (!t) return ''
    return String(t).slice(0, 10)
  }
  return `${fmt(start)} ~ ${fmt(end)}`
})

/** 总库存 */
const totalCount = computed<number | null>(() => {
  const t = getField<number>('totalCount')
  return t == null ? null : Number(t)
})

/** 已领取数 */
const receivedCount = computed<number>(() => {
  return Number(getField<number>('receivedCount') || 0)
})

/** 剩余数 */
const remainCount = computed<number>(() => {
  const r = getField<number>('remainCount')
  if (r != null) return Number(r)
  if (totalCount.value == null || totalCount.value === -1) return 0
  return Math.max(0, totalCount.value - receivedCount.value)
})

/** 库存百分比（无限库存返回 0，不展示进度） */
const stockPercent = computed<number>(() => {
  if (totalCount.value == null) return 0
  if (totalCount.value === -1) return 0
  if (totalCount.value === 0) return 100
  return Math.min(100, Math.round((receivedCount.value / totalCount.value) * 100))
})

/** 库存文案 */
const stockText = computed<string>(() => {
  if (totalCount.value == null) return ''
  if (totalCount.value === -1) return '不限量'
  return `剩余 ${remainCount.value}/${totalCount.value}`
})

/** 库存进度条颜色（按紧张程度） */
const stockColor = computed<string>(() => {
  const p = stockPercent.value
  if (p >= 90) return '#f56c6c' // 库存紧张
  if (p >= 70) return '#e6a23c'
  return '#67c23a'
})

/** 库存进度条样式（动态宽度 + 颜色） */
const stockBarStyle = computed(() => {
  return {
    width: `${stockPercent.value}%`,
    backgroundColor: stockColor.value
  }
})

/** 是否过期（领券中心：根据 v2 status + 有效期判断） */
const isExpired = computed<boolean>(() => {
  const status = getField<string>('status')
  if (status === 'offline' || status === 'expired') return true
  const end = getField<string>('validEndTime')
  if (!end) return false
  return new Date(end).getTime() < Date.now()
})

/** 是否售罄 */
const isSoldOut = computed<boolean>(() => {
  if (totalCount.value == null || totalCount.value === -1) return false
  return receivedCount.value >= totalCount.value
})

/** 状态标签文案（我的券模式） */
const statusTag = computed<string>(() => {
  if (props.mode !== 'mine') return ''
  const s = getField<string>('status')
  if (s === 'unused') return '未使用'
  if (s === 'locked') return '已锁定'
  if (s === 'used') return '已使用'
  if (s === 'expired') return '已过期'
  return ''
})

/** 状态标签样式类 */
const statusTagClass = computed<string>(() => {
  const s = getField<string>('status')
  if (s === 'unused') return 'tag-unused'
  if (s === 'locked') return 'tag-locked'
  if (s === 'used') return 'tag-used'
  if (s === 'expired') return 'tag-expired'
  return ''
})

/** 卡片样式（disabled 时置灰） */
const cardClass = computed<string[]>(() => {
  const cls: string[] = []
  if (props.mode === 'mine') {
    const s = getField<string>('status')
    if (s === 'used' || s === 'expired') cls.push('disabled')
  } else {
    if (isExpired.value || isSoldOut.value) cls.push('disabled')
  }
  if (props.compact) cls.push('coupon-compact')
  return cls
})

/** 操作按钮文案 */
const actionText = computed<string>(() => {
  if (isExpired.value || isSoldOut.value) {
    return isSoldOut.value ? '已领完' : '已过期'
  }
  if (props.mode === 'mine') {
    const s = getField<string>('status')
    if (s === 'unused') return '去使用'
    if (s === 'locked') return '已锁定'
    if (s === 'used') return '已使用'
    if (s === 'expired') return '已过期'
    return ''
  }
  // available 模式
  if (!props.isLoggedIn) return '登录后领取'
  if (props.claimed) return '已领取·去使用'
  return '立即领取'
})

/** 操作按钮是否禁用 */
const actionDisabled = computed<boolean>(() => {
  if (isExpired.value || isSoldOut.value) return true
  if (props.mode === 'mine') {
    const s = getField<string>('status')
    return s !== 'unused'
  }
  return false
})

/** 操作按钮类型 */
const actionType = computed<'error' | 'success' | 'primary' | 'info'>(() => {
  if (isExpired.value || isSoldOut.value) return 'info'
  if (props.mode === 'mine') {
    const s = getField<string>('status')
    if (s === 'unused') return 'error'
    return 'info'
  }
  if (!props.isLoggedIn) return 'primary'
  if (props.claimed) return 'success'
  return 'error'
})

/** 是否为禁用文案展示（替代按钮） */
const isStatusText = computed<boolean>(() => {
  return isExpired.value || isSoldOut.value
})

/** 点击操作按钮 */
function onAction(): void {
  if (isExpired.value || isSoldOut.value) return
  if (props.mode === 'mine') {
    const s = getField<string>('status')
    if (s === 'unused') {
      emit('use', props.coupon)
    }
    return
  }
  // available 模式
  if (!props.isLoggedIn) {
    emit('login')
    return
  }
  if (props.claimed) {
    emit('use', props.coupon)
    return
  }
  emit('claim', props.coupon)
}
</script>

<template>
  <view class="coupon-card" :class="cardClass">
    <!-- 紧凑模式：垂直布局 -->
    <template v-if="props.compact">
      <!-- 面额区（默认可见） -->
      <view class="cmp-value-area">
        <!-- 库存领完角标：紧凑模式下面额区右上角，一眼可见 -->
        <view v-if="isSoldOut" class="sold-out-corner">
          <text class="sold-out-text">已领完</text>
        </view>
        <view v-if="couponType === 'discount'" class="coupon-value">
          <text class="num">{{ discountText }}</text>
          <text class="unit">折</text>
        </view>
        <view v-else-if="couponType === 'deduction' || couponType === 'reduction'" class="coupon-value">
          <text class="unit">￥</text>
          <text class="num">{{ deductionText }}</text>
        </view>
        <view v-else-if="couponType === 'duration'" class="coupon-value">
          <text class="num">免{{ durationText }}</text>
          <text class="unit">天</text>
        </view>
        <view v-else class="coupon-value">
          <text class="num">优惠</text>
        </view>
        <text class="coupon-threshold">{{ thresholdText }}</text>
      </view>

      <!-- 名称 + 状态（默认可见） -->
      <view class="cmp-head">
        <text class="coupon-name">{{ displayName }}</text>
        <view v-if="props.showStatus && statusTag" class="status-tag" :class="statusTagClass">
          <text class="status-tag-text">{{ statusTag }}</text>
        </view>
      </view>

      <!-- 详细信息：移动端默认展开（无 hover，改为常驻显示） -->
      <view class="cmp-extra">
        <view class="cmp-extra-inner">
          <text class="coupon-scope">{{ scopeText }}</text>
          <text v-if="timeText" class="coupon-time">{{ timeText }}</text>
          <view v-if="props.showStock && totalCount !== null" class="coupon-stock">
            <view class="stock-bar-bg">
              <view class="stock-bar" :style="stockBarStyle" />
            </view>
            <text class="stock-text">{{ stockText }}</text>
          </view>
          <!-- 操作按钮区 -->
          <view v-if="props.showAction" class="coupon-actions">
            <template v-if="isStatusText">
              <view class="status-text-wrap">
                <text class="status-text">{{ isSoldOut ? '已领完' : '已过期' }}</text>
              </view>
            </template>
            <template v-else>
              <u-button
                :type="actionType"
                size="mini"
                shape="square"
                :text="actionText"
                :loading="props.loading"
                :disabled="actionDisabled"
                :custom-style="{
                  width: '100%',
                  height: '60rpx',
                  fontSize: '24rpx',
                  letterSpacing: '1rpx'
                }"
                @click="onAction"
              />
            </template>
          </view>
        </view>
      </view>
    </template>

    <!-- 经典模式：左右布局（移动端默认竖向堆叠） -->
    <template v-else>
      <!-- 上部：面额区 -->
      <view class="coupon-left">
        <!-- 库存领完角标 -->
        <view v-if="isSoldOut" class="sold-out-corner">
          <text class="sold-out-text">已领完</text>
        </view>
        <view v-if="couponType === 'discount'" class="coupon-value">
          <text class="num">{{ discountText }}</text>
          <text class="unit">折</text>
        </view>
        <view v-else-if="couponType === 'deduction' || couponType === 'reduction'" class="coupon-value">
          <text class="unit">￥</text>
          <text class="num">{{ deductionText }}</text>
        </view>
        <view v-else-if="couponType === 'duration'" class="coupon-value">
          <text class="num">免{{ durationText }}</text>
          <text class="unit">天</text>
        </view>
        <view v-else class="coupon-value">
          <text class="num">优惠</text>
        </view>
        <text class="coupon-threshold">{{ thresholdText }}</text>
      </view>

      <!-- 下部：信息区 -->
      <view class="coupon-right">
        <view class="coupon-header">
          <text class="coupon-name">{{ displayName }}</text>
          <view v-if="props.showStatus && statusTag" class="status-tag" :class="statusTagClass">
            <text class="status-tag-text">{{ statusTag }}</text>
          </view>
        </view>
        <text class="coupon-scope">{{ scopeText }}</text>
        <text v-if="timeText" class="coupon-time">{{ timeText }}</text>
        <view v-if="props.showStock && totalCount !== null" class="coupon-stock">
          <view class="stock-bar-bg">
            <view class="stock-bar" :style="stockBarStyle" />
          </view>
          <text class="stock-text">{{ stockText }}</text>
        </view>
        <!-- 操作按钮区 -->
        <view v-if="props.showAction" class="coupon-actions">
          <template v-if="isStatusText">
            <view class="status-text-wrap">
              <text class="status-text">{{ isSoldOut ? '已领完' : '已过期' }}</text>
            </view>
          </template>
          <template v-else>
            <u-button
              :type="actionType"
              size="mini"
              shape="square"
              :text="actionText"
              :loading="props.loading"
              :disabled="actionDisabled"
              :custom-style="{
                height: '60rpx',
                fontSize: '24rpx',
                letterSpacing: '1rpx',
                padding: '0 32rpx'
              }"
              @click="onAction"
            />
          </template>
        </view>
      </view>
    </template>
  </view>
</template>

<style scoped lang="scss">
.coupon-card {
  position: relative;
  border: 1rpx solid var(--border-color);
  border-radius: 12rpx;
  overflow: hidden;
  background-color: var(--card-bg);
  transition: transform 0.2s, border-color 0.2s;

  &:active {
    transform: translateY(-2rpx);
    border-color: #ff2e2e;
  }
  &.disabled {
    opacity: 0.55;
    &:active {
      transform: none;
      border-color: var(--border-color);
    }
  }
}

/* ============ 面额区公共样式 ============ */
.coupon-value {
  display: flex;
  align-items: baseline;
  color: var(--text-main);

  .num {
    font-size: 56rpx;
    font-weight: 600;
    line-height: 1;
  }
  .unit {
    font-size: 26rpx;
    margin-left: 4rpx;
  }
}

.coupon-threshold {
  font-size: 22rpx;
  margin-top: 8rpx;
  color: var(--text-sub);
  letter-spacing: 0.3rpx;
}

.coupon-name {
  font-size: 28rpx;
  font-weight: 500;
  color: var(--text-main);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
}

.coupon-scope {
  font-size: 22rpx;
  color: var(--text-sub);
  margin-bottom: 6rpx;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.coupon-time {
  font-size: 22rpx;
  color: var(--text-dim);
  margin-bottom: 12rpx;
}

/* ============ 库存进度条 ============ */
.coupon-stock {
  display: flex;
  align-items: center;
  gap: 16rpx;
  margin-bottom: 16rpx;

  .stock-bar-bg {
    flex: 1;
    height: 6rpx;
    background-color: var(--border-color);
    border-radius: 3rpx;
    overflow: hidden;
  }
  .stock-bar {
    height: 100%;
    border-radius: 3rpx;
    transition: width 0.3s, background-color 0.3s;
  }
  .stock-text {
    font-size: 22rpx;
    color: var(--text-dim);
    white-space: nowrap;
  }
}

/* ============ 操作按钮区 ============ */
.coupon-actions {
  margin-top: 12rpx;
}

.status-text-wrap {
  display: inline-block;
  padding: 8rpx 24rpx;
  background-color: rgba(245, 58, 44, 0.12);
  border-radius: 4rpx;

  .status-text {
    font-size: 24rpx;
    font-weight: 600;
    color: #f13a2c;
    letter-spacing: 1.2rpx;
  }
}

/* ============ 库存领完角标 ============ */
.sold-out-corner {
  position: absolute;
  top: 0;
  right: 0;
  z-index: 2;
  padding: 4rpx 16rpx;
  background-color: #f13a2c;
  border-bottom-left-radius: 8rpx;

  .sold-out-text {
    font-size: 20rpx;
    font-weight: 700;
    letter-spacing: 1rpx;
    color: #fff;
    line-height: 1.4;
  }
}

/* ============ 状态标签 ============ */
.status-tag {
  font-size: 20rpx;
  padding: 4rpx 16rpx;
  border-radius: 20rpx;
  letter-spacing: 1rpx;
  font-weight: 600;
  white-space: nowrap;
  flex-shrink: 0;

  .status-tag-text {
    font-size: 20rpx;
    line-height: 1.4;
  }

  &.tag-unused {
    background-color: rgba(255, 46, 46, 0.12);
    .status-tag-text {
      color: #ff2e2e;
    }
  }
  &.tag-locked {
    background-color: rgba(230, 162, 60, 0.15);
    .status-tag-text {
      color: #e6a23c;
    }
  }
  &.tag-used,
  &.tag-expired {
    background-color: var(--border-color);
    .status-tag-text {
      color: var(--text-dim);
    }
  }
}

/* ============ 经典模式（移动端竖向堆叠） ============ */
.coupon-card:not(.coupon-compact) {
  display: flex;
  flex-direction: column;

  .coupon-left {
    padding: 32rpx 24rpx;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    background-color: var(--page-bg);
    color: var(--text-main);
    border-bottom: 1rpx dashed var(--border-color);
    position: relative;

    /* 左右两侧的半圆缺口装饰（移动端为上下缺口） */
    &::before,
    &::after {
      content: '';
      position: absolute;
      width: 16rpx;
      height: 16rpx;
      border-radius: 50%;
      background-color: var(--page-bg);
    }
    &::before {
      bottom: -8rpx;
      left: -8rpx;
    }
    &::after {
      bottom: -8rpx;
      right: -8rpx;
    }
  }

  .coupon-right {
    flex: 1;
    padding: 24rpx;
    display: flex;
    flex-direction: column;
    min-width: 0;
  }

  .coupon-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 12rpx;
    gap: 16rpx;
  }
}

/* ============ 紧凑模式（垂直布局） ============ */
.coupon-compact {
  width: 480rpx;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  position: relative;
  overflow: visible;
  will-change: transform;

  /* 顶部面额区：深色提升层 + 法拉利红强调 */
  .cmp-value-area {
    position: relative;
    padding: 32rpx 24rpx 16rpx;
    background-color: var(--page-bg);
    border-bottom: 1rpx dashed var(--border-color);
    text-align: left;
    flex-shrink: 0;

    .coupon-value .num {
      font-size: 72rpx;
      font-weight: 600;
      letter-spacing: -0.02em;
      line-height: 1;
    }
    .coupon-value .unit {
      font-size: 28rpx;
    }
    .coupon-threshold {
      margin-top: 12rpx;
      font-size: 22rpx;
      letter-spacing: 0.4rpx;
    }
  }

  /* 名称行：默认可见 */
  .cmp-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8rpx;
    padding: 16rpx 24rpx;
    flex: 1;
    min-height: 0;

    .coupon-name {
      font-size: 30rpx;
      font-weight: 500;
    }
  }

  /* 详细信息：移动端常驻显示（无 hover） */
  .cmp-extra {
    border-top: 1rpx solid var(--border-color);
    background-color: var(--card-bg);
  }

  .cmp-extra-inner {
    padding: 16rpx 24rpx 24rpx;
    display: flex;
    flex-direction: column;
    gap: 8rpx;
  }

  .coupon-actions {
    margin-top: 8rpx;
  }
}
</style>
