<script setup lang="ts">
/**
 * 订单详情页 - 5 分钟支付倒计时
 *
 * onLoad: 接收 options.id，loadDetail
 * API: getOrderDetailApi / cancelOrderApi / payOrderApi / completeOrderApi
 * 倒计时：PAY_TIMEOUT = 5 * 60 * 1000；expired = createTime + PAY_TIMEOUT
 * setInterval(update, 1000)；到 0 提示超时 + loadDetail；onUnload 清理
 * 状态驱动操作：
 *   - pending：立即支付（倒计时为 0 时禁用）、取消订单
 *   - renting：续租（跳 /pages/vehicle/detail?id=carId）、确认还车
 *   - completed：去评价（openReviewDialog）/ 去追评
 */
import { ref, computed, onUnmounted } from 'vue'
import { onLoad, onUnload } from '@dcloudio/uni-app'
import { getOrderDetailApi, cancelOrderApi, payOrderApi, completeOrderApi } from '@/api/modules/order'
import { resolveAdminImage } from '@/utils/image'
import { moneyUtil, dateUtil } from '@/utils'
import type { OrderVO, OrderStatus } from '@/api/types'
import { useThemeClass } from '@/composables/useThemeClass'
import { useNavigationBar } from '@/composables/useNavigationBar'
import { useUserStore } from '@/stores/user'

const { themeClass, appStore } = useThemeClass()
/** 加载动画颜色：随深浅主题切换 */
const loadingColor = computed(() => (appStore.isDark ? '#aeaeb2' : '#6e6e73'))
/** 原生导航栏随主题切换 */
useNavigationBar()

const PAY_TIMEOUT = 5 * 60 * 1000

const orderId = ref<number | string>('')
const order = ref<OrderVO | null>(null)
const loading = ref(true)
const submitting = ref(false)

// 支付倒计时
const countdown = ref(0)
let countdownTimer: ReturnType<typeof setInterval> | null = null

// 确认弹窗
const showCancelModal = ref(false)
const showPayModal = ref(false)
const showCompleteModal = ref(false)

// 评价弹窗
const reviewVisible = ref(false)
const reviewRound = ref<1 | 2 | null>(null)

onLoad((options: Record<string, string> | undefined) => {
  const opts = options || {}
  if (!opts.id) {
    uni.showToast({ title: '参数错误', icon: 'none' })
    setTimeout(() => uni.navigateBack({ delta: 1 }), 800)
    return
  }
  orderId.value = opts.id
  loadDetail()
})

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

async function loadDetail() {
  loading.value = true
  try {
    order.value = await getOrderDetailApi(orderId.value)
    // 状态驱动：pending 启动倒计时
    if (order.value && order.value.status === 'pending' && order.value.createTime) {
      startCountdown(order.value.createTime)
    } else {
      clearCountdown()
    }
  } catch (e) {
    console.error('[order.detail] load failed:', e)
    uni.showToast({ title: '加载失败', icon: 'none' })
  } finally {
    loading.value = false
  }
}

function startCountdown(createTime: string) {
  clearCountdown()
  const start = new Date(createTime).getTime()
  if (isNaN(start)) {
    countdown.value = 0
    return
  }
  const expired = start + PAY_TIMEOUT
  const update = () => {
    const now = Date.now()
    const remain = expired - now
    if (remain <= 0) {
      countdown.value = 0
      clearCountdown()
      uni.showToast({ title: '支付超时，订单已自动取消', icon: 'none', duration: 2000 })
      setTimeout(() => loadDetail(), 1000)
      return
    }
    countdown.value = remain
  }
  update()
  countdownTimer = setInterval(update, 1000)
}

const countdownText = computed(() => {
  const sec = Math.ceil(countdown.value / 1000)
  const mm = Math.floor(sec / 60).toString().padStart(2, '0')
  const ss = (sec % 60).toString().padStart(2, '0')
  return `${mm}:${ss}`
})

const countdownExpired = computed(() => countdown.value <= 0)

// 状态操作按钮文案
const payBtnText = computed(() => {
  if (countdownExpired.value) return '支付超时'
  return `立即支付 ${countdownText.value}`
})

// 是否可评价
const canReview = computed(() => {
  if (!order.value) return false
  return order.value.status === 'completed' && order.value.reviewStatus !== 're-reviewed'
})

const reviewBtnText = computed(() => {
  if (!order.value) return ''
  if (order.value.reviewStatus === 'unreviewed') return '去评价'
  if (order.value.reviewStatus === 'reviewed') return '去追评'
  return '已评价'
})

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
  if (s === 'unreviewed') return '未评价'
  if (s === 'reviewed') return '已评价'
  if (s === 're-reviewed') return '已追评'
  return '—'
}

function formatPrice(p: number | string | null | undefined): string {
  return moneyUtil.format(Number(p || 0))
}

function formatTime(t?: string): string {
  if (!t) return '—'
  return dateUtil.format(t, 'YYYY-MM-DD HH:mm')
}

// 操作
function showCancelConfirm() {
  showCancelModal.value = true
}

async function confirmCancel() {
  showCancelModal.value = false
  submitting.value = true
  try {
    await cancelOrderApi(orderId.value)
    uni.showToast({ title: '取消成功', icon: 'success' })
    await loadDetail()
  } catch (e) {
    console.error('[order.detail] cancel failed:', e)
  } finally {
    submitting.value = false
  }
}

function showPayConfirm() {
  if (countdownExpired.value) {
    uni.showToast({ title: '支付已超时', icon: 'none' })
    return
  }
  showPayModal.value = true
}

async function confirmPay() {
  showPayModal.value = false
  submitting.value = true
  try {
    await payOrderApi(orderId.value)
    uni.showToast({ title: '支付成功', icon: 'success' })
    await loadDetail()
  } catch (e) {
    console.error('[order.detail] pay failed:', e)
  } finally {
    submitting.value = false
  }
}

function goRentContinue() {
  if (!order.value?.carId) return
  uni.navigateTo({ url: `/pages/vehicle/detail?id=${order.value.carId}` })
}

/** 投诉：带订单号跳转投诉页预填 */
function goComplaint() {
  const no = order.value?.orderNo || ''
  uni.navigateTo({ url: `/pages/profile/complaint${no ? '?orderNo=' + encodeURIComponent(no) : ''}` })
}

function showCompleteConfirm() {
  showCompleteModal.value = true
}

async function confirmComplete() {
  showCompleteModal.value = false
  submitting.value = true
  try {
    await completeOrderApi(orderId.value)
    uni.showToast({ title: '还车成功', icon: 'success' })
    await loadDetail()
    // 订单完成会触发后端重算会员等级，刷新用户信息以便升级动画及时感知
    try {
      await useUserStore().fetchUserInfo()
    } catch (e) {
      console.error('[order.detail] fetchUserInfo failed:', e)
    }
  } catch (e) {
    console.error('[order.detail] complete failed:', e)
  } finally {
    submitting.value = false
  }
}

// 评价
function openReviewDialog() {
  if (!order.value) return
  reviewRound.value = order.value.reviewStatus === 'unreviewed' ? 1 : order.value.reviewStatus === 'reviewed' ? 2 : null
  if (reviewRound.value == null) {
    uni.showToast({ title: '已无可评价轮次', icon: 'none' })
    return
  }
  reviewVisible.value = true
}

function onReviewSuccess() {
  reviewVisible.value = false
  uni.showToast({ title: '评价成功', icon: 'success' })
  loadDetail()
}

function goOrderList() {
  uni.redirectTo({ url: '/pages/order/list' })
}
</script>

<template>
  <view class="order-detail-page" :class="themeClass">
    <view v-if="loading" class="loading-wrap">
      <u-loading-icon mode="circle" text="加载中..." :color="loadingColor" :textColor="loadingColor" />
    </view>

    <view v-else-if="order" class="detail-content">
      <!-- 状态卡片 -->
      <view class="status-card">
        <view class="status-row">
          <view class="status-text" :class="statusClass(order.status)">{{ statusText(order.status) }}</view>
          <view v-if="order.status === 'pending' && !countdownExpired" class="countdown-tip">
            剩余支付时间：{{ countdownText }}
          </view>
        </view>
        <view v-if="order.status === 'pending' && countdownExpired" class="expired-tip">
          支付已超时，订单将自动取消
        </view>
      </view>

      <!-- 车辆信息（一个订单可含多辆车，依次往下排列） -->
      <view class="section-label" v-if="order.items && order.items.length">
        车辆信息
        <text class="section-count">{{ order.items.length }} 辆</text>
      </view>
      <view v-if="order.items && order.items.length" class="car-list">
        <view v-for="item in order.items" :key="item.id" class="card car-card">
          <image :src="resolveAdminImage(item.carCover || '')" mode="aspectFill" class="car-img" lazy-load />
          <view class="car-info">
            <view class="car-name">{{ item.carName }}</view>
            <view class="rent-period">{{ item.startDate }} 至 {{ item.endDate }}</view>
            <view v-if="item.days" class="rent-days">租期 {{ item.days }} 天</view>
            <view class="rent-price">
              日租金 ￥{{ formatPrice(item.dailyPrice) }}/天 · 小计 ￥{{ formatPrice(item.rentAmount) }}
            </view>
            <view v-if="Number(item.discountAmount || 0) > 0" class="rent-discount">
              优惠 -￥{{ formatPrice(item.discountAmount) }}
            </view>
            <view class="rent-total">应付 ￥{{ formatPrice(item.totalAmount) }}</view>
          </view>
        </view>
      </view>
      <!-- 兼容历史一车一单：无明细时展示主订单首车 -->
      <view v-else-if="order" class="card car-card">
        <image :src="resolveAdminImage(order.carCover || '')" mode="aspectFill" class="car-img" lazy-load />
        <view class="car-info">
          <view class="car-name">{{ order.carName }}</view>
          <view class="rent-period">{{ order.startDate }} 至 {{ order.endDate }}</view>
          <view v-if="order.days" class="rent-days">租期 {{ order.days }} 天</view>
          <view v-if="order.store" class="order-store">门店：{{ order.store }}</view>
          <view v-if="order.city" class="order-city">城市：{{ order.city }}</view>
        </view>
      </view>

      <!-- 订单信息 -->
      <view class="card info-card">
        <view class="info-row">
          <text class="info-label">订单号</text>
          <text class="info-value">{{ order.orderNo || order.id }}</text>
        </view>
        <view class="info-row">
          <text class="info-label">下单时间</text>
          <text class="info-value">{{ formatTime(order.createTime) }}</text>
        </view>
        <view v-if="order.payTime" class="info-row">
          <text class="info-label">支付时间</text>
          <text class="info-value">{{ formatTime(order.payTime) }}</text>
        </view>
        <view class="info-row">
          <text class="info-label">日租金</text>
          <text class="info-value">￥{{ formatPrice(order.dailyPrice) }}/天</text>
        </view>
        <view class="info-row">
          <text class="info-label">租金合计</text>
          <text class="info-value">￥{{ formatPrice(order.rentAmount) }}</text>
        </view>
        <view v-if="Number(order.couponAmount || 0) > 0" class="info-row discount">
          <text class="info-label">优惠券抵扣</text>
          <text class="info-value">-￥{{ formatPrice(order.couponAmount) }}</text>
        </view>
        <view class="info-row total">
          <text class="info-label">券后应付</text>
          <text class="info-value text-price">￥{{ formatPrice(order.totalAmount) }}</text>
        </view>
        <view class="info-row">
          <text class="info-label">评价状态</text>
          <text class="info-value">{{ reviewStatusText(order.reviewStatus) }}</text>
        </view>
      </view>

      <!-- 操作按钮 -->
      <view class="actions">
        <template v-if="order.status === 'pending'">
          <view class="action-btn btn-cancel" @tap="showCancelConfirm">取消订单</view>
          <view
            class="action-btn btn-pay"
            :class="{ disabled: countdownExpired || submitting }"
            @tap="showPayConfirm"
          >
            {{ payBtnText }}
          </view>
        </template>
        <template v-else-if="order.status === 'renting'">
          <view class="action-btn btn-continue" @tap="goRentContinue">续租</view>
          <view class="action-btn btn-complete" :class="{ disabled: submitting }" @tap="showCompleteConfirm">
            确认还车
          </view>
          <view class="action-btn btn-complaint" @tap="goComplaint">投诉</view>
        </template>
        <template v-else-if="order.status === 'completed'">
          <view v-if="canReview" class="action-btn btn-review" @tap="openReviewDialog">
            {{ reviewBtnText }}
          </view>
          <view v-else class="action-btn btn-disabled">{{ reviewBtnText }}</view>
          <view class="action-btn btn-complaint" @tap="goComplaint">投诉</view>
        </template>
        <template v-else>
          <view class="action-tip">订单已取消</view>
        </template>
      </view>
    </view>

    <view v-else class="empty-wrap">
      <view class="empty-icon">⚠</view>
      <view class="empty-text">订单不存在或已删除</view>
      <u-button text="返回列表" type="primary" shape="square" @click="goOrderList" />
    </view>

    <!-- 评价弹窗（占位：由通用组件 ReviewDialog 实现，这里通过 visible 状态控制简单表单） -->
    <ReviewDialog v-model="reviewVisible" :order-id="orderId" @success="onReviewSuccess" />

    <!-- 取消订单确认 -->
    <u-modal
      :show="showCancelModal"
      title="取消订单"
      content="确定要取消该订单吗？取消后无法恢复。"
      @confirm="confirmCancel"
      @cancel="() => { showCancelModal = false }"
      :showCancelButton="true"
    />

    <!-- 支付确认 -->
    <u-modal
      :show="showPayModal"
      title="确认支付"
      :content="`确认支付 ￥${order ? formatPrice(order.totalAmount) : ''} 完成订单支付？`"
      @confirm="confirmPay"
      @cancel="() => { showPayModal = false }"
      :showCancelButton="true"
    />

    <!-- 确认还车 -->
    <u-modal
      :show="showCompleteModal"
      title="确认还车"
      content="确认已还车？还车后订单将进入已完成状态。"
      @confirm="confirmComplete"
      @cancel="() => { showCompleteModal = false }"
      :showCancelButton="true"
    />
    <!-- 会员升级蒙层动画（等级突破档位时展示一次） -->
    <LevelUpOverlay />
  </view>
</template>

<style scoped lang="scss">
.order-detail-page {
  min-height: 100vh;
  background-color: var(--page-bg);
  padding: 24rpx 24rpx calc(48rpx + env(safe-area-inset-bottom));
}

.loading-wrap,
.empty-wrap {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 160rpx 0;
  gap: 16rpx;
}

.empty-icon {
  font-size: 96rpx;
}

.empty-text {
  font-size: 28rpx;
  color: var(--text-sub);
}

/* 状态卡片 */
.status-card {
  padding: 32rpx 24rpx;
  background-color: var(--card-bg);
  border-radius: 16rpx;
  margin-bottom: 24rpx;
  border: 1rpx solid var(--border-color);
}

.status-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.status-text {
  font-size: 40rpx;
  font-weight: 700;
}

.status-pending { color: #ff9900; }
.status-renting { color: #ff2e2e; }
.status-completed { color: #07c160; }
.status-cancelled { color: var(--text-dim); }

.countdown-tip {
  font-size: 26rpx;
  color: #ff9900;
}

.expired-tip {
  margin-top: 12rpx;
  font-size: 24rpx;
  color: #ff2e2e;
}

/* 车辆信息区块标题 */
.section-label {
  display: flex;
  align-items: center;
  gap: 12rpx;
  font-size: 32rpx;
  font-weight: 600;
  color: var(--text-main);
  margin-bottom: 16rpx;
}

.section-count {
  font-size: 22rpx;
  font-weight: 400;
  color: var(--text-sub);
  background-color: var(--border-color);
  padding: 2rpx 12rpx;
  border-radius: 30rpx;
}

/* 多车列表：依次往下排列 */
.car-list {
  display: flex;
  flex-direction: column;
  gap: 20rpx;
  margin-bottom: 24rpx;
}

/* 车辆卡片 */
.car-card {
  display: flex;
  padding: 24rpx;
  border-radius: 16rpx;
  border: 1rpx solid var(--border-color);
  background-color: var(--card-bg);
}

.car-img {
  width: 200rpx;
  height: 150rpx;
  border-radius: 8rpx;
  flex-shrink: 0;
  background-color: var(--border-color);
}

.car-info {
  flex: 1;
  min-width: 0;
  padding-left: 24rpx;
}

.car-name {
  font-size: 32rpx;
  font-weight: 600;
  color: var(--text-main);
  margin-bottom: 12rpx;
}

.rent-period,
.rent-days,
.order-store,
.order-city {
  font-size: 22rpx;
  color: var(--text-sub);
  margin-bottom: 4rpx;
}

.rent-price {
  font-size: 22rpx;
  color: var(--text-sub);
  margin-top: 8rpx;
}

.rent-discount {
  font-size: 22rpx;
  color: #07c160;
}

.rent-total {
  font-size: 26rpx;
  font-weight: 600;
  color: var(--text-main);
}

/* 订单信息 */
.info-card {
  padding: 24rpx;
}

.info-row {
  display: flex;
  justify-content: space-between;
  padding: 12rpx 0;
  border-bottom: 1rpx solid var(--border-color);
  font-size: 26rpx;

  &:last-child {
    border-bottom: none;
  }

  &.discount {
    color: #07c160;
  }

  &.total {
    margin-top: 8rpx;
    padding-top: 16rpx;
    border-top: 1rpx solid var(--border-color);
    border-bottom: none;
    font-weight: 600;
    font-size: 30rpx;
  }
}

.info-label {
  color: var(--text-sub);
}

.info-value {
  color: var(--text-main);
  font-weight: 500;
}

/* 操作按钮 */
.actions {
  display: flex;
  flex-wrap: wrap;
  gap: 24rpx;
  margin-top: 32rpx;
}

.action-btn {
  flex: 1;
  min-width: 240rpx;
  height: 88rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 28rpx;
  font-weight: 500;
  border-radius: 8rpx;

  &.disabled {
    opacity: 0.5;
  }
}

.btn-cancel {
  background-color: var(--border-color);
  color: var(--text-main);
  border: 1rpx solid var(--border-color);
}

.btn-pay {
  background-color: #ff2e2e;
  color: #fff;
}

.btn-continue {
  background-color: rgba(255, 46, 46, 0.12);
  color: #ff2e2e;
  border: 1rpx solid #ff2e2e;
}

.btn-complete {
  background-color: #ff2e2e;
  color: #fff;
}

.btn-review {
  background-color: #ff2e2e;
  color: #fff;
}

.btn-complaint {
  background-color: rgba(255, 46, 46, 0.12);
  color: #ff2e2e;
  border: 1rpx solid #ff2e2e;
}

.btn-disabled {
  background-color: var(--border-color);
  color: var(--text-dim);
}

.action-tip {
  width: 100%;
  text-align: center;
  padding: 48rpx 0;
  font-size: 26rpx;
  color: var(--text-dim);
}
</style>
