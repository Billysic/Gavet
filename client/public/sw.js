/**
 * Service Worker - Gaveta Inteligente PWA
 * Estratégia Offline-First: Cache-First para recursos estáticos e Network-First para APIs.
 */

const CACHE_NAME = 'gavet-cache-v3';

// Recursos críticos para carregar o app 100% offline
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icons/gavet-icon.svg',
  '/icons/icon-192.svg',
  '/icons/icon-512.svg'
];

// Instalação do Service Worker e pré-cache dos arquivos essenciais
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW] Pré-carregando assets estáticos para cache offline...');
      return cache.addAll(STATIC_ASSETS);
    }).then(() => self.skipWaiting())
  );
});

// Ativação do Service Worker e limpeza de caches antigos
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('[SW] Removendo cache obsoleto:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Interceptação de requisições
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // 1. Ignora requisições de outras origens ou esquemas especiais (chrome-extension, etc.)
  if (!request.url.startsWith('http')) return;

  // 2. Requisições à API (/api/*) seguem Network-First
  if (url.pathname.startsWith('/api')) {
    event.respondWith(
      fetch(request)
        .catch(() => {
          // Se estiver offline ao chamar a API, retorna resposta estruturada de fallback
          return new Response(
            JSON.stringify({ 
              offline: true, 
              message: 'Você está offline. Operação enfileirada no IndexedDB.' 
            }),
            {
              status: 503,
              headers: { 'Content-Type': 'application/json' }
            }
          );
        })
    );
    return;
  }

  // 3. Recursos Estáticos (HTML, JS, CSS, Fontes, Imagens): Cache-First com atualização em background (Stale-While-Revalidate)
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      if (cachedResponse) {
        // Atualiza o cache silenciosamente em segundo plano se houver conexão
        fetch(request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            caches.open(CACHE_NAME).then((cache) => cache.put(request, networkResponse));
          }
        }).catch(() => { /* Sem rede em background, mantemos a versão do cache */ });

        return cachedResponse;
      }

      // Se não estava no cache prévio, busca na rede e guarda no cache
      return fetch(request).then((networkResponse) => {
        if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
          return networkResponse;
        }

        const responseToCache = networkResponse.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(request, responseToCache);
        });

        return networkResponse;
      }).catch(() => {
        // Fallback de página offline para navegações HTML
        if (request.mode === 'navigate') {
          return caches.match('/');
        }
      });
    })
  );
});
