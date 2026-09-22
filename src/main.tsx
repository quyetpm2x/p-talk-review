import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { hideSplashWhenReady } from './lib/splash'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)

hideSplashWhenReady()
