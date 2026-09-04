<script setup lang="ts">
/**
 * 售后投诉 - 提交投诉
 *
 * onLoad: 支持 options.orderNo（从订单详情进入时自动选中对应订单）
 * 关联订单为必填，从用户自己的订单（getOrderListApi）中选择
 * API: getDictByTypeApi(complaint_type) 拉取投诉类型 / uploadImageApi 上传凭证图 / submitComplaintApi 提交
 * 提交成功后跳转我的投诉记录页
 */
import { ref, computed } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { getDictByTypeApi } from '@/api/modules/system'
import { getOrderListApi } from '@/api/modules/order'
import { uploadImageApi } from '@/api/modules/user'
import { submitComplaintApi } from '@/api/modules/complaint'
import { resolveClientImage } from '@/utils/image'
import { useThemeClass } from '@/composables/useThemeClass'
import { useNavigationBar } from '@/composables/useNavigationBar'
import type { DictDataVO, OrderVO } from '@/api/types'

const { themeClass, appStore } = useThemeClass()
/** 原生导航栏随主题切换 */
useNavigationBar()

const MAX_IMAGES = 9

const typeOptions = ref<DictDataVO[]>([])
const selectedType = ref('')
const orderNo = ref('')
const description = ref('')
const images = ref<string[]>([])
const submitting = ref(false)
const loadingDict = ref(true)
/** 用户自己的订单（全部状态，供关联订单选择） */
const orderOptions = ref<OrderVO[]>([])
const orderLoading = ref(false)
/** 从订单详情带过来的订单号（待订单加载后校验是否有效） */
const pendingOrderNo = ref('')

onLoad((options: Record<string, string> | undefined) => {
  const opts = options || {}
  if (opts.orderNo) pendingOrderNo.value = opts.orderNo
  loadTypes()
  loadOrders()
})

async function loadTypes() {
  loadingDict.value = true
  try {
    typeOptions.value = (await getDictByTypeApi('complaint_type')) || []
    // 默认选中第一项，方便快速提交
    if (typeOptions.value.length) selectedType.value = typeOptions.value[0].dictValue
  } catch (e) {
    console.error('[complaint] load types failed:', e)
  } finally {
    loadingDict.value = false
  }
}

async function loadOrders() {
  orderLoading.value = true
  try {
    const res = await getOrderListApi({ page: 1, pageSize: 100 })
    orderOptions.value = res.list || []
    // 订单详情带入的订单号有效则自动选中，否则清空（必须手动选择自己的订单）
    if (pendingOrderNo.value) {
      if (orderOptions.value.some((o) => o.orderNo === pendingOrderNo.value)) {
        orderNo.value = pendingOrderNo.value
      } else {
        pendingOrderNo.value = ''
      }
    }
  } catch (e) {
    console.error('[complaint] load orders failed:', e)
    orderOptions.value = []
  } finally {
    orderLoading.value = false
  }
}

/** 投诉类型选择器：展示文案/索引/变更 */
const typeLabels = computed(() => typeOptions.value.map((t) => t.dictLabel))
const typeIndex = computed(() => {
  const i = typeOptions.value.findIndex((t) => t.dictValue === selectedType.value)
  return i >= 0 ? i : 0
})
const selectedTypeLabel = computed(() => {
  if (!selectedType.value) return '请选择投诉类型'
  const t = typeOptions.value.find((x) => x.dictValue === selectedType.value)
  return t ? t.dictLabel : '请选择投诉类型'
})

function onTypeChange(e: any) {
  const idx = Number(e.detail.value)
  const t = typeOptions.value[idx]
  if (t && t.dictValue) selectedType.value = t.dictValue
}

/** 订单选择器展示文案：订单号 · 车型（状态） */
const orderLabels = computed(() =>
  orderOptions.value.map((o) => `${o.orderNo} · ${o.carName || '车辆'}（${o.statusName || ''}）`)
)
/** 订单选择器当前索引 */
const orderIndex = computed(() => {
  const i = orderOptions.value.findIndex((o) => o.orderNo === orderNo.value)
  return i >= 0 ? i : 0
})
/** 已选订单展示文案 */
const selectedOrderLabel = computed(() => {
  if (!orderNo.value) return '请选择要投诉的订单'
  const o = orderOptions.value.find((x) => x.orderNo === orderNo.value)
  return o ? `${o.orderNo} · ${o.carName || '车辆'}` : '请选择要投诉的订单'
})

function onOrderChange(e: any) {
  const idx = Number(e.detail.value)
  const o = orderOptions.value[idx]
  if (o && o.orderNo) orderNo.value = o.orderNo
}

/** 选择凭证图片（剩余数量限制） */
function chooseImages() {
  const remain = MAX_IMAGES - images.value.length
  if (remain <= 0) {
    uni.showToast({ title: `最多上传${MAX_IMAGES}张图片`, icon: 'none' })
    return
  }
  uni.chooseImage({
    count: remain,
    sizeType: ['compressed'],
    sourceType: ['album', 'camera'],
    success: async (res) => {
      const paths = res.tempFilePaths || []
      if (!paths.length) return
      uni.showLoading({ title: `上传中(${paths.length}张)...` })
      try {
        for (const p of paths) {
          const result = await uploadImageApi(p)
          if (result?.url) images.value.push(result.url)
        }
        uni.showToast({ title: '上传成功', icon: 'success' })
      } catch (e) {
        console.error('[complaint] upload failed:', e)
        uni.showToast({ title: '图片上传失败，请重试', icon: 'none' })
      } finally {
        uni.hideLoading()
      }
    }
  })
}

/** 预览凭证大图（支持多图切换） */
function previewImage(index: number) {
  const list = images.value.map((u) => resolveClientImage(u))
  appStore.openImagePreview(list, index)
}

/** 删除凭证 */
function removeImage(index: number) {
  images.value.splice(index, 1)
}

/** 提交投诉 */
async function submit() {
  if (!selectedType.value) {
    uni.showToast({ title: '请选择投诉类型', icon: 'none' })
    return
  }
  if (!orderNo.value) {
    uni.showToast({ title: '请选择要投诉的订单', icon: 'none' })
    return
  }
  if (!description.value.trim()) {
    uni.showToast({ title: '请填写投诉描述', icon: 'none' })
    return
  }
  if (description.value.trim().length > 1000) {
    uni.showToast({ title: '投诉描述不能超过1000字', icon: 'none' })
    return
  }
  submitting.value = true
  try {
    await submitComplaintApi({
      type: selectedType.value,
      orderNo: orderNo.value.trim() || undefined,
      description: description.value.trim(),
      images: images.value
    })
    uni.showToast({ title: '投诉提交成功', icon: 'success' })
    setTimeout(() => {
      uni.redirectTo({ url: '/pages/profile/complaint-list' })
    }, 600)
  } catch (e) {
    // 错误提示已由 request.ts 统一弹出
    console.error('[complaint] submit failed:', e)
  } finally {
    submitting.value = false
  }
}

/** 返回订单详情（从订单进入时） */
function backToOrder() {
  if (orderNo.value) {
    uni.navigateBack({ delta: 1, fail: () => uni.switchTab({ url: '/pages/order/list' }) })
  } else {
    uni.navigateBack({ delta: 1, fail: () => uni.navigateTo({ url: '/pages/profile/index' }) })
  }
}

const addBtnVisible = computed(() => images.value.length < MAX_IMAGES)
</script>

<template>
  <view class="complaint-page" :class="themeClass">
    <!-- 投诉类型（选择器） -->
    <view class="form-card">
      <view class="form-title">投诉类型 <text class="required">*</text></view>
      <picker
        mode="selector"
        :range="typeLabels"
        :value="typeIndex"
        :disabled="loadingDict || !typeOptions.length"
        @change="onTypeChange"
      >
        <view class="order-picker" :class="{ placeholder: !selectedType }">
          <text class="order-picker-text">{{ selectedTypeLabel }}</text>
          <view v-if="loadingDict" class="order-picker-loading">加载中...</view>
          <view v-else-if="!typeOptions.length" class="order-picker-loading">暂无投诉类型</view>
        </view>
      </picker>
    </view>

    <!-- 关联订单（必填，从用户自己的订单中选择） -->
    <view class="form-card">
      <view class="form-title">关联订单 <text class="required">*</text></view>
      <picker
        mode="selector"
        :range="orderLabels"
        :value="orderIndex"
        :disabled="orderLoading || !orderOptions.length"
        @change="onOrderChange"
      >
        <view class="order-picker" :class="{ placeholder: !orderNo }">
          <text class="order-picker-text">{{ selectedOrderLabel }}</text>
          <view v-if="orderLoading" class="order-picker-loading">加载中...</view>
          <view v-else-if="!orderOptions.length" class="order-picker-loading">暂无订单，请先下单租车</view>
        </view>
      </picker>
    </view>

    <!-- 投诉描述 -->
    <view class="form-card">
      <view class="form-title">投诉描述 <text class="required">*</text></view>
      <u-textarea
        v-model="description"
        placeholder="请详细描述您遇到的问题，如车况、服务、费用、押金、违章等"
        border="surround"
        maxlength="1000"
        count
        height="180"
      />
    </view>

    <!-- 凭证图片 -->
    <view class="form-card">
      <view class="form-title">凭证图片</view>
      <view class="evidence-grid">
        <view v-for="(img, i) in images" :key="img" class="evidence-item">
          <image :src="resolveClientImage(img)" mode="aspectFill" class="evidence-img" @tap="previewImage(i)" />
          <view class="remove-btn" @tap.stop="removeImage(i)">×</view>
        </view>
        <view v-if="addBtnVisible" class="evidence-add" @tap="chooseImages">
          <u-icon name="camera" size="48rpx" color="#8e8e93"></u-icon>
          <text class="add-text">{{ images.length }}/{{ MAX_IMAGES }}</text>
        </view>
      </view>
      <view class="form-hint">支持上传车况/费用/合同等凭证截图，单张不超过10MB，最多9张（选填）</view>
    </view>

    <u-button type="primary" shape="square" :text="submitting ? '提交中...' : '提交投诉'" :loading="submitting" @click="submit" />

    <view class="complaint-tip">提交后可在「个人中心 - 售后投诉」查看处理进度与结果，我们将在 1-3 个工作日内处理。</view>
  </view>
</template>

<style scoped lang="scss">
.complaint-page {
  min-height: 100vh;
  background-color: var(--page-bg);
  padding: 24rpx;
  padding-bottom: calc(48rpx + env(safe-area-inset-bottom));
  box-sizing: border-box;
}

.form-card {
  background-color: var(--card-bg);
  border: 1rpx solid var(--border-color);
  border-radius: 16rpx;
  padding: 24rpx;
  margin-bottom: 20rpx;
}

.form-title {
  font-size: 28rpx;
  font-weight: 500;
  color: var(--text-main);
  margin-bottom: 16rpx;

  .required {
    color: #ff2e2e;
  }
}

/* 关联订单选择器 */
.order-picker {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 80rpx;
  padding: 0 24rpx;
  border: 1rpx solid var(--border-color);
  border-radius: 8rpx;
  background-color: var(--page-bg);
  box-sizing: border-box;

  &.placeholder .order-picker-text {
    color: var(--text-dim);
  }

  .order-picker-text {
    flex: 1;
    font-size: 28rpx;
    color: var(--text-main);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .order-picker-loading {
    flex-shrink: 0;
    margin-left: 16rpx;
    font-size: 22rpx;
    color: var(--text-dim);
  }
}

.evidence-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 16rpx;
}

.evidence-item {
  position: relative;
  width: 168rpx;
  height: 168rpx;
  border-radius: 12rpx;
  overflow: hidden;

  .evidence-img {
    width: 100%;
    height: 100%;
  }

  .remove-btn {
    position: absolute;
    top: 0;
    right: 0;
    width: 40rpx;
    height: 40rpx;
    background-color: rgba(0, 0, 0, 0.6);
    color: #fff;
    font-size: 32rpx;
    line-height: 36rpx;
    text-align: center;
    border-radius: 0 0 0 12rpx;
  }
}

.evidence-add {
  width: 168rpx;
  height: 168rpx;
  border-radius: 12rpx;
  border: 2rpx dashed var(--border-color);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8rpx;

  .add-text {
    font-size: 22rpx;
    color: var(--text-dim);
  }
}

.form-hint {
  margin-top: 16rpx;
  font-size: 22rpx;
  color: var(--text-dim);
  line-height: 1.6;
}

.complaint-tip {
  margin-top: 24rpx;
  padding: 20rpx 24rpx;
  background-color: rgba(255, 46, 46, 0.06);
  border-radius: 12rpx;
  font-size: 22rpx;
  color: var(--text-sub);
  line-height: 1.6;
}
</style>
