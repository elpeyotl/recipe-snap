import { ref, computed } from 'vue'
import { supabase } from '../services/supabase'

const PROFILE_STORAGE_KEY = 'recipesnap_profile'

function loadCachedProfile() {
  try {
    const raw = localStorage.getItem(PROFILE_STORAGE_KEY)
    return raw ? JSON.parse(raw) : null
  } catch { return null }
}

function cacheProfile(data) {
  try {
    if (data) localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(data))
    else localStorage.removeItem(PROFILE_STORAGE_KEY)
  } catch { /* storage unavailable */ }
}

// Shared state (singleton). Profile hydrates synchronously from storage so the
// UI shows last-known credits immediately on reload; the network fetch in init()
// revalidates in the background.
const user = ref(null)
const profile = ref(loadCachedProfile())
const loading = ref(true)
let initialized = false

export function useAuth() {
  const isLoggedIn = computed(() => !!user.value)
  const credits = computed(() => profile.value?.credits ?? 0)
  const subscriptionCredits = computed(() => profile.value?.subscription_credits ?? 0)
  const subscriptionStatus = computed(() => profile.value?.subscription_status ?? 'none')
  const subscriptionPeriodEnd = computed(() => profile.value?.subscription_period_end ?? null)
  const hasActiveSubscription = computed(() =>
    ['active', 'canceled'].includes(subscriptionStatus.value)
  )

  async function fetchProfile() {
    if (!user.value || !supabase) return
    try {
      const timeout = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Profile fetch timed out')), 10000)
      )
      const query = supabase
        .from('profiles')
        .select('*')
        .eq('id', user.value.id)
        .single()

      const { data, error } = await Promise.race([query, timeout])

      if (error) {
        console.error('fetchProfile error:', error)
        return
      }
      if (data) {
        profile.value = data
        cacheProfile(data)
      }
    } catch (err) {
      console.error('fetchProfile failed:', err)
    }
  }

  async function init() {
    if (initialized || !supabase) {
      loading.value = false
      return
    }
    initialized = true

    // Listen for auth state changes FIRST (needed to catch OAuth redirect tokens).
    // The callback body must stay synchronous — awaiting a Supabase query inside
    // onAuthStateChange deadlocks the client's internal lock, so defer DB work
    // with setTimeout(0). See supabase-js docs for this exact caveat.
    supabase.auth.onAuthStateChange((event, session) => {
      if ((event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') && session?.user) {
        user.value = session.user
        if (profile.value && profile.value.id !== session.user.id) {
          profile.value = null
          cacheProfile(null)
        }
        setTimeout(() => { fetchProfile() }, 0)
      } else if (event === 'SIGNED_OUT') {
        user.value = null
        profile.value = null
        cacheProfile(null)
      }
    })

    // Then check for existing session
    const { data: { session } } = await supabase.auth.getSession()
    if (session?.user) {
      user.value = session.user
      if (profile.value && profile.value.id !== session.user.id) {
        profile.value = null
        cacheProfile(null)
      }
      await fetchProfile()
    } else if (profile.value) {
      // Cached profile but no session — clear stale cache
      profile.value = null
      cacheProfile(null)
    }

    loading.value = false
  }

  async function signInWithEmail(email) {
    if (!supabase) return { error: { message: 'Supabase not configured' } }
    return await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin }
    })
  }

  async function signInWithGoogle() {
    if (!supabase) return { error: { message: 'Supabase not configured' } }
    return await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin }
    })
  }

  async function signInWithApple() {
    if (!supabase) return { error: { message: 'Supabase not configured' } }
    return await supabase.auth.signInWithOAuth({
      provider: 'apple',
      options: { redirectTo: window.location.origin }
    })
  }

  async function signOut() {
    // Clear local state first so the UI updates even if the API call hangs or the
    // cached token is broken. Then best-effort signOut with Supabase.
    user.value = null
    profile.value = null
    cacheProfile(null)

    try {
      Object.keys(localStorage)
        .filter(k => k.startsWith('sb-'))
        .forEach(k => localStorage.removeItem(k))
    } catch { /* storage unavailable */ }

    if (supabase) {
      try {
        await supabase.auth.signOut()
      } catch (err) {
        console.error('signOut API call failed (local state already cleared):', err)
      }
    }
  }

  return {
    user,
    profile,
    loading,
    isLoggedIn,
    credits,
    subscriptionCredits,
    subscriptionStatus,
    subscriptionPeriodEnd,
    hasActiveSubscription,
    init,
    fetchProfile,
    signInWithEmail,
    signInWithGoogle,
    signInWithApple,
    signOut
  }
}
