<script setup lang="ts">
/**
 * 我的投诉 - 投诉记录列表
 *
 * 分页展示当前账号提交的投诉，含类型/状态/凭证缩略图/处理结果/处理人员/满意度评分
 * 顶部提供「去投诉」入口；点击卡片进入投诉详情
 * API: getMyComplaintsApi / rateComplaintApi
 */
import { ref, computed } from 'vue'
import { onShow, onPullDownRefresh, onReachBottom } from '@dcloudio/uni-app'
import { getMyComplaintsApi, rateComplaintApi } from '@/api/modules/complaint'
import { getDictByTypeApi } from '@/api/modules/system'
import { resolveClientImage } from '@/utils/image'
import { dateUtil } from '@/utils'
import { useThemeClass } from '@/composables/useThemeClass'
import { useNavigationBar } from '@/composables/useNavigationBar'
import type { ComplaintVO, DictDataVO } from '@/api/types'

const { themeClass, appStore } = useThemeClass()
/** 原生导航栏随主题切换 */
useNavigationBar()
/** 空状态图标颜色：随主题切换 */
const dimIcon = computed(() => (appStore.isDark ? '#6e6e73' : '#d1d1d6'))

const PAGE_SIZE = 10
const list = ref<ComplaintVO[]>([])
const total = ref(0)
const page = ref(1)
const loading = ref(false)
const finished = ref(false)

// 投诉类型筛选（字典 complaint_type，空串=全部）
const filterTypes = ref<DictDataVO[]>([])
const filterType = ref('')

onShow(() => {
  page.value = 1
  finished.value = false
  list.value = []
  loadTypes()
  loadList()
})

/** 加载投诉类型字典（筛选用） */
async function loadTypes() {
  try {
    filterTypes.value = (await getDictByTypeApi('complaint_type')) || []
  } catch (e) {
    console.error('[complaint-list] load types failed:', e)
    filterTypes.value = []
  }
}

/** 切换类型筛选：重置页码并重新加载 */
function selectFilterType(type: string) {
  if (filterType.value === type) return
  filterType.value = type
  page.value = 1
  finished.value = false
  list.value = []
  loadList()
}

onPullDownRefresh(async () => {
  page.value = 1
  finished.value = false
  list.value = []
  await loadList()
  uni.stopPullDownRefresh()
})

onReachBottom(() => {
  if (!finished.value && !loading.value) {
    page.value += 1
    loadList()
  }
})

async function loadList() {
  if (loading.value) return
  loading.value = true
  try {
    const params: { page: number; pageSize: number; type?: string } = { page: page.value, pageSize: PAGE_SIZE }
    if (filterType.value) params.type = filterType.value
    const res = await getMyComplaintsApi(params)
    list.value = page.value === 1 ? (res.list || []) : [...list.value, ...(res.list || [])]
    total.value = res.total || 0
    finished.value = list.value.length >= total.value
  } catch (e) {
    console.error('[complaint-list] load failed:', e)
  } finally {
    loading.value = false
  }
}

function goSubmit() {
  uni.navigateTo({ url: '/pages/profile/complaint' })
}

/** 进入投诉详情 */
function goDetail(item: ComplaintVO) {
  uni.navigateTo({ url: `/pages/profile/complaint-detail?id=${item.id}` })
}

/** 预览凭证大图（支持多图切换） */
function previewImages(item: ComplaintVO, index: number) {
  const imgs = item.images || []
  if (!imgs.length) return
  appStore.openImagePreview(imgs.map((u) => resolveClientImage(u)), index)
}

function formatTime(t?: string): string {
  if (!t) return '—'
  return dateUtil.format(t, 'YYYY-MM-DD HH:mm')
}

// ============ 满意度评分 ============
const STARS = [1, 2, 3, 4, 5]
/** 每个工单当前选择的星级 */
const ratingMap = ref<Record<number, number>>({})
/** 正在提交评分的工单 id */
const ratingSubmittingId = ref<number | null>(null)

function selectRating(item: ComplaintVO, score: number) {
  ratingMap.value[item.id] = score
}

async function submitRating(item: ComplaintVO) {
  const score = ratingMap.value[item.id]
  if (!score) {
    uni.showToast({ title: '请先选择评分', icon: 'none' })
    return
  }
  ratingSubmittingId.value = item.id
  try {
    await rateComplaintApi(item.id, score)
    uni.showToast({ title: '评分成功，感谢反馈', icon: 'success' })
    // 刷新列表使该工单变为"已评分"只读态
    await loadList()
  } catch (e) {
    console.error('[complaint-list] rate failed:', e)
  } finally {
    ratingSubmittingId.value = null
  }
}
</script>

<template>
  <view class="complaint-list-page" :class="themeClass">
    <!-- 去投诉入口 -->
    <view class="complaint-entry" @tap="goSubmit">
      <view class="ce-icon"><u-icon name="warning" size="40rpx" color="#fff"></u-icon></view>
      <view class="ce-main">
        <view class="ce-title">遇到用车问题？</view>
        <view class="ce-desc">车况、服务、费用、押金、违章等均可提交投诉</view>
      </view>
      <view class="ce-btn">去投诉</view>
    </view>

    <!-- 投诉类型筛选 -->
    <scroll-view scroll-x class="filter-bar" :show-scrollbar="false">
      <view class="filter-chip" :class="{ active: filterType === '' }" @tap="selectFilterType('')">全部</view>
      <view
        v-for="t in filterTypes"
        :key="t.dictValue"
        class="filter-chip"
        :class="{ active: filterType === t.dictValue }"
        @tap="selectFilterType(t.dictValue)"
      >{{ t.dictLabel }}</view>
    </scroll-view>

    <view v-if="list.length" class="complaint-list">
      <view v-for="item in list" :key="item.id" class="complaint-card" @tap="goDetail(item)">
        <!-- 头部：工单号 + 状态 -->
        <view class="card-header">
          <view class="ticket-no">工单号：{{ item.ticketNo }}</view>
          <view class="complaint-status" :class="'s-' + item.status">{{ item.statusName }}</view>
        </view>

        <!-- 标签区：类型 + 关联订单 -->
        <view class="card-tags">
          <view class="type-tag">{{ item.typeName }}</view>
          <view v-if="item.orderNo" class="order-no">关联订单：{{ item.orderNo }}</view>
        </view>

        <view class="complaint-desc">{{ item.description }}</view>

        <!-- 凭证图片 -->
        <view v-if="item.images && item.images.length" class="evidence-list" @tap.stop>
          <image
            v-for="(img, i) in item.images"
            :key="i"
            :src="resolveClientImage(img)"
            mode="aspectFill"
            class="evidence-img"
            @tap="previewImages(item, i)"
          />
        </view>

        <!-- 处理结果 + 处理人员 -->
        <view v-if="item.solution" class="solution-block">
          <view class="sol-row">
            <text class="sol-label">处理结果：</text>
            <text class="sol-text">{{ item.solution }}</text>
          </view>
          <view v-if="item.assignee" class="sol-assignee">处理人员：{{ item.assignee }}</view>
        </view>

        <!-- 满意度评分：已解决且未评分 → 可打分；已评分 → 只读展示 -->
        <view v-if="item.status === 'resolved'" class="rate-block" @tap.stop>
          <template v-if="(item.satisfaction || 0) > 0">
            <text class="rate-label">您的评分：</text>
            <view class="rate-stars">
              <u-icon
                v-for="n in STARS"
                :key="n"
                :name="n <= (item.satisfaction || 0) ? 'star-fill' : 'star'"
                :color="n <= (item.satisfaction || 0) ? '#ff9900' : '#d1d1d6'"
                size="36rpx"
              />
            </view>
            <text class="rate-value">{{ item.satisfaction }} 星</text>
          </template>
          <template v-else>
            <text class="rate-label">本次处理您满意吗？</text>
            <view class="rate-stars">
              <u-icon
                v-for="n in STARS"
                :key="n"
                :name="(ratingMap[item.id] || 0) >= n ? 'star-fill' : 'star'"
                :color="(ratingMap[item.id] || 0) >= n ? '#ff9900' : '#d1d1d6'"
                size="44rpx"
                @tap="selectRating(item, n)"
              />
            </view>
            <view class="rate-submit">
              <u-button
                type="primary"
                shape="square"
                size="small"
                :text="ratingSubmittingId === item.id ? '提交中...' : '提交评分'"
                :loading="ratingSubmittingId === item.id"
                @click="submitRating(item)"
              />
            </view>
          </template>
        </view>

        <!-- 底部：时间 + 查看详情 -->
        <view class="card-footer">
          <text class="create-time">提交于 {{ formatTime(item.createdAt) }}</text>
          <text class="view-detail">查看详情 ›</text>
        </view>
      </view>

      <view v-if="loading" class="load-more">加载中...</view>
      <view v-else-if="finished" class="load-more">{{ list.length ? '— 没有更多了 —' : '' }}</view>
    </view>

    <view v-else-if="!loading" class="empty-state">
      <u-icon name="error-circle" :color="dimIcon" size="96rpx"></u-icon>
      <view class="empty-text">暂无投诉记录</view>
      <view class="empty-sub">如遇车况、服务、费用等问题，欢迎提交投诉</view>
      <u-button type="primary" shape="square" text="去投诉" size="medium" class="empty-btn" @click="goSubmit" />
    </view>

    <!-- 底部固定去投诉按钮 -->
    <view v-if="list.length" class="bottom-bar">
      <u-button type="primary" shape="square" text="去投诉" @click="goSubmit" />
    </view>
  </view>
</template>

<style scoped lang="scss">
.complaint-list-page {
  min-height: 100vh;
  background-color: var(--page-bg);
  padding: 24rpx;
  padding-bottom: calc(140rpx + env(safe-area-inset-bottom));
  box-sizing: border-box;
}

/* 去投诉入口 */
.complaint-entry {
  display: flex;
  align-items: center;
  gap: 20rpx;
  padding: 24rpx;
  margin-bottom: 20rpx;
  background-color: rgba(255, 46, 46, 0.06);
  border: 1rpx solid rgba(255, 46, 46, 0.25);
  border-radius: 16rpx;

  .ce-icon {
    width: 72rpx;
    height: 72rpx;
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 12rpx;
    background-color: #ff2e2e;
  }

  .ce-main {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 6rpx;

    .ce-title {
      font-size: 28rpx;
      font-weight: 500;
      color: var(--text-main);
    }
    .ce-desc {
      font-size: 22rpx;
      color: var(--text-sub);
      line-height: 1.5;
    }
  }

  .ce-btn {
    flex-shrink: 0;
    padding: 14rpx 32rpx;
    background-color: #ff2e2e;
    color: #fff;
    font-size: 26rpx;
    font-weight: 500;
    border-radius: 8rpx;
  }
}

/* 投诉类型筛选条 */
.filter-bar {
  white-space: nowrap;
  margin-bottom: 20rpx;

  .filter-chip {
    display: inline-block;
    padding: 10rpx 28rpx;
    margin-right: 16rpx;
    font-size: 24rpx;
    color: var(--text-sub);
    background-color: var(--card-bg);
    border: 1rpx solid var(--border-color);
    border-radius: 999rpx;

    &.active {
      color: #fff;
      background-color: #ff2e2e;
      border-color: #ff2e2e;
      font-weight: 500;
    }
  }
}

.complaint-card {
  background-color: var(--card-bg);
  border: 1rpx solid var(--border-color);
  border-radius: 16rpx;
  padding: 24rpx;
  margin-bottom: 16rpx;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-bottom: 16rpx;
  margin-bottom: 16rpx;
  border-bottom: 1rpx solid var(--border-color);

  .ticket-no {
    font-size: 24rpx;
    font-weight: 500;
    color: var(--text-sub);
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

.card-tags {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 16rpx;
  margin-bottom: 12rpx;

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

.complaint-desc {
  font-size: 26rpx;
  color: var(--text-main);
  line-height: 1.7;
  margin-bottom: 16rpx;
  word-break: break-all;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.evidence-list {
  display: flex;
  flex-wrap: wrap;
  gap: 12rpx;
  margin-bottom: 16rpx;

  .evidence-img {
    width: 150rpx;
    height: 150rpx;
    border-radius: 8rpx;
    background-color: var(--border-color);
  }
}

.solution-block {
  padding: 16rpx 20rpx;
  background-color: rgba(7, 193, 96, 0.08);
  border-radius: 10rpx;
  font-size: 24rpx;
  line-height: 1.6;
  margin-bottom: 16rpx;

  .sol-label {
    color: #07c160;
  }
  .sol-text {
    color: var(--text-main);
  }
  .sol-assignee {
    margin-top: 8rpx;
    font-size: 22rpx;
    color: var(--text-sub);
  }
}

/* 满意度评分 */
.rate-block {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 12rpx;
  margin-bottom: 16rpx;
  padding: 20rpx;
  background-color: rgba(255, 46, 46, 0.05);
  border: 1rpx dashed rgba(255, 46, 46, 0.3);
  border-radius: 12rpx;

  .rate-label {
    font-size: 24rpx;
    color: var(--text-sub);
  }

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

  .rate-submit {
    align-self: flex-end;
  }
}

.card-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-top: 16rpx;
  border-top: 1rpx solid var(--border-color);

  .create-time {
    font-size: 22rpx;
    color: var(--text-dim);
  }
  .view-detail {
    font-size: 22rpx;
    color: #ff2e2e;
    font-weight: 500;
  }
}

.load-more {
  text-align: center;
  padding: 24rpx;
  font-size: 24rpx;
  color: var(--text-dim);
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
  }
  .empty-sub {
    font-size: 24rpx;
    color: var(--text-dim);
    margin-bottom: 24rpx;
  }
  .empty-btn {
    width: 320rpx;
  }
}

.bottom-bar {
  position: fixed;
  left: 24rpx;
  right: 24rpx;
  bottom: calc(24rpx + env(safe-area-inset-bottom));
}
</style>
