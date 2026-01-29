import { ref, computed } from 'vue'
import { supabase } from '../services/supabase'
import { useAuth } from './useAuth'

const FREE_SNAPS_LIMIT = parseInt(import.meta.env.VITE_FREE_SNAPS || '10')
const LIMIT_SNAPS = import.meta.env.VITE_LIMIT_SNAPS !== 'false'
const STORAGE_KEY = 'recipesnap_free_snaps'

// Shared state (singleton)
const freeSnapsUsed = ref(parseInt(localStorage.getItem(STORAGE_KEY) || '0'))

export function useCredits() {
  const { isLoggedIn, credits, fetchProfile } = useAuth()

  const freeSnapsRemaining = computed(() => Math.max(0, FREE_SNAPS_LIMIT - freeSnapsUsed.value))

  const canSnap = computed(() => {
    if (!LIMIT_SNAPS) return true
    // Free snaps available (no login needed)
    if (freeSnapsRemaining.value > 0) return true
    // Logged in with credits
    if (isLoggedIn.value && credits.value > 0) return true
    return false
  })

  const needsLogin = computed(() => {
    if (!LIMIT_SNAPS) return false
    return freeSnapsRemaining.value <= 0 && !isLoggedIn.value
  })

  const needsCredits = computed(() => {
    if (!LIMIT_SNAPS) return false
    return freeSnapsRemaining.value <= 0 && isLoggedIn.value && credits.value <= 0
  })

  async function useSnap() {
    if (!LIMIT_SNAPS) return { success: true }

    // Use free snap if available
    if (freeSnapsRemaining.value > 0) {
      freeSnapsUsed.value++
      localStorage.setItem(STORAGE_KEY, freeSnapsUsed.value.toString())
      return { success: true }
    }

    // Use database credit
    if (!isLoggedIn.value) {
      return { success: false, error: 'Login required' }
    }

    if (!supabase) {
      return { success: false, error: 'Supabase not configured' }
    }

    const { data, error } = await supabase.rpc('use_credit', {
      user_id: (await supabase.auth.getUser()).data.user.id
    })

    if (error) {
      return { success: false, error: error.message }
    }

    if (!data) {
      return { success: false, error: 'No credits remaining' }
    }

    // Refresh profile to update credits count
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
