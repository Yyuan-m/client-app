/**
 * useScrollReveal - 滚动渐显组合式函数
 *
 * 适配 uni-app：原 Web 项目使用浏览器 IntersectionObserver，
 * uni-app 改用 uni.createIntersectionObserver（小程序原生 API）
 *
 * 使用方式：
 *   const { observe } = useScrollReveal()
 *   onMounted(() => setTimeout(() => observe(), 100))
 *
 * 模板中使用 class="fade-in-up" + data-delay="100"
 */
import { onMounted, onUnmounted } from 'vue'

// #ifdef MP-WEIXIN || MP-ALIPAY || APP-PLUS
/** 小程序端：使用 uni.createIntersectionObserver */
function createMiniObserver(selector: string, callback: () => void) {
  const observer = uni.createIntersectionObserver(null as any, {
    thresholds: [0.1],
    observeAll: true
  })
  observer.relativeToViewport({ bottom: -50 }).observe(selector, (res: any) => {
    if (res.intersectionRatio > 0) {
      callback()
    }
  })
  return observer
}
// #endif

export function useScrollReveal() {
  let observers: any[] = []

  /** 观察所有 .fade-in-up:not(.visible) 元素 */
  function observe() {
    // 先 disconnect 旧 observer 防泄漏
    disconnect()

    // #ifdef H5
    // H5 端：使用浏览器 IntersectionObserver
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const el = entry.target as HTMLElement
            const delay = Number(el.dataset.delay || 0)
            setTimeout(() => el.classList.add('visible'), delay)
            observer.unobserve(el)
          }
        })
      },
      { threshold: 0.1, rootMargin: '0px 0px -50px 0px' }
    )
    const els = document.querySelectorAll('.fade-in-up:not(.visible)')
    els.forEach((el) => observer.observe(el))
    observers.push(observer)
    // #endif

    // #ifdef MP-WEIXIN || MP-ALIPAY || APP-PLUS
    // 小程序端：通过 selectComponent 查询所有 fade-in-up 节点
    // 由于小程序不支持 querySelectorAll 直接遍历，业务组件需通过 ref 主动触发
    // 简化实现：在 page 中通过 uni.createSelectorQuery 获取节点信息
    const query = uni.createSelectorQuery()
    query.selectAll('.fade-in-up:not(.visible)').boundingClientRect((rects: any) => {
      if (!Array.isArray(rects)) return
      rects.forEach((rect) => {
        if (rect.top > 0 && rect.top < (uni.getSystemInfoSync().windowHeight || 600)) {
          // 节点在视口内，触发渐显
          // 注意：小程序端无法直接操作 DOM class，业务组件需通过响应式数据控制
        }
      })
    }).exec()
    // #endif
  }

  /** 断开所有 observer */
  function disconnect() {
    observers.forEach((o) => {
      try {
        if (typeof o.disconnect === 'function') o.disconnect()
        else if (typeof o.unobserve === 'function') o.unobserve()
      } catch (e) {
        // ignore
      }
    })
    observers = []
  }

  onMounted(() => {
    // 延迟 100ms 等 DOM 渲染完成
    setTimeout(() => observe(), 100)
  })

  onUnmounted(() => {
    disconnect()
  })

  return { observe, disconnect }
}
