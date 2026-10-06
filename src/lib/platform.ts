import { Capacitor } from '@capacitor/core'

/** true khi chạy trong app iOS/Android (Capacitor), false trên trình duyệt. */
export const isNative = () => Capacitor.isNativePlatform()
export const platform = () => Capacitor.getPlatform() as 'ios' | 'android' | 'web'
