<script setup lang="ts">
/**
 * PageSkeleton - 页面骨架屏
 *
 * 业务对齐原 Web 项目 PageSkeleton 组件：
 *  - 三种模式：grid（车辆列表网格）/ detail（详情大图）/ list（行式列表）
 *  - shimmer 动画由全局 .skeleton 类提供（App.vue 中已定义）
 *
 * 适配 uni-app：
 *  - 使用 view 替代 div
 *  - 移除响应式断点，移动端固定单列网格（grid 模式 2 列）
 *  - rpx 单位
 */

/** PageSkeleton Props */
export interface PageSkeletonProps {
  /** 骨架类型：grid 车辆列表网格 / detail 详情大图 / list 行式列表 */
  type?: 'grid' | 'detail' | 'list'
  /** 渲染数量（grid/list 模式生效） */
  count?: number
}

const props = withDefaults(defineProps<PageSkeletonProps>(), {
  type: 'list',
  count: 6
})

/** 生成 [1..n] 数组用于 v-for */
function range(n: number): number[] {
  return Array.from({ length: n }, (_, i) => i + 1)
}
</script>

<template>
  <view class="page-skeleton">
    <!-- 车辆列表网格骨架（2 列） -->
    <view v-if="props.type === 'grid'" class="skeleton-grid">
      <view v-for="n in range(props.count)" :key="n" class="skeleton-card">
        <view class="skeleton skeleton-img" />
        <view class="skeleton skeleton-line w-80" />
        <view class="skeleton skeleton-line w-60" />
        <view class="skeleton skeleton-line w-40" />
      </view>
    </view>

    <!-- 详情骨架 -->
    <view v-else-if="props.type === 'detail'" class="skeleton-detail">
      <view class="skeleton skeleton-img-lg" />
      <view class="skeleton skeleton-line w-100" />
      <view class="skeleton skeleton-line w-60" />
      <view class="skeleton skeleton-line w-80" />
    </view>

    <!-- 通用行骨架 -->
    <view v-else class="skeleton-list">
      <view v-for="n in range(props.count)" :key="n" class="skeleton-row">
        <view class="skeleton skeleton-circle" />
        <view class="skeleton-lines">
          <view class="skeleton skeleton-line w-100" />
          <view class="skeleton skeleton-line w-60" />
        </view>
      </view>
    </view>
  </view>
</template>

<style scoped lang="scss">
.page-skeleton {
  width: 100%;
}

/* shimmer 动画由全局 .skeleton 类提供，这里仅补充尺寸/布局 */
.skeleton {
  border-radius: 8rpx;
}

/* ============ grid 模式：2 列车辆卡片 ============ */
.skeleton-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 24rpx;
}

.skeleton-card {
  background-color: transparent;
  .skeleton-img {
    width: 100%;
    height: 200rpx;
    border-radius: 12rpx;
  }
  .skeleton-line {
    height: 24rpx;
    margin-top: 16rpx;
  }
}

/* ============ detail 模式：大图 + 文本行 ============ */
.skeleton-img-lg {
  width: 100%;
  height: 400rpx;
  border-radius: 12rpx;
}
.skeleton-detail {
  .skeleton-line {
    height: 32rpx;
    margin-top: 24rpx;
  }
}

/* ============ list 模式：圆形头像 + 文本行 ============ */
.skeleton-list {
  display: flex;
  flex-direction: column;
}

.skeleton-row {
  display: flex;
  align-items: center;
  gap: 24rpx;
  padding: 24rpx 0;
  border-bottom: 1rpx solid #1f1f1f;

  .skeleton-circle {
    width: 96rpx;
    height: 96rpx;
    border-radius: 50%;
    flex-shrink: 0;
  }
  .skeleton-lines {
    flex: 1;
    min-width: 0;
  }
  .skeleton-line {
    height: 24rpx;
    margin-top: 12rpx;
    &:first-child {
      margin-top: 0;
    }
  }
}

/* 通用宽度辅助类 */
.w-40 {
  width: 40%;
}
.w-60 {
  width: 60%;
}
.w-80 {
  width: 80%;
}
.w-100 {
  width: 100%;
}

/* 亮色主题 */
:global(page.light) .skeleton-row {
  border-bottom-color: #e9e9ec;
}
</style>
