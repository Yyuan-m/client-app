<script setup lang="ts">
/**
 * 车辆详情页 - 核心展示与下单入口
 * 原Web: 图片区 + 核心信息 + 4大参数配置块 + sticky 租车卡片 + 价格实时计算
 *
 * onLoad: 接收 options.id
 * API: Promise.all([getCarDetailApi(id), getCarImagesApi(id)])，getCarImagesApi 失败 catch([]) 兜底
 * 价格实时计算：watch([car.id, dateRange])，调 calcCarPriceApi
 * 加入购物车：校验登录 → 校验 rentDays → cartStore.addItem → 跳 /pages/order/checkout
 */
import { ref, reactive, computed, watch } from 'vue'
import { onLoad, onUnload, onShow } from '@dcloudio/uni-app'
import { useAppStore } from '@/stores/app'
import { useUserStore } from '@/stores/user'
import { useCartStore } from '@/stores/cart'
import { useThemeClass } from '@/composables/useThemeClass'
import { useNavigationBar } from '@/composables/useNavigationBar'
import { getCarDetailApi, getCarImagesApi } from '@/api/modules/car'
import { calcCarPriceApi } from '@/api/modules/price'
import { resolveAdminImage } from '@/utils/image'
import { moneyUtil, dateUtil, validators, rentCountLevel, rentDaysLevel } from '@/utils'
import type { CarDetailVO, CarImageGroupVO, PriceDetailVO, CarConfigVO } from '@/api/types'

const appStore = useAppStore()
const userStore = useUserStore()
const cartStore = useCartStore()
const { themeClass } = useThemeClass()
/** 原生导航栏随主题切换 */
useNavigationBar()
/** 加载动画颜色：随深浅主题切换 */
const loadingColor = computed(() => (appStore.isDark ? '#aeaeb2' : '#6e6e73'))

const carId = ref<number | string>('')
const car = ref<CarDetailVO | null>(null)
const imageGroups = ref<CarImageGroupVO[]>([])
const loading = ref(true)
const submitting = ref(false)

// 主图 swiper 当前索引
const currentMainImage = ref(0)

// 主图列表：imageList + 素材图片第一张合并展示
const mainImages = computed<string[]>(() => {
  if (!car.value) return []
  const list: string[] = []
  if (Array.isArray(car.value.imageList)) {
    list.push(...car.value.imageList)
  }
  if (car.value.cover && !list.includes(car.value.cover)) {
    list.unshift(car.value.cover)
  }
  return list
})

// 缩略图（来自所有素材分组的第一张）
const thumbnailList = computed<string[]>(() => {
  const arr: string[] = []
  imageGroups.value.forEach((g) => {
    if (g.images && g.images.length) {
      g.images.forEach((img) => arr.push(img))
    }
  })
  return arr
})

// 所有图片预览列表
const previewList = computed<string[]>(() => {
  const arr = [...mainImages.value, ...thumbnailList.value]
  return arr.map((p) => resolveAdminImage(p))
})

// 日期选择
const dateRange = reactive<{ start: string; end: string }>({
  start: '',
  end: ''
})
const minRentDays = computed(() => car.value?.minRentDays || 1)
// 车辆级最大租期（car_info.max_rent_days）；null 表示不限租期
const maxRentDays = computed<number | null>(() => {
  const max = Number(car.value?.maxRentDays)
  return max > 0 ? max : null
})
// 是否限制最大租期
const hasMaxRentLimit = computed(() => maxRentDays.value != null)
// 最大租期展示文案（着重展示）
const maxRentText = computed(() => (hasMaxRentLimit.value ? `最长可租 ${maxRentDays.value} 天` : '租期不限'))
// 长租折扣提示（联动最大租期：不足30天则月租不可达，不足7天则周租不可达）
const discountTip = computed(() => {
  if (!car.value) return ''
  const weekly = Number(car.value.weeklyDiscount || 1)
  const monthly = Number(car.value.monthlyDiscount || 1)
  const max = maxRentDays.value
  const parts = []
  if (weekly < 1 && (max == null || max >= 7)) parts.push(`7天及以上 ${(weekly * 10).toFixed(1)}折`)
  if (monthly < 1 && (max == null || max >= 30)) parts.push(`30天及以上 ${(monthly * 10).toFixed(1)}折`)
  return parts.join(' · ')
})
// 月租折扣不可达提示
const monthlyUnavailableTip = computed(() => {
  if (!car.value) return ''
  const monthly = Number(car.value.monthlyDiscount || 1)
  const max = maxRentDays.value
  if (monthly < 1 && max != null && max < 30) return `本车最长租期 ${max} 天，不适用月租折扣`
  return ''
})
// 快捷租期选项（按车辆最小/最大租期动态过滤；不限则展示 30 天）
const quickPickOptions = computed<number[]>(() => {
  const all = [3, 7, 15, 20, 30]
  return all.filter((d) => d >= minRentDays.value && (maxRentDays.value == null || d <= maxRentDays.value))
})
const minDate = computed(() => {
  // 已出租车辆：availableDate 为最早可租日
  if (car.value?.availableDate) return car.value.availableDate
  return dateUtil.today()
})

// 价格明细
const priceDetail = ref<PriceDetailVO | null>(null)
const priceLoading = ref(false)
const priceFailed = ref(false)

// 配置分类
const configCategories = computed<{ label: string; key: string }[]>(() => [
  { label: '基本参数', key: 'basic' },
  { label: '动力配置', key: 'power' },
  { label: '内饰与娱乐', key: 'interior' },
  { label: '安全配置', key: 'safety' }
])

const activeConfigTab = ref('basic')

const currentConfigList = computed<CarConfigVO[]>(() => {
  if (!car.value?.configList) return []
  return car.value.configList.filter((c) => (c.category || '').toLowerCase() === activeConfigTab.value)
})

// 租期计算
const rentDays = computed(() => {
  if (!dateRange.start || !dateRange.end) return 0
  return dateUtil.daysBetween(dateRange.start, dateRange.end)
})

// 租期是否有效
const rentDaysValid = computed(() => {
  if (!dateRange.start || !dateRange.end) return false
  const r = dateUtil.validateRentDays(dateRange.start, dateRange.end, minRentDays.value, maxRentDays.value)
  return r.valid
})

// 租期无效原因文案（准确提示）
const rentErrorText = computed(() => {
  if (!dateRange.start || !dateRange.end) return ''
  const r = dateUtil.validateRentDays(dateRange.start, dateRange.end, minRentDays.value, maxRentDays.value)
  if (r.valid) return ''
  if (rentDays.value < minRentDays.value) return `最少需租 ${minRentDays.value} 天`
  if (maxRentDays.value != null && rentDays.value > maxRentDays.value) return `最长只能租 ${maxRentDays.value} 天`
  return r.msg || '租期无效'
})

onLoad(async (options: Record<string, string> | undefined) => {
  const opts = options || {}
  if (!opts.id) {
    uni.showToast({ title: '参数错误', icon: 'none' })
    setTimeout(() => uni.navigateBack({ delta: 1 }), 800)
    return
  }
  carId.value = opts.id
  await loadDetail()
})

onShow(() => {
  // 初始化悬浮购物车位置（仅首次）
  initFloatPos()
  // 展示时刷新购物车数量角标（登录态）
  if (userStore.isLoggedIn) {
    cartStore.initCart().catch((e) => console.error('[vehicle.detail] initCart failed:', e))
  }
})

onUnload(() => {})

async function loadDetail() {
  loading.value = true
  try {
    const [detail, images] = await Promise.all([
      getCarDetailApi(carId.value),
      getCarImagesApi(carId.value).catch((e) => {
        console.error('[vehicle.detail] getCarImagesApi failed:', e)
        return [] as CarImageGroupVO[]
      })
    ])
    car.value = detail
    imageGroups.value = images || []
    // 设置导航栏标题
    uni.setNavigationBarTitle({ title: detail.name || '车辆详情' })
  } catch (e) {
    console.error('[vehicle.detail] loadDetail failed:', e)
    uni.showToast({ title: '加载失败', icon: 'none' })
  } finally {
    loading.value = false
  }
}

// 价格实时计算：car.id / dateRange 变化触发
watch(
  [() => car.value?.id, () => dateRange.start, () => dateRange.end],
  async () => {
    if (!car.value?.id || !dateRange.start || !dateRange.end || !rentDaysValid.value) {
      priceDetail.value = null
      return
    }
    priceLoading.value = true
    priceFailed.value = false
    try {
      priceDetail.value = await calcCarPriceApi({
        carId: Number(car.value.id),
        startDate: dateRange.start,
        endDate: dateRange.end
      })
    } catch (e) {
      console.error('[vehicle.detail] calcPrice failed:', e)
      priceDetail.value = null
      priceFailed.value = true
    } finally {
      priceLoading.value = false
    }
  }
)

// 主图切换
function onMainImageChange(e: any) {
  currentMainImage.value = e.detail.current
}

function previewMainImage(idx: number) {
  if (!previewList.value.length) return
  appStore.openImagePreview(previewList.value, idx)
}

// 日期选择
function onStartDateChange(e: any) {
  dateRange.start = e.detail.value
  // 自动调整结束日：若结束日早于开始日，重置
  if (dateRange.end && dateUtil.daysBetween(dateRange.start, dateRange.end) <= 0) {
    dateRange.end = dateUtil.addDays(dateRange.start, minRentDays.value)
  }
}

function onEndDateChange(e: any) {
  dateRange.end = e.detail.value
}

// 快捷选择 N 天
function quickPickDays(days: number) {
  if (days < minRentDays.value || (maxRentDays.value != null && days > maxRentDays.value)) return
  const today = dateUtil.today()
  dateRange.start = today
  dateRange.end = dateUtil.addDays(today, days)
}

// 加入购物车
async function addToCart() {
  if (!userStore.isLoggedIn) {
    uni.showToast({ title: '请先登录', icon: 'none' })
    const redirect = encodeURIComponent(`/pages/vehicle/detail?id=${carId.value}`)
    setTimeout(() => {
      uni.navigateTo({ url: `/pages/auth/login?redirect=${redirect}` })
    }, 800)
    return
  }
  if (!car.value) return
  if (!rentDaysValid.value) {
    uni.showToast({ title: rentErrorText.value || '请选择有效租期', icon: 'none' })
    return
  }
  // 已出租车辆：二次校验 availableDate
  if (car.value.status === 'rented' && car.value.availableDate) {
    if (dateRange.start < car.value.availableDate) {
      uni.showToast({ title: `该车辆暂不可租，最早可租日 ${car.value.availableDate}`, icon: 'none' })
      return
    }
  }
  submitting.value = true
  try {
    await cartStore.addItem(car.value, dateRange.start, dateRange.end, rentDays.value)
    uni.showToast({ title: '已加入购物车', icon: 'success' })
  } catch (e) {
    console.error('[vehicle.detail] addToCart failed:', e)
  } finally {
    submitting.value = false
  }
}

// 实名认证拦截：未完成实名与驾驶证认证时只能看车选车，不能下单
// 返回 true 表示已认证可继续，false 表示已弹窗拦截
async function checkVerified(): Promise<boolean> {
  if (userStore.user?.verifyStatus === 'verified') return true
  // 本地缓存可能过期，刷新一次用户信息确保认证状态准确
  try {
    await userStore.fetchUserInfo()
  } catch (e) {
    console.error('[vehicle.detail] fetchUserInfo failed:', e)
  }
  // 重新读取认证状态（fetchUserInfo 后状态可能已变化，用函数读取避免类型收窄）
  if (userStore.user && (userStore.user as { verifyStatus?: string }).verifyStatus === 'verified') return true
  uni.showModal({
    title: '实名认证提示',
    content: '需要完成实名与驾驶证信息认证后才能下单租车，是否现在去认证？',
    confirmText: '去认证',
    cancelText: '暂不认证',
    success: (res) => {
      if (res.confirm) {
        uni.navigateTo({ url: '/pages/profile/verify' })
      }
    }
  })
  return false
}

// 立即租车：加入购物车并跳结算
async function rentNow() {
  if (!userStore.isLoggedIn) {
    uni.showToast({ title: '请先登录', icon: 'none' })
    const redirect = encodeURIComponent(`/pages/vehicle/detail?id=${carId.value}`)
    setTimeout(() => {
      uni.navigateTo({ url: `/pages/auth/login?redirect=${redirect}` })
    }, 800)
    return
  }
  if (!car.value) return
  if (!(await checkVerified())) return
  if (!rentDaysValid.value) {
    uni.showToast({ title: rentErrorText.value || '请选择有效租期', icon: 'none' })
    return
  }
  // 已出租车辆：二次校验
  if (car.value.status === 'rented' && car.value.availableDate) {
    if (dateRange.start < car.value.availableDate) {
      uni.showToast({ title: `该车辆暂不可租，最早可租日 ${car.value.availableDate}`, icon: 'none' })
      return
    }
  }
  submitting.value = true
  try {
    await cartStore.addItem(car.value, dateRange.start, dateRange.end, rentDays.value)
    uni.showToast({ title: '正在前往结算', icon: 'success' })
    setTimeout(() => {
      uni.navigateTo({ url: '/pages/order/checkout' })
    }, 600)
  } catch (e) {
    console.error('[vehicle.detail] rentNow failed:', e)
  } finally {
    submitting.value = false
  }
}

// 价格展示
function formatPrice(p: number | string | null | undefined): string {
  return moneyUtil.format(Number(p || 0))
}

// 按钮文案
const rentBtnText = computed(() => {
  if (!car.value) return ''
  if (car.value.status === 'rented') return '预约租车'
  if (car.value.status === 'maintenance') return '维修中'
  return '立即租车'
})

const rentBtnDisabled = computed(() => {
  if (!car.value) return true
  return car.value.status === 'maintenance'
})

// 配置 tab 切换
function switchConfigTab(key: string) {
  activeConfigTab.value = key
}

function goBack() {
  uni.navigateBack({ delta: 1 })
}

// 快捷跳转购物车（悬浮图标）
function goCart() {
  uni.switchTab?.({ url: '/pages/cart/index' } as any) || uni.reLaunch({ url: '/pages/cart/index' })
}

// ===== 购物车悬浮图标：可拖拽，位置用 px 定位 =====
const FLOAT_SIZE = 56 // float-cart 的直径（px），需与 CSS 保持一致
const floatLeft = ref<number | null>(null)
const floatTop = ref<number | null>(null)
let touchStartX = 0
let touchStartY = 0

/** 初始化悬浮图标位置（右下角，避开底部操作栏） */
function initFloatPos() {
  if (floatLeft.value !== null) return
  const sys = uni.getSystemInfoSync()
  const winW = sys.windowWidth || 375
  const winH = sys.windowHeight || 667
  floatLeft.value = Math.max(8, winW - FLOAT_SIZE - 12)
  // 底部操作栏之上留出间距（操作栏约 120px 逻辑高度）
  floatTop.value = Math.max(8, winH - 140 - FLOAT_SIZE - 16)
}

function onFloatTouchStart(e: UniApp.TouchEvent) {
  initFloatPos()
  const t = e.touches[0]
  touchStartX = t.clientX
  touchStartY = t.clientY
}

function onFloatTouchMove(e: UniApp.TouchEvent) {
  const t = e.touches[0]
  if (floatLeft.value === null || floatTop.value === null) return
  floatLeft.value += t.clientX - touchStartX
  floatTop.value += t.clientY - touchStartY
  // 限制在屏幕范围内
  const sys = uni.getSystemInfoSync()
  floatLeft.value = Math.max(0, Math.min(floatLeft.value, (sys.windowWidth || 375) - FLOAT_SIZE))
  floatTop.value = Math.max(0, Math.min(floatTop.value, (sys.windowHeight || 667) - FLOAT_SIZE))
  touchStartX = t.clientX
  touchStartY = t.clientY
}
</script>

<template>
  <view class="vehicle-detail-page" :class="themeClass">
    <!-- 购物车悬浮按钮（本页无底部 TabBar footer，展示悬浮图标；半透明、可拖拽、显示数量） -->
    <view
      class="float-cart"
      :style="floatLeft !== null ? { left: floatLeft + 'px', top: floatTop + 'px' } : {}"
      @touchstart="onFloatTouchStart"
      @touchmove.stop.prevent="onFloatTouchMove"
      @tap="goCart"
    >
      <text class="float-cart-icon">🛒</text>
      <view v-if="cartStore.totalCount > 0" class="float-cart-badge">{{ cartStore.totalCount > 99 ? '99+' : cartStore.totalCount }}</view>
    </view>

    <!-- 加载中 -->
    <view v-if="loading" class="loading-wrap">
      <u-loading-icon mode="circle" :color="loadingColor" :textColor="loadingColor" text="加载中..." />
    </view>

    <view v-else-if="car">
      <!-- 主图 Swiper -->
      <view class="main-image-wrap">
        <swiper
          class="main-swiper"
          :indicator-dots="false"
          :autoplay="false"
          :circular="false"
          @change="onMainImageChange"
        >
          <swiper-item v-for="(img, idx) in mainImages" :key="idx" @tap="previewMainImage(idx)">
            <image :src="resolveAdminImage(img)" mode="aspectFill" class="main-img" lazy-load />
          </swiper-item>
        </swiper>
        <view class="image-counter">{{ currentMainImage + 1 }}/{{ mainImages.length }}</view>
        <!-- 状态标签 -->
        <view class="car-status-tag" :class="`status-${car.status}`">
          {{ car.status === 'rented' ? '已租出' : car.status === 'maintenance' ? '维修中' : '可租' }}
        </view>
        <!-- 角标 -->
        <view v-if="car.isHot" class="car-tag tag-hot">HOT</view>
        <view v-else-if="car.isRecommend" class="car-tag tag-rec">推荐</view>
      </view>

      <!-- 缩略图列表 -->
      <view v-if="mainImages.length > 1" class="thumbnail-row">
        <scroll-view scroll-x :show-scrollbar="false">
          <view class="thumbnail-list">
            <view
              v-for="(img, idx) in mainImages"
              :key="idx"
              class="thumbnail"
              :class="{ active: currentMainImage === idx }"
              @tap="() => { currentMainImage = idx }"
            >
              <image :src="resolveAdminImage(img)" mode="aspectFill" class="thumbnail-img" lazy-load />
            </view>
          </view>
        </scroll-view>
      </view>

      <!-- 核心信息 -->
      <view class="info-card">
        <view class="car-name">{{ car.name }}</view>
        <view class="car-meta">
          <text v-if="car.brand">{{ car.brand }}</text>
          <text v-if="car.year"> · {{ car.year }}款</text>
          <text v-if="car.seats"> · {{ car.seats }}座</text>
          <text v-if="car.displacement"> · {{ car.displacement }}</text>
        </view>
        <view class="car-stats">
          <view class="stat">
            <text class="stat-value">★ {{ car.rating || '5.0' }}</text>
            <text class="stat-label">评分</text>
          </view>
          <view class="stat-divider"></view>
          <view class="stat">
            <text class="rent-badge" :class="'rent-' + rentCountLevel(car.rentCount)">{{ car.rentCount || 0 }}</text>
            <text class="stat-label">出租次数</text>
            <text v-if="car.rentDays" class="rent-days-sub" :class="'rent-' + rentDaysLevel(car.rentDays)">累计 {{ car.rentDays }} 天</text>
          </view>
          <view class="stat-divider"></view>
          <view class="stat">
            <text class="stat-value">￥{{ formatPrice(car.dailyPrice) }}</text>
            <text class="stat-label">日租金</text>
          </view>
        </view>
        <!-- 描述 -->
        <view v-if="car.description" class="car-desc">{{ car.description }}</view>
      </view>

      <!-- 租车卡片 -->
      <view class="rent-card">
        <view class="rent-price-row">
          <view class="rent-price">
            <text v-if="priceDetail" class="rent-price-main">￥{{ formatPrice(priceDetail.rentAmount) }}</text>
            <text v-else-if="priceLoading" class="rent-price-loading">计算中...</text>
            <text v-else class="rent-price-main">￥{{ formatPrice(car.dailyPrice) }}<text class="rent-price-unit">/天</text></text>
            <text v-if="rentDays > 0" class="rent-days">共 {{ rentDays }} 天</text>
          </view>
        </view>

        <!-- 最大租期着重展示 -->
        <view class="max-rent-tip" :class="{ unlimited: !hasMaxRentLimit }">
          <text class="max-rent-tip-icon">⏱</text>
          <text class="max-rent-tip-text">{{ maxRentText }}</text>
        </view>

        <!-- 长租折扣提示（联动车辆最大租期） -->
        <view v-if="discountTip" class="tip tip-discount-static">{{ discountTip }}</view>
        <view v-if="monthlyUnavailableTip" class="tip tip-monthly-unavailable">{{ monthlyUnavailableTip }}</view>

        <!-- 长租折扣 / 节假日溢价 提示 -->
        <view v-if="priceDetail" class="price-tips">
          <view v-if="Number(priceDetail.discountAmount) > 0" class="tip tip-discount">
            {{ priceDetail.durationTierName }}折扣 -￥{{ formatPrice(priceDetail.discountAmount) }}
          </view>
          <view v-if="priceDetail.holidayDays > 0" class="tip tip-holiday">
            含{{ priceDetail.holidayDays }}天假日 +￥{{ formatPrice(priceDetail.holidaySurchargeAmount) }}
          </view>
          <view v-if="car.status === 'rented' && car.availableDate" class="tip tip-rented">
            最早可租日：{{ car.availableDate }}
          </view>
        </view>

        <!-- 日期选择 -->
        <view class="date-pick-section">
          <view class="date-pick-title">选择租期</view>
          <view class="date-pick-row">
            <view class="date-pick-item">
              <view class="date-label">取车日</view>
              <picker mode="date" :value="dateRange.start" :start="minDate" @change="onStartDateChange">
                <view class="date-value" :class="{ placeholder: !dateRange.start }">
                  {{ dateRange.start || '请选择' }}
                </view>
              </picker>
            </view>
            <view class="date-arrow">→</view>
            <view class="date-pick-item">
              <view class="date-label">还车日</view>
              <picker
                mode="date"
                :value="dateRange.end"
                :start="dateRange.start || minDate"
                @change="onEndDateChange"
              >
                <view class="date-value" :class="{ placeholder: !dateRange.end }">
                  {{ dateRange.end || '请选择' }}
                </view>
              </picker>
            </view>
          </view>
          <!-- 快捷选项 -->
          <view class="quick-pick-row">
            <view
              v-for="d in quickPickOptions"
              :key="d"
              class="quick-pick"
              :class="{ disabled: d < minRentDays || (maxRentDays != null && d > maxRentDays), active: rentDays === d }"
              @tap="() => quickPickDays(d)"
            >
              {{ d }}天
            </view>
          </view>
          <!-- 租期提示 -->
          <view v-if="dateRange.start && dateRange.end" class="rent-days-tip" :class="{ invalid: !rentDaysValid }">
            <text v-if="rentDaysValid">租期 {{ rentDays }} 天</text>
            <text v-else>{{ rentErrorText }}</text>
          </view>
        </view>

        <!-- 价格明细 -->
        <view v-if="priceDetail" class="price-detail">
          <view class="detail-row">
            <text>工作日</text>
            <text>{{ priceDetail.normalDays }} 天 × ￥{{ formatPrice(car.dailyPrice) }}</text>
          </view>
          <view v-if="priceDetail.holidayDays > 0" class="detail-row">
            <text>假日/周末</text>
            <text>{{ priceDetail.holidayDays }} 天 × ￥{{ formatPrice(car.dailyPrice) }} × {{ Number(priceDetail.holidaySurcharge).toFixed(2) }}</text>
          </view>
          <view class="detail-row">
            <text>折扣前小计</text>
            <text>￥{{ formatPrice(priceDetail.subtotal) }}</text>
          </view>
          <view v-if="Number(priceDetail.discountAmount) > 0" class="detail-row discount">
            <text>{{ priceDetail.durationTierName }}折扣</text>
            <text>-￥{{ formatPrice(priceDetail.discountAmount) }}</text>
          </view>
          <view class="detail-row total">
            <text>应付合计</text>
            <text class="text-price">￥{{ formatPrice(priceDetail.totalAmount) }}</text>
          </view>
        </view>
        <view v-else-if="priceFailed" class="price-failed-tip">价格加载失败，请重试</view>
      </view>

      <!-- 4 大参数配置块 -->
      <view v-if="car.configList && car.configList.length" class="config-section">
        <view class="section-title">参数配置</view>
        <view class="config-tabs">
          <view
            v-for="cat in configCategories"
            :key="cat.key"
            class="config-tab"
            :class="{ active: activeConfigTab === cat.key }"
            @tap="switchConfigTab(cat.key)"
          >
            {{ cat.label }}
          </view>
        </view>
        <view class="config-list">
          <view v-for="(cfg, idx) in currentConfigList" :key="idx" class="config-item">
            <text class="config-name">{{ cfg.itemName }}</text>
            <text class="config-value">{{ cfg.itemValue }}</text>
          </view>
          <view v-if="!currentConfigList.length" class="config-empty">暂无数据</view>
        </view>
      </view>

      <!-- 素材分类照片 -->
      <view v-if="imageGroups.length" class="materials-section">
        <view class="section-title">车辆素材</view>
        <view v-for="group in imageGroups" :key="group.category" class="material-group">
          <view class="material-title">{{ group.category }}</view>
          <view class="material-images">
            <image
              v-for="(img, idx) in group.images"
              :key="idx"
              :src="resolveAdminImage(img)"
              mode="aspectFill"
              class="material-img"
              lazy-load
              @tap="() => appStore.openImagePreview(group.images.map(resolveAdminImage), idx)"
            />
          </view>
        </view>
      </view>

      <!-- 底部操作栏（固定定位，根元素已用 padding-bottom 预留空间，避免遮挡内容） -->
      <view class="bottom-bar">
        <view class="bottom-price">
          <text v-if="priceDetail" class="bp-main">￥{{ formatPrice(priceDetail.totalAmount) }}</text>
          <text v-else class="bp-main">￥{{ formatPrice(car.dailyPrice) }}<text class="bp-unit">/天</text></text>
        </view>
        <view class="bottom-btns">
          <view class="bottom-btn btn-cart" @tap="addToCart">
            <text class="btn-icon">+</text>
            <text class="btn-text">加入购物车</text>
          </view>
          <view
            class="bottom-btn btn-rent"
            :class="{ disabled: rentBtnDisabled }"
            @tap="rentNow"
          >
            {{ rentBtnText }}
          </view>
        </view>
      </view>
    </view>

    <!-- 加载失败 -->
    <view v-else class="empty-wrap">
      <view class="empty-icon">⚠</view>
      <view class="empty-text">车辆信息加载失败</view>
      <u-button text="返回" type="primary" shape="square" @click="goBack" />
    </view>
  </view>
</template>

<style scoped lang="scss">
.vehicle-detail-page {
  min-height: 100vh;
  background-color: var(--page-bg);
  padding-bottom: calc(160rpx + env(safe-area-inset-bottom));
}

.loading-wrap,
.empty-wrap {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 160rpx 0;
  gap: 24rpx;
}

.empty-icon {
  font-size: 96rpx;
}

.empty-text {
  font-size: 28rpx;
  color: var(--text-sub);
}

/* 主图 */
.main-image-wrap {
  position: relative;
  width: 100%;
  height: 500rpx;
  background-color: var(--card-bg);
}

.main-swiper {
  width: 100%;
  height: 100%;
}

.main-img {
  width: 100%;
  height: 100%;
}

.image-counter {
  position: absolute;
  right: 24rpx;
  bottom: 24rpx;
  padding: 4rpx 16rpx;
  background-color: rgba(0, 0, 0, 0.6);
  color: #fff;
  font-size: 22rpx;
  border-radius: 4rpx;
}

.car-status-tag {
  position: absolute;
  top: 24rpx;
  right: 24rpx;
  padding: 4rpx 16rpx;
  font-size: 22rpx;
  border-radius: 4rpx;
  font-weight: 500;
}

.status-available { background-color: #07c160; color: #fff; }
.status-rented { background-color: #ff9900; color: #fff; }
.status-maintenance { background-color: var(--text-dim); color: #fff; }

.car-tag {
  position: absolute;
  top: 24rpx;
  left: 24rpx;
  padding: 4rpx 16rpx;
  border-radius: 4rpx;
  font-size: 22rpx;
  font-weight: 700;
}

.tag-hot { background-color: #ff2e2e; color: #fff; }
.tag-rec { background-color: #d4af37; color: #1a1a1a; }

/* 缩略图 */
.thumbnail-row {
  padding: 16rpx 24rpx;
  background-color: var(--card-bg);
  border-bottom: 1rpx solid var(--border-color);
}

.thumbnail-list {
  display: inline-flex;
  gap: 12rpx;
}

.thumbnail {
  width: 96rpx;
  height: 96rpx;
  border-radius: 8rpx;
  overflow: hidden;
  border: 2rpx solid transparent;

  &.active {
    border-color: #ff2e2e;
  }
}

.thumbnail-img {
  width: 100%;
  height: 100%;
}

/* 核心信息 */
.info-card {
  padding: 32rpx 24rpx;
  background-color: var(--card-bg);
  margin-bottom: 16rpx;
}

.car-name {
  font-size: 40rpx;
  font-weight: 700;
  color: var(--text-main);
  line-height: 1.4;
  margin-bottom: 12rpx;
}

.car-meta {
  font-size: 26rpx;
  color: var(--text-sub);
  margin-bottom: 24rpx;
}

.car-stats {
  display: flex;
  align-items: center;
  padding: 24rpx 0;
  border-top: 1rpx solid var(--border-color);
  border-bottom: 1rpx solid var(--border-color);
}

.stat {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.stat-value {
  font-size: 32rpx;
  font-weight: 700;
  color: #ff5a3c;
}

.stat-label {
  font-size: 22rpx;
  color: var(--text-sub);
  margin-top: 4rpx;
}

/* 已租次数/天数分级徽标：high 着重、mid 次重、low 轻微 */
.rent-badge {
  font-style: normal;
  font-size: 32rpx;
  font-weight: 700;
  padding: 2rpx 16rpx;
  border-radius: 10rpx;
  line-height: 1.5;
}
.rent-high {
  color: #ffffff;
  background: linear-gradient(135deg, #ff2e2e, #d81e1e);
  box-shadow: 0 2rpx 8rpx rgba(255, 46, 46, 0.35);
}
.rent-mid {
  color: #8a4b00;
  background: #ffe9c2;
  border: 1rpx solid #ffc069;
}
.rent-low {
  color: #8f959e;
  background: #f0f2f5;
}

.rent-days-sub {
  font-style: normal;
  font-size: 20rpx;
  font-weight: 600;
  padding: 2rpx 12rpx;
  border-radius: 8rpx;
  margin-top: 6rpx;
  line-height: 1.5;
}

.stat-divider {
  width: 1rpx;
  height: 64rpx;
  background-color: var(--border-color);
}

.car-desc {
  font-size: 26rpx;
  color: var(--text-sub);
  line-height: 1.8;
  margin-top: 24rpx;
  padding-top: 24rpx;
  border-top: 1rpx solid var(--border-color);
}

/* 租车卡片 */
.rent-card {
  padding: 32rpx 24rpx;
  background-color: var(--card-bg);
  margin-bottom: 16rpx;
}

.rent-price-row {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  margin-bottom: 16rpx;
}

.rent-price {
  display: flex;
  align-items: baseline;
  gap: 16rpx;
}

.rent-price-main {
  font-size: 48rpx;
  font-weight: 800;
  color: #ff5a3c;
  line-height: 1;
}

.rent-price-unit {
  font-size: 24rpx;
  color: var(--text-sub);
  font-weight: 400;
}

.rent-price-loading {
  font-size: 28rpx;
  color: var(--text-sub);
}

.rent-days {
  font-size: 24rpx;
  color: var(--text-sub);
}

.price-tips {
  display: flex;
  flex-wrap: wrap;
  gap: 12rpx;
  margin-bottom: 24rpx;
}

.tip {
  font-size: 22rpx;
  padding: 4rpx 12rpx;
  border-radius: 4rpx;
}

.tip-discount { background-color: rgba(7, 193, 96, 0.18); color: #07c160; }
.tip-holiday { background-color: rgba(255, 153, 0, 0.18); color: #ff9900; }
.tip-rented { background-color: rgba(255, 46, 46, 0.18); color: #ff2e2e; }
/* 长租折扣静态提示（未选日期时展示） */
.tip-discount-static {
  display: inline-flex;
  margin-bottom: 12rpx;
  margin-right: 12rpx;
  background-color: rgba(255, 46, 46, 0.1);
  color: #ff2e2e;
  font-weight: 500;
}
/* 月租折扣不可达提示 */
.tip-monthly-unavailable {
  display: inline-flex;
  margin-bottom: 12rpx;
  margin-right: 12rpx;
  background-color: rgba(174, 174, 178, 0.12);
  color: var(--text-sub);
}

/* 最大租期着重展示 */
.max-rent-tip {
  display: flex;
  align-items: center;
  gap: 8rpx;
  margin-bottom: 16rpx;
  padding: 10rpx 20rpx;
  border-radius: 8rpx;
  background: linear-gradient(135deg, #ff2e2e, #d81e1e);
  box-shadow: 0 4rpx 16rpx rgba(255, 46, 46, 0.35);
}
.max-rent-tip-icon {
  font-size: 26rpx;
  line-height: 1;
}
.max-rent-tip-text {
  font-size: 26rpx;
  font-weight: 700;
  color: #ffffff;
  letter-spacing: 1rpx;
}
/* 不限租期：绿色弱化 */
.max-rent-tip.unlimited {
  background: rgba(7, 193, 96, 0.12);
  box-shadow: none;
}
.max-rent-tip.unlimited .max-rent-tip-text {
  color: #07c160;
  font-weight: 500;
}

.date-pick-section {
  padding: 24rpx 0;
  border-top: 1rpx solid var(--border-color);
}

.date-pick-title {
  font-size: 28rpx;
  color: var(--text-main);
  font-weight: 500;
  margin-bottom: 16rpx;
}

.date-pick-row {
  display: flex;
  align-items: center;
  gap: 16rpx;
}

.date-pick-item {
  flex: 1;
  padding: 16rpx;
  background-color: var(--border-color);
  border-radius: 8rpx;
}

.date-label {
  font-size: 22rpx;
  color: var(--text-dim);
  margin-bottom: 4rpx;
}

.date-value {
  font-size: 26rpx;
  color: var(--text-main);

  &.placeholder {
    color: var(--text-dim);
  }
}

.date-arrow {
  font-size: 28rpx;
  color: var(--text-sub);
}

.quick-pick-row {
  display: flex;
  gap: 12rpx;
  margin-top: 16rpx;
}

.quick-pick {
  flex: 1;
  padding: 12rpx 0;
  text-align: center;
  font-size: 24rpx;
  color: var(--text-main);
  background-color: var(--border-color);
  border-radius: 8rpx;
  border: 1rpx solid var(--border-color);

  &.active {
    background-color: rgba(255, 46, 46, 0.12);
    border-color: #ff2e2e;
    color: #ff2e2e;
  }

  &.disabled {
    color: var(--text-dim);
  }
}

.rent-days-tip {
  font-size: 24rpx;
  color: #07c160;
  margin-top: 12rpx;

  &.invalid {
    color: #ff2e2e;
  }
}

.price-detail {
  margin-top: 24rpx;
  padding: 16rpx 24rpx;
  background-color: var(--border-color);
  border-radius: 8rpx;
  border-left: 4rpx solid #ff2e2e;
}

.detail-row {
  display: flex;
  justify-content: space-between;
  font-size: 24rpx;
  color: var(--text-sub);
  padding: 4rpx 0;

  &.discount {
    color: #07c160;
  }

  &.total {
    margin-top: 8rpx;
    padding-top: 12rpx;
    border-top: 1rpx dashed var(--border-color);
    color: var(--text-main);
    font-weight: 600;
    font-size: 28rpx;
  }
}

.price-failed-tip {
  font-size: 24rpx;
  color: #ff2e2e;
  margin-top: 16rpx;
  text-align: center;
}

/* 配置块 */
.config-section {
  padding: 32rpx 24rpx;
  background-color: var(--card-bg);
  margin-bottom: 16rpx;
}

.section-title {
  font-size: 32rpx;
  font-weight: 600;
  color: var(--text-main);
  margin-bottom: 24rpx;
}

.config-tabs {
  display: flex;
  gap: 8rpx;
  margin-bottom: 24rpx;
  overflow-x: auto;
}

.config-tab {
  flex-shrink: 0;
  padding: 12rpx 24rpx;
  font-size: 24rpx;
  color: var(--text-sub);
  background-color: var(--border-color);
  border-radius: 8rpx;

  &.active {
    background-color: #ff2e2e;
    color: #fff;
  }
}

.config-list {
  display: flex;
  flex-direction: column;
}

.config-item {
  display: flex;
  justify-content: space-between;
  padding: 16rpx 0;
  border-bottom: 1rpx solid var(--border-color);
}

.config-name {
  font-size: 26rpx;
  color: var(--text-sub);
}

.config-value {
  font-size: 26rpx;
  color: var(--text-main);
  font-weight: 500;
}

.config-empty {
  padding: 32rpx 0;
  text-align: center;
  color: var(--text-dim);
  font-size: 26rpx;
}

/* 素材照片 */
.materials-section {
  padding: 32rpx 24rpx;
  background-color: var(--card-bg);
  margin-bottom: 16rpx;
}

.material-group {
  margin-bottom: 32rpx;
}

.material-title {
  font-size: 28rpx;
  color: var(--text-main);
  font-weight: 500;
  margin-bottom: 16rpx;
}

.material-images {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 12rpx;
}

.material-img {
  width: 100%;
  height: 200rpx;
  border-radius: 8rpx;
}

/* 底部操作栏
   说明：根元素 .vehicle-detail-page 已用 padding-bottom: calc(160rpx + env(safe-area-inset-bottom))
   预留了固定操作栏的高度，页面内容不会被遮挡，因此无需额外的占位元素。 */
.bottom-bar {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  height: calc(140rpx + env(safe-area-inset-bottom));
  padding-bottom: env(safe-area-inset-bottom);
  background-color: var(--card-bg);
  border-top: 1rpx solid var(--border-color);
  display: flex;
  align-items: center;
  padding-left: 24rpx;
  padding-right: 24rpx;
  box-sizing: border-box;
  z-index: 100;
}

/* 购物车悬浮按钮（半透明、小尺寸、可拖拽；位置由脚本以 left/top 控制，避开底部操作栏） */
.float-cart {
  position: fixed;
  z-index: 200;
  width: 56px;
  height: 56px;
  border-radius: 50%;
  background-color: rgba(24, 24, 26, 0.72);
  border: 1px solid rgba(255, 255, 255, 0.14);
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.35);
}

.float-cart-icon {
  font-size: 26px;
  line-height: 1;
}

.float-cart-badge {
  position: absolute;
  top: -4px;
  right: -4px;
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  border-radius: 9px;
  background-color: #ff2e2e;
  color: #ffffff;
  font-size: 11px;
  font-weight: 700;
  line-height: 18px;
  text-align: center;
  box-sizing: border-box;
}

.bottom-price {
  flex: 0 0 auto;
  margin-right: 20rpx;
  min-width: 0;
  display: flex;
  align-items: baseline;
  white-space: nowrap;
}

.bp-main {
  font-size: 40rpx;
  font-weight: 800;
  color: #ff5a3c;
  line-height: 1;
}

.bp-unit {
  font-size: 22rpx;
  color: var(--text-sub);
  font-weight: 400;
  margin-left: 4rpx;
}

.bottom-btns {
  flex: 1 1 auto;
  min-width: 0;
  display: flex;
  gap: 16rpx;
}

.bottom-btn {
  flex: 1 1 0;
  height: 84rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 28rpx;
  font-weight: 500;
  border-radius: 44rpx;
}

.btn-cart {
  background-color: rgba(255, 46, 46, 0.12);
  color: #ff2e2e;
  border: 1rpx solid #ff2e2e;

  .btn-icon {
    margin-right: 8rpx;
    font-size: 32rpx;
  }
}

.btn-rent {
  background-color: #ff2e2e;
  color: #fff;

  &.disabled {
    background-color: var(--border-color);
    color: var(--text-dim);
  }
}
</style>
