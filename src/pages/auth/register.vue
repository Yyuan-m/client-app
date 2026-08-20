<script setup lang="ts">
/**
 * 注册页 - 移动端纯表单
 * 原Web: 左侧品牌视觉区 + 营销文案 + 右侧表单
 * 业务：username（3-20位字母开头） + nickname（选填） + password（6-20位字母+数字） + confirmPassword
 * 自定义校验：validators.isUsername / isPassword / 一致性
 * 注册成功跳转登录页
 */
import { reactive, ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { useUserStore } from '@/stores/user'
import { validators } from '@/utils'

const userStore = useUserStore()

const form = reactive({
  username: '',
  nickname: '',
  password: '',
  confirmPassword: ''
})
const submitting = ref(false)

onLoad(() => {})

function validate(): boolean {
  if (!form.username.trim()) {
    uni.showToast({ title: '请输入用户名', icon: 'none' })
    return false
  }
  if (!validators.isUsername(form.username.trim())) {
    uni.showToast({ title: '用户名 3-20 位字母开头的字母数字下划线', icon: 'none' })
    return false
  }
  if (!validators.isPassword(form.password)) {
    uni.showToast({ title: '密码 6-20 位字母+数字组合', icon: 'none' })
    return false
  }
  if (form.password !== form.confirmPassword) {
    uni.showToast({ title: '两次密码不一致', icon: 'none' })
    return false
  }
  return true
}

async function onSubmit() {
  if (!validate()) return
  submitting.value = true
  try {
    // 剔除 confirmPassword
    const { confirmPassword: _confirmPassword, ...payload } = form
    void _confirmPassword
    await userStore.register({
      username: payload.username.trim(),
      password: payload.password,
      nickname: payload.nickname?.trim() || undefined
    })
    uni.showToast({ title: '注册成功', icon: 'success' })
    setTimeout(() => {
      uni.redirectTo({ url: '/pages/auth/login' })
    }, 400)
  } catch (e: any) {
    console.error('[register] failed:', e)
  } finally {
    submitting.value = false
  }
}

function goLogin() {
  uni.redirectTo({ url: '/pages/auth/login' })
}
</script>

<template>
  <view class="register-page">
    <view class="brand-header">
      <view class="brand-title">LUXURY CAR</view>
      <view class="brand-subtitle">大圣玩车 · 豪华车租赁</view>
      <view class="marketing-tip">新用户首单享 8 折</view>
    </view>

    <view class="form-card">
      <view class="form-title">创建账号</view>
      <view class="form-subtitle">加入大圣玩车，开启豪华出行</view>

      <view class="form-item">
        <view class="form-label">用户名 <text class="required">*</text></view>
        <u-input v-model="form.username" placeholder="3-20 位字母开头的字母数字下划线" border="surround" maxlength="20" clearable />
      </view>

      <view class="form-item">
        <view class="form-label">昵称（选填）</view>
        <u-input v-model="form.nickname" placeholder="请输入昵称" border="surround" maxlength="30" clearable />
      </view>

      <view class="form-item">
        <view class="form-label">密码 <text class="required">*</text></view>
        <u-input v-model="form.password" type="password" placeholder="6-20 位字母+数字组合" border="surround" maxlength="20" clearable />
      </view>

      <view class="form-item">
        <view class="form-label">确认密码 <text class="required">*</text></view>
        <u-input v-model="form.confirmPassword" type="password" placeholder="请再次输入密码" border="surround" maxlength="20" clearable />
      </view>

      <u-button type="primary" shape="square" text="注册" :loading="submitting" @click="onSubmit" class="submit-btn" />

      <view class="login-link">
        已有账号？<text class="link" @tap="goLogin">立即登录</text>
      </view>
    </view>
  </view>
</template>

<style scoped lang="scss">
.register-page {
  min-height: 100vh;
  background: linear-gradient(180deg, #0a0a0a 0%, #1a1a1a 100%);
  padding: 96rpx 48rpx calc(48rpx + env(safe-area-inset-bottom));
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

.marketing-tip {
  display: inline-block;
  margin-top: 24rpx;
  padding: 8rpx 24rpx;
  background-color: rgba(255, 90, 60, 0.12);
  color: #ff5a3c;
  font-size: 24rpx;
  border-radius: 4rpx;
  font-weight: 500;
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

.required {
  color: #ff2e2e;
  margin-left: 4rpx;
}

.submit-btn {
  margin-top: 16rpx;
}

.login-link {
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
