<script setup lang="ts">
import { onLaunch, onShow, onHide, onError } from '@dcloudio/uni-app'
import { useAppStore } from '@/stores/app'
import { useUserStore } from '@/stores/user'
import { useCartStore } from '@/stores/cart'

// 应用启动：初始化主题（恢复偏好 + 系统主题监听）、初始化购物车（登录用户）
onLaunch(() => {
  const appStore = useAppStore()
  appStore.initTheme()

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

/* ============ 主题 CSS 变量（暗色为默认） ============
 * 页面根元素绑定 useThemeClass 的 themeClass，浅色时加 .theme-light 覆盖变量
 */
page {
  /* 暗色（默认） */
  --page-bg: #0a0a0a;
  --card-bg: #1a1a1a;
  --border-color: #2a2a2a;
  --text-main: #f5f5f5;
  --text-sub: #aeaeb2;
  --text-dim: #6e6e73;
  /* 危险/强调色（用途：取消预约等），暗色下用更亮的红保证可读性 */
  --text-danger: #ff7a7f;
  --danger-bg: #3a1c1c;
  --danger-border: #b0464c;

  /* page 元素背景设为透明：整体背景由 applyTheme 中的 uni.setBackgroundColor 随主题动态控制，
   * 避免 page 上的不透明 CSS 背景盖住窗口背景，导致浅色主题下加载/顶部区域仍露出黑色 */
  background-color: transparent;
  color: #f5f5f5;
  font-family: -apple-system, BlinkMacSystemFont, 'PingFang SC', 'Helvetica Neue', Arial, sans-serif;
  font-size: 28rpx;
  line-height: 1.5;
}

/* 浅色主题（挂在页面根元素 class 上） */
.theme-light {
  --page-bg: #f5f5f7;
  --card-bg: #ffffff;
  --border-color: #e9e9ec;
  --text-main: #1a1a1a;
  --text-sub: #6e6e73;
  --text-dim: #8e8e93;
  /* 亮色：危险色换成更深的红，保证在白底上清晰可读 */
  --text-danger: #d02521;
  --danger-bg: #fbebea;
  --danger-border: #e0827e;
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
  background-color: var(--page-bg);
}

/* 通用卡片 */
.card {
  background-color: var(--card-bg);
  border: 1rpx solid var(--border-color);
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

/* 通用渐显动画（配合 useScrollReveal）
 * 注意：默认即可见，避免小程序 / App / H5 端因无法可靠触发 visible 而整页空白
 * （H5 用 IntersectionObserver，若元素初始在视口外或 observer 未触发会一直 opacity:0）
 * 进入视口时有轻微上移动画过渡 */
.fade-in-up {
  opacity: 1;
  transform: none;
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
  background-color: var(--border-color);
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
/* 浅色主题：骨架屏用浅色描边，高光反转为深色淡层以保证可见 */
.theme-light .skeleton::after {
  background: linear-gradient(90deg, transparent, rgba(0, 0, 0, 0.06), transparent);
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

/* 浅色主题下弹窗/选择器恢复浅色 */
.theme-light .u-picker,
.theme-light .u-toolbar,
.theme-light .u-popup__content {
  background-color: #ffffff !important;
  color: #1a1a1a !important;
}
.theme-light .u-toolbar__wrapper__cancel,
.theme-light .u-picker__view__column__item {
  color: #6e6e73 !important;
}
.theme-light .u-toolbar__title {
  color: #1a1a1a !important;
}
/* 浅色下 u-input / u-textarea 深色文字（uni.scss 深色主题变量编译出的浅色文字需翻转），占位符用深灰保证可读 */
.theme-light .u-input__content__field-wrapper__field,
.theme-light .u-textarea__field {
  color: #1d1d1f !important;
}
.theme-light .input-placeholder {
  color: #909399 !important;
}

/* 浅色下 u-button（非强调色）默认文字改为深色，主题按钮（primary红色）白字保持 */
.theme-light .u-button__text {
  color: #1d1d1f !important;
}
.theme-light .u-button--primary .u-button__text,
.theme-light .u-button--error .u-button__text {
  color: #ffffff !important;
}
</style>
