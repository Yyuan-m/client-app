<script lang="ts">
/** 微信头像昵称数据结构（供登录/注册页类型引用） */
export interface WxProfile {
  avatar: string
  nickname: string
}
</script>

<script setup lang="ts">
/**
 * WxProfileField - 微信小程序头像昵称获取组件
 *
 * 仅微信小程序端渲染（条件编译），其他端渲染为空：
 * - 头像：button open-type="chooseAvatar"（基础库 2.21.2+）
 * - 昵称：input type="nickname"（键盘上方「使用微信昵称」快捷填入）
 *
 * 用法：<WxProfileField v-model:profile="wxProfile" />
 */
import { computed } from 'vue'

const props = defineProps<{
  profile: WxProfile
}>()

const emit = defineEmits<{
  (e: 'update:profile', value: WxProfile): void
}>()

const inner = computed(() => props.profile)

/** 选择微信头像 */
function onChooseAvatar(e: any) {
  const url = e?.detail?.avatarUrl
  if (!url) return
  emit('update:profile', { ...inner.value, avatar: url })
}

/** 昵称输入（type=nickname 键盘快捷填入或手动输入） */
function onNicknameInput(e: any) {
  emit('update:profile', { ...inner.value, nickname: String(e?.detail?.value || '') })
}
</script>

<template>
  <!-- #ifdef MP-WEIXIN -->
  <view class="wx-field">
    <view class="wx-tip">
      <u-icon name="weixin-fill" color="#07c160" size="32rpx"></u-icon>
      <text class="tip-text">微信快捷填写（头像 / 昵称）</text>
    </view>
    <view class="wx-row">
      <!-- 头像：open-type=chooseAvatar -->
      <button class="avatar-btn" open-type="chooseAvatar" @chooseavatar="onChooseAvatar">
        <image v-if="inner.avatar" :src="inner.avatar" mode="aspectFill" class="avatar-img" />
        <view v-else class="avatar-img avatar-empty">
          <u-icon name="photo" color="#6e6e73" size="40rpx"></u-icon>
        </view>
        <text class="avatar-text">{{ inner.avatar ? '更换头像' : '获取头像' }}</text>
      </button>
      <!-- 昵称：type=nickname -->
      <view class="nickname-wrap">
        <input
          class="nickname-input"
          type="nickname"
          :value="inner.nickname"
          placeholder="点击获取微信昵称"
          placeholder-class="nickname-placeholder"
          @input="onNicknameInput"
          @blur="onNicknameInput"
        />
        <view v-if="inner.nickname" class="nickname-ok">
          <u-icon name="checkmark" color="#07c160" size="24rpx"></u-icon>
        </view>
      </view>
    </view>
  </view>
  <!-- #endif -->
</template>

<style scoped lang="scss">
/* #ifdef MP-WEIXIN */
.wx-field {
  background-color: rgba(7, 193, 96, 0.06);
  border: 1rpx solid rgba(7, 193, 96, 0.25);
  border-radius: 12rpx;
  padding: 20rpx 24rpx;
  margin-bottom: 32rpx;
}

.wx-tip {
  display: flex;
  align-items: center;
  gap: 8rpx;
  margin-bottom: 20rpx;
}

.tip-text {
  font-size: 24rpx;
  color: var(--text-sub);
}

.wx-row {
  display: flex;
  align-items: center;
  gap: 24rpx;
}

/* 头像按钮：清除微信 button 默认样式 */
.avatar-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8rpx;
  padding: 0;
  margin: 0;
  background-color: transparent;
  border: none;
  line-height: inherit;
  flex-shrink: 0;

  &::after {
    border: none;
  }
}

.avatar-img {
  width: 108rpx;
  height: 108rpx;
  border-radius: 50%;
  background-color: var(--border-color);
}

.avatar-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  border: 2rpx dashed var(--border-color);
}

.avatar-text {
  font-size: 20rpx;
  color: var(--text-sub);
}

/* 昵称输入 */
.nickname-wrap {
  flex: 1;
  position: relative;
  min-width: 0;
}

.nickname-input {
  height: 80rpx;
  padding: 0 56rpx 0 24rpx;
  background-color: var(--border-color);
  border-radius: 8rpx;
  font-size: 28rpx;
  color: var(--text-main);
}

.nickname-placeholder {
  color: var(--text-dim);
}

.nickname-ok {
  position: absolute;
  right: 16rpx;
  top: 50%;
  transform: translateY(-50%);
}
/* #endif */
</style>
