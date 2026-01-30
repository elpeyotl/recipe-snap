import type { User } from '@supabase/supabase-js'

interface Profile {
  id: string
  credits: number
  subscription_credits: number
  subscription_status: string
  subscription_period_end: string | null
  settings?: Record<string, unknown>
  [key: string]: unknown
}

// Shared state (singleton)
const user = ref<User | null>(null)
const profile = ref<Profile | null>(null)
const loading = ref(true)
let initialized = false

export function useAuth() {
  const supabase = useSupabase()

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
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.value.id)
      .single()

    if (!error && data) {
      profile.value = data as Profile
    }
  }

  async function init() {
    if (initialized || !supabase) {
      loading.value = false
      return
    }
    initialized = true

    // Check for existing session
    const { data: { session } } = await supabase.auth.getSession()
    if (session?.user) {
      user.value = session.user
      await fetchProfile()
    }

    // Listen for auth state changes (OAuth redirect, magic link, sign out)
    supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        user.value = session.user
        await fetchProfile()
      } else if (event === 'SIGNED_OUT') {
        user.value = null
        profile.value = null
      }
    })

    loading.value = false
  }

  async function signInWithEmail(email: string) {
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
    if (!supabase) return
    await supabase.auth.signOut()
    user.value = null
    profile.value = null
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
