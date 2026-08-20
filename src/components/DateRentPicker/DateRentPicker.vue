<script setup lang="ts">
/**
 * DateRentPicker - 租期选择器（核心）
 *
 * 业务对齐原 Web 项目 DateRentPicker 组件：
 *  - Props：modelValue（v-model 双向绑定，[startDate, endDate]）、minDays（默认 1）、maxDays（默认 20）、minDate（最早可租日）
 *  - Emits：update:modelValue、change（参数 { days, startDate, endDate, valid }）
 *  - 禁用今天之前 + minDate 之前日期
 *  - 快捷选项：3/7/15/20 天，根据 minDays/maxDays 动态过滤
 *  - 调用 dateUtil.validateRentDays 校验
 *  - UI 反馈：有效显示"租期 N 天"，无效显示红色错误
 *
 * 适配 uni-app 关键差异：
 *  - 原 Web 用 el-date-picker type=daterange（范围选择器）
 *  - uni-app 端 uview-plus u-calendar 在不同平台行为不一致
 *  - 采用两个独立 <picker mode="date">（开始 + 结束），更稳定可靠
 *  - 原始快捷选项 hover/click 直接设置日期范围
 */
import { ref, computed, watch } from 'vue'
import { dateUtil } from '@/utils'
import dayjs from 'dayjs'

/** DateRentPicker Props */
export interface DateRentPickerProps {
  /** v-model 双向绑定，[startDate, endDate]，YYYY-MM-DD */
  modelValue?: string[]
  /** 最少租期（天），默认 1 */
  minDays?: number
  /** 最长租期（天），默认 20 */
  maxDays?: number
  /** 最早可租日（YYYY-MM-DD），用于已出租/已预约车辆 */
  minDate?: string
}

const props = withDefaults(defineProps<DateRentPickerProps>(), {
  modelValue: () => [],
  minDays: 1,
  maxDays: 20,
  minDate: ''
})

const emit = defineEmits<{
  /** v-model 更新 */
  (e: 'update:modelValue', value: string[]): void
  /** 选择变化：携带 days、startDate、endDate、valid 标记 */
  (e: 'change', payload: { days: number; startDate: string; endDate: string; valid: boolean }): void
}>()

/** 开始日期 */
const startDate = ref<string>(props.modelValue?.[0] || '')
/** 结束日期 */
const endDate = ref<string>(props.modelValue?.[1] || '')
/** 间隔天数 */
const days = ref<number>(0)
/** 错误提示 */
const error = ref<string>('')

/** 今天 YYYY-MM-DD */
const today = computed<string>(() => dayjs().format('YYYY-MM-DD'))

/** 日期选择器最小可选日期（今天或 minDate 中较大者） */
const pickerStart = computed<string>(() => {
  const candidates = [today.value]
  if (props.minDate) candidates.push(props.minDate)
  candidates.sort()
  return candidates[candidates.length - 1]
})

/** 结束日期选择器最小值（必须 >= 开始日期） */
const pickerEnd = computed<string>(() => {
  return startDate.value || pickerStart.value
})

/** 快捷选项：根据 minDays/maxDays 动态过滤 */
const shortcuts = computed<Array<{ text: string; days: number }>>(() => {
  const all = [
    { text: '3天', days: 3 },
    { text: '7天', days: 7 },
    { text: '15天', days: 15 },
    { text: '20天', days: 20 }
  ]
  return all.filter((s) => s.days >= props.minDays && s.days <= props.maxDays)
})

/** 监听外部 modelValue 变化，同步内部状态 */
watch(
  () => props.modelValue,
  (val) => {
    startDate.value = val?.[0] || ''
    endDate.value = val?.[1] || ''
    recompute()
  },
  { deep: true }
)

/** 重新计算天数 + 校验 + emit */
function recompute(): void {
  if (!startDate.value || !endDate.value) {
    days.value = 0
    error.value = ''
    emit('update:modelValue', [])
    emit('change', { days: 0, startDate: '', endDate: '', valid: false })
    return
  }
  const result = dateUtil.validateRentDays(startDate.value, endDate.value, props.minDays, props.maxDays)
  days.value = result.days || 0
  error.value = result.valid ? '' : result.msg || ''
  emit('update:modelValue', [startDate.value, endDate.value])
  emit('change', {
    days: days.value,
    startDate: startDate.value,
    endDate: endDate.value,
    valid: result.valid
  })
}

/** 开始日期变化 */
function onStartChange(e: any): void {
  startDate.value = e.detail.value || ''
  // 如果开始日期晚于结束日期，重置结束日期
  if (endDate.value && dayjs(endDate.value).isBefore(dayjs(startDate.value))) {
    endDate.value = ''
  }
  recompute()
}

/** 结束日期变化 */
function onEndChange(e: any): void {
  endDate.value = e.detail.value || ''
  recompute()
}

/** 快捷选项点击：以今天或 minDate（取较晚者）为起点，加 N 天为终点 */
function applyShortcut(daysCount: number): void {
  const baseDate = pickerStart.value
  startDate.value = baseDate
  endDate.value = dayjs(baseDate).add(daysCount, 'day').format('YYYY-MM-DD')
  recompute()
}

/** 初始化计算（若有初始值） */
if (startDate.value && endDate.value) {
  recompute()
}
</script>

<template>
  <view class="date-rent-picker">
    <!-- 两个独立日期选择器：开始 + 结束 -->
    <view class="picker-row">
      <view class="picker-item">
        <text class="picker-label">取车日期</text>
        <picker mode="date" :value="startDate" :start="pickerStart" @change="onStartChange">
          <view class="picker-display" :class="{ placeholder: !startDate }">
            <text class="picker-text">{{ startDate || '请选择取车日期' }}</text>
            <text class="picker-arrow">▾</text>
          </view>
        </picker>
      </view>

      <view class="picker-sep">
        <text class="picker-sep-text">至</text>
      </view>

      <view class="picker-item">
        <text class="picker-label">还车日期</text>
        <picker mode="date" :value="endDate" :start="pickerEnd" @change="onEndChange">
          <view class="picker-display" :class="{ placeholder: !endDate }">
            <text class="picker-text">{{ endDate || '请选择还车日期' }}</text>
            <text class="picker-arrow">▾</text>
          </view>
        </picker>
      </view>
    </view>

    <!-- 快捷选项 -->
    <view v-if="shortcuts.length" class="shortcuts">
      <view
        v-for="s in shortcuts"
        :key="s.days"
        class="shortcut-tag"
        @tap="applyShortcut(s.days)"
      >
        <text class="shortcut-text">{{ s.text }}</text>
      </view>
    </view>

    <!-- 间隔天数 + 错误反馈 -->
    <view v-if="days > 0 || error" class="rent-info">
      <view v-if="days > 0" class="days-info">
        <text class="days-label">租期</text>
        <text class="days-num">{{ days }}</text>
        <text class="days-label">天</text>
      </view>
      <text v-if="error" class="error-text">{{ error }}</text>
    </view>
  </view>
</template>

<style scoped lang="scss">
.date-rent-picker {
  width: 100%;
}

.picker-row {
  display: flex;
  align-items: flex-end;
  gap: 16rpx;
}

.picker-item {
  flex: 1;
  min-width: 0;
}

.picker-label {
  display: block;
  font-size: 22rpx;
  color: #aeaeb2;
  margin-bottom: 8rpx;
  letter-spacing: 0.5rpx;
}

.picker-display {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16rpx 20rpx;
  background-color: #1a1a1a;
  border: 1rpx solid #2a2a2a;
  border-radius: 8rpx;

  &.placeholder {
    .picker-text {
      color: #6e6e73;
    }
  }

  &:active {
    border-color: #ff2e2e;
  }
}

.picker-text {
  font-size: 26rpx;
  color: #f5f5f5;
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.picker-arrow {
  font-size: 24rpx;
  color: #aeaeb2;
  margin-left: 8rpx;
}

.picker-sep {
  display: flex;
  align-items: center;
  justify-content: center;
  padding-bottom: 16rpx;

  .picker-sep-text {
    font-size: 24rpx;
    color: #aeaeb2;
  }
}

.shortcuts {
  display: flex;
  flex-wrap: wrap;
  gap: 16rpx;
  margin-top: 20rpx;
}

.shortcut-tag {
  padding: 10rpx 24rpx;
  background-color: rgba(255, 46, 46, 0.08);
  border: 1rpx solid rgba(255, 46, 46, 0.3);
  border-radius: 20rpx;

  &:active {
    background-color: #ff2e2e;

    .shortcut-text {
      color: #fff;
    }
  }

  .shortcut-text {
    font-size: 24rpx;
    color: #ff2e2e;
    font-weight: 500;
  }
}

.rent-info {
  margin-top: 20rpx;
  display: flex;
  align-items: center;
  gap: 24rpx;
  flex-wrap: wrap;
}

.days-info {
  display: flex;
  align-items: baseline;
  gap: 6rpx;

  .days-label {
    font-size: 26rpx;
    color: #aeaeb2;
  }
  .days-num {
    font-size: 36rpx;
    font-weight: 600;
    color: #ff2e2e;
    margin: 0 4rpx;
  }
}

.error-text {
  font-size: 22rpx;
  color: #ff3b30;
  background-color: rgba(255, 59, 48, 0.08);
  padding: 4rpx 12rpx;
  border-radius: 4rpx;
}

/* 亮色主题 */
:global(page.light) .picker-label,
:global(page.light) .picker-sep-text,
:global(page.light) .days-info .days-label {
  color: #6e6e73;
}
:global(page.light) .picker-display {
  background-color: #ffffff;
  border-color: #e9e9ec;
}
:global(page.light) .picker-text {
  color: #1d1d1f;
}
:global(page.light) .picker-display.placeholder .picker-text {
  color: #8e8e93;
}
:global(page.light) .picker-arrow {
  color: #8e8e93;
}
:global(page.light) .days-info .days-num {
  color: #ff2e2e;
}
</style>
