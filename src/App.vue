<script setup lang="ts">
import { onLaunch, onShow, onHide, onError } from '@dcloudio/uni-app'
import { useAppStore } from '@/stores/app'
import { useUserStore } from '@/stores/user'
import { useCartStore } from '@/stores/cart'

// 应用启动：恢复主题、初始化购物车（登录用户）
onLaunch(() => {
  const appStore = useAppStore()
  appStore.applyTheme(appStore.theme)

  const userStore = useUserStore()
  if (userStore.isLoggedIn) {
    // 登录态恢复时拉取购物车
    const cartStore = useCartStore()
    cartStore.initCart().catch((e) => {
      console.error('[App] initCart failed:', e)
    })
  }
})

onShow(() => {
  console.log('[App] onShow')
})

onHide(() => {
  console.log('[App] onHide')
})

onError((err) => {
  console.error('[App] onError:', err)
})
</script>

<style lang="scss">
@import 'uview-plus/index.scss';

/* 全局基础样式（暗色 Ferrari 风格） */
page {
  background-color: #0a0a0a;
  color: #f5f5f5;
  font-family: -apple-system, BlinkMacSystemFont, 'PingFang SC', 'Helvetica Neue', Arial, sans-serif;
  font-size: 28rpx;
  line-height: 1.5;
}

view, text, image, scroll-view, swiper {
  box-sizing: border-box;
}

image {
  display: block;
}

/* 通用容器 */
.container {
  min-height: 100vh;
  padding: 24rpx;
}

/* 通用卡片 */
.card {
  background-color: #1a1a1a;
  border-radius: 16rpx;
  padding: 24rpx;
  margin-bottom: 24rpx;
}

/* 强调色（法拉利红） */
.text-primary {
  color: #ff2e2e;
}

.bg-primary {
  background-color: #ff2e2e;
}

/* 价格颜色 */
.text-price {
  color: #ff5a3c;
}

/* 通用渐显动画（配合 useScrollReveal） */
.fade-in-up {
  opacity: 0;
  transform: translateY(40rpx);
  transition: opacity 0.6s ease, transform 0.6s ease;
}
.fade-in-up.visible {
  opacity: 1;
  transform: translateY(0);
}

/* 骨架屏 shimmer */
.skeleton {
  position: relative;
  overflow: hidden;
  background-color: #2a2a2a;
}
.skeleton::after {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.06), transparent);
  animation: shimmer 1.5s infinite;
}
@keyframes shimmer {
  0% { transform: translateX(-100%); }
  100% { transform: translateX(100%); }
}

/* ============ uview-plus 全局样式覆盖 ============
 * 修复 u-picker / u-popup 等弹窗组件在暗色主题下，文字颜色与背景融合看不清
 * 注意：u-picker 实际 DOM 类名与早期版本不同，需使用 uview-plus 3.x 的真实类名
 */
.u-picker {
  background-color: #1a1a1a !important;
}
/* 顶部工具栏（取消/确认/标题） */
.u-toolbar {
  background-color: #1a1a1a !important;
}
.u-toolbar__wrapper__cancel {
  color: #aeaeb2 !important;
}
.u-toolbar__wrapper__confirm {
  color: #ff2e2e !important;
}
.u-toolbar__title {
  color: #f5f5f5 !important;
}
/* 列选项文字 */
.u-picker__view__column__item {
  color: #f5f5f5 !important;
  background-color: transparent !important;
}
.u-picker__view__column__item--selected {
  color: #ff2e2e !important;
  font-weight: 700 !important;
}
/* u-popup 弹窗主体背景 */
.u-popup__content {
  background-color: #1a1a1a !important;
  color: #f5f5f5 !important;
}

/* 亮色主题 */
page.light {
  background-color: #f5f5f7;
  color: #1d1d1f;
}
page.light .card {
  background-color: #ffffff;
}
page.light .skeleton {
  background-color: #e9e9ec;
}
</style>
