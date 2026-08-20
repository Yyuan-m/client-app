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
import { onLoad, onUnload } from '@dcloudio/uni-app'
import { useAppStore } from '@/stores/app'
import { useUserStore } from '@/stores/user'
import { useCartStore } from '@/stores/cart'
import { getCarDetailApi, getCarImagesApi } from '@/api/modules/car'
import { calcCarPriceApi } from '@/api/modules/price'
import { resolveAdminImage } from '@/utils/image'
import { moneyUtil, dateUtil, validators } from '@/utils'
import type { CarDetailVO, CarImageGroupVO, PriceDetailVO, CarConfigVO } from '@/api/types'

const appStore = useAppStore()
const userStore = useUserStore()
const cartStore = useCartStore()

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
const maxRentDays = 20
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
  const r = dateUtil.validateRentDays(dateRange.start, dateRange.end, minRentDays.value, maxRentDays)
  return r.valid
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
  if (days < minRentDays.value || days > maxRentDays) return
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
    uni.showToast({ title: `请选择有效租期（${minRentDays.value}-${maxRentDays}天）`, icon: 'none' })
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
  if (!rentDaysValid.value) {
    uni.showToast({ title: `请选择有效租期（${minRentDays.value}-${maxRentDays}天）`, icon: 'none' })
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
</script>

<template>
  <view class="vehicle-detail-page">
    <!-- 加载中 -->
    <view v-if="loading" class="loading-wrap">
      <u-loading-icon mode="circle" text="加载中..." />
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
            <text class="stat-value">{{ car.rentCount || 0 }}</text>
            <text class="stat-label">出租次数</text>
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
              v-for="d in [3, 7, 15, 20]"
              :key="d"
              class="quick-pick"
              :class="{ disabled: d < minRentDays || d > maxRentDays, active: rentDays === d }"
              @tap="() => quickPickDays(d)"
            >
              {{ d }}天
            </view>
          </view>
          <!-- 租期提示 -->
          <view v-if="dateRange.start && dateRange.end" class="rent-days-tip" :class="{ invalid: !rentDaysValid }">
            <text v-if="rentDaysValid">租期 {{ rentDays }} 天</text>
            <text v-else>租期无效（最少 {{ minRentDays }} 天，最多 {{ maxRentDays }} 天）</text>
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

      <!-- 底部操作栏占位 -->
      <view class="bottom-placeholder"></view>

      <!-- 底部操作栏 -->
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
  background-color: #0a0a0a;
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
  color: #aeaeb2;
}

/* 主图 */
.main-image-wrap {
  position: relative;
  width: 100%;
  height: 500rpx;
  background-color: #1a1a1a;
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
.status-maintenance { background-color: #6e6e73; color: #fff; }

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
  background-color: #1a1a1a;
  border-bottom: 1rpx solid #2a2a2a;
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
  background-color: #1a1a1a;
  margin-bottom: 16rpx;
}

.car-name {
  font-size: 40rpx;
  font-weight: 700;
  color: #f5f5f5;
  line-height: 1.4;
  margin-bottom: 12rpx;
}

.car-meta {
  font-size: 26rpx;
  color: #aeaeb2;
  margin-bottom: 24rpx;
}

.car-stats {
  display: flex;
  align-items: center;
  padding: 24rpx 0;
  border-top: 1rpx solid #2a2a2a;
  border-bottom: 1rpx solid #2a2a2a;
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
  color: #aeaeb2;
  margin-top: 4rpx;
}

.stat-divider {
  width: 1rpx;
  height: 64rpx;
  background-color: #2a2a2a;
}

.car-desc {
  font-size: 26rpx;
  color: #d1d1d6;
  line-height: 1.8;
  margin-top: 24rpx;
  padding-top: 24rpx;
  border-top: 1rpx solid #2a2a2a;
}

/* 租车卡片 */
.rent-card {
  padding: 32rpx 24rpx;
  background-color: #1a1a1a;
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
  color: #aeaeb2;
  font-weight: 400;
}

.rent-price-loading {
  font-size: 28rpx;
  color: #aeaeb2;
}

.rent-days {
  font-size: 24rpx;
  color: #aeaeb2;
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

.date-pick-section {
  padding: 24rpx 0;
  border-top: 1rpx solid #2a2a2a;
}

.date-pick-title {
  font-size: 28rpx;
  color: #f5f5f5;
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
  background-color: #2a2a2a;
  border-radius: 8rpx;
}

.date-label {
  font-size: 22rpx;
  color: #6e6e73;
  margin-bottom: 4rpx;
}

.date-value {
  font-size: 26rpx;
  color: #f5f5f5;

  &.placeholder {
    color: #6e6e73;
  }
}

.date-arrow {
  font-size: 28rpx;
  color: #aeaeb2;
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
  color: #f5f5f5;
  background-color: #2a2a2a;
  border-radius: 8rpx;
  border: 1rpx solid #2a2a2a;

  &.active {
    background-color: rgba(255, 46, 46, 0.12);
    border-color: #ff2e2e;
    color: #ff2e2e;
  }

  &.disabled {
    color: #4a4a4a;
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
  background-color: #2a2a2a;
  border-radius: 8rpx;
  border-left: 4rpx solid #ff2e2e;
}

.detail-row {
  display: flex;
  justify-content: space-between;
  font-size: 24rpx;
  color: #aeaeb2;
  padding: 4rpx 0;

  &.discount {
    color: #07c160;
  }

  &.total {
    margin-top: 8rpx;
    padding-top: 12rpx;
    border-top: 1rpx dashed #4a4a4a;
    color: #f5f5f5;
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
  background-color: #1a1a1a;
  margin-bottom: 16rpx;
}

.section-title {
  font-size: 32rpx;
  font-weight: 600;
  color: #f5f5f5;
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
  color: #aeaeb2;
  background-color: #2a2a2a;
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
  border-bottom: 1rpx solid #2a2a2a;
}

.config-name {
  font-size: 26rpx;
  color: #aeaeb2;
}

.config-value {
  font-size: 26rpx;
  color: #f5f5f5;
  font-weight: 500;
}

.config-empty {
  padding: 32rpx 0;
  text-align: center;
  color: #6e6e73;
  font-size: 26rpx;
}

/* 素材照片 */
.materials-section {
  padding: 32rpx 24rpx;
  background-color: #1a1a1a;
  margin-bottom: 16rpx;
}

.material-group {
  margin-bottom: 32rpx;
}

.material-title {
  font-size: 28rpx;
  color: #f5f5f5;
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

/* 底部操作栏 */
.bottom-placeholder {
  height: 160rpx;
}

.bottom-bar {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  height: calc(140rpx + env(safe-area-inset-bottom));
  padding-bottom: env(safe-area-inset-bottom);
  background-color: #1a1a1a;
  border-top: 1rpx solid #2a2a2a;
  display: flex;
  align-items: center;
  padding-left: 24rpx;
  z-index: 100;
}

.bottom-price {
  flex: 0 0 auto;
  margin-right: 24rpx;
}

.bp-main {
  font-size: 40rpx;
  font-weight: 800;
  color: #ff5a3c;
}

.bp-unit {
  font-size: 22rpx;
  color: #aeaeb2;
  font-weight: 400;
}

.bottom-btns {
  flex: 1;
  display: flex;
  gap: 16rpx;
}

.bottom-btn {
  flex: 1;
  height: 88rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 28rpx;
  font-weight: 500;
  border-radius: 8rpx;
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
    background-color: #2a2a2a;
    color: #6e6e73;
  }
}
</style>
