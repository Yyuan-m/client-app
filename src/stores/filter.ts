/**
 * filter store - 筛选条件状态
 * sessionStorage 适配：uni-app 没有 sessionStorage 概念，使用 uni.storage + 自定义标记
 *
 * 由于 uni.storage 没有 sessionStorage 等价物，这里改用持久化 storage（等价于 localStorage）。
 * 业务上原 sessionStorage 的"关闭标签页即清"语义在 uni 端等价于"重启应用即清"，
 * 由调用方在 App.onLaunch 时主动调用 resetFilters 清空（可由产品决定）。
 */
import { defineStore } from 'pinia'
import { reactive } from 'vue'

export interface FilterState {
  /** 关键词 */
  keyword: string
  /** 车型分类（vehicle_type 字典 dictValue，或 'all'） */
  type: string
  /** 城市 */
  city: string
  /** 价格区间 */
  minPrice: number | null
  maxPrice: number | null
  /** 排序：hot / price-asc / price-desc */
  sort: 'hot' | 'price-asc' | 'price-desc'
}

export const useFilterStore = defineStore(
  'filter',
  () => {
    const filters = reactive<FilterState>({
      keyword: '',
      type: 'all',
      city: '',
      minPrice: null,
      maxPrice: null,
      sort: 'hot'
    })

    function setFilter<K extends keyof FilterState>(key: K, value: FilterState[K]) {
      filters[key] = value
    }

    function resetFilters() {
      filters.keyword = ''
      filters.type = 'all'
      filters.city = ''
      filters.minPrice = null
      filters.maxPrice = null
      filters.sort = 'hot'
    }

    return { filters, setFilter, resetFilters }
  },
  {
    // 持久化到 uni storage（原 Web 用 sessionStorage 刷新保留筛选，关闭标签页即清）
    persist: {
      key: 'lux_customer_filter',
      storage: {
        getItem: (key: string) => uni.getStorageSync(key),
        setItem: (key: string, value: string) => uni.setStorageSync(key, value)
      }
    } as any
  }
)
