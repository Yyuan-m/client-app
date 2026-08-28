/**
 * app store - 全局应用状态
 * 主题：偏好（dark/light/auto）持久化，auto 跟随系统（uni.onThemeChange）
 * 弹窗与图片预览临时状态不持久化
 */
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { Theme, ThemePreference } from '@/types/app'

export const useAppStore = defineStore(
  'app',
  () => {
    /** 主题偏好：用户设置项（持久化），auto = 跟随系统 */
    const themePreference = ref<ThemePreference>('dark')
    /** 系统主题（onThemeChange 同步） */
    const systemTheme = ref<Theme>('dark')
    /** 全局登录弹窗（移动端用） */
    const loginModalVisible = ref(false)
    /** 图片预览临时状态 */
    const imagePreviewVisible = ref(false)
    const previewList = ref<string[]>([])
    const previewIndex = ref(0)

    /** 实际生效主题：偏好为 auto 时取系统主题 */
    const theme = computed<Theme>(
      () => (themePreference.value === 'auto' ? systemTheme.value : themePreference.value)
    )
    /** 是否暗色 */
    const isDark = computed(() => theme.value === 'dark')

    /** 应用当前主题：同步导航栏、页面窗口背景、下拉刷新 loading 点颜色 */
    function applyTheme(t: Theme = theme.value) {
      try {
        // 导航栏
        uni.setNavigationBarColor({
          frontColor: t === 'dark' ? '#ffffff' : '#000000',
          backgroundColor: t === 'dark' ? '#0A0A0A' : '#F5F5F7'
        })
      } catch (e) {
        // H5 端可能不支持
      }
      // 页面窗口背景：刷新/下拉加载时 loading 背景会露出，需随主题切换（默认硬编码黑）
      try {
        uni.setBackgroundColor?.({
          backgroundColor: t === 'dark' ? '#0A0A0A' : '#f5f5f7',
          backgroundColorTop: t === 'dark' ? '#0A0A0A' : '#f5f5f7',
          backgroundColorBottom: t === 'dark' ? '#0A0A0A' : '#f5f5f7'
        })
      } catch (e) {
        // 部分平台不支持
      }
      try {
        // 下拉刷新的 loading 点颜色随主题
        uni.setBackgroundTextStyle?.({ textStyle: t === 'dark' ? 'light' : 'dark' })
      } catch (e) {
        // 部分平台不支持
      }
    }

    /** 设置主题偏好并立即应用 */
    function setPreference(p: ThemePreference) {
      themePreference.value = p
      applyTheme()
    }

    /** 兼容旧调用：直接设置生效主题（覆盖偏好） */
    function setTheme(t: Theme) {
      setPreference(t)
    }

    /** 兼容旧调用：暗浅切换 */
    function toggleTheme() {
      setPreference(theme.value === 'dark' ? 'light' : 'dark')
    }

    /**
     * 初始化主题：读取系统主题并注册系统主题变化监听（auto 偏好时生效）
     * 需在小程序 manifest 开启 darkmode 才能收到 onThemeChange
     */
    function initTheme() {
      try {
        const info = uni.getAppBaseInfo?.()
        if (info?.theme === 'light' || info?.theme === 'dark') {
          systemTheme.value = info.theme
        }
      } catch {
        // 低版本基础库无 getAppBaseInfo
      }
      // #ifdef MP-WEIXIN
      if (typeof uni.onThemeChange === 'function') {
        uni.onThemeChange((res: any) => {
          if (res?.theme === 'light' || res?.theme === 'dark') {
            systemTheme.value = res.theme
            applyTheme()
          }
        })
      }
      // #endif
      applyTheme()
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
      themePreference,
      systemTheme,
      loginModalVisible,
      imagePreviewVisible,
      previewList,
      previewIndex,
      theme,
      isDark,
      applyTheme,
      setPreference,
      setTheme,
      toggleTheme,
      initTheme,
      openLoginModal,
      closeLoginModal,
      openImagePreview,
      closeImagePreview
    }
  },
  {
    // 只持久化主题偏好，弹窗/预览状态不持久化，避免刷新后 imagePreviewVisible 残留导致全屏预览
    persist: {
      key: 'lux_customer_app',
      storage: {
        getItem: (key: string) => uni.getStorageSync(key),
        setItem: (key: string, value: string) => uni.setStorageSync(key, value)
      },
      paths: ['themePreference']
    } as any
  }
)
