<script setup lang="ts">
/**
 * 设置页
 *
 * 分组：
 * - 账号与安全：修改密码（页面内表单，oldPassword/newPassword）
 * - 外观：主题偏好单选组（深色 / 浅色 / 跟随系统，appStore.setPreference）
 * - 通用：清除缓存（保留登录态，仅清理非关键缓存）、联系客服
 * - 关于：关于我们
 * - 退出登录（登录态显示）
 *
 * API: changePasswordApi
 */
import { computed, reactive, ref } from 'vue'
import { useUserStore } from '@/stores/user'
import { useAppStore } from '@/stores/app'
import { changePasswordApi } from '@/api/modules/user'
import { validators } from '@/utils'
import { useThemeClass } from '@/composables/useThemeClass'
import { useNavigationBar } from '@/composables/useNavigationBar'
import type { ThemePreference } from '@/types/app'

const userStore = useUserStore()
const { themeClass } = useThemeClass()
/** 原生导航栏随主题切换 */
useNavigationBar()
const appStore = useAppStore()

// ---------- 修改密码 ----------
const pwdForm = reactive({
  oldPassword: '',
  newPassword: '',
  confirmPassword: ''
})
const showPwdForm = ref(false)
const savingPwd = ref(false)

function togglePwdForm() {
  showPwdForm.value = !showPwdForm.value
  if (!showPwdForm.value) resetPwdForm()
}

function resetPwdForm() {
  pwdForm.oldPassword = ''
  pwdForm.newPassword = ''
  pwdForm.confirmPassword = ''
}

async function savePassword() {
  if (!pwdForm.oldPassword) {
    uni.showToast({ title: '请输入原密码', icon: 'none' })
    return
  }
  if (!validators.isPassword(pwdForm.newPassword)) {
    uni.showToast({ title: '新密码 6-20 位字母+数字组合', icon: 'none' })
    return
  }
  if (pwdForm.newPassword !== pwdForm.confirmPassword) {
    uni.showToast({ title: '两次新密码不一致', icon: 'none' })
    return
  }
  savingPwd.value = true
  try {
    await changePasswordApi({
      oldPassword: pwdForm.oldPassword,
      newPassword: pwdForm.newPassword
    })
    uni.showToast({ title: '密码修改成功', icon: 'success' })
    resetPwdForm()
    showPwdForm.value = false
  } catch (e) {
    console.error('[settings] changePassword failed:', e)
  } finally {
    savingPwd.value = false
  }
}

// ---------- 主题偏好（单选组） ----------
const themePreference = computed(() => appStore.themePreference)

const themeOptions: { key: ThemePreference; label: string; desc: string }[] = [
  { key: 'dark', label: '深色', desc: '经典暗黑' },
  { key: 'light', label: '浅色', desc: '明亮清爽' },
  { key: 'auto', label: '跟随系统', desc: '自动切换' }
]

const themeLabels: Record<string, string> = { dark: '深色', light: '浅色', auto: '跟随系统' }

function onThemeSelect(p: ThemePreference) {
  if (themePreference.value === p) return
  appStore.setPreference(p)
  uni.showToast({ title: `已切换为${themeLabels[p]}`, icon: 'none' })
}

// ---------- 清除缓存 ----------
/** 登录态相关的 storage key（清除缓存时保留） */
const KEEP_KEYS = [
  'lux_customer_token',
  'lux_customer_refresh_token',
  'lux_customer_user',
  'lux_customer_cart',
  'lux_customer_favorites',
  'lux_customer_app',
  'lux_saved_username'
]

function clearCache() {
  uni.showModal({
    title: '清除缓存',
    content: '将清理图片等临时缓存（不影响登录状态），确定继续吗？',
    success: (res) => {
      if (!res.confirm) return
      try {
        const info = uni.getStorageInfoSync()
        let cleared = 0
        info.keys.forEach((key) => {
          if (!KEEP_KEYS.includes(key)) {
            uni.removeStorageSync(key)
            cleared++
          }
        })
        uni.showToast({
          title: `已清理 ${cleared} 项缓存`,
          icon: 'none'
        })
      } catch (e) {
        console.error('[settings] clearCache failed:', e)
        uni.showToast({ title: '清理失败，请重试', icon: 'none' })
      }
    }
  })
}

// ---------- 页面跳转 ----------
function goAbout() {
  uni.navigateTo({ url: '/pages/about/index' })
}

function goContact() {
  uni.navigateTo({ url: '/pages/contact/index' })
}

// ---------- 退出登录 ----------
function onLogout() {
  uni.showModal({
    title: '退出登录',
    content: '确定要退出登录吗？',
    success: async (res) => {
      if (!res.confirm) return
      try {
        await userStore.logout()
        uni.showToast({ title: '已退出登录', icon: 'success' })
        setTimeout(() => {
          uni.reLaunch({ url: '/pages/home/index' })
        }, 600)
      } catch (e) {
        console.error('[settings] logout failed:', e)
      }
    }
  })
}
</script>

<template>
  <view class="settings-page" :class="themeClass">
    <!-- 账号与安全 -->
    <view class="group-title">账号与安全</view>
    <view class="card">
      <view class="menu-item no-border" @tap="togglePwdForm">
        <view class="item-left">
          <view class="item-icon"><u-icon name="lock" color="#ff2e2e" size="32rpx"></u-icon></view>
          <text class="item-label">修改密码</text>
        </view>
        <u-icon :name="showPwdForm ? 'arrow-down' : 'arrow-right'" color="#6e6e73" size="22rpx"></u-icon>
      </view>

      <!-- 修改密码表单（展开式） -->
      <view v-if="showPwdForm" class="pwd-form">
        <view class="form-item">
          <view class="form-label">原密码</view>
          <u-input v-model="pwdForm.oldPassword" type="password" placeholder="请输入原密码" border="surround" maxlength="20" clearable />
        </view>
        <view class="form-item">
          <view class="form-label">新密码</view>
          <u-input v-model="pwdForm.newPassword" type="password" placeholder="6-20 位字母+数字组合" border="surround" maxlength="20" clearable />
        </view>
        <view class="form-item">
          <view class="form-label">确认新密码</view>
          <u-input v-model="pwdForm.confirmPassword" type="password" placeholder="请再次输入新密码" border="surround" maxlength="20" clearable />
        </view>
        <u-button type="primary" shape="square" text="确认修改" :loading="savingPwd" @click="savePassword" />
      </view>
    </view>

    <!-- 外观 -->
    <view class="group-title">外观</view>
    <view class="card">
      <view class="theme-row">
        <view class="item-icon"><u-icon name="eye" color="#ff2e2e" size="32rpx"></u-icon></view>
        <text class="item-label">主题模式</text>
      </view>
      <!-- 单选按钮组：深色 / 浅色 / 跟随系统 -->
      <view class="theme-options">
        <view
          v-for="opt in themeOptions"
          :key="opt.key"
          class="theme-option"
          :class="{ active: themePreference === opt.key }"
          @tap="onThemeSelect(opt.key)"
        >
          <view class="opt-check">
            <u-icon v-if="themePreference === opt.key" name="checkmark" color="#fff" size="22rpx"></u-icon>
          </view>
          <view class="opt-text">
            <view class="opt-label">{{ opt.label }}</view>
            <view class="opt-desc">{{ opt.desc }}</view>
          </view>
        </view>
      </view>
    </view>

    <!-- 通用 -->
    <view class="group-title">通用</view>
    <view class="card">
      <view class="menu-item" @tap="clearCache">
        <view class="item-left">
          <view class="item-icon"><u-icon name="trash" color="#ff2e2e" size="32rpx"></u-icon></view>
          <text class="item-label">清除缓存</text>
        </view>
        <u-icon name="arrow-right" color="#6e6e73" size="22rpx"></u-icon>
      </view>
      <view class="menu-item no-border" @tap="goContact">
        <view class="item-left">
          <view class="item-icon"><u-icon name="kefu-ermai" color="#ff2e2e" size="32rpx"></u-icon></view>
          <text class="item-label">联系客服</text>
        </view>
        <u-icon name="arrow-right" color="#6e6e73" size="22rpx"></u-icon>
      </view>
    </view>

    <!-- 关于 -->
    <view class="group-title">关于</view>
    <view class="card">
      <view class="menu-item no-border" @tap="goAbout">
        <view class="item-left">
          <view class="item-icon"><u-icon name="info-circle" color="#ff2e2e" size="32rpx"></u-icon></view>
          <text class="item-label">关于我们</text>
        </view>
        <view class="item-right">
          <text class="item-value">v1.0.0</text>
          <u-icon name="arrow-right" color="#6e6e73" size="22rpx"></u-icon>
        </view>
      </view>
    </view>

    <!-- 退出登录 -->
    <view v-if="userStore.isLoggedIn" class="logout-btn" @tap="onLogout">退出登录</view>
  </view>
</template>

<style scoped lang="scss">
.settings-page {
  min-height: 100vh;
  background-color: var(--page-bg);
  box-sizing: border-box;
  padding: 12rpx 20rpx calc(48rpx + env(safe-area-inset-bottom));
}

.group-title {
  font-size: 22rpx;
  color: var(--text-dim);
  padding: 12rpx 8rpx 8rpx;
}

.card {
  background-color: var(--card-bg);
  border: 1rpx solid var(--border-color);
  border-radius: 12rpx;
  overflow: hidden;
  margin-bottom: 8rpx;
}

.menu-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20rpx 20rpx;
  border-bottom: 1rpx solid var(--border-color);

  &.no-border {
    border-bottom: none;
  }

  &:active {
    background-color: rgba(128, 128, 128, 0.08);
  }
}

.item-left {
  display: flex;
  align-items: center;
  gap: 16rpx;
}

.item-icon {
  width: 48rpx;
  height: 48rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: rgba(255, 46, 46, 0.1);
  border-radius: 10rpx;
}

.item-label {
  font-size: 26rpx;
  color: var(--text-main);
}

.item-right {
  display: flex;
  align-items: center;
  gap: 8rpx;
}

.item-value {
  font-size: 22rpx;
  color: var(--text-dim);
}

/* 主题单选组 */
.theme-row {
  display: flex;
  align-items: center;
  gap: 16rpx;
  padding: 20rpx;
  border-bottom: 1rpx solid var(--border-color);
}

.theme-options {
  display: flex;
  gap: 12rpx;
  padding: 16rpx 20rpx 20rpx;
}

.theme-option {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 12rpx;
  padding: 16rpx 12rpx;
  border: 1rpx solid var(--border-color);
  border-radius: 10rpx;
  background-color: transparent;

  &.active {
    border-color: #ff2e2e;
    background-color: rgba(255, 46, 46, 0.08);

    .opt-check {
      background-color: #ff2e2e;
      border-color: #ff2e2e;
    }

    .opt-label {
      color: #ff2e2e;
    }
  }

  &:active {
    opacity: 0.8;
  }
}

.opt-check {
  width: 32rpx;
  height: 32rpx;
  border: 2rpx solid var(--text-dim);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.opt-text {
  min-width: 0;
}

.opt-label {
  font-size: 24rpx;
  color: var(--text-main);
  font-weight: 500;
}

.opt-desc {
  font-size: 18rpx;
  color: var(--text-dim);
  margin-top: 2rpx;
}

/* 修改密码表单 */
.pwd-form {
  padding: 4rpx 20rpx 20rpx;
  display: flex;
  flex-direction: column;
  gap: 16rpx;
  border-top: 1rpx solid var(--border-color);
}

.form-item {
  display: flex;
  flex-direction: column;
  gap: 8rpx;
}

.form-label {
  font-size: 22rpx;
  color: var(--text-sub);
}

/* 退出登录 */
.logout-btn {
  margin-top: 40rpx;
  height: 84rpx;
  line-height: 84rpx;
  text-align: center;
  background-color: var(--card-bg);
  border: 1rpx solid rgba(255, 46, 46, 0.5);
  border-radius: 12rpx;
  font-size: 28rpx;
  color: #ff2e2e;

  &:active {
    background-color: rgba(255, 46, 46, 0.1);
  }
}
</style>
