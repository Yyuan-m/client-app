<script setup lang="ts">
/**
 * 登录页 - 移动端纯表单布局（无侧边品牌视觉区）
 * 原Web: 左侧品牌视觉区 + 右侧表单
 * 业务：username + password + 记住密码（用户名保存到 uni.storage）
 * 登录后跳转 redirect query，默认 /pages/home/index
 */
import { ref, reactive } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { useUserStore } from '@/stores/user'
import { storage } from '@/utils'

const userStore = useUserStore()

const SAVED_USERNAME_KEY = 'lux_saved_username'

const form = reactive({
  username: '',
  password: ''
})
const rememberUsername = ref(false)
const submitting = ref(false)
const redirect = ref('/pages/home/index')

onLoad((options: Record<string, string> | undefined) => {
  const opts = options || {}
  // redirect 解码
  if (opts.redirect) {
    try {
      redirect.value = decodeURIComponent(opts.redirect)
    } catch {
      redirect.value = opts.redirect
    }
  }
  // 回填已保存的用户名
  const saved = storage.get<string>(SAVED_USERNAME_KEY)
  if (saved) {
    form.username = saved
    rememberUsername.value = true
  }
})

function validate(): boolean {
  if (!form.username.trim()) {
    uni.showToast({ title: '请输入用户名', icon: 'none' })
    return false
  }
  if (!form.password) {
    uni.showToast({ title: '请输入密码', icon: 'none' })
    return false
  }
  return true
}

async function onSubmit() {
  if (!validate()) return
  submitting.value = true
  try {
    await userStore.login({
      username: form.username.trim(),
      password: form.password
    })
    // 记住密码：勾选则保存用户名，未勾选则清除
    if (rememberUsername.value) {
      storage.set<string>(SAVED_USERNAME_KEY, form.username.trim())
    } else {
      storage.remove(SAVED_USERNAME_KEY)
    }
    uni.showToast({ title: '登录成功', icon: 'success' })
    // 跳转 redirect（短延迟等 toast 显示）
    setTimeout(() => {
      // redirect 可能是 tabBar 页面（/pages/home/index 等），优先 reLaunch
      uni.reLaunch({ url: redirect.value })
    }, 400)
  } catch (e: any) {
    console.error('[login] failed:', e)
    // request.ts 已统一 toast 错误
  } finally {
    submitting.value = false
  }
}

function goRegister() {
  uni.redirectTo({ url: '/pages/auth/register' })
}

function goForgot() {
  uni.navigateTo({ url: '/pages/auth/forgot-password' })
}

function toggleRemember() {
  rememberUsername.value = !rememberUsername.value
}
</script>

<template>
  <view class="login-page">
    <view class="brand-header">
      <view class="brand-title">LUXURY CAR</view>
      <view class="brand-subtitle">大圣玩车 · 豪华车租赁</view>
    </view>

    <view class="form-card">
      <view class="form-title">欢迎登录</view>
      <view class="form-subtitle">登录后享受更多专属服务</view>

      <view class="form-item">
        <view class="form-label">用户名</view>
        <u-input v-model="form.username" placeholder="请输入用户名" border="surround" maxlength="30" clearable />
      </view>

      <view class="form-item">
        <view class="form-label">密码</view>
        <u-input v-model="form.password" type="password" placeholder="请输入密码" border="surround" maxlength="20" clearable />
      </view>

      <view class="form-extra">
        <view class="remember" @tap="toggleRemember">
          <view class="checkbox" :class="{ checked: rememberUsername }">
            <text v-if="rememberUsername" class="check-icon">✓</text>
          </view>
          <text class="remember-text">记住用户名</text>
        </view>
        <text class="forgot-link" @tap="goForgot">忘记密码？</text>
      </view>

      <u-button type="primary" shape="square" text="登录" :loading="submitting" @click="onSubmit" class="submit-btn" />

      <view class="register-link">
        还没有账号？<text class="link" @tap="goRegister">立即注册</text>
      </view>
    </view>
  </view>
</template>

<style scoped lang="scss">
.login-page {
  min-height: 100vh;
  background: linear-gradient(180deg, #0a0a0a 0%, #1a1a1a 100%);
  padding: 96rpx 48rpx calc(48rpx + env(safe-area-inset-bottom));
  display: flex;
  flex-direction: column;
}

.brand-header {
  text-align: center;
  margin-bottom: 64rpx;
}

.brand-title {
  font-size: 56rpx;
  font-weight: 800;
  color: #ff2e2e;
  letter-spacing: 4rpx;
}

.brand-subtitle {
  font-size: 24rpx;
  color: #aeaeb2;
  margin-top: 8rpx;
}

.form-card {
  background-color: #1a1a1a;
  border-radius: 16rpx;
  padding: 48rpx 32rpx;
  border: 1rpx solid #2a2a2a;
}

.form-title {
  font-size: 40rpx;
  font-weight: 700;
  color: #f5f5f5;
  margin-bottom: 8rpx;
}

.form-subtitle {
  font-size: 26rpx;
  color: #aeaeb2;
  margin-bottom: 48rpx;
}

.form-item {
  margin-bottom: 32rpx;
}

.form-label {
  font-size: 26rpx;
  color: #d1d1d6;
  margin-bottom: 12rpx;
}

.form-extra {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin: 24rpx 0 48rpx;
}

.remember {
  display: flex;
  align-items: center;
}

.checkbox {
  width: 32rpx;
  height: 32rpx;
  border: 2rpx solid #6e6e73;
  border-radius: 6rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 12rpx;

  &.checked {
    background-color: #ff2e2e;
    border-color: #ff2e2e;
  }
}

.check-icon {
  color: #fff;
  font-size: 22rpx;
  font-weight: 700;
  line-height: 1;
}

.remember-text {
  font-size: 26rpx;
  color: #aeaeb2;
}

.forgot-link {
  font-size: 26rpx;
  color: #ff2e2e;
}

.submit-btn {
  margin-top: 16rpx;
}

.register-link {
  text-align: center;
  margin-top: 32rpx;
  font-size: 26rpx;
  color: #aeaeb2;
}

.link {
  color: #ff2e2e;
  font-weight: 500;
}
</style>
