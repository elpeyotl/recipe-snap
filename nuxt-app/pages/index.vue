<script setup lang="ts">
// ---------- Composables ----------
const {
  user,
  profile,
  loading: authLoading,
  isLoggedIn,
  credits,
  subscriptionStatus,
  subscriptionPeriodEnd,
  hasActiveSubscription,
  init: initAuth,
  fetchProfile,
  signInWithEmail,
  signInWithGoogle,
  signInWithApple,
  signOut
} = useAuth()

const {
  freeSnapsRemaining,
  canSnap,
  needsLogin,
  needsCredits,
  useSnap,
  totalCredits,
  subscriptionCredits,
  FREE_SNAPS_LIMIT
} = useCredits()

const {
  favorites,
  isFavorite,
  toggleFavorite: toggleFav,
  init: initFavorites
} = useFavorites()

const {
  searchHistory,
  addToHistory,
  init: initHistory
} = useSearchHistory()

const {
  purchases,
  loading: purchasesLoading,
  fetchPurchases
} = usePurchaseHistory()

const {
  servings,
  dietaryFilters,
  maxTime,
  language,
  init: initSettings
} = useSettings()

const {
  analyzeImage,
  regenerateFromIngredients,
  fetchRecipeImage
} = useGemini()

const {
  PACKS,
  SUBSCRIPTION,
  buyCredits,
  buySubscription,
  openCustomerPortal
} = useStripe()

// ---------- UI State ----------
const showPaywall = ref(false)
const forceCreditsMode = ref(false)
const forceLoginMode = ref(false)
const purchaseLoading = ref(false)
const showFavorites = ref(false)
const showHistory = ref(false)
const showSettings = ref(false)
const showProfile = ref(false)
const legalModal = ref<string | null>(null)

// ---------- App State ----------
const hasSeenLanding = import.meta.client ? localStorage.getItem('recipesnap_seen_landing') : null
const currentView = ref(hasSeenLanding ? 'camera' : 'landing')
const imageData = ref<string | null>(null)
const ingredients = ref<string[]>([])
const originalIngredients = ref<string[]>([])
const recipes = ref<any[]>([])
const selectedRecipe = ref<any>(null)
const error = ref<string | null>(null)
const isNoIngredientsError = computed(
  () => error.value?.includes('No food ingredients') || error.value?.includes('No recipes could be generated')
)
const loadingProgress = ref('')

// ---------- Ingredient Editing ----------
const editingIngredient = ref<number | null>(null)
const editingValue = ref('')
const showAddInput = ref(false)
const newIngredientValue = ref('')

// ---------- File Input Ref ----------
const fileInput = ref<HTMLInputElement | null>(null)

// ---------- Computed ----------
const activeFilterNames = computed(() => {
  const names: string[] = []
  if (dietaryFilters.value.vegetarian) names.push('Vegetarian')
  if (dietaryFilters.value.vegan) names.push('Vegan')
  if (dietaryFilters.value.glutenFree) names.push('Gluten-Free')
  if (dietaryFilters.value.dairyFree) names.push('Dairy-Free')
  if (maxTime.value > 0) names.push(`Under ${maxTime.value} min`)
  return names
})

const languageOptions = [
  { value: 'en', label: 'English' },
  { value: 'es', label: 'Espanol' },
  { value: 'fr', label: 'Francais' },
  { value: 'de', label: 'Deutsch' },
  { value: 'it', label: 'Italiano' },
  { value: 'pt', label: 'Portugues' },
  { value: 'ja', label: 'Japanese' },
  { value: 'ko', label: 'Korean' },
  { value: 'zh', label: 'Chinese' }
]

const snapsDisplay = computed(() => {
  if (!isLoggedIn.value) {
    return `${freeSnapsRemaining.value} free snap${freeSnapsRemaining.value !== 1 ? 's' : ''} remaining`
  }
  if (hasActiveSubscription.value && subscriptionCredits.value > 0) {
    return `${subscriptionCredits.value} subscription snap${subscriptionCredits.value !== 1 ? 's' : ''} remaining`
  }
  if (totalCredits.value > 0) {
    return `${totalCredits.value} snap${totalCredits.value !== 1 ? 's' : ''} remaining`
  }
  return 'No snaps remaining'
})

const subscriptionLabel = computed(() => {
  if (subscriptionStatus.value === 'active') return 'Active'
  if (subscriptionStatus.value === 'canceled') return 'Canceling'
  return 'None'
})

// ---------- Browser History Integration ----------
function pushHistoryState(view: string) {
  if (!import.meta.client) return
  const state = { view }
  window.history.pushState(state, '', '')
}

function onPopState(event: PopStateEvent) {
  const state = event.state
  if (state && state.view) {
    // Navigate to previous view
    if (state.view === 'camera') {
      goToCamera()
    } else if (state.view === 'preview') {
      currentView.value = 'preview'
    } else if (state.view === 'results') {
      if (selectedRecipe.value) {
        selectedRecipe.value = null
        currentView.value = 'results'
      } else {
        goToCamera()
      }
    } else if (state.view === 'detail') {
      currentView.value = 'detail'
    } else if (state.view === 'landing') {
      currentView.value = 'landing'
    }
  } else {
    // No state means we're at the root
    if (selectedRecipe.value) {
      selectedRecipe.value = null
      currentView.value = 'results'
    } else if (currentView.value === 'results') {
      goToCamera()
    } else if (currentView.value === 'preview') {
      goToCamera()
    } else if (currentView.value === 'loading') {
      goToCamera()
    }
  }
  // Close any open slideovers
  showFavorites.value = false
  showHistory.value = false
  showSettings.value = false
  showProfile.value = false
}

// ---------- Session Persistence ----------
function saveSession() {
  if (!import.meta.client) return
  const session = {
    currentView: currentView.value,
    imageData: imageData.value,
    ingredients: ingredients.value,
    originalIngredients: originalIngredients.value,
    recipes: recipes.value.map(({ imageUrl, imageLoading, imageLoaded, ...rest }: any) => rest),
    selectedRecipeName: selectedRecipe.value?.name || null
  }
  localStorage.setItem('recipesnap_session', JSON.stringify(session))
}

function restoreSession() {
  if (!import.meta.client) return
  try {
    const saved = localStorage.getItem('recipesnap_session')
    if (!saved) return
    const session = JSON.parse(saved)

    if (session.currentView && session.currentView !== 'landing' && session.currentView !== 'loading') {
      if (session.ingredients?.length) {
        ingredients.value = session.ingredients
        originalIngredients.value = session.originalIngredients || session.ingredients
      }
      if (session.imageData) {
        imageData.value = session.imageData
      }
      if (session.recipes?.length) {
        recipes.value = session.recipes
        // Re-fetch images for recipes
        for (const recipe of recipes.value) {
          loadRecipeImage(recipe)
        }
        if (session.selectedRecipeName) {
          const found = recipes.value.find((r: any) => r.name === session.selectedRecipeName)
          if (found) {
            selectedRecipe.value = found
            currentView.value = 'detail'
          } else {
            currentView.value = 'results'
          }
        } else {
          currentView.value = session.currentView === 'detail' ? 'results' : session.currentView
        }
      } else if (session.imageData && session.currentView === 'preview') {
        currentView.value = 'preview'
      }
    }
  } catch {
    // Ignore restore errors
  }
}

// ---------- Navigation ----------
function goToCamera() {
  currentView.value = 'camera'
  imageData.value = null
  error.value = null
  selectedRecipe.value = null
  editingIngredient.value = null
  showAddInput.value = false
}

function goToLanding() {
  currentView.value = 'landing'
}

function startApp() {
  if (import.meta.client) {
    localStorage.setItem('recipesnap_seen_landing', 'true')
  }
  currentView.value = 'camera'
  pushHistoryState('camera')
}

// ---------- Camera / Photo ----------
function triggerFileInput() {
  fileInput.value?.click()
}

function openCamera() {
  // Check credit availability first
  if (!canSnap.value) {
    if (needsLogin.value) {
      forceLoginMode.value = true
      forceCreditsMode.value = false
    } else if (needsCredits.value) {
      forceCreditsMode.value = true
      forceLoginMode.value = false
    }
    showPaywall.value = true
    return
  }
  triggerFileInput()
}

async function onFileSelected(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return

  // Read file as data URL
  const reader = new FileReader()
  reader.onload = async (e) => {
    const dataUrl = e.target?.result as string
    imageData.value = dataUrl
    error.value = null
    currentView.value = 'preview'
    pushHistoryState('preview')
  }
  reader.readAsDataURL(file)

  // Reset file input
  input.value = ''
}

// ---------- Recipe Analysis ----------
async function findRecipes() {
  if (!imageData.value) return

  // Use a snap credit
  const snapResult = await useSnap()
  if (!snapResult.success) {
    if (needsLogin.value) {
      forceLoginMode.value = true
      forceCreditsMode.value = false
    } else {
      forceCreditsMode.value = true
      forceLoginMode.value = false
    }
    showPaywall.value = true
    return
  }

  currentView.value = 'loading'
  pushHistoryState('loading')
  error.value = null
  loadingProgress.value = 'Analyzing your ingredients...'

  try {
    hapticFeedback()
    const result = await analyzeImage(
      imageData.value,
      dietaryFilters.value,
      servings.value,
      maxTime.value,
      language.value
    )

    if (!result || !result.ingredients || !result.recipes) {
      throw new Error('No food ingredients detected. Please try again with a clearer photo of food items.')
    }

    ingredients.value = result.ingredients
    originalIngredients.value = [...result.ingredients]
    recipes.value = result.recipes

    // Save to history
    await addToHistory(ingredients.value, recipes.value)

    // Load images for each recipe
    loadingProgress.value = 'Generating recipe images...'
    for (const recipe of recipes.value) {
      loadRecipeImage(recipe)
    }

    currentView.value = 'results'
    pushHistoryState('results')
    saveSession()
  } catch (err: any) {
    error.value = err.message || 'Something went wrong. Please try again.'
    currentView.value = 'preview'
    pushHistoryState('preview')
  }
}

async function loadRecipeImage(recipe: any) {
  recipe.imageLoading = true
  recipe.imageLoaded = false
  try {
    const url = await fetchRecipeImage(recipe)
    if (url) {
      recipe.imageUrl = url
      recipe.imageLoaded = true
    }
  } catch {
    // Silently fail image loading
  } finally {
    recipe.imageLoading = false
  }
}

async function handleRegenerate() {
  if (!ingredients.value.length) return

  currentView.value = 'loading'
  error.value = null
  loadingProgress.value = 'Finding new recipes...'

  try {
    hapticFeedback()
    const result = await regenerateFromIngredients(
      ingredients.value,
      dietaryFilters.value,
      servings.value,
      maxTime.value,
      language.value
    )

    if (!result || !result.recipes) {
      throw new Error('No recipes could be generated from these ingredients. Try adding more items.')
    }

    recipes.value = result.recipes

    // Save to history
    await addToHistory(ingredients.value, recipes.value)

    // Load images
    loadingProgress.value = 'Generating recipe images...'
    for (const recipe of recipes.value) {
      loadRecipeImage(recipe)
    }

    currentView.value = 'results'
    pushHistoryState('results')
    saveSession()
  } catch (err: any) {
    error.value = err.message || 'Failed to regenerate recipes.'
    currentView.value = 'results'
  }
}

// ---------- Recipe Detail ----------
function openRecipeDetail(recipe: any) {
  selectedRecipe.value = recipe
  currentView.value = 'detail'
  pushHistoryState('detail')
  saveSession()
  hapticFeedback()
}

function closeRecipeDetail() {
  selectedRecipe.value = null
  currentView.value = 'results'
  saveSession()
}

function handleToggleFavorite(recipe: any) {
  toggleFav(recipe)
  hapticFeedback()
}

async function handleShare() {
  if (!selectedRecipe.value) return
  const recipe = selectedRecipe.value
  const text = `${recipe.name}\n\nIngredients:\n${recipe.ingredients?.join('\n')}\n\nSteps:\n${recipe.steps?.map((s: string, i: number) => `${i + 1}. ${s}`).join('\n')}`

  if (navigator.share) {
    try {
      await navigator.share({ title: recipe.name, text })
    } catch {
      // User cancelled or error
    }
  } else {
    await navigator.clipboard.writeText(text)
  }
}

// ---------- Ingredient Editing ----------
function startEditIngredient(index: number) {
  editingIngredient.value = index
  editingValue.value = ingredients.value[index]
}

function saveEditIngredient() {
  if (editingIngredient.value === null) return
  const trimmed = editingValue.value.trim()
  if (trimmed) {
    ingredients.value[editingIngredient.value] = trimmed
  }
  editingIngredient.value = null
  editingValue.value = ''
}

function cancelEditIngredient() {
  editingIngredient.value = null
  editingValue.value = ''
}

function removeIngredient(index: number) {
  ingredients.value.splice(index, 1)
  hapticFeedback()
}

function showAddIngredient() {
  showAddInput.value = true
  newIngredientValue.value = ''
}

function addIngredient() {
  const trimmed = newIngredientValue.value.trim()
  if (trimmed) {
    ingredients.value.push(trimmed)
    newIngredientValue.value = ''
    showAddInput.value = false
    hapticFeedback()
  }
}

function cancelAddIngredient() {
  showAddInput.value = false
  newIngredientValue.value = ''
}

// ---------- History Actions ----------
function loadFromHistory(entry: any) {
  ingredients.value = [...entry.ingredients]
  originalIngredients.value = [...entry.ingredients]
  recipes.value = entry.recipes || []

  for (const recipe of recipes.value) {
    loadRecipeImage(recipe)
  }

  showHistory.value = false
  currentView.value = 'results'
  pushHistoryState('results')
  saveSession()
}

function loadIngredientsFromHistory(ingredientsList: string[]) {
  ingredients.value = [...ingredientsList]
  originalIngredients.value = [...ingredientsList]
  showHistory.value = false
  imageData.value = null
  error.value = null
  recipes.value = []
  selectedRecipe.value = null
  currentView.value = 'results'
  pushHistoryState('results')
}

// ---------- Favorites Actions ----------
function openFavoriteRecipe(recipe: any) {
  selectedRecipe.value = recipe
  // Load image if needed
  if (!recipe.imageUrl) {
    loadRecipeImage(recipe)
  }
  showFavorites.value = false
  currentView.value = 'detail'
  pushHistoryState('detail')
}

// ---------- Paywall Actions ----------
function handlePaywallClose() {
  showPaywall.value = false
  forceCreditsMode.value = false
  forceLoginMode.value = false
}

async function handlePaywallBuy(packName: string) {
  purchaseLoading.value = true
  try {
    await buyCredits(packName)
  } catch (err: any) {
    console.error('Purchase error:', err)
  } finally {
    purchaseLoading.value = false
  }
}

async function handlePaywallSubscribe() {
  purchaseLoading.value = true
  try {
    await buySubscription()
  } catch (err: any) {
    console.error('Subscribe error:', err)
  } finally {
    purchaseLoading.value = false
  }
}

async function handlePaywallLoginGoogle() {
  await signInWithGoogle()
}

async function handlePaywallLoginApple() {
  await signInWithApple()
}

async function handlePaywallLoginEmail(email: string) {
  await signInWithEmail(email)
}

function handleVoluntaryLogin() {
  forceLoginMode.value = true
  forceCreditsMode.value = false
  showPaywall.value = true
}

// ---------- Profile Actions ----------
function openProfileSheet() {
  showProfile.value = true
  if (isLoggedIn.value) {
    fetchPurchases()
    fetchProfile()
  }
}

async function handleSignOut() {
  await signOut()
  showProfile.value = false
  goToCamera()
}

// ---------- Haptic Feedback ----------
function hapticFeedback() {
  if (!import.meta.client) return
  if (navigator.vibrate) {
    navigator.vibrate(10)
  }
}

// ---------- Favorite Image Lazy Loading ----------
const favoriteImageStates = ref<Record<string, { url: string | null; loaded: boolean }>>({})

async function loadFavoriteImage(recipe: any) {
  if (favoriteImageStates.value[recipe.name]) return
  favoriteImageStates.value[recipe.name] = { url: null, loaded: false }
  try {
    const url = await fetchRecipeImage(recipe)
    if (url) {
      favoriteImageStates.value[recipe.name] = { url, loaded: false }
    }
  } catch {
    // Silently fail
  }
}

function onFavoriteImageLoad(name: string) {
  if (favoriteImageStates.value[name]) {
    favoriteImageStates.value[name].loaded = true
  }
}

// Watch favorites panel open to lazy load images
watch(showFavorites, (open) => {
  if (open) {
    for (const recipe of favorites.value) {
      loadFavoriteImage(recipe)
    }
  }
})

// ---------- Watch current view changes ----------
watch(currentView, () => {
  saveSession()
})

// ---------- Lifecycle ----------
onMounted(async () => {
  // Initialize composables
  await initAuth()
  await initSettings()
  await initFavorites()
  await initHistory()

  // Restore session
  restoreSession()

  // Set up browser back button
  window.addEventListener('popstate', onPopState)

  // Replace initial state
  window.history.replaceState({ view: currentView.value }, '', '')
})

onUnmounted(() => {
  if (import.meta.client) {
    window.removeEventListener('popstate', onPopState)
  }
})

// Page head
useHead({
  title: 'Recipe Snap - AI Recipe Ideas from Your Ingredients'
})
</script>

<template>
  <div class="app">
    <!-- ========== HEADER ========== -->
    <header class="header">
      <div class="header-left">
        <button class="header-logo" @click="goToCamera">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z" />
            <path d="M8 14s1.5 2 4 2 4-2 4-2" />
            <line x1="9" y1="9" x2="9.01" y2="9" />
            <line x1="15" y1="9" x2="15.01" y2="9" />
          </svg>
          <span class="header-title">Recipe Snap</span>
        </button>
      </div>
      <div class="header-right">
        <button
          v-if="currentView !== 'landing'"
          class="header-btn"
          title="About"
          @click="goToLanding"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10" />
            <path d="M12 16v-4" />
            <path d="M12 8h.01" />
          </svg>
        </button>
        <button
          class="header-btn"
          title="History"
          @click="showHistory = true"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
        </button>
        <button
          class="header-btn"
          title="Saved Recipes"
          @click="showFavorites = true"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
          </svg>
          <span v-if="favorites.length" class="header-badge">{{ favorites.length }}</span>
        </button>
        <button
          class="header-btn"
          title="Settings"
          @click="showSettings = true"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
        </button>
        <button
          v-if="!isLoggedIn"
          class="header-btn header-btn-signin"
          @click="handleVoluntaryLogin"
        >
          Sign in
        </button>
        <button
          v-else
          class="header-btn header-avatar-btn"
          @click="openProfileSheet"
        >
          <div class="header-avatar">
            {{ user?.email?.charAt(0).toUpperCase() || '?' }}
          </div>
        </button>
      </div>
    </header>

    <!-- ========== HIDDEN FILE INPUT ========== -->
    <input
      ref="fileInput"
      type="file"
      accept="image/*"
      capture="environment"
      class="hidden-file-input"
      @change="onFileSelected"
    />

    <!-- ========== LANDING VIEW ========== -->
    <div v-if="currentView === 'landing'" class="landing">
      <div class="landing-hero">
        <div class="landing-icon">
          <svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
            <circle cx="12" cy="13" r="4" />
          </svg>
        </div>
        <h1 class="landing-title">Recipe Snap</h1>
        <p class="landing-subtitle">
          Snap a photo of your ingredients and get personalized recipe ideas instantly.
        </p>
      </div>

      <div class="landing-features">
        <div class="landing-feature">
          <div class="landing-feature-icon">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
              <circle cx="12" cy="13" r="4" />
            </svg>
          </div>
          <h3>Snap Your Ingredients</h3>
          <p>Take a photo of what you have in your fridge or pantry.</p>
        </div>
        <div class="landing-feature">
          <div class="landing-feature-icon">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2z" />
              <path d="M12 6v6l4 2" />
            </svg>
          </div>
          <h3>AI-Powered Recipes</h3>
          <p>Get personalized recipe suggestions tailored to your ingredients.</p>
        </div>
        <div class="landing-feature">
          <div class="landing-feature-icon">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
            </svg>
          </div>
          <h3>Save Favorites</h3>
          <p>Keep your best recipes saved for later and sync across devices.</p>
        </div>
      </div>

      <button class="landing-cta" @click="startApp">
        Get Started
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="5" y1="12" x2="19" y2="12" />
          <polyline points="12 5 19 12 12 19" />
        </svg>
      </button>

      <p class="landing-free-text">
        {{ FREE_SNAPS_LIMIT }} free snaps - no account required
      </p>
    </div>

    <!-- ========== CAMERA VIEW ========== -->
    <div v-if="currentView === 'camera'" class="camera-section">
      <div class="camera-intro">
        <h2 class="camera-title">What's in your kitchen?</h2>
        <p class="camera-subtitle">Snap a photo of your ingredients to discover recipe ideas.</p>
      </div>

      <!-- Animated Ingredients SVG -->
      <div class="animated-ingredients">
        <svg viewBox="0 0 200 200" class="ingredients-svg">
          <!-- Tomato -->
          <g class="ingredient-float" style="animation-delay: 0s">
            <circle cx="50" cy="60" r="18" fill="#e74c3c" opacity="0.9" />
            <path d="M50 42 Q48 38 45 40 Q42 42 44 46" fill="#27ae60" stroke="none" />
            <path d="M50 42 Q52 38 55 40 Q58 42 56 46" fill="#27ae60" stroke="none" />
          </g>
          <!-- Carrot -->
          <g class="ingredient-float" style="animation-delay: 0.5s">
            <path d="M140 50 L155 90 L145 90 Z" fill="#e67e22" opacity="0.9" />
            <path d="M140 50 Q138 44 135 48" fill="#27ae60" stroke="none" />
            <path d="M140 50 Q142 44 145 48" fill="#27ae60" stroke="none" />
          </g>
          <!-- Egg -->
          <g class="ingredient-float" style="animation-delay: 1s">
            <ellipse cx="100" cy="130" rx="16" ry="20" fill="#fdebd0" opacity="0.9" />
          </g>
          <!-- Cheese -->
          <g class="ingredient-float" style="animation-delay: 1.5s">
            <path d="M30 130 L60 130 L45 155 Z" fill="#f1c40f" opacity="0.9" />
            <circle cx="42" cy="138" r="2" fill="#e6b800" />
            <circle cx="50" cy="142" r="1.5" fill="#e6b800" />
          </g>
          <!-- Broccoli -->
          <g class="ingredient-float" style="animation-delay: 2s">
            <circle cx="155" cy="140" r="10" fill="#27ae60" opacity="0.9" />
            <circle cx="148" cy="135" r="8" fill="#2ecc71" opacity="0.9" />
            <circle cx="162" cy="135" r="8" fill="#2ecc71" opacity="0.9" />
            <rect x="153" y="148" width="4" height="10" fill="#27ae60" rx="2" />
          </g>
          <!-- Onion -->
          <g class="ingredient-float" style="animation-delay: 0.8s">
            <ellipse cx="95" cy="55" rx="14" ry="12" fill="#d4a574" opacity="0.9" />
            <path d="M95 43 Q93 38 95 36 Q97 38 95 43" fill="#8B7355" stroke="none" />
          </g>
        </svg>
      </div>

      <button class="camera-btn" @click="openCamera">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
          <circle cx="12" cy="13" r="4" />
        </svg>
        Snap Ingredients
      </button>

      <p class="snaps-remaining">{{ snapsDisplay }}</p>

      <!-- Active Filters Display -->
      <div v-if="activeFilterNames.length" class="active-filters">
        <span
          v-for="name in activeFilterNames"
          :key="name"
          class="active-filter-chip"
        >
          {{ name }}
        </span>
      </div>

      <!-- History Chips -->
      <div v-if="searchHistory.length" class="history-chips">
        <p class="history-chips-label">Recent searches:</p>
        <div class="history-chips-list">
          <button
            v-for="entry in searchHistory.slice(0, 3)"
            :key="entry.id"
            class="history-chip"
            @click="loadFromHistory(entry)"
          >
            {{ entry.ingredients.slice(0, 3).join(', ') }}
            <span v-if="entry.ingredients.length > 3" class="history-chip-more">
              +{{ entry.ingredients.length - 3 }}
            </span>
          </button>
        </div>
      </div>
    </div>

    <!-- ========== PREVIEW VIEW ========== -->
    <div v-if="currentView === 'preview'" class="preview-section">
      <div class="preview-image-container">
        <img
          v-if="imageData"
          :src="imageData"
          alt="Captured ingredients"
          class="preview-image"
        />
      </div>

      <!-- Error Display -->
      <div v-if="error" class="error-container">
        <div v-if="isNoIngredientsError" class="no-ingredients-notice">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <circle cx="12" cy="12" r="10" />
            <path d="M16 16s-1.5-2-4-2-4 2-4 2" />
            <line x1="9" y1="9" x2="9.01" y2="9" />
            <line x1="15" y1="9" x2="15.01" y2="9" />
          </svg>
          <h3>No ingredients found</h3>
          <p>We couldn't detect any food ingredients in this photo. Try taking a clearer photo of food items like fruits, vegetables, meats, or pantry staples.</p>
        </div>
        <div v-else class="error-message">
          <p>{{ error }}</p>
        </div>
      </div>

      <div class="preview-actions">
        <button class="preview-btn preview-btn-secondary" @click="goToCamera">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
            <circle cx="12" cy="13" r="4" />
          </svg>
          Retake
        </button>
        <button class="preview-btn preview-btn-primary" @click="findRecipes">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          Find Recipes
        </button>
      </div>
    </div>

    <!-- ========== LOADING VIEW ========== -->
    <div v-if="currentView === 'loading'" class="loading-section">
      <div class="loading-spinner">
        <div class="spinner" />
      </div>
      <p class="loading-text">{{ loadingProgress }}</p>
    </div>

    <!-- ========== RESULTS VIEW ========== -->
    <div v-if="currentView === 'results' && !selectedRecipe" class="results-section">
      <div class="results-header">
        <button class="back-link" @click="goToCamera">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
          New Scan
        </button>
      </div>

      <!-- Editable Ingredients List -->
      <div class="ingredients-section">
        <div class="ingredients-header">
          <h3>Detected Ingredients</h3>
          <button class="ingredients-add-btn" @click="showAddIngredient">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Add
          </button>
        </div>

        <div class="ingredients-list">
          <div
            v-for="(item, index) in ingredients"
            :key="index"
            class="ingredient-item"
          >
            <template v-if="editingIngredient === index">
              <input
                v-model="editingValue"
                class="ingredient-edit-input"
                @keyup.enter="saveEditIngredient"
                @keyup.escape="cancelEditIngredient"
              />
              <button class="ingredient-action-btn save" @click="saveEditIngredient">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </button>
              <button class="ingredient-action-btn cancel" @click="cancelEditIngredient">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </template>
            <template v-else>
              <span class="ingredient-name" @click="startEditIngredient(index)">{{ item }}</span>
              <button class="ingredient-action-btn edit" @click="startEditIngredient(index)">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                </svg>
              </button>
              <button class="ingredient-action-btn remove" @click="removeIngredient(index)">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </template>
          </div>

          <!-- Add Ingredient Input -->
          <div v-if="showAddInput" class="ingredient-item ingredient-add-item">
            <input
              v-model="newIngredientValue"
              class="ingredient-edit-input"
              placeholder="Add an ingredient..."
              @keyup.enter="addIngredient"
              @keyup.escape="cancelAddIngredient"
            />
            <button class="ingredient-action-btn save" @click="addIngredient">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </button>
            <button class="ingredient-action-btn cancel" @click="cancelAddIngredient">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        </div>

        <button class="regenerate-btn" @click="handleRegenerate">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="23 4 23 10 17 10" />
            <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
          </svg>
          Regenerate Recipes
        </button>
      </div>

      <!-- Error Display -->
      <div v-if="error" class="error-container results-error">
        <p>{{ error }}</p>
      </div>

      <!-- Recipe Cards -->
      <div class="recipe-cards">
        <RecipeCard
          v-for="recipe in recipes"
          :key="recipe.name"
          :recipe="recipe"
          :is-favorite="isFavorite(recipe)"
          @click="openRecipeDetail(recipe)"
          @toggle-favorite="handleToggleFavorite(recipe)"
        />
      </div>
    </div>

    <!-- ========== DETAIL VIEW ========== -->
    <div v-if="currentView === 'detail' && selectedRecipe" class="detail-section">
      <RecipeDetail
        :recipe="selectedRecipe"
        :is-favorite="isFavorite(selectedRecipe)"
        :servings="servings"
        @back="closeRecipeDetail"
        @toggle-favorite="handleToggleFavorite(selectedRecipe)"
        @share="handleShare"
        @update:servings="servings = $event"
      />
    </div>

    <!-- ========== FAVORITES SLIDEOVER ========== -->
    <USlideover v-model:open="showFavorites" title="Saved Recipes">
      <template #body>
        <div class="sheet-content">
          <div v-if="!favorites.length" class="empty-state">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
            </svg>
            <p>No saved recipes yet</p>
            <p class="empty-state-hint">Tap the heart icon on any recipe to save it here.</p>
          </div>
          <div v-else class="favorites-list">
            <div
              v-for="recipe in favorites"
              :key="recipe.name"
              class="favorite-item"
              @click="openFavoriteRecipe(recipe)"
            >
              <div class="favorite-image-container">
                <div
                  v-if="!favoriteImageStates[recipe.name]?.loaded"
                  class="skeleton-image small"
                />
                <img
                  v-if="favoriteImageStates[recipe.name]?.url"
                  :src="favoriteImageStates[recipe.name].url!"
                  :alt="recipe.name"
                  class="favorite-image"
                  :class="{ loaded: favoriteImageStates[recipe.name]?.loaded }"
                  @load="onFavoriteImageLoad(recipe.name)"
                />
              </div>
              <div class="favorite-info">
                <h4>{{ recipe.name }}</h4>
                <p>{{ recipe.time }} - {{ recipe.difficulty }}</p>
              </div>
              <button
                class="favorite-remove-btn"
                @click.stop="handleToggleFavorite(recipe)"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2">
                  <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </template>
    </USlideover>

    <!-- ========== HISTORY SLIDEOVER ========== -->
    <USlideover v-model:open="showHistory" title="Search History">
      <template #body>
        <div class="sheet-content">
          <div v-if="!searchHistory.length" class="empty-state">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
            <p>No search history yet</p>
            <p class="empty-state-hint">Your recent searches will appear here.</p>
          </div>
          <div v-else class="history-list">
            <div
              v-for="entry in searchHistory"
              :key="entry.id"
              class="history-item"
              @click="loadFromHistory(entry)"
            >
              <div class="history-item-ingredients">
                <span
                  v-for="ing in entry.ingredients.slice(0, 5)"
                  :key="ing"
                  class="history-ingredient-tag"
                >
                  {{ ing }}
                </span>
                <span v-if="entry.ingredients.length > 5" class="history-ingredient-more">
                  +{{ entry.ingredients.length - 5 }} more
                </span>
              </div>
              <div class="history-item-meta">
                <span>{{ entry.recipes?.length || 0 }} recipes</span>
                <span class="history-item-date">
                  {{ new Date(entry.timestamp || entry.id).toLocaleDateString() }}
                </span>
              </div>
            </div>
          </div>
        </div>
      </template>
    </USlideover>

    <!-- ========== SETTINGS SLIDEOVER ========== -->
    <USlideover v-model:open="showSettings" title="Settings">
      <template #body>
        <div class="sheet-content settings-content">
          <!-- Servings -->
          <div class="settings-group">
            <label class="settings-label">Default Servings</label>
            <div class="settings-servings">
              <button
                class="servings-btn"
                :disabled="servings <= 1"
                @click="servings = Math.max(1, servings - 1)"
              >
                -
              </button>
              <span class="servings-count">{{ servings }}</span>
              <button
                class="servings-btn"
                :disabled="servings >= 12"
                @click="servings = Math.min(12, servings + 1)"
              >
                +
              </button>
            </div>
          </div>

          <!-- Max Time -->
          <div class="settings-group">
            <label class="settings-label">Max Cooking Time</label>
            <div class="settings-time-options">
              <button
                class="time-option"
                :class="{ active: maxTime === 0 }"
                @click="maxTime = 0"
              >
                Any
              </button>
              <button
                class="time-option"
                :class="{ active: maxTime === 15 }"
                @click="maxTime = 15"
              >
                15 min
              </button>
              <button
                class="time-option"
                :class="{ active: maxTime === 30 }"
                @click="maxTime = 30"
              >
                30 min
              </button>
              <button
                class="time-option"
                :class="{ active: maxTime === 60 }"
                @click="maxTime = 60"
              >
                60 min
              </button>
            </div>
          </div>

          <!-- Language -->
          <div class="settings-group">
            <label class="settings-label">Recipe Language</label>
            <select v-model="language" class="settings-select">
              <option
                v-for="opt in languageOptions"
                :key="opt.value"
                :value="opt.value"
              >
                {{ opt.label }}
              </option>
            </select>
          </div>

          <!-- Dietary Filters -->
          <div class="settings-group">
            <label class="settings-label">Dietary Preferences</label>
            <div class="settings-toggles">
              <label class="toggle-row">
                <span>Vegetarian</span>
                <div class="toggle-switch" :class="{ active: dietaryFilters.vegetarian }" @click="dietaryFilters.vegetarian = !dietaryFilters.vegetarian">
                  <div class="toggle-thumb" />
                </div>
              </label>
              <label class="toggle-row">
                <span>Vegan</span>
                <div class="toggle-switch" :class="{ active: dietaryFilters.vegan }" @click="dietaryFilters.vegan = !dietaryFilters.vegan">
                  <div class="toggle-thumb" />
                </div>
              </label>
              <label class="toggle-row">
                <span>Gluten-Free</span>
                <div class="toggle-switch" :class="{ active: dietaryFilters.glutenFree }" @click="dietaryFilters.glutenFree = !dietaryFilters.glutenFree">
                  <div class="toggle-thumb" />
                </div>
              </label>
              <label class="toggle-row">
                <span>Dairy-Free</span>
                <div class="toggle-switch" :class="{ active: dietaryFilters.dairyFree }" @click="dietaryFilters.dairyFree = !dietaryFilters.dairyFree">
                  <div class="toggle-thumb" />
                </div>
              </label>
            </div>
          </div>

          <!-- Legal Links -->
          <div class="settings-group settings-legal">
            <button class="settings-legal-link" @click="legalModal = 'privacy'">
              Privacy Policy
            </button>
            <button class="settings-legal-link" @click="legalModal = 'terms'">
              Terms of Service
            </button>
          </div>
        </div>
      </template>
    </USlideover>

    <!-- ========== PROFILE SLIDEOVER ========== -->
    <USlideover v-model:open="showProfile" title="Account">
      <template #body>
        <div class="sheet-content profile-content">
          <div class="profile-header">
            <div class="profile-avatar">
              {{ user?.email?.charAt(0).toUpperCase() || '?' }}
            </div>
            <p class="profile-email">{{ user?.email || 'Not signed in' }}</p>
          </div>

          <!-- Subscription Status -->
          <div class="profile-section">
            <h4>Subscription</h4>
            <div class="subscription-status">
              <div class="subscription-badge" :class="subscriptionStatus">
                {{ subscriptionLabel }}
              </div>
              <p v-if="subscriptionStatus === 'active' || subscriptionStatus === 'canceled'" class="subscription-period">
                {{ subscriptionStatus === 'canceled' ? 'Access until' : 'Renews' }}:
                {{ subscriptionPeriodEnd ? new Date(subscriptionPeriodEnd).toLocaleDateString() : 'N/A' }}
              </p>
            </div>
            <button
              v-if="subscriptionStatus === 'active' || subscriptionStatus === 'canceled'"
              class="profile-manage-btn"
              @click="openCustomerPortal"
            >
              Manage Subscription
            </button>
            <button
              v-else
              class="profile-manage-btn profile-subscribe-btn"
              @click="handlePaywallSubscribe"
            >
              Subscribe - {{ SUBSCRIPTION.credits }} snaps/mo for {{ SUBSCRIPTION.price }}
            </button>
          </div>

          <!-- Credits -->
          <div class="profile-section">
            <h4>Credits</h4>
            <div class="credits-display">
              <div v-if="hasActiveSubscription" class="credit-row">
                <span>Subscription credits</span>
                <span class="credit-count">{{ subscriptionCredits }}</span>
              </div>
              <div class="credit-row">
                <span>Purchased credits</span>
                <span class="credit-count">{{ credits }}</span>
              </div>
              <div class="credit-row credit-row-total">
                <span>Total</span>
                <span class="credit-count">{{ totalCredits }}</span>
              </div>
            </div>
            <button
              class="profile-manage-btn"
              @click="() => { showProfile = false; forceCreditsMode = true; forceLoginMode = false; showPaywall = true; }"
            >
              Buy More Credits
            </button>
          </div>

          <!-- Purchase History -->
          <div class="profile-section">
            <h4>Purchase History</h4>
            <div v-if="purchasesLoading" class="purchase-loading">
              Loading...
            </div>
            <div v-else-if="!purchases.length" class="empty-state small">
              <p>No purchases yet</p>
            </div>
            <div v-else class="purchase-list">
              <div
                v-for="purchase in purchases"
                :key="purchase.id"
                class="purchase-item"
              >
                <div class="purchase-info">
                  <span class="purchase-desc">{{ purchase.description || 'Credit Purchase' }}</span>
                  <span class="purchase-date">{{ new Date(purchase.created_at).toLocaleDateString() }}</span>
                </div>
                <span class="purchase-amount">+{{ purchase.credits }} credits</span>
              </div>
            </div>
          </div>

          <!-- Sign Out -->
          <button class="profile-signout-btn" @click="handleSignOut">
            Sign Out
          </button>
        </div>
      </template>
    </USlideover>

    <!-- ========== FAB BUTTON ========== -->
    <button
      v-if="(currentView === 'results' || currentView === 'detail') && !showFavorites && !showHistory && !showSettings && !showProfile"
      class="fab-btn"
      title="New Scan"
      @click="openCamera"
    >
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
        <circle cx="12" cy="13" r="4" />
      </svg>
    </button>

    <!-- ========== PAYWALL MODAL ========== -->
    <PaywallModal
      v-if="showPaywall"
      v-model="showPaywall"
      :needs-login="forceLoginMode || needsLogin"
      :needs-credits="forceCreditsMode || needsCredits"
      :loading="purchaseLoading"
      :voluntary-login="forceLoginMode && !needsLogin"
      @close="handlePaywallClose"
      @login-google="handlePaywallLoginGoogle"
      @login-apple="handlePaywallLoginApple"
      @login-email="handlePaywallLoginEmail"
      @buy="handlePaywallBuy"
      @subscribe="handlePaywallSubscribe"
    />

    <!-- ========== LEGAL MODAL ========== -->
    <LegalModal
      v-if="legalModal"
      :type="(legalModal as 'privacy' | 'terms')"
      @close="legalModal = null"
    />
  </div>
</template>

<style scoped>
/* Hidden file input */
.hidden-file-input {
  display: none;
}
</style>
