import { ref, watch } from 'vue'
import { supabase } from '../services/supabase'
import { useAuth } from './useAuth'

const STORAGE_KEY = 'recipesnap_favorites'

// Shared state (singleton)
const favorites = ref([])
let initialized = false

export function useFavorites() {
  const { isLoggedIn, user } = useAuth()

  function loadFromLocalStorage() {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) {
      try { favorites.value = JSON.parse(saved) } catch (e) { /* ignore */ }
    }
  }

  function stripImageData({ imageUrl, imageLoading, imageLoaded, ...rest }) {
    return rest
  }

  function saveToLocalStorage() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(favorites.value.map(stripImageData)))
  }

  async function fetchFromCloud() {
    if (!supabase || !user.value) return []

    const { data, error } = await supabase
      .from('favorites')
      .select('*')
      .eq('user_id', user.value.id)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Failed to fetch favorites:', error)
      return []
    }

    return data.map(row => ({
      ...row.recipe_data,
      savedAt: new Date(row.created_at).getTime()
    }))
  }

  async function mergeWithCloud() {
    if (!isLoggedIn.value) return

    try {
      const cloudFavorites = await fetchFromCloud()
      const localFavorites = [...favorites.value]

      // Union: start with cloud, add missing locals
      const merged = [...cloudFavorites]
      for (const local of localFavorites) {
        if (!merged.find(f => f.name === local.name)) {
          merged.push(local)
          await addToCloud(local)
        }
      }

      favorites.value = merged.sort((a, b) => (b.savedAt || 0) - (a.savedAt || 0))
      saveToLocalStorage()
    } catch (err) {
      console.error('Favorites sync error:', err)
    }
  }

  async function addToCloud(recipe) {
    if (!supabase || !user.value) return

    const { error } = await supabase
      .from('favorites')
      .upsert({
        user_id: user.value.id,
        recipe_name: recipe.name,
        recipe_data: stripImageData(recipe)
      }, { onConflict: 'user_id,recipe_name' })

    if (error) console.error('Failed to save favorite:', error)
  }

  async function removeFromCloud(recipeName) {
    if (!supabase || !user.value) return

    const { error } = await supabase
      .from('favorites')
      .delete()
      .eq('user_id', user.value.id)
      .eq('recipe_name', recipeName)

    if (error) console.error('Failed to remove favorite:', error)
  }

  function isFavorite(recipe) {
    return favorites.value.some(f => f.name === recipe.name)
  }

  async function toggleFavorite(recipe) {
    const index = favorites.value.findIndex(f => f.name === recipe.name)

    if (index >= 0) {
      favorites.value.splice(index, 1)
      if (isLoggedIn.value) removeFromCloud(recipe.name)
    } else {
      const entry = { ...recipe, savedAt: Date.now() }
      favorites.value.unshift(entry)
      if (isLoggedIn.value) addToCloud(entry)
    }

    saveToLocalStorage()
  }

  async function init() {
    if (initialized) return
    initialized = true

    loadFromLocalStorage()

    watch(() => isLoggedIn.value, async (loggedIn) => {
      if (loggedIn) await mergeWithCloud()
    }, { immediate: true })
  }

  return {
    favorites,
    isFavorite,
    toggleFavorite,
    init
  }
}
