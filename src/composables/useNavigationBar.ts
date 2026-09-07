/**
 * useNavigationBar - 原生导航栏主题适配
 *
 * 原生导航栏（使用 pages.json 非 custom navigationStyle 的页面）的背景色与文字色是静态配置的，
 * 默认按深色主题写死（如 #0A0A0A / 白字），在浅色主题下会残留深色顶栏。
 * 本组合式函数在页面 onShow / 应用主题变化时调用 uni.setNavigationBarColor，让顶栏颜色随主题切换。
 *
 * 注意：不能在 onLoad 阶段调用——此时页面（尤其 navigationStyle: custom 的自定义导航页）
 * 尚未 ready，uni.setNavigationBarColor 会异步 fail（page not found），并打到控制台。
 * 因此只在 onShow / onReady 及主题变化时调用。
 *
 * 用法：在需要适配的页面 setup 中调用 useNavigationBar()
 */
import { watch } from 'vue'
import { onShow, onReady } from '@dcloudio/uni-app'
import { useAppStore } from '@/stores/app'

export function useNavigationBar() {
  const appStore = useAppStore()

  function apply() {
    try {
      uni.setNavigationBarColor({
        frontColor: appStore.isDark ? '#ffffff' : '#000000',
        backgroundColor: appStore.isDark ? '#0A0A0A' : '#F5F5F7'
      })
    } catch (e) {
      console.error('[useNavigationBar] apply failed:', e)
    }
  }

  onShow(apply)
  // 微信部分基础库版本在 onShow 阶段调用会被忽略，onReady 兜底一次
  onReady(apply)
  watch(() => appStore.theme, apply)

  return { apply }
}