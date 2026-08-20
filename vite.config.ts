import { defineConfig } from 'vite'
import uni from '@dcloudio/vite-plugin-uni'
import path from 'node:path'

// uni-app Vite 配置
// 说明：
// - 原生 uni-app 不通过 Vite proxy 处理跨域，多端跨域由各端自行处理：
//   · H5 端：开发期通过 devServer.server.proxy 转发到后端
//   · 小程序端：需在微信公众后台配置 request 合法域名（详见 README）
// - 图片代理前缀（/uploads、/admin-uploads）在小程序端通过环境变量拼绝对 URL 处理
export default defineConfig({
  plugins: [uni()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src')
    }
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
    proxy: {
      // 客户端业务接口
      '/api': {
        target: 'http://localhost:8089',
        changeOrigin: true
      },
      // 客户端静态资源（轮播图/品牌横幅/头像/评价图片/实名认证图片）
      '/uploads': {
        target: 'http://localhost:8089',
        changeOrigin: true
      },
      // 后台管理服务静态资源（车辆封面/相册等管理员上传资源）
      '/admin-uploads': {
        target: 'http://localhost:8088',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/admin-uploads/, '/uploads')
      }
    }
  },
  css: {
    preprocessorOptions: {
      scss: {
        // 使用 Sass 现代编译器 API（消除 legacy-js-api 弃用警告，需 sass >= 1.70）
        api: 'modern-compiler',
        // 忽略 node_modules（uview-plus 等依赖）内部产生的弃用警告
        quietDeps: true,
        // 静默 @import 弃用警告：
        // uni.scss 中的 @import 'uview-plus/theme.scss' 会被注入到所有组件样式中，
        // 每次编译都触发一次警告。不能改用 @use（命名空间语义会破坏 uview-plus 对
        // 全局 mixin 如 @include flex 的依赖），故显式静默该弃用提示。
        // 注意：不能包含已移除的 mixed-decls（sass 1.102 起为过时 ID，静默会报新警告）。
        silenceDeprecations: ['legacy-js-api', 'import', 'global-builtin', 'color-functions']
      }
    }
  },
  build: {
    target: 'es2018',
    cssCodeSplit: true,
    sourcemap: false,
    chunkSizeWarningLimit: 1500
  }
})
