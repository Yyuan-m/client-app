/**
 * cart store - 购物车状态（核心，与后端 PriceService 对齐）
 *
 * 设计：登录时同步数据库，未登录时用 uni.storage；价格计算统一走后端 /api/price/cart
 */
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { getCartListApi, addCartApi, updateCartApi, removeCartApi, clearCartApi } from '@/api/modules/cart'
import { calcCartPriceApi } from '@/api/modules/price'
import type { CartVO, CarVO, PriceDetailVO } from '@/api/types'

/** 前端购物车项结构（与原 Web mapFromApi 后的结构对齐） */
export interface CartItem {
  /** 数据库 cart id（未登录时可能为空） */
  id?: number
  carId: number
  carName: string
  cover: string
  dailyPrice: number
  tags: string[]
  startDate: string
  endDate: string
  days: number
}

export const useCartStore = defineStore(
  'cart',
  () => {
    /** 购物车项 */
    const items = ref<CartItem[]>([])
    /** 选中的车辆 ID 集合 */
    const selectedIds = ref<number[]>([])
    /** 后端返回的价格明细（对齐 PriceDetailVO） */
    const priceDetails = ref<PriceDetailVO[]>([])
    /** 价格加载中标记 */
    const priceLoading = ref(false)

    /** 总数 */
    const totalCount = computed(() => items.value.length)
    /** 选中的项 */
    const selectedItems = computed(() => items.value.filter((i) => selectedIds.value.includes(i.carId)))
    /** 选中数 */
    const selectedCount = computed(() => selectedIds.value.length)
    /** 是否全选 */
    const isAllSelected = computed(() => items.value.length > 0 && selectedIds.value.length === items.value.length)
    /** 租金合计（Σ priceDetails.rentAmount） */
    const totalAmount = computed(() =>
      priceDetails.value.reduce((sum, p) => sum + Number(p.rentAmount || 0), 0)
    )
    /** 应付合计（Σ priceDetails.totalAmount，未扣优惠券） */
    const grandTotal = computed(() =>
      priceDetails.value.reduce((sum, p) => sum + Number(p.totalAmount || 0), 0)
    )

    /** 勾选 / 取消勾选 */
    function toggleSelect(carId: number) {
      const idx = selectedIds.value.indexOf(carId)
      if (idx >= 0) selectedIds.value.splice(idx, 1)
      else selectedIds.value.push(carId)
    }

    /** 全选 / 取消全选 */
    function toggleSelectAll() {
      if (isAllSelected.value) {
        selectedIds.value.splice(0, selectedIds.value.length)
      } else {
        selectedIds.value = items.value.map((i) => i.carId)
      }
    }

    /** 是否选中 */
    function isSelected(carId: number): boolean {
      return selectedIds.value.includes(carId)
    }

    /** 后端 Cart → 前端 item 字段映射 */
    function mapFromApi(cart: CartVO): CartItem {
      return {
        id: cart.id,
        carId: cart.carId,
        carName: cart.carName || '',
        cover: cart.carCover || '',
        dailyPrice: Number(cart.dailyPrice || 0),
        tags: Array.isArray(cart.tagList) ? cart.tagList : [],
        startDate: cart.startDate || '',
        endDate: cart.endDate || '',
        days: cart.days || 0
      }
    }

    /** 拉取选中项价格，失败清空明细 */
    async function refreshPrices() {
      if (selectedItems.value.length === 0) {
        priceDetails.value = []
        return
      }
      priceLoading.value = true
      try {
        const reqItems = selectedItems.value.map((i) => ({
          carId: i.carId,
          startDate: i.startDate,
          endDate: i.endDate
        }))
        priceDetails.value = await calcCartPriceApi({ items: reqItems })
      } catch (e) {
        console.error('[cart.refreshPrices] failed:', e)
        priceDetails.value = []
      } finally {
        priceLoading.value = false
      }
    }

    /** 登录后初始化：合并后端 + 本地独有数据，新加载项默认全选，初始化后立即拉价格 */
    async function initCart() {
      try {
        const list = await getCartListApi()
        const remoteItems = list.map(mapFromApi)
        // 合并：以远程为主，仅追加从未同步过后端的纯本地项（无 id）；
        // 曾同步过的项若已不在远程列表（其他端已删除），必须丢弃，保证与后端一致
        const remoteCarIds = new Set(remoteItems.map((i) => i.carId))
        const localOnly = items.value.filter((i) => !remoteCarIds.has(i.carId) && !i.id)
        const merged = [...remoteItems, ...localOnly]
        items.value = merged
        // 新加载项默认全选
        selectedIds.value = merged.map((i) => i.carId)
        await refreshPrices()
      } catch (e) {
        console.error('[cart.initCart] failed:', e)
      }
    }

    /**
     * 跨端实时同步检测（与 web 端对称）：
     * 拉取远程购物车列表与本地图做摘要比对（覆盖另一端增删/改期/清空），
     * 不一致时调用 initCart 全量同步；一致则无任何写操作，开销极小。
     * 由购物车页轮询调用，实现双端互相实时刷新。
     */
    async function checkRemoteSync() {
      try {
        const list = await getCartListApi()
        const remoteItems = list.map(mapFromApi)
        const sig = (arr: CartItem[]) =>
          arr
            .map((i) => `${i.carId}|${i.carName}|${i.dailyPrice}|${i.startDate}|${i.endDate}|${i.days}`)
            .sort()
            .join(';')
        if (sig(remoteItems) !== sig(items.value)) {
          await initCart()
        }
      } catch (e) {
        // 静默：网络抖动等下轮轮询重试即可
      }
    }

    /** 加入购物车：未登录跳登录页，调 addCartApi 后重新 initCart，新项默认选中并刷新价格 */
    async function addItem(car: CarVO, startDate: string, endDate: string, days: number) {
      const res = await addCartApi({ carId: car.id, startDate, endDate, days })
      // 重新加载购物车（保证数据一致性）
      await initCart()
      // 确保新项被选中
      if (!selectedIds.value.includes(car.id)) {
        selectedIds.value.push(car.id)
      }
      await refreshPrices()
      return res
    }

    /** 移除单项（乐观更新 + 后端同步，失败回滚） */
    async function removeItem(carId: number) {
      const idx = items.value.findIndex((i) => i.carId === carId)
      if (idx < 0) return
      const backup = items.value[idx]
      // 乐观更新
      items.value.splice(idx, 1)
      const sIdx = selectedIds.value.indexOf(carId)
      if (sIdx >= 0) selectedIds.value.splice(sIdx, 1)
      try {
        if (backup.id) {
          await removeCartApi(backup.id)
        }
        await refreshPrices()
      } catch (e) {
        // 失败回滚
        items.value.splice(idx, 0, backup)
        if (sIdx < 0) selectedIds.value.push(carId)
        throw e
      }
    }

    /** 更新购物车项：同步后端 + 租期变化后重新计算价格 */
    async function updateItem(carId: number, startDate: string, endDate: string, days: number) {
      const item = items.value.find((i) => i.carId === carId)
      if (!item) return
      const oldStart = item.startDate
      const oldEnd = item.endDate
      const oldDays = item.days
      item.startDate = startDate
      item.endDate = endDate
      item.days = days
      try {
        if (item.id) {
          await updateCartApi(item.id, { startDate, endDate, days })
        }
        if (isSelected(carId)) {
          await refreshPrices()
        }
      } catch (e) {
        // 失败回滚
        item.startDate = oldStart
        item.endDate = oldEnd
        item.days = oldDays
        throw e
      }
    }

    /** 清空已选中（下单后调用，乐观更新 + 批量同步 + 失败回滚） */
    async function clearSelected() {
      const backup = [...selectedItems.value]
      const backupIds = [...selectedIds.value]
      // 乐观更新
      items.value = items.value.filter((i) => !selectedIds.value.includes(i.carId))
      selectedIds.value = []
      try {
        await Promise.all(backup.map((i) => (i.id ? removeCartApi(i.id) : Promise.resolve())))
        priceDetails.value = []
      } catch (e) {
        // 失败回滚
        items.value.push(...backup)
        selectedIds.value = backupIds
        await refreshPrices()
        throw e
      }
    }

    /** 清空所有 */
    async function clear() {
      try {
        await clearCartApi()
      } catch (e) {
        console.error('[cart.clear] failed:', e)
      }
      items.value.splice(0, items.value.length)
      selectedIds.value.splice(0, selectedIds.value.length)
      priceDetails.value = []
    }

    /** 是否在购物车 */
    function isInCart(carId: number): boolean {
      return items.value.some((i) => i.carId === carId)
    }

    /** 获取某车的价格明细 */
    function getPriceDetail(carId: number): PriceDetailVO | undefined {
      return priceDetails.value.find((p) => p.carId === carId)
    }

    return {
      items,
      selectedIds,
      priceDetails,
      priceLoading,
      totalCount,
      selectedItems,
      selectedCount,
      isAllSelected,
      totalAmount,
      grandTotal,
      toggleSelect,
      toggleSelectAll,
      isSelected,
      mapFromApi,
      refreshPrices,
      initCart,
      checkRemoteSync,
      addItem,
      removeItem,
      updateItem,
      clearSelected,
      clear,
      isInCart,
      getPriceDetail
    }
  },
  {
    // 持久化购物车基础数据（跨会话保留）；价格明细/加载态不持久化，
    // 避免接口异常时展示过期价格、掩盖后端不可达的问题（价格必须每次实时计算）
    persist: {
      key: 'lux_customer_cart',
      storage: {
        getItem: (key: string) => uni.getStorageSync(key),
        setItem: (key: string, value: string) => uni.setStorageSync(key, value)
      },
      paths: ['items', 'selectedIds']
    } as any
  }
)
