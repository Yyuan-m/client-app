<script setup lang="ts">
/**
 * 购物车页
 * 原Web: 左侧车辆列表 + 右侧结算卡片（移动端单列 + 底部结算栏）
 *
 * onShow: cartStore.initCart()
 * watch(() => cartStore.selectedIds, () => cartStore.refreshPrices())
 * 价格明细：每项展示日租金、租金合计、长租折扣标签、节假日溢价标签
 * 操作：单项移除（u-modal 确认）、清空购物车、去结算（校验登录 + 选中数量）
 */
import { ref, computed, watch } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { useUserStore } from '@/stores/user'
import { useCartStore } from '@/stores/cart'
import { resolveAdminImage } from '@/utils/image'
import { moneyUtil } from '@/utils'
import type { CartItem } from '@/stores/cart'
import type { PriceDetailVO } from '@/api/types'
import { getCustomNavTopOffset } from '@/utils/navbar'

const userStore = useUserStore()
const cartStore = useCartStore()

const loading = ref(false)
const showRemoveModal = ref(false)
const showClearModal = ref(false)
const removeTarget = ref<CartItem | null>(null)

/** 自定义导航栏：顶部避开微信胶囊按钮 */
const navTop = getCustomNavTopOffset()

onShow(async () => {
  if (userStore.isLoggedIn) {
    loading.value = true
    try {
      await cartStore.initCart()
    } catch (e) {
      console.error('[cart] initCart failed:', e)
    } finally {
      loading.value = false
    }
  }
})

// 监听选中项变化，刷新价格
watch(
  () => cartStore.selectedIds,
  () => {
    cartStore.refreshPrices().catch((e) => console.error('[cart] refreshPrices failed:', e))
  },
  { deep: true }
)

function toggleSelect(carId: number) {
  cartStore.toggleSelect(carId)
}

function toggleSelectAll() {
  cartStore.toggleSelectAll()
}

function onItemClick(item: CartItem) {
  uni.navigateTo({ url: `/pages/vehicle/detail?id=${item.carId}` })
}

function showRemoveConfirm(item: CartItem) {
  removeTarget.value = item
  showRemoveModal.value = true
}

async function confirmRemove() {
  if (!removeTarget.value) return
  const carId = removeTarget.value.carId
  showRemoveModal.value = false
  try {
    await cartStore.removeItem(carId)
    uni.showToast({ title: '已移除', icon: 'success' })
  } catch (e) {
    console.error('[cart] removeItem failed:', e)
    uni.showToast({ title: '移除失败', icon: 'none' })
  } finally {
    removeTarget.value = null
  }
}

function showClearConfirm() {
  if (!cartStore.items.length) return
  showClearModal.value = true
}

async function confirmClear() {
  showClearModal.value = false
  try {
    await cartStore.clear()
    uni.showToast({ title: '已清空', icon: 'success' })
  } catch (e) {
    console.error('[cart] clear failed:', e)
    uni.showToast({ title: '清空失败', icon: 'none' })
  }
}

function goCheckout() {
  if (!userStore.isLoggedIn) {
    uni.showToast({ title: '请先登录', icon: 'none' })
    const redirect = encodeURIComponent('/pages/cart/index')
    setTimeout(() => {
      uni.navigateTo({ url: `/pages/auth/login?redirect=${redirect}` })
    }, 800)
    return
  }
  if (!cartStore.selectedCount) {
    uni.showToast({ title: '请选择要结算的车辆', icon: 'none' })
    return
  }
  uni.navigateTo({ url: '/pages/order/checkout' })
}

function goVehicleList() {
  uni.reLaunch({ url: '/pages/vehicle/list' })
}

function getPriceDetail(carId: number): PriceDetailVO | undefined {
  return cartStore.getPriceDetail(carId)
}

function formatPrice(p: number | null | undefined): string {
  return moneyUtil.format(Number(p || 0))
}
</script>

<template>
  <view class="cart-page" :style="{ paddingTop: navTop + 'px' }">
    <view class="page-title-row">
      <view class="page-title">租车购物车</view>
      <view v-if="cartStore.items.length" class="clear-btn" @tap="showClearConfirm">清空</view>
    </view>

    <!-- 加载中 -->
    <view v-if="loading && !cartStore.items.length" class="loading-wrap">
      <u-loading-icon mode="circle" text="加载中..." />
    </view>

    <!-- 空购物车 -->
    <view v-else-if="!cartStore.items.length" class="empty-state">
      <view class="empty-icon">🛒</view>
      <view class="empty-text">购物车空空如也</view>
      <view class="empty-sub">去看看心仪的豪华车型吧</view>
      <u-button text="去选车" type="primary" shape="square" @click="goVehicleList" class="go-btn" />
    </view>

    <!-- 购物车列表 -->
    <view v-else class="cart-list">
      <view v-for="item in cartStore.items" :key="item.carId" class="cart-item">
        <!-- 选中框 -->
        <view class="check-box" :class="{ checked: cartStore.isSelected(item.carId) }" @tap="toggleSelect(item.carId)">
          <text v-if="cartStore.isSelected(item.carId)" class="check-icon">✓</text>
        </view>

        <!-- 车辆图片 -->
        <view class="item-img-wrap" @tap="onItemClick(item)">
          <image :src="resolveAdminImage(item.cover)" mode="aspectFill" class="item-img" lazy-load />
        </view>

        <!-- 车辆信息 -->
        <view class="item-info" @tap="onItemClick(item)">
          <view class="item-name">{{ item.carName }}</view>
          <view class="item-date">{{ item.startDate }} 至 {{ item.endDate }}</view>
          <view class="item-rent-days">租期 {{ item.days }} 天</view>
          <view class="item-price">￥{{ formatPrice(item.dailyPrice) }}<text class="price-unit">/天</text></view>

          <!-- 价格明细标签 -->
          <view v-if="getPriceDetail(item.carId)" class="price-tags">
            <view v-if="Number(getPriceDetail(item.carId)?.discountAmount) > 0" class="tag tag-discount">
              {{ getPriceDetail(item.carId)?.durationTierName }}折扣 -￥{{ formatPrice(getPriceDetail(item.carId)?.discountAmount) }}
            </view>
            <view v-if="(getPriceDetail(item.carId)?.holidayDays || 0) > 0" class="tag tag-holiday">
              含{{ getPriceDetail(item.carId)?.holidayDays }}天假日 +￥{{ formatPrice(getPriceDetail(item.carId)?.holidaySurchargeAmount) }}
            </view>
          </view>

          <!-- 小计 -->
          <view class="item-subtotal">
            <text v-if="getPriceDetail(item.carId)" class="subtotal-price text-price">
              小计：￥{{ formatPrice(getPriceDetail(item.carId)?.totalAmount) }}
            </text>
            <text v-else class="subtotal-price">小计：—</text>
          </view>
        </view>

        <!-- 移除按钮 -->
        <view class="remove-btn" @tap.stop="showRemoveConfirm(item)">×</view>
      </view>
    </view>

    <!-- 服务保障 -->
    <view v-if="cartStore.items.length" class="service-tips">
      <view class="service-item">✓ 全保险</view>
      <view class="service-item">✓ 免费取消</view>
      <view class="service-item">✓ 24小时客服</view>
    </view>

    <!-- 底部结算栏 -->
    <view v-if="cartStore.items.length" class="bottom-bar">
      <view class="all-select" @tap="toggleSelectAll">
        <view class="check-box" :class="{ checked: cartStore.isAllSelected }">
          <text v-if="cartStore.isAllSelected" class="check-icon">✓</text>
        </view>
        <text class="all-text">全选</text>
      </view>
      <view class="total-info">
        <text class="total-label">合计：</text>
        <text class="total-price text-price">￥{{ formatPrice(cartStore.totalAmount) }}</text>
      </view>
      <view class="checkout-btn" :class="{ disabled: !cartStore.selectedCount }" @tap="goCheckout">
        去结算{{ cartStore.selectedCount ? `(${cartStore.selectedCount})` : '' }}
      </view>
    </view>

    <!-- 底部 TabBar 占位 -->
    <view class="tabbar-placeholder"></view>
    <TabBar active="pages/cart/index" />

    <!-- 移除确认弹窗 -->
    <u-modal
      :show="showRemoveModal"
      title="提示"
      content="确定要移除该车辆吗？"
      @confirm="confirmRemove"
      @cancel="() => { showRemoveModal = false; removeTarget = null }"
      :showCancelButton="true"
    />

    <!-- 清空确认弹窗 -->
    <u-modal
      :show="showClearModal"
      title="提示"
      content="确定要清空购物车吗？"
      @confirm="confirmClear"
      @cancel="() => { showClearModal = false }"
      :showCancelButton="true"
    />
  </view>
</template>

<style scoped lang="scss">
.cart-page {
  box-sizing: border-box;
  min-height: 100vh;
  background-color: #0a0a0a;
  padding-bottom: calc(220rpx + env(safe-area-inset-bottom));
}

.page-title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 24rpx 24rpx 16rpx;
}

.page-title {
  font-size: 36rpx;
  font-weight: 700;
  color: #f5f5f5;
}

.clear-btn {
  font-size: 24rpx;
  color: #ff2e2e;
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
  font-size: 32rpx;
  color: #aeaeb2;
}

.empty-sub {
  font-size: 24rpx;
  color: #6e6e73;
  margin-bottom: 24rpx;
}

.go-btn {
  width: 320rpx;
}

/* 购物车列表 */
.cart-list {
  padding: 0 24rpx;
}

.cart-item {
  display: flex;
  align-items: flex-start;
  padding: 24rpx;
  background-color: #1a1a1a;
  border-radius: 16rpx;
  margin-bottom: 16rpx;
  border: 1rpx solid #2a2a2a;
}

.check-box {
  flex-shrink: 0;
  width: 40rpx;
  height: 40rpx;
  border: 2rpx solid #6e6e73;
  border-radius: 50%;
  margin-right: 16rpx;
  margin-top: 8rpx;
  display: flex;
  align-items: center;
  justify-content: center;

  &.checked {
    background-color: #ff2e2e;
    border-color: #ff2e2e;
  }
}

.check-icon {
  color: #fff;
  font-size: 22rpx;
  font-weight: 700;
}

.item-img-wrap {
  flex-shrink: 0;
  width: 180rpx;
  height: 140rpx;
  border-radius: 8rpx;
  overflow: hidden;
  margin-right: 16rpx;
  background-color: #2a2a2a;
}

.item-img {
  width: 100%;
  height: 100%;
}

.item-info {
  flex: 1;
  min-width: 0;
}

.item-name {
  font-size: 28rpx;
  color: #f5f5f5;
  font-weight: 500;
  margin-bottom: 8rpx;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.item-date {
  font-size: 22rpx;
  color: #aeaeb2;
  margin-bottom: 4rpx;
}

.item-rent-days {
  font-size: 22rpx;
  color: #aeaeb2;
  margin-bottom: 8rpx;
}

.item-price {
  font-size: 28rpx;
  color: #ff5a3c;
  font-weight: 600;
  margin-bottom: 8rpx;
}

.price-unit {
  font-size: 22rpx;
  color: #aeaeb2;
  font-weight: 400;
}

.price-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8rpx;
  margin-bottom: 8rpx;
}

.tag {
  font-size: 20rpx;
  padding: 2rpx 8rpx;
  border-radius: 4rpx;
}

.tag-discount { background-color: rgba(7, 193, 96, 0.18); color: #07c160; }
.tag-holiday { background-color: rgba(255, 153, 0, 0.18); color: #ff9900; }

.item-subtotal {
  margin-top: 4rpx;
}

.subtotal-price {
  font-size: 26rpx;
  color: #f5f5f5;
  font-weight: 500;
}

.remove-btn {
  flex-shrink: 0;
  width: 48rpx;
  height: 48rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 36rpx;
  color: #6e6e73;
  margin-left: 8rpx;
}

/* 服务保障 */
.service-tips {
  display: flex;
  justify-content: space-around;
  padding: 24rpx;
  margin: 16rpx 24rpx;
  background-color: #1a1a1a;
  border-radius: 16rpx;
  border: 1rpx solid #2a2a2a;
}

.service-item {
  font-size: 22rpx;
  color: #07c160;
}

/* 底部结算栏 */
.bottom-bar {
  position: fixed;
  left: 0;
  right: 0;
  bottom: calc(100rpx + env(safe-area-inset-bottom));
  height: 110rpx;
  background-color: #1a1a1a;
  border-top: 1rpx solid #2a2a2a;
  display: flex;
  align-items: center;
  padding: 0 24rpx;
  z-index: 99;
}

.all-select {
  display: flex;
  align-items: center;
  margin-right: 24rpx;
}

.all-text {
  font-size: 26rpx;
  color: #f5f5f5;
  margin-left: 8rpx;
}

.total-info {
  flex: 1;
  text-align: right;
  margin-right: 24rpx;
}

.total-label {
  font-size: 26rpx;
  color: #f5f5f5;
}

.total-price {
  font-size: 36rpx;
  font-weight: 700;
}

.checkout-btn {
  padding: 16rpx 40rpx;
  background-color: #ff2e2e;
  color: #fff;
  font-size: 28rpx;
  font-weight: 500;
  border-radius: 8rpx;

  &.disabled {
    background-color: #2a2a2a;
    color: #6e6e73;
  }
}

.tabbar-placeholder {
  height: 100rpx;
}
</style>
