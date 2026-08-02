import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// Register Service Worker for offline PWA support
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('./sw.js')
      .then((registration) => {
        console.log('[KFH Offline SW] Service Worker registered with scope:', registration.scope);
      })
      .catch((error) => {
        console.warn('[KFH Offline SW] Service Worker registration skipped/notice:', error);
      });
  });
}
