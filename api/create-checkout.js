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

    const { packName } = req.body
    const pack = PACKS[packName]

    if (!pack) {
      return res.status(400).json({ error: 'Invalid pack' })
    }

    // Create Stripe Checkout Session
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
