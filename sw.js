const cacheName = 'zryspoty-v6';
const files = ['./', './index.html', './style.css', './app.js', './manifest.webmanifest', './icon.png', './icon-192.png', './assets/hero.webp', ...['neon', 'horyzont', 'mgla', 'puls'].flatMap(id => ['./assets/' + id + '.mp3', './assets/' + id + '.webp'])];
self.addEventListener('install', event => event.waitUntil(caches.open(cacheName).then(cache => cache.addAll(files))));
self.addEventListener('activate', event => event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('zryspoty-') && key !== cacheName).map(key => caches.delete(key)))).then(() => self.clients.claim())));
self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET' || new URL(request.url).origin !== location.origin) return;
  event.respondWith(caches.open(cacheName).then(async cache => {
    const cached = await cache.match(request.url);
    const range = request.headers.get('Range');
    if (cached && !range) return cached;
    const requested = range && /^bytes=(\d+)-(\d*)$/.exec(range);
    if (!cached || !requested) return fetch(request);
    const bytes = await cached.arrayBuffer();
    const start = Number(requested[1]);
    const end = requested[2] ? Math.min(Number(requested[2]), bytes.byteLength - 1) : bytes.byteLength - 1;
    if (start > end) return new Response(null, {status: 416, headers: {'Content-Range': 'bytes */' + bytes.byteLength}});
    return new Response(bytes.slice(start, end + 1), {status: 206, headers: {
      'Content-Type': cached.headers.get('Content-Type'),
      'Content-Length': String(end - start + 1),
      'Content-Range': 'bytes ' + start + '-' + end + '/' + bytes.byteLength,
      'Accept-Ranges': 'bytes',
    }});
  }));
});
