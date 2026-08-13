/* global self, caches, fetch */
const CACHE = 'human-verification-v3'
const SHELL = ['/', '/index.html', '/manifest.webmanifest', '/icon.svg', '/og.png']

async function precacheRelease() {
  const cache = await caches.open(CACHE)
  const indexResponse = await fetch('/index.html', { cache: 'reload' })
  if (!indexResponse.ok) throw new Error(`Unable to cache release shell: ${indexResponse.status}`)

  const html = await indexResponse.clone().text()
  const builtAssets = [...html.matchAll(/(?:src|href)="(\/[^"#?]+)"/g)].map(match => match[1])
  const paths = [...new Set([...SHELL, ...builtAssets])]

  await cache.put('/index.html', indexResponse)
  await Promise.all(paths.filter(path => path !== '/index.html').map(async path => {
    const response = await fetch(path, { cache: 'reload' })
    if (!response.ok) throw new Error(`Unable to cache ${path}: ${response.status}`)
    await cache.put(path, response)
  }))
}

async function activateRelease() {
  const keys = await caches.keys()
  await Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key)))
  await self.clients.claim()
}

async function networkFirstNavigation(request) {
  const cache = await caches.open(CACHE)
  try {
    const response = await fetch(request, { cache: 'no-store' })
    if (response.ok) await cache.put('/index.html', response.clone())
    return response
  } catch (error) {
    const fallback = await cache.match('/index.html')
    if (fallback) return fallback
    throw error
  }
}

async function cacheFirstAsset(request) {
  const cache = await caches.open(CACHE)
  const cached = await cache.match(request)
  if (cached) return cached

  // Asset failures stay failures. Returning the shell here would serve HTML
  // as a missing script, stylesheet, image, or manifest.
  const response = await fetch(request)
  if (response.ok) await cache.put(request, response.clone())
  return response
}

self.addEventListener('install', event => {
  event.waitUntil(precacheRelease().then(() => self.skipWaiting()))
})

self.addEventListener('activate', event => {
  event.waitUntil(activateRelease())
})

self.addEventListener('fetch', event => {
  const request = event.request
  if (request.method !== 'GET' || !request.url.startsWith(`${self.location.origin}/`)) return
  event.respondWith(request.mode === 'navigate' ? networkFirstNavigation(request) : cacheFirstAsset(request))
})
