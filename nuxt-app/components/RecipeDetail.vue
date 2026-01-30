<script setup lang="ts">
interface Recipe {
  name: string
  time: string
  difficulty: string
  description: string
  imageUrl?: string | null
  imageLargeUrl?: string | null
  imageLoading?: boolean
  imageLoaded?: boolean
  ingredients: string[]
  steps: string[]
  suggestedAdditions?: string[]
}

const props = defineProps<{
  recipe: Recipe
  isFavorite: boolean
  servings: number
}>()

const emit = defineEmits<{
  back: []
  'toggle-favorite': []
  share: []
  'update:servings': [value: number]
}>()

const scaleIngredient = (ingredient: string, originalServings = 2) => {
  const ratio = props.servings / originalServings
  return ingredient.replace(/(\d+\/\d+|\d+\.?\d*)/g, (match) => {
    if (match.includes('/')) {
      const [num, den] = match.split('/')
      const result = (parseInt(num) / parseInt(den)) * ratio
      return result % 1 === 0 ? result.toString() : result.toFixed(1)
    }
    const result = parseFloat(match) * ratio
    return result % 1 === 0 ? result.toString() : result.toFixed(1)
  })
}

const decrementServings = () => {
  if (props.servings > 1) emit('update:servings', props.servings - 1)
}

const incrementServings = () => {
  if (props.servings < 12) emit('update:servings', props.servings + 1)
}
</script>

<template>
  <div class="recipe-detail">
    <button class="back-btn" @click="emit('back')">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M19 12H5M12 19l-7-7 7-7"/>
      </svg>
      Back
    </button>

    <div class="recipe-detail-image-container">
      <div v-if="!recipe.imageUrl" class="skeleton-image detail"></div>
      <img
        v-if="recipe.imageUrl"
        :src="recipe.imageLargeUrl || recipe.imageUrl"
        :alt="recipe.name"
        class="recipe-detail-image"
      />
    </div>

    <div class="recipe-detail-header">
      <h2>{{ recipe.name }}</h2>
      <div class="recipe-detail-actions">
        <button
          class="action-btn"
          :class="{ active: isFavorite }"
          @click="emit('toggle-favorite')"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" :fill="isFavorite ? 'currentColor' : 'none'" stroke="currentColor" stroke-width="2">
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
          </svg>
        </button>
        <button class="action-btn" @click="emit('share')">
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
      <span>{{ recipe.time }}</span>
      <span>{{ recipe.difficulty }}</span>
    </div>

    <!-- Servings adjuster -->
    <div class="servings-adjuster">
      <span>Servings:</span>
      <button class="servings-btn" @click="decrementServings">-</button>
      <span class="servings-count">{{ servings }}</span>
      <button class="servings-btn" @click="incrementServings">+</button>
    </div>

    <h3>Ingredients</h3>
    <ul>
      <li v-for="ing in recipe.ingredients" :key="ing">{{ scaleIngredient(ing) }}</li>
    </ul>

    <h3>Instructions</h3>
    <ol>
      <li v-for="step in recipe.steps" :key="step">{{ step }}</li>
    </ol>

    <!-- Suggested Additions -->
    <div v-if="recipe.suggestedAdditions?.length" class="suggested-additions">
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
        <span v-for="item in recipe.suggestedAdditions" :key="item" class="suggestion-tag">
          {{ item }}
        </span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.recipe-detail {
  padding: 1rem;
}

.back-btn {
  background: none;
  border: none;
  color: var(--primary);
  font-size: 1rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 1rem;
}

.recipe-detail-image-container {
  position: relative;
  width: 100%;
  height: 220px;
  margin-bottom: 1rem;
  border-radius: 12px;
  overflow: hidden;
  background: var(--border);
}

.skeleton-image.detail {
  position: absolute;
  inset: 0;
  background: linear-gradient(90deg, var(--border) 25%, var(--card-bg) 50%, var(--border) 75%);
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
  border-radius: 12px;
}

@keyframes shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

.recipe-detail-image {
  width: 100%;
  height: 220px;
  object-fit: cover;
  border-radius: 12px;
  background: var(--border);
}

.recipe-detail-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 0.5rem;
}

.recipe-detail-header h2 {
  font-size: 1.5rem;
  flex: 1;
  margin: 0;
}

.recipe-detail-actions {
  display: flex;
  gap: 0.5rem;
}

.action-btn {
  background: var(--card-bg);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 0.5rem;
  color: var(--text-light);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}

.action-btn:hover {
  background: var(--border);
}

.action-btn.active {
  color: #e91e63;
  border-color: #e91e63;
}

.recipe-meta {
  display: flex;
  gap: 1rem;
  color: var(--text-light);
  font-size: 0.85rem;
  margin-bottom: 0.5rem;
}

.servings-adjuster {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin: 1rem 0;
  padding: 0.75rem;
  background: var(--card-bg);
  border-radius: 8px;
  border: 1px solid var(--border);
}

.servings-btn {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  border: 1px solid var(--border);
  background: var(--card-bg);
  color: var(--text);
  font-size: 1.25rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}

.servings-btn:hover {
  background: var(--primary);
  color: white;
  border-color: var(--primary);
}

.servings-count {
  font-weight: 600;
  min-width: 2rem;
  text-align: center;
}

.recipe-detail h3 {
  font-size: 1.1rem;
  margin: 1.5rem 0 0.75rem;
  color: var(--primary-dark, #00897B);
}

.recipe-detail ul {
  padding-left: 1.25rem;
}

.recipe-detail li {
  margin-bottom: 0.5rem;
  line-height: 1.5;
}

.recipe-detail ol {
  padding-left: 1.25rem;
}

.recipe-detail ol li {
  margin-bottom: 1rem;
}

.suggested-additions {
  margin-top: 2rem;
  padding: 1rem;
  background: linear-gradient(135deg, rgba(38, 166, 154, 0.12), rgba(38, 166, 154, 0.06));
  border-radius: 12px;
  border: 1px solid rgba(38, 166, 154, 0.3);
}

.suggested-additions h4 {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.95rem;
  font-weight: 600;
  color: var(--primary);
  margin-bottom: 0.5rem;
}

.suggestions-hint {
  font-size: 0.85rem;
  color: var(--text-light);
  margin-bottom: 0.75rem;
}

.suggestions-list {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.suggestion-tag {
  background: var(--primary);
  color: white;
  padding: 0.4rem 0.75rem;
  border-radius: 20px;
  font-size: 0.85rem;
  font-weight: 500;
}
</style>
