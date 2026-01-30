// Shared state (singleton)
const purchases = ref<any[]>([])
const loading = ref(false)

export function usePurchaseHistory() {
  const supabase = useSupabase()
  const { user } = useAuth()

  async function fetchPurchases() {
    if (!supabase || !user.value) {
      purchases.value = []
      return
    }

    loading.value = true
    try {
      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .eq('user_id', user.value.id)
        .eq('type', 'purchase')
        .order('created_at', { ascending: false })

      purchases.value = error ? [] : (data || [])
    } finally {
      loading.value = false
    }
  }

  return {
    purchases,
    loading,
    fetchPurchases
  }
}
