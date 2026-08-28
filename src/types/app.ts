/**
 * 应用级类型定义
 */

/** 主题偏好（用户设置项）：auto = 跟随系统 */
export type ThemePreference = 'dark' | 'light' | 'auto'

/** 实际生效主题（auto 偏好解析后的结果） */
export type Theme = 'dark' | 'light'
