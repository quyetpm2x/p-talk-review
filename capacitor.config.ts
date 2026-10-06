import type { CapacitorConfig } from '@capacitor/cli'

/**
 * Đóng gói PTalk thành app iOS/Android. Bản app build bằng `npm run build:native`
 * (vite --mode native: không service worker, không có trang landing/bảng giá).
 */
const config: CapacitorConfig = {
  appId: 'vn.ptalk.review',
  appName: 'PTalk Review',
  webDir: 'dist',
  backgroundColor: '#13203f',
  ios: { contentInset: 'never' },
  android: { backgroundColor: '#13203f' },
  plugins: {
    // Splash native giữ tới khi React vẽ xong (hideNativeSplash), rồi splash web trong index.html chạy tiếp
    SplashScreen: { launchAutoHide: false, launchShowDuration: 0, backgroundColor: '#13203f', showSpinner: false },
    StatusBar: { style: 'DARK', backgroundColor: '#00000000', overlaysWebView: true },
  },
}

export default config
