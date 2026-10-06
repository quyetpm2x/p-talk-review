/**
 * Hành vi riêng của app iOS/Android (Capacitor). Gọi `initNative()` một lần khi khởi động; web không làm gì.
 * - Thanh trạng thái chữ trắng trên nền navy; Android cho nội dung tràn dưới thanh (safe area CSS đã lo).
 * - Nút Back Android: quay lại trang trước, ở trang chủ thì thoát app.
 * - App vào nền: dừng giọng đọc và micro.
 */
import { App } from '@capacitor/app'
import { SplashScreen } from '@capacitor/splash-screen'
import { StatusBar, Style } from '@capacitor/status-bar'
import { SpeechRecognition } from '@capgo/capacitor-speech-recognition'
import { isNative, platform } from './platform'
import { stopSpeaking } from './speech'

/** Trang chủ của app (HashRouter): '#/' hoặc rỗng. */
export const isHomeHash = (hash: string) => hash === '' || hash === '#' || hash === '#/'

export function initNative() {
  if (!isNative()) return
  StatusBar.setStyle({ style: Style.Dark }).catch(() => {})
  if (platform() === 'android') StatusBar.setOverlaysWebView({ overlay: true }).catch(() => {})

  App.addListener('backButton', ({ canGoBack }) => {
    if (!isHomeHash(location.hash) && canGoBack) window.history.back()
    else App.exitApp()
  })

  App.addListener('appStateChange', ({ isActive }) => {
    if (isActive) return
    stopSpeaking()
    SpeechRecognition.stop().catch(() => {})
  })
}

/** Ẩn splash native ngay khi giao diện web đã vẽ — splash animation trong index.html chạy tiếp, cùng nền navy. */
export function hideNativeSplash() {
  if (!isNative()) return
  requestAnimationFrame(() => SplashScreen.hide({ fadeOutDuration: 150 }).catch(() => {}))
}
