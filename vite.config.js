import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { VitePWA } from 'vite-plugin-pwa'
import { resolve } from 'path'
import { pathToFileURL } from 'url'
import { readFileSync } from 'fs'

// Load all .env vars into process.env (so server-side API routes can access GEMINI_API_KEY etc.)
try {
  const envFile = readFileSync(resolve(process.cwd(), '.env'), 'utf-8')
  for (const line of envFile.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eqIndex = trimmed.indexOf('=')
    if (eqIndex > 0) {
      const key = trimmed.slice(0, eqIndex)
      const val = trimmed.slice(eqIndex + 1)
      if (!process.env[key]) process.env[key] = val
    }
  }
} catch (e) { /* no .env file */ }

// Plugin to serve /api/ routes locally during dev (mirrors Vercel serverless functions)
function vercelApiPlugin() {
  return {
    name: 'vercel-api',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url.startsWith('/api/')) return next()

        // Map /api/foo to api/foo.js
        const routeName = req.url.replace(/^\/api\//, '').split('?')[0]
        const filePath = resolve(process.cwd(), 'api', `${routeName}.js`)

        try {
          // Clear module cache for hot reload
          const fileUrl = pathToFileURL(filePath).href
          const mod = await import(`${fileUrl}?t=${Date.now()}`)
          const handler = mod.default

          // Parse JSON body for POST requests
          let body = ''
          if (req.method === 'POST') {
            body = await new Promise((resolve) => {
              let data = ''
              req.on('data', chunk => data += chunk)
              req.on('end', () => resolve(data))
            })
          }

          // Create mock req/res matching Vercel's API
          const mockReq = {
            method: req.method,
            headers: req.headers,
            body: body ? JSON.parse(body) : {},
            query: Object.fromEntries(new URL(req.url, 'http://localhost').searchParams)
          }

          const mockRes = {
            statusCode: 200,
            headers: {},
            status(code) { this.statusCode = code; return this },
            setHeader(key, val) { this.headers[key] = val; return this },
            json(data) {
              res.writeHead(this.statusCode, {
                'Content-Type': 'application/json',
                ...this.headers
              })
              res.end(JSON.stringify(data))
            }
          }

          await handler(mockReq, mockRes)
        } catch (err) {
          console.error(`API error [${routeName}]:`, err.message)
          res.writeHead(500, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: err.message }))
        }
      })
    }
  }
}

export default defineConfig({
  plugins: [
    vue(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon-32.png', 'logo.png', 'apple-touch-icon.png'],
      manifest: {
        name: 'Recipe Snap',
        short_name: 'RecipeSnap',
        description: 'Snap a photo of ingredients, get recipe ideas',
        theme_color: '#1a1a2e',
        background_color: '#121212',
        display: 'standalone',
        orientation: 'portrait',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      }
    }),
    vercelApiPlugin()
  ],
})
