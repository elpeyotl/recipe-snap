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

  const body = await readBody(event)
  const { packName, type } = body

  const PACKS: Record<string, { credits: number; priceId: string; amount: number }> = {
    starter: { credits: 25, priceId: config.stripeStarterPriceId, amount: 2.99 },
    regular: { credits: 50, priceId: config.stripeRegularPriceId, amount: 4.99 },
    pro: { credits: 100, priceId: config.stripeProPriceId, amount: 8.99 }
  }

  const SUBSCRIPTION_PRICE_ID = config.stripeMonthlyPriceId

  const origin = getHeader(event, 'origin') || getRequestURL(event).origin

  if (type === 'subscription') {
    if (!SUBSCRIPTION_PRICE_ID) {
      throw createError({ statusCode: 500, message: 'Subscription not configured' })
    }

    const { data: profile } = await supabase.from('profiles')
      .select('stripe_customer_id, subscription_status')
      .eq('id', user.id).single()

    if (profile?.subscription_status === 'active') {
      throw createError({ statusCode: 400, message: 'Already subscribed' })
    }

    let customerId = profile?.stripe_customer_id
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email!,
        metadata: { userId: user.id }
      })
      customerId = customer.id
      await supabase.from('profiles').update({ stripe_customer_id: customerId }).eq('id', user.id)
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      payment_method_types: ['card'],
      line_items: [{ price: SUBSCRIPTION_PRICE_ID, quantity: 1 }],
      metadata: { userId: user.id, type: 'subscription', credits: '80' },
      subscription_data: { metadata: { userId: user.id, credits: '80' } },
      success_url: `${origin}?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: origin
    })

    return { url: session.url }
  }

  // One-time credit pack
  const pack = PACKS[packName]
  if (!pack) {
    throw createError({ statusCode: 400, message: 'Invalid pack' })
  }

  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    payment_method_types: ['card'],
    line_items: [{ price: pack.priceId, quantity: 1 }],
    metadata: {
      userId: user.id, packName, credits: pack.credits.toString(), amount: pack.amount.toString()
    },
    success_url: `${origin}?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: origin
  })

  return { url: session.url }
})
