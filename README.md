# 大圣玩车 · LUXURY CAR 用户端（uni-app 多端）

> 豪华车租赁平台用户端 - 基于 uni-app + Vue3 + TypeScript + uview-plus 的多端应用
> 业务核心闭环：**车辆浏览 → 加入购物车 → 结算下单 → 订单支付 → 租赁中 → 确认还车 → 评价/追评**
> 支持与 Web 端（`customer-client`）共享后端，**购物车跨端实时同步**

由原 Web 项目（Vue3 + Vite + Element Plus + Pinia）完整迁移，业务逻辑 1:1 复刻，并扩展预约咨询、售后投诉、会员等级、实名认证等企业级能力。

---

## 一、技术栈

| 分类 | 技术 / 库 | 版本 |
| --- | --- | --- |
| 框架 | uni-app + Vue 3（Composition API + `<script setup lang="ts">`） | Vue ^3.4.21 |
| 构建工具 | Vite + @dcloudio/vite-plugin-uni | Vite ^5.4.9 |
| UI 组件库 | uview-plus（**严禁使用 Element Plus**，小程序不兼容） | ^3.3.9 |
| 状态管理 | Pinia + pinia-plugin-persistedstate | ^2.2.4 / ^3.2.3 |
| HTTP | 自封装 `request.ts` 基于 `uni.request` / `uni.uploadFile` | - |
| 日期处理 | dayjs | ^1.11.13 |
| 类型系统 | TypeScript（strict 模式） | ^5.4.5 |
| 样式 | Sass + 设计令牌（Ferrari 风格暗色） | ^1.79.5 |

### 编译目标端

- 微信小程序（mp-weixin） ✅
- H5 ✅
- App（iOS / Android） ✅
- 支付宝小程序（mp-alipay） ✅

---

## 二、目录结构

```
customer-client-app/
├── src/
│   ├── api/                          # API 接口层
│   │   ├── modules/                  # 13 个业务模块
│   │   │   ├── announcement.ts       # 公告
│   │   │   ├── auth.ts               # 认证
│   │   │   ├── car.ts                # 车辆
│   │   │   ├── carousel.ts           # 轮播
│   │   │   ├── cart.ts               # 购物车
│   │   │   ├── complaint.ts          # 售后投诉
│   │   │   ├── coupon.ts             # 优惠券
│   │   │   ├── feedback.ts           # 反馈 / 预约咨询
│   │   │   ├── order.ts              # 订单
│   │   │   ├── price.ts              # 价格计算
│   │   │   ├── review.ts             # 评价
│   │   │   ├── system.ts             # 系统配置
│   │   │   └── user.ts               # 用户
│   │   ├── index.ts                  # 统一出口
│   │   ├── request.ts                # 请求封装（token / GET 去重 / 401 刷新 / 403 / 上传）
│   │   └── types.ts                  # 全部 TS 类型定义（VO + 入参）
│   ├── components/                   # 通用组件
│   │   ├── AppFooter/index.vue       # 页脚
│   │   ├── AppHeader/index.vue       # 顶部导航
│   │   ├── BackTop/index.vue         # 返回顶部
│   │   ├── CarCard/index.vue         # 车辆卡片（核心）
│   │   ├── CouponCard/index.vue      # 优惠券卡片（核心）
│   │   ├── DateRentPicker/index.vue  # 租期选择器（核心）
│   │   ├── EmptyTips/index.vue       # 空状态
│   │   ├── ImagePreview/index.vue    # 全局图片预览
│   │   ├── LevelUpOverlay/index.vue  # 会员升级动画
│   │   ├── PageSkeleton/index.vue    # 骨架屏
│   │   ├── ReviewDialog/index.vue    # 评价弹窗（核心）
│   │   ├── TabBar/index.vue          # 底部导航（移动端自定义）
│   │   └── WxProfileField/index.vue  # 微信资料字段
│   ├── composables/                  # 组合式函数
│   │   ├── useNavigationBar.ts       # 原生导航栏主题适配
│   │   ├── useScrollReveal.ts        # 滚动渐显（uni.createIntersectionObserver）
│   │   ├── useSystemConfig.ts        # 系统配置（pendingPromise 防并发）
│   │   └── useThemeClass.ts          # 页面根主题 class + 窗口背景同步
│   ├── pages/                        # 20+ 个业务页面
│   │   ├── home/index.vue            # 首页（沉浸式轮播 Hero）
│   │   ├── vehicle/list.vue          # 车辆列表
│   │   ├── vehicle/detail.vue        # 车辆详情（价格实时计算）
│   │   ├── cart/index.vue            # 购物车（改期弹层 + 跨端同步）
│   │   ├── order/checkout.vue        # 结算下单（优惠券叠加）
│   │   ├── order/list.vue            # 订单列表
│   │   ├── order/detail.vue          # 订单详情（支付倒计时）
│   │   ├── profile/index.vue         # 个人中心
│   │   ├── profile/appointments.vue  # 我的预约（状态跟踪/取消）
│   │   ├── profile/complaint.vue     # 售后投诉
│   │   ├── profile/complaint-list.vue# 我的投诉
│   │   ├── profile/complaint-detail.vue # 投诉详情
│   │   ├── profile/coupons.vue       # 我的优惠券
│   │   ├── profile/info.vue          # 个人信息
│   │   ├── profile/member.vue        # 会员等级
│   │   ├── profile/reviews.vue       # 我的评价
│   │   ├── profile/verify.vue        # 实名认证
│   │   ├── profile/settings.vue      # 设置（主题/密码/缓存）
│   │   ├── auth/*.vue                # 登录 / 注册 / 忘记密码
│   │   ├── announcement/*.vue        # 公告
│   │   ├── about/index.vue           # 关于我们
│   │   ├── contact/index.vue         # 联系客服（服务热线/留言反馈）
│   │   └── error/404.vue             # 404 页面
│   ├── router/                       # 路由层
│   │   └── interceptor.ts            # 全局路由拦截器（鉴权 + guest + 标题）
│   ├── stores/                       # Pinia 状态管理
│   │   ├── app.ts                    # 应用状态（主题 + 图片预览 + 登录弹窗）
│   │   ├── cart.ts                   # 购物车（核心，含跨端同步检测）
│   │   ├── filter.ts                 # 筛选条件
│   │   ├── user.ts                   # 用户/鉴权
│   │   └── index.ts                  # 统一出口
│   ├── types/
│   │   └── app.ts                    # 应用级类型（Theme 等）
│   ├── utils/                        # 工具集
│   │   ├── auth.ts                   # token / 用户信息（uni.storage）
│   │   ├── image.ts                  # 图片 URL 解析（多端基址）
│   │   ├── navbar.ts                 # 自定义导航避让胶囊
│   │   └── index.ts                  # storage / dateUtil / moneyUtil / validators
│   ├── App.vue                       # 根组件
│   ├── main.ts                       # 入口（pinia + uview-plus + 路由拦截器）
│   ├── env.d.ts                      # 类型声明
│   ├── manifest.json                 # uni-app 应用配置
│   ├── pages.json                    # 页面路由 + 全局样式
│   └── uni.scss                      # 设计令牌 + uview-plus 主题定制
├── .env                              # 环境变量（API 基址）
├── .env.development                  # 开发环境
├── .env.production                   # 生产环境
├── .gitignore
├── index.html                        # H5 入口模板
├── package.json
├── tsconfig.json
├── vite.config.ts                    # Vite 配置（H5 端 proxy）
└── README.md
```

---

## 三、快速开始

### 1. 安装依赖

```bash
cd customer-client-app
npm install
```

### 2. 启动开发（按端选择）

```bash
# H5（默认走 Vite devServer proxy 转发到 customer-server:8089 / admin-server:8088）
npm run dev:h5

# 微信小程序
npm run dev:mp-weixin
# 用微信开发者工具打开 dist/dev/mp-weixin 目录

# 支付宝小程序
npm run dev:mp-alipay
# 用支付宝小程序开发者工具打开 dist/dev/mp-alipay 目录

# App（需配合 HBuilderX）
npm run dev:app
```

### 3. 生产构建

```bash
npm run build:mp-weixin
npm run build:mp-alipay
npm run build:h5
npm run build:app
```

### 4. 类型检查

```bash
npm run type-check
```

### 5. 启动后端服务

后端复用现有 `customer-server`（端口 8089），无需重新搭建：

```bash
# 在 IntelliJ IDEA 中启动 customer-server 主类
# 默认端口 8089，数据库 car_rental_customer，Redis localhost:6379
```

后台管理服务（端口 8088）用于车辆图片资源，如有也需要启动。

---

## 四、核心配置

### 4.1 环境变量（`.env`）

```env
# 客户端业务 API 基址（H5 端留空走 vite proxy；小程序端必须填完整域名）
VITE_API_BASE=http://localhost:8089
# 客户端静态资源基址（轮播图/品牌横幅/头像/评价图片/实名认证图片）
VITE_CLIENT_UPLOAD_BASE=http://localhost:8089
# 后台管理服务静态资源基址（车辆封面/相册等管理员上传资源）
VITE_ADMIN_UPLOAD_BASE=http://localhost:8088
```

- **H5 端**：以上变量在 `.env.development` 中被覆盖为空字符串，由 `vite.config.ts` 的 `server.proxy` 转发
- **小程序 / App 端**：必须填完整域名（小程序还需在微信公众后台配置合法域名）
- **⚠️ 生产构建坑**：`.env.production` 若为占位假域名（如 `https://admin.example.com`），`build:mp-weixin` 产物中图片会全部请求假域名而裂图、接口静默失败，务必替换为真实可访问地址

### 4.2 `pages.json` 全局样式（关键片段）

```json
{
  "easycom": {
    "autoscan": true,
    "custom": {
      "^u--(.*)": "uview-plus/components/u-$1/u-$1.vue",
      "^up-(.*)": "uview-plus/components/u-$1/u-$1.vue",
      "^u-([^-].*)": "uview-plus/components/u-$1/u-$1.vue"
    }
  },
  "globalStyle": {
    "navigationBarTextStyle": "white",
    "navigationBarTitleText": "大圣玩车",
    "navigationBarBackgroundColor": "#0A0A0A",
    "backgroundColor": "#0A0A0A",
    "backgroundTextStyle": "light"
  }
}
```

- `easycom` 配置 uview-plus 组件自动导入（无需手动 `import`）
- 16 个页面全部注册，路径如 `pages/home/index`、`pages/vehicle/detail` 等
- 首页 `navigationStyle: "custom"` 实现沉浸式轮播 Hero
- 不使用内置 `tabBar`：因为 mp-weixin 端内置 tabBar 必须提供 PNG 图标，改用自定义 `TabBar` 组件 + `uni.reLaunch` 跳转，在 4 个主页面（home/vehicle/list/cart/profile）底部引入 `<TabBar active="pages/xxx" />`

### 4.3 `manifest.json` 关键片段

```json
{
  "name": "大圣玩车",
  "appid": "__UNI__CUSTOMER_APP",
  "versionName": "1.0.0",
  "vueVersion": "3",
  "mp-weixin": {
    "appid": "",                 // 部署时填实际小程序 appid
    "setting": {
      "urlCheck": true,         // 校验合法域名（生产时必开）
      "es6": true,
      "postcss": true,
      "minified": true
    },
    "usingComponents": true,
    "lazyCodeLoading": "requiredComponents"
  },
  "h5": {
    "title": "大圣玩车 · LUXURY CAR",
    "router": { "mode": "history", "base": "./" },
    "devServer": { "port": 5173, "https": false }
  },
  "networkTimeout": {
    "request": 15000,
    "uploadFile": 60000,
    "downloadFile": 60000
  }
}
```

### 4.4 Vite 配置（`vite.config.ts`）

仅 H5 端使用 proxy；小程序端在 `request.ts` 中拼接绝对 URL：

```ts
server: {
  proxy: {
    '/api':           { target: 'http://localhost:8089', changeOrigin: true },
    '/uploads':       { target: 'http://localhost:8089', changeOrigin: true },
    '/admin-uploads': {
      target: 'http://localhost:8088',
      changeOrigin: true,
      rewrite: (p) => p.replace(/^\/admin-uploads/, '/uploads')
    }
  }
}
```

---

## 五、核心文件示例

### 5.1 `src/api/request.ts`（关键能力概览）

完整复刻原 Web `axios` 封装的全部能力：

| 能力 | 实现要点 |
| --- | --- |
| token 自动携带 | `Authorization: Bearer ${token}` 头自动注入 |
| GET 请求去重 | `pendingMap` key = `method&url&JSON.stringify(params)`；`noDedup` 跳过 |
| 401 无感刷新 | `isRefreshing` + `pendingQueue` 挂起重试；`doRefreshToken` 调 `/api/auth/refresh-token` |
| 403 权限处理 | `showCountdownRedirect` 3 秒倒计时跳登录页 |
| 业务错误统一拦截 | `code !== 200 && code !== 0` 时 `uni.showToast` 提示；`skipBusinessError` 跳过 |
| 文件上传 | `uni.uploadFile` + `onProgressUpdate` 实时进度回调 |
| 倒计时跳登录 | `uni.reLaunch` 整页刷新（绕过 Pinia 内存态） |

便捷方法：`get / post / put / del / upload`（均支持泛型 `<T>`）。

### 5.2 Store 示例（`cart.ts` 核心字段）

```ts
export const useCartStore = defineStore('cart', () => {
  const items = ref<CartItem[]>([])              // 购物车项
  const selectedIds = ref<number[]>([])          // 选中项
  const priceDetails = ref<PriceDetailVO[]>([]) // 后端价格明细
  const priceLoading = ref(false)

  const totalCount = computed(() => items.value.length)
  const totalAmount = computed(() => priceDetails.value.reduce((s, p) => s + Number(p.rentAmount), 0))
  const grandTotal = computed(() => priceDetails.value.reduce((s, p) => s + Number(p.totalAmount), 0))

  async function refreshPrices() { /* 调 calcCartPriceApi */ }
  async function initCart() { /* 合并本地+远程；不自动全选，仅保留已手动选中项 */ }
  async function checkRemoteSync() { /* 拉远程列表与本地摘要比对，不一致触发 initCart（跨端同步） */ }
  async function addItem(car, startDate, endDate, days) { /* addCartApi + initCart（新项不自动选中） */ }
  // ... toggleSelect / removeItem / updateItem / clearSelected / clear / isInCart / getPriceDetail
}, {
  persist: {                                    // 只持久化 items/selectedIds
    key: 'lux_customer_cart',
    storage: {
      getItem: (k) => uni.getStorageSync(k),
      setItem: (k, v) => uni.setStorageSync(k, v)
    },
    paths: ['items', 'selectedIds']             // 价格明细不持久化，每次实时计算
  } as any
})
```

### 5.3 通用组件示例（`CarCard`）

```vue
<script setup lang="ts">
import { computed } from 'vue'
import { resolveAdminImage } from '@/utils/image'
import { moneyUtil } from '@/utils'
import type { CarVO } from '@/api/types'

export interface CarCardProps {
  car: CarVO
}
const props = defineProps<CarCardProps>()
const emit = defineEmits<{ (e: 'rent', car: CarVO): void }>()

const hasCouponPrice = computed(() => { /* 券后价有效判断 */ })
const rentBtnText = computed(() => {
  if (props.car.status === 'rented') return '已租出'
  if (props.car.status === 'maintenance') return '维修中'
  return '立即租车'
})

function goDetail() {
  uni.navigateTo({ url: `/pages/vehicle/detail?id=${props.car.id}` })
}
function onRentTap() { emit('rent', props.car) }
</script>

<template>
  <view class="car-card" @tap="goDetail">
    <image :src="resolveAdminImage(car.cover)" lazy-load mode="aspectFill" />
    <view class="info">
      <text class="name">{{ car.name }}</text>
      <text class="price">¥{{ moneyUtil.format(car.dailyPrice) }}/日</text>
    </view>
    <u-button size="mini" type="error" @tap.stop="onRentTap">{{ rentBtnText }}</u-button>
  </view>
</template>
```

### 5.4 页面示例（首页 onLoad）

```ts
onLoad(async () => {
  statusBarHeight.value = uni.getSystemInfoSync().statusBarHeight || 0
  await loadAll()
})

async function loadAll() {
  loading.value = true
  const tasks: Promise<any>[] = [
    getActiveCarouselApi().then(r => carouselList.value = r),
    getHotCarsApi().then(r => hotCars.value = r),
    getAdvantagesApi().then(r => advantages.value = r),
    getReviewsApi().then(r => reviews.value = r),
    getAvailableCouponsApi().then(r => coupons.value = r),
    loadConfig(),
    getDictByTypeApi('vehicle_type').then(r => vehicleTypes.value = r)
  ]
  if (userStore.isLoggedIn) {
    tasks.push(getMyActiveOrdersApi(6).then(r => myActiveOrders.value = r))
    tasks.push(getClaimedCouponIdsApi().then(r => claimedCouponIds.value = r))
  }
  await Promise.all(tasks.map(p => p.catch(e => { if (!e?.__canceled) console.error(e) })))
  loading.value = false
}
```

---

## 六、重要 TS 类型定义

全部定义在 [src/api/types.ts](file:///c:/Users/ZhuanZ/Desktop/record/project/react/customer/customer-client-app/src/api/types.ts)，摘要：

### 核心 VO 类型

```ts
// 通用分页
export interface PageResult<T> { list: T[]; total: number; page: number; pageSize: number }

// 用户
export interface MemberInfoVO { id?: number; username?: string; nickname?: string; phone?: string; ... }

// 车辆
export interface CarVO { id: number; name: string; dailyPrice: number | string; status?: 'available' | 'rented' | 'maintenance'; minRentDays?: number; ... }
export interface CarDetailVO extends CarVO { imageList?: string[]; configList?: CarConfigVO[]; }
export interface CarImageGroupVO { category: string; images: string[] }

// 优惠券
export type CouponType = 'discount' | 'deduction' | 'duration' | 'reduction'
export interface CouponVO { id: number; couponType?: CouponType; couponValue?: number; minAmount?: number | null; discountCap?: number | null; stackable?: 0 | 1; totalCount?: number; receivedCount?: number; remainCount?: number; validStartTime?: string; validEndTime?: string; ... }
export interface MemberCouponVO extends CouponVO { status?: 'unused' | 'locked' | 'used' | 'expired' }

// 订单
export type OrderStatus = 'pending' | 'renting' | 'completed' | 'cancelled'
export interface OrderVO { id: number; status: OrderStatus; reviewStatus?: 'unreviewed' | 'reviewed' | 're-reviewed'; carId?: number; startDate?: string; endDate?: string; rentAmount?: number; totalAmount?: number; couponUserIds?: number[]; ... }

// 价格（核心，对齐后端 PriceService）
export interface PriceDetailVO {
  carId: number
  normalDays: number; holidayDays: number; holidaySurcharge: number; holidaySurchargeAmount: number
  subtotal: number; durationTierName?: string; durationFactor: number; discountAmount: number
  rentAmount: number; totalAmount: number
}

// 评价
export interface ReviewVO { id: number; orderId: number; round?: 1 | 2; rating: number; content?: string; images?: string; ... }
export interface CanReviewResult { canReviewRound: 1 | 2 | null }

// 系统
export interface SystemConfigVO { siteName?: string; hotline?: string; email?: string; address?: string; ... }
export interface StoreVO { id: number; name?: string; address?: string; phone?: string; cityId?: number; ... }
export interface CityVO { id: number; name?: string; cityName?: string }
export interface DictDataVO { dictType?: string; dictLabel: string; dictValue: string }
```

### 关键入参类型

```ts
export interface LoginPayload { username: string; password: string }
export interface LoginResultVO { token: string; refreshToken: string; user: MemberInfoVO }
export interface AddCartPayload { carId: number; startDate?: string; endDate?: string; days?: number }
export interface CalcCarPricePayload { carId: number; startDate: string; endDate: string }
export interface CalcCartPricePayload { items: Array<{ carId: number; startDate: string; endDate: string }> }
export interface CreateOrderPayload {
  items: Array<{ carId: number; startDate?: string; endDate?: string; days?: number }>
  cityId?: number; store?: string; name?: string; phone?: string; couponUserIds?: number[]
}
export interface SubmitReviewPayload { orderId: number | string; round?: 1 | 2; rating: number; content: string; images?: string }
export interface SubmitFeedbackPayload { type: 'appointment' | 'feedback'; name?: string; phone?: string; content?: string; ... }
```

### 优惠券计算辅助类型（`utils/index.ts`）

```ts
export interface CouponForCalc {
  type: 'discount' | 'deduction' | 'duration' | 'reduction'
  value: number                  // 折扣 0.88 / 满减金额 / 时长天数
  minAmount?: number | null
  discountCap?: number | null    // 折扣券封顶优惠金额
  stackable?: 0 | 1 | null
}
```

> **moneyUtil 优惠券计算公式（与后端 CouponService.doCalculate 严格对齐）：**
> - `discount`：`discount = +(amount * (1 - value)).toFixed(2)`，再校验 `discountCap` 封顶
> - `deduction` / `reduction`：`discount = value`（直接减）
> - `duration`：`discount = 0`（时长券不抵扣金额，由订单层处理加天数）
> - 最终 `Math.min(discount, amount)`，批量 `Math.min(Σ, amount)`

---

## 七、关键设计与机制

### 1. 双后端服务架构

| URL 前缀 | H5 端处理 | 小程序 / App 端处理 |
| --- | --- | --- |
| `/api` | Vite proxy → 8089 | 拼接 `VITE_API_BASE` 绝对 URL |
| `/uploads` | Vite proxy → 8089 | 拼接 `VITE_CLIENT_UPLOAD_BASE` |
| `/admin-uploads` | Vite proxy → 8088 + rewrite 回 `/uploads` | 拼接 `VITE_ADMIN_UPLOAD_BASE` + 替换为 `/uploads/` |

`src/utils/image.ts` 中 `resolveAdminImage` / `resolveClientImage` 通过 `#ifdef H5 / #ifndef H5` 条件编译实现多端差异化。

### 2. 401 无感刷新链路

```
响应 401 → isRefreshing?
  否 → doRefreshToken(refreshToken) → 成功：retryPendingQueue + 重试原请求；失败：showCountdownRedirect
  是 → 挂入 pendingQueue，等刷新完成后用新 token 重试
刷新失败 → 3 秒倒计时弹窗 → uni.reLaunch('/pages/auth/login?redirect=...')
```

`isRefreshing / pendingQueue / isRedirecting` 三态保证：不重复刷新、不重复弹窗。

### 3. GET 请求去重

`pendingMap` 以 `method&url&JSON.stringify(params)` 为 key，相同 GET 请求未完成时静默 `reject({ __canceled: true })`；可由 `noDedup: true` 跳过（购物车 list/count 接口用此特性保证实时性）。

### 4. 价格一致性

所有价格计算（单辆车、购物车批量）统一走后端 `PriceService`，前端 `moneyUtil.calcCouponDiscount` 系列与后端 `CouponService.doCalculate` / `calculateDiscountForOrderBatch` 对齐，确保选车 → 购物车 → 结算 → 下单全流程价格一致。

### 5. 优惠券生命周期

```
available → receive → unused → lock（下单预占）→ verify（核销，幂等）
                                ↓
                          cancel-lock（回退到 unused）
```

批量叠加需调用方校验所有券 `stackable=1`（时长券不参与叠加）。结算页 `pickBestCoupon` 自动预选最优券。

### 6. Pinia persist 多端适配

| store | 持久化策略 | uni.storage 适配 |
| --- | --- | --- |
| `app` | 只持久化 `theme` | `getItem: uni.getStorageSync / setItem: uni.setStorageSync` |
| `cart` | 全量持久化 | 同上 |
| `filter` | 持久化（原 Web 用 sessionStorage，uni 端等价于"应用退出即清"，由 App.onLaunch 主动 reset） | 同上 |
| `user` | 不配 persist | 登录态由 `auth.ts` 管理 uni.storage |

### 7. 路由鉴权（无 vue-router 守卫）

`src/router/interceptor.ts` 包装 `uni.navigateTo / redirectTo / reLaunch / switchTab`，在调用前执行 `beforeNavigate`：

1. 解析 path → 查 `ROUTE_TABLE` 获取 `meta`
2. `meta.requiresAuth && !userStore.isLoggedIn` → `uni.redirectTo('/pages/auth/login?redirect=...')`
3. `meta.guest && userStore.isLoggedIn` → 重定向首页
4. 通过 → 调原始方法 + `setPageTitle`

业务侧用 `import { router } from '@/router/interceptor'` 调用 `router.push / replace / reLaunch / switchTab / back`。

### 8. 图片预览

`appStore.openImagePreview(list, index)` 内部直接调 `uni.previewImage`（小程序原生组件，跨端通用）。

### 9. 资源清理

所有定时器（轮播 RAF、支付倒计时、验证码倒计时）均在 `onUnload` / `onHide` 清理，避免内存泄漏。

### 10. 加载态与空态闭环

- 加载中：`PageSkeleton`（grid / detail / list 三种模式，shimmer 动画）
- 加载后无数据：`EmptyTips`（可带操作按钮）

### 11. 购物车跨端实时同步

与 Web 端（`customer-client`）共用后端，同账号登录时购物车实时互相同步（增删 / 改租期 / 清空）：

- 购物车页 `onShow` 启动每 5 秒轮询 `cartStore.checkRemoteSync()`：拉取远程列表与本地做摘要比对（`carId|车名|价格|起止日期|天数` 排序拼接），不一致才触发 `initCart()` 全量刷新
- `onHide` / `onUnload` 停止轮询，避免后台空耗请求
- 配合 Web 端的同机制轮询，实现双端互相实时刷新

### 12. 购物车商品手动勾选

- 商品默认**不自动勾选**，需用户手动勾选（或「全选」）后才可去结算
- `initCart` 仅保留用户已手动选中且仍存在的项；新加入 / 跨端同步进来的商品均不自动选中，选中状态不会跨端残留

### 13. 购物车改期弹层

- 点击商品日期区域弹出底部弹层（取/还车日 picker + 快捷天数），选完立即生效并重算价格
- 已租出 / 整备期区间在弹层内直观展示并禁用，保存前再做区间冲突校验（后端二次兜底）

---

## 八、API 接口清单（13 个模块）

详细签名见 [src/api/modules/](file:///c:/Users/ZhuanZ/Desktop/record/project/react/customer/customer-client-app/src/api/modules/) 各文件。完整 URL 列表见原 [基础文档.md](file:///c:/Users/ZhuanZ/Desktop/record/project/react/customer/customer-client-app/基础文档.md) 第六章。

| 模块 | 函数数 | 主要 URL |
| --- | --- | --- |
| announcement | 3 | `/api/announcement/top`、`/page`、`/{id}` |
| auth | 7 | `/api/auth/login`、`/register`、`/user-info`、`/logout`、`/sms-code`、`/forgot-password`、`/refresh-token` |
| car | 5 | `/api/car/list`、`/detail/{id}`、`/hot`、`/{id}/images`、`/recommend/{id}` |
| carousel | 1 | `/api/carousel/active` |
| cart | 6 | `/api/cart/list`、`/count`、`/add`、`/update/{id}`、`/{id}`、`/clear` |
| complaint | 4 | `/api/complaint/submit`、`/mine`、`/{id}`、`/{id}/rate` |
| coupon | 10 | `/api/coupon/available`、`/{id}`、`/mine`、`/usable`、`/receive/{id}`、`/lock`、`/cancel-lock`、`/verify`、`/calculate`、`/claimed-ids` |
| feedback | 4 | `/api/feedback/submit`、`/appointments`、`/appointments/{id}/cancel`、`/appointments/{id}/contact` |
| order | 8 | `/api/order/create`、`/list`、`/detail/{id}`、`/cancel/{id}`、`/pay/{id}`、`/complete/{id}`、`/active`、`/reviewable` |
| price | 2 | `/api/price/car`、`/api/price/cart` |
| review | 3 | `/api/review/submit`、`/order/{orderId}`、`/can-review/{orderId}` |
| system | 6 | `/api/system/config`、`/stores`、`/cities`、`/advantages`、`/reviews`、`/dict/{dictType}` |
| user | 7 | `/api/user/profile`、`/avatar`、`/password`、`/favorites`、`/favorite`、`/upload` |

---

## 九、微信小程序端配置

### 9.1 后台域名白名单清单

部署到微信小程序前，需在 [微信公众平台](https://mp.weixin.qq.com/) → 开发管理 → 开发设置 → 服务器域名 中配置以下域名：

**request 合法域名**（不超 200 个，必须 HTTPS）：

| 域名 | 用途 | 对应环境变量 |
| --- | --- | --- |
| `https://api.example.com` | 客户端业务 API + 客户端静态资源（8089） | `VITE_API_BASE` / `VITE_CLIENT_UPLOAD_BASE` |
| `https://admin.example.com` | 后台管理服务静态资源（8088，车辆封面/相册） | `VITE_ADMIN_UPLOAD_BASE` |

**uploadFile 合法域名**：与 request 相同（`https://api.example.com`，用于头像/评价图片/实名认证图片上传）

**downloadFile 合法域名**：与 request 相同（如使用了 `uni.downloadFile`）

> 注：开发期可在微信开发者工具勾选「不校验合法域名」临时绕过；上线前必须配置真实 HTTPS 域名。

### 9.2 小程序 appid 配置

在 [src/manifest.json](file:///c:/Users/ZhuanZ/Desktop/record/project/react/customer/customer-client-app/src/manifest.json) 的 `mp-weixin.appid` 字段填入实际 appid：

```json
"mp-weixin": {
  "appid": "wx0123456789abcdef",
  ...
}
```

### 9.3 小程序特性

- **分包**：未启用（当前主包大小可在 build 后查看；如超过 2MB 需分包）
- **lazyCodeLoading**: `requiredComponents` 已开启，按需注入组件代码
- **urlCheck**: 生产环境必开（校验合法域名）
- **es6 / postcss / minified**: 全部开启

### 9.4 跨端注意事项

| 端 | 注意事项 |
| --- | --- |
| mp-weixin | 必须 HTTPS 域名 + 白名单；不能用 `window/document`；`uni.previewImage` 支持原生预览 |
| mp-alipay | 同 mp-weixin；样式 `rpx` 单位兼容；`u-popup` 等组件已适配 |
| H5 | 走 `vite.config.ts` proxy 转发跨域；`history` 模式需 Nginx 配置 try_files |
| App | 需 HBuilderX 云打包或本地打包；权限已在 manifest 配置（INTERNET / ACCESS_NETWORK_STATE / ACCESS_WIFI_STATE） |

---

## 十、开发注意事项

### 10.1 强制约束（来自迁移文档）

- ✅ 全部 `<script setup lang="ts">`，完整 TS 类型定义
- ✅ 使用 uview-plus 组件库，**严禁使用 Element Plus**
- ✅ 状态管理 Pinia + pinia-plugin-persistedstate，4 个 store 与原 Web 对齐
- ✅ request.ts 复刻原 axios 全部逻辑
- ✅ API 层完整复刻 12 个模块，后端接口地址 / 请求方式 / payload 不变
- ✅ Composable：useScrollReveal（uni.createIntersectionObserver）+ useSystemConfig
- ✅ 16 个页面在 pages.json 注册
- ✅ 通用组件全部改造为 uni-app 自定义组件
- ✅ utils 工具集完整迁移 + uni-app 适配
- ✅ 业务逻辑 1:1 对齐原 Web

### 10.2 与原 Web 的关键差异

| 方面 | 原 Web | 迁移后 uni-app |
| --- | --- | --- |
| 路由 | Vue Router 4 + createWebHistory | uni 原生路由 + 自定义 interceptor 包装 |
| 拦截器 | Vue Router beforeEach | 包装 `uni.navigateTo / redirectTo / reLaunch / switchTab` |
| 滚动渐显 | IntersectionObserver | H5 用 IntersectionObserver，小程序用 `uni.createIntersectionObserver` |
| 系统配置缓存 | sessionStorage | uni.storage（应用退出清空由 App.onLaunch 主动 reset） |
| token 存储 | localStorage | uni.storage（跨端同步 API） |
| 图片预览 | el-image-viewer 单例 | `uni.previewImage`（appStore.openImagePreview 内部直接调用） |
| 弹窗确认 | ElMessageBox.confirm | `uni.showModal` |
| Toast 提示 | ElMessage | `uni.showToast` |
| 顶部导航 | AppHeader 毛玻璃 | 原生导航栏 + 首页 navigationStyle:custom |
| 底部导航 | 无 | 自定义 TabBar 组件 + `uni.reLaunch` 跳转（不用内置 tabBar，因为 mp-weixin 需 PNG 图标） |
| 日期选择器 | el-date-picker type=daterange | 两个独立 `<picker mode="date">` |
| 文件上传 | FormData + axios onUploadProgress | `uni.chooseImage` + `uni.uploadFile` + onProgressUpdate |
| 表单校验 | Element Plus form rules | u-form / u-form-item + 自定义校验函数 |
| 图片懒加载 | IntersectionObserver + data-src | `image` 组件 `lazy-load` 属性 |
| 复制到剪贴板 | navigator.clipboard / execCommand | `uni.setClipboardData` |
| 滚动到顶部 | window.scrollTo | `uni.pageScrollTo` |

### 10.3 全局样式约定

在 [src/App.vue](file:///c:/Users/ZhuanZ/Desktop/record/project/react/customer/customer-client-app/src/App.vue) 已定义的全局类名（业务组件直接复用）：

- `.container` - 页面容器（min-height 100vh + padding 24rpx）
- `.card` - 暗色卡片（#1a1a1a 背景 + 16rpx 圆角 + 24rpx padding）
- `.text-primary` - 法拉利红（#ff2e2e）
- `.text-price` - 价格色（#ff5a3c）
- `.bg-primary` - 红色背景
- `.fade-in-up` + `.visible` - 滚动渐显动画
- `.skeleton` - 骨架屏 shimmer 动画
- `page.light` 选择器 - 亮色主题覆盖

### 10.4 反馈提示（用户偏好）

所有 API 调用成功 / 失败均通过 `uni.showToast` 弹出反馈（已在 request.ts 业务错误拦截、各页面 success 回调中实现）。

### 10.5 主题切换

- 默认暗色（Ferrari 风格）
- 切换：`appStore.toggleTheme()` 或 `appStore.setPreference('light' | 'dark' | 'auto')`
- 持久化：仅持久化 `themePreference`，弹窗 / 预览状态不持久化
- 应用机制：
  - 页面根元素绑定 `useThemeClass().themeClass`，浅色时加 `.theme-light` 覆盖 CSS 变量
  - `useThemeClass` 内部在页面 `onLoad/onShow` 及主题变化时同步当前页窗口背景与下拉刷新指示点颜色（修复跳转/加载时露出黑底）
  - `useNavigationBar` 在 `onShow/onReady` 及主题变化时调 `uni.setNavigationBarColor` 同步原生导航栏（注意：不可在 `onLoad` 阶段调用，否则自定义导航页会报 `fail: page not found`）
- 弹层（u-picker / u-popup / u-modal）在 `App.vue` 通过 `.theme-light` 覆盖为浅色样式

### 10.6 已知限制

- mp-weixin 内置 `tabBar` 必须提供 PNG 图标，本项目改用自定义 `TabBar` 组件规避；如需切换为内置 tabBar，需准备 4 个 PNG 图标放到 `static/tabbar/` 并在 `pages.json` 添加 `tabBar` 配置
- 小程序端不支持 SVG data URI 在 image src 中，`imageUtil.placeholder` 在小程序端返回空字符串
- `useScrollReveal` 在小程序端因为无法直接操作 DOM class，业务组件需通过响应式数据控制渐显状态（H5 端正常工作）
- App 端打包需 HBuilderX，本仓库仅生成可编译代码
- 自定义 `TabBar` z-index 为 999；底部弹层（如购物车改期弹层）需注意层级：弹层打开时应隐藏 TabBar，且 u-popup z-index 保持 998，避免遮挡 picker 原生日历弹窗

---

## 十一、构建产物路径

| 端 | 开发产物 | 生产产物 |
| --- | --- | --- |
| H5 | `dist/dev/h5` | `dist/build/h5` |
| mp-weixin | `dist/dev/mp-weixin` | `dist/build/mp-weixin` |
| mp-alipay | `dist/dev/mp-alipay` | `dist/build/mp-alipay` |
| App | `dist/dev/app` | `dist/build/app` |

mp-weixin 用微信开发者工具打开对应目录预览 / 调试 / 上传。

---

## 十二、与后端 `customer-server` 对接

| 后端服务 | 端口 | 数据库 | 用途 |
| --- | --- | --- | --- |
| `customer-server` | 8089 | `car_rental_customer` | 业务 API + 客户端静态资源（uploads） |
| 后台管理服务（如有） | 8088 | `car_rental` | 车辆管理员上传资源（admin-uploads） |

后端 `application.yml` 关键配置（已读取，迁移无需修改）：

```yaml
server:
  port: 8089
spring:
  datasource:
    url: jdbc:mysql://localhost:3306/car_rental_customer?...
  data:
    redis: { host: localhost, port: 6379 }
  servlet:
    multipart: { max-file-size: 50MB, max-request-size: 100MB }
jwt:
  secret: luxury-car-customer-jwt-secret-key-2024-very-long-secret
  expiration: 7200000              # access 2h
  refresh-expiration: 604800000     # refresh 7d
upload:
  access-path: /uploads/**
  base-url: http://192.168.5.185:8089
```

JWT token 2 小时过期，refresh token 7 天过期，与 `request.ts` 的 401 无感刷新逻辑对齐。

---

## 十三、后续可扩展点

- 增加 mp-weixin 分包（如主包超 2MB）
- 接入微信支付（替换当前模拟支付 `payOrderApi`）
- 接入微信登录（`uni.login` + `code` 换 token）
- 接入地图 SDK（门店定位 / 取车导航）
- 接入推送（订单状态变更通知）
- 国际化（vue-i18n 已安装，按需配置语言包）

---

> 文档更新时间：2026-09-08
> 项目版本：v1.0.0
> 技术栈：uni-app + Vue 3.4 + Vite 5 + uview-plus 3 + Pinia 2 + TypeScript 5
