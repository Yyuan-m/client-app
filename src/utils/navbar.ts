/**
 * 自定义导航栏（navigationStyle: custom）页面顶部偏移工具
 *
 * 作用：在微信小程序里，custom 页面内容从 y=0 开始绘制，
 * 右上角胶囊按钮（圆圈+三点）会盖住顶部内容。
 * 本工具计算"胶囊底部 + 间隙"，作为页面顶部 padding-top，让内容落到胶囊之下。
 *
 * - 微信小程序：用 uni.getMenuButtonBoundingClientRect() 取胶囊 bottom
 * - H5 / App / 支付宝小程序等：退化为状态栏高度 + 间距
 *
 * 用法（在 navigationStyle: custom 的页面）：
 *   import { getCustomNavTopOffset } from '@/utils/navbar'
 *   const navTop = getCustomNavTopOffset()
 *   // <view class="page-root" :style="{ paddingTop: navTop + 'px' }">
 *
 * 返回值为 px（注意是 px 不是 rpx），直接拼到 inline style 的 px 上即可。
 */
export function getCustomNavTopOffset(): number {
  let statusBarHeight = 0
  try {
    statusBarHeight = uni.getSystemInfoSync().statusBarHeight || 0
  } catch (e) {
    console.error('[navbar] getSystemInfo failed:', e)
  }

  // #ifdef MP-WEIXIN
  try {
    const m = uni.getMenuButtonBoundingClientRect()
    // m.bottom = 胶囊下沿（已含状态栏 + 胶囊高度），加 6px 间隙
    if (m && m.bottom) return m.bottom + 6
  } catch (e) {
    console.error('[navbar] getMenuButton failed:', e)
  }
  // #endif

  // H5 / App / 支付宝小程序等：状态栏高度 + 8px 间距
  return statusBarHeight + 8
}

export default { getCustomNavTopOffset }
