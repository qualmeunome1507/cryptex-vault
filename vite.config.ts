import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vitejs.dev/config/
export default defineConfig({
    base: '/',
    plugins: [
        react(),
        VitePWA({
            strategies: 'injectManifest',
            srcDir: 'src',
            filename: 'sw.ts',
            registerType: 'autoUpdate',
            includeAssets: ['logo.png', 'icon-192.png', 'icon-512.png', 'robots.txt', 'sitemap.xml'],
            manifest: {
                name: 'Cryptex Vault',
                short_name: 'Cryptex',
                description: 'Secure File Encryption',
                theme_color: '#00f2ff',
                icons: [
                    {
                        src: 'icon-192.png',
                        sizes: '192x192',
                        type: 'image/png'
                    },
                    {
                        src: 'icon-512.png',
                        sizes: '512x512',
                        type: 'image/png'
                    }
                ],
                share_target: {
                    action: "/share-target", // Must match the SW handler
                    method: "POST",
                    enctype: "multipart/form-data",
                    params: {
                        title: "name",
                        text: "description",
                        url: "link",
                        files: [
                            {
                                name: "file",
                                accept: ["*/*"]
                            }
                        ]
                    }
                }
            }
        })
    ],
})
