import { createSSRApp } from 'vue'
import { createPinia } from 'pinia'
import piniaPluginPersistedstate from 'pinia-plugin-persistedstate'
import uviewPlus from 'uview-plus'

import App from './App.vue'
import { setupRouteInterceptor } from './router/interceptor'

// uview-plus 全局样式由 App.vue 顶部 @import 'uview-plus/index.scss' 注入，这里无需再单独 import

export function createApp() {
  const app = createSSRApp(App)
  const pinia = createPinia()
  pinia.use(piniaPluginPersistedstate)

  app.use(pinia)
  app.use(uviewPlus)

  // 注册全局路由拦截器（鉴权 + guest 重定向 + 标题）
  setupRouteInterceptor()

  return { app }
}
