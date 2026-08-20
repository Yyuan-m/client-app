<script setup lang="ts">
/**
 * TabBar - 移动端底部导航
 *
 * 由于不使用 pages.json 内置 tabBar（内置 tabBar 在 mp-weixin 端必须提供 PNG 图标），
 * 改用自定义组件 + uni.reLaunch 跳转，可在所有端（mp-weixin / mp-alipay / H5 / App）通用
 *
 * 用法：在 home / vehicle/list / cart / profile 4 个主页面底部引入 <TabBar />
 */
import { computed, ref } from 'vue'
import { useCartStore } from '@/stores/cart'
import { useUserStore } from '@/stores/user'

interface TabItem {
  pagePath: string
  text: string
  icon: string
  activeIcon: string
  badge?: number
}

const props = defineProps<{
  /** 当前激活的页面路径，如 'pages/home/index' */
  active: string
}>()

const cartStore = useCartStore()
const userStore = useUserStore()

const tabs = computed<TabItem[]>(() => [
  {
    pagePath: 'pages/home/index',
    text: '首页',
    icon: 'home',
    activeIcon: 'home-fill'
  },
  {
    pagePath: 'pages/vehicle/list',
    text: '车辆',
    icon: 'search',
    activeIcon: 'search'
  },
  {
    pagePath: 'pages/cart/index',
    text: '购物车',
    icon: 'shopping-cart',
    activeIcon: 'shopping-cart-fill',
    badge: cartStore.totalCount
  },
  {
    pagePath: 'pages/profile/index',
    text: '我的',
    icon: 'account',
    activeIcon: 'account-fill'
  }
])

function onTabClick(tab: TabItem) {
  if (tab.pagePath === props.active) return
  uni.reLaunch({
    url: `/${tab.pagePath}`,
    fail: (err) => {
      console.error('[TabBar] reLaunch failed:', err)
      uni.showToast({ title: '页面跳转失败', icon: 'none' })
    }
  })
}

// 当前激活的 index
const activeIndex = computed(() => tabs.value.findIndex((t) => t.pagePath === props.active))
const showBadge = ref(true)
</script>

<template>
  <view class="tabbar">
    <view
      v-for="(tab, idx) in tabs"
      :key="tab.pagePath"
      class="tabbar-item"
      :class="{ active: idx === activeIndex }"
      @tap="onTabClick(tab)"
    >
      <view class="tabbar-icon-wrap">
        <text
          class="tabbar-icon"
          :class="idx === activeIndex ? tab.activeIcon : tab.icon"
          v-if="false"
        ></text>
        <!-- 简单文字图标占位（无 PNG 资源时使用） -->
        <view class="tabbar-icon-text" :class="{ active: idx === activeIndex }">
          {{ tab.text.charAt(0) }}
        </view>
        <view v-if="tab.badge && tab.badge > 0" class="tabbar-badge">
          {{ tab.badge > 99 ? '99+' : tab.badge }}
        </view>
      </view>
      <text class="tabbar-text" :class="{ active: idx === activeIndex }">{{ tab.text }}</text>
    </view>
  </view>
</template>

<style scoped lang="scss">
.tabbar {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  height: calc(100rpx + env(safe-area-inset-bottom));
  padding-bottom: env(safe-area-inset-bottom);
  background-color: #0a0a0a;
  border-top: 1rpx solid #2a2a2a;
  display: flex;
  z-index: 999;

  .tabbar-item {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 12rpx 0;

    &.active {
      .tabbar-icon-text {
        color: #ff2e2e;
      }
      .tabbar-text {
        color: #ff2e2e;
      }
    }
  }

  .tabbar-icon-wrap {
    position: relative;
    width: 48rpx;
    height: 48rpx;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 4rpx;
  }

  .tabbar-icon-text {
    font-size: 32rpx;
    color: #aeaeb2;
    font-weight: 600;
    transition: color 0.2s;

    &.active {
      color: #ff2e2e;
    }
  }

  .tabbar-text {
    font-size: 22rpx;
    color: #aeaeb2;
    transition: color 0.2s;

    &.active {
      color: #ff2e2e;
    }
  }

  .tabbar-badge {
    position: absolute;
    top: -10rpx;
    right: -16rpx;
    min-width: 32rpx;
    height: 32rpx;
    padding: 0 8rpx;
    background-color: #ff2e2e;
    color: #fff;
    font-size: 20rpx;
    line-height: 32rpx;
    text-align: center;
    border-radius: 16rpx;
  }
}

/* 亮色主题 */
:global(page.light) .tabbar {
  background-color: #ffffff;
  border-top-color: #e9e9ec;

  .tabbar-icon-text,
  .tabbar-text {
    color: #6e6e73;
  }
  .tabbar-item.active {
    .tabbar-icon-text,
    .tabbar-text {
      color: #ff2e2e;
    }
  }
}
</style>
