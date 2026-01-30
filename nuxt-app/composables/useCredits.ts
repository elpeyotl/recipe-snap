const STORAGE_KEY = 'recipesnap_free_snaps'

// Shared state (singleton)
const freeSnapsUsed = ref(0)
let creditsInitialized = false

export function useCredits() {
  const config = useRuntimeConfig()
  const FREE_SNAPS_LIMIT = config.public.freeSnaps as number
  const LIMIT_SNAPS = config.public.limitSnaps as boolean
  const supabase = useSupabase()
  const { isLoggedIn, credits, subscriptionCredits, hasActiveSubscription, fetchProfile } = useAuth()

  // Load localStorage on client only
  if (!creditsInitialized && import.meta.client) {
    freeSnapsUsed.value = parseInt(localStorage.getItem(STORAGE_KEY) || '0')
    creditsInitialized = true
  }

  const totalCredits = computed(() => subscriptionCredits.value + credits.value)

  const freeSnapsRemaining = computed(() => Math.max(0, FREE_SNAPS_LIMIT - freeSnapsUsed.value))

  const canSnap = computed(() => {
    if (!LIMIT_SNAPS) return true
    if (freeSnapsRemaining.value > 0) return true
    if (isLoggedIn.value && hasActiveSubscription.value && subscriptionCredits.value > 0) return true
    if (isLoggedIn.value && credits.value > 0) return true
    return false
  })

  const needsLogin = computed(() => {
    if (!LIMIT_SNAPS) return false
    return freeSnapsRemaining.value <= 0 && !isLoggedIn.value
  })

  const needsCredits = computed(() => {
    if (!LIMIT_SNAPS) return false
    return freeSnapsRemaining.value <= 0 && isLoggedIn.value && totalCredits.value <= 0
  })

  async function useSnap(): Promise<{ success: boolean; error?: string }> {
    if (!LIMIT_SNAPS) return { success: true }

    // Use free snap if available
    if (freeSnapsRemaining.value > 0) {
      freeSnapsUsed.value++
      if (import.meta.client) {
        localStorage.setItem(STORAGE_KEY, freeSnapsUsed.value.toString())
      }
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
      user_id: (await supabase.auth.getUser()).data.user!.id
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
    totalCredits,
    subscriptionCredits,
    hasActiveSubscription,
    FREE_SNAPS_LIMIT
  }
}
