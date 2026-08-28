<script setup lang="ts">
/**
 * 我的优惠券 - 按状态分组查看
 *
 * 状态：unused（未使用）/ locked（已锁定）/ used（已使用）/ expired（已过期）
 * 未使用的券支持「去使用」跳转车辆列表
 * 面值换算规则：
 * - discount：couponValue × 10 = 折扣（0.85 → 8.5折）
 * - deduction / reduction：满减金额
 * - duration：免租天数
 */
import { reactive, ref, computed } from 'vue'
import { onShow, onPullDownRefresh } from '@dcloudio/uni-app'
import { getMyCouponsApi } from '@/api/modules/coupon'
import { moneyUtil, dateUtil } from '@/utils'
import { useThemeClass } from '@/composables/useThemeClass'
import { useNavigationBar } from '@/composables/useNavigationBar'
import type { MemberCouponVO } from '@/api/types'

const { themeClass, appStore } = useThemeClass()
/** 原生导航栏随主题切换 */
useNavigationBar()
/** 空状态图标颜色：随主题切换 */
const dimIcon = computed(() => (appStore.isDark ? '#6e6e73' : '#d1d1d6'))

type CouponStatus = 'unused' | 'locked' | 'used' | 'expired'

const couponTabs = [
  { key: 'unused' as CouponStatus, label: '未使用' },
  { key: 'locked' as CouponStatus, label: '已锁定' },
  { key: 'used' as CouponStatus, label: '已使用' },
  { key: 'expired' as CouponStatus, label: '已过期' }
]

const currentTab = ref<CouponStatus>('unused')
const loading = ref(true)

const couponsMap = reactive<Record<CouponStatus, MemberCouponVO[]>>({
  unused: [],
  locked: [],
  used: [],
  expired: []
})

onShow(() => loadCoupons(currentTab.value))

onPullDownRefresh(async () => {
  await loadCoupons(currentTab.value)
  uni.stopPullDownRefresh()
})

async function loadCoupons(status: CouponStatus) {
  loading.value = true
  try {
    const list = await getMyCouponsApi(status)
    couponsMap[status] = list || []
  } catch (e) {
    console.error('[coupons] load failed:', e)
    couponsMap[status] = []
  } finally {
    loading.value = false
  }
}

function switchTab(tab: CouponStatus) {
  if (currentTab.value === tab) return
  currentTab.value = tab
  loadCoupons(tab)
}

function goVehicleList() {
  uni.reLaunch({ url: '/pages/vehicle/list' })
}

function couponFaceValue(c: MemberCouponVO): string {
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

function formatPrice(p: number | null | undefined): string {
  return moneyUtil.format(Number(p || 0))
}
</script>

<template>
  <view class="coupons-page" :class="themeClass">
    <!-- 状态 Tabs -->
    <view class="coupon-tabs">
      <view
        v-for="ct in couponTabs"
        :key="ct.key"
        class="coupon-tab"
        :class="{ active: currentTab === ct.key }"
        @tap="switchTab(ct.key)"
      >
        {{ ct.label }}
      </view>
    </view>

    <!-- 券列表 -->
    <view v-if="couponsMap[currentTab].length" class="coupon-list">
      <view v-for="c in couponsMap[currentTab]" :key="c.id" class="coupon-card" :class="{ disabled: currentTab !== 'unused' }">
        <view class="coupon-face">
          <view class="coupon-value">{{ couponFaceValue(c) }}</view>
          <view class="coupon-name">{{ (c as any).couponName || '优惠券' }}</view>
        </view>
        <view class="coupon-info">
          <view v-if="c.minAmount" class="coupon-rule">满￥{{ formatPrice(c.minAmount) }}可用</view>
          <view v-else class="coupon-rule">无门槛</view>
          <view v-if="c.validEndTime || c.expireTime" class="coupon-valid">
            有效期至：{{ dateUtil.format(c.validEndTime || c.expireTime, 'YYYY-MM-DD') }}
          </view>
          <view v-if="currentTab === 'unused'" class="coupon-use-btn" @tap="goVehicleList">去使用</view>
        </view>
      </view>
    </view>

    <view v-else-if="!loading" class="empty-state">
      <u-icon name="coupon" :color="dimIcon" size="96rpx"></u-icon>
      <view class="empty-text">暂无{{ couponTabs.find((t) => t.key === currentTab)?.label }}优惠券</view>
    </view>
  </view>
</template>

<style scoped lang="scss">
.coupons-page {
  min-height: 100vh;
  background-color: var(--page-bg);
  box-sizing: border-box;
}

.coupon-tabs {
  display: flex;
  gap: 8rpx;
  padding: 24rpx 24rpx 0;
  overflow-x: auto;
}

.coupon-tab {
  flex-shrink: 0;
  padding: 12rpx 24rpx;
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

.coupon-list {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
  padding: 24rpx;
}

.coupon-card {
  display: flex;
  padding: 24rpx;
  background: linear-gradient(135deg, rgba(255, 46, 46, 0.12) 0%, var(--card-bg) 100%);
  border-radius: 12rpx;
  border: 1rpx solid #ff2e2e;

  &.disabled {
    background: linear-gradient(135deg, rgba(174, 174, 178, 0.08) 0%, var(--card-bg) 100%);
    border-color: rgba(128, 128, 128, 0.4);
    opacity: 0.65;

    .coupon-value {
      color: var(--text-dim);
    }
  }
}

.coupon-face {
  flex-shrink: 0;
  width: 180rpx;
  text-align: center;
  border-right: 1rpx dashed rgba(128, 128, 128, 0.4);
  padding-right: 24rpx;
}

.coupon-value {
  font-size: 40rpx;
  font-weight: 800;
  color: #ff5a3c;
  line-height: 1.2;
}

.coupon-name {
  font-size: 20rpx;
  color: var(--text-sub);
  margin-top: 4rpx;
}

.coupon-info {
  flex: 1;
  padding-left: 24rpx;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 4rpx;
}

.coupon-rule {
  font-size: 24rpx;
  color: var(--text-main);
}

.coupon-valid {
  font-size: 20rpx;
  color: var(--text-dim);
}

.coupon-use-btn {
  align-self: flex-start;
  margin-top: 8rpx;
  padding: 6rpx 16rpx;
  background-color: #ff2e2e;
  color: #fff;
  font-size: 22rpx;
  border-radius: 4rpx;
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
</style>
