import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  const stripe = new Stripe(config.stripeSecretKey)
  const supabase = createClient(config.public.supabaseUrl, config.supabaseServiceKey)

  const rawBody = await readRawBody(event)
  const sig = getHeader(event, 'stripe-signature')

  let stripeEvent: Stripe.Event
  try {
    stripeEvent = stripe.webhooks.constructEvent(rawBody!, sig!, config.stripeWebhookSecret)
  } catch (err: any) {
    throw createError({ statusCode: 400, message: `Webhook error: ${err.message}` })
  }

  if (stripeEvent.type === 'checkout.session.completed') {
    const session = stripeEvent.data.object as Stripe.Checkout.Session
    if (session.mode === 'subscription') {
      return { received: true }
    }
    const { userId, credits, amount, packName } = session.metadata || {}
    if (!userId || !credits) {
      throw createError({ statusCode: 400, message: 'Missing metadata' })
    }
    await supabase.rpc('add_credits', {
      p_user_id: userId,
      p_credits: parseInt(credits),
      p_amount: parseFloat(amount || '0'),
      p_stripe_session_id: session.id,
      p_pack_name: packName
    })
  }

  if (stripeEvent.type === 'invoice.paid') {
    const invoice = stripeEvent.data.object as Stripe.Invoice
    if (invoice.subscription) {
      const subscription = await stripe.subscriptions.retrieve(invoice.subscription as string)
      const userId = subscription.metadata.userId
      const credits = parseInt(subscription.metadata.credits || '80')
      if (userId) {
        const periodEnd = (subscription as any).current_period_end
          || (subscription as any).items?.data?.[0]?.current_period_end
        await supabase.rpc('refill_subscription_credits', {
          p_user_id: userId,
          p_credits: credits,
          p_stripe_invoice_id: invoice.id,
          p_subscription_id: invoice.subscription,
          p_period_end: periodEnd ? new Date(periodEnd * 1000).toISOString() : new Date().toISOString()
        })
      }
    }
  }

  if (stripeEvent.type === 'customer.subscription.updated') {
    const subscription = stripeEvent.data.object as Stripe.Subscription
    const userId = subscription.metadata.userId
    if (userId) {
      let status = 'active'
      if (subscription.cancel_at_period_end) status = 'canceled'
      if (subscription.status === 'past_due') status = 'past_due'
      const periodEnd = (subscription as any).current_period_end
        || (subscription as any).items?.data?.[0]?.current_period_end
      const updateData: any = {
        subscription_status: status,
        subscription_id: subscription.id,
        updated_at: new Date().toISOString()
      }
      if (periodEnd) {
        updateData.subscription_period_end = new Date(periodEnd * 1000).toISOString()
      }
      await supabase.from('profiles').update(updateData).eq('id', userId)
    }
  }

  if (stripeEvent.type === 'customer.subscription.deleted') {
    const subscription = stripeEvent.data.object as Stripe.Subscription
    const userId = subscription.metadata.userId
    if (userId) {
      await supabase.from('profiles').update({
        subscription_status: 'none',
        subscription_credits: 0,
        subscription_id: null,
        subscription_period_end: null,
        updated_at: new Date().toISOString()
      }).eq('id', userId)
    }
  }

  return { received: true }
})
