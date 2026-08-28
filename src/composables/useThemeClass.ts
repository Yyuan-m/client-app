/**
 * useThemeClass - 页面根元素主题 class
 *
 * 用法：页面根元素绑定 :class="themeClass"
 * 浅色时返回 'theme-light'，暗色返回 ''（暗色为默认样式，无需额外 class）
 * 配合 App.vue 的 CSS 变量与各页面 .theme-light 样式块实现整页切换
 *
 * 附带窗口背景同步：pages.json 静态配置的窗口背景/导航栏为暗色，且 appStore.applyTheme
 * 只在启动页与切主题时的当前页执行，新跳转的页面窗口背景仍是暗色（首屏渲染前、
 * 回弹、加载时会露出黑底）。这里在每个页面 onLoad/onShow 及主题变化时把
 * 当前页面窗口背景、下拉刷新指示点颜色设置为当前主题色。
 */
import { computed, watch } from 'vue'
import { onLoad, onShow } from '@dcloudio/uni-app'
import { useAppStore } from '@/stores/app'

export function useThemeClass() {
  const appStore = useAppStore()
  const themeClass = computed(() => (appStore.isDark ? '' : 'theme-light'))

  /** 将当前页面窗口背景同步为当前主题色 */
  function applyWindowBackground() {
    const dark = appStore.isDark
    try {
      uni.setBackgroundColor?.({
        backgroundColor: dark ? '#0A0A0A' : '#f5f5f7',
        backgroundColorTop: dark ? '#0A0A0A' : '#f5f5f7',
        backgroundColorBottom: dark ? '#0A0A0A' : '#f5f5f7'
      })
    } catch (e) {
      // H5 等平台不支持
    }
    try {
      // 下拉刷新 loading 点颜色随主题
      uni.setBackgroundTextStyle?.({ textStyle: dark ? 'light' : 'dark' })
    } catch (e) {
      // 部分平台不支持
    }
  }

  onLoad(applyWindowBackground)
  onShow(applyWindowBackground)
  watch(() => appStore.theme, applyWindowBackground)

  return { themeClass, appStore }
}
