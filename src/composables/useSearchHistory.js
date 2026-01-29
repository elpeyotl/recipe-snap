import { ref, watch } from 'vue'
import { supabase } from '../services/supabase'
import { useAuth } from './useAuth'

const STORAGE_KEY = 'recipesnap_history'
const MAX_LOCAL = 3
const MAX_CLOUD = 10

// Shared state (singleton)
const searchHistory = ref([])
let initialized = false

export function useSearchHistory() {
  const { isLoggedIn, user } = useAuth()

  function loadFromLocalStorage() {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) {
      try { searchHistory.value = JSON.parse(saved) } catch (e) { /* ignore */ }
    }
  }

  function saveToLocalStorage() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(searchHistory.value.slice(0, MAX_LOCAL)))
  }

  async function fetchFromCloud() {
    if (!supabase || !user.value) return []

    const { data, error } = await supabase
      .from('search_history')
      .select('*')
      .eq('user_id', user.value.id)
      .order('created_at', { ascending: false })
      .limit(MAX_CLOUD)

    if (error) {
      console.error('Failed to fetch search history:', error)
      return []
    }

    return data.map(row => ({
      id: new Date(row.created_at).getTime(),
      ingredients: row.ingredients,
      recipes: row.recipes,
      timestamp: new Date(row.created_at).getTime()
    }))
  }

  async function mergeWithCloud() {
    if (!isLoggedIn.value) return

    try {
      const cloudHistory = await fetchFromCloud()
      const localHistory = [...searchHistory.value]

      // Union: start with cloud, add missing locals by ingredients signature
      const merged = [...cloudHistory]
      for (const local of localHistory) {
        const sig = local.ingredients.join(',')
        if (!merged.find(h => h.ingredients.join(',') === sig)) {
          merged.push(local)
          await addToCloud(local)
        }
      }

      searchHistory.value = merged
        .sort((a, b) => (b.timestamp || b.id) - (a.timestamp || a.id))
        .slice(0, MAX_CLOUD)

      saveToLocalStorage()
    } catch (err) {
      console.error('History sync error:', err)
    }
  }

  async function addToCloud(entry) {
    if (!supabase || !user.value) return

    const { error } = await supabase
      .from('search_history')
      .insert({
        user_id: user.value.id,
        ingredients: entry.ingredients,
        recipes: entry.recipes
      })

    if (error) console.error('Failed to save search history:', error)

    // Cleanup old entries beyond MAX_CLOUD
    await cleanupOld()
  }

  async function cleanupOld() {
    if (!supabase || !user.value) return

    const { data } = await supabase
      .from('search_history')
      .select('id, created_at')
      .eq('user_id', user.value.id)
      .order('created_at', { ascending: false })

    if (data && data.length > MAX_CLOUD) {
      const toDelete = data.slice(MAX_CLOUD).map(row => row.id)
      await supabase.from('search_history').delete().in('id', toDelete)
    }
  }

  async function addToHistory(ingredients, recipes) {
    if (!ingredients.length || !recipes.length) return

    const entry = {
      id: Date.now(),
      ingredients: [...ingredients],
      recipes: recipes.map(({ imageUrl, imageLoading, imageLoaded, ...rest }) => rest),
      timestamp: Date.now()
    }

    // Remove duplicate by ingredients signature
    const sig = entry.ingredients.join(',')
    const filtered = searchHistory.value.filter(h => h.ingredients.join(',') !== sig)

    searchHistory.value = [entry, ...filtered].slice(0, MAX_CLOUD)
    saveToLocalStorage()

    if (isLoggedIn.value) await addToCloud(entry)
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
    searchHistory,
    addToHistory,
    init
  }
}
