import { supabase } from './supabase'

const PACKS = {
  starter: { name: 'Starter', credits: 25, price: '$2.99' },
  regular: { name: 'Regular', credits: 50, price: '$4.99' },
  pro: { name: 'Pro', credits: 100, price: '$8.99' }
}

const SUBSCRIPTION = {
  name: 'Monthly',
  credits: 80,
  price: '$4.99',
  interval: 'month'
}

export { PACKS, SUBSCRIPTION }

export async function buySubscription() {
  if (!supabase) {
    throw new Error('Supabase not configured')
  }

  const { data: { session } } = await supabase.auth.getSession()
  if (!session) {
    throw new Error('Not authenticated')
  }

  const response = await fetch('/api/create-checkout', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session.access_token}`
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

export async function openCustomerPortal() {
  if (!supabase) {
    throw new Error('Supabase not configured')
  }

  const { data: { session } } = await supabase.auth.getSession()
  if (!session) {
    throw new Error('Not authenticated')
  }

  const response = await fetch('/api/create-portal-session', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session.access_token}`
    }
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to open billing portal')
  }

  const { url } = await response.json()
  window.location.href = url
}

export async function buyCredits(packName) {
  if (!supabase) {
    throw new Error('Supabase not configured')
  }

  const pack = PACKS[packName]
  if (!pack) {
    throw new Error('Invalid pack')
  }

  // Get current session token to authenticate the API call
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) {
    throw new Error('Not authenticated')
  }

  const response = await fetch('/api/create-checkout', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session.access_token}`
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

  // Redirect to Stripe Checkout
  window.location.href = url
}
