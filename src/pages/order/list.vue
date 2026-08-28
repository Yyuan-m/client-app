<script setup lang="ts">
/**
 * 订单列表页
 * 原Web: 状态 tab 筛选 / 取消订单 / noDedup:true 避免 tab 切换请求被误取消
 * 状态色区分：pending 黄 / renting 红 / completed 绿 / cancelled 灰
 * 卡片点击跳 /pages/order/detail?id=xxx
 */
import { ref, reactive, computed } from 'vue'
import { onLoad, onReachBottom } from '@dcloudio/uni-app'
import { getOrderListApi, cancelOrderApi } from '@/api/modules/order'
import { resolveAdminImage } from '@/utils/image'
import { moneyUtil, dateUtil } from '@/utils'
import type { OrderVO, OrderStatus, PageResult } from '@/api/types'
import { useThemeClass } from '@/composables/useThemeClass'
import { useNavigationBar } from '@/composables/useNavigationBar'

const { themeClass, appStore } = useThemeClass()
/** 加载动画颜色：随深浅主题切换 */
const loadingColor = computed(() => (appStore.isDark ? '#aeaeb2' : '#6e6e73'))
/** 原生导航栏随主题切换 */
useNavigationBar()

interface TabItem {
  label: string
  value: OrderStatus | 'all'
}

const tabs: TabItem[] = [
  { label: '全部', value: 'all' },
  { label: '待支付', value: 'pending' },
  { label: '租赁中', value: 'renting' },
  { label: '已完成', value: 'completed' },
  { label: '已取消', value: 'cancelled' }
]

const currentTab = ref<OrderStatus | 'all'>('all')
const list = ref<OrderVO[]>([])
const loading = ref(false)
const finished = ref(false)
const page = reactive({ current: 1, pageSize: 10, total: 0 })

// 取消订单确认弹窗
const showCancelModal = ref(false)
const cancelTarget = ref<OrderVO | null>(null)

onLoad(() => {
  loadList()
})

onReachBottom(() => {
  if (loading.value || finished.value) return
  page.current++
  loadList()
})

async function loadList() {
  if (loading.value) return
  loading.value = true
  try {
    const res: PageResult<OrderVO> = await getOrderListApi(
      { status: currentTab.value, page: page.current, pageSize: page.pageSize },
      { noDedup: true }
    )
    const items = res.list || []
    if (page.current === 1) {
      list.value = items
    } else {
      list.value.push(...items)
    }
    page.total = res.total || 0
    finished.value = list.value.length >= page.total
  } catch (e) {
    console.error('[order.list] load failed:', e)
  } finally {
    loading.value = false
  }
}

function onTabChange(tab: TabItem) {
  if (currentTab.value === tab.value) return
  currentTab.value = tab.value
  page.current = 1
  finished.value = false
  list.value = []
  loadList()
}

function goDetail(order: OrderVO) {
  uni.navigateTo({ url: `/pages/order/detail?id=${order.id}` })
}

function showCancelConfirm(order: OrderVO) {
  cancelTarget.value = order
  showCancelModal.value = true
}

async function confirmCancel() {
  if (!cancelTarget.value) return
  const orderId = cancelTarget.value.id
  showCancelModal.value = false
  try {
    await cancelOrderApi(orderId)
    uni.showToast({ title: '取消成功', icon: 'success' })
    // 重新加载
    page.current = 1
    finished.value = false
    await loadList()
  } catch (e) {
    console.error('[order.list] cancel failed:', e)
  } finally {
    cancelTarget.value = null
  }
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

function formatPrice(p: number | string | null | undefined): string {
  return moneyUtil.format(Number(p || 0))
}

function formatTime(t?: string): string {
  if (!t) return ''
  return dateUtil.format(t, 'YYYY-MM-DD HH:mm')
}
</script>

<template>
  <view class="order-list-page" :class="themeClass">
    <!-- Tabs -->
    <view class="tabs-bar">
      <scroll-view scroll-x :show-scrollbar="false">
        <view class="tabs-row">
          <view
            v-for="tab in tabs"
            :key="tab.value"
            class="tab-item"
            :class="{ active: currentTab === tab.value }"
            @tap="onTabChange(tab)"
          >
            {{ tab.label }}
          </view>
        </view>
      </scroll-view>
    </view>

    <!-- 加载中 + 空列表 -->
    <view v-if="loading && !list.length" class="loading-wrap">
      <u-loading-icon mode="circle" text="加载中..." :color="loadingColor" :textColor="loadingColor" />
    </view>

    <view v-else-if="!list.length" class="empty-state">
      <view class="empty-icon">📋</view>
      <view class="empty-text">暂无订单</view>
    </view>

    <!-- 订单列表 -->
    <view v-else class="order-list">
      <view v-for="order in list" :key="order.id" class="order-card" @tap="goDetail(order)">
        <view class="card-header">
          <view class="order-no">订单号：{{ order.orderNo || order.id }}</view>
          <view class="order-status" :class="statusClass(order.status)">{{ statusText(order.status) }}</view>
        </view>
        <view class="card-body">
          <image :src="resolveAdminImage(order.carCover || '')" mode="aspectFill" class="car-img" lazy-load />
          <view class="order-info">
            <view class="car-name">{{ order.carName }}</view>
            <view class="rent-period">{{ order.startDate }} 至 {{ order.endDate }}</view>
            <view v-if="order.days" class="rent-days">租期 {{ order.days }} 天</view>
            <view v-if="order.store" class="order-store">门店：{{ order.store }}</view>
            <view class="order-time">下单：{{ formatTime(order.createTime) }}</view>
          </view>
          <view class="order-amount">
            <view class="amount-label">应付</view>
            <view class="amount-price text-price">￥{{ formatPrice(order.totalAmount) }}</view>
          </view>
        </view>
        <view class="card-footer">
          <view v-if="order.status === 'pending'" class="cancel-btn" @tap.stop="showCancelConfirm(order)">
            取消订单
          </view>
          <view class="detail-btn">查看详情 ›</view>
        </view>
      </view>

      <!-- 加载更多 -->
      <view v-if="loading" class="loadmore">
        <u-loading-icon mode="circle" text="加载中..." :color="loadingColor" :textColor="loadingColor" />
      </view>
      <view v-else-if="finished" class="loadmore">
        <view class="loadmore-text">— 已加载全部 —</view>
      </view>
    </view>

    <!-- 取消订单确认弹窗 -->
    <u-modal
      :show="showCancelModal"
      title="提示"
      content="确定要取消该订单吗？取消后无法恢复。"
      @confirm="confirmCancel"
      @cancel="() => { showCancelModal = false; cancelTarget = null }"
      :showCancelButton="true"
    />
  </view>
</template>

<style scoped lang="scss">
.order-list-page {
  min-height: 100vh;
  background-color: var(--page-bg);
  padding-bottom: calc(48rpx + env(safe-area-inset-bottom));
}

/* Tabs */
.tabs-bar {
  position: sticky;
  top: 0;
  z-index: 10;
  background-color: var(--page-bg);
  border-bottom: 1rpx solid var(--border-color);
}

.tabs-row {
  display: inline-flex;
  padding: 16rpx 24rpx;
  gap: 16rpx;
}

.tab-item {
  flex-shrink: 0;
  padding: 12rpx 32rpx;
  font-size: 26rpx;
  color: var(--text-sub);
  background-color: var(--card-bg);
  border-radius: 8rpx;
  border: 1rpx solid var(--border-color);

  &.active {
    background-color: #ff2e2e;
    color: #fff;
    border-color: #ff2e2e;
  }
}

.loading-wrap,
.empty-state {
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
  color: var(--text-dim);
}

/* 订单列表 */
.order-list {
  padding: 24rpx;
}

.order-card {
  background-color: var(--card-bg);
  border-radius: 16rpx;
  padding: 24rpx;
  margin-bottom: 24rpx;
  border: 1rpx solid var(--border-color);
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-bottom: 16rpx;
  border-bottom: 1rpx solid var(--border-color);
  margin-bottom: 16rpx;
}

.order-no {
  font-size: 22rpx;
  color: var(--text-dim);
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
.status-cancelled { background-color: rgba(174, 174, 178, 0.18); color: var(--text-dim); }

.card-body {
  display: flex;
  gap: 16rpx;
}

.car-img {
  width: 160rpx;
  height: 120rpx;
  border-radius: 8rpx;
  flex-shrink: 0;
  background-color: var(--border-color);
}

.order-info {
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

.rent-period,
.rent-days,
.order-store,
.order-time {
  font-size: 22rpx;
  color: var(--text-sub);
  margin-bottom: 4rpx;
}

.order-amount {
  flex-shrink: 0;
  text-align: right;
}

.amount-label {
  font-size: 22rpx;
  color: var(--text-sub);
  margin-bottom: 4rpx;
}

.amount-price {
  font-size: 32rpx;
  font-weight: 700;
}

.card-footer {
  display: flex;
  justify-content: flex-end;
  gap: 16rpx;
  margin-top: 16rpx;
  padding-top: 16rpx;
  border-top: 1rpx solid var(--border-color);
}

.cancel-btn {
  padding: 12rpx 24rpx;
  font-size: 24rpx;
  color: var(--text-sub);
  border: 1rpx solid var(--border-color);
  border-radius: 8rpx;
}

.detail-btn {
  padding: 12rpx 24rpx;
  font-size: 24rpx;
  color: #ff2e2e;
  border: 1rpx solid #ff2e2e;
  border-radius: 8rpx;
}

.loadmore {
  padding: 32rpx 0;
  text-align: center;
}

.loadmore-text {
  font-size: 24rpx;
  color: var(--text-dim);
}
</style>
