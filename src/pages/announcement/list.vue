<script setup lang="ts">
/**
 * 公告列表页
 * 原Web: 系统"只看高优先级公告"过滤 + 分页，优先级标签，noDedup:true
 */
import { ref, reactive, computed } from 'vue'
import { onLoad, onReachBottom } from '@dcloudio/uni-app'
import { getAnnouncementPageApi } from '@/api/modules/announcement'
import { dateUtil } from '@/utils'
import { useThemeClass } from '@/composables/useThemeClass'
import { useNavigationBar } from '@/composables/useNavigationBar'
import type { AnnouncementVO, AnnouncementPriority } from '@/api/types'

const { themeClass, appStore } = useThemeClass()
/** 原生导航栏随主题切换 */
useNavigationBar()
/** 加载动画颜色：随深浅主题切换 */
const loadingColor = computed(() => (appStore.isDark ? '#aeaeb2' : '#6e6e73'))
const list = ref<AnnouncementVO[]>([])
const loading = ref(false)
const finished = ref(false)
const onlyHigh = ref(false)
const page = reactive({ current: 1, pageSize: 10, total: 0 })

onLoad(() => {
  loadList()
})

async function loadList() {
  if (loading.value) return
  loading.value = true
  try {
    const res = await getAnnouncementPageApi(
      { page: page.current, pageSize: page.pageSize, onlyHigh: onlyHigh.value },
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
    console.error('[announcement.list] load failed:', e)
  } finally {
    loading.value = false
  }
}

onReachBottom(() => {
  if (loading.value || finished.value) return
  page.current++
  loadList()
})

function toggleOnlyHigh() {
  onlyHigh.value = !onlyHigh.value
  resetAndLoad()
}

function resetAndLoad() {
  page.current = 1
  finished.value = false
  list.value = []
  loadList()
}

function goDetail(item: AnnouncementVO) {
  uni.navigateTo({ url: `/pages/announcement/detail?id=${item.id}` })
}

function priorityText(p?: AnnouncementPriority): string {
  if (p === 'high') return '置顶'
  if (p === 'low') return '低'
  return '公告'
}

function priorityClass(p?: AnnouncementPriority): string {
  if (p === 'high') return 'priority-high'
  if (p === 'low') return 'priority-low'
  return 'priority-normal'
}

function formatTime(t?: string): string {
  if (!t) return ''
  return dateUtil.format(t, 'YYYY-MM-DD')
}
</script>

<template>
  <view class="container announcement-page" :class="themeClass">
    <!-- 筛选条 -->
    <view class="filter-bar">
      <view class="filter-item" :class="{ active: onlyHigh }" @tap="toggleOnlyHigh">
        {{ onlyHigh ? '仅看置顶 ✓' : '全部公告' }}
      </view>
    </view>

    <!-- 公告列表 -->
    <view v-if="list.length">
      <view v-for="item in list" :key="item.id" class="card announcement-card fade-in-up" @tap="goDetail(item)">
        <view class="card-header">
          <view class="priority-tag" :class="priorityClass(item.priority)">{{ priorityText(item.priority) }}</view>
          <view class="publish-time">{{ formatTime(item.publishTime || item.createTime) }}</view>
        </view>
        <view class="card-title">{{ item.title }}</view>
        <view class="card-content">{{ item.content }}</view>
      </view>
    </view>

    <!-- 空状态 -->
    <view v-else-if="!loading" class="empty-state">
      <view class="empty-icon">📭</view>
      <view class="empty-text">暂无公告</view>
      <u-button v-if="onlyHigh" text="查看全部公告" type="primary" plain shape="square" @click="toggleOnlyHigh" />
    </view>

    <!-- 加载中 -->
    <view v-if="loading" class="loading-tip">
      <u-loading-icon mode="circle" text="加载中..." :color="loadingColor" :textColor="loadingColor" />
    </view>

    <!-- 加载完成 -->
    <view v-else-if="finished && list.length" class="loadmore-tip">
      <view class="loadmore-text">— 已加载全部 —</view>
    </view>
    <view v-else-if="!loading && !list.length === false && !finished" class="loadmore-tip">
      <view class="loadmore-text" @tap="resetAndLoad">点击加载更多</view>
    </view>
  </view>
</template>

<style scoped lang="scss">
.announcement-page {
  padding-bottom: calc(48rpx + env(safe-area-inset-bottom));
}

.filter-bar {
  display: flex;
  align-items: center;
  padding: 16rpx 0 24rpx;
}

.filter-item {
  padding: 12rpx 24rpx;
  background-color: var(--card-bg);
  border: 1rpx solid var(--border-color);
  border-radius: 8rpx;
  font-size: 24rpx;
  color: var(--text-sub);

  &.active {
    background-color: rgba(255, 46, 46, 0.12);
    border-color: #ff2e2e;
    color: #ff2e2e;
  }
}

.announcement-card {
  display: flex;
  flex-direction: column;
  gap: 12rpx;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.priority-tag {
  font-size: 22rpx;
  padding: 4rpx 16rpx;
  border-radius: 4rpx;
  font-weight: 500;
}

.priority-high {
  background-color: rgba(255, 46, 46, 0.18);
  color: #ff2e2e;
}

.priority-normal {
  background-color: rgba(255, 153, 0, 0.18);
  color: #ff9900;
}

.priority-low {
  background-color: rgba(174, 174, 178, 0.18);
  color: var(--text-sub);
}

.publish-time {
  font-size: 22rpx;
  color: var(--text-dim);
}

.card-title {
  font-size: 30rpx;
  font-weight: 600;
  color: var(--text-main);
  line-height: 1.4;
}

.card-content {
  font-size: 26rpx;
  color: var(--text-sub);
  line-height: 1.6;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  overflow: hidden;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 96rpx 0;
  gap: 24rpx;
}

.empty-icon {
  font-size: 96rpx;
}

.empty-text {
  font-size: 28rpx;
  color: var(--text-dim);
}

.loading-tip,
.loadmore-tip {
  padding: 32rpx 0;
  text-align: center;
}

.loadmore-text {
  font-size: 24rpx;
  color: var(--text-dim);
}
</style>
