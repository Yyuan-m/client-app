<script setup lang="ts">
/**
 * 我的评价 - 可评价/可追评订单列表
 *
 * 展示待评价（unreviewed）与已评价可追评（reviewed）的订单，点击进入订单详情发表评价
 * API: getReviewableOrdersApi
 */
import { ref, computed } from 'vue'
import { onShow, onPullDownRefresh } from '@dcloudio/uni-app'
import { getReviewableOrdersApi } from '@/api/modules/order'
import { resolveAdminImage } from '@/utils/image'
import { moneyUtil } from '@/utils'
import { useThemeClass } from '@/composables/useThemeClass'
import { useNavigationBar } from '@/composables/useNavigationBar'
import type { OrderVO } from '@/api/types'

const { themeClass, appStore } = useThemeClass()
/** 原生导航栏随主题切换 */
useNavigationBar()
/** 空状态图标颜色：随主题切换 */
const dimIcon = computed(() => (appStore.isDark ? '#6e6e73' : '#d1d1d6'))

type OrderWithImg = OrderVO & { imgError?: boolean }

const orders = ref<OrderWithImg[]>([])
const loading = ref(true)

onShow(() => loadOrders())

onPullDownRefresh(async () => {
  await loadOrders()
  uni.stopPullDownRefresh()
})

async function loadOrders() {
  loading.value = true
  try {
    orders.value = ((await getReviewableOrdersApi()) as OrderWithImg[]) || []
  } catch (e) {
    console.error('[reviews] load failed:', e)
    orders.value = []
  } finally {
    loading.value = false
  }
}

function goOrderDetail(order: OrderVO) {
  uni.navigateTo({ url: `/pages/order/detail?id=${order.id}` })
}

function goOrderList() {
  uni.navigateTo({ url: '/pages/order/list' })
}

function reviewStatusText(s?: string): string {
  if (s === 'unreviewed') return '待评价'
  if (s === 'reviewed') return '可追评'
  return '—'
}

function formatPrice(p: number | null | undefined): string {
  return moneyUtil.format(Number(p || 0))
}

function onImgError(order: OrderWithImg): void {
  order.imgError = true
}
</script>

<template>
  <view class="reviews-page" :class="themeClass">
    <view v-if="orders.length" class="reviews-list">
      <view v-for="order in orders" :key="order.id" class="review-card" @tap="goOrderDetail(order)">
        <view class="card-header">
          <view class="review-status" :class="order.reviewStatus === 'unreviewed' ? 's-unreviewed' : 's-reviewed'">
            {{ reviewStatusText(order.reviewStatus) }}
          </view>
          <view class="order-time">{{ order.endDate }}</view>
        </view>
        <view class="review-body">
          <image v-if="!order.imgError" :src="resolveAdminImage(order.carCover || '')" mode="aspectFill" class="car-img" lazy-load @error="onImgError(order)" />
          <view v-else class="car-img"></view>
          <view class="review-info">
            <view class="car-name">{{ order.carName }}</view>
            <view class="rent-period">{{ order.startDate }} 至 {{ order.endDate }}</view>
            <view class="order-amount">￥{{ formatPrice(order.totalAmount) }}</view>
          </view>
          <view class="review-action">{{ order.reviewStatus === 'unreviewed' ? '去评价' : '去追评' }} ›</view>
        </view>
      </view>
      <view class="view-all-btn" @tap="goOrderList">查看全部订单 ›</view>
    </view>

    <view v-else-if="!loading" class="empty-state">
      <u-icon name="star" :color="dimIcon" size="96rpx"></u-icon>
      <view class="empty-text">暂无可评价订单</view>
      <view class="empty-sub">完成租车订单后即可发表评价</view>
    </view>
  </view>
</template>

<style scoped lang="scss">
.reviews-page {
  min-height: 100vh;
  background-color: var(--page-bg);
  padding: 24rpx;
  box-sizing: border-box;
}

.reviews-list {
  display: flex;
  flex-direction: column;
}

.review-card {
  background-color: var(--card-bg);
  border-radius: 16rpx;
  padding: 24rpx;
  margin-bottom: 16rpx;
  border: 1rpx solid var(--border-color);
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-bottom: 16rpx;
  margin-bottom: 16rpx;
  border-bottom: 1rpx solid var(--border-color);
}

.review-status {
  font-size: 24rpx;
  font-weight: 500;
  padding: 4rpx 12rpx;
  border-radius: 4rpx;

  &.s-unreviewed {
    background-color: rgba(255, 153, 0, 0.18);
    color: #ff9900;
  }
  &.s-reviewed {
    background-color: rgba(7, 193, 96, 0.18);
    color: #07c160;
  }
}

.order-time {
  font-size: 22rpx;
  color: var(--text-dim);
}

.review-body {
  display: flex;
  gap: 16rpx;
  align-items: center;
}

.car-img {
  width: 160rpx;
  height: 120rpx;
  border-radius: 8rpx;
  flex-shrink: 0;
  background-color: var(--border-color);
}

.review-info {
  flex: 1;
  min-width: 0;
}

.car-name {
  font-size: 28rpx;
  font-weight: 500;
  color: var(--text-main);
  margin-bottom: 8rpx;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.rent-period {
  font-size: 22rpx;
  color: var(--text-sub);
  margin-bottom: 8rpx;
}

.order-amount {
  font-size: 28rpx;
  color: #ff5a3c;
  font-weight: 600;
}

.review-action {
  flex-shrink: 0;
  font-size: 24rpx;
  color: #ff2e2e;
  font-weight: 500;
}

.view-all-btn {
  text-align: center;
  padding: 24rpx;
  font-size: 26rpx;
  color: #ff2e2e;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 160rpx 0;
  gap: 12rpx;
}

.empty-text {
  font-size: 28rpx;
  color: var(--text-sub);
}

.empty-sub {
  font-size: 24rpx;
  color: var(--text-dim);
}
</style>
