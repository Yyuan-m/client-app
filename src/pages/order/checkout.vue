<script setup lang="ts">
/**
 * 结算下单页 - v3 支持多张可叠加优惠券
 * 1:1 复刻原 Web 业务逻辑
 *
 * onLoad: Promise.all([getCitiesApi, getStoresApi, loadCoupons, cartStore.refreshPrices])
 * 优惠券：getUsableCouponsApi({ carId: firstItem.carId, amount: cartStore.totalAmount })
 * 自动预选最优券：pickBestCoupon（抵扣金额最高，时长券优先级最低）
 * 多张可叠加券：stackable===1 可叠加，时长券不参与叠加
 * 优惠券抵扣计算：moneyUtil.calcCouponDiscountBatch
 */
import { ref, reactive, computed, watch } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { useUserStore } from '@/stores/user'
import { useCartStore } from '@/stores/cart'
import { getCitiesApi, getStoresApi } from '@/api/modules/system'
import { getUsableCouponsApi } from '@/api/modules/coupon'
import { createOrderApi } from '@/api/modules/order'
import { resolveAdminImage } from '@/utils/image'
import { moneyUtil, validators, dateUtil } from '@/utils'
import type { MemberCouponVO, CityVO, StoreVO, PriceDetailVO } from '@/api/types'
import { useThemeClass } from '@/composables/useThemeClass'
import { useNavigationBar } from '@/composables/useNavigationBar'

const { themeClass } = useThemeClass()
/** 原生导航栏随主题切换 */
useNavigationBar()
const userStore = useUserStore()
const cartStore = useCartStore()

const form = reactive({
  cityId: '' as number | '' | string,
  city: '',
  store: '',
  storeId: undefined as number | undefined,
  name: userStore.user?.nickname || userStore.user?.realName || '',
  phone: userStore.user?.phone || '',
  couponUserIds: [] as number[]
})

const submitting = ref(false)
const couponDialogVisible = ref(false)
const expandedItems = ref<number[]>([])

// 城市门店
const cityList = ref<CityVO[]>([])
const storeList = ref<StoreVO[]>([])
const cityPickerShow = ref(false)
const storePickerShow = ref(false)

// 优惠券
const coupons = ref<MemberCouponVO[]>([])

onLoad(async () => {
  try {
    const [citiesRes, storesRes] = await Promise.all([
      getCitiesApi(),
      getStoresApi(),
      loadCoupons(),
      // 覆盖直接从详情页跳转结算的场景，确保价格明细已加载
      cartStore.refreshPrices()
    ])
    cityList.value = citiesRes || []
    storeList.value = storesRes || []
    // 有可用券且用户未选择时，弹窗提醒并自动预选最优优惠券
    if (coupons.value.length && !form.couponUserIds.length) {
      const best = pickBestCoupon()
      if (best) {
        form.couponUserIds = [best.id]
        couponDialogVisible.value = true
      }
    }
  } catch (e) {
    console.error('[checkout] load failed:', e)
    uni.showToast({ title: '初始化数据失败', icon: 'none' })
  }
})

// watch(() => userStore.user) immediate 回填 name/phone
watch(
  () => userStore.user,
  (u) => {
    if (u) {
      if (!form.name) form.name = u.nickname || u.realName || ''
      if (!form.phone) form.phone = u.phone || ''
    }
  },
  { immediate: true }
)

// 城市选项（u-picker 单列）
const cityColumns = computed(() => {
  return [cityList.value.map((c) => ({ label: c.name || c.cityName || `城市${c.id}`, value: c.id }))]
})

// 当前城市下可选门店
const availableStores = computed(() => {
  return storeList.value.filter((s) => form.cityId && s.cityId === form.cityId)
})

const storeColumns = computed(() => {
  return [availableStores.value.map((s) => ({ label: s.storeName || s.name || `门店${s.id}`, value: s.id }))]
})

function onCityConfirm(e: any) {
  const value = e.value && e.value[0] ? e.value[0].value : ''
  form.cityId = value
  const c = cityList.value.find((x) => x.id === value)
  form.city = c?.name || c?.cityName || ''
  form.store = ''
  form.storeId = undefined
  cityPickerShow.value = false
}

function onCityCancel() {
  cityPickerShow.value = false
}

function onStoreConfirm(e: any) {
  const value = e.value && e.value[0] ? e.value[0].value : ''
  form.storeId = value
  const s = storeList.value.find((x) => x.id === value)
  form.store = s?.storeName || s?.name || ''
  storePickerShow.value = false
}

function onStoreCancel() {
  storePickerShow.value = false
}

function currentCityLabel(): string {
  if (!form.cityId) return '请选择取车城市'
  const c = cityList.value.find((x) => x.id === form.cityId)
  return c?.name || c?.cityName || '请选择取车城市'
}

function currentStoreLabel(): string {
  if (!form.storeId) return '请选择取车门店'
  const s = storeList.value.find((x) => x.id === form.storeId)
  return s?.storeName || s?.name || '请选择取车门店'
}

// ============ 优惠券 v3 ============

// 选中的优惠券对象列表
const selectedCoupons = computed(() => coupons.value.filter((c) => form.couponUserIds.includes(c.id)))

const selectedCouponLabel = computed(() => {
  if (!selectedCoupons.value.length) return ''
  return selectedCoupons.value
    .map((c) => {
      const name = (c as any).couponName || (c.coupon && (c.coupon as any).couponName) || '优惠券'
      const val = couponFaceValue(c)
      return `${name}（${val}）`
    })
    .join('、')
})

// 优惠券面额展示
function couponFaceValue(c: MemberCouponVO): string {
  if (!c) return ''
  const type = c.couponType || c.type || (c.coupon as any)?.couponType
  const v = Number(c.couponValue ?? c.value ?? (c.coupon as any)?.couponValue ?? 0)
  if (type === 'discount') {
    const t = v * 10
    return `${Number.isInteger(t) ? t : t.toFixed(1)}折`
  }
  if (type === 'deduction' || type === 'reduction') return `减￥${moneyUtil.format(v)}`
  if (type === 'duration') return `免${v || 1}天`
  return '优惠'
}

// 优惠券是否真正可用（门槛校验）
function isCouponUsable(c: MemberCouponVO): boolean {
  if (!c) return false
  const rent = cartStore.totalAmount
  return moneyUtil.calcCouponDiscount(rent, normalizeCoupon(c)) > 0 || (c.couponType || c.type) === 'duration'
}

// 将 member_coupon 字段归一化为 coupon 模板字段
function normalizeCoupon(c: MemberCouponVO) {
  return {
    type: c.couponType || c.type || (c.coupon as any)?.couponType,
    value: c.couponValue ?? c.value ?? (c.coupon as any)?.couponValue,
    minAmount: c.minAmount ?? (c.coupon as any)?.minAmount,
    discountCap: c.discountCap ?? (c.coupon as any)?.discountCap
  }
}

// 判断某张券在当前多选场景下是否被禁用
function isCouponDisabled(c: MemberCouponVO): boolean {
  if (!isCouponUsable(c)) return true
  if (isSelected(c)) return false
  // 未选中时校验叠加规则
  if (form.couponUserIds.length === 0) return false
  if ((c.couponType || c.type) === 'duration') return true
  if (c.stackable !== 1) return true
  for (const id of form.couponUserIds) {
    const sc = coupons.value.find((x) => x.id === id)
    if (!sc) continue
    if ((sc.couponType || sc.type) === 'duration') return true
    if (sc.stackable !== 1) return true
  }
  return false
}

function isSelected(c: MemberCouponVO): boolean {
  return form.couponUserIds.includes(c.id)
}

function toggleCoupon(c: MemberCouponVO) {
  if (isCouponDisabled(c)) {
    if (!isCouponUsable(c)) {
      uni.showToast({ title: '该优惠券不满足使用条件', icon: 'none' })
    } else {
      uni.showToast({ title: '该优惠券不可与已选优惠券叠加使用', icon: 'none' })
    }
    return
  }
  const idx = form.couponUserIds.indexOf(c.id)
  if (idx > -1) {
    form.couponUserIds.splice(idx, 1)
  } else {
    form.couponUserIds.push(c.id)
  }
}

// 优惠券抵扣金额（v3 批量叠加）
const couponDiscount = computed(() => {
  if (!form.couponUserIds.length) return 0
  const selected = selectedCoupons.value
  if (!selected.length) return 0
  const rent = cartStore.totalAmount
  const amountCoupons = selected.filter((c) => (c.couponType || c.type) !== 'duration')
  if (!amountCoupons.length) return 0
  return moneyUtil.calcCouponDiscountBatch(rent, amountCoupons.map(normalizeCoupon) as any)
})

const finalTotal = computed(() => Math.max(0, cartStore.grandTotal - couponDiscount.value))

// 加载可用优惠券
async function loadCoupons() {
  if (!cartStore.selectedCount) {
    coupons.value = []
    return
  }
  const firstItem = cartStore.selectedItems[0]
  try {
    const list = await getUsableCouponsApi({
      carId: firstItem?.carId,
      amount: cartStore.totalAmount
    })
    coupons.value = list || []
  } catch (e) {
    console.error('[checkout] loadCoupons failed:', e)
    coupons.value = []
  }
}

// 选择最优优惠券
function pickBestCoupon(): MemberCouponVO | null {
  if (!coupons.value.length) return null
  const rent = cartStore.totalAmount
  let best: MemberCouponVO | null = null
  let bestDiscount = 0
  for (const c of coupons.value) {
    const type = c.couponType || c.type
    if (type === 'duration') continue
    const d = moneyUtil.calcCouponDiscount(rent, normalizeCoupon(c) as any)
    if (d > bestDiscount) {
      bestDiscount = d
      best = c
    }
  }
  if (!best && coupons.value.length) {
    best = coupons.value.find((c) => (c.couponType || c.type) === 'duration') || null
  }
  return best
}

function openCouponDialog() {
  couponDialogVisible.value = true
}

function clearCoupon() {
  form.couponUserIds = []
}

function skipCoupon() {
  form.couponUserIds = []
  couponDialogVisible.value = false
}

function useCouponNow() {
  if (!form.couponUserIds.length) {
    const best = pickBestCoupon()
    if (best == null) {
      uni.showToast({ title: '暂无可用优惠券', icon: 'none' })
      return
    }
    form.couponUserIds = [best.id]
  }
  couponDialogVisible.value = false
  uni.showToast({ title: '优惠券使用成功', icon: 'success' })
}

// 价格明细展开
function toggleItemDetail(carId: number) {
  const idx = expandedItems.value.indexOf(carId)
  if (idx > -1) expandedItems.value.splice(idx, 1)
  else expandedItems.value.push(carId)
}

function priceDetailOf(carId: number): PriceDetailVO | undefined {
  return cartStore.getPriceDetail(carId)
}

function formatPrice(p: number | null | undefined): string {
  return moneyUtil.format(Number(p || 0))
}

// 表单校验
function validate(): boolean {
  if (!form.cityId) {
    uni.showToast({ title: '请选择取车城市', icon: 'none' })
    return false
  }
  if (!form.store) {
    uni.showToast({ title: '请选择取车门店', icon: 'none' })
    return false
  }
  if (!form.name.trim()) {
    uni.showToast({ title: '请填写联系人姓名', icon: 'none' })
    return false
  }
  if (!validators.isPhone(form.phone)) {
    uni.showToast({ title: '请输入正确的手机号', icon: 'none' })
    return false
  }
  return true
}

// 实名认证拦截：未完成实名与驾驶证认证不允许提交订单
// 返回 true 表示已认证可继续，false 表示已弹窗拦截
async function checkVerified(): Promise<boolean> {
  if (userStore.user?.verifyStatus === 'verified') return true
  // 本地缓存可能过期，刷新一次用户信息确保认证状态准确
  try {
    await userStore.fetchUserInfo()
  } catch (e) {
    console.error('[checkout] fetchUserInfo failed:', e)
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

// 提交订单
async function submitOrder() {
  if (!cartStore.selectedCount) {
    uni.showToast({ title: '请先选择要结算的车辆', icon: 'none' })
    return
  }
  if (!validate()) return
  // 守卫：未完成实名认证不允许下单
  if (!(await checkVerified())) return
  // 守卫：价格未加载完成或失败时禁止提交
  if (cartStore.priceLoading) {
    uni.showToast({ title: '价格计算中，请稍候', icon: 'none' })
    return
  }
  if (!cartStore.priceDetails.length) {
    uni.showToast({ title: '价格加载失败，请刷新重试', icon: 'none' })
    return
  }

  submitting.value = true
  let res: { id: number }
  try {
    res = await createOrderApi({
      cityId: form.cityId ? Number(form.cityId) : undefined,
      city: form.city,
      store: form.store,
      storeId: form.storeId,
      name: form.name.trim(),
      phone: form.phone.trim(),
      couponUserIds: form.couponUserIds,
      items: cartStore.selectedItems.map((i) => ({
        carId: i.carId,
        startDate: i.startDate,
        endDate: i.endDate,
        days: i.days
      }))
    })
  } catch (e) {
    console.error('[checkout] submitOrder failed:', e)
    submitting.value = false
    return
  }
  // 订单已创建成功，清空已选中商品（失败不阻塞跳转）
  try {
    await cartStore.clearSelected()
  } catch (e) {
    console.error('[checkout] clearSelected failed:', e)
  }
  submitting.value = false

  // 一单多车：下单成功即跳转订单详情页，由用户在详情页点击支付，将订单内所有车辆一起支付
  uni.showToast({ title: '下单成功', icon: 'success' })
  setTimeout(() => {
    uni.redirectTo({ url: `/pages/order/detail?id=${res.id}` })
  }, 600)
}

function goCart() {
  uni.navigateBack({
    delta: 1,
    fail: () => {
      uni.reLaunch({ url: '/pages/cart/index' })
    }
  })
}
</script>

<template>
  <view class="checkout-page" :class="themeClass">
    <!-- 空结算：未选车辆 -->
    <view v-if="!cartStore.selectedCount" class="empty-state">
      <view class="empty-icon">🛒</view>
      <view class="empty-text">请先在购物车选择要结算的车辆</view>
      <u-button text="去购物车" type="primary" shape="square" @click="goCart" class="go-btn" />
    </view>

    <view v-else class="checkout-content">
      <!-- 订单概览 -->
      <view class="section-title" style="display:flex; align-items:center; gap:12rpx;">
        <text>订单概览</text>
        <text v-if="cartStore.selectedCount > 1" class="overview-count">共 {{ cartStore.selectedCount }} 辆</text>
      </view>
      <view v-for="item in cartStore.selectedItems" :key="item.carId" class="order-item">
        <image :src="resolveAdminImage(item.cover)" mode="aspectFill" class="item-img" />
        <view class="item-info">
          <view class="item-name">{{ item.carName }}</view>
          <view class="item-date">{{ item.startDate }} 至 {{ item.endDate }}（{{ item.days }}天）</view>
          <view class="item-price">￥{{ formatPrice(item.dailyPrice) }}/天</view>
          <!-- 价格明细摘要 -->
          <view v-if="priceDetailOf(item.carId)" class="price-summary">
            <text v-if="Number(priceDetailOf(item.carId)?.discountAmount) > 0" class="tag tag-discount">
              {{ priceDetailOf(item.carId)?.durationTierName }}折扣 -￥{{ formatPrice(priceDetailOf(item.carId)?.discountAmount) }}
            </text>
            <text v-if="(priceDetailOf(item.carId)?.holidayDays || 0) > 0" class="tag tag-holiday">
              含{{ priceDetailOf(item.carId)?.holidayDays }}天假日 +￥{{ formatPrice(priceDetailOf(item.carId)?.holidaySurchargeAmount) }}
            </text>
          </view>
          <view class="detail-toggle" @tap="toggleItemDetail(item.carId)">
            {{ expandedItems.includes(item.carId) ? '收起明细' : '查看价格明细' }}
          </view>
          <!-- 价格详情展开区 -->
          <view v-if="expandedItems.includes(item.carId) && priceDetailOf(item.carId)" class="item-price-detail">
            <view class="detail-row">
              <text>工作日</text>
              <text>{{ priceDetailOf(item.carId)?.normalDays }} 天 × ￥{{ formatPrice(item.dailyPrice) }}</text>
            </view>
            <view v-if="(priceDetailOf(item.carId)?.holidayDays || 0) > 0" class="detail-row">
              <text>假日/周末</text>
              <text>{{ priceDetailOf(item.carId)?.holidayDays }} 天 × ￥{{ formatPrice(item.dailyPrice) }} × {{ Number(priceDetailOf(item.carId)?.holidaySurcharge).toFixed(2) }}</text>
            </view>
            <view class="detail-row">
              <text>折扣前小计</text>
              <text>￥{{ formatPrice(priceDetailOf(item.carId)?.subtotal) }}</text>
            </view>
            <view v-if="Number(priceDetailOf(item.carId)?.discountAmount) > 0" class="detail-row discount">
              <text>{{ priceDetailOf(item.carId)?.durationTierName }}折扣</text>
              <text>-￥{{ formatPrice(priceDetailOf(item.carId)?.discountAmount) }}</text>
            </view>
            <view class="detail-row">
              <text>租金</text>
              <text>￥{{ formatPrice(priceDetailOf(item.carId)?.rentAmount) }}</text>
            </view>
            <view class="detail-row detail-total">
              <text>小计</text>
              <text>￥{{ formatPrice(priceDetailOf(item.carId)?.totalAmount) }}</text>
            </view>
          </view>
        </view>
        <view class="item-amount" v-if="priceDetailOf(item.carId)">￥{{ formatPrice(priceDetailOf(item.carId)?.totalAmount) }}</view>
        <view class="item-amount" v-else>—</view>
      </view>

      <!-- 取还车信息表单 -->
      <view class="section-title">取还车信息</view>
      <view class="card form-card">
        <view class="form-item" @tap="cityPickerShow = true">
          <view class="form-label">取车城市 <text class="required">*</text></view>
          <view class="picker-value" :class="{ placeholder: !form.cityId }">{{ currentCityLabel() }} ▾</view>
        </view>
        <view class="form-item" @tap="storePickerShow = !!form.cityId">
          <view class="form-label">取车门店 <text class="required">*</text></view>
          <view class="picker-value" :class="{ placeholder: !form.storeId }">{{ currentStoreLabel() }} ▾</view>
        </view>
        <view class="form-item">
          <view class="form-label">联系人 <text class="required">*</text></view>
          <u-input v-model="form.name" placeholder="请输入联系人姓名" maxlength="20" border="surround" />
        </view>
        <view class="form-item">
          <view class="form-label">联系电话 <text class="required">*</text></view>
          <u-input v-model="form.phone" type="number" placeholder="请输入手机号" maxlength="11" border="surround" />
        </view>
        <view class="form-item">
          <view class="form-label">优惠券</view>
          <view class="coupon-row">
            <view v-if="selectedCoupons.length" class="coupon-current">
              <text class="cc-label">{{ selectedCouponLabel }}</text>
              <text class="cc-action" @tap="openCouponDialog">更换</text>
              <text class="cc-action cc-clear" @tap="clearCoupon">不使用</text>
            </view>
            <view v-else class="coupon-empty" @tap="openCouponDialog">
              <text>{{ coupons.length ? '选择优惠券' : '暂无可用优惠券' }}</text>
              <text v-if="coupons.length" class="ce-count">{{ coupons.length }}张可用</text>
            </view>
          </view>
        </view>
      </view>

      <!-- 费用明细 -->
      <view class="section-title">费用明细</view>
      <view class="card summary-card">
        <view class="summary-row">
          <text>租金合计</text>
          <text>￥{{ formatPrice(cartStore.totalAmount) }}</text>
        </view>
        <view v-if="couponDiscount > 0" class="summary-row discount">
          <text>优惠券抵扣</text>
          <text>-￥{{ formatPrice(couponDiscount) }}</text>
        </view>
        <view class="summary-divider"></view>
        <view class="summary-row total">
          <text>券后应付</text>
          <text class="text-price">￥{{ formatPrice(finalTotal) }}</text>
        </view>
        <view v-if="couponDiscount > 0" class="save-tip">已为您节省 ￥{{ formatPrice(couponDiscount) }}</view>
        <view v-if="cartStore.priceLoading" class="price-tip">价格计算中…</view>
        <view v-else-if="!cartStore.priceDetails.length" class="price-tip">价格加载失败，请刷新重试</view>
        <u-button type="primary" shape="square" text="提交订单" :loading="submitting" :disabled="cartStore.priceLoading || !cartStore.priceDetails.length" @click="submitOrder" class="submit-btn" />
      </view>
    </view>

    <!-- 城市 Picker -->
    <u-picker
      :show="cityPickerShow"
      :columns="cityColumns"
      @confirm="onCityConfirm"
      @cancel="onCityCancel"
      keyName="label"
    />

    <!-- 门店 Picker -->
    <u-picker
      :show="storePickerShow"
      :columns="storeColumns"
      @confirm="onStoreConfirm"
      @cancel="onStoreCancel"
      keyName="label"
    />

    <!-- 优惠券选择弹窗 -->
    <u-popup :show="couponDialogVisible" mode="bottom" round="16" @close="() => couponDialogVisible = false">
      <view class="coupon-dialog">
        <view class="cd-title">选择优惠券</view>
        <view class="cd-tip">单次订单默认使用一张优惠券；标有「可叠加」的可同时使用多张，时长券不支持叠加。</view>
        <view v-if="coupons.length" class="cd-list">
          <view
            v-for="c in coupons"
            :key="c.id"
            class="cd-item"
            :class="{ active: isSelected(c), disabled: isCouponDisabled(c) }"
            @tap="toggleCoupon(c)"
          >
            <view class="cd-item-face">
              <view class="cd-face-value">{{ couponFaceValue(c) }}</view>
              <view class="cd-face-name">{{ (c as any).couponName || '优惠券' }}</view>
            </view>
            <view class="cd-item-info">
              <view v-if="c.minAmount" class="cd-rule">满￥{{ formatPrice(c.minAmount) }}可用</view>
              <view v-else class="cd-rule">无门槛</view>
              <view v-if="c.stackable === 1" class="cd-stack-tag">可叠加</view>
              <view v-if="c.validEndTime || c.expireTime" class="cd-valid">
                有效期至：{{ dateUtil.format(c.validEndTime || c.expireTime, 'YYYY-MM-DD') }}
              </view>
            </view>
            <view class="cd-check" :class="{ checked: isSelected(c) }">
              <text v-if="isSelected(c)" class="cd-check-icon">✓</text>
            </view>
          </view>
        </view>
        <view v-else class="cd-empty">暂无可用优惠券</view>
        <view class="cd-actions">
          <view class="cd-btn cd-btn-skip" @tap="skipCoupon">暂不使用</view>
          <view class="cd-btn cd-btn-use" @tap="useCouponNow">立即使用</view>
        </view>
      </view>
    </u-popup>
  </view>
</template>

<style scoped lang="scss">
.checkout-page {
  min-height: 100vh;
  background-color: var(--page-bg);
  padding: 0 24rpx calc(48rpx + env(safe-area-inset-bottom));
}

.empty-state {
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

.go-btn {
  width: 320rpx;
}

.section-title {
  font-size: 32rpx;
  font-weight: 600;
  color: var(--text-main);
  margin: 32rpx 0 16rpx;
}

/* 订单概览标题的车辆数角标 */
.overview-count {
  font-size: 22rpx;
  font-weight: 400;
  color: var(--text-sub);
  background-color: var(--border-color);
  padding: 2rpx 12rpx;
  border-radius: 30rpx;
}

/* 订单概览 */
.order-item {
  display: flex;
  padding: 24rpx 0;
  border-bottom: 1rpx solid var(--border-color);
}

.item-img {
  width: 160rpx;
  height: 120rpx;
  border-radius: 8rpx;
  flex-shrink: 0;
  background-color: var(--border-color);
}

.item-info {
  flex: 1;
  min-width: 0;
  padding-left: 16rpx;
}

.item-name {
  font-size: 28rpx;
  font-weight: 500;
  color: var(--text-main);
  margin-bottom: 8rpx;
}

.item-date,
.item-price {
  font-size: 22rpx;
  color: var(--text-sub);
  margin-bottom: 8rpx;
}

.price-summary {
  display: flex;
  flex-wrap: wrap;
  gap: 8rpx;
  margin: 8rpx 0;
}

.tag {
  font-size: 20rpx;
  padding: 2rpx 8rpx;
  border-radius: 4rpx;
}

.tag-discount { background-color: rgba(7, 193, 96, 0.18); color: #07c160; }
.tag-holiday { background-color: rgba(255, 153, 0, 0.18); color: #ff9900; }

.detail-toggle {
  font-size: 22rpx;
  color: #ff2e2e;
  margin-top: 4rpx;
}

.item-price-detail {
  margin-top: 12rpx;
  padding: 16rpx;
  background-color: var(--border-color);
  border-radius: 8rpx;
  border-left: 4rpx solid #ff2e2e;
}

.detail-row {
  display: flex;
  justify-content: space-between;
  font-size: 22rpx;
  color: var(--text-sub);
  padding: 4rpx 0;

  &.discount {
    color: #07c160;
  }

  &.detail-total {
    margin-top: 8rpx;
    padding-top: 12rpx;
    border-top: 1rpx dashed var(--border-color);
    color: var(--text-main);
    font-weight: 600;
    font-size: 26rpx;
  }
}

.item-amount {
  font-weight: 600;
  color: var(--text-main);
  font-size: 28rpx;
  margin-left: 16rpx;
  flex-shrink: 0;
}

/* 表单 */
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
  color: var(--text-main);
  font-weight: 500;
}

.required {
  color: #ff2e2e;
}

.picker-value {
  height: 80rpx;
  line-height: 80rpx;
  padding: 0 24rpx;
  background-color: var(--border-color);
  border-radius: 8rpx;
  font-size: 28rpx;
  color: var(--text-main);

  &.placeholder {
    color: var(--text-dim);
  }
}

/* 优惠券选择入口 */
.coupon-row {
  width: 100%;
}

.coupon-current {
  display: flex;
  align-items: center;
  gap: 16rpx;
  padding: 16rpx 24rpx;
  background-color: rgba(255, 46, 46, 0.06);
  border: 1rpx solid #ff2e2e;
  border-radius: 8rpx;
}

.cc-label {
  flex: 1;
  font-size: 24rpx;
  color: #ff2e2e;
  font-weight: 500;
}

.cc-action {
  font-size: 24rpx;
  color: #ff2e2e;
}

.cc-clear {
  color: var(--text-dim);
}

.coupon-empty {
  display: flex;
  justify-content: space-between;
  padding: 16rpx 24rpx;
  background-color: var(--border-color);
  border-radius: 8rpx;
  font-size: 26rpx;
  color: var(--text-main);
}

.ce-count {
  font-size: 22rpx;
  color: #ff2e2e;
}

/* 费用明细 */
.summary-card {
  padding: 32rpx 24rpx;
}

.summary-row {
  display: flex;
  justify-content: space-between;
  font-size: 26rpx;
  color: var(--text-sub);
  margin-bottom: 16rpx;

  &.discount {
    color: #07c160;
  }

  &.total {
    font-size: 32rpx;
    font-weight: 700;
    color: var(--text-main);
  }
}

.summary-divider {
  height: 1rpx;
  background-color: var(--border-color);
  margin: 8rpx 0 16rpx;
}

.save-tip {
  margin-top: 8rpx;
  font-size: 22rpx;
  color: #ff2e2e;
  text-align: right;
}

.price-tip {
  margin-top: 12rpx;
  font-size: 22rpx;
  color: var(--text-dim);
  text-align: center;
}

.submit-btn {
  margin-top: 24rpx;
}

/* 优惠券弹窗 */
.coupon-dialog {
  padding: 32rpx 24rpx calc(32rpx + env(safe-area-inset-bottom));
  max-height: 80vh;
  display: flex;
  flex-direction: column;
}

.cd-title {
  font-size: 36rpx;
  font-weight: 700;
  color: var(--text-main);
  text-align: center;
  margin-bottom: 16rpx;
}

.cd-tip {
  font-size: 22rpx;
  color: var(--text-sub);
  margin-bottom: 24rpx;
  line-height: 1.6;
}

.cd-list {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 16rpx;
  margin-bottom: 24rpx;
}

.cd-item {
  position: relative;
  display: flex;
  padding: 24rpx;
  background-color: var(--border-color);
  border-radius: 12rpx;
  border: 2rpx solid transparent;

  &.active {
    border-color: #ff2e2e;
  }

  &.disabled {
    opacity: 0.5;
  }
}

.cd-item-face {
  flex-shrink: 0;
  width: 160rpx;
  text-align: center;
  border-right: 1rpx dashed var(--border-color);
  padding-right: 24rpx;
}

.cd-face-value {
  font-size: 36rpx;
  font-weight: 700;
  color: #ff5a3c;
  margin-bottom: 4rpx;
}

.cd-face-name {
  font-size: 20rpx;
  color: var(--text-sub);
}

.cd-item-info {
  flex: 1;
  padding-left: 24rpx;
  display: flex;
  flex-direction: column;
  gap: 4rpx;
}

.cd-rule {
  font-size: 24rpx;
  color: var(--text-main);
}

.cd-stack-tag {
  font-size: 20rpx;
  color: #ff5a3c;
  border: 1rpx solid #ff5a3c;
  border-radius: 4rpx;
  padding: 2rpx 8rpx;
  align-self: flex-start;
}

.cd-valid {
  font-size: 20rpx;
  color: var(--text-dim);
}

.cd-check {
  position: absolute;
  top: 24rpx;
  right: 24rpx;
  width: 36rpx;
  height: 36rpx;
  border-radius: 50%;
  border: 2rpx solid var(--border-color);
  display: flex;
  align-items: center;
  justify-content: center;

  &.checked {
    background-color: #ff2e2e;
    border-color: #ff2e2e;
  }
}

.cd-check-icon {
  color: #fff;
  font-size: 22rpx;
  font-weight: 700;
}

.cd-empty {
  padding: 48rpx 0;
  text-align: center;
  color: var(--text-dim);
}

.cd-actions {
  display: flex;
  gap: 16rpx;
}

.cd-btn {
  flex: 1;
  height: 80rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 28rpx;
  border-radius: 8rpx;
}

.cd-btn-skip {
  background-color: var(--border-color);
  color: var(--text-main);
}

.cd-btn-use {
  background-color: #ff2e2e;
  color: #fff;
}
</style>
