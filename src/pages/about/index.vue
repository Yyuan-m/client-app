<script setup lang="ts">
/**
 * 关于我们 - 静态品牌介绍页
 * 原Web: 品牌介绍 + 企业优势（getAdvantagesApi 4列网格）+ 线下门店（getStoresApi 4列网格）+ useScrollReveal
 */
import { ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { useScrollReveal } from '@/composables/useScrollReveal'
import { useThemeClass } from '@/composables/useThemeClass'
import { useNavigationBar } from '@/composables/useNavigationBar'
import { getAdvantagesApi, getStoresApi } from '@/api/modules/system'
import type { AdvantageVO, StoreVO } from '@/api/types'

const { observe } = useScrollReveal()
const { themeClass } = useThemeClass()
/** 原生导航栏随主题切换 */
useNavigationBar()

const advantages = ref<AdvantageVO[]>([])
const stores = ref<StoreVO[]>([])
const loading = ref(true)

onLoad(async () => {
  try {
    const [advRes, storeRes] = await Promise.all([getAdvantagesApi(), getStoresApi()])
    advantages.value = advRes || []
    stores.value = storeRes || []
  } catch (e) {
    console.error('[about] load failed:', e)
  } finally {
    loading.value = false
    setTimeout(() => observe(), 100)
  }
})

function callStore(phone: string) {
  if (!phone) return
  uni.makePhoneCall({ phoneNumber: phone }).catch(() => {})
}
</script>

<template>
  <view class="container about-page" :class="themeClass">
    <!-- 品牌介绍 -->
    <view class="brand-section fade-in-up">
      <view class="brand-title">LUXURY CAR · 大圣玩车</view>
      <view class="brand-subtitle">豪华车租赁服务平台</view>
      <view class="brand-desc">
        大圣玩车成立于 2015 年，是一家专注于豪华车租赁的服务平台。
        我们提供奔驰、宝马、保时捷、路虎、宾利、玛莎拉蒂等多个品牌的豪华车型租赁服务，
        覆盖全国主要城市，致力于为每一位客户带来尊享、安全、便捷的出行体验。
      </view>
      <view class="brand-stats">
        <view class="stat-item">
          <view class="stat-num">50+</view>
          <view class="stat-label">车型选择</view>
        </view>
        <view class="stat-item">
          <view class="stat-num">10万+</view>
          <view class="stat-label">服务客户</view>
        </view>
        <view class="stat-item">
          <view class="stat-num">4.9</view>
          <view class="stat-label">客户评分</view>
        </view>
      </view>
    </view>

    <!-- 企业优势 -->
    <view class="section-title fade-in-up">企业优势</view>
    <view class="advantage-grid">
      <view v-for="(adv, idx) in advantages" :key="adv.id" class="advantage-card fade-in-up" :data-delay="idx * 100">
        <view class="adv-icon">{{ adv.icon || '★' }}</view>
        <view class="adv-title">{{ adv.title }}</view>
        <view class="adv-content">{{ adv.content }}</view>
      </view>
      <view v-if="!loading && !advantages.length" class="empty-text">暂无数据</view>
    </view>

    <!-- 线下门店 -->
    <view class="section-title fade-in-up">线下门店</view>
    <view class="store-list">
      <view v-for="(store, idx) in stores" :key="store.id" class="store-card fade-in-up" :data-delay="idx * 100" @tap="callStore(store.phone || '')">
        <view class="store-header">
          <view class="store-name">{{ store.storeName || store.name || '门店' }}</view>
          <view v-if="store.phone" class="store-phone">{{ store.phone }}</view>
        </view>
        <view v-if="store.address" class="store-address">📍 {{ store.address }}</view>
      </view>
      <view v-if="!loading && !stores.length" class="empty-text">暂无门店数据</view>
    </view>
  </view>
</template>

<style scoped lang="scss">
.about-page {
  padding-bottom: calc(48rpx + env(safe-area-inset-bottom));
}

.brand-section {
  text-align: center;
  padding: 48rpx 32rpx;
  background: linear-gradient(135deg, rgba(255, 46, 46, 0.1) 0%, rgba(26, 26, 26, 0.8) 100%);
  border-radius: 16rpx;
  margin-bottom: 48rpx;
}

.brand-title {
  font-size: 44rpx;
  font-weight: 800;
  color: #ff2e2e;
  letter-spacing: 2rpx;
}

.brand-subtitle {
  font-size: 28rpx;
  color: var(--text-sub);
  margin-top: 8rpx;
}

.brand-desc {
  font-size: 26rpx;
  color: var(--text-sub);
  line-height: 1.8;
  margin-top: 32rpx;
  text-align: left;
}

.brand-stats {
  display: flex;
  justify-content: space-around;
  margin-top: 48rpx;
}

.stat-item {
  text-align: center;
}

.stat-num {
  font-size: 48rpx;
  font-weight: 800;
  color: #ff5a3c;
  line-height: 1.2;
}

.stat-label {
  font-size: 22rpx;
  color: var(--text-sub);
  margin-top: 4rpx;
}

.section-title {
  font-size: 36rpx;
  font-weight: 600;
  color: var(--text-main);
  margin: 48rpx 0 24rpx;
}

.advantage-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 24rpx;
}

.advantage-card {
  padding: 32rpx 24rpx;
  background-color: var(--card-bg);
  border: 1rpx solid var(--border-color);
  border-radius: 16rpx;
  text-align: center;
}

.adv-icon {
  font-size: 48rpx;
  margin-bottom: 16rpx;
}

.adv-title {
  font-size: 28rpx;
  font-weight: 600;
  color: var(--text-main);
  margin-bottom: 8rpx;
}

.adv-content {
  font-size: 22rpx;
  color: var(--text-sub);
  line-height: 1.6;
}

.store-list {
  display: flex;
  flex-direction: column;
  gap: 24rpx;
}

.store-card {
  padding: 32rpx;
  background-color: var(--card-bg);
  border: 1rpx solid var(--border-color);
  border-radius: 16rpx;
}

.store-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12rpx;
}

.store-name {
  font-size: 30rpx;
  font-weight: 600;
  color: var(--text-main);
}

.store-phone {
  font-size: 26rpx;
  color: #ff2e2e;
}

.store-address {
  font-size: 24rpx;
  color: var(--text-sub);
  line-height: 1.6;
}

.empty-text {
  text-align: center;
  padding: 48rpx;
  color: var(--text-dim);
  font-size: 26rpx;
}
</style>
