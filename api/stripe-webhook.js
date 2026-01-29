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
        // Already processed (idempotent check)
        console.log('Session already processed:', session.id)
      }
    }

    return res.status(200).json({ received: true })
  } catch (err) {
    console.error('Webhook error:', err)
    return res.status(500).json({ error: 'Webhook handler failed' })
  }
}
