const STORAGE_KEY = 'recipesnap_favorites'

// Shared state (singleton)
const favorites = ref<any[]>([])
let favInitialized = false

export function useFavorites() {
  const supabase = useSupabase()
  const { isLoggedIn, user } = useAuth()

  function loadFromLocalStorage() {
    if (!import.meta.client) return
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) {
      try { favorites.value = JSON.parse(saved) } catch { /* ignore */ }
    }
  }

  function stripImageData({ imageUrl, imageLoading, imageLoaded, ...rest }: any) {
    return rest
  }

  function saveToLocalStorage() {
    if (!import.meta.client) return
    localStorage.setItem(STORAGE_KEY, JSON.stringify(favorites.value.map(stripImageData)))
  }

  async function fetchFromCloud(): Promise<any[]> {
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

    return data.map((row: any) => ({
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
        if (!merged.find((f: any) => f.name === local.name)) {
          merged.push(local)
          await addToCloud(local)
        }
      }

      favorites.value = merged.sort((a: any, b: any) => (b.savedAt || 0) - (a.savedAt || 0))
      saveToLocalStorage()
    } catch (err) {
      console.error('Favorites sync error:', err)
    }
  }

  async function addToCloud(recipe: any) {
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

  async function removeFromCloud(recipeName: string) {
    if (!supabase || !user.value) return

    const { error } = await supabase
      .from('favorites')
      .delete()
      .eq('user_id', user.value.id)
      .eq('recipe_name', recipeName)

    if (error) console.error('Failed to remove favorite:', error)
  }

  function isFavorite(recipe: any): boolean {
    return favorites.value.some((f: any) => f.name === recipe.name)
  }

  async function toggleFavorite(recipe: any) {
    const index = favorites.value.findIndex((f: any) => f.name === recipe.name)

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
    if (favInitialized) return
    favInitialized = true

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
