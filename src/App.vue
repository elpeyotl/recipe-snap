<script setup>
import { ref, computed } from 'vue'
import { analyzeImage } from './api/gemini'

// App state
const currentView = ref('camera') // camera, preview, loading, results, detail
const imageData = ref(null)
const ingredients = ref([])
const recipes = ref([])
const selectedRecipe = ref(null)
const error = ref(null)

// File input ref
const fileInput = ref(null)

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

  try {
    const result = await analyzeImage(imageData.value)
    ingredients.value = result.ingredients
    recipes.value = result.recipes
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
</script>

<template>
  <div class="app">
    <!-- Header -->
    <header class="header">
      <h1>Recipe Snap</h1>
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
      <button class="camera-btn" @click="openCamera">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
          <circle cx="12" cy="13" r="4"/>
        </svg>
      </button>
      <p class="camera-hint">Tap to snap your ingredients</p>
    </div>

    <!-- Preview View -->
    <div v-if="currentView === 'preview'" class="preview-section container">
      <img :src="imageData" alt="Preview" class="preview-image" />

      <div v-if="error" class="error">{{ error }}</div>

      <div class="preview-actions">
        <button class="btn btn-secondary" @click="resetCamera">Retake</button>
        <button class="btn btn-primary" @click="analyzeIngredients">Find Recipes</button>
      </div>
    </div>

    <!-- Loading View -->
    <div v-if="currentView === 'loading'" class="loading">
      <div class="spinner"></div>
      <p>Analyzing ingredients...</p>
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
        <div
          v-for="recipe in recipes"
          :key="recipe.name"
          class="recipe-card"
          @click="viewRecipe(recipe)"
        >
          <h3 class="recipe-name">{{ recipe.name }}</h3>
          <div class="recipe-meta">
            <span>{{ recipe.time }}</span>
            <span>{{ recipe.difficulty }}</span>
          </div>
          <p class="recipe-description">{{ recipe.description }}</p>
        </div>
      </div>

      <!-- New Photo Button -->
      <button class="new-photo-btn" @click="resetCamera">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
          <circle cx="12" cy="13" r="4"/>
        </svg>
      </button>
    </div>

    <!-- Recipe Detail View -->
    <div v-if="currentView === 'detail'" class="recipe-detail container">
      <button class="back-btn" @click="backToResults">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M19 12H5M12 19l-7-7 7-7"/>
        </svg>
        Back to recipes
      </button>

      <h2>{{ selectedRecipe.name }}</h2>
      <div class="recipe-meta">
        <span>{{ selectedRecipe.time }}</span>
        <span>{{ selectedRecipe.difficulty }}</span>
      </div>

      <h3>Ingredients</h3>
      <ul>
        <li v-for="ing in selectedRecipe.ingredients" :key="ing">{{ ing }}</li>
      </ul>

      <h3>Instructions</h3>
      <ol>
        <li v-for="step in selectedRecipe.steps" :key="step">{{ step }}</li>
      </ol>

      <!-- New Photo Button -->
      <button class="new-photo-btn" @click="resetCamera">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
          <circle cx="12" cy="13" r="4"/>
        </svg>
      </button>
    </div>
  </div>
</template>
