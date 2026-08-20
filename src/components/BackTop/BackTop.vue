<script setup lang="ts">
/**
 * BackTop - 返回顶部按钮
 *
 * 业务对齐原 Web 项目 BackTop 组件：
 *  - 滚动超过阈值显示按钮
 *  - 点击调 uni.pageScrollTo 平滑滚动回顶部
 *  - 淡入淡出动画 + hover 上移
 *
 * 适配 uni-app：
 *  - 使用 onPageScroll 生命周期（替代 window.scroll 监听）
 *  - 使用 uni.pageScrollTo（替代 window.scrollTo）
 *  - 阈值：原 Web 400px → uni 端按 400rpx 计算（约 200px，更易触发展示）
 */
import { ref } from 'vue'
import { onPageScroll } from '@dcloudio/uni-app'

/** 滚动显示阈值（单位 rpx，1rpx = 0.5px；400rpx ≈ 200px） */
const SCROLL_THRESHOLD_RPX = 400

/** 按钮是否可见 */
const visible = ref(false)

/** 滚动监听：uni-app 生命周期，e.scrollTop 为 px 单位 */
onPageScroll((e: { scrollTop: number }) => {
  // 将 px 阈值转换为 rpx 比较：1px = 2rpx
  // e.scrollTop 是 px，需要 ×2 转为 rpx 后与阈值比较
  // 实际效果：滚动 200px（即 400rpx）后显示
  visible.value = e.scrollTop * 2 > SCROLL_THRESHOLD_RPX
})

/** 点击返回顶部 */
function scrollTop(): void {
  uni.pageScrollTo({
    scrollTop: 0,
    duration: 300
  })
}
</script>

<template>
  <view v-if="visible" class="back-top" :class="{ 'is-visible': visible }" @tap="scrollTop">
    <text class="back-top-icon">↑</text>
  </view>
</template>

<style scoped lang="scss">
.back-top {
  position: fixed;
  right: 32rpx;
  bottom: 160rpx;
  z-index: 998;
  width: 88rpx;
  height: 88rpx;
  border-radius: 12rpx;
  background-color: rgba(26, 26, 26, 0.92);
  border: 1rpx solid #2a2a2a;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #aeaeb2;
  opacity: 0;
  transform: translateY(20rpx);
  transition: opacity 0.25s ease, transform 0.25s ease, color 0.2s, border-color 0.2s;

  &.is-visible {
    opacity: 1;
    transform: translateY(0);
  }

  &:active {
    color: #ff2e2e;
    border-color: #ff2e2e;
    transform: translateY(-2rpx);
  }
}

.back-top-icon {
  font-size: 36rpx;
  font-weight: 600;
  line-height: 1;
}

/* 亮色主题 */
:global(page.light) .back-top {
  background-color: rgba(255, 255, 255, 0.92);
  border-color: #e9e9ec;
  color: #6e6e73;
}
</style>
