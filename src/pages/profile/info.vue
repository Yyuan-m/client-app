<script setup lang="ts">
/**
 * 个人信息 - 查看/编辑页
 *
 * 内容：头像（点击更换）+ 昵称 + 手机号 + 邮箱
 * API: updateProfileApi / updateAvatarApi → fetchUserInfo 刷新
 * 微信小程序端：头像支持 open-type="chooseAvatar" 直接取微信头像
 */
import { reactive, ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { useUserStore } from '@/stores/user'
import { updateProfileApi, updateAvatarApi } from '@/api/modules/user'
import { resolveClientImage } from '@/utils/image'
import { validators } from '@/utils'
import { useThemeClass } from '@/composables/useThemeClass'
import { useNavigationBar } from '@/composables/useNavigationBar'

const { themeClass } = useThemeClass()
/** 原生导航栏随主题切换 */
useNavigationBar()
const userStore = useUserStore()

const form = reactive({
  nickname: '',
  phone: '',
  email: ''
})
const saving = ref(false)
const avatarLoadFailed = ref(false)

onShow(() => {
  avatarLoadFailed.value = false
  syncForm()
})

function syncForm() {
  const u = userStore.user
  if (!u) return
  form.nickname = u.nickname || ''
  form.phone = u.phone || ''
  form.email = u.email || ''
}

/** 相册/相机选图上传头像（全端通用） */
function chooseAvatar() {
  uni.chooseImage({
    count: 1,
    sizeType: ['compressed'],
    sourceType: ['album', 'camera'],
    success: (res) => {
      const filePath = res.tempFilePaths[0]
      if (filePath) uploadAvatar(filePath)
    }
  })
}

/** 头像上传 */
async function uploadAvatar(filePath: string) {
  uni.showLoading({ title: '上传中...' })
  try {
    await updateAvatarApi(filePath)
    uni.showToast({ title: '头像更新成功', icon: 'success' })
    await userStore.fetchUserInfo()
    avatarLoadFailed.value = false
  } catch (e) {
    console.error('[profile/info] avatar upload failed:', e)
  } finally {
    uni.hideLoading()
  }
}

/** 保存个人信息 */
async function saveProfile() {
  if (!form.nickname.trim()) {
    uni.showToast({ title: '请输入昵称', icon: 'none' })
    return
  }
  if (form.phone && !validators.isPhone(form.phone)) {
    uni.showToast({ title: '请输入正确的手机号', icon: 'none' })
    return
  }
  if (form.email && !validators.isEmail(form.email)) {
    uni.showToast({ title: '请输入正确的邮箱', icon: 'none' })
    return
  }
  saving.value = true
  try {
    await updateProfileApi({
      nickname: form.nickname.trim(),
      phone: form.phone.trim() || undefined,
      email: form.email.trim() || undefined
    })
    uni.showToast({ title: '保存成功', icon: 'success' })
    await userStore.fetchUserInfo()
  } catch (e) {
    console.error('[profile/info] save failed:', e)
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <view class="info-page" :class="themeClass">
    <!-- 头像 -->
    <view class="card avatar-card">
      <view class="card-title">头像</view>
      <!-- #ifdef MP-WEIXIN -->
      <button class="avatar-btn" open-type="chooseAvatar" @chooseavatar="uploadAvatar($event.detail.avatarUrl)">
        <image
          v-if="userStore.user?.avatar && !avatarLoadFailed"
          :src="resolveClientImage(userStore.user.avatar)"
          mode="aspectFill"
          class="avatar-img"
          @error="avatarLoadFailed = true"
        />
        <view v-else class="avatar-img avatar-default">
          <text class="avatar-text">{{ (form.nickname || 'U').charAt(0).toUpperCase() }}</text>
        </view>
        <text class="avatar-tip">点击更换（支持微信头像）</text>
      </button>
      <!-- #endif -->
      <!-- #ifndef MP-WEIXIN -->
      <view class="avatar-btn" @tap="chooseAvatar">
        <image
          v-if="userStore.user?.avatar && !avatarLoadFailed"
          :src="resolveClientImage(userStore.user.avatar)"
          mode="aspectFill"
          class="avatar-img"
          @error="avatarLoadFailed = true"
        />
        <view v-else class="avatar-img avatar-default">
          <text class="avatar-text">{{ (form.nickname || 'U').charAt(0).toUpperCase() }}</text>
        </view>
        <text class="avatar-tip">点击更换头像</text>
      </view>
      <!-- #endif -->
    </view>

    <!-- 基础资料 -->
    <view class="card form-card">
      <view class="card-title">基础资料</view>
      <view class="form-item">
        <view class="form-label">昵称 <text class="required">*</text></view>
        <u-input v-model="form.nickname" placeholder="请输入昵称" border="surround" maxlength="20" clearable />
      </view>
      <view class="form-item">
        <view class="form-label">手机号</view>
        <u-input v-model="form.phone" type="number" placeholder="请输入手机号" border="surround" maxlength="11" clearable />
      </view>
      <view class="form-item">
        <view class="form-label">邮箱</view>
        <u-input v-model="form.email" placeholder="请输入邮箱" border="surround" maxlength="50" clearable />
      </view>
    </view>

    <!-- 账号信息（只读展示） -->
    <view class="card readonly-card">
      <view class="card-title">账号信息</view>
      <view class="readonly-row">
        <text class="row-label">用户名</text>
        <text class="row-value">{{ userStore.user?.username || '—' }}</text>
      </view>
      <view class="readonly-row no-border">
        <text class="row-label">会员等级</text>
        <text class="row-value">{{ userStore.user?.levelName || '普通会员' }}</text>
      </view>
    </view>

    <u-button type="primary" size="large" shape="square" text="保存" :loading="saving" custom-style="margin-top: 32rpx" @click="saveProfile" />
  </view>
</template>

<style scoped lang="scss">
.info-page {
  min-height: 100vh;
  background-color: var(--page-bg);
  padding: 24rpx;
  box-sizing: border-box;
}

.card {
  background-color: var(--card-bg);
  border: 1rpx solid var(--border-color);
  border-radius: 16rpx;
  padding: 24rpx;
  margin-bottom: 24rpx;
}

.card-title {
  font-size: 28rpx;
  font-weight: 600;
  color: var(--text-main);
  margin-bottom: 24rpx;
}

/* 头像 */
.avatar-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16rpx;
  padding: 0;
  margin: 0;
  background-color: transparent;
  border: none;
  line-height: inherit;

  &::after {
    border: none;
  }
}

.avatar-img {
  width: 160rpx;
  height: 160rpx;
  border-radius: 50%;
  border: 2rpx solid #ff2e2e;
  background-color: var(--border-color);
}

.avatar-default {
  display: flex;
  align-items: center;
  justify-content: center;
}

.avatar-text {
  font-size: 64rpx;
  color: #ff2e2e;
  font-weight: 700;
}

.avatar-tip {
  font-size: 22rpx;
  color: var(--text-dim);
}

/* 表单 */
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
  font-size: 26rpx;
  color: var(--text-sub);
}

.required {
  color: #ff2e2e;
}

/* 只读信息 */
.readonly-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20rpx 0;
  border-bottom: 1rpx solid var(--border-color);

  &.no-border {
    border-bottom: none;
  }
}

.row-label {
  font-size: 26rpx;
  color: var(--text-sub);
}

.row-value {
  font-size: 26rpx;
  color: var(--text-main);
}
</style>
