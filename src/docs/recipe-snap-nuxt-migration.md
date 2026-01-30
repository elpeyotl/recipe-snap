# Recipe Snap: Nuxt 3 Rewrite

## Project Overview

Rewrite the existing Vue 3 + Vite app "Recipe Snap" in Nuxt 3 with Nuxt UI components and Capacitor for native apps.

**Current stack:** Vue 3, Vite, Vercel API routes, Supabase, Stripe, Capacitor, PWA
**New stack:** Nuxt 3, Nuxt UI, Nuxt server routes, Supabase, Stripe, Capacitor, PWA

---

## 1. Project Setup

Create a new Nuxt 3 project with these dependencies:

```bash
npx nuxi@latest init recipe-snap-nuxt
cd recipe-snap-nuxt

# Core
npm install @nuxt/ui
npm install @supabase/supabase-js
npm install stripe

# Capacitor
npm install @capacitor/core @capacitor/cli
npm install @capacitor/camera @capacitor/ios @capacitor/android

# Init Capacitor
npx cap init "Recipe Snap" "com.recipesnap.app"
```

### nuxt.config.ts

```ts
export default defineNuxtConfig({
  devtools: { enabled: true },
  
  modules: [
    '@nuxt/ui',
    '@vite-pwa/nuxt'
  ],
  
  // Nuxt UI color configuration
  colorMode: {
    preference: 'dark'
  },
  
  // PWA configuration
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
  
  // Runtime config (env vars)
  runtimeConfig: {
    // Server-only (secret)
    geminiApiKey: process.env.GEMINI_API_KEY,
    stripeSecretKey: process.env.STRIPE_SECRET_KEY,
    stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
    supabaseServiceKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
    
    // Public (exposed to client)
    public: {
      supabaseUrl: process.env.SUPABASE_URL,
      supabaseAnonKey: process.env.SUPABASE_ANON_KEY,
      stripePublishableKey: process.env.STRIPE_PUBLISHABLE_KEY
    }
  },
  
  // SSR off for Capacitor compatibility
  ssr: false
})
```

---

## 2. Project Structure

```
recipe-snap-nuxt/
├── app.vue
├── nuxt.config.ts
├── capacitor.config.json
├── pages/
│   └── index.vue                 # Main app (single page app)
├── components/
│   ├── RecipeCard.vue
│   ├── RecipeDetail.vue
│   ├── IngredientChips.vue
│   ├── CameraCapture.vue
│   ├── PaywallModal.vue
│   ├── SettingsSheet.vue
│   ├── FavoritesSheet.vue
│   ├── HistorySheet.vue
│   └── ProfileSheet.vue
├── composables/
│   ├── useAuth.ts
│   ├── useCredits.ts
│   ├── useFavorites.ts
│   ├── useSettings.ts
│   ├── useSearchHistory.ts
│   └── usePurchaseHistory.ts
├── server/
│   ├── api/
│   │   ├── analyze-image.post.ts
│   │   ├── generate-image.post.ts
│   │   ├── regenerate-recipes.post.ts
│   │   ├── create-checkout.post.ts
│   │   ├── create-portal-session.post.ts
│   │   └── stripe-webhook.post.ts
│   └── utils/
│       └── stripe.ts
├── utils/
│   └── supabase.ts
└── public/
    ├── pwa-192x192.png
    ├── pwa-512x512.png
    └── apple-touch-icon.png
```

---

## 3. Migrate Composables

Convert existing composables to Nuxt auto-imported composables.

### composables/useAuth.ts

```ts
import { createClient } from '@supabase/supabase-js'

const user = ref(null)
const profile = ref(null)
const loading = ref(true)

export const useAuth = () => {
  const config = useRuntimeConfig()
  
  const supabase = createClient(
    config.public.supabaseUrl,
    config.public.supabaseAnonKey
  )
  
  const isLoggedIn = computed(() => !!user.value)
  const credits = computed(() => profile.value?.credits ?? 0)
  const subscriptionStatus = computed(() => profile.value?.subscription_status)
  const hasActiveSubscription = computed(() => 
    subscriptionStatus.value === 'active' || subscriptionStatus.value === 'trialing'
  )

  const init = async () => {
    loading.value = true
    
    const { data: { session } } = await supabase.auth.getSession()
    user.value = session?.user ?? null
    
    if (user.value) {
      await fetchProfile()
    }
    
    supabase.auth.onAuthStateChange(async (event, session) => {
      user.value = session?.user ?? null
      if (user.value) {
        await fetchProfile()
      } else {
        profile.value = null
      }
    })
    
    loading.value = false
  }

  const fetchProfile = async () => {
    if (!user.value) return
    
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.value.id)
      .single()
    
    if (!error) {
      profile.value = data
    }
  }

  const signInWithGoogle = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin }
    })
    return { error }
  }

  const signInWithApple = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'apple',
      options: { redirectTo: window.location.origin }
    })
    return { error }
  }

  const signInWithEmail = async (email: string) => {
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin }
    })
    return { error }
  }

  const signOut = async () => {
    await supabase.auth.signOut()
    user.value = null
    profile.value = null
  }

  return {
    user,
    profile,
    loading,
    isLoggedIn,
    credits,
    subscriptionStatus,
    hasActiveSubscription,
    init,
    fetchProfile,
    signInWithGoogle,
    signInWithApple,
    signInWithEmail,
    signOut
  }
}
```

### composables/useCredits.ts

```ts
const FREE_SNAPS_LIMIT = 10
const LOCAL_STORAGE_KEY = 'freeSnapsUsed'

export const useCredits = () => {
  const { isLoggedIn, credits, profile, fetchProfile, hasActiveSubscription } = useAuth()
  
  const freeSnapsUsed = ref(0)
  
  onMounted(() => {
    freeSnapsUsed.value = parseInt(localStorage.getItem(LOCAL_STORAGE_KEY) || '0')
  })
  
  const freeSnapsRemaining = computed(() => 
    Math.max(0, FREE_SNAPS_LIMIT - freeSnapsUsed.value)
  )
  
  const canSnap = computed(() => {
    if (!isLoggedIn.value) {
      return freeSnapsRemaining.value > 0
    }
    return hasActiveSubscription.value || credits.value > 0
  })
  
  const needsLogin = computed(() => 
    !isLoggedIn.value && freeSnapsRemaining.value <= 0
  )
  
  const needsCredits = computed(() => 
    isLoggedIn.value && !hasActiveSubscription.value && credits.value <= 0
  )

  const useSnap = async () => {
    if (!canSnap.value) {
      return { success: false, error: 'No snaps available' }
    }
    
    if (!isLoggedIn.value) {
      freeSnapsUsed.value++
      localStorage.setItem(LOCAL_STORAGE_KEY, freeSnapsUsed.value.toString())
      return { success: true }
    }
    
    if (hasActiveSubscription.value) {
      return { success: true }
    }
    
    // Deduct credit via API
    const { error } = await $fetch('/api/use-credit', {
      method: 'POST',
      body: { userId: profile.value.id }
    })
    
    if (error) {
      return { success: false, error }
    }
    
    await fetchProfile()
    return { success: true }
  }

  return {
    freeSnapsUsed,
    freeSnapsRemaining,
    canSnap,
    needsLogin,
    needsCredits,
    useSnap,
    FREE_SNAPS_LIMIT
  }
}
```

---

## 4. Migrate Server API Routes

Convert Vercel API routes to Nuxt server routes.

### server/api/analyze-image.post.ts

```ts
export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  const body = await readBody(event)
  
  const { imageBase64, settings } = body
  
  if (!imageBase64) {
    throw createError({ statusCode: 400, message: 'No image provided' })
  }

  const prompt = `Analyze this image of food ingredients. 
Identify all visible ingredients and generate 3 recipe ideas that can be made primarily with these ingredients.

Settings:
- Servings: ${settings?.servings || 2}
- Max cooking time: ${settings?.maxTime || 'No limit'}
- Dietary restrictions: ${settings?.dietary?.join(', ') || 'None'}
- Language: ${settings?.language || 'English'}

Return JSON format:
{
  "ingredients": ["ingredient1", "ingredient2"],
  "recipes": [
    {
      "id": "unique-id",
      "title": "Recipe Name",
      "description": "Brief description",
      "cookTime": "20 mins",
      "difficulty": "Easy",
      "servings": 2,
      "ingredients": ["1 cup ingredient", "2 tbsp ingredient"],
      "instructions": ["Step 1", "Step 2"],
      "enhanceWith": ["optional ingredient 1", "optional ingredient 2"]
    }
  ]
}`

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${config.geminiApiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: prompt },
            { inline_data: { mime_type: 'image/jpeg', data: imageBase64 } }
          ]
        }]
      })
    }
  )

  const data = await response.json()
  
  if (!response.ok) {
    throw createError({ statusCode: 500, message: data.error?.message || 'Gemini API error' })
  }

  const text = data.candidates?.[0]?.content?.parts?.[0]?.text
  const jsonMatch = text?.match(/\{[\s\S]*\}/)
  
  if (!jsonMatch) {
    throw createError({ statusCode: 500, message: 'Failed to parse response' })
  }

  return JSON.parse(jsonMatch[0])
})
```

### server/api/generate-image.post.ts

```ts
export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  const body = await readBody(event)
  
  const { recipeName, recipeDescription } = body
  
  if (!recipeName) {
    throw createError({ statusCode: 400, message: 'No recipe name provided' })
  }

  const prompt = `Professional food photography of "${recipeName}". ${recipeDescription || ''}
Appetizing, well-lit, shallow depth of field, on a rustic wooden table, garnished beautifully.`

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp-image-generation:generateContent?key=${config.geminiApiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseModalities: ['image', 'text'] }
      })
    }
  )

  const data = await response.json()
  
  if (!response.ok) {
    throw createError({ statusCode: 500, message: data.error?.message || 'Image generation failed' })
  }

  const imagePart = data.candidates?.[0]?.content?.parts?.find(p => p.inlineData)
  
  if (!imagePart) {
    throw createError({ statusCode: 500, message: 'No image generated' })
  }

  return {
    imageBase64: imagePart.inlineData.data,
    mimeType: imagePart.inlineData.mimeType
  }
})
```

### server/api/create-checkout.post.ts

```ts
import Stripe from 'stripe'

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  const body = await readBody(event)
  
  const stripe = new Stripe(config.stripeSecretKey)
  
  const { priceId, userId, userEmail, mode } = body
  
  const session = await stripe.checkout.sessions.create({
    payment_method_types: ['card'],
    line_items: [{ price: priceId, quantity: 1 }],
    mode: mode || 'payment', // 'payment' for credits, 'subscription' for subscriptions
    success_url: `${getRequestURL(event).origin}?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${getRequestURL(event).origin}?cancelled=true`,
    customer_email: userEmail,
    metadata: { userId }
  })

  return { sessionId: session.id, url: session.url }
})
```

### server/api/stripe-webhook.post.ts

```ts
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  const stripe = new Stripe(config.stripeSecretKey)
  
  const body = await readRawBody(event)
  const signature = getHeader(event, 'stripe-signature')
  
  let stripeEvent: Stripe.Event
  
  try {
    stripeEvent = stripe.webhooks.constructEvent(
      body!,
      signature!,
      config.stripeWebhookSecret
    )
  } catch (err) {
    throw createError({ statusCode: 400, message: `Webhook error: ${err.message}` })
  }
  
  const supabase = createClient(
    config.public.supabaseUrl,
    config.supabaseServiceKey
  )

  switch (stripeEvent.type) {
    case 'checkout.session.completed': {
      const session = stripeEvent.data.object as Stripe.Checkout.Session
      const userId = session.metadata?.userId
      
      if (session.mode === 'subscription') {
        // Handle subscription
        await supabase
          .from('profiles')
          .update({
            subscription_status: 'active',
            stripe_customer_id: session.customer,
            stripe_subscription_id: session.subscription
          })
          .eq('id', userId)
      } else {
        // Handle one-time credit purchase
        const credits = session.metadata?.credits ? parseInt(session.metadata.credits) : 0
        await supabase.rpc('add_credits', { p_user_id: userId, p_credits: credits })
      }
      break
    }
    
    case 'customer.subscription.updated':
    case 'customer.subscription.deleted': {
      const subscription = stripeEvent.data.object as Stripe.Subscription
      await supabase
        .from('profiles')
        .update({
          subscription_status: subscription.status,
          subscription_period_end: new Date(subscription.current_period_end * 1000).toISOString()
        })
        .eq('stripe_subscription_id', subscription.id)
      break
    }
  }

  return { received: true }
})
```

---

## 5. Main Page Component

### pages/index.vue

```vue
<script setup lang="ts">
// State
const currentView = ref<'landing' | 'camera' | 'preview' | 'loading' | 'results' | 'detail'>('landing')
const imageData = ref<string | null>(null)
const ingredients = ref<string[]>([])
const recipes = ref<any[]>([])
const selectedRecipe = ref<any>(null)
const error = ref<string | null>(null)
const loadingProgress = ref('')

// Composables
const { init: initAuth, isLoggedIn, signInWithGoogle, signInWithApple, signOut } = useAuth()
const { canSnap, needsLogin, needsCredits, useSnap, freeSnapsRemaining } = useCredits()

// Modals
const showPaywall = ref(false)
const showSettings = ref(false)
const showFavorites = ref(false)

// Initialize
onMounted(async () => {
  await initAuth()
  
  // Check if returning from Stripe
  const params = new URLSearchParams(window.location.search)
  if (params.has('session_id')) {
    // Refresh profile to get new credits
    window.history.replaceState({}, '', '/')
  }
  
  // Check localStorage for seen landing
  if (localStorage.getItem('recipesnap_seen_landing')) {
    currentView.value = 'camera'
  }
})

// Camera handling
const captureImage = async () => {
  // Use file input for web, Capacitor Camera for native
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = 'image/*'
  input.capture = 'environment'
  
  input.onchange = async (e) => {
    const file = (e.target as HTMLInputElement).files?.[0]
    if (!file) return
    
    const reader = new FileReader()
    reader.onload = () => {
      imageData.value = (reader.result as string).split(',')[1]
      currentView.value = 'preview'
    }
    reader.readAsDataURL(file)
  }
  
  input.click()
}

// Analyze image
const analyzeImage = async () => {
  if (!canSnap.value) {
    showPaywall.value = true
    return
  }
  
  currentView.value = 'loading'
  loadingProgress.value = 'Analyzing ingredients...'
  
  try {
    const { success } = await useSnap()
    if (!success) {
      showPaywall.value = true
      currentView.value = 'preview'
      return
    }
    
    const result = await $fetch('/api/analyze-image', {
      method: 'POST',
      body: {
        imageBase64: imageData.value,
        settings: {
          servings: 2,
          language: 'English'
        }
      }
    })
    
    ingredients.value = result.ingredients
    recipes.value = result.recipes
    
    // Load images for each recipe
    loadingProgress.value = 'Generating images...'
    await Promise.all(recipes.value.map(loadRecipeImage))
    
    currentView.value = 'results'
  } catch (err) {
    error.value = err.message
    currentView.value = 'preview'
  }
}

const loadRecipeImage = async (recipe: any) => {
  try {
    const result = await $fetch('/api/generate-image', {
      method: 'POST',
      body: {
        recipeName: recipe.title,
        recipeDescription: recipe.description
      }
    })
    recipe.imageUrl = `data:${result.mimeType};base64,${result.imageBase64}`
  } catch {
    recipe.imageUrl = null
  }
}

const selectRecipe = (recipe: any) => {
  selectedRecipe.value = recipe
  currentView.value = 'detail'
}

const goBack = () => {
  if (currentView.value === 'detail') {
    currentView.value = 'results'
  } else if (currentView.value === 'results') {
    currentView.value = 'camera'
  } else if (currentView.value === 'preview') {
    currentView.value = 'camera'
  }
}
</script>

<template>
  <div class="min-h-screen bg-gray-950 text-white">
    <!-- Header -->
    <header class="sticky top-0 z-50 bg-emerald-600 px-4 py-3 flex items-center justify-between">
      <div class="flex items-center gap-2">
        <UIcon name="i-heroicons-camera" class="w-6 h-6" />
        <span class="font-semibold text-lg">Recipe Snap</span>
      </div>
      
      <div class="flex items-center gap-2">
        <UButton
          icon="i-heroicons-heart"
          variant="ghost"
          color="white"
          @click="showFavorites = true"
        />
        <UButton
          icon="i-heroicons-cog-6-tooth"
          variant="ghost"
          color="white"
          @click="showSettings = true"
        />
      </div>
    </header>

    <!-- Landing View -->
    <div v-if="currentView === 'landing'" class="flex flex-col items-center justify-center min-h-[80vh] p-6 text-center">
      <h1 class="text-3xl font-bold mb-4">What's in your fridge?</h1>
      <p class="text-gray-400 mb-8">Take a photo of your ingredients and get personalized recipe ideas</p>
      <UButton size="xl" @click="currentView = 'camera'; localStorage.setItem('recipesnap_seen_landing', 'true')">
        Get Started
      </UButton>
    </div>

    <!-- Camera View -->
    <div v-else-if="currentView === 'camera'" class="flex flex-col items-center justify-center min-h-[80vh] p-6">
      <p class="text-gray-400 mb-8">Tap to snap your ingredients</p>
      
      <UButton
        size="xl"
        icon="i-heroicons-camera"
        class="rounded-full w-24 h-24"
        @click="captureImage"
      />
      
      <p class="text-sm text-gray-500 mt-6">
        {{ isLoggedIn ? 'Unlimited snaps' : `${freeSnapsRemaining} free snaps remaining` }}
      </p>
    </div>

    <!-- Preview View -->
    <div v-else-if="currentView === 'preview'" class="p-4">
      <img
        v-if="imageData"
        :src="`data:image/jpeg;base64,${imageData}`"
        class="w-full rounded-lg mb-4"
      />
      
      <div class="flex gap-3">
        <UButton variant="outline" class="flex-1" @click="currentView = 'camera'">
          Retake
        </UButton>
        <UButton class="flex-1" @click="analyzeImage">
          Find Recipes
        </UButton>
      </div>
    </div>

    <!-- Loading View -->
    <div v-else-if="currentView === 'loading'" class="flex flex-col items-center justify-center min-h-[80vh]">
      <UIcon name="i-heroicons-arrow-path" class="w-12 h-12 animate-spin text-emerald-500" />
      <p class="mt-4 text-gray-400">{{ loadingProgress }}</p>
    </div>

    <!-- Results View -->
    <div v-else-if="currentView === 'results'" class="p-4">
      <UButton variant="ghost" icon="i-heroicons-arrow-left" @click="goBack" class="mb-4">
        Back
      </UButton>
      
      <!-- Detected Ingredients -->
      <div class="mb-6">
        <h3 class="text-sm font-medium text-gray-400 mb-2">Detected Ingredients</h3>
        <div class="flex flex-wrap gap-2">
          <UBadge v-for="ing in ingredients" :key="ing" color="emerald" variant="subtle">
            {{ ing }}
          </UBadge>
        </div>
      </div>
      
      <!-- Recipe Cards -->
      <div class="space-y-4">
        <RecipeCard
          v-for="recipe in recipes"
          :key="recipe.id"
          :recipe="recipe"
          @click="selectRecipe(recipe)"
        />
      </div>
    </div>

    <!-- Detail View -->
    <div v-else-if="currentView === 'detail' && selectedRecipe" class="p-4">
      <RecipeDetail
        :recipe="selectedRecipe"
        @back="goBack"
      />
    </div>

    <!-- Paywall Modal -->
    <PaywallModal
      v-model="showPaywall"
      :needs-login="needsLogin"
      :needs-credits="needsCredits"
    />
    
    <!-- Settings Sheet -->
    <USlideover v-model="showSettings">
      <SettingsSheet @close="showSettings = false" />
    </USlideover>
    
    <!-- Favorites Sheet -->
    <USlideover v-model="showFavorites">
      <FavoritesSheet @close="showFavorites = false" />
    </USlideover>
  </div>
</template>
```

---

## 6. Components with Nuxt UI

### components/RecipeCard.vue

```vue
<script setup lang="ts">
const props = defineProps<{
  recipe: {
    id: string
    title: string
    description: string
    cookTime: string
    difficulty: string
    imageUrl?: string
    enhanceWith?: string[]
  }
}>()

const emit = defineEmits(['click'])
</script>

<template>
  <UCard
    class="cursor-pointer hover:ring-2 hover:ring-emerald-500 transition-all"
    @click="emit('click')"
  >
    <template #header>
      <div class="relative aspect-video bg-gray-800 rounded-lg overflow-hidden">
        <img
          v-if="recipe.imageUrl"
          :src="recipe.imageUrl"
          :alt="recipe.title"
          class="w-full h-full object-cover"
        />
        <div v-else class="w-full h-full flex items-center justify-center">
          <UIcon name="i-heroicons-photo" class="w-12 h-12 text-gray-600" />
        </div>
      </div>
    </template>
    
    <div class="space-y-2">
      <h3 class="font-semibold text-lg">{{ recipe.title }}</h3>
      <p class="text-sm text-gray-400">{{ recipe.description }}</p>
      
      <div class="flex items-center gap-4 text-sm text-gray-500">
        <span class="flex items-center gap-1">
          <UIcon name="i-heroicons-clock" class="w-4 h-4" />
          {{ recipe.cookTime }}
        </span>
        <span>{{ recipe.difficulty }}</span>
      </div>
      
      <div v-if="recipe.enhanceWith?.length" class="pt-2 border-t border-gray-800">
        <p class="text-xs text-gray-500 mb-1">Enhance with:</p>
        <div class="flex flex-wrap gap-1">
          <UBadge
            v-for="item in recipe.enhanceWith"
            :key="item"
            size="xs"
            color="gray"
            variant="subtle"
          >
            + {{ item }}
          </UBadge>
        </div>
      </div>
    </div>
  </UCard>
</template>
```

### components/RecipeDetail.vue

```vue
<script setup lang="ts">
const props = defineProps<{
  recipe: {
    title: string
    description: string
    cookTime: string
    difficulty: string
    servings: number
    imageUrl?: string
    ingredients: string[]
    instructions: string[]
  }
}>()

const emit = defineEmits(['back'])

const servings = ref(props.recipe.servings)
const { toggleFavorite, isFavorite } = useFavorites()
</script>

<template>
  <div>
    <!-- Header -->
    <div class="flex items-center justify-between mb-4">
      <UButton variant="ghost" icon="i-heroicons-arrow-left" @click="emit('back')">
        Back
      </UButton>
      <UButton
        :icon="isFavorite(recipe.id) ? 'i-heroicons-heart-solid' : 'i-heroicons-heart'"
        :color="isFavorite(recipe.id) ? 'red' : 'gray'"
        variant="ghost"
        @click="toggleFavorite(recipe)"
      />
    </div>
    
    <!-- Image -->
    <div class="aspect-video bg-gray-800 rounded-lg overflow-hidden mb-4">
      <img
        v-if="recipe.imageUrl"
        :src="recipe.imageUrl"
        :alt="recipe.title"
        class="w-full h-full object-cover"
      />
    </div>
    
    <!-- Title & Meta -->
    <h1 class="text-2xl font-bold mb-2">{{ recipe.title }}</h1>
    <p class="text-gray-400 mb-4">{{ recipe.description }}</p>
    
    <div class="flex items-center gap-4 text-sm text-gray-500 mb-6">
      <span class="flex items-center gap-1">
        <UIcon name="i-heroicons-clock" class="w-4 h-4" />
        {{ recipe.cookTime }}
      </span>
      <span>{{ recipe.difficulty }}</span>
    </div>
    
    <!-- Servings -->
    <div class="flex items-center gap-4 mb-6 p-3 bg-gray-900 rounded-lg">
      <span class="text-sm text-gray-400">Servings:</span>
      <UButtonGroup>
        <UButton size="xs" icon="i-heroicons-minus" @click="servings = Math.max(1, servings - 1)" />
        <UButton size="xs" disabled>{{ servings }}</UButton>
        <UButton size="xs" icon="i-heroicons-plus" @click="servings++" />
      </UButtonGroup>
    </div>
    
    <!-- Ingredients -->
    <div class="mb-6">
      <h2 class="text-lg font-semibold text-emerald-500 mb-3">Ingredients</h2>
      <ul class="space-y-2">
        <li v-for="(ing, i) in recipe.ingredients" :key="i" class="flex items-start gap-2">
          <UIcon name="i-heroicons-check-circle" class="w-5 h-5 text-emerald-500 mt-0.5" />
          <span>{{ ing }}</span>
        </li>
      </ul>
    </div>
    
    <!-- Instructions -->
    <div>
      <h2 class="text-lg font-semibold text-emerald-500 mb-3">Instructions</h2>
      <ol class="space-y-4">
        <li v-for="(step, i) in recipe.instructions" :key="i" class="flex gap-3">
          <span class="flex-shrink-0 w-6 h-6 rounded-full bg-emerald-600 flex items-center justify-center text-sm font-medium">
            {{ i + 1 }}
          </span>
          <span>{{ step }}</span>
        </li>
      </ol>
    </div>
  </div>
</template>
```

### components/PaywallModal.vue

```vue
<script setup lang="ts">
const props = defineProps<{
  modelValue: boolean
  needsLogin: boolean
  needsCredits: boolean
}>()

const emit = defineEmits(['update:modelValue'])

const { signInWithGoogle, signInWithApple, signInWithEmail } = useAuth()

const email = ref('')
const loading = ref(false)

const handleEmailLogin = async () => {
  loading.value = true
  await signInWithEmail(email.value)
  loading.value = false
}

const handleSubscribe = async () => {
  loading.value = true
  const { url } = await $fetch('/api/create-checkout', {
    method: 'POST',
    body: {
      priceId: 'price_xxx', // Your Stripe price ID
      mode: 'subscription'
    }
  })
  window.location.href = url
}
</script>

<template>
  <UModal :model-value="modelValue" @update:model-value="emit('update:modelValue', $event)">
    <UCard>
      <template #header>
        <h2 class="text-xl font-bold">
          {{ needsLogin ? "You've used all 10 free snaps!" : "You're out of credits!" }}
        </h2>
      </template>
      
      <!-- Login Options -->
      <div v-if="needsLogin" class="space-y-4">
        <p class="text-gray-400">Create an account to continue using Recipe Snap.</p>
        
        <UButton block color="white" variant="solid" @click="signInWithGoogle">
          <template #leading>
            <UIcon name="i-simple-icons-google" />
          </template>
          Continue with Google
        </UButton>
        
        <UButton block color="white" variant="solid" @click="signInWithApple">
          <template #leading>
            <UIcon name="i-simple-icons-apple" />
          </template>
          Continue with Apple
        </UButton>
        
        <UDivider label="or" />
        
        <UInput
          v-model="email"
          type="email"
          placeholder="Enter your email"
        />
        <UButton block :loading="loading" @click="handleEmailLogin">
          Send magic link
        </UButton>
      </div>
      
      <!-- Subscription Options -->
      <div v-else-if="needsCredits" class="space-y-4">
        <p class="text-gray-400">Subscribe to get unlimited snaps.</p>
        
        <UCard class="bg-emerald-900/20 border-emerald-500">
          <div class="text-center">
            <p class="text-2xl font-bold">$1.99<span class="text-sm font-normal text-gray-400">/month</span></p>
            <p class="text-sm text-gray-400">Unlimited snaps</p>
          </div>
          <UButton block class="mt-4" :loading="loading" @click="handleSubscribe">
            Subscribe Now
          </UButton>
        </UCard>
      </div>
      
      <template #footer>
        <UButton variant="ghost" block @click="emit('update:modelValue', false)">
          Maybe later
        </UButton>
      </template>
    </UCard>
  </UModal>
</template>
```

---

## 7. Capacitor Setup

### capacitor.config.json

```json
{
  "appId": "com.recipesnap.app",
  "appName": "Recipe Snap",
  "webDir": ".output/public",
  "server": {
    "androidScheme": "https"
  },
  "plugins": {
    "Camera": {
      "permissionText": "Recipe Snap needs camera access to scan your ingredients"
    }
  }
}
```

### Build & Run Commands

```bash
# Build Nuxt (generates .output/public for static)
npm run generate

# Add platforms
npx cap add ios
npx cap add android

# Sync web build to native
npx cap sync

# Open in IDE
npx cap open ios
npx cap open android
```

### Native Camera (optional enhancement)

```ts
// composables/useCamera.ts
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera'
import { Capacitor } from '@capacitor/core'

export const useCamera = () => {
  const isNative = Capacitor.isNativePlatform()
  
  const takePhoto = async (): Promise<string | null> => {
    if (isNative) {
      const photo = await Camera.getPhoto({
        quality: 80,
        allowEditing: false,
        resultType: CameraResultType.Base64,
        source: CameraSource.Camera
      })
      return photo.base64String || null
    } else {
      // Web fallback - use file input
      return new Promise((resolve) => {
        const input = document.createElement('input')
        input.type = 'file'
        input.accept = 'image/*'
        input.capture = 'environment'
        
        input.onchange = (e) => {
          const file = (e.target as HTMLInputElement).files?.[0]
          if (!file) return resolve(null)
          
          const reader = new FileReader()
          reader.onload = () => {
            const base64 = (reader.result as string).split(',')[1]
            resolve(base64)
          }
          reader.readAsDataURL(file)
        }
        
        input.click()
      })
    }
  }
  
  return { takePhoto, isNative }
}
```

---

## 8. Environment Variables

### .env

```env
# Public (exposed to client)
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_ANON_KEY=eyJ...
STRIPE_PUBLISHABLE_KEY=pk_live_...

# Server only (never exposed)
GEMINI_API_KEY=xxx
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

---

## 9. Deployment

### Vercel

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel
```

Nuxt auto-detects Vercel and configures server routes correctly.

### Environment Variables in Vercel

Add all env vars in Vercel dashboard → Project → Settings → Environment Variables.

---

## 10. Migration Checklist

- [ ] Create new Nuxt 3 project
- [ ] Install dependencies (@nuxt/ui, supabase, stripe, capacitor)
- [ ] Configure nuxt.config.ts
- [ ] Migrate composables (useAuth, useCredits, useFavorites, useSettings, etc.)
- [ ] Migrate server API routes to server/api/
- [ ] Create components with Nuxt UI
- [ ] Build main page (pages/index.vue)
- [ ] Set up Capacitor
- [ ] Configure PWA
- [ ] Set up environment variables
- [ ] Test locally
- [ ] Deploy to Vercel
- [ ] Test Stripe webhooks
- [ ] Build and test iOS/Android
