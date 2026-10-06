import React from 'react'
// Font đóng gói cùng app (chạy offline; trước đây tải từ Google Fonts). Giữ đúng các độ đậm đã dùng.
import '@fontsource/be-vietnam-pro/400.css'
import '@fontsource/be-vietnam-pro/500.css'
import '@fontsource/be-vietnam-pro/700.css'
import '@fontsource/be-vietnam-pro/800.css'
import '@fontsource/be-vietnam-pro/400-italic.css'
import '@fontsource/be-vietnam-pro/500-italic.css'
import '@fontsource/cinzel/600.css'
import '@fontsource/cinzel/700.css'
import '@fontsource/cinzel/800.css'
import ReactDOM from 'react-dom/client'
import App from './App'
import { hideSplashWhenReady } from './lib/splash'
import { hydrateStorage } from './lib/storage'
import { hideNativeSplash, initNative } from './lib/native'
import { reloadSession } from './lib/auth'
import { initSync, reloadSyncState } from './lib/sync'

// App iOS/Android: khôi phục tiến độ từ bộ lưu native trước khi render (web: xong ngay)
initNative()
hydrateStorage().finally(() => {
  // Bộ lưu vừa được khôi phục → đọc lại phiên đăng nhập và trạng thái đồng bộ, rồi đồng bộ với máy chủ
  reloadSession()
  reloadSyncState()
  initSync()
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  )
  hideSplashWhenReady()
  hideNativeSplash()
})
