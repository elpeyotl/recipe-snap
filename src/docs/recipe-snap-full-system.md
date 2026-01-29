# Recipe Snap: Full System Architecture

## Overview

- **Free tier:** 10 snaps, no login required (localStorage)
- **After free tier:** Login required, credit-based system
- **Backend:** Supabase (auth + database)
- **Payments:** Stripe
- **Platforms:** Web + Native (Capacitor)

---

## User Flow

```
┌─────────────────────────────────────────────────────────┐
│  FIRST OPEN (no login)                                  │
│  localStorage: { freeSnapsUsed: 0 }                     │
└─────────────────────┬───────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────┐
│  USE APP (up to 10 free snaps)                          │
│  Each snap: freeSnapsUsed++                             │
└─────────────────────┬───────────────────────────────────┘
                      │
                      ▼ (freeSnapsUsed >= 10)
┌─────────────────────────────────────────────────────────┐
│  PAYWALL MODAL                                          │
│  "You've used all 10 free snaps!"                       │
│  [Create Account to Continue]                           │
└─────────────────────┬───────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────┐
│  SIGN UP / LOGIN                                        │
│  - Email magic link (recommended)                       │
│  - Google OAuth                                         │
│  - Apple Sign In (required for iOS)                     │
└─────────────────────┬───────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────┐
│  LOGGED IN - 0 credits                                  │
│  Show credit purchase options                           │
└─────────────────────┬───────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────┐
│  STRIPE CHECKOUT                                        │
│  User buys credit pack                                  │
└─────────────────────┬───────────────────────────────────┘
                      │
                      ▼ (webhook)
┌─────────────────────────────────────────────────────────┐
│  CREDITS ADDED TO DB                                    │
│  User can snap again                                    │
└─────────────────────────────────────────────────────────┘
```

---

## Credit Packs

| Pack | Price | Snaps | Cost to you | Margin |
|------|-------|-------|-------------|--------|
| Starter | $2.99 | 25 | $2.00 | +$0.99 |
| Regular | $4.99 | 50 | $4.00 | +$0.99 |
| Pro | $8.99 | 100 | $8.00 | +$0.99 |

Note: Stripe takes ~2.9% + $0.30 per transaction. Factor this in:

| Pack | Price | After Stripe fees | Your cost | Net profit |
|------|-------|-------------------|-----------|------------|
| Starter | $2.99 | ~$2.60 | $2.00 | +$0.60 |
| Regular | $4.99 | ~$4.54 | $4.00 | +$0.54 |
| Pro | $8.99 | ~$8.43 | $8.00 | +$0.43 |

Margins are thin but sustainable. Consider:
- $3.99 / 25 snaps for better margin
- Or $5.99 / 50 snaps

---

## Database Schema (Supabase)

### Tables

```sql
-- Users table (extends Supabase auth.users)
create table public.profiles (
  id uuid references auth.users(id) primary key,
  email text,
  credits integer default 0,
  total_snaps_used integer default 0,
  stripe_customer_id text,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- Transactions table
create table public.transactions (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id),
  type text not null, -- 'purchase', 'usage', 'refund'
  amount decimal, -- money amount (null for usage)
  credits_change integer not null, -- positive for purchase, negative for usage
  stripe_payment_id text,
  stripe_session_id text,
  pack_name text, -- 'starter', 'regular', 'pro'
  created_at timestamp with time zone default now()
);

-- Row Level Security
alter table public.profiles enable row level security;
alter table public.transactions enable row level security;

-- Users can only read their own profile
create policy "Users can view own profile" 
  on public.profiles for select 
  using (auth.uid() = id);

-- Users can only view their own transactions
create policy "Users can view own transactions" 
  on public.transactions for select 
  using (auth.uid() = user_id);
```

### Auto-create profile on signup

```sql
-- Function to create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email);
  return new;
end;
$$ language plpgsql security definer;

-- Trigger
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
```

---

## Supabase Setup

### 1. Create project

Go to https://supabase.com and create new project.

### 2. Get credentials

Add to `.env`:

```env
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGc...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc... # For backend/webhooks only
```

### 3. Create Supabase client

Create `src/services/supabase.js`:

```js
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
```

### 4. Auth configuration

In Supabase dashboard → Authentication → Providers:
- Enable Email (magic link)
- Enable Google OAuth
- Enable Apple (required for iOS App Store)

---

## Auth Composable

Create `src/composables/useAuth.js`:

```js
import { ref, computed } from 'vue'
import { supabase } from '@/services/supabase'

const user = ref(null)
const profile = ref(null)
const loading = ref(true)

export const useAuth = () => {
  const isLoggedIn = computed(() => !!user.value)
  const credits = computed(() => profile.value?.credits ?? 0)

  const init = async () => {
    loading.value = true
    
    // Get current session
    const { data: { session } } = await supabase.auth.getSession()
    user.value = session?.user ?? null
    
    if (user.value) {
      await fetchProfile()
    }
    
    // Listen for auth changes
    supabase.auth.onAuthStateChange(async (event, session) => {
      user.value = session?.user ?? null
      if (user.value) {
        await fetchProfile()
      } else {
        profile.value = null
      }
    })
    
    loading.value = false
  }

  const fetchProfile = async () => {
    if (!user.value) return
    
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.value.id)
      .single()
    
    if (!error) {
      profile.value = data
    }
  }

  const signInWithEmail = async (email) => {
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: window.location.origin
      }
    })
    return { error }
  }

  const signInWithGoogle = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin
      }
    })
    return { error }
  }

  const signInWithApple = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'apple',
      options: {
        redirectTo: window.location.origin
      }
    })
    return { error }
  }

  const signOut = async () => {
    await supabase.auth.signOut()
    user.value = null
    profile.value = null
  }

  return {
    user,
    profile,
    loading,
    isLoggedIn,
    credits,
    init,
    fetchProfile,
    signInWithEmail,
    signInWithGoogle,
    signInWithApple,
    signOut
  }
}
```

---

## Credits Composable

Create `src/composables/useCredits.js`:

```js
import { ref, computed } from 'vue'
import { supabase } from '@/services/supabase'
import { useAuth } from './useAuth'

const FREE_SNAPS_LIMIT = 10
const LOCAL_STORAGE_KEY = 'freeSnapsUsed'

export const useCredits = () => {
  const { isLoggedIn, credits, profile, fetchProfile } = useAuth()
  
  // Free tier tracking (localStorage)
  const freeSnapsUsed = ref(
    parseInt(localStorage.getItem(LOCAL_STORAGE_KEY) || '0')
  )
  
  const freeSnapsRemaining = computed(() => 
    Math.max(0, FREE_SNAPS_LIMIT - freeSnapsUsed.value)
  )
  
  const canSnap = computed(() => {
    if (!isLoggedIn.value) {
      // Not logged in: check free snaps
      return freeSnapsRemaining.value > 0
    }
    // Logged in: check credits
    return credits.value > 0
  })
  
  const needsLogin = computed(() => 
    !isLoggedIn.value && freeSnapsRemaining.value <= 0
  )
  
  const needsCredits = computed(() => 
    isLoggedIn.value && credits.value <= 0
  )

  const useSnap = async () => {
    if (!canSnap.value) {
      return { success: false, error: 'No snaps available' }
    }
    
    if (!isLoggedIn.value) {
      // Use free snap
      freeSnapsUsed.value++
      localStorage.setItem(LOCAL_STORAGE_KEY, freeSnapsUsed.value.toString())
      return { success: true }
    }
    
    // Use credit from DB
    const { error } = await supabase.rpc('use_credit', {
      user_id: profile.value.id
    })
    
    if (error) {
      return { success: false, error: error.message }
    }
    
    // Refresh profile to get updated credits
    await fetchProfile()
    return { success: true }
  }

  return {
    freeSnapsUsed,
    freeSnapsRemaining,
    canSnap,
    needsLogin,
    needsCredits,
    useSnap,
    FREE_SNAPS_LIMIT
  }
}
```

### Database function for using credits

```sql
create or replace function use_credit(p_user_id uuid)
returns void as $$
begin
  -- Deduct credit
  update public.profiles
  set 
    credits = credits - 1,
    total_snaps_used = total_snaps_used + 1,
    updated_at = now()
  where id = p_user_id and credits > 0;
  
  -- Log transaction
  insert into public.transactions (user_id, type, credits_change)
  values (p_user_id, 'usage', -1);
end;
$$ language plpgsql security definer;
```

---

## Stripe Integration

### 1. Stripe setup

Create account at https://stripe.com

Add to `.env`:

```env
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

### 2. Create products in Stripe Dashboard

Create 3 products:
- **Starter Pack** - $2.99 (or $3.99)
- **Regular Pack** - $4.99 (or $5.99)
- **Pro Pack** - $8.99 (or $9.99)

Note the Price IDs (e.g., `price_1234...`)

### 3. Stripe checkout (frontend)

Create `src/services/stripe.js`:

```js
import { loadStripe } from '@stripe/stripe-js'
import { supabase } from './supabase'

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY)

const PRICE_IDS = {
  starter: 'price_xxxxx', // 25 credits
  regular: 'price_xxxxx', // 50 credits
  pro: 'price_xxxxx'      // 100 credits
}

const CREDITS_MAP = {
  starter: 25,
  regular: 50,
  pro: 100
}

export const buyCredits = async (packName, userId, userEmail) => {
  const stripe = await stripePromise
  
  // Create checkout session via Supabase Edge Function
  const { data, error } = await supabase.functions.invoke('create-checkout', {
    body: {
      priceId: PRICE_IDS[packName],
      userId,
      userEmail,
      packName,
      credits: CREDITS_MAP[packName]
    }
  })
  
  if (error) throw error
  
  // Redirect to Stripe
  const result = await stripe.redirectToCheckout({
    sessionId: data.sessionId
  })
  
  if (result.error) throw result.error
}
```

### 4. Supabase Edge Function for checkout

Create `supabase/functions/create-checkout/index.ts`:

```ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import Stripe from 'https://esm.sh/stripe@13.0.0'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
  apiVersion: '2023-10-16',
})

serve(async (req) => {
  const { priceId, userId, userEmail, packName, credits } = await req.json()
  
  const session = await stripe.checkout.sessions.create({
    payment_method_types: ['card'],
    line_items: [{ price: priceId, quantity: 1 }],
    mode: 'payment',
    success_url: `${req.headers.get('origin')}/purchase-success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${req.headers.get('origin')}/purchase-cancelled`,
    customer_email: userEmail,
    metadata: {
      userId,
      packName,
      credits: credits.toString()
    }
  })
  
  return new Response(
    JSON.stringify({ sessionId: session.id }),
    { headers: { 'Content-Type': 'application/json' } }
  )
})
```

### 5. Stripe Webhook (add credits after payment)

Create `supabase/functions/stripe-webhook/index.ts`:

```ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import Stripe from 'https://esm.sh/stripe@13.0.0'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
  apiVersion: '2023-10-16',
})

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

serve(async (req) => {
  const signature = req.headers.get('stripe-signature')!
  const body = await req.text()
  
  let event: Stripe.Event
  
  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      Deno.env.get('STRIPE_WEBHOOK_SECRET')!
    )
  } catch (err) {
    return new Response(`Webhook Error: ${err.message}`, { status: 400 })
  }
  
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session
    
    const userId = session.metadata?.userId
    const credits = parseInt(session.metadata?.credits || '0')
    const packName = session.metadata?.packName
    
    if (userId && credits > 0) {
      // Add credits to user
      await supabase.rpc('add_credits', {
        p_user_id: userId,
        p_credits: credits,
        p_stripe_session_id: session.id,
        p_amount: session.amount_total! / 100,
        p_pack_name: packName
      })
    }
  }
  
  return new Response(JSON.stringify({ received: true }), {
    headers: { 'Content-Type': 'application/json' }
  })
})
```

### 6. Database function for adding credits

```sql
create or replace function add_credits(
  p_user_id uuid,
  p_credits integer,
  p_stripe_session_id text,
  p_amount decimal,
  p_pack_name text
)
returns void as $$
begin
  -- Check if already processed (idempotency)
  if exists (
    select 1 from public.transactions 
    where stripe_session_id = p_stripe_session_id
  ) then
    return;
  end if;

  -- Add credits
  update public.profiles
  set 
    credits = credits + p_credits,
    updated_at = now()
  where id = p_user_id;
  
  -- Log transaction
  insert into public.transactions (
    user_id, type, amount, credits_change, 
    stripe_session_id, pack_name
  )
  values (
    p_user_id, 'purchase', p_amount, p_credits,
    p_stripe_session_id, p_pack_name
  );
end;
$$ language plpgsql security definer;
```

---

## UI Components

### PaywallModal.vue

```vue
<template>
  <div class="modal-overlay" v-if="show">
    <div class="modal">
      <!-- Needs Login -->
      <template v-if="needsLogin">
        <h2>You've used all 10 free snaps!</h2>
        <p>Create an account to continue using Recipe Snap.</p>
        
        <button @click="$emit('login-google')" class="btn-google">
          Continue with Google
        </button>
        <button @click="$emit('login-apple')" class="btn-apple">
          Continue with Apple
        </button>
        <div class="divider">or</div>
        <input 
          type="email" 
          v-model="email" 
          placeholder="Enter your email"
        />
        <button @click="$emit('login-email', email)" class="btn-email">
          Send magic link
        </button>
      </template>
      
      <!-- Needs Credits -->
      <template v-else-if="needsCredits">
        <h2>You're out of credits!</h2>
        <p>Buy more to keep snapping.</p>
        
        <div class="packs">
          <div class="pack" @click="$emit('buy', 'starter')">
            <span class="credits">25 snaps</span>
            <span class="price">$2.99</span>
          </div>
          <div class="pack featured" @click="$emit('buy', 'regular')">
            <span class="badge">Best Value</span>
            <span class="credits">50 snaps</span>
            <span class="price">$4.99</span>
          </div>
          <div class="pack" @click="$emit('buy', 'pro')">
            <span class="credits">100 snaps</span>
            <span class="price">$8.99</span>
          </div>
        </div>
      </template>
      
      <button @click="$emit('close')" class="btn-close">
        Maybe later
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'

defineProps({
  show: Boolean,
  needsLogin: Boolean,
  needsCredits: Boolean
})

defineEmits(['close', 'login-google', 'login-apple', 'login-email', 'buy'])

const email = ref('')
</script>
```

### Credits display in header/settings

```vue
<template>
  <div class="credits-display">
    <template v-if="!isLoggedIn">
      <span>{{ freeSnapsRemaining }}/10 free snaps</span>
    </template>
    <template v-else>
      <span>{{ credits }} credits</span>
      <button @click="showBuyModal = true">Buy more</button>
    </template>
  </div>
</template>
```

---

## Native (Capacitor) Considerations

### For iOS App Store:
- Must use Apple Sign In if offering other social logins
- Consider using In-App Purchases instead of Stripe (Apple requires 15-30% cut for digital goods)

### Options for native payments:
1. **Stripe (web checkout)** - Opens browser, works but clunky
2. **RevenueCat** - Wraps native IAP, handles both stores
3. **Native IAP** - Capacitor plugin, more work but compliant

### Recommended: RevenueCat
- Same credit packs, managed through RevenueCat
- They handle Apple/Google IAP compliance
- Webhook to Supabase to add credits

---

## Implementation Order

1. [ ] Set up Supabase project
2. [ ] Create database tables and functions
3. [ ] Implement auth (email, Google, Apple)
4. [ ] Build useAuth composable
5. [ ] Build useCredits composable
6. [ ] Create PaywallModal component
7. [ ] Integrate into snap flow
8. [ ] Set up Stripe account and products
9. [ ] Create Supabase Edge Functions
10. [ ] Test full purchase flow
11. [ ] Add credits display to UI
12. [ ] Handle success/cancel pages
13. [ ] Test on mobile web
14. [ ] Later: Capacitor + RevenueCat for native

---

## Test Checklist

- [ ] New user can use 10 free snaps without login
- [ ] After 10 snaps, login modal appears
- [ ] Google login works
- [ ] Apple login works
- [ ] Email magic link works
- [ ] After login, credits show as 0
- [ ] Buy credits modal appears
- [ ] Stripe checkout opens
- [ ] After payment, credits are added
- [ ] Can snap with credits
- [ ] Credits decrement after each snap
- [ ] Transaction history recorded
- [ ] Webhook handles duplicate events (idempotency)
