<script setup lang="ts">
interface Recipe {
  name: string
  time: string
  difficulty: string
  description: string
  imageUrl?: string | null
  imageLoading?: boolean
  imageLoaded?: boolean
  ingredients?: string[]
  steps?: string[]
  suggestedAdditions?: string[]
}

defineProps<{
  recipe: Recipe
  isFavorite: boolean
}>()

const emit = defineEmits<{
  click: []
  'toggle-favorite': []
}>()

const imageLoaded = ref(false)

const onImageLoad = () => {
  imageLoaded.value = true
}
</script>

<template>
  <div class="recipe-card" @click="emit('click')">
    <div class="recipe-image-container">
      <div v-if="!imageLoaded" class="skeleton-image" />
      <img
        v-if="recipe.imageUrl"
        :src="recipe.imageUrl"
        :alt="recipe.name"
        class="recipe-image"
        :class="{ loaded: imageLoaded }"
        loading="lazy"
        @load="onImageLoad"
      />
    </div>
    <div class="recipe-card-content">
      <div class="recipe-card-header">
        <h3 class="recipe-name">{{ recipe.name }}</h3>
        <button
          class="favorite-btn"
          :class="{ active: isFavorite }"
          @click.stop="emit('toggle-favorite')"
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            :fill="isFavorite ? 'currentColor' : 'none'"
            stroke="currentColor"
            stroke-width="2"
          >
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
          </svg>
        </button>
      </div>
      <div class="recipe-meta">
        <span class="recipe-meta-time">{{ recipe.time }}</span>
        <UBadge
          color="neutral"
          variant="subtle"
          size="sm"
        >
          {{ recipe.difficulty }}
        </UBadge>
      </div>
      <p class="recipe-description">{{ recipe.description }}</p>
    </div>
  </div>
</template>

<style scoped>
.recipe-card {
  background: var(--card-bg);
  border-radius: 0.75rem;
  overflow: hidden;
  cursor: pointer;
  transition: transform 0.2s, box-shadow 0.2s;
  border: 1px solid var(--border);
}

.recipe-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
}

.recipe-card:active {
  transform: scale(0.98);
}

.recipe-image-container {
  position: relative;
  width: 100%;
  aspect-ratio: 16 / 10;
  overflow: hidden;
  background: var(--bg);
}

.skeleton-image {
  position: absolute;
  inset: 0;
  background: linear-gradient(
    90deg,
    var(--card-bg) 25%,
    rgba(255, 255, 255, 0.08) 50%,
    var(--card-bg) 75%
  );
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
}

@keyframes shimmer {
  0% {
    background-position: 200% 0;
  }
  100% {
    background-position: -200% 0;
  }
}

.recipe-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
  opacity: 0;
  transition: opacity 0.3s ease;
}

.recipe-image.loaded {
  opacity: 1;
}

.recipe-card-content {
  padding: 1rem;
}

.recipe-card-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 0.5rem;
}

.recipe-name {
  font-size: 1.05rem;
  font-weight: 600;
  color: var(--text);
  margin: 0;
  line-height: 1.3;
}

.favorite-btn {
  flex-shrink: 0;
  background: none;
  border: none;
  cursor: pointer;
  padding: 0.25rem;
  color: var(--text-light);
  transition: color 0.2s, transform 0.2s;
}

.favorite-btn:hover {
  color: var(--text);
}

.favorite-btn.active {
  color: #ef4444;
}

.favorite-btn:active {
  transform: scale(1.2);
}

.recipe-meta {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin: 0.5rem 0;
}

.recipe-meta-time {
  font-size: 0.85rem;
  color: var(--text-light);
}

.recipe-description {
  font-size: 0.88rem;
  color: var(--text-light);
  line-height: 1.5;
  margin: 0;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>
