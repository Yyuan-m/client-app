<script setup lang="ts">
/**
 * EmptyTips - 空状态提示组件
 *
 * 业务对齐原 Web 项目 EmptyTips 组件：
 *  - 极简组件：图标 + 文案 + 可选操作按钮
 *  - 适配 uni-app：使用 view + text 替代 div，u-button 替代 el-button
 *
 * 用法：
 *   <EmptyTips text="暂无车辆" :show-action="true" action-text="去逛逛" @action="onGo" />
 */
import type { CSSProperties } from 'vue'

/** EmptyTips 组件 Props */
export interface EmptyTipsProps {
  /** 提示文案 */
  text?: string
  /** 是否展示操作按钮 */
  showAction?: boolean
  /** 操作按钮文案 */
  actionText?: string
}

const props = withDefaults(defineProps<EmptyTipsProps>(), {
  text: '暂无数据',
  showAction: false,
  actionText: '去逛逛'
})

defineEmits<{
  (e: 'action'): void
}>()

/** 操作按钮自定义样式（Ferrari 红强调） */
const actionStyle: CSSProperties = {
  marginTop: '16rpx',
  padding: '0 32rpx',
  height: '64rpx',
  fontSize: '26rpx',
  letterSpacing: '1rpx'
}
</script>

<template>
  <view class="empty-tips">
    <!-- 空状态图标（自定义渲染，避免依赖 uview-plus 内置图标资源） -->
    <view class="empty-icon-wrap">
      <view class="empty-icon-box">
        <text class="empty-icon-text">∅</text>
      </view>
    </view>
    <text class="empty-text">{{ props.text }}</text>
    <u-button
      v-if="props.showAction"
      type="error"
      :text="props.actionText"
      size="mini"
      shape="square"
      :custom-style="actionStyle"
      @click="$emit('action')"
    />
  </view>
</template>

<style scoped lang="scss">
.empty-tips {
  padding: 80rpx 24rpx;
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 24rpx;
}

.empty-icon-wrap {
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 8rpx;
}

.empty-icon-box {
  width: 120rpx;
  height: 120rpx;
  border-radius: 50%;
  border: 4rpx dashed #3a3a3a;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: #1a1a1a;
}

.empty-icon-text {
  font-size: 56rpx;
  color: #6e6e73;
  font-weight: 300;
  line-height: 1;
}

.empty-text {
  font-size: 28rpx;
  color: #aeaeb2;
  line-height: 1.6;
  padding: 0 24rpx;
}

/* 亮色主题 */
:global(page.light) .empty-icon-box {
  background-color: #ffffff;
  border-color: #d1d1d6;
}
:global(page.light) .empty-icon-text {
  color: #c7c7cc;
}
:global(page.light) .empty-text {
  color: #6e6e73;
}
</style>
