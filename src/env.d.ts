/**
 * uni-app + Vite + TypeScript 类型声明
 */

/// <reference types="@dcloudio/types" />
/// <reference types="vite/client" />

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<Record<string, never>, Record<string, never>, any>
  export default component
}

declare module 'uview-plus'
declare module 'uview-plus/*'

interface ImportMetaEnv {
  readonly VITE_API_BASE: string
  readonly VITE_CLIENT_UPLOAD_BASE: string
  readonly VITE_ADMIN_UPLOAD_BASE: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
