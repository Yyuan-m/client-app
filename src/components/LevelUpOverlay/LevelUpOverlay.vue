<template>
  <!-- 会员升级蒙层动画：等级突破档位时全屏展示一次，4.6s 自动关闭或点击关闭 -->
  <view v-if="visible" class="levelup-overlay" @tap="handleClose">
    <!-- 背景光晕（新等级主题色） -->
    <view class="levelup-glow" :style="glowStyle"></view>

    <!-- 上升粒子 -->
    <view class="levelup-particles">
      <view
        v-for="p in particles"
        :key="p.id"
        class="particle"
        :style="p.style"
      ></view>
    </view>

    <!-- 中央内容 -->
    <view class="levelup-stage">
      <!-- 新等级徽章卡片 -->
      <view class="badge-card" :style="badgeStyle">
        <view class="badge-shine"></view>
        <view class="badge-inner">
          <text class="badge-brand">LUX·RENT</text>
          <text class="badge-level">{{ toRule?.name }}</text>
        </view>
      </view>

      <!-- 标题与说明 -->
      <view class="levelup-text">
        <text class="levelup-title">✦ 恭喜升级 ✦</text>
        <text class="levelup-desc" v-if="fromRule && fromRule.key !== toRule?.key">{{ fromRule.name }} → {{ toRule?.name }}</text>
        <text class="levelup-desc" v-else>您已晋升为 {{ toRule?.name }}</text>
        <text class="levelup-tip">完成租赁订单或累计消费即可继续晋升更高等级</text>
        <text class="levelup-close-hint">点击任意处继续</text>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
/**
 * 会员升级蒙层动画组件（小程序端，自包含）
 *
 * 使用方式：组件内部通过 useLevelUp 监听 user store 的等级变化，
 * 页面只需放置 <LevelUpOverlay />（easycom 自动注册，无需 import）。
 * 建议放置在：个人中心、首页、订单详情等会发生 fetchUserInfo 的页面。
 *
 * 动画颜色自动取新等级 grad 渐变色，与个人中心会员卡片颜色一致。
 */
import { computed, onBeforeUnmount, watch } from 'vue'
import { useLevelUp } from '@/composables/useLevelUp'

const { visible, fromRule, toRule, close } = useLevelUp()

/** 自动关闭计时器 */
let autoTimer: ReturnType<typeof setTimeout> | null = null

/** 粒子（随机分布，颜色跟随新等级渐变） */
const particles = computed(() => {
  if (!visible.value || !toRule.value) return []
  const [c1, c2] = toRule.value.grad
  return Array.from({ length: 12 }, (_, i) => {
    const left = 4 + Math.random() * 92
    const delay = Math.random() * 2.2
    const dur = 2.6 + Math.random() * 2
    const size = 8 + Math.floor(Math.random() * 12)
    const color = i % 2 === 0 ? c1 : c2
    return {
      id: i,
      style: {
        left: `${left}%`,
        width: `${size}rpx`,
        height: `${size}rpx`,
        background: color,
        boxShadow: `0 0 ${size * 2}rpx ${color}`,
        animationDelay: `${delay}s`,
        animationDuration: `${dur}s`
      } as Record<string, string>
    }
  })
})

/** 背景光晕：新等级渐变 */
const glowStyle = computed(() => {
  const [c1, c2] = toRule.value?.grad || ['#6366f1', '#1e1b4b']
  return {
    background: `radial-gradient(ellipse 60% 45% at 50% 42%, ${hexToRgba(c1, 0.4)} 0%, ${hexToRgba(c2, 0.18)} 45%, transparent 70%)`
  } as Record<string, string>
})

/** 徽章卡片背景：新等级渐变 */
const badgeStyle = computed(() => {
  const [c1, c2] = toRule.value?.grad || ['#6366f1', '#1e1b4b']
  return { background: `linear-gradient(135deg, ${c1} 0%, ${c2} 100%)` } as Record<string, string>
})

/** hex 转 rgba（grad 为 #rrggbb 格式） */
function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace('#', '')
  const r = parseInt(h.slice(0, 2), 16)
  const g = parseInt(h.slice(2, 4), 16)
  const b = parseInt(h.slice(4, 6), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

function handleClose() {
  clearTimer()
  close()
}

function clearTimer() {
  if (autoTimer) {
    clearTimeout(autoTimer)
    autoTimer = null
  }
}

// 可见时启动自动关闭
watch(visible, (v) => {
  clearTimer()
  if (v) {
    autoTimer = setTimeout(handleClose, 4600)
  }
})

onBeforeUnmount(clearTimer)
</script>

<style lang="scss" scoped>
.levelup-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 9999;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background-color: rgba(0, 0, 0, 0.78);
  overflow: hidden;
}

/* ---------- 背景光晕呼吸 ---------- */
.levelup-glow {
  position: absolute;
  top: -20%;
  left: -20%;
  right: -20%;
  bottom: -20%;
  animation: glow-breath 3s ease-in-out infinite;
  pointer-events: none;
}

@keyframes glow-breath {
  0% { opacity: 0.55; transform: scale(1); }
  50% { opacity: 1; transform: scale(1.06); }
  100% { opacity: 0.55; transform: scale(1); }
}

/* ---------- 上升粒子 ---------- */
.levelup-particles {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  pointer-events: none;
}

.particle {
  position: absolute;
  bottom: -24rpx;
  border-radius: 50%;
  opacity: 0;
  animation-name: particle-rise;
  animation-timing-function: ease-out;
  animation-iteration-count: infinite;
}

@keyframes particle-rise {
  0% { transform: translateY(0) scale(0.6); opacity: 0; }
  12% { opacity: 0.9; }
  100% { transform: translateY(-92vh) scale(1.15); opacity: 0; }
}

/* ---------- 中央舞台 ---------- */
.levelup-stage {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 60rpx;
  animation: stage-in 0.6s cubic-bezier(0.22, 1.4, 0.36, 1) both;
}

@keyframes stage-in {
  from { transform: translateY(64rpx) scale(0.88); opacity: 0; }
  to { transform: translateY(0) scale(1); opacity: 1; }
}

/* ---------- 等级徽章卡片（与个人中心会员卡片风格呼应） ---------- */
.badge-card {
  position: relative;
  width: 520rpx;
  height: 300rpx;
  border-radius: 32rpx;
  box-shadow: 0 40rpx 100rpx rgba(0, 0, 0, 0.55);
  animation: badge-pop 0.7s cubic-bezier(0.22, 1.5, 0.36, 1) 0.12s both,
             badge-float 3.4s ease-in-out 0.9s infinite;
  overflow: hidden;
}

@keyframes badge-pop {
  from { transform: scale(0.4) rotate(-6deg); opacity: 0; }
  to { transform: scale(1) rotate(0deg); opacity: 1; }
}

@keyframes badge-float {
  0% { transform: translateY(0); }
  50% { transform: translateY(-14rpx); }
  100% { transform: translateY(0); }
}

/* 高光扫过 */
.badge-shine {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(115deg, transparent 30%, rgba(255, 255, 255, 0.28) 48%, transparent 62%);
  transform: translateX(-120%);
  animation: shine-sweep 2.4s ease-in-out 0.8s infinite;
}

@keyframes shine-sweep {
  0% { transform: translateX(-120%); }
  55% { transform: translateX(120%); }
  100% { transform: translateX(120%); }
}

.badge-inner {
  position: relative;
  height: 100%;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  padding: 36rpx 42rpx;
}

.badge-brand {
  font-size: 22rpx;
  letter-spacing: 8rpx;
  color: rgba(255, 255, 255, 0.72);
  font-weight: 500;
}

.badge-level {
  font-size: 56rpx;
  font-weight: 700;
  color: #ffffff;
  letter-spacing: 8rpx;
  text-shadow: 0 4rpx 20rpx rgba(0, 0, 0, 0.35);
}

/* ---------- 文案 ---------- */
.levelup-text {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 18rpx;
  animation: text-in 0.6s ease 0.35s both;
}

@keyframes text-in {
  from { transform: translateY(28rpx); opacity: 0; }
  to { transform: translateY(0); opacity: 1; }
}

.levelup-title {
  font-size: 48rpx;
  font-weight: 700;
  color: #ffffff;
  letter-spacing: 12rpx;
  animation: star-blink 1.6s ease-in-out infinite;
}

@keyframes star-blink {
  0% { opacity: 0.65; }
  50% { opacity: 1; }
  100% { opacity: 0.65; }
}

.levelup-desc {
  font-size: 30rpx;
  color: rgba(255, 255, 255, 0.85);
  letter-spacing: 2rpx;
}

.levelup-tip {
  font-size: 24rpx;
  color: rgba(255, 255, 255, 0.55);
  letter-spacing: 2rpx;
}

.levelup-close-hint {
  margin-top: 32rpx;
  font-size: 24rpx;
  color: rgba(255, 255, 255, 0.45);
  letter-spacing: 4rpx;
  animation: hint-pulse 2s ease-in-out infinite;
}

@keyframes hint-pulse {
  0% { opacity: 0.4; }
  50% { opacity: 0.9; }
  100% { opacity: 0.4; }
}
</style>
