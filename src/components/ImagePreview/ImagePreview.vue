<script setup lang="ts">
/**
 * ImagePreview - 全局图片预览单例（占位桥接组件）
 *
 * 业务对齐原 Web 项目 ImagePreview 组件：
 *  - 全局图片预览单例，由 appStore.openImagePreview(list, index) 触发
 *  - 响应式读取 appStore 的 imagePreviewVisible / previewList / previewIndex
 *
 * 适配 uni-app 关键差异：
 *  - 原 Web 项目使用 el-image-viewer 实现，移动端 uni.previewImage 已是原生能力
 *  - appStore.openImagePreview 内部已直接调用 uni.previewImage（小程序 / App / H5 三端通用）
 *  - 因此本组件作为单例占位 + composable 桥接，无需自行渲染预览 UI
 *
 * 用法：在根布局（如 DefaultLayout 或 App.vue）挂载一次即可
 *   <ImagePreview />
 *
 * 调用：任意组件通过 appStore.openImagePreview(list, index) 触发预览
 */
import { useAppStore } from '@/stores/app'

const appStore = useAppStore()

/** 暴露给父组件编程式调用（兼容直接通过组件实例触发预览的场景） */
defineExpose({
  /** 打开图片预览 */
  open(list: string[], index: number = 0): void {
    appStore.openImagePreview(list, index)
  },
  /** 关闭图片预览（uni.previewImage 由用户手动关闭，这里仅清空 store 状态） */
  close(): void {
    appStore.closeImagePreview()
  }
})
</script>

<template>
  <!-- 占位节点：uni.previewImage 由系统层接管 UI，无需渲染任何内容 -->
  <view class="image-preview-placeholder" style="display: none" />
</template>
