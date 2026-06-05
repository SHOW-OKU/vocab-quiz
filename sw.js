/**
 * VocabQuiz — Service Worker
 * オフラインでも動作するようにリソースをキャッシュする
 */

const CACHE_NAME = 'vocabquiz-v2';

// キャッシュするファイル一覧
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

// ── インストール時：全アセットをキャッシュ ──
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(ASSETS);
    })
  );
  // 古いSWを待たずにすぐ有効化
  self.skipWaiting();
});

// ── アクティベート時：古いキャッシュを削除 ──
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// ── フェッチ時：キャッシュ優先、なければネットワーク ──
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Anthropic API と Google Fonts はキャッシュしない（常にネットワーク）
  if (
    url.hostname === 'api.anthropic.com' ||
    url.hostname === 'fonts.googleapis.com' ||
    url.hostname === 'fonts.gstatic.com'
  ) {
    event.respondWith(fetch(event.request));
    return;
  }

  // それ以外はキャッシュ優先（オフライン対応）
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;

      // キャッシュにない場合はネットワークから取得してキャッシュに追加
      return fetch(event.request).then(response => {
        if (!response || response.status !== 200 || response.type === 'opaque') {
          return response;
        }
        const toCache = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, toCache));
        return response;
      }).catch(() => {
        // ネットワークもなければ index.html を返す（SPAフォールバック）
        return caches.match('./index.html');
      });
    })
  );
});
