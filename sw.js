'use strict';

// Ganti nomor versi ini (misal: v2, v3) setiap kali Anda melakukan update besar.
const CACHE_NAME = 'bubuwi-pro-final-v1';

const urlsToCache = [
  '/',
  '/index.html',
  '/style.css',
  '/app.js',
  '/manifest.json',
  'https://i.imgur.com/9uK2OPw.png' // Logo Utama
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
