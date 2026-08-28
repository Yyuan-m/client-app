<script setup lang="ts">
/**
 * 公告详情页
 * 原Web: 返回按钮 + 优先级标签 + 发布时间 + 标题 + 正文（white-space: pre-wrap 保留换行）
 * 加载失败兜底："公告不存在或已下架"
 */
import { ref, computed } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { getAnnouncementDetailApi } from '@/api/modules/announcement'
import { dateUtil } from '@/utils'
import { useThemeClass } from '@/composables/useThemeClass'
import { useNavigationBar } from '@/composables/useNavigationBar'
import type { AnnouncementVO, AnnouncementPriority } from '@/api/types'

const { themeClass, appStore } = useThemeClass()
/** 原生导航栏随主题切换 */
useNavigationBar()
/** 加载动画颜色：随深浅主题切换 */
const loadingColor = computed(() => (appStore.isDark ? '#aeaeb2' : '#6e6e73'))
const id = ref<number | string>('')
const detail = ref<AnnouncementVO | null>(null)
const loading = ref(true)
const loadFailed = ref(false)

onLoad((options: Record<string, string> | undefined) => {
  const opts = options || {}
  if (!opts.id) {
    loadFailed.value = true
    loading.value = false
    return
  }
  id.value = opts.id
  loadDetail()
})

async function loadDetail() {
  loading.value = true
  loadFailed.value = false
  try {
    detail.value = await getAnnouncementDetailApi(id.value)
    if (!detail.value) {
      loadFailed.value = true
    }
  } catch (e) {
    console.error('[announcement.detail] load failed:', e)
    loadFailed.value = true
  } finally {
    loading.value = false
  }
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
  return dateUtil.format(t, 'YYYY-MM-DD HH:mm')
}

function goBack() {
  uni.navigateBack({
    delta: 1,
    fail: () => {
      uni.reLaunch({ url: '/pages/announcement/list' })
    }
  })
}
</script>

<template>
  <view class="container detail-page" :class="themeClass">
    <!-- 加载中 -->
    <view v-if="loading" class="loading-wrap">
      <u-loading-icon mode="circle" text="加载中..." :color="loadingColor" :textColor="loadingColor" />
    </view>

    <!-- 加载失败 -->
    <view v-else-if="loadFailed || !detail" class="fail-wrap">
      <view class="fail-icon">📭</view>
      <view class="fail-text">公告不存在或已下架</view>
      <u-button text="返回列表" type="primary" shape="square" @click="goBack" />
    </view>

    <!-- 详情内容 -->
    <view v-else class="detail-content fade-in-up">
      <view class="detail-header">
        <view class="priority-tag" :class="priorityClass(detail.priority)">{{ priorityText(detail.priority) }}</view>
        <view class="publish-time">{{ formatTime(detail.publishTime || detail.createTime) }}</view>
      </view>
      <view class="detail-title">{{ detail.title }}</view>
      <view class="detail-body">{{ detail.content }}</view>
    </view>
  </view>
</template>

<style scoped lang="scss">
.detail-page {
  padding-bottom: calc(48rpx + env(safe-area-inset-bottom));
}

.loading-wrap,
.fail-wrap {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 160rpx 0;
  gap: 32rpx;
}

.fail-icon {
  font-size: 96rpx;
}

.fail-text {
  font-size: 28rpx;
  color: var(--text-sub);
}

.detail-content {
  padding: 32rpx;
  background-color: var(--card-bg);
  border-radius: 16rpx;
}

.detail-header {
  display: flex;
  align-items: center;
  gap: 16rpx;
  margin-bottom: 24rpx;
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
  font-size: 24rpx;
  color: var(--text-dim);
}

.detail-title {
  font-size: 40rpx;
  font-weight: 700;
  color: var(--text-main);
  line-height: 1.4;
  margin-bottom: 32rpx;
}

.detail-body {
  font-size: 28rpx;
  color: var(--text-sub);
  line-height: 1.8;
  white-space: pre-wrap;
  word-break: break-word;
}
</style>
