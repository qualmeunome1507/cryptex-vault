/// <reference lib="webworker" />
import { cleanupOutdatedCaches, precacheAndRoute } from 'workbox-precaching'
import { clientsClaim } from 'workbox-core'

declare let self: ServiceWorkerGlobalScope

self.skipWaiting()
clientsClaim()

// 1. Precache standard assets
cleanupOutdatedCaches()
precacheAndRoute(self.__WB_MANIFEST)

// 2. Handle Share Target POST requests
self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url)

    // Intercept POST request to /share-target
    if (event.request.method === 'POST' && url.pathname.endsWith('/share-target')) {
        event.respondWith(
            (async () => {
                const formData = await event.request.formData()
                const files = formData.getAll('file') // 'file' matches the name in manifest
                const client = await self.clients.get(event.clientId || '')

                // Store files in a specific cache to retrieve them later in the UI
                const cache = await caches.open('cryptex-shared-files')

                // We'll store them by timestamp to avoid collisions
                const timestamp = Date.now()

                await Promise.all(
                    files.map(async (file: any, i) => {
                        // We need to store simple Response objects
                        const response = new Response(file, {
                            headers: {
                                'content-type': file.type,
                                'x-file-name': file.name
                            }
                        })
                        await cache.put(`/shared-file-${timestamp}-${i}`, response)
                    })
                )

                // Redirect user to the main page to process the files
                return Response.redirect('./?action=shared', 303)
            })()
        )
    }
})
