<script setup lang="ts">
/**
 * 我的预约/留言页 - 预约咨询与留言反馈记录管理
 *
 * 功能：类型筛选（全部/预约咨询/留言反馈）+ 状态筛选 tabs（全部/待处理/已处理/已取消）
 * + 分页加载（触底加载更多）+ 取消预约（u-modal 确认）
 * + 处理进度时间线（提交 → 客服处理，含处理人/处理说明/处理时间）
 * 未登录：空态引导登录
 *
 * 状态机（与后台管理系统对齐）：pending 待处理 / handled 已处理 / cancelled 已取消
 * 类型（同一张 feedback 表，用 type 区分）：appointment 预约咨询 / feedback 留言反馈
 * API: getMyAppointmentsApi / cancelAppointmentApi
 */
import { ref, computed } from 'vue'
import { onShow, onReachBottom } from '@dcloudio/uni-app'
import { useUserStore } from '@/stores/user'
import { getMyAppointmentsApi, cancelAppointmentApi, getContactInfoApi } from '@/api/modules/feedback'
import { useThemeClass } from '@/composables/useThemeClass'
import { useNavigationBar } from '@/composables/useNavigationBar'
import type { AppointmentVO, ContactInfoVO } from '@/api/types'

const userStore = useUserStore()
const { themeClass, appStore } = useThemeClass()
/** 原生导航栏随主题切换 */
useNavigationBar()
/** 加载动画颜色：随深浅主题切换 */
const loadingColor = computed(() => (appStore.isDark ? '#aeaeb2' : '#6e6e73'))

// 类型筛选 tabs
const typeTabs = [
  { value: '', label: '全部类型' },
  { value: 'appointment', label: '预约咨询' },
  { value: 'feedback', label: '留言反馈' }
]
const activeType = ref('')

// 状态筛选 tabs
const tabs = [
  { value: '', label: '全部' },
  { value: 'pending', label: '待处理' },
  { value: 'handled', label: '已处理' },
  { value: 'cancelled', label: '已取消' }
]
const activeStatus = ref('')

const list = ref<AppointmentVO[]>([])
const loading = ref(false)
const finished = ref(false)
const page = { current: 1, pageSize: 10, total: 0 }

// 取消确认弹窗
const showCancelModal = ref(false)
const cancelTarget = ref<AppointmentVO | null>(null)
const cancelling = ref(false)

// 状态筛选底部弹层
const showStatusPopup = ref(false)

// 联系人详情：key 为 id，value 为完整 { name, phone }
const contactMap = ref<Record<number, ContactInfoVO>>({})
const contactLoadingId = ref<number | null>(null)

async function toggleContact(item: AppointmentVO) {
  if (contactMap.value[item.id]) {
    const next = { ...contactMap.value }
    delete next[item.id]
    contactMap.value = next
    return
  }
  contactLoadingId.value = item.id
  try {
    const res = await getContactInfoApi(item.id)
    contactMap.value = { ...contactMap.value, [item.id]: res }
  } catch (e) {
    console.error('[appointments] getContactInfo failed:', e)
  } finally {
    contactLoadingId.value = null
  }
}

const emptyText = computed(() => {
  const base = activeStatus.value === 'pending' ? '暂无待处理的记录'
    : activeStatus.value === 'handled' ? '暂无已处理的记录'
    : activeStatus.value === 'cancelled' ? '暂无已取消的记录'
    : '暂无记录'
  if (activeType.value === 'appointment' && activeStatus.value) return base.replace('记录', '预约')
  if (activeType.value === 'feedback' && activeStatus.value) return base.replace('记录', '留言')
  if (activeType.value === 'appointment') return '暂无预约记录'
  if (activeType.value === 'feedback') return '暂无留言记录'
  return base
})

onShow(() => {
  if (!userStore.isLoggedIn) return
  reload()
})

onReachBottom(() => {
  if (loading.value || finished.value || !userStore.isLoggedIn) return
  page.current++
  loadList(false)
})

async function reload() {
  page.current = 1
  finished.value = false
  list.value = []
  await loadList(true)
}

async function loadList(reset: boolean) {
  if (loading.value) return
  loading.value = true
  try {
    const res = await getMyAppointmentsApi({
      page: page.current,
      pageSize: page.pageSize,
      status: activeStatus.value || undefined,
      type: activeType.value || undefined
    })
    const items = res.list || []
    if (reset) list.value = items
    else list.value.push(...items)
    page.total = res.total || 0
    finished.value = list.value.length >= page.total
  } catch (e) {
    console.error('[appointments] loadList failed:', e)
  } finally {
    loading.value = false
  }
}

function onTabChange(status: string) {
  if (activeStatus.value === status) return
  activeStatus.value = status
  reload()
}

/** 底部弹层选择状态后应用并关闭 */
function onStatusSelect(status: string) {
  showStatusPopup.value = false
  onTabChange(status)
}

/** 状态中文名（用于顶部筛选按钮回显） */
function statusLabel(val: string): string {
  return tabs.find((t) => t.value === val)?.label || '全部'
}

function onTypeChange(type: string) {
  if (activeType.value === type) return
  activeType.value = type
  reload()
}

function showCancelConfirm(item: AppointmentVO) {
  if (cancelling.value) return
  cancelTarget.value = item
  showCancelModal.value = true
}

async function confirmCancel() {
  if (!cancelTarget.value || cancelling.value) return
  cancelling.value = true
  try {
    await cancelAppointmentApi(cancelTarget.value.id)
    showCancelModal.value = false
    uni.showToast({ title: '预约已取消', icon: 'success' })
    await reload()
  } catch (e) {
    console.error('[appointments] cancel failed:', e)
    showCancelModal.value = false
  } finally {
    cancelling.value = false
    cancelTarget.value = null
  }
}

/** 卡片状态类（色条 + 状态徽章 + 整体透明度） */
function cardClass(status: string): string {
  return `card-${status || 'pending'}`
}

function statusClass(status: string): string {
  return `st-${status || 'pending'}`
}

function formatTime(t?: string): string {
  if (!t) return '—'
  return String(t).replace('T', ' ').slice(0, 16)
}

function apptNo(id: number): string {
  return String(id).padStart(6, '0')
}

function goHome() {
  uni.reLaunch({ url: '/pages/home/index' })
}

function goLogin() {
  uni.navigateTo({
    url: '/pages/auth/login?redirect=' + encodeURIComponent('/pages/profile/appointments')
  })
}
</script>

<template>
  <view class="appointments-page" :class="themeClass">
    <!-- 未登录空态 -->
    <view v-if="!userStore.isLoggedIn" class="empty-state">
      <view class="empty-icon">📅</view>
      <view class="empty-text">登录后查看您的预约记录</view>
      <view class="empty-sub">提交的预约咨询可在此跟踪处理进度</view>
      <u-button text="去登录" type="primary" shape="square" @click="goLogin" class="go-btn" />
    </view>

    <template v-else>
      <!-- 顶部工具栏：类型分段控制 + 状态筛选按钮 -->
      <view class="filter-bar">
        <view class="segment-tabs">
          <view
            v-for="tab in typeTabs"
            :key="tab.value"
            class="segment-item"
            :class="{ active: activeType === tab.value }"
            @tap="onTypeChange(tab.value)"
          >
            {{ tab.label }}
          </view>
          <view class="segment-slider" :class="`slider-${activeType || 'all'}`"></view>
        </view>
        <view class="filter-btn" @tap="showStatusPopup = true">
          <text class="filter-btn-text">{{ statusLabel(activeStatus) }}</text>
          <text class="filter-arrow" :class="{ open: showStatusPopup }">▾</text>
        </view>
      </view>

      <!-- 状态筛选底部弹层 -->
      <u-popup
        :show="showStatusPopup"
        mode="bottom"
        :round="16"
        :safeAreaInsetBottom="true"
        @close="showStatusPopup = false"
      >
        <view class="status-sheet">
          <view class="sheet-title">筛选状态</view>
          <view class="sheet-options">
            <view
              v-for="tab in tabs"
              :key="tab.value"
              class="sheet-option"
              :class="{ active: activeStatus === tab.value }"
              @tap="onStatusSelect(tab.value)"
            >
              <text>{{ tab.label }}</text>
              <text v-if="activeStatus === tab.value" class="sheet-check">✓</text>
            </view>
          </view>
          <view class="sheet-actions">
            <view class="sheet-reset" @tap="onStatusSelect('')">重置</view>
            <view class="sheet-cancel" @tap="showStatusPopup = false">取消</view>
          </view>
        </view>
      </u-popup>

      <!-- 加载中（首次） -->
      <view v-if="loading && !list.length" class="loading-wrap">
        <u-loading-icon mode="circle" text="加载中..." :color="loadingColor" :textColor="loadingColor" />
      </view>

      <!-- 空态 -->
      <view v-else-if="!list.length" class="empty-state">
        <view class="empty-icon">📅</view>
        <view class="empty-text">{{ emptyText }}</view>
        <view class="empty-sub">首页提交预约咨询后可在此跟踪进度</view>
        <u-button text="去首页预约" type="primary" shape="square" @click="goHome" class="go-btn" />
      </view>

      <!-- 预约列表 -->
      <view v-else class="appt-list">
        <view v-for="item in list" :key="item.id" class="appt-card" :class="cardClass(item.status)">
          <view class="appt-header">
            <view class="appt-header-left">
              <text class="appt-no">NO.{{ apptNo(item.id) }}</text>
              <text v-if="item.type" class="appt-type" :class="`type-${item.type}`">{{ item.typeName || (item.type === 'appointment' ? '预约咨询' : '留言反馈') }}</text>
            </view>
            <view class="appt-status" :class="statusClass(item.status)">
              <view class="status-dot"></view>
              <text>{{ item.statusName || '待处理' }}</text>
            </view>
          </view>

          <!-- 车型卡：仅预约咨询有车型/取车日期 -->
          <view v-if="item.type !== 'feedback'" class="car-panel">
            <text class="car-name">{{ item.carType || '车型不限' }}</text>
            <view v-if="item.rentDate" class="date-chip">
              <text class="date-chip-icon">📅</text>
              <text class="date-chip-text">{{ item.rentDate }} 取车</text>
            </view>
          </view>

          <!-- 联系信息卡 -->
          <view class="contact-panel">
            <view class="contact-row">
              <text class="contact-label">联系人</text>
              <view class="contact-main">
                <text v-if="contactMap[item.id]" class="contact-value contact-full">{{ contactMap[item.id].name }}（{{ contactMap[item.id].phone }}）</text>
                <text v-else class="contact-value">{{ item.name }}（{{ item.phone }}）</text>
                <text
                  class="contact-toggle"
                  @tap.stop="toggleContact(item)"
                >{{ contactLoadingId === item.id ? '加载中' : (contactMap[item.id] ? '隐藏' : '查看') }}</text>
              </view>
            </view>
            <view v-if="item.content" class="contact-row contact-msg">
              <text class="contact-label">留言</text>
              <text class="contact-value">{{ item.content }}</text>
            </view>
          </view>

          <!-- 处理进度时间线 -->
          <view class="appt-timeline">
            <view class="tl-item">
              <view class="tl-dot tl-dot-done"></view>
              <view class="tl-content">
                <text class="tl-title">{{ item.type === 'feedback' ? '提交留言' : '提交预约' }}</text>
                <text class="tl-time">{{ formatTime(item.createTime) }}</text>
              </view>
            </view>
            <view v-if="item.status !== 'pending'" class="tl-item">
              <view class="tl-dot" :class="item.status === 'handled' ? 'tl-dot-done' : 'tl-dot-cancel'"></view>
              <view class="tl-content">
                <view class="tl-title-row">
                  <text class="tl-title">{{ item.status === 'cancelled' ? '已取消' : '客服已处理' }}</text>
                  <text v-if="item.handler" class="tl-handler">{{ item.handler }}</text>
                </view>
                <text class="tl-time">{{ formatTime(item.processTime) }}</text>
              </view>
            </view>
            <view v-else class="tl-item">
              <view class="tl-dot tl-dot-pending"></view>
              <view class="tl-content">
                <text class="tl-title">等待客服处理</text>
                <text class="tl-time">通常 1 个工作日内响应</text>
              </view>
            </view>
          </view>

          <!-- 处理说明（沟通结果/取消轨迹） -->
          <view v-if="item.remark" class="remark-box">
            <text class="remark-text">{{ item.remark }}</text>
          </view>

          <!-- 取消按钮 -->
          <view v-if="item.cancellable" class="appt-footer">
            <view class="cancel-btn" @tap="showCancelConfirm(item)">
              {{ cancelling && cancelTarget?.id === item.id ? '取消中...' : '取消预约' }}
            </view>
          </view>
        </view>

        <!-- 加载更多 -->
        <view v-if="loading && list.length" class="loading-more">
          <u-loading-icon mode="circle" :color="loadingColor" :size="28" />
        </view>
        <view v-else-if="finished && list.length" class="load-finished">— 已全部加载 —</view>
      </view>
    </template>

    <!-- 取消确认弹窗 -->
    <u-modal
      :show="showCancelModal"
      title="取消预约"
      :content="`确定要取消该预约吗？${cancelTarget?.rentDate ? '原定取车日期 ' + cancelTarget.rentDate + '，' : ''}取消后不可恢复。`"
      :showCancelButton="true"
      @confirm="confirmCancel"
      @cancel="() => { showCancelModal = false; cancelTarget = null }"
    />
  </view>
</template>

<style scoped lang="scss">
.appointments-page {
  min-height: 100vh;
  box-sizing: border-box;
  background-color: var(--page-bg);
  padding: 16rpx 20rpx calc(48rpx + env(safe-area-inset-bottom));
}

/* 顶部工具栏：类型分段控制 + 状态筛选按钮 */
.filter-bar {
  display: flex;
  align-items: center;
  margin-bottom: 20rpx;
}

.segment-tabs {
  position: relative;
  flex: 1;
  display: flex;
  padding: 4rpx;
  background-color: var(--border-color);
  border-radius: 16rpx;
}

.segment-item {
  flex: 1;
  position: relative;
  z-index: 1;
  text-align: center;
  font-size: 24rpx;
  color: var(--text-sub);
  padding: 10rpx 0;
  transition: color 0.2s;

  &.active { color: var(--text-main); font-weight: 600; }
}

/* 分段滑块：根据选中类型滑动 */
.segment-slider {
  position: absolute;
  top: 4rpx;
  bottom: 4rpx;
  width: calc((100% - 8rpx) / 3);
  background-color: var(--card-bg);
  border-radius: 12rpx;
  box-shadow: 0 2rpx 8rpx rgba(0, 0, 0, 0.06);
  transition: transform 0.25s ease;

  &.slider-all { transform: translateX(0); }
  &.slider-appointment { transform: translateX(100%); }
  &.slider-feedback { transform: translateX(200%); }
}

.filter-btn {
  display: flex;
  align-items: center;
  gap: 4rpx;
  margin-left: 16rpx;
  padding: 10rpx 20rpx;
  border: 1rpx solid var(--border-color);
  border-radius: 16rpx;
  background-color: var(--card-bg);
  flex-shrink: 0;
}

.filter-btn-text {
  font-size: 24rpx;
  color: var(--text-sub);
}

.filter-arrow {
  font-size: 20rpx;
  color: var(--text-dim);
  transition: transform 0.2s;

  &.open { transform: rotate(180deg); }
}

/* 状态筛选底部弹层 */
.status-sheet {
  padding: 32rpx 32rpx calc(24rpx + env(safe-area-inset-bottom));
}

.sheet-title {
  font-size: 28rpx;
  font-weight: 600;
  color: var(--text-main);
  margin-bottom: 20rpx;
}

.sheet-options {
  display: flex;
  flex-wrap: wrap;
  gap: 16rpx;
}

.sheet-option {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8rpx;
  min-width: 200rpx;
  padding: 16rpx 28rpx;
  font-size: 26rpx;
  color: var(--text-sub);
  background-color: var(--border-color);
  border-radius: 14rpx;
  transition: all 0.2s;

  &.active {
    color: #ff2e2e;
    background-color: rgba(255, 46, 46, 0.08);
    font-weight: 600;
  }

  .sheet-check { font-size: 24rpx; }
}

.sheet-actions {
  display: flex;
  gap: 16rpx;
  margin-top: 28rpx;
}

.sheet-reset,
.sheet-cancel {
  flex: 1;
  text-align: center;
  padding: 16rpx 0;
  font-size: 26rpx;
  border-radius: 14rpx;
}

.sheet-reset {
  color: var(--text-sub);
  background-color: var(--fill-color);
}

.sheet-cancel {
  color: #fff;
  background-color: #ff2e2e;
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

/* 预约卡片 */
.appt-list {
  display: flex;
  flex-direction: column;
  gap: 20rpx;
}

.appt-card {
  background-color: var(--card-bg);
  border: 1rpx solid var(--border-color);
  border-radius: 16rpx;
  padding: 24rpx 24rpx 20rpx;

  &.card-cancelled { opacity: 0.6; }
}

.appt-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-bottom: 16rpx;
  margin-bottom: 8rpx;
}

.appt-header-left {
  display: flex;
  align-items: center;
  gap: 12rpx;
}

.appt-no {
  font-size: 20rpx;
  color: var(--text-dim);
  letter-spacing: 2rpx;
}

.appt-header-right {
  display: flex;
  align-items: center;
  gap: 12rpx;
}

/* 类型徽标：预约咨询 / 留言反馈 */
.appt-type {
  font-size: 18rpx;
  font-weight: 500;
  padding: 2rpx 14rpx;
  border-radius: 20rpx;

  &.type-appointment { color: #409eff; background-color: rgba(64, 158, 255, 0.12); }
  &.type-feedback { color: #ff9900; background-color: rgba(255, 153, 0, 0.14); }
}

.appt-status {
  display: flex;
  align-items: center;
  gap: 6rpx;
  font-size: 20rpx;
  font-weight: 500;
  padding: 4rpx 16rpx;
  border-radius: 24rpx;

  .status-dot {
    width: 10rpx;
    height: 10rpx;
    border-radius: 50%;
    background-color: currentColor;
  }

  &.st-pending { color: #ff9900; background-color: rgba(255, 153, 0, 0.15); }
  &.st-handled { color: #07c160; background-color: rgba(7, 193, 96, 0.15); }
  &.st-cancelled { color: var(--text-dim); background-color: var(--border-color); }
}

/* 车型卡片：预约专用，浅色底凸显车型 */
.car-panel {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 12rpx;
  padding: 18rpx 20rpx;
  margin-bottom: 16rpx;
  border-radius: 12rpx;
  background-color: rgba(64, 158, 255, 0.08);
  border: 1rpx solid rgba(64, 158, 255, 0.15);
}

.car-name {
  font-size: 30rpx;
  font-weight: 600;
  color: var(--text-main);
}

.date-chip {
  display: flex;
  align-items: center;
  gap: 6rpx;
  padding: 4rpx 16rpx;
  border-radius: 20rpx;
  background-color: var(--card-bg);
}

.date-chip-icon { font-size: 22rpx; }
.date-chip-text { font-size: 20rpx; color: #409eff; }

/* 联系信息卡：柔和分隔的字段卡 */
.contact-panel {
  margin-bottom: 8rpx;
}

.contact-row {
  display: flex;
  align-items: flex-start;
  padding: 10rpx 0;
  font-size: 24rpx;
}

.contact-label {
  flex-shrink: 0;
  width: 96rpx;
  font-size: 20rpx;
  color: var(--text-dim);
  line-height: 34rpx;
}

.contact-main {
  display: flex;
  align-items: center;
  gap: 12rpx;
  flex: 1;
  min-width: 0;
}

.contact-value {
  flex: 0 1 auto;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--text-sub);
  line-height: 34rpx;
}

.contact-full {
  color: var(--text-main);
  font-weight: 600;
}

.contact-toggle {
  flex-shrink: 0;
  font-size: 20rpx;
  color: #ff2e2e;
  padding: 2rpx 14rpx;
  border: 1rpx solid rgba(255, 46, 46, 0.4);
  border-radius: 20rpx;
  background-color: rgba(255, 46, 46, 0.06);

  &:active { opacity: 0.7; }
}

.contact-msg {
  border-top: 1rpx dashed var(--border-color);
}

/* 处理进度时间线 */
.appt-timeline {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 20rpx;
  padding: 20rpx 8rpx 20rpx 4rpx;
  margin-top: 8rpx;
  border-top: 1rpx solid var(--border-color);

  /* 竖向连接线 */
  &::before {
    content: '';
    position: absolute;
    left: 12rpx;
    top: 40rpx;
    bottom: 40rpx;
    width: 2rpx;
    background-color: var(--border-color);
  }
}

.tl-item {
  position: relative;
  display: flex;
  align-items: flex-start;
  gap: 16rpx;
}

.tl-dot {
  position: relative;
  z-index: 1;
  width: 20rpx;
  height: 20rpx;
  margin-top: 4rpx;
  border-radius: 50%;
  flex-shrink: 0;

  &.tl-dot-done {
    background-color: #07c160;
    box-shadow: 0 0 0 6rpx rgba(7, 193, 96, 0.18);
  }

  &.tl-dot-cancel {
    background-color: #8e8e93;
    box-shadow: 0 0 0 6rpx rgba(142, 142, 147, 0.15);
  }

  &.tl-dot-pending {
    background-color: var(--card-bg);
    border: 3rpx solid #ff9900;
    animation: tl-pulse 2s ease infinite;
  }
}

@keyframes tl-pulse {
  0%, 100% { box-shadow: 0 0 0 0 rgba(255, 153, 0, 0.3); }
  50% { box-shadow: 0 0 0 10rpx rgba(255, 153, 0, 0.08); }
}

.tl-content {
  display: flex;
  flex-direction: column;
  gap: 4rpx;
  min-width: 0;
}

.tl-title-row {
  display: flex;
  align-items: center;
  gap: 12rpx;
  flex-wrap: wrap;
}

.tl-title {
  font-size: 24rpx;
  font-weight: 500;
  color: var(--text-main);
}

.tl-handler {
  font-size: 18rpx;
  color: #409eff;
  background-color: rgba(64, 158, 255, 0.12);
  padding: 2rpx 12rpx;
  border-radius: 16rpx;
}

.tl-time {
  font-size: 20rpx;
  color: var(--text-dim);
}

/* 处理说明 */
.remark-box {
  margin-top: 16rpx;
  padding: 16rpx 20rpx;
  background-color: rgba(7, 193, 96, 0.08);
  border: 1rpx solid rgba(7, 193, 96, 0.25);
  border-radius: 10rpx;
}

.card-cancelled .remark-box {
  background-color: var(--border-color);
  border-color: var(--border-color);
}

.remark-text {
  font-size: 22rpx;
  color: var(--text-sub);
  line-height: 1.6;
  word-break: break-all;
}

/* 取消按钮 */
.appt-footer {
  margin-top: 14rpx;
  padding-top: 14rpx;
  border-top: 1rpx solid var(--border-color);
  display: flex;
  justify-content: flex-end;
}

.cancel-btn {
  /* 使用主题危险色变量，深浅两种主题下文字都清晰可读 */
  padding: 6rpx 26rpx;
  font-size: 22rpx;
  font-weight: 500;
  color: var(--text-danger);
  border: 1rpx solid var(--danger-border);
  border-radius: 8rpx;
  background-color: var(--danger-bg);

  &:active {
    opacity: 0.85;
  }
}

/* 加载更多 */
.loading-more {
  display: flex;
  justify-content: center;
  padding: 24rpx 0;
}

.load-finished {
  text-align: center;
  padding: 24rpx 0;
  font-size: 22rpx;
  color: var(--text-dim);
}
</style>
