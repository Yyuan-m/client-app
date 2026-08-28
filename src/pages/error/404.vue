<script setup lang="ts">
/**
 * 404 页面 - 页面不存在
 * 原Web: el-result 警告图标 + 404 + 文案 + 返回首页按钮
 * uni-app: u-icon + 自定义 view 实现
 */
import { onLoad } from '@dcloudio/uni-app'
import { useThemeClass } from '@/composables/useThemeClass'
import { useNavigationBar } from '@/composables/useNavigationBar'

const { themeClass } = useThemeClass()
/** 原生导航栏随主题切换 */
useNavigationBar()

onLoad(() => {
  // 设置导航栏标题
  uni.setNavigationBarTitle({ title: '页面不存在' })
})

function goHome() {
  uni.reLaunch({ url: '/pages/home/index' })
}

function goBack() {
  uni.navigateBack({
    delta: 1,
    fail: () => {
      // 无法返回则跳首页
      uni.reLaunch({ url: '/pages/home/index' })
    }
  })
}
</script>

<template>
  <view class="not-found" :class="themeClass">
    <view class="nf-icon-wrap">
      <text class="nf-icon">!</text>
    </view>
    <view class="nf-code">404</view>
    <view class="nf-text">抱歉，您访问的页面不存在</view>
    <view class="nf-sub">页面可能已被删除、移动或暂时无法访问</view>
    <view class="nf-actions">
      <u-button type="primary" shape="square" text="返回首页" @click="goHome" />
      <u-button shape="square" text="返回上一页" @click="goBack" class="nf-btn-back" />
    </view>
  </view>
</template>

<style scoped lang="scss">
.not-found {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 48rpx 48rpx calc(48rpx + env(safe-area-inset-bottom));
  background-color: var(--page-bg);
}

.nf-icon-wrap {
  width: 160rpx;
  height: 160rpx;
  border-radius: 50%;
  background-color: rgba(255, 46, 46, 0.12);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 40rpx;
}

.nf-icon {
  font-size: 96rpx;
  font-weight: 700;
  color: #ff2e2e;
  line-height: 1;
}

.nf-code {
  font-size: 96rpx;
  font-weight: 800;
  color: var(--text-main);
  letter-spacing: 4rpx;
  line-height: 1.2;
}

.nf-text {
  margin-top: 16rpx;
  font-size: 32rpx;
  color: var(--text-main);
  font-weight: 500;
}

.nf-sub {
  margin-top: 12rpx;
  font-size: 26rpx;
  color: var(--text-sub);
}

.nf-actions {
  margin-top: 64rpx;
  width: 100%;
  max-width: 560rpx;
  display: flex;
  flex-direction: column;
  gap: 24rpx;
}

.nf-btn-back {
  :deep(.u-button) {
    background-color: var(--card-bg) !important;
    color: var(--text-main) !important;
    border: 1rpx solid var(--border-color) !important;
  }
}
</style>
