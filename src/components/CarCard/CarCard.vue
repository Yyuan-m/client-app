<script setup lang="ts">
/**
 * CarCard - 车辆卡片组件（核心）
 *
 * 业务对齐原 Web 项目 CarCard 组件：
 *  - Props：car（必填，CarVO）
 *  - Emits：rent（参数为 car 对象）
 *  - 点击整卡跳详情页 `/pages/vehicle/detail?id=${car.id}`
 *  - 状态自适应：available→立即租车 / rented→已租出（按钮置灰）/ maintenance→维修中
 *  - 价格双模式：有 couponPrice 时显示划线原价 + 突出券后价
 *  - 角标：左上角热门/推荐/优惠券角标；右上角状态标签
 *  - 图片用 image + lazy-load + resolveAdminImage(car.cover)
 *
 * 适配 uni-app 关键差异：
 *  - 原图为 3 列网格的卡片样式，移动端改为单列卡片
 *  - el-button → u-button（size=mini, type=error）
 *  - el-tag → 自定义 view 标签
 *  - el-tooltip 不可用，状态原因通过状态标签下方小字提示
 *  - router.push → uni.navigateTo
 *  - @click.stop → @tap.stop（uni-app tap 事件支持 stop 修饰符）
 */
import { computed } from 'vue'
import { resolveAdminImage } from '@/utils/image'
import { moneyUtil } from '@/utils'
import type { CarVO } from '@/api/types'

/** CarCard Props */
export interface CarCardProps {
  /** 车辆数据（必填） */
  car: CarVO
}

const props = defineProps<CarCardProps>()

const emit = defineEmits<{
  /** 点击租车按钮（参数为 car 对象） */
  (e: 'rent', car: CarVO): void
}>()

/** 券后价是否有效：存在且小于原价 */
const hasCouponPrice = computed<boolean>(() => {
  const cp = (props.car as any).couponPrice
  const dp = props.car.dailyPrice
  return cp != null && Number(cp) > 0 && Number(cp) < Number(dp)
})

/** 券后价（格式化） */
const couponPriceText = computed<string>(() => {
  return moneyUtil.format(Number((props.car as any).couponPrice || 0))
})

/** 原价（格式化） */
const originalPriceText = computed<string>(() => {
  return moneyUtil.format(Number(props.car.dailyPrice || 0))
})

/** 被租状态提示文案：原因 + 最早可租日期 */
const rentStatusTip = computed<string>(() => {
  const car = props.car as any
  const parts: string[] = []
  if (car.rentReason) parts.push(`原因：${car.rentReason}`)
  if (car.availableDate) parts.push(`最早可租：${car.availableDate}`)
  return parts.join('　')
})

/** 状态名称 */
const statusName = computed<string>(() => {
  const car = props.car as any
  if (car.statusName) return car.statusName
  const s = props.car.status
  if (s === 'rented') return '已租出'
  if (s === 'maintenance') return '维修中'
  if (s === 'available') return '可租'
  return ''
})

/** 租车按钮文案：按状态区分 */
const rentBtnText = computed<string>(() => {
  const s = props.car.status
  if (s === 'rented') return '已租出'
  if (s === 'maintenance') return '维修中'
  return '立即租车'
})

/** 按钮是否禁用 */
const rentBtnDisabled = computed<boolean>(() => {
  return props.car.status !== 'available'
})

/** 优惠券角标文案 */
const couponBadgeText = computed<string>(() => {
  return (props.car as any).couponBadge || ''
})

/** 车辆标签列表（最多 3 个） */
const tagList = computed<string[]>(() => {
  const tags = (props.car.tags || (props.car as any).tagList) as string[] | undefined
  return Array.isArray(tags) ? tags.slice(0, 3) : []
})

/** 车辆图片 URL */
const coverUrl = computed<string>(() => {
  return resolveAdminImage(props.car.cover || '')
})

/** 点击整卡跳详情页 */
function goDetail(): void {
  uni.navigateTo({
    url: `/pages/vehicle/detail?id=${props.car.id}`,
    fail: (err) => {
      console.error('[CarCard] navigateTo detail failed:', err)
    }
  })
}

/** 点击租车按钮：阻止冒泡 + emit rent 事件 */
function goRent(): void {
  emit('rent', props.car)
}
</script>

<template>
  <view
    class="car-card"
    :class="{ 'is-unavailable': props.car.status !== 'available' }"
    @tap="goDetail"
  >
    <!-- 车辆图片 -->
    <view class="card-image">
      <image
        :src="coverUrl"
        mode="aspectFill"
        class="card-img"
        lazy-load
      />
      <!-- 左上角角标：热门 / 推荐 / 优惠券 -->
      <view v-if="props.car.isHot" class="card-badge badge-hot">
        <text class="badge-text">热门</text>
      </view>
      <view v-else-if="props.car.isRecommend" class="card-badge badge-rec">
        <text class="badge-text">推荐</text>
      </view>
      <view v-if="couponBadgeText" class="card-badge badge-coupon">
        <text class="badge-text">{{ couponBadgeText }}</text>
      </view>

      <!-- 右上角状态标签 -->
      <view class="card-status" :class="props.car.status">
        <text class="status-text">{{ statusName }}</text>
      </view>
    </view>

    <!-- 车辆信息 -->
    <view class="card-body">
      <text class="card-name">{{ props.car.name }}</text>

      <!-- 标签列表 -->
      <view v-if="tagList.length" class="card-tags">
        <view v-for="tag in tagList" :key="tag" class="tag-item">
          <text class="tag-text">{{ tag }}</text>
        </view>
      </view>

      <!-- 元信息 -->
      <view class="card-meta">
        <view class="meta-item">
          <text class="meta-icon">👤</text>
          <text class="meta-text">{{ props.car.seats || '-' }}座</text>
        </view>
        <view class="meta-item">
          <text class="meta-icon">⚡</text>
          <text class="meta-text">{{ props.car.displacement || '-' }}</text>
        </view>
        <view v-if="props.car.rating" class="meta-item">
          <text class="meta-icon">★</text>
          <text class="meta-text">{{ props.car.rating }}</text>
        </view>
      </view>

      <!-- 不可租原因提示 -->
      <view v-if="rentStatusTip" class="rent-tip">
        <text class="rent-tip-text">{{ rentStatusTip }}</text>
      </view>

      <!-- 底部：价格 + 操作按钮 -->
      <view class="card-footer">
        <view class="card-price">
          <!-- 有券后价：划线原价 + 突出券后价 -->
          <template v-if="hasCouponPrice">
            <view class="price-original">
              <text class="unit">￥</text>
              <text class="amount-original">{{ originalPriceText }}</text>
              <text class="unit">/天</text>
            </view>
            <view class="price-coupon">
              <view class="coupon-tag">
                <text class="coupon-tag-text">券后价</text>
              </view>
              <text class="unit">￥</text>
              <text class="amount">{{ couponPriceText }}</text>
              <text class="unit">/天起</text>
            </view>
          </template>
          <!-- 无券后价：仅显示原价 -->
          <template v-else>
            <text class="unit">￥</text>
            <text class="amount">{{ originalPriceText }}</text>
            <text class="unit">/天起</text>
          </template>
        </view>

        <view class="card-actions" @tap.stop="goRent">
          <u-button
            type="error"
            size="mini"
            shape="square"
            :text="rentBtnText"
            :disabled="rentBtnDisabled"
            :custom-style="{
              minWidth: '160rpx',
              height: '60rpx',
              fontSize: '24rpx',
              letterSpacing: '1rpx'
            }"
          />
        </view>
      </view>
    </view>
  </view>
</template>

<style scoped lang="scss">
.car-card {
  position: relative;
  background-color: var(--card-bg);
  border: 1rpx solid var(--border-color);
  border-radius: 12rpx;
  overflow: hidden;
  transition: transform 0.2s, border-color 0.2s;

  &:active {
    transform: translateY(-2rpx);
    border-color: #ff2e2e;
  }

  &.is-unavailable {
    opacity: 0.65;
    &:active {
      transform: none;
      border-color: var(--border-color);
    }
  }
}

/* ============ 图片区 ============ */
.card-image {
  position: relative;
  width: 100%;
  height: 320rpx;
  overflow: hidden;
  background-color: var(--page-bg);

  .card-img {
    width: 100%;
    height: 100%;
    transition: transform 0.4s;
  }
}

.car-card:active .card-img {
  transform: scale(1.02);
}

.card-badge {
  position: absolute;
  top: 16rpx;
  left: 16rpx;
  padding: 4rpx 16rpx;
  border-radius: 20rpx;
  font-size: 20rpx;
  font-weight: 600;
  letter-spacing: 1rpx;
  text-transform: uppercase;
  color: #fff;

  .badge-text {
    color: #fff;
    font-size: 20rpx;
    line-height: 1.4;
  }
}
.badge-hot {
  background-color: #ff5a3c;
}
.badge-rec {
  background-color: #ff2e2e;
}
.badge-coupon {
  top: 60rpx;
  background-color: #ff6b35;
}

.card-status {
  position: absolute;
  top: 16rpx;
  right: 16rpx;
  padding: 4rpx 16rpx;
  border-radius: 20rpx;
  font-size: 20rpx;
  font-weight: 600;
  letter-spacing: 1rpx;
  text-transform: uppercase;
  background-color: rgba(10, 10, 10, 0.7);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);

  .status-text {
    font-size: 20rpx;
    line-height: 1.4;
  }

  &.available .status-text {
    color: #34c759;
  }
  &.rented .status-text {
    color: #ff3b30;
  }
  &.maintenance .status-text {
    color: #ff9500;
  }
}

/* ============ 信息区 ============ */
.card-body {
  padding: 24rpx;
}

.card-name {
  font-size: 32rpx;
  font-weight: 500;
  color: var(--text-main);
  margin-bottom: 12rpx;
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.card-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 12rpx;
  margin-bottom: 16rpx;
}

.tag-item {
  padding: 4rpx 14rpx;
  border: 1rpx solid var(--border-color);
  border-radius: 20rpx;

  .tag-text {
    font-size: 20rpx;
    color: var(--text-sub);
    line-height: 1.4;
  }
}

.card-meta {
  display: flex;
  gap: 24rpx;
  margin-bottom: 16rpx;

  .meta-item {
    display: flex;
    align-items: center;
    gap: 6rpx;
  }
  .meta-icon {
    font-size: 22rpx;
    color: var(--text-dim);
  }
  .meta-text {
    font-size: 22rpx;
    color: var(--text-sub);
  }
}

.rent-tip {
  margin-bottom: 16rpx;
  padding: 8rpx 12rpx;
  background-color: rgba(255, 149, 0, 0.08);
  border-left: 4rpx solid #ff9500;
  border-radius: 4rpx;

  .rent-tip-text {
    font-size: 20rpx;
    color: #ff9500;
    line-height: 1.4;
  }
}

.card-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16rpx;
}

.card-price {
  flex: 1;
  display: flex;
  align-items: baseline;
  gap: 2rpx;
  color: var(--text-main);
  flex-wrap: wrap;

  .unit {
    font-size: 22rpx;
    color: var(--text-sub);
  }
  .amount {
    font-size: 40rpx;
    font-weight: 600;
    color: #ff5a3c;
  }

  /* 券后价模式：原价划线 + 券后价突出 */
  .price-original {
    display: flex;
    align-items: baseline;
    gap: 2rpx;
    color: var(--text-dim);
    width: 100%;

    .unit {
      color: var(--text-dim);
    }
    .amount-original {
      font-size: 26rpx;
      text-decoration: line-through;
      text-decoration-color: var(--text-dim);
    }
  }

  .price-coupon {
    display: flex;
    align-items: baseline;
    gap: 2rpx;
    margin-top: 4rpx;
    width: 100%;

    .coupon-tag {
      background-color: #ff2e2e;
      padding: 2rpx 8rpx;
      border-radius: 4rpx;
      margin-right: 6rpx;

      .coupon-tag-text {
        color: #fff;
        font-size: 18rpx;
        font-weight: 700;
        letter-spacing: 0.5rpx;
        line-height: 1.4;
      }
    }
    .amount {
      font-size: 40rpx;
      font-weight: 600;
    }
  }
}

.card-actions {
  flex-shrink: 0;
  display: flex;
  align-items: center;
}
</style>
