import { ref, watch } from 'vue'
import { supabase } from '../services/supabase'
import { useAuth } from './useAuth'

const darkMode = ref(true)
const servings = ref(2)
const dietaryFilters = ref({
  vegetarian: false,
  vegan: false,
  glutenFree: false,
  dairyFree: false
})
const maxTime = ref(0)
const language = ref('en')

let initialized = false
let syncing = false

export function useSettings() {
  const { isLoggedIn, user } = useAuth()

  function loadFromLocalStorage() {
    const saved = (key, fallback) => {
      const val = localStorage.getItem(key)
      if (val === null) return fallback
      try { return JSON.parse(val) } catch { return fallback }
    }
    darkMode.value = saved('recipesnap_darkmode', true)
    servings.value = saved('recipesnap_servings', 2)
    dietaryFilters.value = saved('recipesnap_filters', { vegetarian: false, vegan: false, glutenFree: false, dairyFree: false })
    maxTime.value = saved('recipesnap_maxtime', 0)
    language.value = localStorage.getItem('recipesnap_language') || 'en'
  }

  function saveToLocalStorage() {
    localStorage.setItem('recipesnap_darkmode', JSON.stringify(darkMode.value))
    localStorage.setItem('recipesnap_servings', JSON.stringify(servings.value))
    localStorage.setItem('recipesnap_filters', JSON.stringify(dietaryFilters.value))
    localStorage.setItem('recipesnap_maxtime', JSON.stringify(maxTime.value))
    localStorage.setItem('recipesnap_language', language.value)
  }

  function toJSON() {
    return {
      darkMode: darkMode.value,
      servings: servings.value,
      dietaryFilters: dietaryFilters.value,
      maxTime: maxTime.value,
      language: language.value
    }
  }

  function applyFromJSON(s) {
    if (!s || typeof s !== 'object') return
    if (s.darkMode !== undefined) darkMode.value = s.darkMode
    if (s.servings !== undefined) servings.value = s.servings
    if (s.dietaryFilters !== undefined) dietaryFilters.value = s.dietaryFilters
    if (s.maxTime !== undefined) maxTime.value = s.maxTime
    if (s.language !== undefined) language.value = s.language
  }

  async function syncToCloud() {
    if (!supabase || !user.value || syncing) return
    syncing = true
    try {
      await supabase
        .from('profiles')
        .update({ settings: toJSON(), updated_at: new Date().toISOString() })
        .eq('id', user.value.id)
    } catch (err) {
      console.error('Settings sync error:', err)
    } finally {
      syncing = false
    }
  }

  async function loadFromCloud() {
    if (!supabase || !user.value) return
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('settings')
        .eq('id', user.value.id)
        .single()

      if (!error && data?.settings && Object.keys(data.settings).length > 0) {
        applyFromJSON(data.settings)
        saveToLocalStorage()
      } else {
        // No cloud settings yet — push local settings up
        await syncToCloud()
      }
    } catch (err) {
      console.error('Failed to load cloud settings:', err)
    }
  }

  function startWatchers() {
    watch(darkMode, (val) => {
      document.documentElement.classList.toggle('dark', val)
      saveToLocalStorage()
      if (isLoggedIn.value) syncToCloud()
    })
    watch(servings, () => { saveToLocalStorage(); if (isLoggedIn.value) syncToCloud() })
    watch(dietaryFilters, () => { saveToLocalStorage(); if (isLoggedIn.value) syncToCloud() }, { deep: true })
    watch(maxTime, () => { saveToLocalStorage(); if (isLoggedIn.value) syncToCloud() })
    watch(language, () => { saveToLocalStorage(); if (isLoggedIn.value) syncToCloud() })
  }

  async function init() {
    if (initialized) return
    initialized = true

    loadFromLocalStorage()
    if (darkMode.value) document.documentElement.classList.add('dark')
    startWatchers()

    watch(() => isLoggedIn.value, async (loggedIn) => {
      if (loggedIn) await loadFromCloud()
    }, { immediate: true })
  }

  return {
    darkMode,
    servings,
    dietaryFilters,
    maxTime,
    language,
    init
  }
}
