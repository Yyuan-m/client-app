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
import { onShow, onHide, onUnload } from '@dcloudio/uni-app'
import { useUserStore } from '@/stores/user'
import { useCartStore } from '@/stores/cart'
import { getCarAvailabilityApi } from '@/api/modules/car'
import { resolveAdminImage } from '@/utils/image'
import { moneyUtil, dateUtil } from '@/utils'
import type { CartItem } from '@/stores/cart'
import type { PriceDetailVO, CarAvailabilityVO } from '@/api/types'
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

// ---------- 车辆可用期（已租出/整备期日期禁用） ----------
/** carId → 可用期数据 */
const availabilityMap = ref<Record<number, CarAvailabilityVO>>({})

/** 加载购物车内所有车辆的可用期 */
async function loadAvailability() {
  const ids = [...new Set(cartStore.items.map((i) => i.carId))]
  await Promise.all(
    ids.map(async (carId) => {
      try {
        availabilityMap.value[carId] = await getCarAvailabilityApi(carId)
      } catch (e) {
        console.error('[cart] load availability failed:', carId, e)
      }
    })
  )
}

function unavailableRangesOf(carId: number): { startDate: string; endDate: string }[] {
  return availabilityMap.value[carId]?.unavailableRanges || []
}

/** 已租出/整备区间展示文案（如 "09-03~09-09"，多个区间用顿号连接） */
function occupiedRangesText(carId: number): string {
  return unavailableRangesOf(carId)
    .map((r) => `${r.startDate.slice(5)}~${r.endDate.slice(5)}`)
    .join('、')
}

/** 判断租期 [start, end)（YYYY-MM-DD）是否与不可用区间（含整备期）冲突 */
function isRangeUnavailable(carId: number, start: string, end: string): boolean {
  if (!start || !end) return false
  return unavailableRangesOf(carId).some((r) => start < r.endDate && end > r.startDate)
}

/** 最早可选日期：今天 与 车辆最早可租日 取较大值（null 表示无占用） */
function minSelectableDateOf(carId: number): string {
  const today = dateUtil.today()
  const av = availabilityMap.value[carId]?.availableDate
  if (!av) return today
  return av > today ? av : today
}

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
  startCartSync()
})

onHide(() => {
  stopCartSync()
})

onUnload(() => {
  stopCartSync()
})

// ---------- 跨端实时同步（与 web 端对称） ----------
// 页面展示期间每 5 秒做一次远程摘要比对（覆盖另一端增删/改期/清空），不一致时全量刷新；
// 页面隐藏/卸载时停止轮询，避免后台空耗请求
const CART_SYNC_INTERVAL = 5000
let cartSyncTimer: ReturnType<typeof setInterval> | null = null

function startCartSync() {
  stopCartSync()
  if (!userStore.isLoggedIn) return
  cartSyncTimer = setInterval(() => {
    cartStore.checkRemoteSync()
  }, CART_SYNC_INTERVAL)
}

function stopCartSync() {
  if (cartSyncTimer) {
    clearInterval(cartSyncTimer)
    cartSyncTimer = null
  }
}

// 购物车车辆变化时加载可用期
watch(
  () => cartStore.items.map((i) => i.carId).join(','),
  () => {
    loadAvailability()
  }
)

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
/** 弹层内最早可选日期（今天 或 车辆最早可租日，禁用已租出/整备期） */
const editMinStart = ref(minPickDate)
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
  editMinStart.value = minSelectableDateOf(item.carId)
  // 当前所选日期已落在不可用区间（如车辆被他人租出）时提示改期
  if (isRangeUnavailable(item.carId, item.startDate, item.endDate)) {
    uni.showToast({ title: '当前所选日期车辆不可租，请重新选择', icon: 'none' })
  }
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
  // 所选租期落在已租出/整备期则拒绝（后端 updateItem 也会二次校验）
  if (isRangeUnavailable(item.carId, start, end)) {
    uni.showToast({ title: '该车在所选日期已被租出或在整备中，请更换租期', icon: 'none' })
    return
  }
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

/** 快捷选择租期：以最早可选日起算（避开已租出/整备期），立即生效 */
function quickPickDays(days: number) {
  // 起点钳制到最早可选日（今天 或 车辆最早可租日）
  if (!editStart.value || editStart.value < editMinStart.value) {
    editStart.value = editMinStart.value
  }
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
          <view v-if="occupiedRangesText(item.carId)" class="occupied-tip">
            已租出：{{ occupiedRangesText(item.carId) }}
          </view>
          <view v-if="isRangeUnavailable(item.carId, item.startDate, item.endDate)" class="unavailable-tip">
            所选日期车辆不可租（已租出/整备中），请改期
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

    <!-- 底部 TabBar 占位（改期弹层打开时隐藏 TabBar，避免其悬浮在弹层上方遮挡内容） -->
    <view v-if="!showDateModal" class="tabbar-placeholder"></view>
    <TabBar v-if="!showDateModal" active="pages/cart/index" />

    <!-- 改期底部弹层：取/还车日 + 快捷天数，选完立即生效 -->
    <!-- z-index 须低于 picker 日期选择面板（小程序原生层/H5 999+），保证日历弹窗在改期弹层之上 -->
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

        <!-- 已租出/整备期提示（主动展示不可选区间） -->
        <view v-if="dateTarget && occupiedRangesText(dateTarget.carId)" class="date-modal-occupied">
          已租出（含2天整备）：{{ occupiedRangesText(dateTarget.carId) }}，期间不可选
        </view>

        <!-- 取/还车日期 -->
        <view class="date-modal-row">
          <view class="date-modal-item">
            <text class="date-modal-label">取车日</text>
            <picker mode="date" :value="editStart" :start="editMinStart" @change="onEditStartChange">
              <view class="date-modal-value">{{ editStart || '请选择' }}</view>
            </picker>
          </view>
          <text class="date-modal-arrow">→</text>
          <view class="date-modal-item">
            <text class="date-modal-label">还车日</text>
            <picker
              mode="date"
              :value="editEnd"
              :start="dateUtil.addDays(editStart || editMinStart, 1)"
              @change="onEditEndChange"
            >
              <view class="date-modal-value">{{ editEnd || '请选择' }}</view>
            </picker>
          </view>
        </view>

        <!-- 所选日期不可租提示（已租出/整备期） -->
        <view
          v-if="dateTarget && isRangeUnavailable(dateTarget.carId, editStart, editEnd)"
          class="date-modal-warn"
        >
          所选日期车辆不可租（已租出或整备中），请重新选择
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
  margin-bottom: 24rpx;
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

.date-modal-warn {
  margin: 0 24rpx 20rpx;
  padding: 16rpx 20rpx;
  font-size: 22rpx;
  color: #ef4444;
  background-color: rgba(239, 68, 68, 0.1);
  border: 1rpx solid rgba(239, 68, 68, 0.3);
  border-radius: 10rpx;
}

.date-modal-occupied {
  margin: 0 24rpx 20rpx;
  padding: 16rpx 20rpx;
  font-size: 22rpx;
  color: #f59e0b;
  background-color: rgba(245, 158, 11, 0.1);
  border: 1rpx solid rgba(245, 158, 11, 0.3);
  border-radius: 10rpx;
}

.occupied-tip {
  font-size: 20rpx;
  color: #f59e0b;
  background-color: rgba(245, 158, 11, 0.1);
  border: 1rpx solid rgba(245, 158, 11, 0.3);
  border-radius: 6rpx;
  padding: 4rpx 12rpx;
  margin-bottom: 8rpx;
  display: inline-block;
}

.item-rent-days {
  font-size: 22rpx;
  color: var(--text-sub);
  margin-bottom: 8rpx;
}

.unavailable-tip {
  font-size: 20rpx;
  color: #ef4444;
  background-color: rgba(239, 68, 68, 0.1);
  border: 1rpx solid rgba(239, 68, 68, 0.3);
  border-radius: 6rpx;
  padding: 4rpx 12rpx;
  margin-bottom: 8rpx;
  display: inline-block;
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
