<script setup lang="ts">
/**
 * 忘记密码 - 3 步流程
 * 原Web: el-steps 进度展示
 * Step 1: 手机号 + 短信验证码（60s 倒计时），sendSmsCodeApi({ phone })
 * Step 2: 新密码 + 确认密码，forgotPasswordApi({ phone, code, password })
 * Step 3: 成功页，按钮跳 /pages/auth/login
 * 倒计时清理：onUnload clearInterval
 */
import { reactive, ref, onUnmounted } from 'vue'
import { onLoad, onUnload } from '@dcloudio/uni-app'
import { sendSmsCodeApi, forgotPasswordApi } from '@/api/modules/auth'
import { validators } from '@/utils'

const step = ref(1)

const form = reactive({
  phone: '',
  code: '',
  password: '',
  confirmPassword: ''
})

const submitting = ref(false)
const countdown = ref(0)
let countdownTimer: ReturnType<typeof setInterval> | null = null

onLoad(() => {})

onUnload(() => {
  clearCountdown()
})

onUnmounted(() => {
  clearCountdown()
})

function clearCountdown() {
  if (countdownTimer) {
    clearInterval(countdownTimer)
    countdownTimer = null
  }
}

function startCountdown() {
  countdown.value = 60
  clearCountdown()
  countdownTimer = setInterval(() => {
    countdown.value--
    if (countdown.value <= 0) {
      clearCountdown()
    }
  }, 1000)
}

async function sendCode() {
  if (!validators.isPhone(form.phone)) {
    uni.showToast({ title: '请输入正确的手机号', icon: 'none' })
    return
  }
  if (countdown.value > 0) return
  try {
    await sendSmsCodeApi({ phone: form.phone, type: 'forgot' })
    uni.showToast({ title: '验证码已发送', icon: 'success' })
    startCountdown()
  } catch (e) {
    console.error('[forgot] sendCode failed:', e)
  }
}

function nextStep1(): boolean {
  if (!validators.isPhone(form.phone)) {
    uni.showToast({ title: '请输入正确的手机号', icon: 'none' })
    return false
  }
  if (!form.code.trim()) {
    uni.showToast({ title: '请输入短信验证码', icon: 'none' })
    return false
  }
  return true
}

function validateStep2(): boolean {
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

async function nextStep2() {
  if (!nextStep1()) return
  if (!validateStep2()) return
  submitting.value = true
  try {
    await forgotPasswordApi({
      phone: form.phone,
      code: form.code.trim(),
      password: form.password
    })
    uni.showToast({ title: '密码重置成功', icon: 'success' })
    step.value = 3
  } catch (e) {
    console.error('[forgot] reset failed:', e)
  } finally {
    submitting.value = false
  }
}

function goLogin() {
  uni.redirectTo({ url: '/pages/auth/login' })
}

function goStep1() {
  step.value = 1
  form.code = ''
  form.password = ''
  form.confirmPassword = ''
}
</script>

<template>
  <view class="forgot-page">
    <view class="brand-header">
      <view class="brand-title">LUXURY CAR</view>
      <view class="brand-subtitle">找回密码</view>
    </view>

    <!-- 进度步骤 -->
    <view class="steps">
      <view class="step" :class="{ active: step >= 1, done: step > 1 }">
        <view class="step-num">1</view>
        <view class="step-text">验证身份</view>
      </view>
      <view class="step-line" :class="{ active: step > 1 }"></view>
      <view class="step" :class="{ active: step >= 2, done: step > 2 }">
        <view class="step-num">2</view>
        <view class="step-text">设置新密码</view>
      </view>
      <view class="step-line" :class="{ active: step > 2 }"></view>
      <view class="step" :class="{ active: step >= 3, done: step > 3 }">
        <view class="step-num">3</view>
        <view class="step-text">完成</view>
      </view>
    </view>

    <view class="form-card">
      <!-- Step 1: 验证身份 -->
      <view v-if="step === 1" class="step-content">
        <view class="form-title">验证身份</view>
        <view class="form-subtitle">请输入注册时绑定的手机号</view>

        <view class="form-item">
          <view class="form-label">手机号</view>
          <u-input v-model="form.phone" type="number" placeholder="请输入手机号" border="surround" maxlength="11" clearable />
        </view>

        <view class="form-item">
          <view class="form-label">短信验证码</view>
          <view class="code-row">
            <u-input v-model="form.code" type="number" placeholder="请输入验证码" border="surround" maxlength="6" clearable class="code-input" />
            <view class="send-btn" :class="{ disabled: countdown > 0 || !form.phone }" @tap="sendCode">
              {{ countdown > 0 ? `${countdown}s` : '发送验证码' }}
            </view>
          </view>
        </view>

        <u-button type="primary" shape="square" text="下一步" @click="() => { if (nextStep1()) step = 2 }" class="submit-btn" />
      </view>

      <!-- Step 2: 设置新密码 -->
      <view v-else-if="step === 2" class="step-content">
        <view class="form-title">设置新密码</view>
        <view class="form-subtitle">请设置新的登录密码</view>

        <view class="form-item">
          <view class="form-label">新密码</view>
          <u-input v-model="form.password" type="password" placeholder="6-20 位字母+数字组合" border="surround" maxlength="20" clearable />
        </view>

        <view class="form-item">
          <view class="form-label">确认密码</view>
          <u-input v-model="form.confirmPassword" type="password" placeholder="请再次输入新密码" border="surround" maxlength="20" clearable />
        </view>

        <view class="btn-row">
          <u-button shape="square" text="上一步" @click="goStep1" class="back-btn" />
          <u-button type="primary" shape="square" text="确认重置" :loading="submitting" @click="nextStep2" class="submit-btn" />
        </view>
      </view>

      <!-- Step 3: 完成 -->
      <view v-else class="step-content success-content">
        <view class="success-icon">✓</view>
        <view class="success-title">密码重置成功</view>
        <view class="success-subtitle">请使用新密码登录账号</view>
        <u-button type="primary" shape="square" text="去登录" @click="goLogin" class="submit-btn" />
      </view>
    </view>
  </view>
</template>

<style scoped lang="scss">
.forgot-page {
  min-height: 100vh;
  background: linear-gradient(180deg, #0a0a0a 0%, #1a1a1a 100%);
  padding: 96rpx 48rpx calc(48rpx + env(safe-area-inset-bottom));
}

.brand-header {
  text-align: center;
  margin-bottom: 48rpx;
}

.brand-title {
  font-size: 48rpx;
  font-weight: 800;
  color: #ff2e2e;
  letter-spacing: 4rpx;
}

.brand-subtitle {
  font-size: 26rpx;
  color: #aeaeb2;
  margin-top: 8rpx;
}

.steps {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 48rpx;
  padding: 0 16rpx;
}

.step {
  display: flex;
  flex-direction: column;
  align-items: center;
  flex-shrink: 0;

  .step-num {
    width: 64rpx;
    height: 64rpx;
    border-radius: 50%;
    background-color: #2a2a2a;
    color: #6e6e73;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 28rpx;
    font-weight: 700;
    border: 2rpx solid #2a2a2a;
  }

  .step-text {
    font-size: 22rpx;
    color: #6e6e73;
    margin-top: 8rpx;
  }

  &.active {
    .step-num {
      background-color: #ff2e2e;
      color: #fff;
      border-color: #ff2e2e;
    }
    .step-text {
      color: #ff2e2e;
    }
  }

  &.done {
    .step-num {
      background-color: #1a1a1a;
      color: #ff2e2e;
      border-color: #ff2e2e;
    }
  }
}

.step-line {
  flex: 1;
  height: 2rpx;
  background-color: #2a2a2a;
  margin: 0 8rpx;
  position: relative;
  top: -16rpx;

  &.active {
    background-color: #ff2e2e;
  }
}

.form-card {
  background-color: #1a1a1a;
  border-radius: 16rpx;
  padding: 48rpx 32rpx;
  border: 1rpx solid #2a2a2a;
  min-height: 480rpx;
}

.step-content {
  display: flex;
  flex-direction: column;
}

.form-title {
  font-size: 36rpx;
  font-weight: 700;
  color: #f5f5f5;
  margin-bottom: 8rpx;
}

.form-subtitle {
  font-size: 26rpx;
  color: #aeaeb2;
  margin-bottom: 40rpx;
}

.form-item {
  margin-bottom: 32rpx;
}

.form-label {
  font-size: 26rpx;
  color: #d1d1d6;
  margin-bottom: 12rpx;
}

.code-row {
  display: flex;
  gap: 16rpx;
  align-items: center;
}

.code-input {
  flex: 1;
}

.send-btn {
  flex-shrink: 0;
  padding: 0 24rpx;
  height: 64rpx;
  line-height: 64rpx;
  background-color: #ff2e2e;
  color: #fff;
  font-size: 24rpx;
  border-radius: 8rpx;
  text-align: center;
  min-width: 180rpx;

  &.disabled {
    background-color: #2a2a2a;
    color: #6e6e73;
  }
}

.btn-row {
  display: flex;
  gap: 24rpx;
  margin-top: 16rpx;
}

.back-btn {
  flex: 1;
}

.submit-btn {
  flex: 1;
}

.success-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 64rpx 0;
}

.success-icon {
  width: 128rpx;
  height: 128rpx;
  border-radius: 50%;
  background-color: rgba(7, 193, 96, 0.12);
  color: #07c160;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 80rpx;
  font-weight: 700;
  margin-bottom: 32rpx;
}

.success-title {
  font-size: 36rpx;
  font-weight: 700;
  color: #f5f5f5;
  margin-bottom: 8rpx;
}

.success-subtitle {
  font-size: 26rpx;
  color: #aeaeb2;
  margin-bottom: 48rpx;
}
</style>
