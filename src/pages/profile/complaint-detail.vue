<script setup lang="ts">
/**
 * 投诉详情
 *
 * onLoad: 接收 options.id，加载该投诉详情
 * 展示工单号/状态/类型/关联订单/提交时间/处理人员/描述/凭证/处理结果/满意度评分
 * 底部提供「返回」与「查看全部投诉」入口
 * API: getComplaintDetailApi / rateComplaintApi
 */
import { ref, computed } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { getComplaintDetailApi, rateComplaintApi } from '@/api/modules/complaint'
import { resolveClientImage } from '@/utils/image'
import { dateUtil } from '@/utils'
import { useThemeClass } from '@/composables/useThemeClass'
import { useNavigationBar } from '@/composables/useNavigationBar'
import type { ComplaintVO } from '@/api/types'

const { themeClass, appStore } = useThemeClass()
/** 原生导航栏随主题切换 */
useNavigationBar()
/** 空状态图标颜色：随主题切换 */
const dimIcon = computed(() => (appStore.isDark ? '#6e6e73' : '#d1d1d6'))

const STARS = [1, 2, 3, 4, 5]

const detail = ref<ComplaintVO | null>(null)
const loading = ref(true)
const rating = ref(0)
const ratingSubmitting = ref(false)
const complaintId = ref<number | string>('')

onLoad((options: Record<string, string> | undefined) => {
  const opts = options || {}
  if (!opts.id) {
    uni.showToast({ title: '参数错误', icon: 'none' })
    setTimeout(() => uni.navigateBack({ delta: 1 }), 800)
    return
  }
  complaintId.value = opts.id
  loadDetail()
})

async function loadDetail() {
  loading.value = true
  try {
    detail.value = await getComplaintDetailApi(complaintId.value)
    if (detail.value && (detail.value.satisfaction || 0) > 0) {
      rating.value = detail.value.satisfaction || 0
    }
  } catch (e) {
    console.error('[complaint-detail] load failed:', e)
    detail.value = null
  } finally {
    loading.value = false
  }
}

/** 预览凭证大图（支持多图切换） */
function previewImages(index: number) {
  const imgs = detail.value?.images || []
  if (!imgs.length) return
  appStore.openImagePreview(imgs.map((u) => resolveClientImage(u)), index)
}

function selectRating(score: number) {
  rating.value = score
}

async function submitRating() {
  if (!rating.value) {
    uni.showToast({ title: '请先选择评分', icon: 'none' })
    return
  }
  ratingSubmitting.value = true
  try {
    await rateComplaintApi(Number(complaintId.value), rating.value)
    uni.showToast({ title: '评分成功，感谢反馈', icon: 'success' })
    await loadDetail()
  } catch (e) {
    console.error('[complaint-detail] rate failed:', e)
  } finally {
    ratingSubmitting.value = false
  }
}

function goBack() {
  uni.navigateBack({ delta: 1, fail: () => uni.navigateTo({ url: '/pages/profile/complaint-list' }) })
}

function goAllList() {
  uni.redirectTo({ url: '/pages/profile/complaint-list' })
}

function formatTime(t?: string): string {
  if (!t) return '—'
  return dateUtil.format(t, 'YYYY-MM-DD HH:mm')
}
</script>

<template>
  <view class="complaint-detail-page" :class="themeClass">
    <view v-if="loading" class="page-loading">
      <u-loading-icon mode="circle" size="28" />
    </view>

    <template v-else-if="detail">
      <!-- 头部：工单号 + 状态 -->
      <view class="head-card">
        <view class="head-top">
          <view class="ticket-no">工单号：{{ detail.ticketNo }}</view>
          <view class="complaint-status" :class="'s-' + detail.status">{{ detail.statusName }}</view>
        </view>
        <view class="head-tags">
          <view class="type-tag">{{ detail.typeName }}</view>
          <view v-if="detail.orderNo" class="order-no">关联订单：{{ detail.orderNo }}</view>
        </view>
      </view>

      <!-- 基本信息 -->
      <view class="info-card">
        <view class="info-row">
          <text class="info-label">提交时间</text>
          <text class="info-value">{{ formatTime(detail.createdAt) }}</text>
        </view>
        <view class="info-row">
          <text class="info-label">处理人员</text>
          <text class="info-value">{{ detail.assignee || '—' }}</text>
        </view>
      </view>

      <!-- 投诉描述 -->
      <view class="block-card">
        <view class="block-title">投诉描述</view>
        <view class="block-desc">{{ detail.description }}</view>
        <view v-if="detail.images && detail.images.length" class="evidence-list">
          <image
            v-for="(img, i) in detail.images"
            :key="i"
            :src="resolveClientImage(img)"
            mode="aspectFill"
            class="evidence-img"
            @tap="previewImages(i)"
          />
        </view>
      </view>

      <!-- 处理结果 -->
      <view v-if="detail.solution" class="block-card solution-card">
        <view class="block-title">处理结果</view>
        <view class="block-desc">{{ detail.solution }}</view>
      </view>

      <!-- 满意度评分 -->
      <view v-if="detail.status === 'resolved'" class="block-card rate-card">
        <template v-if="(detail.satisfaction || 0) > 0">
          <view class="block-title">您的评分</view>
          <view class="rate-row">
            <view class="rate-stars">
              <u-icon
                v-for="n in STARS"
                :key="n"
                :name="n <= (detail.satisfaction || 0) ? 'star-fill' : 'star'"
                :color="n <= (detail.satisfaction || 0) ? '#ff9900' : '#d1d1d6'"
                size="40rpx"
              />
            </view>
            <text class="rate-value">{{ detail.satisfaction }} 星</text>
          </view>
        </template>
        <template v-else>
          <view class="block-title">本次处理您满意吗？</view>
          <view class="rate-row">
            <view class="rate-stars">
              <u-icon
                v-for="n in STARS"
                :key="n"
                :name="rating >= n ? 'star-fill' : 'star'"
                :color="rating >= n ? '#ff9900' : '#d1d1d6'"
                size="48rpx"
                @tap="selectRating(n)"
              />
            </view>
            <u-button
              type="primary"
              shape="square"
              size="small"
              :text="ratingSubmitting ? '提交中...' : '提交评分'"
              :loading="ratingSubmitting"
              class="rate-btn"
              @click="submitRating"
            />
          </view>
        </template>
      </view>

      <!-- 操作 -->
      <view class="actions">
        <u-button shape="square" size="medium" text="返回" class="action-btn" @click="goBack" />
        <u-button type="primary" shape="square" size="medium" text="查看全部投诉" class="action-btn" @click="goAllList" />
      </view>
    </template>

    <view v-else class="empty-state">
      <u-icon name="error-circle" :color="dimIcon" size="96rpx"></u-icon>
      <view class="empty-text">投诉不存在或已被删除</view>
      <u-button type="primary" shape="square" text="返回我的投诉" size="medium" class="empty-btn" @click="goAllList" />
    </view>
  </view>
</template>

<style scoped lang="scss">
.complaint-detail-page {
  min-height: 100vh;
  background-color: var(--page-bg);
  padding: 24rpx;
  padding-bottom: calc(48rpx + env(safe-area-inset-bottom));
  box-sizing: border-box;
}

.page-loading {
  display: flex;
  justify-content: center;
  padding: 160rpx 0;
}

/* 头部卡片 */
.head-card {
  background-color: var(--card-bg);
  border: 1rpx solid var(--border-color);
  border-radius: 16rpx;
  padding: 24rpx;
  margin-bottom: 20rpx;

  .head-top {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding-bottom: 16rpx;
    margin-bottom: 16rpx;
    border-bottom: 1rpx solid var(--border-color);

    .ticket-no {
      font-size: 26rpx;
      font-weight: 500;
      color: var(--text-main);
    }
  }

  .complaint-status {
    font-size: 22rpx;
    font-weight: 500;
    padding: 4rpx 16rpx;
    border-radius: 999rpx;

    &.s-pending {
      color: #ff9900;
      background-color: rgba(255, 153, 0, 0.14);
    }
    &.s-processing {
      color: #3b82f6;
      background-color: rgba(59, 130, 246, 0.14);
    }
    &.s-resolved {
      color: #07c160;
      background-color: rgba(7, 193, 96, 0.14);
    }
    &.s-rejected {
      color: #ef4444;
      background-color: rgba(239, 68, 68, 0.14);
    }
  }

  .head-tags {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 16rpx;

    .type-tag {
      font-size: 22rpx;
      color: #ff2e2e;
      background-color: rgba(255, 46, 46, 0.08);
      padding: 4rpx 14rpx;
      border-radius: 6rpx;
    }
    .order-no {
      font-size: 22rpx;
      color: var(--text-sub);
    }
  }
}

.info-card,
.block-card {
  background-color: var(--card-bg);
  border: 1rpx solid var(--border-color);
  border-radius: 16rpx;
  padding: 24rpx;
  margin-bottom: 20rpx;
}

.info-row {
  display: flex;
  justify-content: space-between;
  padding: 12rpx 0;

  .info-label {
    font-size: 24rpx;
    color: var(--text-dim);
  }
  .info-value {
    font-size: 24rpx;
    color: var(--text-main);
  }
}

.block-title {
  font-size: 26rpx;
  font-weight: 500;
  color: var(--text-main);
  margin-bottom: 16rpx;
}

.block-desc {
  font-size: 26rpx;
  color: var(--text-main);
  line-height: 1.7;
  word-break: break-all;
}

.evidence-list {
  display: flex;
  flex-wrap: wrap;
  gap: 12rpx;
  margin-top: 16rpx;

  .evidence-img {
    width: 150rpx;
    height: 150rpx;
    border-radius: 8rpx;
    background-color: var(--border-color);
  }
}

.solution-card .block-desc {
  color: var(--text-main);
}

/* 满意度评分 */
.rate-card {
  .rate-row {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 20rpx;

    .rate-stars {
      display: flex;
      align-items: center;
      gap: 12rpx;
    }
    .rate-value {
      font-size: 24rpx;
      color: #ff9900;
      font-weight: 500;
    }
    .rate-btn {
      flex-shrink: 0;
    }
  }
}

/* 操作按钮 */
.actions {
  display: flex;
  gap: 20rpx;
  margin-top: 8rpx;

  .action-btn {
    flex: 1;
  }
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 160rpx 0;
  gap: 12rpx;

  .empty-text {
    font-size: 28rpx;
    color: var(--text-sub);
    margin-bottom: 24rpx;
  }
  .empty-btn {
    width: 320rpx;
  }
}
</style>
