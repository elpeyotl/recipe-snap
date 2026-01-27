<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { analyzeImage } from './api/gemini'
import { fetchRecipeImage } from './api/imageGen'

// App state
const currentView = ref('camera') // camera, preview, loading, results, detail, favorites, settings
const imageData = ref(null)
const ingredients = ref([])
const recipes = ref([])
const selectedRecipe = ref(null)
const error = ref(null)
const loadingProgress = ref('')
const previousView = ref('camera') // Track where we came from

// File input ref
const fileInput = ref(null)

// Favorites
const favorites = ref([])

// Settings
const darkMode = ref(false)
const servings = ref(2)
const dietaryFilters = ref({
  vegetarian: false,
  vegan: false,
  glutenFree: false,
  dairyFree: false
})
const maxTime = ref(0) // 0 = no limit, otherwise minutes
const language = ref('en') // Recipe language

// Load settings from localStorage
onMounted(() => {
  const savedFavorites = localStorage.getItem('recipesnap_favorites')
  if (savedFavorites) favorites.value = JSON.parse(savedFavorites)

  const savedDarkMode = localStorage.getItem('recipesnap_darkmode')
  if (savedDarkMode) darkMode.value = JSON.parse(savedDarkMode)

  const savedFilters = localStorage.getItem('recipesnap_filters')
  if (savedFilters) dietaryFilters.value = JSON.parse(savedFilters)

  const savedServings = localStorage.getItem('recipesnap_servings')
  if (savedServings) servings.value = JSON.parse(savedServings)

  const savedMaxTime = localStorage.getItem('recipesnap_maxtime')
  if (savedMaxTime) maxTime.value = JSON.parse(savedMaxTime)

  const savedLanguage = localStorage.getItem('recipesnap_language')
  if (savedLanguage) language.value = savedLanguage

  // Apply dark mode
  if (darkMode.value) document.documentElement.classList.add('dark')
})

// Watch and save settings
watch(favorites, (val) => localStorage.setItem('recipesnap_favorites', JSON.stringify(val)), { deep: true })
watch(darkMode, (val) => {
  localStorage.setItem('recipesnap_darkmode', JSON.stringify(val))
  document.documentElement.classList.toggle('dark', val)
})
watch(dietaryFilters, (val) => localStorage.setItem('recipesnap_filters', JSON.stringify(val)), { deep: true })
watch(servings, (val) => localStorage.setItem('recipesnap_servings', JSON.stringify(val)))
watch(maxTime, (val) => localStorage.setItem('recipesnap_maxtime', JSON.stringify(val)))
watch(language, (val) => localStorage.setItem('recipesnap_language', val))

// Check if recipe is favorited
const isFavorite = (recipe) => favorites.value.some(f => f.name === recipe.name)

// Toggle favorite
const toggleFavorite = (recipe) => {
  const index = favorites.value.findIndex(f => f.name === recipe.name)
  if (index >= 0) {
    favorites.value.splice(index, 1)
  } else {
    favorites.value.push({ ...recipe, savedAt: Date.now() })
  }
}

// Get active filters as string for prompt
const activeFiltersText = computed(() => {
  const active = []
  if (dietaryFilters.value.vegetarian) active.push('vegetarian')
  if (dietaryFilters.value.vegan) active.push('vegan')
  if (dietaryFilters.value.glutenFree) active.push('gluten-free')
  if (dietaryFilters.value.dairyFree) active.push('dairy-free')
  return active.join(', ')
})

// Handle camera button click
const openCamera = () => {
  fileInput.value.click()
}

// Handle file selection
const handleFileSelect = (event) => {
  const file = event.target.files[0]
  if (!file) return

  const reader = new FileReader()
  reader.onload = (e) => {
    imageData.value = e.target.result
    currentView.value = 'preview'
  }
  reader.readAsDataURL(file)
}

// Analyze the image
const analyzeIngredients = async () => {
  currentView.value = 'loading'
  error.value = null
  loadingProgress.value = 'Analyzing ingredients...'

  try {
    const result = await analyzeImage(imageData.value, activeFiltersText.value, servings.value, maxTime.value, language.value)
    ingredients.value = result.ingredients

    loadingProgress.value = 'Generating recipe images...'

    // Fetch images for each recipe with progress
    const recipesWithImages = []
    for (let i = 0; i < result.recipes.length; i++) {
      loadingProgress.value = `Generating image ${i + 1} of ${result.recipes.length}...`
      const recipe = result.recipes[i]
      const imageUrl = await fetchRecipeImage(recipe)
      recipesWithImages.push({ ...recipe, imageUrl, imageLoaded: false })
    }

    recipes.value = recipesWithImages
    currentView.value = 'results'
  } catch (err) {
    error.value = err.message || 'Failed to analyze image'
    currentView.value = 'preview'
  }
}

// Reset to camera
const resetCamera = () => {
  currentView.value = 'camera'
  imageData.value = null
  ingredients.value = []
  recipes.value = []
  selectedRecipe.value = null
  error.value = null
  fileInput.value.value = ''
}

// View recipe detail
const viewRecipe = (recipe) => {
  selectedRecipe.value = recipe
  currentView.value = 'detail'
}

// Back to results
const backToResults = () => {
  currentView.value = 'results'
  selectedRecipe.value = null
}

// Share recipe
const shareRecipe = async (recipe) => {
  const text = `${recipe.name}\n\nIngredients:\n${recipe.ingredients.join('\n')}\n\nSteps:\n${recipe.steps.map((s, i) => `${i + 1}. ${s}`).join('\n')}`

  if (navigator.share) {
    try {
      await navigator.share({
        title: recipe.name,
        text: text
      })
    } catch (err) {
      // User cancelled or error
    }
  } else {
    // Fallback: copy to clipboard
    await navigator.clipboard.writeText(text)
    alert('Recipe copied to clipboard!')
  }
}

// Scale ingredient amount
const scaleIngredient = (ingredient, originalServings = 2) => {
  const ratio = servings.value / originalServings
  // Match numbers (including fractions like 1/2)
  return ingredient.replace(/(\d+\/\d+|\d+\.?\d*)/g, (match) => {
    if (match.includes('/')) {
      const [num, den] = match.split('/')
      const result = (parseInt(num) / parseInt(den)) * ratio
      return result % 1 === 0 ? result : result.toFixed(1)
    }
    const result = parseFloat(match) * ratio
    return result % 1 === 0 ? result : result.toFixed(1)
  })
}

// View favorites
const viewFavorites = () => {
  previousView.value = currentView.value
  currentView.value = 'favorites'
}

// View settings
const viewSettings = () => {
  previousView.value = currentView.value
  currentView.value = 'settings'
}

// View favorite recipe detail
const viewFavoriteRecipe = (recipe) => {
  selectedRecipe.value = recipe
  currentView.value = 'detail'
}

// Back from favorites/settings
const goBack = () => {
  // Go back to previous view, but not to loading/preview states
  const validViews = ['camera', 'results', 'detail']
  if (validViews.includes(previousView.value)) {
    currentView.value = previousView.value
  } else {
    currentView.value = 'camera'
  }
}

// Image loaded handler
const onImageLoad = (recipe) => {
  recipe.imageLoaded = true
}

// Haptic feedback for mobile
const haptic = (style = 'light') => {
  if ('vibrate' in navigator) {
    const patterns = {
      light: 10,
      medium: 20,
      heavy: 30
    }
    navigator.vibrate(patterns[style] || 10)
  }
}
</script>

<template>
  <div class="app" :class="{ dark: darkMode }">
    <!-- Header -->
    <header class="header">
      <div class="header-brand">
        <img src="/favicon.svg" alt="Recipe Snap" class="header-logo" />
        <h1>Recipe Snap</h1>
      </div>
      <div class="header-actions">
        <button class="header-btn" @click="viewFavorites" title="Favorites">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
          </svg>
        </button>
        <button class="header-btn" @click="viewSettings" title="Settings">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="3"/>
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
          </svg>
        </button>
      </div>
    </header>

    <!-- Hidden file input -->
    <input
      ref="fileInput"
      type="file"
      accept="image/*"
      capture="environment"
      class="hidden"
      @change="handleFileSelect"
    />

    <!-- Camera View -->
    <div v-if="currentView === 'camera'" class="camera-section">
      <div class="camera-intro">
        <h2>What's in your fridge?</h2>
        <p>Take a photo of your ingredients and get personalized recipe ideas</p>
      </div>

      <button class="camera-btn" @click="haptic('medium'); openCamera()">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
          <circle cx="12" cy="13" r="4"/>
        </svg>
      </button>
      <p class="camera-hint">Tap to snap your ingredients</p>

      <!-- Active filters indicator -->
      <div v-if="activeFiltersText || maxTime > 0" class="active-filters-section">
        <p class="filters-label">Active filters:</p>
        <div class="active-filters">
          <span v-if="activeFiltersText" class="filter-badge">{{ activeFiltersText }}</span>
          <span v-if="maxTime > 0" class="filter-badge">{{ maxTime }} min max</span>
        </div>
      </div>
    </div>

    <!-- Preview View -->
    <div v-if="currentView === 'preview'" class="preview-section container">
      <img :src="imageData" alt="Preview" class="preview-image" />

      <div v-if="error" class="error">
        <p>{{ error }}</p>
        <button class="btn btn-retry" @click="haptic(); analyzeIngredients()">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M23 4v6h-6M1 20v-6h6"/>
            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
          </svg>
          Try Again
        </button>
      </div>

      <div class="preview-actions">
        <button class="btn btn-secondary" @click="haptic(); resetCamera()">Retake</button>
        <button class="btn btn-primary" @click="haptic(); analyzeIngredients()">Find Recipes</button>
      </div>
    </div>

    <!-- Loading View -->
    <div v-if="currentView === 'loading'" class="loading">
      <div class="spinner"></div>
      <p>{{ loadingProgress }}</p>
    </div>

    <!-- Results View -->
    <div v-if="currentView === 'results'" class="container">
      <!-- Ingredients -->
      <div class="ingredients-section">
        <h2 class="ingredients-title">Detected Ingredients</h2>
        <div class="ingredients-list">
          <span
            v-for="ingredient in ingredients"
            :key="ingredient"
            class="ingredient-tag"
          >
            {{ ingredient }}
          </span>
        </div>
      </div>

      <!-- Recipes -->
      <div class="recipes-section">
        <h2 class="recipes-title">Recipe Ideas</h2>

        <!-- Empty state when no recipes found -->
        <div v-if="recipes.length === 0" class="empty-state">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M12 2L2 7l10 5 10-5-10-5z"/>
            <path d="M2 17l10 5 10-5"/>
            <path d="M2 12l10 5 10-5"/>
          </svg>
          <p>No recipes found</p>
          <p class="empty-hint">Try with different ingredients or adjust your filters</p>
        </div>

        <div
          v-else
          v-for="recipe in recipes"
          :key="recipe.name"
          class="recipe-card"
          @click="viewRecipe(recipe)"
        >
          <div class="recipe-image-container">
            <div v-if="!recipe.imageLoaded" class="skeleton-image"></div>
            <img
              :src="recipe.imageUrl"
              :alt="recipe.name"
              class="recipe-image"
              :class="{ loaded: recipe.imageLoaded }"
              loading="lazy"
              @load="onImageLoad(recipe)"
            />
          </div>
          <div class="recipe-card-content">
            <div class="recipe-card-header">
              <h3 class="recipe-name">{{ recipe.name }}</h3>
              <button
                class="favorite-btn"
                :class="{ active: isFavorite(recipe) }"
                @click.stop="haptic(); toggleFavorite(recipe)"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" :fill="isFavorite(recipe) ? 'currentColor' : 'none'" stroke="currentColor" stroke-width="2">
                  <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
                </svg>
              </button>
            </div>
            <div class="recipe-meta">
              <span>{{ recipe.time }}</span>
              <span>{{ recipe.difficulty }}</span>
            </div>
            <p class="recipe-description">{{ recipe.description }}</p>
          </div>
        </div>
      </div>

      <!-- Start Again Button -->
      <div class="start-again">
        <button class="start-again-btn" @click="haptic('medium'); resetCamera()">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
            <circle cx="12" cy="13" r="4"/>
          </svg>
          <span>Scan new ingredients</span>
        </button>
      </div>
    </div>

    <!-- Recipe Detail View -->
    <div v-if="currentView === 'detail' && selectedRecipe" class="recipe-detail container">
      <button class="back-btn" @click="backToResults">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M19 12H5M12 19l-7-7 7-7"/>
        </svg>
        Back
      </button>

      <img
        :src="selectedRecipe.imageLargeUrl || selectedRecipe.imageUrl"
        :alt="selectedRecipe.name"
        class="recipe-detail-image"
      />

      <div class="recipe-detail-header">
        <h2>{{ selectedRecipe.name }}</h2>
        <div class="recipe-detail-actions">
          <button
            class="action-btn"
            :class="{ active: isFavorite(selectedRecipe) }"
            @click="haptic(); toggleFavorite(selectedRecipe)"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" :fill="isFavorite(selectedRecipe) ? 'currentColor' : 'none'" stroke="currentColor" stroke-width="2">
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
            </svg>
          </button>
          <button class="action-btn" @click="haptic(); shareRecipe(selectedRecipe)">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="18" cy="5" r="3"/>
              <circle cx="6" cy="12" r="3"/>
              <circle cx="18" cy="19" r="3"/>
              <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/>
              <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
            </svg>
          </button>
        </div>
      </div>

      <div class="recipe-meta">
        <span>{{ selectedRecipe.time }}</span>
        <span>{{ selectedRecipe.difficulty }}</span>
      </div>

      <!-- Servings adjuster -->
      <div class="servings-adjuster">
        <span>Servings:</span>
        <button class="servings-btn" @click="servings = Math.max(1, servings - 1)">-</button>
        <span class="servings-count">{{ servings }}</span>
        <button class="servings-btn" @click="servings = Math.min(12, servings + 1)">+</button>
      </div>

      <h3>Ingredients</h3>
      <ul>
        <li v-for="ing in selectedRecipe.ingredients" :key="ing">{{ scaleIngredient(ing) }}</li>
      </ul>

      <h3>Instructions</h3>
      <ol>
        <li v-for="step in selectedRecipe.steps" :key="step">{{ step }}</li>
      </ol>

      <!-- Suggested Additions -->
      <div v-if="selectedRecipe.suggestedAdditions?.length" class="suggested-additions">
        <h4>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="8" x2="12" y2="16"/>
            <line x1="8" y1="12" x2="16" y2="12"/>
          </svg>
          Enhance with
        </h4>
        <p class="suggestions-hint">Adding these would make this dish even better:</p>
        <div class="suggestions-list">
          <span v-for="item in selectedRecipe.suggestedAdditions" :key="item" class="suggestion-tag">
            {{ item }}
          </span>
        </div>
      </div>

      <!-- Start Again Button -->
      <div class="start-again">
        <button class="start-again-btn" @click="haptic('medium'); resetCamera()">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
            <circle cx="12" cy="13" r="4"/>
          </svg>
          <span>Scan new ingredients</span>
        </button>
      </div>
    </div>

    <!-- Favorites View -->
    <div v-if="currentView === 'favorites'" class="container">
      <button class="back-btn" @click="goBack">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M19 12H5M12 19l-7-7 7-7"/>
        </svg>
        Back
      </button>

      <h2 class="section-title">Saved Recipes</h2>

      <div v-if="favorites.length === 0" class="empty-state">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
        </svg>
        <p>No saved recipes yet</p>
        <p class="empty-hint">Tap the heart icon on any recipe to save it</p>
      </div>

      <div
        v-for="recipe in favorites"
        :key="recipe.name"
        class="recipe-card"
        @click="viewFavoriteRecipe(recipe)"
      >
        <div class="recipe-image-container">
          <img
            :src="recipe.imageUrl"
            :alt="recipe.name"
            class="recipe-image loaded"
            loading="lazy"
          />
        </div>
        <div class="recipe-card-content">
          <div class="recipe-card-header">
            <h3 class="recipe-name">{{ recipe.name }}</h3>
            <button
              class="favorite-btn active"
              @click.stop="haptic(); toggleFavorite(recipe)"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2">
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
              </svg>
            </button>
          </div>
          <div class="recipe-meta">
            <span>{{ recipe.time }}</span>
            <span>{{ recipe.difficulty }}</span>
          </div>
          <p class="recipe-description">{{ recipe.description }}</p>
        </div>
      </div>
    </div>

    <!-- Settings View -->
    <div v-if="currentView === 'settings'" class="container">
      <button class="back-btn" @click="goBack">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M19 12H5M12 19l-7-7 7-7"/>
        </svg>
        Back
      </button>

      <h2 class="section-title">Settings</h2>

      <!-- Dark Mode -->
      <div class="setting-item">
        <div class="setting-info">
          <span class="setting-label">Dark Mode</span>
        </div>
        <label class="toggle">
          <input type="checkbox" v-model="darkMode" />
          <span class="toggle-slider"></span>
        </label>
      </div>

      <!-- Default Servings -->
      <div class="setting-item">
        <div class="setting-info">
          <span class="setting-label">Default Servings</span>
        </div>
        <div class="servings-adjuster compact">
          <button class="servings-btn" @click="servings = Math.max(1, servings - 1)">-</button>
          <span class="servings-count">{{ servings }}</span>
          <button class="servings-btn" @click="servings = Math.min(12, servings + 1)">+</button>
        </div>
      </div>

      <!-- Max Cooking Time -->
      <div class="setting-item">
        <div class="setting-info">
          <span class="setting-label">Max Cooking Time</span>
        </div>
        <select v-model="maxTime" class="time-select">
          <option :value="0">No limit</option>
          <option :value="15">15 minutes</option>
          <option :value="30">30 minutes</option>
          <option :value="45">45 minutes</option>
          <option :value="60">1 hour</option>
        </select>
      </div>

      <!-- Recipe Language -->
      <div class="setting-item">
        <div class="setting-info">
          <span class="setting-label">Recipe Language</span>
        </div>
        <select v-model="language" class="time-select">
          <option value="en">English</option>
          <option value="de">Deutsch</option>
          <option value="es">Español</option>
          <option value="fr">Français</option>
          <option value="it">Italiano</option>
          <option value="nl">Nederlands</option>
          <option value="pt">Português</option>
        </select>
      </div>

      <!-- Dietary Filters -->
      <h3 class="settings-subtitle">Dietary Preferences</h3>
      <p class="settings-hint">Recipes will be filtered based on your preferences</p>

      <div class="setting-item">
        <span class="setting-label">Vegetarian</span>
        <label class="toggle">
          <input type="checkbox" v-model="dietaryFilters.vegetarian" />
          <span class="toggle-slider"></span>
        </label>
      </div>

      <div class="setting-item">
        <span class="setting-label">Vegan</span>
        <label class="toggle">
          <input type="checkbox" v-model="dietaryFilters.vegan" />
          <span class="toggle-slider"></span>
        </label>
      </div>

      <div class="setting-item">
        <span class="setting-label">Gluten-Free</span>
        <label class="toggle">
          <input type="checkbox" v-model="dietaryFilters.glutenFree" />
          <span class="toggle-slider"></span>
        </label>
      </div>

      <div class="setting-item">
        <span class="setting-label">Dairy-Free</span>
        <label class="toggle">
          <input type="checkbox" v-model="dietaryFilters.dairyFree" />
          <span class="toggle-slider"></span>
        </label>
      </div>
    </div>
  </div>
</template>
