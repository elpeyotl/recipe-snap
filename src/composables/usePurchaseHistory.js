import { ref } from 'vue'
import { supabase } from '../services/supabase'
import { useAuth } from './useAuth'

const purchases = ref([])
const loading = ref(false)

export function usePurchaseHistory() {
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
