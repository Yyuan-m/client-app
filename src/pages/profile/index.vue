<script setup lang="ts">
/**
 * 个人中心 - 综合页
 * 原Web: 左侧粘性侧边栏（用户卡片+5项菜单），右侧按 tab 切换
 * 移动端：单列 + 顶部 Tabs（info/orders/reviews/verify/coupons）
 *
 * API: updateProfileApi / updateAvatarApi / uploadImageApi / getMyCouponsApi / getOrderListApi({status:'all',page:1,pageSize:3},{noDedup:true}) / getReviewableOrdersApi
 * 头像上传：uni.chooseImage + updateAvatarApi(filePath) → fetchUserInfo
 * 实名认证：4张图片上传（idCardFront/idCardBack/driverLicenseFront/driverLicenseBack）
 * 出生日期禁未来，驾驶证过期禁过去
 */
import { ref, reactive, computed, watch } from 'vue'
import { onShow, onLoad } from '@dcloudio/uni-app'
import { useUserStore } from '@/stores/user'
import { useAppStore } from '@/stores/app'
import { updateProfileApi, updateAvatarApi, uploadImageApi } from '@/api/modules/user'
import { getMyCouponsApi } from '@/api/modules/coupon'
import { getOrderListApi, getReviewableOrdersApi } from '@/api/modules/order'
import { resolveClientImage, resolveAdminImage } from '@/utils/image'
import { moneyUtil, dateUtil, validators } from '@/utils'
import { getCustomNavTopOffset } from '@/utils/navbar'
import type { MemberInfoVO, MemberCouponVO, OrderVO, PageResult, OrderStatus } from '@/api/types'

type TabKey = 'info' | 'orders' | 'reviews' | 'verify' | 'coupons'
type CouponStatus = 'unused' | 'locked' | 'used' | 'expired'

/** 自定义导航栏：顶部避开微信胶囊按钮 */
const navTop = getCustomNavTopOffset()

const userStore = useUserStore()
const appStore = useAppStore()

const tabs = [
  { key: 'info' as TabKey, label: '个人信息' },
  { key: 'orders' as TabKey, label: '我的订单' },
  { key: 'reviews' as TabKey, label: '去评价' },
  { key: 'verify' as TabKey, label: '实名认证' },
  { key: 'coupons' as TabKey, label: '我的优惠券' }
]

const couponTabs = [
  { key: 'unused' as CouponStatus, label: '未使用' },
  { key: 'locked' as CouponStatus, label: '已锁定' },
  { key: 'used' as CouponStatus, label: '已使用' },
  { key: 'expired' as CouponStatus, label: '已过期' }
]

const currentTab = ref<TabKey>('info')
const currentCouponTab = ref<CouponStatus>('unused')

// 用户信息编辑
const profileForm = reactive<MemberInfoVO>({})
const savingProfile = ref(false)

// 我的订单（imgError 为图片加载失败标记，供模板 v-if/v-else 兜底）
type OrderWithImg = OrderVO & { imgError?: boolean }
const recentOrders = ref<OrderWithImg[]>([])

// 可评价订单
const reviewableOrders = ref<OrderWithImg[]>([])
const reviewCount = computed(() => reviewableOrders.value.length)

// 优惠券分组
const couponsMap = reactive<Record<CouponStatus, MemberCouponVO[]>>({
  unused: [],
  locked: [],
  used: [],
  expired: []
})

// 实名认证表单
const verifyForm = reactive({
  realName: '',
  idCard: '',
  driverLicense: '',
  birthDate: '',
  driverLicenseExpire: '',
  idCardFront: '',
  idCardBack: '',
  driverLicenseFront: '',
  driverLicenseBack: ''
})
const savingVerify = ref(false)

onLoad(() => {
  // 初始化
})

onShow(async () => {
  if (userStore.isLoggedIn) {
    try {
      await userStore.fetchUserInfo()
      await Promise.all([
        loadRecentOrders(),
        loadReviewableOrders(),
        loadCoupons(currentCouponTab.value)
      ])
      // 同步 profileForm
      syncProfileFromUser()
      syncVerifyFromUser()
    } catch (e) {
      console.error('[profile] onShow failed:', e)
    }
  } else {
    // 未登录：跳转登录页
    uni.showModal({
      title: '提示',
      content: '请先登录后访问个人中心',
      showCancel: false,
      confirmText: '去登录',
      success: () => {
        uni.reLaunch({ url: '/pages/auth/login?redirect=' + encodeURIComponent('/pages/profile/index') })
      }
    })
  }
})

function syncProfileFromUser() {
  const u = userStore.user
  if (!u) return
  profileForm.nickname = u.nickname || ''
  profileForm.phone = u.phone || ''
  profileForm.email = u.email || ''
  profileForm.realName = u.realName || ''
}

function syncVerifyFromUser() {
  const u = userStore.user
  if (!u) return
  verifyForm.realName = u.realName || ''
  verifyForm.idCard = u.idCard || ''
  verifyForm.driverLicense = u.driverLicense || ''
  verifyForm.birthDate = u.birthDate || ''
  verifyForm.driverLicenseExpire = u.driverLicenseExpire || ''
  verifyForm.idCardFront = u.idCardFront || ''
  verifyForm.idCardBack = u.idCardBack || ''
  verifyForm.driverLicenseFront = u.driverLicenseFront || ''
  verifyForm.driverLicenseBack = u.driverLicenseBack || ''
}

// 加载最近订单
async function loadRecentOrders() {
  try {
    const res: PageResult<OrderVO> = await getOrderListApi(
      { status: 'all', page: 1, pageSize: 3 },
      { noDedup: true }
    )
    recentOrders.value = res.list || []
  } catch (e) {
    console.error('[profile] loadRecentOrders failed:', e)
  }
}

// 加载可评价订单
async function loadReviewableOrders() {
  try {
    reviewableOrders.value = (await getReviewableOrdersApi()) || []
  } catch (e) {
    console.error('[profile] loadReviewableOrders failed:', e)
  }
}

// 加载优惠券
async function loadCoupons(status: CouponStatus) {
  try {
    const list = await getMyCouponsApi(status)
    couponsMap[status] = list || []
  } catch (e) {
    console.error('[profile] loadCoupons failed:', e)
    couponsMap[status] = []
  }
}

function switchTab(tab: TabKey) {
  currentTab.value = tab
  if (tab === 'coupons') {
    loadCoupons(currentCouponTab.value)
  } else if (tab === 'orders') {
    loadRecentOrders()
  } else if (tab === 'reviews') {
    loadReviewableOrders()
  } else if (tab === 'info') {
    syncProfileFromUser()
  } else if (tab === 'verify') {
    syncVerifyFromUser()
  }
}

function switchCouponTab(tab: CouponStatus) {
  currentCouponTab.value = tab
  loadCoupons(tab)
}

// 头像上传
function chooseAvatar() {
  uni.chooseImage({
    count: 1,
    sizeType: ['compressed'],
    sourceType: ['album', 'camera'],
    success: async (res) => {
      const filePath = res.tempFilePaths[0]
      if (!filePath) return
      uni.showLoading({ title: '上传中...' })
      try {
        await updateAvatarApi(filePath)
        uni.showToast({ title: '头像更新成功', icon: 'success' })
        await userStore.fetchUserInfo()
      } catch (e) {
        console.error('[profile] avatar upload failed:', e)
      } finally {
        uni.hideLoading()
      }
    }
  })
}

// 保存个人信息
async function saveProfile() {
  if (!profileForm.nickname?.trim()) {
    uni.showToast({ title: '请输入昵称', icon: 'none' })
    return
  }
  if (profileForm.phone && !validators.isPhone(profileForm.phone)) {
    uni.showToast({ title: '请输入正确的手机号', icon: 'none' })
    return
  }
  if (profileForm.email && !validators.isEmail(profileForm.email)) {
    uni.showToast({ title: '请输入正确的邮箱', icon: 'none' })
    return
  }
  savingProfile.value = true
  try {
    await updateProfileApi({
      nickname: profileForm.nickname.trim(),
      phone: profileForm.phone?.trim() || undefined,
      email: profileForm.email?.trim() || undefined
    })
    uni.showToast({ title: '保存成功', icon: 'success' })
    await userStore.fetchUserInfo()
  } catch (e) {
    console.error('[profile] saveProfile failed:', e)
  } finally {
    savingProfile.value = false
  }
}

// 实名认证图片上传
function chooseVerifyImage(field: keyof typeof verifyForm) {
  uni.chooseImage({
    count: 1,
    sizeType: ['compressed'],
    sourceType: ['album', 'camera'],
    success: async (res) => {
      const filePath = res.tempFilePaths[0]
      if (!filePath) return
      uni.showLoading({ title: '上传中...' })
      try {
        const result = await uploadImageApi(filePath)
        verifyForm[field] = result.url
        uni.showToast({ title: '上传成功', icon: 'success' })
      } catch (e) {
        console.error('[profile] upload failed:', e)
      } finally {
        uni.hideLoading()
      }
    }
  })
}

// 保存实名认证
async function saveVerify() {
  if (!verifyForm.realName.trim()) {
    uni.showToast({ title: '请输入真实姓名', icon: 'none' })
    return
  }
  if (!validators.isIdCard(verifyForm.idCard)) {
    uni.showToast({ title: '请输入正确的身份证号', icon: 'none' })
    return
  }
  if (!verifyForm.driverLicense.trim()) {
    uni.showToast({ title: '请输入驾驶证号', icon: 'none' })
    return
  }
  if (!verifyForm.idCardFront || !verifyForm.idCardBack || !verifyForm.driverLicenseFront || !verifyForm.driverLicenseBack) {
    uni.showToast({ title: '请上传完整的证件照片', icon: 'none' })
    return
  }
  // 出生日期禁未来
  if (verifyForm.birthDate) {
    if (verifyForm.birthDate > dateUtil.today()) {
      uni.showToast({ title: '出生日期不能晚于今天', icon: 'none' })
      return
    }
  }
  // 驾驶证过期禁过去
  if (verifyForm.driverLicenseExpire) {
    if (verifyForm.driverLicenseExpire < dateUtil.today()) {
      uni.showToast({ title: '驾驶证已过期，请更新有效日期', icon: 'none' })
      return
    }
  }
  savingVerify.value = true
  try {
    await updateProfileApi({
      realName: verifyForm.realName.trim(),
      idCard: verifyForm.idCard.trim(),
      driverLicense: verifyForm.driverLicense.trim(),
      birthDate: verifyForm.birthDate || undefined,
      driverLicenseExpire: verifyForm.driverLicenseExpire || undefined,
      idCardFront: verifyForm.idCardFront,
      idCardBack: verifyForm.idCardBack,
      driverLicenseFront: verifyForm.driverLicenseFront,
      driverLicenseBack: verifyForm.driverLicenseBack
    })
    uni.showToast({ title: '保存成功', icon: 'success' })
    await userStore.fetchUserInfo()
  } catch (e) {
    console.error('[profile] saveVerify failed:', e)
  } finally {
    savingVerify.value = false
  }
}

// 退出登录
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
        console.error('[profile] logout failed:', e)
      }
    }
  })
}

// 跳转
function goOrderList() {
  uni.navigateTo({ url: '/pages/order/list' })
}

function goOrderDetail(order: OrderVO) {
  uni.navigateTo({ url: `/pages/order/detail?id=${order.id}` })
}

function goVehicleList() {
  uni.reLaunch({ url: '/pages/vehicle/list' })
}

function previewImage(url: string) {
  if (!url) return
  appStore.openImagePreview([resolveClientImage(url)], 0)
}

function previewVerifyImage(field: keyof typeof verifyForm) {
  const url = verifyForm[field]
  if (!url) return
  appStore.openImagePreview([resolveClientImage(url)], 0)
}

// 优惠券展示
function couponFaceValue(c: MemberCouponVO): string {
  const type = c.couponType || c.type
  const v = Number(c.couponValue ?? c.value ?? 0)
  if (type === 'discount') {
    const t = v * 10
    return `${Number.isInteger(t) ? t : t.toFixed(1)}折`
  }
  if (type === 'deduction' || type === 'reduction') return `减￥${moneyUtil.format(v)}`
  if (type === 'duration') return `免${v || 1}天`
  return '优惠'
}

function formatPrice(p: number | null | undefined): string {
  return moneyUtil.format(Number(p || 0))
}

function statusText(status: OrderStatus): string {
  if (status === 'pending') return '待支付'
  if (status === 'renting') return '租赁中'
  if (status === 'completed') return '已完成'
  if (status === 'cancelled') return '已取消'
  return status
}

function statusClass(status: OrderStatus): string {
  if (status === 'pending') return 'status-pending'
  if (status === 'renting') return 'status-renting'
  if (status === 'completed') return 'status-completed'
  if (status === 'cancelled') return 'status-cancelled'
  return ''
}

function reviewStatusText(s?: string): string {
  if (s === 'unreviewed') return '待评价'
  if (s === 'reviewed') return '可追评'
  return '—'
}

function verifyStatusText(s?: string): string {
  if (s === 'unverified') return '未认证'
  if (s === 'pending') return '审核中'
  if (s === 'verified') return '已认证'
  if (s === 'rejected') return '已驳回'
  return '未认证'
}

function verifyStatusClass(s?: string): string {
  if (s === 'verified') return 'verify-verified'
  if (s === 'pending') return 'verify-pending'
  if (s === 'rejected') return 'verify-rejected'
  return 'verify-unverified'
}

const todayStr = dateUtil.today()

// 图片加载失败兜底：避免裂图，明确失败态（与 list.vue / home 一致的 @error 策略）
const avatarLoadFailed = ref(false)
function onAvatarError(): void {
  avatarLoadFailed.value = true
}
function onOrderImgError(order: OrderWithImg): void {
  order.imgError = true
}

// 监听 user 变化时同步
watch(
  () => userStore.user,
  () => {
    syncProfileFromUser()
    syncVerifyFromUser()
  }
)
</script>

<template>
  <view class="profile-page" :style="{ paddingTop: navTop + 'px' }">
    <!-- 用户卡片 -->
    <view class="user-card">
      <view class="avatar-wrap" @tap="chooseAvatar">
          <image
            v-if="userStore.user?.avatar && !avatarLoadFailed"
            :src="resolveClientImage(userStore.user.avatar)"
            mode="aspectFill"
            class="avatar"
            @error="onAvatarError"
          />
        <view v-else class="avatar avatar-default">
          <text class="avatar-text">{{ (userStore.user?.nickname || 'U').charAt(0).toUpperCase() }}</text>
        </view>
        <view class="avatar-edit">编辑</view>
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
      <view class="logout-btn" @tap="onLogout">退出</view>
    </view>

    <!-- Tabs -->
    <view class="tabs-bar">
      <scroll-view scroll-x :show-scrollbar="false">
        <view class="tabs-row">
          <view
            v-for="tab in tabs"
            :key="tab.key"
            class="tab-item"
            :class="{ active: currentTab === tab.key, badge: tab.key === 'reviews' && reviewCount > 0 }"
            @tap="switchTab(tab.key)"
          >
            {{ tab.label }}
            <text v-if="tab.key === 'reviews' && reviewCount > 0" class="tab-badge">{{ reviewCount }}</text>
          </view>
        </view>
      </scroll-view>
    </view>

    <!-- Tab 内容 -->
    <view class="tab-content">
      <!-- 1. 个人信息 -->
      <view v-if="currentTab === 'info'" class="info-pane">
        <view class="card form-card">
          <view class="form-item">
            <view class="form-label">昵称</view>
            <u-input v-model="profileForm.nickname" placeholder="请输入昵称" border="surround" maxlength="20" />
          </view>
          <view class="form-item">
            <view class="form-label">手机号</view>
            <u-input v-model="profileForm.phone" type="number" placeholder="请输入手机号" border="surround" maxlength="11" />
          </view>
          <view class="form-item">
            <view class="form-label">邮箱</view>
            <u-input v-model="profileForm.email" placeholder="请输入邮箱" border="surround" maxlength="50" />
          </view>
          <u-button type="primary" size="large" shape="square" text="保存" :loading="savingProfile" @click="saveProfile" />
        </view>
      </view>

      <!-- 2. 我的订单 -->
      <view v-else-if="currentTab === 'orders'" class="orders-pane">
        <view v-if="recentOrders.length" class="orders-list">
          <view v-for="order in recentOrders" :key="order.id" class="order-card" @tap="goOrderDetail(order)">
            <view class="card-header">
              <view class="order-status" :class="statusClass(order.status)">{{ statusText(order.status) }}</view>
              <view class="order-time">{{ dateUtil.format(order.createTime, 'YYYY-MM-DD') }}</view>
            </view>
            <view class="order-body">
              <image v-if="!order.imgError" :src="resolveAdminImage(order.carCover || '')" mode="aspectFill" class="car-img" lazy-load @error="onOrderImgError(order)" />
              <view v-else class="car-img"></view>
              <view class="order-info">
                <view class="car-name">{{ order.carName }}</view>
                <view class="rent-period">{{ order.startDate }} 至 {{ order.endDate }}</view>
                <view class="order-amount">￥{{ formatPrice(order.totalAmount) }}</view>
              </view>
            </view>
          </view>
          <view class="view-all-btn" @tap="goOrderList">查看全部订单 ›</view>
        </view>
        <view v-else class="empty-state">
          <view class="empty-icon">📋</view>
          <view class="empty-text">暂无订单</view>
        </view>
      </view>

      <!-- 3. 去评价 -->
      <view v-else-if="currentTab === 'reviews'" class="reviews-pane">
        <view v-if="reviewableOrders.length" class="reviews-list">
          <view v-for="order in reviewableOrders" :key="order.id" class="review-card" @tap="goOrderDetail(order)">
            <view class="review-status">{{ reviewStatusText(order.reviewStatus) }}</view>
            <view class="review-body">
              <image v-if="!order.imgError" :src="resolveAdminImage(order.carCover || '')" mode="aspectFill" class="car-img" lazy-load @error="onOrderImgError(order)" />
              <view v-else class="car-img"></view>
              <view class="review-info">
                <view class="car-name">{{ order.carName }}</view>
                <view class="rent-period">{{ order.startDate }} 至 {{ order.endDate }}</view>
                <view class="review-action">{{ order.reviewStatus === 'unreviewed' ? '去评价' : '去追评' }} ›</view>
              </view>
            </view>
          </view>
        </view>
        <view v-else class="empty-state">
          <view class="empty-icon">⭐</view>
          <view class="empty-text">暂无可评价订单</view>
        </view>
      </view>

      <!-- 4. 实名认证 -->
      <view v-else-if="currentTab === 'verify'" class="verify-pane">
        <view class="card verify-form">
          <view class="form-item">
            <view class="form-label">真实姓名 <text class="required">*</text></view>
            <u-input v-model="verifyForm.realName" placeholder="请输入真实姓名" border="surround" maxlength="20" />
          </view>
          <view class="form-item">
            <view class="form-label">身份证号 <text class="required">*</text></view>
            <u-input v-model="verifyForm.idCard" placeholder="请输入身份证号" border="surround" maxlength="18" />
          </view>
          <view class="form-item">
            <view class="form-label">出生日期</view>
            <picker mode="date" :value="verifyForm.birthDate" :end="todayStr" @change="(e: any) => verifyForm.birthDate = e.detail.value">
              <view class="picker-value" :class="{ placeholder: !verifyForm.birthDate }">
                {{ verifyForm.birthDate || '请选择出生日期' }}
              </view>
            </picker>
          </view>
          <view class="form-item">
            <view class="form-label">驾驶证号 <text class="required">*</text></view>
            <u-input v-model="verifyForm.driverLicense" placeholder="请输入驾驶证号" border="surround" maxlength="20" />
          </view>
          <view class="form-item">
            <view class="form-label">驾驶证过期日</view>
            <picker mode="date" :value="verifyForm.driverLicenseExpire" :start="todayStr" @change="(e: any) => verifyForm.driverLicenseExpire = e.detail.value">
              <view class="picker-value" :class="{ placeholder: !verifyForm.driverLicenseExpire }">
                {{ verifyForm.driverLicenseExpire || '请选择过期日期' }}
              </view>
            </picker>
          </view>

          <!-- 4 张证件图片 -->
          <view class="image-grid">
            <view class="img-item">
              <view class="img-label">身份证正面 *</view>
              <view class="img-box" @tap="verifyForm.idCardFront ? previewVerifyImage('idCardFront') : chooseVerifyImage('idCardFront')">
                <image v-if="verifyForm.idCardFront" :src="resolveClientImage(verifyForm.idCardFront)" mode="aspectFill" class="img-preview" />
                <text v-else class="img-placeholder">+上传</text>
              </view>
              <view v-if="verifyForm.idCardFront" class="img-action" @tap="chooseVerifyImage('idCardFront')">更换</view>
            </view>
            <view class="img-item">
              <view class="img-label">身份证反面 *</view>
              <view class="img-box" @tap="verifyForm.idCardBack ? previewVerifyImage('idCardBack') : chooseVerifyImage('idCardBack')">
                <image v-if="verifyForm.idCardBack" :src="resolveClientImage(verifyForm.idCardBack)" mode="aspectFill" class="img-preview" />
                <text v-else class="img-placeholder">+上传</text>
              </view>
              <view v-if="verifyForm.idCardBack" class="img-action" @tap="chooseVerifyImage('idCardBack')">更换</view>
            </view>
            <view class="img-item">
              <view class="img-label">驾驶证正面 *</view>
              <view class="img-box" @tap="verifyForm.driverLicenseFront ? previewVerifyImage('driverLicenseFront') : chooseVerifyImage('driverLicenseFront')">
                <image v-if="verifyForm.driverLicenseFront" :src="resolveClientImage(verifyForm.driverLicenseFront)" mode="aspectFill" class="img-preview" />
                <text v-else class="img-placeholder">+上传</text>
              </view>
              <view v-if="verifyForm.driverLicenseFront" class="img-action" @tap="chooseVerifyImage('driverLicenseFront')">更换</view>
            </view>
            <view class="img-item">
              <view class="img-label">驾驶证反面 *</view>
              <view class="img-box" @tap="verifyForm.driverLicenseBack ? previewVerifyImage('driverLicenseBack') : chooseVerifyImage('driverLicenseBack')">
                <image v-if="verifyForm.driverLicenseBack" :src="resolveClientImage(verifyForm.driverLicenseBack)" mode="aspectFill" class="img-preview" />
                <text v-else class="img-placeholder">+上传</text>
              </view>
              <view v-if="verifyForm.driverLicenseBack" class="img-action" @tap="chooseVerifyImage('driverLicenseBack')">更换</view>
            </view>
          </view>

          <u-button type="primary" shape="square" text="提交认证" :loading="savingVerify" @click="saveVerify" />
        </view>
      </view>

      <!-- 5. 我的优惠券 -->
      <view v-else-if="currentTab === 'coupons'" class="coupons-pane">
        <view class="coupon-tabs">
          <view
            v-for="ct in couponTabs"
            :key="ct.key"
            class="coupon-tab"
            :class="{ active: currentCouponTab === ct.key }"
            @tap="switchCouponTab(ct.key)"
          >
            {{ ct.label }}
          </view>
        </view>
        <view v-if="couponsMap[currentCouponTab].length" class="coupon-list">
          <view v-for="c in couponsMap[currentCouponTab]" :key="c.id" class="coupon-card">
            <view class="coupon-face">
              <view class="coupon-value">{{ couponFaceValue(c) }}</view>
              <view class="coupon-name">{{ (c as any).couponName || '优惠券' }}</view>
            </view>
            <view class="coupon-info">
              <view v-if="c.minAmount" class="coupon-rule">满￥{{ formatPrice(c.minAmount) }}可用</view>
              <view v-else class="coupon-rule">无门槛</view>
              <view v-if="c.validEndTime || c.expireTime" class="coupon-valid">
                有效期至：{{ dateUtil.format(c.validEndTime || c.expireTime, 'YYYY-MM-DD') }}
              </view>
              <view v-if="currentCouponTab === 'unused'" class="coupon-use-btn" @tap="goVehicleList">去使用</view>
            </view>
          </view>
        </view>
        <view v-else class="empty-state">
          <view class="empty-icon">🎫</view>
          <view class="empty-text">暂无优惠券</view>
        </view>
      </view>
    </view>

    <!-- 底部 TabBar 占位 -->
    <view class="tabbar-placeholder"></view>
    <TabBar active="pages/profile/index" />
  </view>
</template>

<style scoped lang="scss">
.profile-page {
  box-sizing: border-box;
  min-height: 100vh;
  background-color: #0a0a0a;
  padding-bottom: calc(100rpx + env(safe-area-inset-bottom));
}

/* 用户卡片 */
.user-card {
  display: flex;
  align-items: center;
  padding: 32rpx 24rpx;
  background: linear-gradient(135deg, rgba(255, 46, 46, 0.08) 0%, rgba(26, 26, 26, 0.8) 100%);
  border-bottom: 1rpx solid #2a2a2a;
}

.avatar-wrap {
  position: relative;
  width: 120rpx;
  height: 120rpx;
  margin-right: 24rpx;
  flex-shrink: 0;
}

.avatar {
  width: 100%;
  height: 100%;
  border-radius: 50%;
  border: 2rpx solid #ff2e2e;
  background-color: #2a2a2a;
}

.avatar-default {
  display: flex;
  align-items: center;
  justify-content: center;
}

.avatar-text {
  font-size: 48rpx;
  color: #ff2e2e;
  font-weight: 700;
}

.avatar-edit {
  position: absolute;
  bottom: -4rpx;
  right: -8rpx;
  padding: 2rpx 12rpx;
  background-color: #ff2e2e;
  color: #fff;
  font-size: 18rpx;
  border-radius: 12rpx;
}

.user-info {
  flex: 1;
  min-width: 0;
}

.user-name {
  font-size: 36rpx;
  font-weight: 700;
  color: #f5f5f5;
  margin-bottom: 8rpx;
}

.user-meta {
  display: flex;
  gap: 16rpx;
  align-items: center;
}

.verify-tag {
  font-size: 22rpx;
  padding: 2rpx 8rpx;
  border-radius: 4rpx;
}

.verify-unverified { background-color: rgba(174, 174, 178, 0.18); color: #aeaeb2; }
.verify-pending { background-color: rgba(255, 153, 0, 0.18); color: #ff9900; }
.verify-verified { background-color: rgba(7, 193, 96, 0.18); color: #07c160; }
.verify-rejected { background-color: rgba(255, 46, 46, 0.18); color: #ff2e2e; }

.user-phone {
  font-size: 24rpx;
  color: #aeaeb2;
}

.logout-btn {
  flex-shrink: 0;
  padding: 12rpx 24rpx;
  background-color: rgba(255, 46, 46, 0.12);
  color: #ff2e2e;
  font-size: 24rpx;
  border-radius: 8rpx;
  border: 1rpx solid #ff2e2e;
}

/* Tabs */
.tabs-bar {
  position: sticky;
  top: 0;
  z-index: 10;
  background-color: #0a0a0a;
  border-bottom: 1rpx solid #2a2a2a;
}

.tabs-row {
  display: inline-flex;
  padding: 16rpx 24rpx;
  gap: 16rpx;
}

.tab-item {
  position: relative;
  flex-shrink: 0;
  padding: 12rpx 24rpx;
  font-size: 26rpx;
  color: #aeaeb2;
  background-color: #1a1a1a;
  border-radius: 8rpx;
  border: 1rpx solid #2a2a2a;

  &.active {
    background-color: #ff2e2e;
    color: #fff;
    border-color: #ff2e2e;
  }
}

.tab-badge {
  display: inline-block;
  min-width: 32rpx;
  height: 32rpx;
  padding: 0 8rpx;
  margin-left: 8rpx;
  background-color: #ff2e2e;
  color: #fff;
  font-size: 20rpx;
  line-height: 32rpx;
  text-align: center;
  border-radius: 16rpx;

  .tab-item.active & {
    background-color: #fff;
    color: #ff2e2e;
  }
}

/* Tab 内容 */
.tab-content {
  padding: 24rpx;
}

/* 个人信息表单 */
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
  color: #f5f5f5;
  font-weight: 500;
}

.required {
  color: #ff2e2e;
  margin-left: 4rpx;
}

.picker-value {
  height: 80rpx;
  line-height: 80rpx;
  padding: 0 24rpx;
  background-color: #2a2a2a;
  border-radius: 8rpx;
  font-size: 28rpx;
  color: #f5f5f5;

  &.placeholder {
    color: #6e6e73;
  }
}

/* 订单卡片 */
.order-card,
.review-card {
  background-color: #1a1a1a;
  border-radius: 16rpx;
  padding: 24rpx;
  margin-bottom: 16rpx;
  border: 1rpx solid #2a2a2a;
}

.card-header,
.review-status {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-bottom: 16rpx;
  margin-bottom: 16rpx;
  border-bottom: 1rpx solid #2a2a2a;
}

.order-status {
  font-size: 24rpx;
  font-weight: 500;
  padding: 4rpx 12rpx;
  border-radius: 4rpx;
}

.status-pending { background-color: rgba(255, 153, 0, 0.18); color: #ff9900; }
.status-renting { background-color: rgba(255, 46, 46, 0.18); color: #ff2e2e; }
.status-completed { background-color: rgba(7, 193, 96, 0.18); color: #07c160; }
.status-cancelled { background-color: rgba(174, 174, 178, 0.18); color: #aeaeb2; }

.order-time,
.review-status {
  font-size: 22rpx;
  color: #6e6e73;
}

.order-body,
.review-body {
  display: flex;
  gap: 16rpx;
}

.car-img {
  width: 160rpx;
  height: 120rpx;
  border-radius: 8rpx;
  flex-shrink: 0;
  background-color: #2a2a2a;
}

.order-info,
.review-info {
  flex: 1;
  min-width: 0;
}

.car-name {
  font-size: 28rpx;
  font-weight: 500;
  color: #f5f5f5;
  margin-bottom: 8rpx;
}

.rent-period {
  font-size: 22rpx;
  color: #aeaeb2;
  margin-bottom: 8rpx;
}

.order-amount {
  font-size: 28rpx;
  color: #ff5a3c;
  font-weight: 600;
}

.review-action {
  font-size: 24rpx;
  color: #ff2e2e;
}

.view-all-btn {
  text-align: center;
  padding: 24rpx;
  font-size: 26rpx;
  color: #ff2e2e;
}

/* 实名认证图片 */
.image-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 24rpx;
  margin: 24rpx 0;
}

.img-item {
  display: flex;
  flex-direction: column;
  gap: 8rpx;
}

.img-label {
  font-size: 24rpx;
  color: #d1d1d6;
}

.img-box {
  width: 100%;
  height: 200rpx;
  background-color: #2a2a2a;
  border: 2rpx dashed #4a4a4a;
  border-radius: 8rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.img-preview {
  width: 100%;
  height: 100%;
}

.img-placeholder {
  font-size: 36rpx;
  color: #6e6e73;
}

.img-action {
  font-size: 22rpx;
  color: #ff2e2e;
  text-align: center;
}

/* 优惠券 */
.coupon-tabs {
  display: flex;
  gap: 8rpx;
  margin-bottom: 24rpx;
  overflow-x: auto;
}

.coupon-tab {
  flex-shrink: 0;
  padding: 12rpx 24rpx;
  font-size: 26rpx;
  color: #aeaeb2;
  background-color: #1a1a1a;
  border-radius: 8rpx;
  border: 1rpx solid #2a2a2a;

  &.active {
    background-color: #ff2e2e;
    color: #fff;
    border-color: #ff2e2e;
  }
}

.coupon-list {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
}

.coupon-card {
  display: flex;
  padding: 24rpx;
  background: linear-gradient(135deg, rgba(255, 46, 46, 0.12) 0%, rgba(26, 26, 26, 0.9) 100%);
  border-radius: 12rpx;
  border: 1rpx solid #ff2e2e;
}

.coupon-face {
  flex-shrink: 0;
  width: 180rpx;
  text-align: center;
  border-right: 1rpx dashed #4a4a4a;
  padding-right: 24rpx;
}

.coupon-value {
  font-size: 40rpx;
  font-weight: 800;
  color: #ff5a3c;
  line-height: 1.2;
}

.coupon-name {
  font-size: 20rpx;
  color: #aeaeb2;
  margin-top: 4rpx;
}

.coupon-info {
  flex: 1;
  padding-left: 24rpx;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 4rpx;
}

.coupon-rule {
  font-size: 24rpx;
  color: #f5f5f5;
}

.coupon-valid {
  font-size: 20rpx;
  color: #6e6e73;
}

.coupon-use-btn {
  align-self: flex-start;
  margin-top: 8rpx;
  padding: 6rpx 16rpx;
  background-color: #ff2e2e;
  color: #fff;
  font-size: 22rpx;
  border-radius: 4rpx;
}

/* 空状态 */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 96rpx 0;
  gap: 16rpx;
}

.empty-icon {
  font-size: 96rpx;
}

.empty-text {
  font-size: 28rpx;
  color: #6e6e73;
}

.tabbar-placeholder {
  height: 100rpx;
}
</style>
