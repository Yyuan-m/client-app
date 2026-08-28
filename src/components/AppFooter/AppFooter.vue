<script setup lang="ts">
/**
 * AppFooter - 移动端页脚（精简版）
 *
 * 业务对齐原 Web 项目 AppFooter 组件：
 *  - 通过 useSystemConfig 加载站点配置（电话 / 邮箱 / 地址 / 站名 / 副标题）
 *  - 车型分类链接通过 getDictByTypeApi('vehicle_type') 加载
 *  - 联系方式条件渲染（tel: / mailto: 链接，缺省回退"查看门店与客服"）
 *  - 版权条
 *
 * 适配 uni-app：
 *  - 4 列网格 → 移动端竖向堆叠
 *  - router-link → uni.navigateTo
 *  - 字典点击跳 /pages/vehicle/list?type=xxx
 */
import { ref, onMounted } from 'vue'
import { useSystemConfig } from '@/composables/useSystemConfig'
import { getDictByTypeApi } from '@/api/modules/system'
import type { DictDataVO, SystemConfigVO } from '@/api/types'

/** 系统配置（响应式引用，由 useSystemConfig 模块级单例持有） */
const { config, loadConfig } = useSystemConfig()

/** 车型分类字典 */
const vehicleTypes = ref<DictDataVO[]>([])

/** 当前年份 */
const currentYear = new Date().getFullYear()

onMounted(() => {
  loadConfig().catch((e) => {
    // 被去重取消的请求静默处理
    if (!(e as any)?.__canceled) {
      console.error('[AppFooter] loadConfig failed:', e)
    }
  })
  getDictByTypeApi('vehicle_type')
    .then((list) => {
      vehicleTypes.value = (list || []).slice(0, 6)
    })
    .catch((e) => console.error('[AppFooter] 加载车型分类字典失败', e))
})

/** 跳转车辆列表（带分类参数） */
function goVehicleList(type?: string): void {
  const url = type
    ? `/pages/vehicle/list?type=${encodeURIComponent(type)}`
    : '/pages/vehicle/list'
  uni.navigateTo({
    url,
    fail: () => {
      // 列表页可能是 tabbar 页面，navigateTo 失败时降级 reLaunch
      uni.reLaunch({ url })
    }
  })
}

/** 跳转关于我们 */
function goAbout(): void {
  uni.navigateTo({ url: '/pages/about/index' })
}

/** 跳转联系客服 */
function goContact(): void {
  uni.navigateTo({ url: '/pages/contact/index' })
}

/** 拨打电话 */
function callPhone(phone: string): void {
  if (!phone) return
  uni.makePhoneCall({ phoneNumber: phone }).catch((e) => {
    console.error('[AppFooter] makePhoneCall failed:', e)
  })
}

/** 复制邮箱到剪贴板（小程序无 mailto，改为复制） */
function copyEmail(email: string): void {
  if (!email) return
  uni.setClipboardData({
    data: email,
    success: () => {
      uni.showToast({ title: '邮箱已复制', icon: 'none' })
    }
  })
}

/** 获取配置安全访问器（避免 config 为 null 时报错） */
function cfg(): Partial<SystemConfigVO> {
  return config.value || {}
}
</script>

<template>
  <view class="app-footer">
    <view class="footer-inner">
      <!-- 品牌区 -->
      <view class="footer-section footer-brand">
        <text class="footer-logo">LUXURY CAR</text>
        <text class="footer-desc">专注高端出行，尊享极致驾驶体验</text>
      </view>

      <!-- 车型浏览 -->
      <view class="footer-section">
        <text class="footer-title">车型浏览</text>
        <view class="footer-link" @tap="goVehicleList()">
          <text class="footer-link-text">全部车型</text>
        </view>
        <view v-for="item in vehicleTypes" :key="item.dictValue" class="footer-link" @tap="goVehicleList(item.dictValue)">
          <text class="footer-link-text">{{ item.dictLabel }}</text>
        </view>
      </view>

      <!-- 关于我们 -->
      <view class="footer-section">
        <text class="footer-title">关于我们</text>
        <view class="footer-link" @tap="goAbout">
          <text class="footer-link-text">品牌介绍</text>
        </view>
        <view class="footer-link" @tap="goContact">
          <text class="footer-link-text">联系客服</text>
        </view>
        <view class="footer-link" @tap="goVehicleList()">
          <text class="footer-link-text">车型列表</text>
        </view>
      </view>

      <!-- 联系我们 -->
      <view class="footer-section">
        <text class="footer-title">联系我们</text>
        <view class="footer-link" @tap="callPhone(cfg().hotline || cfg().phone || '')">
          <text class="footer-link-icon">☎</text>
          <text class="footer-link-text">{{ cfg().hotline || cfg().phone || '暂无' }}</text>
        </view>
        <view class="footer-link" @tap="copyEmail(cfg().email || '')">
          <text class="footer-link-icon">✉</text>
          <text class="footer-link-text">{{ cfg().email || '暂无' }}</text>
        </view>
        <view class="footer-link" @tap="goContact">
          <text class="footer-link-icon">⌖</text>
          <text class="footer-link-text">{{ cfg().address || '查看门店与客服' }}</text>
        </view>
      </view>
    </view>

    <!-- 版权条 -->
    <view class="footer-bottom">
      <text class="footer-copy">
        © {{ currentYear }} {{ cfg().siteName || 'LUXURY CAR' }} {{ cfg().siteSubtitle || '大圣玩车' }}. All rights reserved.
      </text>
    </view>
  </view>
</template>

<style scoped lang="scss">
.app-footer {
  background-color: var(--page-bg);
  padding: 48rpx 32rpx 24rpx;
  margin-top: 48rpx;
  border-top: 1rpx solid var(--border-color);
}

.footer-inner {
  display: flex;
  flex-direction: column;
  gap: 40rpx;
}

.footer-section {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
}

.footer-brand {
  margin-bottom: 8rpx;
}

.footer-logo {
  font-size: 36rpx;
  font-weight: 600;
  letter-spacing: 2rpx;
  text-transform: uppercase;
  color: var(--text-main);
  margin-bottom: 8rpx;
}

.footer-desc {
  font-size: 24rpx;
  color: var(--text-sub);
  line-height: 1.6;
}

.footer-title {
  font-size: 26rpx;
  font-weight: 600;
  letter-spacing: 1rpx;
  text-transform: uppercase;
  color: var(--text-main);
  margin-bottom: 8rpx;
  padding-left: 12rpx;
  border-left: 4rpx solid #ff2e2e;
}

.footer-link {
  display: flex;
  align-items: center;
  gap: 12rpx;
  padding: 8rpx 0;

  &:active {
    .footer-link-text {
      color: #ff2e2e;
    }
  }
}

.footer-link-icon {
  font-size: 26rpx;
  color: var(--text-dim);
  width: 32rpx;
  text-align: center;
}

.footer-link-text {
  font-size: 26rpx;
  color: var(--text-sub);
  transition: color 0.2s;
  flex: 1;
}

.footer-bottom {
  margin-top: 32rpx;
  padding-top: 24rpx;
  border-top: 1rpx solid var(--border-color);
  text-align: center;
}

.footer-copy {
  font-size: 22rpx;
  color: var(--text-dim);
  line-height: 1.6;
}
</style>
