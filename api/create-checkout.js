import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const PACKS = {
  starter: { credits: 25, priceId: process.env.STRIPE_STARTER_PRICE_ID, amount: 2.99 },
  regular: { credits: 50, priceId: process.env.STRIPE_REGULAR_PRICE_ID, amount: 4.99 },
  pro: { credits: 100, priceId: process.env.STRIPE_PRO_PRICE_ID, amount: 8.99 }
}

const SUBSCRIPTION = {
  credits: 80,
  priceId: process.env.STRIPE_MONTHLY_PRICE_ID,
  amount: 4.99
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    // Verify auth token
    const authHeader = req.headers.authorization
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    const token = authHeader.split(' ')[1]
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)

    if (authError || !user) {
      return res.status(401).json({ error: 'Invalid token' })
    }

    const { packName, type } = req.body

    // Subscription checkout
    if (type === 'subscription') {
      if (!SUBSCRIPTION.priceId) {
        return res.status(500).json({ error: 'Subscription not configured' })
      }

      // Check if user already has an active subscription
      const { data: profile } = await supabase
        .from('profiles')
        .select('stripe_customer_id, subscription_status')
        .eq('id', user.id)
        .single()

      if (profile?.subscription_status === 'active') {
        return res.status(400).json({ error: 'Already subscribed' })
      }

      // Get or create Stripe customer
      let customerId = profile?.stripe_customer_id
      if (!customerId) {
        const customer = await stripe.customers.create({
          email: user.email,
          metadata: { userId: user.id }
        })
        customerId = customer.id
        await supabase
          .from('profiles')
          .update({ stripe_customer_id: customerId })
          .eq('id', user.id)
      }

      const session = await stripe.checkout.sessions.create({
        mode: 'subscription',
        customer: customerId,
        payment_method_types: ['card'],
        line_items: [{ price: SUBSCRIPTION.priceId, quantity: 1 }],
        metadata: {
          userId: user.id,
          type: 'subscription',
          credits: SUBSCRIPTION.credits.toString()
        },
        subscription_data: {
          metadata: {
            userId: user.id,
            credits: SUBSCRIPTION.credits.toString()
          }
        },
        success_url: `${req.headers.origin}?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${req.headers.origin}`
      })

      return res.status(200).json({ url: session.url })
    }

    // One-time credit pack checkout
    const pack = PACKS[packName]

    if (!pack) {
      return res.status(400).json({ error: 'Invalid pack' })
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [
        {
          price: pack.priceId,
          quantity: 1
        }
      ],
      metadata: {
        userId: user.id,
        packName,
        credits: pack.credits.toString(),
        amount: pack.amount.toString()
      },
      success_url: `${req.headers.origin}?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${req.headers.origin}`
    })

    return res.status(200).json({ url: session.url })
  } catch (err) {
    console.error('Checkout error:', err)
    return res.status(500).json({ error: 'Failed to create checkout session' })
  }
}
