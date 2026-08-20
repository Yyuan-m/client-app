<script setup lang="ts">
/**
 * AppHeader - 移动端顶部导航栏
 *
 * 业务对齐原 Web 项目 AppHeader 组件：
 *  - 默认隐藏（首页用 navigationStyle:custom 自定义）
 *  - 提供插槽模式：左侧返回按钮、中间标题、右侧操作（购物车 badge + 个人中心入口）
 *  - 滚动监听：onPageScroll 切换毛玻璃背景
 *  - 公告下拉：getTopAnnouncementsApi 加载 3 条 + 红点徽标
 *  - 车型分类：getDictByTypeApi('vehicle_type') 加载，下拉菜单选择跳列表
 *  - 购物车 badge：cartStore.totalCount
 *  - 登录态：useUserStore，已登录显示头像 + 退出菜单（uni.showActionSheet），未登录显示登录按钮
 *
 * 适配 uni-app 关键差异：
 *  - 大多数页面用 uni 原生导航栏（pages.json navigationBarTitleText）
 *  - 本组件主要用于首页（navigationStyle:custom）自定义场景
 *  - router.push → uni.navigateTo / uni.reLaunch
 *  - el-dropdown → u-popup（弹出面板）+ tap 触发
 *  - ElMessageBox.confirm → uni.showModal
 *  - 滚动监听 → onPageScroll 生命周期
 */
import { ref, computed, onMounted } from 'vue'
import { onPageScroll } from '@dcloudio/uni-app'
import { useUserStore } from '@/stores/user'
import { useCartStore } from '@/stores/cart'
import { useAppStore } from '@/stores/app'
import { getDictByTypeApi } from '@/api/modules/system'
import { getTopAnnouncementsApi } from '@/api/modules/announcement'
import { resolveClientImage } from '@/utils/image'
import type { DictDataVO, AnnouncementVO } from '@/api/types'

const userStore = useUserStore()
const cartStore = useCartStore()
const appStore = useAppStore()

/** 是否滚动后（毛玻璃背景开关） */
const isScrolled = ref(false)

/** 车型分类字典 */
const vehicleTypes = ref<DictDataVO[]>([])

/** 头部公告：3 条高优先级 */
const topAnnouncements = ref<AnnouncementVO[]>([])

/** 当前激活的弹出面板：vehicle / announcement / null */
const activePopup = ref<'vehicle' | 'announcement' | null>(null)

/** 购物车数量徽标 */
const cartBadge = computed(() => cartStore.totalCount)

/** 用户头像 URL */
const userAvatar = computed(() => {
  return userStore.user?.avatar ? resolveClientImage(userStore.user.avatar) : ''
})

/** 用户昵称首字（头像兜底） */
const userInitial = computed(() => {
  const name = userStore.nickname || '客'
  return name.charAt(0)
})

onMounted(() => {
  // 加载车型分类字典
  getDictByTypeApi('vehicle_type')
    .then((list) => {
      vehicleTypes.value = list || []
    })
    .catch((e) => console.error('[AppHeader] 加载车型分类字典失败', e))

  // 加载头部公告下拉数据
  getTopAnnouncementsApi()
    .then((list) => {
      topAnnouncements.value = list || []
    })
    .catch((e) => console.error('[AppHeader] 加载公告失败', e))
})

/** 滚动监听：滚动 > 20px 显示毛玻璃背景（与原 Web 阈值对齐） */
onPageScroll((e: { scrollTop: number }) => {
  isScrolled.value = e.scrollTop > 20
})

/** 切换车辆分类弹出 */
function toggleVehiclePopup() {
  activePopup.value = activePopup.value === 'vehicle' ? null : 'vehicle'
}

/** 切换公告弹出 */
function toggleAnnouncementPopup() {
  activePopup.value = activePopup.value === 'announcement' ? null : 'announcement'
}

/** 关闭所有弹出 */
function closePopup() {
  activePopup.value = null
}

/** 跳转首页 */
function goHome() {
  uni.reLaunch({ url: '/pages/home/index' })
}

/** 跳转车辆列表（带分类参数） */
function goVehicleList(type?: string) {
  closePopup()
  const url = type
    ? `/pages/vehicle/list?type=${encodeURIComponent(type)}`
    : '/pages/vehicle/list'
  uni.navigateTo({
    url,
    fail: () => {
      uni.reLaunch({ url })
    }
  })
}

/** 跳转公告列表 */
function goAnnouncementList() {
  closePopup()
  uni.navigateTo({ url: '/pages/announcement/list' })
}

/** 跳转公告详情 */
function goAnnouncementDetail(id: number | string) {
  closePopup()
  uni.navigateTo({ url: `/pages/announcement/detail?id=${id}` })
}

/** 跳转关于我们 */
function goAbout() {
  uni.navigateTo({ url: '/pages/about/index' })
}

/** 跳转联系客服 */
function goContact() {
  uni.navigateTo({ url: '/pages/contact/index' })
}

/** 跳转购物车 */
function goCart() {
  uni.navigateTo({
    url: '/pages/cart/index',
    fail: () => {
      uni.reLaunch({ url: '/pages/cart/index' })
    }
  })
}

/** 跳转登录 */
function goLogin() {
  uni.navigateTo({ url: '/pages/auth/login' })
}

/** 跳转注册 */
function goRegister() {
  uni.navigateTo({ url: '/pages/auth/register' })
}

/** 已登录：点击头像展开操作菜单 */
function showUserMenu() {
  if (!userStore.isLoggedIn) {
    goLogin()
    return
  }
  uni.showActionSheet({
    itemList: ['个人中心', '我的订单', '退出登录'],
    success: (res) => {
      if (res.tapIndex === 0) {
        uni.navigateTo({ url: '/pages/profile/index' })
      } else if (res.tapIndex === 1) {
        uni.navigateTo({
          url: '/pages/order/list',
          fail: () => uni.reLaunch({ url: '/pages/order/list' })
        })
      } else if (res.tapIndex === 2) {
        confirmLogout()
      }
    }
  })
}

/** 退出登录二次确认 */
function confirmLogout() {
  uni.showModal({
    title: '退出登录',
    content: '确定退出当前账号吗？',
    confirmText: '退出',
    cancelText: '取消',
    success: async (res) => {
      if (!res.confirm) return
      try {
        await userStore.logout()
        uni.showToast({ title: '已退出登录', icon: 'success' })
        setTimeout(() => {
          uni.reLaunch({ url: '/pages/home/index' })
        }, 800)
      } catch (e) {
        console.error('[AppHeader] 退出登录失败:', e)
        uni.showToast({ title: '退出失败，请重试', icon: 'none' })
      }
    }
  })
}

/** 切换主题 */
function toggleTheme() {
  appStore.toggleTheme()
}

/** 格式化公告日期（取前 10 位 YYYY-MM-DD） */
function formatAnnouncementDate(t?: string): string {
  if (!t) return ''
  return String(t).slice(0, 10)
}
</script>

<template>
  <view class="app-header" :class="{ scrolled: isScrolled }">
    <view class="header-inner">
      <!-- 左侧：Logo -->
      <view class="header-logo" @tap="goHome">
        <text class="logo-text">LUXURY CAR</text>
      </view>

      <!-- 中间：导航菜单（首页 + 车型 + 公告 + 关于 + 联系） -->
      <view class="nav-menu">
        <text class="nav-link" @tap="goHome">首页</text>

        <!-- 车型分类 -->
        <view class="nav-item" @tap="toggleVehiclePopup">
          <text class="nav-link">车型</text>
          <text class="nav-arrow">▾</text>
        </view>

        <!-- 公告 -->
        <view class="nav-item" @tap="toggleAnnouncementPopup">
          <text class="nav-link">公告</text>
          <text v-if="topAnnouncements.length" class="anno-dot">{{ topAnnouncements.length }}</text>
          <text class="nav-arrow">▾</text>
        </view>

        <text class="nav-link" @tap="goAbout">关于</text>
        <text class="nav-link" @tap="goContact">客服</text>
      </view>

      <!-- 右侧操作 -->
      <view class="header-actions">
        <!-- 主题切换 -->
        <view class="action-item" @tap="toggleTheme">
          <text class="action-icon">{{ appStore.theme === 'dark' ? '☾' : '☀' }}</text>
        </view>

        <!-- 购物车 -->
        <view class="action-item cart-action" @tap="goCart">
          <text class="action-icon">🛒</text>
          <view v-if="cartBadge > 0" class="cart-badge">{{ cartBadge > 99 ? '99+' : cartBadge }}</view>
        </view>

        <!-- 未登录 -->
        <template v-if="!userStore.isLoggedIn">
          <view class="action-btn btn-outline" @tap="goLogin">
            <text>登录</text>
          </view>
        </template>

        <!-- 已登录：头像 -->
        <view v-else class="user-info" @tap="showUserMenu">
          <view class="user-avatar">
            <image
              v-if="userAvatar"
              :src="userAvatar"
              mode="aspectFill"
              class="avatar-img"
            />
            <text v-else class="avatar-text">{{ userInitial }}</text>
          </view>
          <text class="user-name">{{ userStore.nickname }}</text>
        </view>
      </view>
    </view>

    <!-- 车型分类弹出面板 -->
    <u-popup
      :show="activePopup === 'vehicle'"
      mode="top"
      :custom-style="{ top: '88rpx' }"
      @close="closePopup"
    >
      <view class="popup-panel vehicle-popup">
        <view class="popup-item" @tap="goVehicleList()">
          <text class="popup-item-text">全部车型</text>
        </view>
        <view v-for="item in vehicleTypes" :key="item.dictValue" class="popup-item" @tap="goVehicleList(item.dictValue)">
          <text class="popup-item-text">{{ item.dictLabel }}</text>
        </view>
        <view v-if="!vehicleTypes.length" class="popup-empty">
          <text>暂无分类</text>
        </view>
      </view>
    </u-popup>

    <!-- 公告弹出面板 -->
    <u-popup
      :show="activePopup === 'announcement'"
      mode="top"
      :custom-style="{ top: '88rpx' }"
      @close="closePopup"
    >
      <view class="popup-panel announcement-popup">
        <template v-if="topAnnouncements.length">
          <view v-for="item in topAnnouncements" :key="item.id" class="anno-item" @tap="goAnnouncementDetail(item.id)">
            <text class="anno-title">{{ item.title }}</text>
            <text class="anno-date">{{ formatAnnouncementDate(item.publishTime || item.createTime) }}</text>
          </view>
        </template>
        <view v-else class="popup-empty">
          <text>暂无公告</text>
        </view>
        <view class="popup-item all-link" @tap="goAnnouncementList">
          <text class="popup-item-text">查看全部公告 →</text>
        </view>
      </view>
    </u-popup>

    <!-- 遮罩层 -->
    <view v-if="activePopup" class="popup-mask" @tap="closePopup" />
  </view>
</template>

<style scoped lang="scss">
.app-header {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 999;
  height: 88rpx;
  background-color: transparent;
  border-bottom: 1rpx solid transparent;
  transition: background-color 0.25s, border-color 0.25s;

  &.scrolled {
    background-color: rgba(10, 10, 10, 0.85);
    backdrop-filter: saturate(180%) blur(20px);
    -webkit-backdrop-filter: saturate(180%) blur(20px);
    border-bottom-color: #1f1f1f;
  }
}

.header-inner {
  height: 100%;
  padding: 0 24rpx;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16rpx;
}

.header-logo {
  flex-shrink: 0;
  .logo-text {
    font-size: 28rpx;
    font-weight: 600;
    letter-spacing: 1rpx;
    text-transform: uppercase;
    color: #f5f5f5;
  }
}

.nav-menu {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 24rpx;
  overflow: hidden;
}

.nav-item {
  display: inline-flex;
  align-items: center;
  position: relative;
}

.nav-link {
  font-size: 26rpx;
  color: #f5f5f5;
  transition: color 0.2s;

  &:active {
    color: #ff2e2e;
  }
}

.nav-arrow {
  font-size: 20rpx;
  color: #aeaeb2;
  margin-left: 4rpx;
}

.anno-dot {
  position: absolute;
  top: -8rpx;
  right: -16rpx;
  min-width: 24rpx;
  height: 24rpx;
  padding: 0 6rpx;
  background-color: #ff2e2e;
  color: #fff;
  font-size: 18rpx;
  line-height: 24rpx;
  text-align: center;
  border-radius: 12rpx;
}

.header-actions {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 16rpx;
}

.action-item {
  position: relative;
  width: 56rpx;
  height: 56rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 8rpx;
  transition: background-color 0.2s;

  &:active {
    background-color: rgba(255, 255, 255, 0.06);
  }
}

.action-icon {
  font-size: 32rpx;
  line-height: 1;
}

.cart-badge {
  position: absolute;
  top: 2rpx;
  right: 0;
  min-width: 28rpx;
  height: 28rpx;
  padding: 0 6rpx;
  background-color: #ff2e2e;
  color: #fff;
  font-size: 18rpx;
  line-height: 28rpx;
  text-align: center;
  border-radius: 14rpx;
}

.action-btn {
  padding: 8rpx 24rpx;
  font-size: 24rpx;
  border-radius: 4rpx;
}

.btn-outline {
  border: 1rpx solid #ff2e2e;
  color: #ff2e2e;
  background-color: transparent;

  &:active {
    background-color: rgba(255, 46, 46, 0.1);
  }
}

.user-info {
  display: flex;
  align-items: center;
  gap: 8rpx;
}

.user-avatar {
  width: 56rpx;
  height: 56rpx;
  border-radius: 50%;
  background-color: #ff2e2e;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;

  .avatar-img {
    width: 100%;
    height: 100%;
  }
  .avatar-text {
    color: #fff;
    font-size: 24rpx;
    font-weight: 600;
  }
}

.user-name {
  font-size: 24rpx;
  color: #f5f5f5;
  max-width: 120rpx;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* ============ 弹出面板 ============ */
.popup-panel {
  background-color: #1a1a1a;
  border: 1rpx solid #2a2a2a;
  border-radius: 12rpx;
  overflow: hidden;
  max-height: 600rpx;
  overflow-y: auto;
}

.vehicle-popup {
  min-width: 320rpx;
}

.announcement-popup {
  min-width: 360rpx;
  max-width: 600rpx;
}

.popup-item {
  padding: 20rpx 24rpx;
  border-bottom: 1rpx solid #2a2a2a;

  &:last-child {
    border-bottom: none;
  }
  &:active {
    background-color: rgba(255, 46, 46, 0.08);
  }
}

.popup-item-text {
  font-size: 26rpx;
  color: #f5f5f5;
}

.popup-empty {
  padding: 32rpx 24rpx;
  text-align: center;
  font-size: 24rpx;
  color: #6e6e73;
}

.anno-item {
  padding: 20rpx 24rpx;
  border-bottom: 1rpx solid #2a2a2a;
  display: flex;
  flex-direction: column;
  gap: 6rpx;

  &:active {
    background-color: rgba(255, 46, 46, 0.08);
  }
}

.anno-title {
  font-size: 26rpx;
  color: #f5f5f5;
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.anno-date {
  font-size: 22rpx;
  color: #6e6e73;
}

.all-link {
  text-align: center;
  .popup-item-text {
    color: #ff2e2e;
    font-weight: 600;
    letter-spacing: 1rpx;
  }
}

.popup-mask {
  position: fixed;
  top: 88rpx;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 998;
  background-color: rgba(0, 0, 0, 0.4);
}

/* 亮色主题 */
:global(page.light) .app-header {
  &.scrolled {
    background-color: rgba(255, 255, 255, 0.85);
    border-bottom-color: #e9e9ec;
  }
}
:global(page.light) .logo-text,
:global(page.light) .nav-link,
:global(page.light) .user-name {
  color: #1d1d1f;
}
:global(page.light) .popup-panel {
  background-color: #ffffff;
  border-color: #e9e9ec;
}
:global(page.light) .popup-item {
  border-bottom-color: #e9e9ec;
}
:global(page.light) .popup-item-text,
:global(page.light) .anno-title {
  color: #1d1d1f;
}
:global(page.light) .anno-date,
:global(page.light) .popup-empty {
  color: #8e8e93;
}
</style>
