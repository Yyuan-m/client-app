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
import { moneyUtil, dateUtil } from '@/utils'
import type { CartItem } from '@/stores/cart'
import type { PriceDetailVO } from '@/api/types'
import { getCustomNavTopOffset } from '@/utils/navbar'
import { useThemeClass } from '@/composables/useThemeClass'
import { useNavigationBar } from '@/composables/useNavigationBar'

const { themeClass, appStore } = useThemeClass()
/** 自定义导航页同步状态栏文字/胶囊颜色随主题 */
useNavigationBar()
const userStore = useUserStore()
const cartStore = useCartStore()
/** 加载动画颜色：随深浅主题切换 */
const loadingColor = computed(() => (appStore.isDark ? '#aeaeb2' : '#6e6e73'))

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

// ============ 购物车内改期（底部弹层，选完立即生效并重算价格） ============
/** 改期弹层显隐 */
const showDateModal = ref(false)
/** 当前改期的购物车项 */
const dateTarget = ref<CartItem | null>(null)
/** 弹层内编辑中的取/还车日期 */
const editStart = ref('')
const editEnd = ref('')
/** 最小可选日期（今天） */
const minPickDate = dateUtil.today()
/** 快捷租期选项 */
const quickPickOptions = [3, 7, 15, 30]

/** 弹层内租期天数 */
const editDays = computed(() => {
  if (!editStart.value || !editEnd.value) return 0
  return dateUtil.daysBetween(editStart.value, editEnd.value)
})

/** 打开改期弹层 */
function openDateModal(item: CartItem) {
  dateTarget.value = item
  editStart.value = item.startDate
  editEnd.value = item.endDate
  showDateModal.value = true
}

/** 关闭改期弹层（不保存） */
function closeDateModal() {
  showDateModal.value = false
  dateTarget.value = null
}

/** 应用改期：调用 store 更新（同步后端 + 重算价格），成功后关闭弹层 */
async function applyDateChange() {
  const item = dateTarget.value
  if (!item || editDays.value < 1) return
  const start = editStart.value
  const end = editEnd.value
  // 日期未变化则不重复提交
  if (start === item.startDate && end === item.endDate) {
    closeDateModal()
    return
  }
  showDateModal.value = false
  try {
    await cartStore.updateItem(item.carId, start, end, editDays.value)
    uni.showToast({ title: `租期已更新为${editDays.value}天`, icon: 'none' })
  } catch (e) {
    console.error('[cart] updateItem failed:', e)
    uni.showToast({ title: '修改失败，请重试', icon: 'none' })
  } finally {
    dateTarget.value = null
  }
}

/** 取车日变更：若还车日失效则自动顺延 1 天，随即生效并关闭 */
function onEditStartChange(e: any) {
  editStart.value = e.detail.value
  if (!editEnd.value || dateUtil.daysBetween(editStart.value, editEnd.value) < 1) {
    editEnd.value = dateUtil.addDays(editStart.value, 1)
  }
  applyDateChange()
}

/** 还车日变更：有效则立即生效并关闭，无效则提示且留在弹层内调整 */
function onEditEndChange(e: any) {
  editEnd.value = e.detail.value
  if (dateUtil.daysBetween(editStart.value, editEnd.value) < 1) {
    uni.showToast({ title: '还车日需晚于取车日', icon: 'none' })
    return
  }
  applyDateChange()
}

/** 快捷选择租期：以当前取车日为基准顺延 N 天，立即生效 */
function quickPickDays(days: number) {
  if (!editStart.value) editStart.value = minPickDate
  editEnd.value = dateUtil.addDays(editStart.value, days)
  applyDateChange()
}
</script>

<template>
  <view class="cart-page" :class="themeClass" :style="{ paddingTop: navTop + 'px' }">
    <view class="page-header">
      <text class="header-title">租车购物车</text>
      <view class="header-side">
        <view v-if="cartStore.items.length" class="clear-btn" @tap="showClearConfirm">清空</view>
      </view>
    </view>

    <!-- 加载中 -->
    <view v-if="loading && !cartStore.items.length" class="loading-wrap">
      <u-loading-icon mode="circle" text="加载中..." :color="loadingColor" :textColor="loadingColor" />
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
        <view class="item-info">
          <view class="item-name" @tap="onItemClick(item)">{{ item.carName }}</view>
          <!-- 点击日期行弹出改期弹层，选完立即生效并重算价格 -->
          <view class="item-date" @tap.stop="openDateModal(item)">
            <text class="date-text">{{ item.startDate }} 至 {{ item.endDate }}</text>
            <text class="date-edit-hint">改期</text>
          </view>
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

    <!-- 改期底部弹层：取/还车日 + 快捷天数，选完立即生效 -->
    <u-popup
      :show="showDateModal"
      mode="bottom"
      :round="16"
      :safe-area-inset-bottom="true"
      :z-index="998"
      @close="closeDateModal"
    >
      <view class="date-modal">
        <view class="date-modal-header">
          <text class="date-modal-title">修改租期</text>
          <view class="date-modal-close" @tap="closeDateModal"><text>×</text></view>
        </view>
        <text v-if="dateTarget" class="date-modal-car">{{ dateTarget.carName }}</text>

        <!-- 取/还车日期 -->
        <view class="date-modal-row">
          <view class="date-modal-item">
            <text class="date-modal-label">取车日</text>
            <picker mode="date" :value="editStart" :start="minPickDate" @change="onEditStartChange">
              <view class="date-modal-value">{{ editStart || '请选择' }}</view>
            </picker>
          </view>
          <text class="date-modal-arrow">→</text>
          <view class="date-modal-item">
            <text class="date-modal-label">还车日</text>
            <picker
              mode="date"
              :value="editEnd"
              :start="dateUtil.addDays(editStart || minPickDate, 1)"
              @change="onEditEndChange"
            >
              <view class="date-modal-value">{{ editEnd || '请选择' }}</view>
            </picker>
          </view>
        </view>

        <!-- 快捷天数 -->
        <view class="date-modal-quick">
          <view
            v-for="d in quickPickOptions"
            :key="d"
            class="quick-chip"
            :class="{ active: editDays === d }"
            @tap="quickPickDays(d)"
          >
            {{ d }}天
          </view>
        </view>

        <!-- 租期提示 -->
        <view v-if="editDays >= 1" class="date-modal-tip">
          <text>租期 {{ editDays }} 天，修改后价格将实时刷新</text>
        </view>
      </view>
    </u-popup>

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
  background-color: var(--page-bg);
  padding-bottom: calc(220rpx + env(safe-area-inset-bottom));
}

.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 88rpx;
  padding: 0 24rpx;
  background-color: var(--page-bg);
  border-bottom: 1rpx solid var(--border-color);
}

.header-title {
  flex: 1;
  text-align: left;
  font-size: 34rpx;
  font-weight: 700;
  color: var(--text-main);
}

.header-side {
  display: flex;
  justify-content: flex-end;
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
  color: var(--text-sub);
}

.empty-sub {
  font-size: 24rpx;
  color: var(--text-dim);
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
  background-color: var(--card-bg);
  border-radius: 16rpx;
  margin-bottom: 16rpx;
  border: 1rpx solid var(--border-color);
}

.check-box {
  flex-shrink: 0;
  width: 40rpx;
  height: 40rpx;
  border: 2rpx solid var(--text-dim);
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
  background-color: var(--border-color);
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
  color: var(--text-main);
  font-weight: 500;
  margin-bottom: 8rpx;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.item-date {
  display: inline-flex;
  align-items: center;
  align-self: flex-start;
  gap: 8rpx;
  font-size: 22rpx;
  color: var(--text-sub);
  margin-bottom: 4rpx;
  padding: 2rpx 10rpx;
  border: 1rpx dashed var(--border-color);
  border-radius: 6rpx;

  &:active {
    border-color: #ff2e2e;
    background-color: rgba(255, 46, 46, 0.06);
  }
}

.date-edit-hint {
  font-size: 20rpx;
  color: #ff2e2e;
}

/* 改期底部弹层 */
.date-modal {
  padding: 32rpx 32rpx calc(32rpx + env(safe-area-inset-bottom));
  background-color: var(--card-bg);
}

.date-modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8rpx;
}

.date-modal-title {
  font-size: 32rpx;
  font-weight: 600;
  color: var(--text-main);
}

.date-modal-close {
  width: 56rpx;
  height: 56rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;

  &:active {
    background-color: var(--border-color);
  }

  text {
    font-size: 40rpx;
    color: var(--text-sub);
    line-height: 1;
  }
}

.date-modal-car {
  display: block;
  font-size: 24rpx;
  color: var(--text-sub);
  margin-bottom: 24rpx;
}

.date-modal-row {
  display: flex;
  align-items: center;
  gap: 16rpx;
  margin-bottom: 24rpx;
}

.date-modal-item {
  flex: 1;
}

.date-modal-label {
  display: block;
  font-size: 22rpx;
  color: var(--text-dim);
  margin-bottom: 8rpx;
}

.date-modal-value {
  height: 72rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 26rpx;
  color: var(--text-main);
  background-color: var(--page-bg);
  border: 1rpx solid var(--border-color);
  border-radius: 8rpx;
}

.date-modal-arrow {
  font-size: 28rpx;
  color: var(--text-dim);
  margin-top: 30rpx;
}

.date-modal-quick {
  display: flex;
  gap: 16rpx;
  margin-bottom: 20rpx;
}

.quick-chip {
  flex: 1;
  height: 64rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 26rpx;
  color: var(--text-sub);
  background-color: var(--page-bg);
  border: 1rpx solid var(--border-color);
  border-radius: 8rpx;

  &.active {
    color: #ff2e2e;
    border-color: #ff2e2e;
    background-color: rgba(255, 46, 46, 0.06);
  }

  &:active {
    opacity: 0.8;
  }
}

.date-modal-tip {
  font-size: 22rpx;
  color: var(--text-dim);
  text-align: center;
}

.item-rent-days {
  font-size: 22rpx;
  color: var(--text-sub);
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
  color: var(--text-sub);
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
  color: var(--text-main);
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
  color: var(--text-dim);
  margin-left: 8rpx;
}

/* 服务保障 */
.service-tips {
  display: flex;
  justify-content: space-around;
  padding: 24rpx;
  margin: 16rpx 24rpx;
  background-color: var(--card-bg);
  border-radius: 16rpx;
  border: 1rpx solid var(--border-color);
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
  background-color: var(--card-bg);
  border-top: 1rpx solid var(--border-color);
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
  color: var(--text-main);
  margin-left: 8rpx;
}

.total-info {
  flex: 1;
  text-align: right;
  margin-right: 24rpx;
}

.total-label {
  font-size: 26rpx;
  color: var(--text-main);
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
    background-color: var(--border-color);
    color: var(--text-dim);
  }
}

.tabbar-placeholder {
  height: 100rpx;
}
</style>
