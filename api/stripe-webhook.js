import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)
const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// Disable body parsing - Stripe needs raw body for signature verification
export const config = {
  api: {
    bodyParser: false
  }
}

async function getRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    req.on('data', (chunk) => chunks.push(chunk))
    req.on('end', () => resolve(Buffer.concat(chunks)))
    req.on('error', reject)
  })
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const rawBody = await getRawBody(req)
    const sig = req.headers['stripe-signature']

    let event
    try {
      event = stripe.webhooks.constructEvent(rawBody, sig, endpointSecret)
    } catch (err) {
      console.error('Webhook signature verification failed:', err.message)
      return res.status(400).json({ error: 'Invalid signature' })
    }

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object

      // Subscription checkouts are handled by invoice.paid
      if (session.mode === 'subscription') {
        console.log('Subscription checkout completed, credits handled by invoice.paid')
        return res.status(200).json({ received: true })
      }

      const { userId, credits, amount, packName } = session.metadata

      if (!userId || !credits) {
        console.error('Missing metadata in checkout session')
        return res.status(400).json({ error: 'Missing metadata' })
      }

      // Add credits to user (idempotent by stripe session ID)
      const { data, error } = await supabase.rpc('add_credits', {
        p_user_id: userId,
        p_credits: parseInt(credits),
        p_amount: parseFloat(amount),
        p_stripe_session_id: session.id,
        p_pack_name: packName
      })

      if (error) {
        console.error('Failed to add credits:', error)
        return res.status(500).json({ error: 'Failed to add credits' })
      }

      if (!data) {
        console.log('Session already processed:', session.id)
      }
    }

    // Subscription credit refill (initial + renewals)
    if (event.type === 'invoice.paid') {
      const invoice = event.data.object
      if (invoice.subscription) {
        const subscription = await stripe.subscriptions.retrieve(invoice.subscription)
        const userId = subscription.metadata.userId
        const credits = parseInt(subscription.metadata.credits || '80')

        if (userId) {
          const { error } = await supabase.rpc('refill_subscription_credits', {
            p_user_id: userId,
            p_credits: credits,
            p_stripe_invoice_id: invoice.id,
            p_subscription_id: invoice.subscription,
            p_period_end: new Date(subscription.current_period_end * 1000).toISOString()
          })

          if (error) {
            console.error('Failed to refill subscription credits:', error)
          }
        }
      }
    }

    // Subscription status changes (cancel at period end, past_due)
    if (event.type === 'customer.subscription.updated') {
      const subscription = event.data.object
      const userId = subscription.metadata.userId

      if (userId) {
        let status = 'active'
        if (subscription.cancel_at_period_end) status = 'canceled'
        if (subscription.status === 'past_due') status = 'past_due'

        await supabase
          .from('profiles')
          .update({
            subscription_status: status,
            subscription_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
            updated_at: new Date().toISOString()
          })
          .eq('id', userId)
      }
    }

    // Subscription fully ended
    if (event.type === 'customer.subscription.deleted') {
      const subscription = event.data.object
      const userId = subscription.metadata.userId

      if (userId) {
        await supabase
          .from('profiles')
          .update({
            subscription_status: 'none',
            subscription_credits: 0,
            subscription_id: null,
            subscription_period_end: null,
            updated_at: new Date().toISOString()
          })
          .eq('id', userId)
      }
    }

    return res.status(200).json({ received: true })
  } catch (err) {
    console.error('Webhook error:', err)
    return res.status(500).json({ error: 'Webhook handler failed' })
  }
}
