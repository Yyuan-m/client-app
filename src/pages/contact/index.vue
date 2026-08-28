<script setup lang="ts">
/**
 * 联系客服页 - 联系方式 + 留言反馈表单
 * 原Web: 左侧4项联系方式（数据来自 useSystemConfig）+ 右侧留言表单
 * uni-app: 单列布局，联系方式卡片 + 反馈表单
 */
import { ref, reactive } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { useSystemConfig } from '@/composables/useSystemConfig'
import { useThemeClass } from '@/composables/useThemeClass'
import { useNavigationBar } from '@/composables/useNavigationBar'
import { submitFeedbackApi } from '@/api/modules/feedback'
import { validators } from '@/utils'

const { config, loadConfig } = useSystemConfig()
const { themeClass } = useThemeClass()
/** 原生导航栏随主题切换 */
useNavigationBar()

const form = reactive({
  name: '',
  phone: '',
  content: ''
})

const submitting = ref(false)

onLoad(async () => {
  try {
    await loadConfig()
  } catch (e) {
    console.error('[contact] loadConfig failed:', e)
  }
})

function callPhone(phone: string) {
  if (!phone) return
  uni.makePhoneCall({ phoneNumber: phone }).catch(() => {})
}

function copyEmail(email: string) {
  if (!email) return
  uni.setClipboardData({
    data: email,
    success: () => {
      uni.showToast({ title: '邮箱已复制', icon: 'success' })
    }
  })
}

function goOnlineConsult() {
  uni.showToast({ title: '在线咨询功能开发中', icon: 'none' })
}

async function submitFeedback() {
  if (!form.name.trim()) {
    uni.showToast({ title: '请输入姓名', icon: 'none' })
    return
  }
  if (!validators.isPhone(form.phone)) {
    uni.showToast({ title: '请输入正确的手机号', icon: 'none' })
    return
  }
  if (!form.content.trim()) {
    uni.showToast({ title: '请输入留言内容', icon: 'none' })
    return
  }

  submitting.value = true
  try {
    await submitFeedbackApi({
      type: 'feedback',
      name: form.name.trim(),
      phone: form.phone.trim(),
      content: form.content.trim()
    })
    uni.showToast({ title: '反馈提交成功', icon: 'success' })
    form.name = ''
    form.phone = ''
    form.content = ''
  } catch (e) {
    console.error('[contact] submit failed:', e)
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <view class="container contact-page" :class="themeClass">
    <!-- 联系方式区 -->
    <view class="section-title fade-in-up">联系方式</view>
    <view class="contact-grid">
      <view class="contact-card fade-in-up" @tap="callPhone(config?.hotline || '')">
        <view class="cc-icon">📞</view>
        <view class="cc-info">
          <view class="cc-label">服务热线</view>
          <view class="cc-value">{{ config?.hotline || '—' }}</view>
          <view class="cc-sub">7×24 小时服务</view>
        </view>
      </view>
      <view class="contact-card fade-in-up" data-delay="100" @tap="copyEmail(config?.email || '')">
        <view class="cc-icon">✉</view>
        <view class="cc-info">
          <view class="cc-label">邮箱</view>
          <view class="cc-value">{{ config?.email || '—' }}</view>
          <view class="cc-sub">点击复制</view>
        </view>
      </view>
      <view class="contact-card fade-in-up" data-delay="200" @tap="goOnlineConsult">
        <view class="cc-icon">💬</view>
        <view class="cc-info">
          <view class="cc-label">在线咨询</view>
          <view class="cc-value">立即咨询</view>
          <view class="cc-sub">点击进入在线客服</view>
        </view>
      </view>
      <view class="contact-card fade-in-up" data-delay="300">
        <view class="cc-icon">📍</view>
        <view class="cc-info">
          <view class="cc-label">总部地址</view>
          <view class="cc-value">{{ config?.address || '—' }}</view>
          <view class="cc-sub">欢迎到店参观</view>
        </view>
      </view>
    </view>

    <!-- 留言反馈表单 -->
    <view class="section-title fade-in-up">留言反馈</view>
    <view class="card form-card fade-in-up">
      <view class="form-item">
        <view class="form-label">姓名 <text class="required">*</text></view>
        <u-input v-model="form.name" placeholder="请输入您的姓名" maxlength="20" border="surround" />
      </view>
      <view class="form-item">
        <view class="form-label">手机号 <text class="required">*</text></view>
        <u-input v-model="form.phone" type="number" placeholder="请输入手机号" maxlength="11" border="surround" />
      </view>
      <view class="form-item">
        <view class="form-label">留言内容 <text class="required">*</text></view>
        <u-textarea v-model="form.content" placeholder="请输入您的留言或建议" maxlength="500" count border="surround" />
      </view>
      <u-button type="primary" shape="square" text="提交反馈" :loading="submitting" @click="submitFeedback" />
    </view>
  </view>
</template>

<style scoped lang="scss">
.contact-page {
  padding-bottom: calc(48rpx + env(safe-area-inset-bottom));
}

.section-title {
  font-size: 36rpx;
  font-weight: 600;
  color: var(--text-main);
  margin: 32rpx 0 24rpx;
}

.contact-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 24rpx;
}

.contact-card {
  display: flex;
  align-items: center;
  padding: 32rpx;
  background-color: var(--card-bg);
  border: 1rpx solid var(--border-color);
  border-radius: 16rpx;
}

.cc-icon {
  width: 80rpx;
  height: 80rpx;
  border-radius: 50%;
  background-color: rgba(255, 46, 46, 0.12);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 40rpx;
  margin-right: 24rpx;
  flex-shrink: 0;
}

.cc-info {
  flex: 1;
  min-width: 0;
}

.cc-label {
  font-size: 24rpx;
  color: var(--text-sub);
  margin-bottom: 4rpx;
}

.cc-value {
  font-size: 32rpx;
  color: var(--text-main);
  font-weight: 500;
  word-break: break-all;
}

.cc-sub {
  font-size: 22rpx;
  color: var(--text-dim);
  margin-top: 4rpx;
}

.form-card {
  display: flex;
  flex-direction: column;
  gap: 24rpx;
}

.form-item {
  display: flex;
  flex-direction: column;
  gap: 12rpx;
}

.form-label {
  font-size: 28rpx;
  color: var(--text-main);
  font-weight: 500;
}

.required {
  color: #ff2e2e;
  margin-left: 4rpx;
}
</style>
