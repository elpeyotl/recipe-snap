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
      const timeout = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Purchase history fetch timed out')), 10000)
      )
      const query = supabase
        .from('transactions')
        .select('*')
        .eq('user_id', user.value.id)
        .eq('type', 'purchase')
        .order('created_at', { ascending: false })

      const { data, error } = await Promise.race([query, timeout])

      if (error) console.error('fetchPurchases error:', error)
      purchases.value = error ? [] : (data || [])
    } catch (err) {
      console.error('fetchPurchases failed:', err)
      purchases.value = []
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
