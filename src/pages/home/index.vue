<script setup lang="ts">
/**
 * 首页 - 综合性营销门户
 * 原Web 8大模块：全屏轮播Hero / 我的订单 / 品牌简介 / 热门车型 / 服务优势 / 客户评价 / 活动优惠券 / 预约咨询表单
 *
 * 自定义导航：pages.json 已配置 navigationStyle:custom
 * 沉浸式：swiper 高度 100vh，覆盖到顶部状态栏
 */
import { ref, reactive, computed, watch } from 'vue'
import { onLoad, onShow, onPageScroll } from '@dcloudio/uni-app'
import { useAppStore } from '@/stores/app'
import { useUserStore } from '@/stores/user'
import { useCartStore } from '@/stores/cart'
import { useThemeClass } from '@/composables/useThemeClass'
import { useSystemConfig } from '@/composables/useSystemConfig'
import { getActiveCarouselApi } from '@/api/modules/carousel'
import { getHotCarsApi } from '@/api/modules/car'
import { getAdvantagesApi, getReviewsApi, getDictByTypeApi } from '@/api/modules/system'
import { getAvailableCouponsApi, getClaimedCouponIdsApi, claimCouponApi } from '@/api/modules/coupon'
import { getMyActiveOrdersApi } from '@/api/modules/order'
import { submitFeedbackApi } from '@/api/modules/feedback'
import { resolveAdminImage, resolveClientImage, placeholderImage } from '@/utils/image'
import { moneyUtil, validators, dateUtil } from '@/utils'
import type { CarouselVO, CarVO, AdvantageVO, CustomerReviewVO, CouponVO, OrderVO, DictDataVO } from '@/api/types'

const appStore = useAppStore()
const userStore = useUserStore()
const cartStore = useCartStore()
const { config, loadConfig } = useSystemConfig()
const { themeClass } = useThemeClass()

// 数据
const carouselList = ref<CarouselVO[]>([])
const hotCars = ref<CarVO[]>([])
const advantages = ref<AdvantageVO[]>([])
const reviews = ref<CustomerReviewVO[]>([])
const coupons = ref<CouponVO[]>([])
const myActiveOrders = ref<OrderVO[]>([])
const claimedCouponIds = ref<number[]>([])
const vehicleTypes = ref<DictDataVO[]>([])

const loading = ref(true)
const scrollTop = ref(0)
const statusBarHeight = ref(0)
// 首页右上角头像是否加载失败（失败时回退为 icon）
const headerAvatarFailed = ref(false)
function onHeaderAvatarError(): void {
  headerAvatarFailed.value = true
}

// 微信小程序右上角胶囊按钮位置（自定义导航右侧按钮需避让）
const capsuleRect = ref<{ top: number; right: number; bottom: number; left: number; width: number; height: number } | null>(null)
const windowWidth = ref(375)

// 轮播索引
const currentCarousel = ref(0)

// 预约表单
const appointmentForm = reactive({
  name: '',
  phone: '',
  carType: '',
  rentDate: '',
  content: ''
})
const submittingAppointment = ref(false)

// 优惠券领取中
const claimingCouponId = ref<number | null>(null)

// 评价展开
const expandedReviewIds = ref<number[]>([])

onLoad(async () => {
  // 获取状态栏高度（沉浸式）
  try {
    const sysInfo = uni.getSystemInfoSync()
    statusBarHeight.value = sysInfo.statusBarHeight || 0
    windowWidth.value = sysInfo.windowWidth || windowWidth.value
    // #ifdef MP-WEIXIN
    // 微信小程序：读取右上角胶囊按钮位置，自定义导航右侧按钮需要避让，避免被官方胶囊遮挡
    try {
      const menu = (uni as any).getMenuButtonBoundingClientRect?.()
      if (menu && menu.width && menu.height) {
        capsuleRect.value = menu
      }
    } catch (e) {
      console.error('[home] getMenuButtonBoundingClientRect failed:', e)
    }
    // #endif
  } catch (e) {
    console.error('[home] getSystemInfo failed:', e)
  }

  await loadAll()
})

onShow(async () => {
  // 状态栏颜色随主题/滚动态恢复
  applyStatusBarColor()
  // 刷新购物车数量（右上角购物车角标）
  if (userStore.isLoggedIn) {
    cartStore.initCart().catch((e) => console.error('[home] initCart failed:', e))
    // 拉取最新用户信息，确保右上角头像显示最新
    try {
      await userStore.fetchUserInfo()
      headerAvatarFailed.value = false
    } catch (e) {
      console.error('[home] fetchUserInfo failed:', e)
    }
  }
  // 登录态变化时重新加载我的订单和已领券
  if (userStore.isLoggedIn) {
    await Promise.all([loadMyActiveOrders(), loadClaimedCouponIds()])
  }
})

onPageScroll((e: any) => {
  scrollTop.value = e.scrollTop || 0
})

async function loadAll() {
  loading.value = true
  try {
    const promises: Promise<any>[] = [
      getActiveCarouselApi().then((r) => (carouselList.value = r || [])),
      getHotCarsApi().then((r) => (hotCars.value = (r || []).filter((c) => c.status === 'available'))),
      getAdvantagesApi().then((r) => (advantages.value = r || [])),
      getReviewsApi().then((r) => (reviews.value = (r || []).map(decorateReviewRow) as any[])),
      getAvailableCouponsApi().then((r) => (coupons.value = r || [])),
      loadConfig().catch((e) => console.error('[home] loadConfig failed:', e)),
      getDictByTypeApi('vehicle_type').then((r) => (vehicleTypes.value = r || []))
    ]
    if (userStore.isLoggedIn) {
      promises.push(
        getMyActiveOrdersApi(6)
          .then((r) => (myActiveOrders.value = r || []))
          .catch((e) => console.error('[home] loadActiveOrders failed:', e))
      )
      promises.push(
        getClaimedCouponIdsApi()
          .then((r) => (claimedCouponIds.value = r || []))
          .catch((e) => console.error('[home] loadClaimedIds failed:', e))
      )
    }
    await Promise.all(promises)
  } catch (e) {
    console.error('[home] loadAll failed:', e)
  } finally {
    loading.value = false
  }
}

async function loadMyActiveOrders() {
  try {
    myActiveOrders.value = (await getMyActiveOrdersApi(6)) || []
  } catch (e) {
    console.error('[home] loadMyActiveOrders failed:', e)
  }
}

async function loadClaimedCouponIds() {
  try {
    claimedCouponIds.value = (await getClaimedCouponIdsApi()) || []
  } catch (e) {
    console.error('[home] loadClaimedCouponIds failed:', e)
  }
}

function onCarouselChange(e: any) {
  currentCarousel.value = e.detail.current
}

function goVehicleList(type?: string) {
  const url = type ? `/pages/vehicle/list?type=${encodeURIComponent(type)}` : '/pages/vehicle/list'
  uni.navigateTo({ url })
}

function goVehicleDetail(car: CarVO) {
  uni.navigateTo({ url: `/pages/vehicle/detail?id=${car.id}` })
}

function goCart() {
  uni.switchTab?.({ url: '/pages/cart/index' } as any) || uni.reLaunch({ url: '/pages/cart/index' })
}

function goProfile() {
  uni.reLaunch({ url: '/pages/profile/index' })
}

function goOrderList() {
  uni.navigateTo({ url: '/pages/order/list' })
}

function goOrderDetail(order: OrderVO) {
  uni.navigateTo({ url: `/pages/order/detail?id=${order.id}` })
}

function goLogin() {
  uni.navigateTo({ url: '/pages/auth/login' })
}

// 优惠券领取
async function onClaimCoupon(coupon: CouponVO) {
  if (!userStore.isLoggedIn) {
    uni.showToast({ title: '请先登录', icon: 'none' })
    setTimeout(() => goLogin(), 800)
    return
  }
  if (claimingCouponId.value !== null) return
  if (claimedCouponIds.value.includes(coupon.id)) {
    uni.showToast({ title: '已领取过', icon: 'none' })
    return
  }
  claimingCouponId.value = coupon.id
  try {
    await claimCouponApi(coupon.id)
    uni.showToast({ title: '领取成功', icon: 'success' })
    claimedCouponIds.value.push(coupon.id)
    // 本地更新库存
    if (coupon.receivedCount != null) coupon.receivedCount += 1
    if (coupon.remainCount != null && coupon.remainCount > 0) coupon.remainCount -= 1
  } catch (e) {
    console.error('[home] claimCoupon failed:', e)
  } finally {
    claimingCouponId.value = null
  }
}

// 评价图片解析
function parseReviewImages(imagesStr?: string): string[] {
  if (!imagesStr) return []
  let arr: any[] = []
  // 兼容 JSON 数组字符串
  try {
    const parsed = JSON.parse(imagesStr)
    if (Array.isArray(parsed)) arr = parsed
    else arr = [parsed]
  } catch {
    // 逗号分隔
    arr = imagesStr.split(',').map((s) => s.trim()).filter(Boolean)
  }
  return arr.map((i) => resolveClientImage(String(i)))
}

function previewReviewImages(imagesStr?: string, idx: number = 0) {
  const list = parseReviewImages(imagesStr)
  if (!list.length) return
  appStore.openImagePreview(list, idx)
}

// 评价行数据装饰器：把后端字段（name/avatar）映射为前端期望的字段 + 预算头像URL
// 后端 review 实体的字段是 name/avatar（冗余字段），前端原本写 memberName/memberAvatar 是错的
function decorateReviewRow(row: any): any {
  const avatar = (row as any).avatar
  return {
    ...row,
    name: (row as any).name,
    avatarUrl: avatar ? resolveClientImage(avatar) : ''
  }
}

// 评价头像加载失败：直接使用占位图（客户端头像已带 yyyyMM 子目录，无需重试拼接）
function onReviewImgError(rv: any, _event: any) {
  if (!(rv as any).avatar) return
  rv.avatarUrl = placeholderImage(120, 120, '头像')
}

// 评价展开/收起
function toggleReviewExpand(id: number) {
  const idx = expandedReviewIds.value.indexOf(id)
  if (idx >= 0) expandedReviewIds.value.splice(idx, 1)
  else expandedReviewIds.value.push(id)
}

function isReviewExpanded(id: number): boolean {
  return expandedReviewIds.value.includes(id)
}

// 预约表单提交
async function submitAppointment() {
  if (!appointmentForm.name.trim()) {
    uni.showToast({ title: '请输入姓名', icon: 'none' })
    return
  }
  if (!validators.isPhone(appointmentForm.phone)) {
    uni.showToast({ title: '请输入正确的手机号', icon: 'none' })
    return
  }
  submittingAppointment.value = true
  try {
    await submitFeedbackApi({
      type: 'appointment',
      name: appointmentForm.name.trim(),
      phone: appointmentForm.phone.trim(),
      carType: appointmentForm.carType.trim() || undefined,
      rentDate: appointmentForm.rentDate || undefined,
      content: appointmentForm.content.trim() || undefined
    })
    uni.showToast({
      title: userStore.isLoggedIn ? '预约成功，可在我的预约查看进度' : '预约成功，客服将尽快联系您',
      icon: 'none'
    })
    appointmentForm.name = ''
    appointmentForm.phone = ''
    appointmentForm.carType = ''
    appointmentForm.rentDate = ''
    appointmentForm.content = ''
  } catch (e) {
    console.error('[home] submitAppointment failed:', e)
  } finally {
    submittingAppointment.value = false
  }
}

function onRentDateChange(e: any) {
  appointmentForm.rentDate = e.detail.value
}

// 状态计算
const showHeaderBg = computed(() => scrollTop.value > 80)

/** 状态栏文字颜色：未滚动时顶部是深色 Hero 图（白字）；滚动后头部 solid，浅色主题下需切黑字 */
function applyStatusBarColor() {
  try {
    uni.setNavigationBarColor({
      frontColor: showHeaderBg.value && !appStore.isDark ? '#000000' : '#ffffff',
      backgroundColor: appStore.isDark ? '#0A0A0A' : '#F5F5F7'
    })
  } catch (e) {
    // 自定义导航页部分平台不支持
  }
}
watch([() => appStore.isDark, showHeaderBg], applyStatusBarColor)

// 自定义导航内容高度：小程序端与胶囊按钮垂直范围对齐（胶囊底部 - 状态栏 + 余量），其他端保持 CSS 默认
const navContentHeight = computed(() => {
  if (!capsuleRect.value) return 0
  return capsuleRect.value.bottom - statusBarHeight.value + 6
})

// 右侧操作按钮避让胶囊：占位宽度 = 胶囊左侧到屏幕右缘的距离 + 间隔
const actionsAvoidWidth = computed(() => {
  if (!capsuleRect.value) return 0
  return windowWidth.value - capsuleRect.value.left + 12
})

function statusText(status: string): string {
  if (status === 'pending') return '待支付'
  if (status === 'renting') return '租赁中'
  if (status === 'completed') return '已完成'
  if (status === 'cancelled') return '已取消'
  return status
}

function statusClass(status: string): string {
  if (status === 'pending') return 'status-pending'
  if (status === 'renting') return 'status-renting'
  if (status === 'completed') return 'status-completed'
  if (status === 'cancelled') return 'status-cancelled'
  return ''
}

function formatPrice(p: number | string): string {
  return moneyUtil.format(Number(p || 0))
}

function couponFaceValue(c: CouponVO): string {
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

/** 根据面值文案长度返回字号自适应类名，避免「减￥1,111.00」撑爆卡片 */
function couponValueClass(c: CouponVO): string {
  const len = couponFaceValue(c).length
  if (len >= 9) return 'coupon-value-xs'
  if (len >= 6) return 'coupon-value-sm'
  return ''
}

/** 服务优势图标：后端返回的是 Element Plus 图标名，小程序端用 emoji 兜底 */
function advantageIcon(icon?: string): string {
  const map: Record<string, string> = {
    CircleCheck: '✅',
    Check: '✅',
    Timer: '⏱',
    Medal: '🏅',
    Service: '🎧',
    Headset: '🎧',
    Phone: '📞',
    Van: '🚙',
    Car: '🚗',
    Star: '⭐',
    Lock: '🔒',
    Shield: '🛡'
  }
  return map[icon || ''] || '★'
}

function isCouponClaimed(c: CouponVO): boolean {
  return claimedCouponIds.value.includes(c.id)
}

function isCouponSoldOut(c: CouponVO): boolean {
  if (c.remainCount != null && c.remainCount <= 0) return true
  return false
}

function todayPlus(days: number): string {
  return dateUtil.addDays(dateUtil.today(), days)
}
</script>

<template>
  <view class="home-page" :class="themeClass">
    <!-- 自定义顶部导航（沉浸式：随滚动渐变背景） -->
    <view class="custom-header" :class="{ solid: showHeaderBg }" :style="{ paddingTop: statusBarHeight + 'px' }">
      <view
        class="header-content"
        :style="{
          height: navContentHeight ? navContentHeight + 'px' : '',
          paddingRight: actionsAvoidWidth ? actionsAvoidWidth + 'px' : ''
        }"
      >
        <text class="header-title">LUXURY CAR</text>
        <view class="header-actions">
          <view class="header-icon" @tap="goCart">
            <text class="header-icon-symbol">🛒</text>
            <view v-if="cartStore.totalCount > 0" class="header-cart-badge">{{ cartStore.totalCount > 99 ? '99+' : cartStore.totalCount }}</view>
          </view>
          <view class="header-avatar-btn" @tap="userStore.isLoggedIn ? goProfile() : goLogin()">
            <image
              v-if="userStore.isLoggedIn && userStore.user?.avatar && !headerAvatarFailed"
              :src="resolveClientImage(userStore.user.avatar)"
              mode="aspectFill"
              class="header-avatar-img"
              @error="onHeaderAvatarError"
            />
            <text v-else class="header-icon-symbol">👤</text>
          </view>
        </view>
      </view>
    </view>

    <!-- 1. 全屏轮播 Hero -->
    <view class="hero-swiper">
      <swiper
        class="swiper"
        :indicator-dots="false"
        :autoplay="carouselList.length > 1"
        :interval="5000"
        :duration="500"
        :circular="true"
        @change="onCarouselChange"
      >
        <swiper-item v-for="item in carouselList" :key="item.id" class="swiper-item">
          <view class="hero-slide" @tap="item.linkUrl ? goVehicleList() : goVehicleList()">
            <image :src="resolveAdminImage(item.imageUrl)" mode="aspectFill" class="hero-img" lazy-load />
            <view class="hero-mask"></view>
            <view class="hero-text" v-if="item.title">
              <view class="hero-title">{{ item.title }}</view>
              <view class="hero-subtitle">豪华车租赁 尊享出行</view>
            </view>
          </view>
        </swiper-item>
      </swiper>
      <!-- 轮播指示器 -->
      <view class="indicator-row">
        <view
          v-for="(item, idx) in carouselList"
          :key="item.id"
          class="indicator-dot"
          :class="{ active: currentCarousel === idx }"
        ></view>
      </view>
    </view>

    <!-- 主体内容 -->
    <view class="content-wrap">
      <!-- 2. 我的订单（仅登录） -->
      <view v-if="userStore.isLoggedIn && myActiveOrders.length" class="section">
        <view class="section-header">
          <view class="section-title">我的订单</view>
          <view class="section-more" @tap="goOrderList">查看全部 ›</view>
        </view>
        <scroll-view scroll-x class="orders-scroll" :show-scrollbar="false">
          <view class="orders-row">
            <view
              v-for="order in myActiveOrders"
              :key="order.id"
              class="order-card"
              @tap="goOrderDetail(order)"
            >
              <image :src="resolveAdminImage(order.carCover || '')" mode="aspectFill" class="order-img" lazy-load />
              <view class="order-info">
                <view class="order-name">{{ order.carName }}</view>
                <view class="order-date">{{ order.startDate }} 至 {{ order.endDate }}</view>
                <view class="order-status" :class="statusClass(order.status)">{{ statusText(order.status) }}</view>
              </view>
            </view>
          </view>
        </scroll-view>
      </view>

      <!-- 3. 品牌简介 -->
      <view class="brand-intro">
        <view class="brand-stats">
          <view class="stat-item">
            <view class="stat-num">50+</view>
            <view class="stat-label">豪华车型</view>
          </view>
          <view class="stat-divider"></view>
          <view class="stat-item">
            <view class="stat-num">10万+</view>
            <view class="stat-label">服务客户</view>
          </view>
          <view class="stat-divider"></view>
          <view class="stat-item">
            <view class="stat-num">4.9</view>
            <view class="stat-label">客户评分</view>
          </view>
        </view>
        <view class="brand-desc">{{ config?.intro || '豪华车租赁服务平台 · 大圣玩车 · 致力为您带来尊享出行体验' }}</view>
      </view>

      <!-- 4. 热门车型 -->
      <view v-if="hotCars.length" class="section">
        <view class="section-header">
          <view class="section-title">热门车型</view>
          <view class="section-more" @tap="goVehicleList()">查看全部 ›</view>
        </view>
        <scroll-view scroll-x class="cars-scroll" :show-scrollbar="false">
          <view class="cars-row">
            <view
              v-for="car in hotCars"
              :key="car.id"
              class="car-card-mini"
              @tap="goVehicleDetail(car)"
            >
              <view class="car-img-wrap">
                <image :src="resolveAdminImage(car.cover || '')" mode="aspectFill" class="car-img" lazy-load />
                <view v-if="car.isHot" class="car-tag tag-hot">HOT</view>
              </view>
              <view class="car-name">{{ car.name }}</view>
              <view class="car-meta">
                <text v-if="car.brand">{{ car.brand }}</text>
                <text v-if="car.year">·{{ car.year }}</text>
              </view>
              <view class="car-price">￥{{ formatPrice(car.dailyPrice) }}<text class="price-unit"> / 天</text></view>
            </view>
          </view>
        </scroll-view>
      </view>

      <!-- 5. 服务优势 -->
      <view v-if="advantages.length" class="section">
        <view class="section-header">
          <view class="section-title">服务优势</view>
        </view>
        <view class="advantage-grid">
          <view v-for="adv in advantages" :key="adv.id" class="advantage-item">
            <view class="adv-icon">{{ advantageIcon(adv.icon) }}</view>
            <view class="adv-title">{{ adv.title }}</view>
            <view class="adv-content">{{ adv.description }}</view>
          </view>
        </view>
      </view>

      <!-- 6. 客户评价 -->
      <view v-if="reviews.length" class="section">
        <view class="section-header">
          <view class="section-title">客户评价</view>
        </view>
        <scroll-view scroll-x class="reviews-scroll" :show-scrollbar="false">
          <view class="reviews-row">
            <view v-for="rv in reviews" :key="rv.id" class="review-card">
              <view class="review-header">
                <image :src="rv.avatarUrl" class="review-avatar" mode="aspectFill" @error="onReviewImgError(rv, $event)" />
                <view class="review-user">
                  <view class="review-name">{{ rv.name || '匿名用户' }}</view>
                  <view class="review-car">{{ rv.carName }}</view>
                </view>
                <view class="review-rating">★ {{ rv.rating }}</view>
              </view>
              <view class="review-content" :class="{ expanded: isReviewExpanded(rv.id) }">
                {{ rv.content }}
              </view>
              <view v-if="(rv.content || '').length > 40" class="review-toggle" @tap="toggleReviewExpand(rv.id)">
                {{ isReviewExpanded(rv.id) ? '收起 ▲' : '展开 ▼' }}
              </view>
              <view v-if="parseReviewImages(rv.images).length" class="review-images">
                <image
                  v-for="(img, idx) in parseReviewImages(rv.images).slice(0, 3)"
                  :key="idx"
                  :src="img"
                  class="review-img"
                  mode="aspectFill"
                  lazy-load
                  @tap="previewReviewImages(rv.images, idx)"
                />
              </view>
            </view>
          </view>
        </scroll-view>
      </view>
    </view>

    <!-- 7. 活动优惠券 -->
    <view v-if="coupons.length" class="section">
        <view class="section-header">
          <view class="section-title">活动优惠券</view>
        </view>
        <scroll-view scroll-x class="coupons-scroll" :show-scrollbar="false">
          <view class="coupons-row">
            <view v-for="c in coupons" :key="c.id" class="coupon-card-mini">
              <view class="coupon-face">
                <view class="coupon-value" :class="couponValueClass(c)">{{ couponFaceValue(c) }}</view>
                <view class="coupon-type">{{ c.couponName || c.name || '优惠券' }}</view>
              </view>
              <view class="coupon-info">
                <view v-if="c.minAmount" class="coupon-rule">满￥{{ formatPrice(c.minAmount) }} 可用</view>
                <view v-else class="coupon-rule">无门槛</view>
                <view class="coupon-remain">
                  剩余 {{ c.remainCount == null || c.remainCount < 0 ? '充足' : c.remainCount }}
                </view>
              </view>
              <view class="coupon-action">
                <u-button
                  type="primary"
                  size="small"
                  shape="square"
                  :text="isCouponClaimed(c) ? '已领取' : isCouponSoldOut(c) ? '已抢光' : '立即领取'"
                  :disabled="isCouponClaimed(c) || isCouponSoldOut(c)"
                  :loading="claimingCouponId === c.id"
                  @click="onClaimCoupon(c)"
                />
              </view>
            </view>
          </view>
        </scroll-view>
      </view>

      <!-- 8. 预约咨询表单 -->
      <view class="section appointment-section">
        <view class="section-header">
          <view class="section-title">预约咨询</view>
        </view>
        <view class="card appointment-form">
          <view class="form-item">
            <view class="form-label">姓名 <text class="required">*</text></view>
            <u-input v-model="appointmentForm.name" placeholder="请输入您的姓名" border="surround" maxlength="20" />
          </view>
          <view class="form-item">
            <view class="form-label">手机号 <text class="required">*</text></view>
            <u-input v-model="appointmentForm.phone" type="number" placeholder="请输入手机号" border="surround" maxlength="11" />
          </view>
          <view class="form-item">
            <view class="form-label">意向车型</view>
            <u-input v-model="appointmentForm.carType" placeholder="请输入意向车型（选填）" border="surround" maxlength="30" />
          </view>
          <view class="form-item">
            <view class="form-label">取车日期</view>
            <picker mode="date" :value="appointmentForm.rentDate" :start="todayPlus(0)" @change="onRentDateChange">
              <view class="date-picker">{{ appointmentForm.rentDate || '请选择取车日期（选填）' }}</view>
            </picker>
          </view>
          <view class="form-item">
            <view class="form-label">留言内容</view>
            <u-textarea
              v-model="appointmentForm.content"
              placeholder="请输入您的需求或留言（选填）"
              border="surround"
              maxlength="500"
              count
              height="120"
            />
          </view>
          <u-button type="primary" shape="square" text="提交预约" :loading="submittingAppointment" @click="submitAppointment" />
        </view>
      </view>

    <!-- 底部 TabBar -->
    <view class="tabbar-placeholder"></view>
    <TabBar active="pages/home/index" />
  </view>
</template>

<style scoped lang="scss">
.home-page {
  min-height: 100vh;
  background-color: var(--page-bg);
  padding-bottom: calc(100rpx + env(safe-area-inset-bottom));
}

/* 自定义顶部导航 */
.custom-header {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 100;
  background-color: transparent;
  transition: background-color 0.3s;

  &.solid {
    background-color: rgba(10, 10, 10, 0.92);
    backdrop-filter: blur(20rpx);
    border-bottom: 1rpx solid var(--border-color);
  }
}

/* 浅色主题：滚动态头部用浅色毛玻璃 */
.theme-light .custom-header.solid {
  background-color: rgba(245, 245, 247, 0.92);
}

.header-content {
  height: 80rpx;
  padding: 0 32rpx;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.header-title {
  font-size: 32rpx;
  font-weight: 800;
  color: #ff2e2e;
  letter-spacing: 2rpx;
}

.header-actions {
  display: flex;
  gap: 16rpx;
}

.header-icon {
  position: relative;
  width: 64rpx;
  height: 64rpx;
  border-radius: 50%;
  background-color: rgba(255, 255, 255, 0.1);
  display: flex;
  align-items: center;
  justify-content: center;
}

/* 浅色主题：图标圆形底色反转为深色淡层，图标颜色切换为主题主文字色 */
.theme-light .header-icon,
.theme-light .header-avatar-btn {
  background-color: rgba(0, 0, 0, 0.08);
}

.header-icon-symbol {
  font-size: 36rpx;
  color: var(--text-main);
  line-height: 1;
}

/* 右侧个人中心：登录后显示用户头像，未登录显示 icon */
.header-avatar-btn {
  position: relative;
  width: 64rpx;
  height: 64rpx;
  border-radius: 50%;
  overflow: hidden;
  background-color: rgba(255, 255, 255, 0.1);
  display: flex;
  align-items: center;
  justify-content: center;
}

.header-avatar-img {
  width: 100%;
  height: 100%;
  border-radius: 50%;
}

/* 购物车角标 */
.header-cart-badge {
  position: absolute;
  top: -6rpx;
  right: -6rpx;
  min-width: 30rpx;
  height: 30rpx;
  padding: 0 8rpx;
  border-radius: 15rpx;
  background-color: #ff2e2e;
  color: #ffffff;
  font-size: 20rpx;
  font-weight: 700;
  line-height: 30rpx;
  text-align: center;
  box-sizing: border-box;
}

/* Hero 轮播 */
.hero-swiper {
  position: relative;
  width: 100%;
  height: 520rpx;
}

.swiper {
  width: 100%;
  height: 100%;
}

.swiper-item {
  width: 100%;
  height: 100%;
}

.hero-slide {
  position: relative;
  width: 100%;
  height: 100%;
}

.hero-img {
  width: 100%;
  height: 100%;
}

.hero-mask {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(180deg, rgba(0, 0, 0, 0.3) 0%, transparent 40%, rgba(0, 0, 0, 0.6) 100%);
}

.hero-text {
  position: absolute;
  left: 48rpx;
  bottom: 120rpx;
  z-index: 2;
}

.hero-title {
  font-size: 56rpx;
  font-weight: 800;
  color: #fff;
  letter-spacing: 2rpx;
  text-shadow: 0 2rpx 8rpx rgba(0, 0, 0, 0.5);
}

.hero-subtitle {
  font-size: 28rpx;
  color: #f5f5f5;
  margin-top: 8rpx;
  text-shadow: 0 2rpx 8rpx rgba(0, 0, 0, 0.5);
}

.indicator-row {
  position: absolute;
  bottom: 48rpx;
  left: 48rpx;
  display: flex;
  gap: 12rpx;
  z-index: 2;
}

.indicator-dot {
  width: 16rpx;
  height: 6rpx;
  border-radius: 3rpx;
  background-color: rgba(255, 255, 255, 0.4);
  transition: all 0.3s;

  &.active {
    width: 48rpx;
    background-color: #ff2e2e;
  }
}

/* 主体 */
.content-wrap {
  position: relative;
  z-index: 2;
  background-color: var(--page-bg);
}

.section {
  padding: 20rpx 0;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0 32rpx 16rpx;
}

.section-title {
  font-size: 36rpx;
  font-weight: 700;
  color: var(--text-main);
}

.section-more {
  font-size: 24rpx;
  color: var(--text-sub);
}

/* 我的订单 */
.orders-scroll {
  white-space: nowrap;
  padding: 0 32rpx;
}

.orders-row {
  display: inline-flex;
  gap: 24rpx;
}

.order-card {
  display: inline-flex;
  width: 480rpx;
  background-color: var(--card-bg);
  border-radius: 16rpx;
  overflow: hidden;
  border: 1rpx solid var(--border-color);
}

.order-img {
  width: 200rpx;
  height: 160rpx;
  flex-shrink: 0;
}

.order-info {
  flex: 1;
  padding: 16rpx 20rpx;
  display: flex;
  flex-direction: column;
  gap: 8rpx;
  min-width: 0;
}

.order-name {
  font-size: 28rpx;
  color: var(--text-main);
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.order-date {
  font-size: 22rpx;
  color: var(--text-sub);
}

.order-status {
  font-size: 22rpx;
  font-weight: 500;
  margin-top: auto;
}

.status-pending { color: #ff9900; }
.status-renting { color: #ff2e2e; }
.status-completed { color: #07c160; }
.status-cancelled { color: var(--text-dim); }

/* 品牌简介 */
.brand-intro {
  text-align: center;
  padding: 32rpx 24rpx;
  margin: 0 24rpx 24rpx;
  background: linear-gradient(135deg, rgba(255, 46, 46, 0.08) 0%, var(--card-bg) 100%);
  border-radius: 16rpx;
}

.brand-stats {
  display: flex;
  justify-content: space-around;
  align-items: center;
}

.stat-item {
  text-align: center;
  flex: 1;
}

.stat-num {
  font-size: 48rpx;
  font-weight: 800;
  color: #ff5a3c;
  line-height: 1.2;
}

.stat-label {
  font-size: 22rpx;
  color: var(--text-sub);
  margin-top: 4rpx;
}

.stat-divider {
  width: 1rpx;
  height: 64rpx;
  background-color: var(--border-color);
}

.brand-desc {
  font-size: 26rpx;
  color: var(--text-sub);
  margin-top: 16rpx;
  line-height: 1.6;
}

/* 热门车型 */
.cars-scroll {
  white-space: nowrap;
  padding: 0 32rpx;
}

.cars-row {
  display: inline-flex;
  gap: 24rpx;
}

.car-card-mini {
  display: inline-flex;
  flex-direction: column;
  width: 320rpx;
  background-color: var(--card-bg);
  border-radius: 16rpx;
  overflow: hidden;
  border: 1rpx solid var(--border-color);
}

.car-img-wrap {
  position: relative;
  width: 100%;
  height: 200rpx;
}

.car-img {
  width: 100%;
  height: 100%;
}

.car-tag {
  position: absolute;
  top: 12rpx;
  left: 12rpx;
  padding: 4rpx 12rpx;
  border-radius: 4rpx;
  font-size: 20rpx;
  font-weight: 700;
}

.tag-hot {
  background-color: #ff2e2e;
  color: #fff;
}

.car-name {
  font-size: 28rpx;
  color: var(--text-main);
  font-weight: 500;
  padding: 16rpx 20rpx 4rpx;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.car-meta {
  font-size: 22rpx;
  color: var(--text-sub);
  padding: 0 20rpx 8rpx;
}

.car-price {
  font-size: 32rpx;
  color: #ff5a3c;
  font-weight: 700;
  padding: 0 20rpx 20rpx;
}

.price-unit {
  font-size: 22rpx;
  color: var(--text-sub);
  font-weight: 400;
}

/* 服务优势 */
.advantage-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16rpx;
  padding: 0 24rpx;
}

.advantage-item {
  padding: 24rpx 16rpx;
  background-color: var(--card-bg);
  border-radius: 16rpx;
  border: 1rpx solid var(--border-color);
  text-align: center;
}

.adv-icon {
  font-size: 48rpx;
  margin-bottom: 16rpx;
}

.adv-title {
  font-size: 28rpx;
  font-weight: 600;
  color: var(--text-main);
  margin-bottom: 8rpx;
}

.adv-content {
  font-size: 22rpx;
  color: var(--text-sub);
  line-height: 1.6;
}

/* 客户评价 */
.reviews-scroll {
  white-space: nowrap;
  padding: 0 32rpx;
}

.reviews-row {
  display: inline-flex;
  gap: 24rpx;
}

.review-card {
  display: inline-flex;
  flex-direction: column;
  flex-shrink: 0;
  width: 520rpx;
  padding: 24rpx;
  background-color: var(--card-bg);
  border-radius: 16rpx;
  border: 1rpx solid var(--border-color);
  vertical-align: top;
}

.review-header {
  display: flex;
  align-items: center;
  gap: 16rpx;
  margin-bottom: 16rpx;
}

.review-avatar {
  width: 64rpx;
  height: 64rpx;
  border-radius: 50%;
  background-color: var(--border-color);
}

.review-user {
  flex: 1;
  min-width: 0;
}

.review-name {
  font-size: 28rpx;
  color: var(--text-main);
  font-weight: 500;
}

.review-car {
  font-size: 22rpx;
  color: var(--text-sub);
}

.review-rating {
  font-size: 28rpx;
  color: #ff9900;
  font-weight: 700;
}

.review-content {
  font-size: 26rpx;
  color: var(--text-sub);
  line-height: 1.6;
  /* 覆盖 .reviews-scroll 继承的 white-space: nowrap，确保评价正文在卡片内自动换行 */
  white-space: normal;
  word-break: break-all;
  overflow-wrap: anywhere;
  /* 默认最多展示约 3 行，超出裁剪；展开时取消高度限制 */
  max-height: 130rpx;
  overflow: hidden;

  &.expanded {
    max-height: none;
    overflow: visible;
  }
}

.review-toggle {
  font-size: 24rpx;
  color: #ff2e2e;
  margin-top: 8rpx;
  align-self: flex-end;
  padding: 4rpx 8rpx;
}

.review-images {
  display: flex;
  gap: 8rpx;
  margin-top: 16rpx;
}

.review-img {
  width: 160rpx;
  height: 160rpx;
  border-radius: 8rpx;
}

/* 优惠券 */
.coupons-scroll {
  white-space: nowrap;
  padding: 0 32rpx;
}

.coupons-row {
  display: inline-flex;
  gap: 24rpx;
}

.coupon-card-mini {
  display: inline-flex;
  flex-direction: column;
  flex: 0 0 auto;
  width: 340rpx;
  padding: 24rpx;
  background: linear-gradient(135deg, rgba(255, 46, 46, 0.18) 0%, var(--card-bg) 100%);
  border-radius: 16rpx;
  border: 1rpx solid #ff2e2e;
}

.coupon-face {
  text-align: center;
  padding: 16rpx 0;
  border-bottom: 1rpx dashed var(--border-color);
}

/* 优惠面值：根据字符长度自适应字号，避免「减¥1,111.00」撑爆卡片 */
.coupon-value {
  display: block;
  width: 100%;
  font-weight: 800;
  color: #ff5a3c;
  line-height: 1.2;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  /* 短文本 44rpx；中长文本 34rpx；超长文本 26rpx */
  font-size: 44rpx;

  &.coupon-value-sm {
    font-size: 34rpx;
  }
  &.coupon-value-xs {
    font-size: 26rpx;
  }
}

.coupon-type {
  font-size: 22rpx;
  color: var(--text-sub);
  margin-top: 4rpx;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.coupon-info {
  padding: 16rpx 0;
}

.coupon-rule {
  font-size: 22rpx;
  color: var(--text-sub);
  text-align: center;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.coupon-remain {
  font-size: 20rpx;
  color: var(--text-dim);
  text-align: center;
  margin-top: 4rpx;
}

.coupon-action {
  margin-top: auto;
  padding-top: 16rpx;
}

/* 预约表单 */
.appointment-section {
  padding: 32rpx;
}

.appointment-form {
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

.date-picker {
  height: 80rpx;
  line-height: 80rpx;
  padding: 0 24rpx;
  background-color: var(--border-color);
  border-radius: 8rpx;
  font-size: 28rpx;
  color: var(--text-main);
}

.tabbar-placeholder {
  height: 100rpx;
}
</style>
