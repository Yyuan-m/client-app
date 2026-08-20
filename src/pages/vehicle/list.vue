<script setup lang="ts">
/**
 * 车辆列表页
 * 原Web: 3列响应式网格，移动端单列
 * onLoad: 接收 options.type 同步到 filterStore；loadVehicleTypes + loadList
 * API: getCarListApi({ ...filters, page, pageSize:9 }) + getDictByTypeApi('vehicle_type')
 * 字典校验：旧 type 不在新字典内则重置 'all'
 * 加载态：骨架屏；空态：重置筛选按钮
 */
import { ref, reactive, computed } from 'vue'
import { onLoad, onShow, onReachBottom } from '@dcloudio/uni-app'
import { useFilterStore } from '@/stores/filter'
import { useUserStore } from '@/stores/user'
import { getCarListApi } from '@/api/modules/car'
import { getDictByTypeApi } from '@/api/modules/system'
import { resolveAdminImage, resolveClientImage, placeholderImage } from '@/utils/image'
import { moneyUtil } from '@/utils'
import type { CarVO, DictDataVO, PageResult } from '@/api/types'

const filterStore = useFilterStore()
const userStore = useUserStore()

const list = ref<CarVO[]>([])
const vehicleTypes = ref<DictDataVO[]>([])
const loading = ref(true)
const finished = ref(false)
const page = reactive({ current: 1, pageSize: 9, total: 0 })

// 排序选项
const sortOptions = [
  { label: '热度优先', value: 'hot' as const },
  { label: '价格升序', value: 'price-asc' as const },
  { label: '价格降序', value: 'price-desc' as const }
]

// 分类选择弹窗
const showTypePicker = ref(false)

const typeColumns = computed(() => {
  const all = [{ dictLabel: '全部车型', dictValue: 'all' }, ...vehicleTypes.value]
  return [all.map((d) => ({ label: d.dictLabel, value: d.dictValue }))]
})

onLoad(async (options: Record<string, string> | undefined) => {
  const opts = options || {}
  // 同步 URL query.type 到 filterStore
  if (opts.type) {
    filterStore.setFilter('type', opts.type)
  }
  await loadVehicleTypes()
  // 字典校验：旧 type 不在新字典内则重置 'all'
  if (filterStore.filters.type !== 'all') {
    const exists = vehicleTypes.value.some((d) => d.dictValue === filterStore.filters.type)
    if (!exists) {
      filterStore.setFilter('type', 'all')
    }
  }
  await loadList(true)
})

onShow(() => {})

onReachBottom(() => {
  if (loading.value || finished.value) return
  page.current++
  loadList(false)
})

async function loadVehicleTypes() {
  try {
    vehicleTypes.value = (await getDictByTypeApi('vehicle_type')) || []
  } catch (e) {
    console.error('[vehicle.list] loadVehicleTypes failed:', e)
  }
}

async function loadList(reset = false) {
  if (loading.value && !reset) return
  if (reset) {
    page.current = 1
    finished.value = false
    list.value = []
  }
  loading.value = true
  try {
    const res: PageResult<CarVO> = await getCarListApi({
      keyword: filterStore.filters.keyword || undefined,
      type: filterStore.filters.type === 'all' ? undefined : filterStore.filters.type,
      city: filterStore.filters.city || undefined,
      minPrice: filterStore.filters.minPrice,
      maxPrice: filterStore.filters.maxPrice,
      sort: filterStore.filters.sort,
      page: page.current,
      pageSize: page.pageSize
    })
    const items = (res.list || []).map(decorateCarRow)
    if (reset) {
      list.value = items
    } else {
      list.value.push(...items)
    }
    page.total = res.total || 0
    finished.value = list.value.length >= page.total
  } catch (e) {
    console.error('[vehicle.list] loadList failed:', e)
  } finally {
    loading.value = false
  }
}

function onTypeConfirm(e: any) {
  const value = e.value && e.value[0] ? e.value[0].value : 'all'
  filterStore.setFilter('type', value)
  showTypePicker.value = false
  loadList(true)
}

function onTypeCancel() {
  showTypePicker.value = false
}

function onSortChange(value: 'hot' | 'price-asc' | 'price-desc') {
  filterStore.setFilter('sort', value)
  loadList(true)
}

function onKeywordSearch() {
  loadList(true)
}

function onKeywordClear() {
  filterStore.setFilter('keyword', '')
  loadList(true)
}

function onResetFilters() {
  filterStore.resetFilters()
  loadList(true)
}

function goDetail(car: CarVO) {
  uni.navigateTo({ url: `/pages/vehicle/detail?id=${car.id}` })
}

function onRent(car: CarVO) {
  // @click.stop 由按钮调用，跳详情页（详情页处理下单流程）
  goDetail(car)
}

/** 装饰车辆行：预算 coverUrl（自带子目录兜底） */
function decorateCarRow(row: any): any {
  const cover = (row as any).cover
  return {
    ...row,
    coverUrl: cover ? resolveAdminImage(cover) : ''
  }
}

/** 车辆图片加载失败 → 使用占位图 */
function onCarImgError(car: any, _event: any) {
  car.coverUrl = placeholderImage(640, 400, '暂无车辆图片')
}

function statusText(status?: string): string {
  if (status === 'rented') return '已租出'
  if (status === 'maintenance') return '维修中'
  return '可租车'
}

function statusClass(status?: string): string {
  if (status === 'rented') return 'status-rented'
  if (status === 'maintenance') return 'status-maintenance'
  return 'status-available'
}

function formatPrice(p: number | string | undefined): string {
  return moneyUtil.format(Number(p || 0))
}

function currentTypeLabel(): string {
  if (filterStore.filters.type === 'all') return '全部车型'
  const t = vehicleTypes.value.find((d) => d.dictValue === filterStore.filters.type)
  return t?.dictLabel || '全部车型'
}
</script>

<template>
  <view class="vehicle-list-page">
    <!-- 筛选栏 -->
    <view class="filter-bar">
      <view class="search-wrap">
        <u-search
          v-model="filterStore.filters.keyword"
          placeholder="搜索品牌/车型"
          :showAction="false"
          bgColor="#1a1a1a"
          @search="onKeywordSearch"
          @clear="onKeywordClear"
        />
      </view>
      <view class="filter-row">
        <view class="filter-item" @tap="showTypePicker = true">
          <text class="filter-label">车型</text>
          <text class="filter-value">{{ currentTypeLabel() }} ▾</text>
        </view>
        <view class="filter-item sort-group">
          <view
            v-for="opt in sortOptions"
            :key="opt.value"
            class="sort-btn"
            :class="{ active: filterStore.filters.sort === opt.value }"
            @tap="onSortChange(opt.value)"
          >
            {{ opt.label }}
          </view>
        </view>
      </view>
    </view>

    <!-- 加载态：骨架屏 -->
    <view v-if="loading && !list.length" class="skeleton-list">
      <view v-for="i in 6" :key="i" class="skeleton-card">
        <view class="skeleton-img skeleton"></view>
        <view class="skeleton-line skeleton"></view>
        <view class="skeleton-line skeleton" style="width: 60%"></view>
      </view>
    </view>

    <!-- 空态 -->
    <view v-else-if="!loading && !list.length" class="empty-state">
      <view class="empty-icon">🚗</view>
      <view class="empty-text">没有符合条件的车辆</view>
      <u-button text="重置筛选" type="primary" plain shape="square" @click="onResetFilters" class="reset-btn" />
    </view>

    <!-- 车辆列表：单列 -->
    <view v-else class="vehicle-grid">
      <view
        v-for="car in list"
        :key="car.id"
        class="car-card"
        :class="{ disabled: car.status !== 'available' }"
        @tap="goDetail(car)"
      >
        <view class="car-img-wrap">
          <image :src="car.coverUrl" mode="aspectFill" class="car-img" lazy-load @error="onCarImgError(car, $event)" />
          <!-- 角标 -->
          <view v-if="car.isHot" class="car-tag tag-hot">HOT</view>
          <view v-else-if="car.isRecommend" class="car-tag tag-rec">推荐</view>
          <!-- 状态标签 -->
          <view class="car-status" :class="statusClass(car.status)">{{ statusText(car.status) }}</view>
        </view>
        <view class="car-info">
          <view class="car-name">{{ car.name }}</view>
          <view class="car-meta">
            <text v-if="car.brand">{{ car.brand }}</text>
            <text v-if="car.year">·{{ car.year }}款</text>
            <text v-if="car.seats">·{{ car.seats }}座</text>
            <text v-if="car.displacement">·{{ car.displacement }}</text>
          </view>
          <view class="car-rating-rent">
            <view class="car-rating">★ {{ car.rating || '5.0' }}</view>
            <view class="car-rent-count">{{ car.rentCount || 0 }} 次出租</view>
          </view>
          <view class="car-price-row">
            <view class="car-price">
              ￥{{ formatPrice(car.dailyPrice) }}<text class="price-unit"> / 天</text>
            </view>
            <view
              class="rent-btn"
              :class="{ disabled: car.status !== 'available' }"
              @tap.stop="onRent(car)"
            >
              {{ car.status === 'available' ? '立即租车' : car.status === 'rented' ? '已租出' : '维修中' }}
            </view>
          </view>
        </view>
      </view>
    </view>

    <!-- 加载更多 -->
    <view v-if="list.length && !loading" class="loadmore">
      <view v-if="!finished" class="loadmore-text" @tap="() => { page.current++; loadList(false) }">加载更多</view>
      <view v-else class="loadmore-text">— 已加载全部 —</view>
    </view>

    <!-- 分类选择弹窗 -->
    <u-picker
      :show="showTypePicker"
      :columns="typeColumns"
      bgColor="#1a1a1a"
      cancelColor="#aeaeb2"
      confirmColor="#ff2e2e"
      @confirm="onTypeConfirm"
      @cancel="onTypeCancel"
      keyName="label"
    />

    <!-- 底部 TabBar 占位 -->
    <view class="tabbar-placeholder"></view>
    <TabBar active="pages/vehicle/list" />
  </view>
</template>

<style scoped lang="scss">
.vehicle-list-page {
  min-height: 100vh;
  background-color: #0a0a0a;
  padding-bottom: calc(100rpx + env(safe-area-inset-bottom));
}

.filter-bar {
  position: sticky;
  top: 0;
  z-index: 10;
  background-color: #0a0a0a;
  padding: 16rpx 24rpx 12rpx;
  border-bottom: 1rpx solid #2a2a2a;
}

.search-wrap {
  margin-bottom: 16rpx;
}

.filter-row {
  display: flex;
  align-items: center;
  gap: 16rpx;
  flex-wrap: wrap;
}

.filter-item {
  display: flex;
  align-items: center;
  gap: 8rpx;
  padding: 8rpx 16rpx;
  background-color: #1a1a1a;
  border-radius: 8rpx;
  border: 1rpx solid #2a2a2a;
}

.filter-label {
  font-size: 22rpx;
  color: #aeaeb2;
}

.filter-value {
  font-size: 24rpx;
  color: #f5f5f5;
}

.sort-group {
  display: flex;
  gap: 4rpx;
  padding: 0;
  background-color: #1a1a1a;
  border: 1rpx solid #2a2a2a;
}

.sort-btn {
  padding: 8rpx 16rpx;
  font-size: 22rpx;
  color: #aeaeb2;

  &.active {
    background-color: #ff2e2e;
    color: #fff;
  }
}

/* 骨架屏 */
.skeleton-list {
  display: grid;
  grid-template-columns: 1fr;
  gap: 24rpx;
  padding: 24rpx;
}

.skeleton-card {
  background-color: #1a1a1a;
  border-radius: 16rpx;
  overflow: hidden;
}

.skeleton-img {
  width: 100%;
  height: 320rpx;
}

.skeleton-line {
  height: 28rpx;
  margin: 16rpx 24rpx;
  border-radius: 4rpx;
}

/* 空态 */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 120rpx 0;
  gap: 24rpx;
}

.empty-icon {
  font-size: 96rpx;
}

.empty-text {
  font-size: 28rpx;
  color: #6e6e73;
}

.reset-btn {
  width: 320rpx;
}

/* 车辆列表 */
.vehicle-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 24rpx;
  padding: 24rpx;
}

.car-card {
  background-color: #1a1a1a;
  border-radius: 16rpx;
  overflow: hidden;
  border: 1rpx solid #2a2a2a;
  transition: transform 0.2s;

  &:active {
    transform: scale(0.98);
  }

  &.disabled {
    opacity: 0.65;
  }
}

.car-img-wrap {
  position: relative;
  width: 100%;
  height: 320rpx;
}

.car-img {
  width: 100%;
  height: 100%;
}

.car-tag {
  position: absolute;
  top: 16rpx;
  left: 16rpx;
  padding: 4rpx 12rpx;
  border-radius: 4rpx;
  font-size: 20rpx;
  font-weight: 700;
}

.tag-hot {
  background-color: #ff2e2e;
  color: #fff;
}

.tag-rec {
  background-color: #d4af37;
  color: #1a1a1a;
}

.car-status {
  position: absolute;
  top: 16rpx;
  right: 16rpx;
  padding: 4rpx 12rpx;
  border-radius: 4rpx;
  font-size: 20rpx;
  font-weight: 500;
}

.status-available {
  background-color: rgba(7, 193, 96, 0.85);
  color: #fff;
}

.status-rented {
  background-color: rgba(255, 153, 0, 0.85);
  color: #fff;
}

.status-maintenance {
  background-color: rgba(174, 174, 178, 0.85);
  color: #fff;
}

.car-info {
  padding: 20rpx 24rpx 24rpx;
}

.car-name {
  font-size: 32rpx;
  font-weight: 600;
  color: #f5f5f5;
  margin-bottom: 8rpx;
}

.car-meta {
  font-size: 24rpx;
  color: #aeaeb2;
  margin-bottom: 12rpx;
}

.car-rating-rent {
  display: flex;
  justify-content: space-between;
  font-size: 22rpx;
  color: #6e6e73;
  margin-bottom: 16rpx;
}

.car-rating {
  color: #ff9900;
  font-weight: 500;
}

.car-price-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.car-price {
  font-size: 36rpx;
  color: #ff5a3c;
  font-weight: 700;
}

.price-unit {
  font-size: 22rpx;
  color: #aeaeb2;
  font-weight: 400;
}

.rent-btn {
  padding: 12rpx 24rpx;
  background-color: #ff2e2e;
  color: #fff;
  font-size: 24rpx;
  border-radius: 8rpx;
  font-weight: 500;

  &.disabled {
    background-color: #2a2a2a;
    color: #6e6e73;
  }
}

.loadmore {
  padding: 24rpx;
  text-align: center;
}

.loadmore-text {
  font-size: 24rpx;
  color: #6e6e73;
}

.tabbar-placeholder {
  height: 100rpx;
}
</style>
