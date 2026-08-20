/**
 * app store - 全局应用状态
 * Ferrari 默认暗色画布，弹窗与图片预览临时状态不持久化
 */
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { Theme } from '@/types/app'

export const useAppStore = defineStore(
  'app',
  () => {
    /** 主题：dark 默认（Ferrari 风格） */
    const theme = ref<Theme>('dark')
    /** 全局登录弹窗（移动端用） */
    const loginModalVisible = ref(false)
    /** 图片预览临时状态 */
    const imagePreviewVisible = ref(false)
    const previewList = ref<string[]>([])
    const previewIndex = ref(0)

    /** 是否暗色 */
    const isDark = (t: Theme = theme.value) => t === 'dark'

    /** 应用主题到 page 节点（uni-app 中通过 uni.setNavigationBarColor 也可控制导航栏） */
    function applyTheme(t: Theme) {
      theme.value = t
      // uni-app 中通过给 page 元素加 class 控制（App.vue 全局样式）
      // 在小程序端，page 元素由 uni 框架托管，可通过 uni.setNavigationBarColor 调整导航栏
      try {
        if (t === 'dark') {
          uni.setNavigationBarColor({
            frontColor: '#ffffff',
            backgroundColor: '#0A0A0A'
          })
        } else {
          uni.setNavigationBarColor({
            frontColor: '#000000',
            backgroundColor: '#ffffff'
          })
        }
      } catch (e) {
        // H5 端可能不支持
      }
    }

    function setTheme(t: Theme) {
      applyTheme(t)
    }

    function toggleTheme() {
      applyTheme(theme.value === 'dark' ? 'light' : 'dark')
    }

    /** 全局登录弹窗 */
    function openLoginModal() {
      loginModalVisible.value = true
    }
    function closeLoginModal() {
      loginModalVisible.value = false
    }

    /** 图片预览 */
    function openImagePreview(list: string[], index: number = 0) {
      previewList.value = list
      previewIndex.value = index
      // 小程序端使用 uni.previewImage 实现全局图片预览
      uni.previewImage({
        urls: list,
        current: list[index] || list[0],
        indicator: 'number',
        loop: true
      })
    }
    function closeImagePreview() {
      imagePreviewVisible.value = false
      previewList.value = []
      previewIndex.value = 0
    }

    return {
      theme,
      loginModalVisible,
      imagePreviewVisible,
      previewList,
      previewIndex,
      isDark,
      applyTheme,
      setTheme,
      toggleTheme,
      openLoginModal,
      closeLoginModal,
      openImagePreview,
      closeImagePreview
    }
  },
  {
    // 只持久化 theme，弹窗/预览状态不持久化，避免刷新后 imagePreviewVisible 残留导致全屏预览
    persist: {
      key: 'lux_customer_app',
      storage: {
        getItem: (key: string) => uni.getStorageSync(key),
        setItem: (key: string, value: string) => uni.setStorageSync(key, value)
      },
      paths: ['theme']
    } as any
  }
)
