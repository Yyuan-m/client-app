<script setup lang="ts">
/**
 * 登录页 - 移动端纯表单布局（无侧边品牌视觉区）
 * 原Web: 左侧品牌视觉区 + 右侧表单
 * 业务：username + password + 记住密码（用户名保存到 uni.storage）
 * 登录后跳转 redirect query，默认 /pages/home/index
 * 微信小程序端：支持获取微信头像昵称，登录成功后自动同步到个人资料
 */
import { ref, reactive } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { useUserStore } from '@/stores/user'
import { updateProfileApi, updateAvatarApi } from '@/api/modules/user'
import { storage } from '@/utils'
import type { WxProfile } from '@/components/WxProfileField/WxProfileField.vue'
import { useThemeClass } from '@/composables/useThemeClass'
import { useNavigationBar } from '@/composables/useNavigationBar'

const userStore = useUserStore()
const { themeClass } = useThemeClass()
/** 原生导航栏随主题切换 */
useNavigationBar()

const SAVED_USERNAME_KEY = 'lux_saved_username'
/** 注册页暂存的微信头像 key（注册成功后保存，登录成功后上传） */
const WX_PENDING_AVATAR_KEY = 'lux_wx_pending_avatar'

const form = reactive({
  username: '',
  password: ''
})
const rememberUsername = ref(false)
const submitting = ref(false)
const redirect = ref('/pages/home/index')

/** 微信头像昵称（仅微信小程序端可获取） */
const wxProfile = ref<WxProfile>({ avatar: '', nickname: '' })

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
  // 读取注册页暂存的微信头像
  const pendingAvatar = storage.get<string>(WX_PENDING_AVATAR_KEY)
  if (pendingAvatar) {
    wxProfile.value.avatar = pendingAvatar
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
    // 微信小程序端：同步微信头像昵称到个人资料（失败不阻断跳转）
    await syncWxProfile()
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

/** 登录成功后同步微信头像昵称（仅微信小程序端有值时执行） */
async function syncWxProfile() {
  const { avatar, nickname } = wxProfile.value
  if (!avatar && !nickname?.trim()) return
  try {
    if (nickname?.trim()) {
      await updateProfileApi({ nickname: nickname.trim() })
    }
    if (avatar) {
      await updateAvatarApi(avatar)
    }
    await userStore.fetchUserInfo()
    uni.showToast({ title: '已同步微信头像昵称', icon: 'none' })
  } catch (e) {
    console.error('[login] syncWxProfile failed:', e)
  } finally {
    storage.remove(WX_PENDING_AVATAR_KEY)
    wxProfile.value = { avatar: '', nickname: '' }
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

/** 快捷返回首页（首页非 tabBar 页面，用 reLaunch） */
function goHome() {
  uni.reLaunch({ url: '/pages/home/index' })
}
</script>

<template>
  <view class="login-page" :class="themeClass">
    <!-- 点击 logo 跳转首页 -->
    <view class="brand-header" @tap="goHome">
      <view class="brand-title">LUXURY CAR</view>
      <view class="brand-subtitle">大圣玩车 · 豪华车租赁</view>
    </view>

    <view class="form-card">
      <view class="form-title">欢迎登录</view>
      <view class="form-subtitle">登录后享受更多专属服务</view>

      <!-- 微信小程序端：获取微信头像昵称，登录后自动同步到个人资料 -->
      <WxProfileField v-model:profile="wxProfile" />

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
  background: linear-gradient(180deg, var(--page-bg) 0%, var(--card-bg) 100%);
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
  color: var(--text-sub);
  margin-top: 8rpx;
}

.form-card {
  background-color: var(--card-bg);
  border-radius: 16rpx;
  padding: 48rpx 32rpx;
  border: 1rpx solid var(--border-color);
}

.form-title {
  font-size: 40rpx;
  font-weight: 700;
  color: var(--text-main);
  margin-bottom: 8rpx;
}

.form-subtitle {
  font-size: 26rpx;
  color: var(--text-sub);
  margin-bottom: 48rpx;
}

.form-item {
  margin-bottom: 32rpx;
}

.form-label {
  font-size: 26rpx;
  color: var(--text-sub);
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
  border: 2rpx solid var(--text-dim);
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
  color: var(--text-sub);
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
  color: var(--text-sub);
}

.link {
  color: #ff2e2e;
  font-weight: 500;
}
</style>
