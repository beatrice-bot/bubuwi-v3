'use strict';

// Versi cache. Ganti nomornya (misal: v5, v6) setiap kali ada update besar.
const CACHE_NAME = 'bubuwi-v3-cache';

// Daftar file yang akan disimpan di cache untuk akses offline.
const urlsToCache = [
  '/',
  '/index.html',
  '/style.css',
  '/app.js',
  '/manifest.json',
  'https://i.imgur.com/9uK2OPw.png', // Logo
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.2/css/all.min.css' // Font Awesome
];

// Event 'install': Menyimpan file-file dasar ke cache.
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Service Worker: Caching assets...');
        return cache.addAll(urlsToCache);
      })
  );
});

// Event 'activate': Membersihkan cache versi lama.
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('Service Worker: Clearing old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

// Event 'fetch': Menyajikan file dari cache jika ada, atau dari network jika tidak.
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Jika resource ditemukan di cache, kembalikan dari cache.
        return response || fetch(event.request);
      })
  );
});
