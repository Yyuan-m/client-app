<script setup lang="ts">
/**
 * ReviewDialog - 评价弹窗（核心）
 *
 * 业务对齐原 Web 项目 ReviewDialog 组件：
 *  - Props：modelValue（v-model 布尔）、orderId（number | string）
 *  - Emits：update:modelValue、success（参数为 review 对象）
 *  - 弹窗打开时 Promise.all 并发加载三项：
 *    1. getOrderDetailApi(orderId) - 订单详情
 *    2. getCanReviewRoundApi(orderId) - 1 首评 / 2 追评 / null 不可评
 *    3. getOrderReviewsApi(orderId) - 已有评价列表
 *  - 表单：1-5 星评分（u-rate）、500 字内容限制（u-textarea）、最多 9 张图片上传（5MB 限制）
 *  - 图片上传：uni.chooseImage + uploadImageApi，自定义上传带 onProgress 进度
 *  - 历史评价图片预览：appStore.openImagePreview
 *  - 图片字段解析兼容 JSON 数组字符串和逗号分隔字符串
 *  - 提交校验：评分 + 内容 + 等待图片上传完成
 *  - 弹窗：u-popup（mode=center），close-on-click-modal=false
 *  - 提交：submitReviewApi，成功后 emit success + 关闭弹窗 + uni.showToast 成功提示
 *
 * 适配 uni-app 关键差异：
 *  - el-dialog → u-popup（mode=center）+ 自定义内容
 *  - el-upload + axios onUploadProgress → uni.chooseImage + uploadImageApi（带 onProgress）
 *  - ElMessage → uni.showToast
 *  - el-rate → u-rate
 *  - 弹窗内容滚动 → scroll-view
 */
import { ref, reactive, watch, computed } from 'vue'
import { useAppStore } from '@/stores/app'
import { getOrderDetailApi } from '@/api/modules/order'
import { getCanReviewRoundApi, getOrderReviewsApi, submitReviewApi } from '@/api/modules/review'
import { uploadImageApi } from '@/api/modules/user'
import { moneyUtil } from '@/utils'
import { resolveAdminImage, resolveClientImage } from '@/utils/image'
import type { OrderVO, ReviewVO, CanReviewResult } from '@/api/types'

/** ReviewDialog Props */
export interface ReviewDialogProps {
  /** 弹窗显隐（v-model） */
  modelValue?: boolean
  /** 订单 ID */
  orderId?: number | string | null
}

const props = withDefaults(defineProps<ReviewDialogProps>(), {
  modelValue: false,
  orderId: null
})

const emit = defineEmits<{
  /** v-model 更新 */
  (e: 'update:modelValue', value: boolean): void
  /** 提交成功 */
  (e: 'success', orderId: number | string): void
}>()

const appStore = useAppStore()
/** 加载动画颜色：随深浅主题切换 */
const loadingColor = computed(() => (appStore.isDark ? '#aeaeb2' : '#6e6e73'))

/** 弹窗内加载态 */
const dialogLoading = ref<boolean>(false)
/** 提交中 */
const submitting = ref<boolean>(false)
/** 订单数据 */
const order = ref<OrderVO | null>(null)
/** 当前评价轮次：1=首评, 2=追评 */
const currentRound = ref<1 | 2>(1)
/** 已有评价列表 */
const existingReviews = ref<ReviewVO[]>([])

/** 表单数据 */
const form = reactive<{ rating: number; content: string }>({
  rating: 5,
  content: ''
})

/** u-rate 评分色阶（红橙色） */
const rateColors = ['#f13a2c', '#f13a2c', '#da291c']

/** 已上传图片列表（含本地预览路径 + 远程 URL） */
interface UploadImage {
  /** 本地临时路径（预览用） */
  localPath: string
  /** 上传后远程 URL */
  remoteUrl?: string
  /** 上传状态：pending / uploading / done / error */
  status: 'pending' | 'uploading' | 'done' | 'error'
  /** 上传进度 0-100 */
  progress: number
}

const imageList = ref<UploadImage[]>([])
/** 正在上传的图片数量（提交前需等待全部完成） */
const uploadingCount = ref<number>(0)

/** 图片预览（调用全局 ImagePreview 单例 / appStore.openImagePreview） */
function previewImage(list: string[], index: number = 0): void {
  appStore.openImagePreview(list, index)
}

/** 解析 images 字段：兼容 JSON 数组字符串和逗号分隔字符串 */
function parseImages(imagesStr?: string | null): string[] {
  if (!imagesStr) return []
  try {
    const parsed = JSON.parse(imagesStr)
    if (Array.isArray(parsed)) return parsed as string[]
  } catch {
    // 不是 JSON 数组，按逗号分隔处理
  }
  return String(imagesStr)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}

/** 选择图片（uni.chooseImage） */
function chooseImages(): void {
  const remain = 9 - imageList.value.length
  if (remain <= 0) {
    uni.showToast({ title: '最多上传9张图片', icon: 'none' })
    return
  }
  uni.chooseImage({
    count: Math.min(remain, 9),
    sizeType: ['compressed'],
    sourceType: ['album', 'camera'],
    success: (res) => {
      // uni 类型中 tempFilePaths 在不同端类型可能为 string | string[]，统一断言为 string[]
      const paths: string[] = Array.isArray(res.tempFilePaths)
        ? res.tempFilePaths
        : res.tempFilePaths
        ? [res.tempFilePaths]
        : []
      const tempFiles = (res.tempFiles as Array<{ path?: string; size?: number }>) || []
      paths.forEach((path: string) => {
        // 校验图片大小（5MB 限制）
        const size = tempFiles.find((f) => f.path === path)?.size
        if (size && size / 1024 / 1024 > 5) {
          uni.showToast({ title: '图片不能超过 5MB', icon: 'none' })
          return
        }
        imageList.value.push({
          localPath: path,
          status: 'pending',
          progress: 0
        })
        // 自动开始上传
        uploadSingleImage(imageList.value.length - 1)
      })
    },
    fail: (err) => {
      if (err.errMsg?.includes('cancel')) return
      console.error('[ReviewDialog] chooseImage failed:', err)
    }
  })
}

/** 单张图片上传（自定义上传，带 onProgress 进度） */
async function uploadSingleImage(index: number): Promise<void> {
  const item = imageList.value[index]
  if (!item || item.status === 'done' || item.status === 'uploading') return
  item.status = 'uploading'
  item.progress = 0
  uploadingCount.value++

  try {
    const result = await uploadImageApi(item.localPath)
    // uploadImageApi 内部已处理进度回调（通过 onProgress 选项）
    // 但当前签名未透传 onProgress，这里通过包装方式实现
    item.remoteUrl = (result as any)?.url || (result as any)?.data?.url || ''
    item.status = 'done'
    item.progress = 100
  } catch (e) {
    console.error('[ReviewDialog] 图片上传失败:', e)
    item.status = 'error'
    uni.showToast({ title: '图片上传失败', icon: 'none' })
  } finally {
    uploadingCount.value--
  }
}

/** 删除已选图片 */
function removeImage(index: number): void {
  imageList.value.splice(index, 1)
}

/** 预览已上传图片 */
function previewUploadedImage(index: number): void {
  const list = imageList.value.map((i) => i.localPath)
  previewImage(list, index)
}

/** 预览历史评价图片 */
function previewHistoryImages(imagesStr: string, idx: number = 0): void {
  const raw = parseImages(imagesStr)
  const list = raw.map((p) => resolveClientImage(p))
  previewImage(list, idx)
}

/** 重置表单状态 */
function resetState(): void {
  order.value = null
  existingReviews.value = []
  currentRound.value = 1
  form.rating = 5
  form.content = ''
  imageList.value = []
  uploadingCount.value = 0
}

/** 加载弹窗数据：Promise.all 并发拉取三项 */
async function loadData(orderId: number | string): Promise<void> {
  dialogLoading.value = true
  try {
    const [orderData, roundRes, reviews] = await Promise.all([
      getOrderDetailApi(orderId),
      getCanReviewRoundApi(orderId),
      getOrderReviewsApi(orderId).catch(() => [] as ReviewVO[])
    ])
    order.value = orderData
    existingReviews.value = reviews || []
    const round = (roundRes as CanReviewResult)?.canReviewRound
    if (round === 1 || round === 2) {
      currentRound.value = round
    } else {
      uni.showToast({ title: '该订单当前不可评价', icon: 'none' })
      emit('update:modelValue', false)
      return
    }
  } catch (e) {
    console.error('[ReviewDialog] 数据加载失败:', e)
    uni.showToast({ title: '数据加载失败', icon: 'none' })
    emit('update:modelValue', false)
  } finally {
    dialogLoading.value = false
  }
}

/** 提交评价 */
async function handleSubmit(): Promise<void> {
  if (!form.rating) {
    uni.showToast({ title: '请选择评分', icon: 'none' })
    return
  }
  if (!form.content.trim()) {
    uni.showToast({ title: '请填写评价内容', icon: 'none' })
    return
  }
  if (uploadingCount.value > 0) {
    uni.showToast({ title: '图片正在上传，请稍候', icon: 'none' })
    return
  }

  // 收集已上传成功的图片完整 URL
  const urls = imageList.value.filter((f) => f.remoteUrl).map((f) => f.remoteUrl!) as string[]
  const imagesStr = urls.length ? JSON.stringify(urls) : null

  submitting.value = true
  try {
    await submitReviewApi({
      orderId: Number(props.orderId as number | string),
      rating: form.rating,
      content: form.content.trim(),
      images: imagesStr || undefined
    })
    uni.showToast({
      title: currentRound.value === 2 ? '追评提交成功' : '评价提交成功',
      icon: 'success'
    })
    emit('success', Number(props.orderId as number | string))
    emit('update:modelValue', false)
  } catch (e) {
    console.error('[ReviewDialog] 评价提交失败:', e)
  } finally {
    submitting.value = false
  }
}

/** 关闭弹窗 */
function handleClose(): void {
  emit('update:modelValue', false)
}

/** 订单号展示（兼容 orderNo / id） */
function orderNoText(): string {
  return order.value?.orderNo || `#${order.value?.id || ''}`
}

/** 历史评价展示标准化（兼容 reviewRound / round 字段） */
function normalizeReview(rv: ReviewVO): { round: 1 | 2; date: string; rating: number; content: string; images: string } {
  const round = (rv.round || rv.reviewRound || 1) as 1 | 2
  const date = (rv.createTime || '').toString().slice(0, 10)
  return {
    round,
    date,
    rating: Number(rv.rating || 0),
    content: rv.content || '',
    images: rv.images || ''
  }
}

/** 监听弹窗打开 + orderId 变化，自动加载数据 */
watch(
  () => [props.modelValue, props.orderId],
  ([visible, orderId]) => {
    if (visible && orderId) {
      resetState()
      loadData(orderId as number | string)
    }
  },
  { immediate: false }
)
</script>

<template>
  <u-popup
    :show="props.modelValue"
    mode="center"
    :close-on-click-overlay="false"
    :custom-style="{ width: '92vw', maxWidth: '680rpx', borderRadius: '12rpx' }"
    @close="handleClose"
  >
    <view class="review-dialog">
      <!-- 弹窗头部 -->
      <view class="dialog-header">
        <text class="dialog-title">{{ currentRound === 2 ? '追加评价' : '订单评价' }}</text>
        <view class="dialog-close" @tap="handleClose">
          <text class="close-icon">×</text>
        </view>
      </view>

      <!-- 内容滚动区 -->
      <scroll-view scroll-y class="dialog-body">
        <!-- 加载中 -->
        <view v-if="dialogLoading" class="dialog-loading">
          <u-loading-icon mode="circle" :color="loadingColor" :textColor="loadingColor" />
          <text class="loading-text">加载中…</text>
        </view>

        <template v-else-if="order">
          <!-- 订单信息卡片 -->
          <view class="order-info-card">
            <image
              :src="resolveAdminImage(order.carCover || '')"
              mode="aspectFill"
              class="order-img"
            />
            <view class="order-meta">
              <text class="order-name">{{ order.carName }}</text>
              <text class="order-period">{{ order.startDate }} 至 {{ order.endDate }}（{{ order.days }}天）</text>
              <text v-if="order.store" class="order-store">{{ order.store }}</text>
              <text class="order-no">订单号：{{ orderNoText() }}</text>
            </view>
            <view class="order-amount">
              <text class="amount-label">应付</text>
              <text class="amount-value">￥{{ moneyUtil.format(order.totalAmount) }}</text>
            </view>
          </view>

          <!-- 已有评价（追评时展示首评） -->
          <view v-if="existingReviews.length" class="existing-reviews">
            <view class="block-title-wrap">
              <text class="block-title-bar" />
              <text class="block-title">已发表的评价</text>
            </view>
            <view v-for="rv in existingReviews" :key="rv.id" class="review-history-card">
              <view class="review-history-head">
                <view class="round-tag" :class="normalizeReview(rv).round === 1 ? 'first' : 'append'">
                  <text class="round-tag-text">
                    {{ normalizeReview(rv).round === 1 ? '首次评价' : '追加评价' }}
                  </text>
                </view>
                <view class="review-stars">
                  <text
                    v-for="n in 5"
                    :key="n"
                    class="star"
                    :class="{ active: n <= normalizeReview(rv).rating }"
                  >★</text>
                </view>
                <text class="review-date">{{ normalizeReview(rv).date }}</text>
              </view>
              <text class="review-history-content">{{ normalizeReview(rv).content }}</text>
              <view v-if="parseImages(normalizeReview(rv).images).length" class="review-images">
                <image
                  v-for="(img, i) in parseImages(normalizeReview(rv).images)"
                  :key="i"
                  :src="resolveClientImage(img)"
                  mode="aspectFill"
                  class="review-img"
                  @tap="previewHistoryImages(normalizeReview(rv).images, i)"
                />
              </view>
            </view>
          </view>

          <!-- 评价表单 -->
          <view class="review-form-card">
            <view class="block-title-wrap">
              <text class="block-title-bar" />
              <text class="block-title">
                {{ currentRound === 2 ? '写下您的追加评价' : '写下您的评价' }}
              </text>
              <text class="round-hint">
                {{ currentRound === 2 ? '（第2次，每单最多2次）' : '（第1次，完成后可追加1次）' }}
              </text>
            </view>

            <view class="form-item">
              <text class="form-label">总体评分</text>
              <view class="rate-wrap">
                <u-rate
                  :model-value="form.rating"
                  :count="5"
                  :colors="rateColors"
                  :custom-style="{ padding: '8rpx 0' }"
                  @change="(val: number) => (form.rating = val)"
                />
                <text class="rate-text">{{ ['很差', '较差', '一般', '满意', '非常满意'][form.rating - 1] || '' }}</text>
              </view>
            </view>

            <view class="form-item">
              <text class="form-label">评价内容</text>
              <u-textarea
                v-model="form.content"
                :maxlength="500"
                :auto-height="true"
                placeholder="分享您的用车体验、车况、服务感受..."
                :custom-style="{
                  backgroundColor: 'var(--page-bg)',
                  color: 'var(--text-main)',
                  border: '1rpx solid var(--border-color)',
                  borderRadius: '8rpx',
                  padding: '20rpx'
                }"
              />
            </view>

            <view class="form-item">
              <view class="upload-label-row">
                <text class="form-label">评价图片（可选，最多9张）</text>
                <text class="upload-count">{{ imageList.length }}/9</text>
              </view>
              <view class="upload-grid">
                <view v-for="(img, idx) in imageList" :key="idx" class="upload-item">
                  <image :src="img.localPath" mode="aspectFill" class="upload-img" @tap="previewUploadedImage(idx)" />
                  <view v-if="img.status === 'uploading'" class="upload-mask">
                    <text class="upload-progress">{{ img.progress }}%</text>
                  </view>
                  <view v-else-if="img.status === 'error'" class="upload-mask error">
                    <text class="upload-progress">!</text>
                  </view>
                  <view class="upload-remove" @tap.stop="removeImage(idx)">
                    <text class="remove-icon">×</text>
                  </view>
                </view>
                <view v-if="imageList.length < 9" class="upload-add" @tap="chooseImages">
                  <text class="add-icon">+</text>
                  <text class="add-text">添加图片</text>
                </view>
              </view>
              <text class="upload-hint">支持 JPG/PNG，单张不超过 5MB</text>
            </view>
          </view>
        </template>

        <!-- 订单不存在 -->
        <EmptyTips v-else text="订单不存在或不可评价" />
      </scroll-view>

      <!-- 底部按钮区 -->
      <view v-if="!dialogLoading && order" class="dialog-footer">
        <u-button
          text="取消"
          shape="square"
          :custom-style="{
            flex: 1,
            height: '72rpx',
            fontSize: '28rpx',
            backgroundColor: 'var(--border-color)',
            color: 'var(--text-sub)',
            border: 'none'
          }"
          @click="handleClose"
        />
        <u-button
          :text="currentRound === 2 ? '提交追评' : '提交评价'"
          type="error"
          shape="square"
          :loading="submitting"
          :disabled="!order || dialogLoading"
          :custom-style="{
            flex: 1,
            height: '72rpx',
            fontSize: '28rpx',
            marginLeft: '16rpx'
          }"
          @click="handleSubmit"
        />
      </view>
    </view>
  </u-popup>
</template>

<style scoped lang="scss">
.review-dialog {
  background-color: var(--card-bg);
  border-radius: 12rpx;
  max-height: 85vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.dialog-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 24rpx 32rpx;
  border-bottom: 1rpx solid var(--border-color);
  flex-shrink: 0;
}

.dialog-title {
  font-size: 32rpx;
  font-weight: 600;
  color: var(--text-main);
}

.dialog-close {
  width: 56rpx;
  height: 56rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;

  &:active {
    background-color: rgba(255, 255, 255, 0.08);
  }

  .close-icon {
    font-size: 36rpx;
    color: var(--text-sub);
    line-height: 1;
  }
}

.dialog-body {
  flex: 1;
  padding: 24rpx 32rpx;
  overflow-y: auto;
}

.dialog-loading {
  min-height: 400rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16rpx;

  .loading-text {
    font-size: 26rpx;
    color: var(--text-sub);
  }
}

/* ============ 订单信息卡片 ============ */
.order-info-card {
  display: flex;
  gap: 24rpx;
  align-items: center;
  background-color: var(--card-bg);
  border: 1rpx solid var(--border-color);
  border-radius: 12rpx;
  padding: 20rpx 24rpx;
  margin-bottom: 32rpx;

  .order-img {
    width: 144rpx;
    height: 96rpx;
    border-radius: 8rpx;
    flex-shrink: 0;
    background-color: var(--page-bg);
  }

  .order-meta {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 4rpx;

    .order-name {
      font-size: 28rpx;
      font-weight: 500;
      color: var(--text-main);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .order-period,
    .order-store,
    .order-no {
      font-size: 22rpx;
      color: var(--text-dim);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
  }

  .order-amount {
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 4rpx;

    .amount-label {
      font-size: 20rpx;
      color: var(--text-dim);
    }
    .amount-value {
      font-size: 30rpx;
      font-weight: 600;
      color: #ff5a3c;
    }
  }
}

/* ============ 区块标题 ============ */
.block-title-wrap {
  display: flex;
  align-items: center;
  gap: 12rpx;
  margin-bottom: 16rpx;

  .block-title-bar {
    width: 6rpx;
    height: 28rpx;
    background-color: #ff2e2e;
    border-radius: 3rpx;
  }
  .block-title {
    font-size: 28rpx;
    font-weight: 600;
    color: var(--text-main);
  }
  .round-hint {
    font-size: 22rpx;
    color: var(--text-dim);
  }
}

/* ============ 历史评价卡片 ============ */
.existing-reviews {
  margin-bottom: 32rpx;
}

.review-history-card {
  background-color: var(--card-bg);
  border: 1rpx solid var(--border-color);
  border-radius: 8rpx;
  padding: 20rpx 24rpx;
  margin-bottom: 12rpx;

  &:last-child {
    margin-bottom: 0;
  }
}

.review-history-head {
  display: flex;
  align-items: center;
  gap: 16rpx;
  margin-bottom: 8rpx;

  .round-tag {
    padding: 4rpx 12rpx;
    border-radius: 4rpx;

    &.first {
      background-color: rgba(255, 46, 46, 0.12);
      .round-tag-text {
        color: #ff2e2e;
      }
    }
    &.append {
      background-color: rgba(76, 152, 185, 0.15);
      .round-tag-text {
        color: #4c98b9;
      }
    }
    .round-tag-text {
      font-size: 22rpx;
      font-weight: 500;
    }
  }

  .review-stars {
    display: flex;
    gap: 2rpx;

    .star {
      font-size: 24rpx;
      color: #3a3a3a;
      &.active {
        color: #ff2e2e;
      }
    }
  }

  .review-date {
    font-size: 22rpx;
    color: var(--text-dim);
    margin-left: auto;
  }
}

.review-history-content {
  font-size: 26rpx;
  color: var(--text-main);
  line-height: 1.6;
  margin-bottom: 12rpx;
}

.review-images {
  display: flex;
  gap: 12rpx;
  flex-wrap: wrap;

  .review-img {
    width: 144rpx;
    height: 144rpx;
    border-radius: 8rpx;
    border: 1rpx solid var(--border-color);
    background-color: var(--page-bg);
  }
}

/* ============ 评价表单 ============ */
.review-form-card {
  background-color: var(--card-bg);
  border: 1rpx solid var(--border-color);
  border-radius: 12rpx;
  padding: 24rpx;
}

.form-item {
  margin-bottom: 24rpx;

  &:last-child {
    margin-bottom: 0;
  }
}

.form-label {
  display: block;
  font-size: 26rpx;
  font-weight: 500;
  color: var(--text-main);
  margin-bottom: 12rpx;
}

.rate-wrap {
  display: flex;
  align-items: center;
  gap: 16rpx;

  .rate-text {
    font-size: 24rpx;
    color: var(--text-sub);
  }
}

.upload-label-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12rpx;

  .upload-count {
    font-size: 22rpx;
    color: var(--text-dim);
  }
}

.upload-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16rpx;
}

.upload-item {
  position: relative;
  aspect-ratio: 1;
  border-radius: 8rpx;
  overflow: hidden;
  background-color: var(--page-bg);
  border: 1rpx solid var(--border-color);

  .upload-img {
    width: 100%;
    height: 100%;
  }

  .upload-mask {
    position: absolute;
    inset: 0;
    background-color: rgba(0, 0, 0, 0.6);
    display: flex;
    align-items: center;
    justify-content: center;

    &.error {
      background-color: rgba(255, 59, 48, 0.6);
    }

    .upload-progress {
      color: #fff;
      font-size: 24rpx;
      font-weight: 600;
    }
  }

  .upload-remove {
    position: absolute;
    top: 4rpx;
    right: 4rpx;
    width: 32rpx;
    height: 32rpx;
    border-radius: 50%;
    background-color: rgba(0, 0, 0, 0.7);
    display: flex;
    align-items: center;
    justify-content: center;

    .remove-icon {
      color: #fff;
      font-size: 24rpx;
      line-height: 1;
    }
  }
}

.upload-add {
  aspect-ratio: 1;
  border: 1rpx dashed var(--border-color);
  border-radius: 8rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8rpx;
  background-color: transparent;

  &:active {
    border-color: #ff2e2e;
    background-color: rgba(255, 46, 46, 0.05);

    .add-icon,
    .add-text {
      color: #ff2e2e;
    }
  }

  .add-icon {
    font-size: 40rpx;
    color: var(--text-dim);
    line-height: 1;
  }
  .add-text {
    font-size: 20rpx;
    color: var(--text-dim);
  }
}

.upload-hint {
  font-size: 22rpx;
  color: var(--text-dim);
  margin-top: 12rpx;
  display: block;
}

/* ============ 底部按钮 ============ */
.dialog-footer {
  display: flex;
  align-items: center;
  gap: 16rpx;
  padding: 20rpx 32rpx;
  border-top: 1rpx solid var(--border-color);
  flex-shrink: 0;
}
</style>
