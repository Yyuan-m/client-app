<script setup lang="ts">
/**
 * 个人中心 - 主页（竖向分组菜单）
 *
 * 布局：顶部用户卡片（登录态/游客态）+ 竖向分组菜单
 * 每个菜单项点击后跳转独立页面查看或编辑内容：
 * - 订单服务：我的订单（order/list）、我的评价（profile/reviews）
 * - 我的资产：我的优惠券（profile/coupons）
 * - 个人资料：个人信息（profile/info）、实名认证（profile/verify）
 * - 其他：设置（profile/settings）
 *
 * API: getReviewableOrdersApi（评价角标数量）
 */
import { computed, ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { useUserStore } from '@/stores/user'
import { getReviewableOrdersApi } from '@/api/modules/order'
import { resolveClientImage } from '@/utils/image'
import { getLevelRule } from '@/utils/memberLevel'
import { getCustomNavTopOffset } from '@/utils/navbar'
import { useThemeClass } from '@/composables/useThemeClass'
import { useNavigationBar } from '@/composables/useNavigationBar'
import type { OrderVO } from '@/api/types'

/** 自定义导航栏：顶部避开微信胶囊按钮 */
const navTop = getCustomNavTopOffset()

const { themeClass } = useThemeClass()
/** 自定义导航页同步状态栏文字/胶囊颜色随主题 */
useNavigationBar()
const userStore = useUserStore()

// 可评价订单数（角标）
const reviewCount = ref(0)

// 图片加载失败兜底：避免裂图，明确失败态
const avatarLoadFailed = ref(false)

interface MenuItem {
  key: string
  label: string
  icon: string
  url: string
  /** 右侧展示的值（如认证状态） */
  value?: string
  valueClass?: string
  /** 角标数字 */
  badge?: number
  /** 会员等级 tag 渐变色（我的会员菜单项专用） */
  levelGrad?: [string, string]
}

interface MenuGroup {
  title: string
  items: MenuItem[]
}

const menuGroups = computed<MenuGroup[]>(() => [
  {
    title: '订单服务',
    items: [
      { key: 'orders', label: '我的订单', icon: 'order', url: '/pages/order/list' },
      { key: 'appointments', label: '我的预约', icon: 'calendar', url: '/pages/profile/appointments' },
      {
        key: 'reviews',
        label: '我的评价',
        icon: 'star',
        url: '/pages/profile/reviews',
        badge: reviewCount.value
      }
    ]
  },
  {
    title: '我的资产',
    items: [{ key: 'coupons', label: '我的优惠券', icon: 'coupon', url: '/pages/profile/coupons' }]
  },
  {
    title: '个人资料',
    items: [
      { key: 'info', label: '个人信息', icon: 'account', url: '/pages/profile/info' },
      {
        key: 'member',
        label: '我的会员',
        icon: 'star',
        url: '/pages/profile/member',
        levelGrad: getLevelRule(userStore.user?.level).grad
      },
      {
        key: 'verify',
        label: '实名认证',
        icon: 'fingerprint',
        url: '/pages/profile/verify',
        value: verifyStatusText(userStore.user?.verifyStatus),
        valueClass: verifyStatusClass(userStore.user?.verifyStatus)
      }
    ]
  },
  {
    title: '其他',
    items: [{ key: 'settings', label: '设置', icon: 'setting', url: '/pages/profile/settings' }]
  }
])

onShow(async () => {
  avatarLoadFailed.value = false
  if (!userStore.isLoggedIn) return
  try {
    await userStore.fetchUserInfo()
    reviewCount.value = ((await getReviewableOrdersApi()) as OrderVO[])?.length || 0
  } catch (e) {
    console.error('[profile] onShow failed:', e)
  }
})

/** 去登录 */
function goLogin() {
  uni.navigateTo({ url: '/pages/auth/login?redirect=' + encodeURIComponent('/pages/profile/index') })
}

/** 点击菜单跳转新页面 */
function onMenuClick(item: MenuItem) {
  uni.navigateTo({
    url: item.url,
    fail: (err) => {
      console.error('[profile] navigate failed:', err)
      uni.showToast({ title: '页面跳转失败', icon: 'none' })
    }
  })
}

function verifyStatusText(s?: string): string {
  if (s === 'unverified') return '未认证'
  if (s === 'pending') return '审核中'
  if (s === 'verified') return '已认证'
  if (s === 'rejected') return '已驳回'
  return '未认证'
}

function verifyStatusClass(s?: string): string {
  if (s === 'verified') return 'v-verified'
  if (s === 'pending') return 'v-pending'
  if (s === 'rejected') return 'v-rejected'
  return 'v-unverified'
}
</script>

<template>
  <view class="profile-page" :class="themeClass" :style="{ paddingTop: navTop + 'px' }">
    <view class="page-header">
      <text class="header-title">个人中心</text>
    </view>

    <!-- 用户卡片：登录态 -->
    <view v-if="userStore.isLoggedIn" class="user-card" @tap="onMenuClick({ key: 'info', label: '', icon: '', url: '/pages/profile/info' })">
      <view class="avatar-wrap">
        <image
          v-if="userStore.user?.avatar && !avatarLoadFailed"
          :src="resolveClientImage(userStore.user.avatar)"
          mode="aspectFill"
          class="avatar"
          @error="avatarLoadFailed = true"
        />
        <view v-else class="avatar avatar-default">
          <text class="avatar-text">{{ (userStore.user?.nickname || 'U').charAt(0).toUpperCase() }}</text>
        </view>
      </view>
      <view class="user-info">
        <view class="user-name">{{ userStore.user?.nickname || userStore.user?.phone || '用户' }}</view>
        <view class="user-meta">
          <text class="verify-tag" :class="verifyStatusClass(userStore.user?.verifyStatus)">
            {{ verifyStatusText(userStore.user?.verifyStatus) }}
          </text>
          <text v-if="userStore.user?.phone" class="user-phone">{{ userStore.user.phone }}</text>
        </view>
      </view>
      <u-icon name="arrow-right" color="#6e6e73" size="28rpx"></u-icon>
    </view>

    <!-- 用户卡片：游客态 -->
    <view v-else class="user-card guest-card">
      <view class="avatar-wrap">
        <view class="avatar avatar-default">
          <u-icon name="account" color="#6e6e73" size="56rpx"></u-icon>
        </view>
      </view>
      <view class="user-info">
        <view class="user-name">未登录</view>
        <view class="user-meta">
          <text class="guest-tip">登录后查看订单 / 评价 / 优惠券</text>
        </view>
      </view>
      <view class="login-btn" @tap.stop="goLogin">去登录</view>
    </view>

    <!-- 竖向分组菜单（未登录仅展示分组结构，点击由路由拦截器引导登录） -->
    <view class="menu-area">
      <view v-for="group in menuGroups" :key="group.title" class="menu-group">
        <view class="group-title">{{ group.title }}</view>
        <view class="group-card">
          <view
            v-for="(item, idx) in group.items"
            :key="item.key"
            class="menu-item"
            :class="{ 'no-border': idx === group.items.length - 1 }"
            @tap="onMenuClick(item)"
          >
            <view class="item-left">
              <view class="item-icon">
                <u-icon :name="item.icon" color="#ff2e2e" size="30rpx"></u-icon>
              </view>
              <text class="item-label">{{ item.label }}</text>
            </view>
            <view class="item-right">
              <view
                v-if="item.levelGrad"
                class="item-level-tag"
                :style="{ background: `linear-gradient(135deg, ${item.levelGrad[0]} 0%, ${item.levelGrad[1]} 100%)` }"
              >
                <text class="level-tag-text">{{ userStore.user?.levelName || '普通会员' }}</text>
              </view>
              <text v-if="item.value" class="item-value" :class="item.valueClass">{{ item.value }}</text>
              <view v-if="item.badge && item.badge > 0" class="item-badge">
                {{ item.badge > 99 ? '99+' : item.badge }}
              </view>
              <u-icon name="arrow-right" color="#6e6e73" size="24rpx"></u-icon>
            </view>
          </view>
        </view>
      </view>
    </view>

    <!-- 底部 TabBar 占位 -->
    <view class="tabbar-placeholder"></view>
    <TabBar active="pages/profile/index" />
    <!-- 会员升级蒙层动画（等级突破档位时展示一次） -->
    <LevelUpOverlay />
  </view>
</template>

<style scoped lang="scss">
.profile-page {
  box-sizing: border-box;
  min-height: 100vh;
  background-color: var(--page-bg);
  padding-bottom: calc(100rpx + env(safe-area-inset-bottom));
}

.page-title {
  padding: 24rpx 32rpx 8rpx;
  font-size: 40rpx;
  font-weight: 800;
  color: var(--text-main);
  letter-spacing: 2rpx;
}

.page-header {
  display: flex;
  align-items: center;
  height: 88rpx;
  padding: 0 24rpx;
  background-color: var(--page-bg);
  border-bottom: 1rpx solid var(--border-color);
}

.header-title {
  flex: 1;
  text-align: center;
  font-size: 34rpx;
  font-weight: 700;
  color: var(--text-main);
}

/* 用户卡片 */
.user-card {
  display: flex;
  align-items: center;
  margin: 12rpx 20rpx 4rpx;
  padding: 24rpx 20rpx;
  background: linear-gradient(135deg, rgba(255, 46, 46, 0.1) 0%, var(--card-bg) 100%);
  border: 1rpx solid var(--border-color);
  border-radius: 14rpx;
}

.avatar-wrap {
  position: relative;
  width: 100rpx;
  height: 100rpx;
  margin-right: 20rpx;
  flex-shrink: 0;
}

.avatar {
  width: 100%;
  height: 100%;
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
  font-size: 40rpx;
  color: #ff2e2e;
  font-weight: 700;
}

.user-info {
  flex: 1;
  min-width: 0;
}

.user-name {
  font-size: 32rpx;
  font-weight: 700;
  color: var(--text-main);
  margin-bottom: 6rpx;
}

.user-meta {
  display: flex;
  gap: 12rpx;
  align-items: center;
}

.verify-tag {
  font-size: 20rpx;
  padding: 4rpx 16rpx;
  border-radius: 20rpx;
  line-height: 1.6;
}

.v-unverified { background-color: rgba(174, 174, 178, 0.18); color: var(--text-sub); }
.v-pending { background-color: rgba(255, 153, 0, 0.18); color: #ff9900; }
.v-verified { background-color: rgba(7, 193, 96, 0.18); color: #07c160; }
.v-rejected { background-color: rgba(255, 46, 46, 0.18); color: #ff2e2e; }

.user-phone {
  font-size: 22rpx;
  color: var(--text-sub);
}

.guest-card {
  background: linear-gradient(135deg, rgba(174, 174, 178, 0.08) 0%, var(--card-bg) 100%);
}

.guest-tip {
  font-size: 22rpx;
  color: var(--text-sub);
}

.login-btn {
  flex-shrink: 0;
  padding: 10rpx 20rpx;
  background-color: rgba(255, 46, 46, 0.12);
  color: #ff2e2e;
  font-size: 22rpx;
  border-radius: 8rpx;
  border: 1rpx solid #ff2e2e;
}

/* 分组菜单（紧凑） */
.menu-area {
  padding: 8rpx 20rpx 0;
}

.menu-group {
  margin-bottom: 16rpx;
}

.group-title {
  font-size: 22rpx;
  color: var(--text-dim);
  padding: 4rpx 8rpx 8rpx;
}

.group-card {
  background-color: var(--card-bg);
  border: 1rpx solid var(--border-color);
  border-radius: 12rpx;
  overflow: hidden;
}

.menu-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 18rpx 20rpx;
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
  width: 44rpx;
  height: 44rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: rgba(255, 46, 46, 0.1);
  border-radius: 8rpx;
}

.item-label {
  font-size: 26rpx;
  color: var(--text-main);
}

.item-right {
  display: flex;
  align-items: center;
  gap: 10rpx;
}

.item-value {
  font-size: 22rpx;

  &.v-unverified { color: var(--text-sub); }
  &.v-pending { color: #ff9900; }
  &.v-verified { color: #07c160; }
  &.v-rejected { color: #ff2e2e; }
}

/* 我的会员等级 tag：渐变背景 + 白字，右侧展示对应等级 */
.item-level-tag {
  padding: 6rpx 18rpx;
  border-radius: 999rpx;

  .level-tag-text {
    font-size: 22rpx;
    color: #ffffff;
    font-weight: 600;
    letter-spacing: 2rpx;
  }
}

.item-badge {
  min-width: 30rpx;
  height: 30rpx;
  padding: 0 8rpx;
  background-color: #ff2e2e;
  color: #fff;
  font-size: 18rpx;
  line-height: 30rpx;
  text-align: center;
  border-radius: 15rpx;
}

.tabbar-placeholder {
  height: 100rpx;
}
</style>
