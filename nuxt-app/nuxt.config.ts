export default defineNuxtConfig({
  devtools: { enabled: true },

  css: ['~/assets/css/main.css'],

  modules: [
    '@nuxt/ui',
    '@vite-pwa/nuxt'
  ],

  colorMode: {
    preference: 'dark'
  },

  pwa: {
    registerType: 'autoUpdate',
    manifest: {
      name: 'Recipe Snap',
      short_name: 'RecipeSnap',
      description: 'Snap a photo of ingredients, get recipe ideas',
      theme_color: '#1a1a2e',
      background_color: '#121212',
      display: 'standalone',
      orientation: 'portrait',
      icons: [
        { src: '/pwa-192x192.png', sizes: '192x192', type: 'image/png' },
        { src: '/pwa-512x512.png', sizes: '512x512', type: 'image/png' }
      ]
    }
  },

  runtimeConfig: {
    geminiApiKey: process.env.GEMINI_API_KEY,
    stripeSecretKey: process.env.STRIPE_SECRET_KEY,
    stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
    supabaseServiceKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
    stripeStarterPriceId: process.env.STRIPE_STARTER_PRICE_ID,
    stripeRegularPriceId: process.env.STRIPE_REGULAR_PRICE_ID,
    stripeProPriceId: process.env.STRIPE_PRO_PRICE_ID,
    stripeMonthlyPriceId: process.env.STRIPE_MONTHLY_PRICE_ID,
    public: {
      supabaseUrl: process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
      supabaseAnonKey: process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY,
      freeSnaps: parseInt(process.env.FREE_SNAPS || process.env.VITE_FREE_SNAPS || '10'),
      limitSnaps: (process.env.LIMIT_SNAPS || process.env.VITE_LIMIT_SNAPS) !== 'false',
      unlockCode: process.env.UNLOCK_CODE || process.env.VITE_UNLOCK_CODE || ''
    }
  },

  ssr: false,

  app: {
    head: {
      charset: 'utf-8',
      viewport: 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover',
      meta: [
        { name: 'theme-color', content: '#1a1a2e' },
        { name: 'description', content: 'Snap a photo of your ingredients and get personalized recipe ideas instantly. AI-powered cooking inspiration from what\'s in your fridge.' },
        { name: 'apple-mobile-web-app-capable', content: 'yes' },
        { name: 'apple-mobile-web-app-status-bar-style', content: 'black-translucent' }
      ],
      link: [
        { rel: 'icon', type: 'image/png', href: '/favicon-32.png' },
        { rel: 'apple-touch-icon', href: '/apple-touch-icon.png' },
        { rel: 'canonical', href: 'https://recipesnap.co/' }
      ]
    }
  }
})
