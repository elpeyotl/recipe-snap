const PACKS = {
  starter: { name: 'Starter', credits: 25, price: '$2.99' },
  regular: { name: 'Regular', credits: 50, price: '$4.99' },
  pro: { name: 'Pro', credits: 100, price: '$8.99' }
} as const

const SUBSCRIPTION = {
  name: 'Monthly',
  credits: 80,
  price: '$4.99',
  interval: 'month'
} as const

export function useStripe() {
  const supabase = useSupabase()

  async function getAuthToken(): Promise<string> {
    if (!supabase) throw new Error('Supabase not configured')
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) throw new Error('Not authenticated')
    return session.access_token
  }

  async function buySubscription() {
    const token = await getAuthToken()

    const response = await fetch('/api/create-checkout', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ type: 'subscription' })
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to create checkout session')
    }

    const { url } = await response.json()
    window.location.href = url
  }

  async function openCustomerPortal() {
    const token = await getAuthToken()

    const response = await fetch('/api/create-portal-session', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to open billing portal')
    }

    const { url } = await response.json()
    window.location.href = url
  }

  async function buyCredits(packName: string) {
    const pack = PACKS[packName as keyof typeof PACKS]
    if (!pack) {
      throw new Error('Invalid pack')
    }

    const token = await getAuthToken()

    const response = await fetch('/api/create-checkout', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        packName,
        credits: pack.credits
      })
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to create checkout session')
    }

    const { url } = await response.json()
    window.location.href = url
  }

  return {
    PACKS,
    SUBSCRIPTION,
    buySubscription,
    openCustomerPortal,
    buyCredits
  }
}
