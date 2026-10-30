// 定義快取名稱與版本號（更新前端 UI 時只需修改版本號）
const CACHE_NAME = 'pro-aqua-light-v1';

// 需要靜態快取至手機本地的文件清單
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon-192.png',
  'https://cdn.jsdelivr.net/npm/chart.js' // 如果 Chart.js 使用 CDN，亦可快取
];

// 1. Service Worker 安裝事件：下載並快取靜態資源
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW] Pre-caching offline assets');
      return cache.addAll(ASSETS_TO_CACHE);
    }).then(() => self.skipWaiting())
  );
});

// 2. Service Worker 激活事件：清理舊版本的快取
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            console.log('[SW] Clearing old cache:', cache);
            return caches.delete(cache);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// 3. 請求攔截事件（核心邏輯）：區分「靜態 UI 頁面」與「OpenBeken HTTP 控制命令」
self.addEventListener('fetch', (event) => {
  const requestUrl = new URL(event.request.url);

  // ⚠️ 關鍵判斷：如果請求包含 `/cm` 或 `cmnd=`，說明是發給 BL602 的實時 PWM 控燈指令
  // 絕對不能使用本地快取，必須直接發送網路請求！
  if (requestUrl.pathname.includes('/cm') || requestUrl.search.includes('cmnd=')) {
    event.respondWith(fetch(event.request));
    return;
  }

  // 對於 HTML / CSS / JS / 圖示等 UI 資源：優先從快取讀取（Network First 或 Cache First 策略）
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        // 本地有快取，直接秒開
        return cachedResponse;
      }
      // 本地無快取，向芯片發起網絡請求
      return fetch(event.request).catch(() => {
        // 離線且無快取時的保底處理
        console.log('[SW] Offline fetch failed for:', event.request.url);
      });
    })
  );
});