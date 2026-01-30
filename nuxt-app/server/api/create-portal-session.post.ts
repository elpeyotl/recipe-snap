import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  const stripe = new Stripe(config.stripeSecretKey)
  const supabase = createClient(config.public.supabaseUrl, config.supabaseServiceKey)

  const authHeader = getHeader(event, 'authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    throw createError({ statusCode: 401, message: 'Unauthorized' })
  }

  const token = authHeader.split(' ')[1]
  const { data: { user }, error: authError } = await supabase.auth.getUser(token)
  if (authError || !user) {
    throw createError({ statusCode: 401, message: 'Invalid token' })
  }

  const { data: profile } = await supabase.from('profiles')
    .select('stripe_customer_id').eq('id', user.id).single()

  if (!profile?.stripe_customer_id) {
    throw createError({ statusCode: 400, message: 'No billing account found' })
  }

  const origin = getHeader(event, 'origin') || getRequestURL(event).origin

  const portalSession = await stripe.billingPortal.sessions.create({
    customer: profile.stripe_customer_id,
    return_url: origin
  })

  return { url: portalSession.url }
})
