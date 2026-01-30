<script setup lang="ts">
const { PACKS, SUBSCRIPTION } = useStripe()

const props = defineProps<{
  needsLogin: boolean
  needsCredits: boolean
  loading: boolean
  voluntaryLogin: boolean
}>()

const emit = defineEmits<{
  close: []
  'login-google': []
  'login-apple': []
  'login-email': [email: string]
  buy: [packName: string]
  subscribe: []
}>()

const isOpen = defineModel<boolean>('modelValue', { default: true })

const email = ref('')
const emailError = ref('')
const magicLinkSent = ref(false)

const handleEmailSubmit = () => {
  emailError.value = ''
  const trimmed = email.value.trim()
  if (!trimmed || !trimmed.includes('@')) {
    emailError.value = 'Please enter a valid email address.'
    return
  }
  emit('login-email', trimmed)
  magicLinkSent.value = true
}

const handleClose = () => {
  isOpen.value = false
  emit('close')
}
</script>

<template>
  <UModal
    v-model:open="isOpen"
    :ui="{
      content: 'bg-[var(--card-bg)] border border-[var(--border)] rounded-xl max-w-[400px] w-full mx-auto',
      overlay: 'bg-black/60 backdrop-blur-sm'
    }"
    @update:open="(val: boolean) => { if (!val) handleClose() }"
  >
    <div class="paywall-content">
      <!-- Login State -->
      <template v-if="needsLogin">
        <div class="paywall-icon">{{ voluntaryLogin ? '&#x1F464;' : '&#x1F511;' }}</div>
        <h2 class="paywall-title">
          {{ voluntaryLogin ? 'Sign in to Recipe Snap' : "You've used all 10 free snaps!" }}
        </h2>
        <p class="paywall-description">
          {{ voluntaryLogin ? 'Save recipes, sync across devices, and more.' : 'Create an account to continue using Recipe Snap.' }}
        </p>

        <template v-if="!magicLinkSent">
          <button class="paywall-btn paywall-btn-social" @click="emit('login-google')">
            <svg width="18" height="18" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
            </svg>
            Continue with Google
          </button>

          <button class="paywall-btn paywall-btn-social" @click="emit('login-apple')">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
            </svg>
            Continue with Apple
          </button>

          <div class="paywall-divider"><span>or</span></div>

          <div class="paywall-email-form">
            <input
              v-model="email"
              type="email"
              placeholder="your@email.com"
              class="paywall-input"
              @keyup.enter="handleEmailSubmit"
            />
            <UButton
              block
              size="lg"
              color="primary"
              class="paywall-btn-primary-ui"
              @click="handleEmailSubmit"
            >
              Send magic link
            </UButton>
            <p v-if="emailError" class="paywall-error">{{ emailError }}</p>
          </div>
        </template>

        <template v-else>
          <div class="paywall-success">
            <div class="paywall-success-icon">&#x2709;&#xFE0F;</div>
            <p class="paywall-success-text">Check your email!</p>
            <p class="paywall-hint">We sent a login link to <strong>{{ email }}</strong></p>
            <UButton
              block
              variant="outline"
              color="neutral"
              class="mt-2"
              @click="magicLinkSent = false"
            >
              Try a different email
            </UButton>
          </div>
        </template>
      </template>

      <!-- Credits State -->
      <template v-else-if="needsCredits">
        <div class="paywall-icon">&#x2728;</div>
        <h2 class="paywall-title">You're out of credits!</h2>
        <p class="paywall-description">
          Keep snapping ingredients and discovering recipes.
        </p>

        <button
          class="subscription-option"
          :disabled="loading"
          @click="emit('subscribe')"
        >
          <span class="subscription-option-badge">Best Deal</span>
          <span class="subscription-option-credits">{{ SUBSCRIPTION.credits }}</span>
          <span class="subscription-option-label">snaps/month</span>
          <span class="subscription-option-price">{{ SUBSCRIPTION.price }}/mo</span>
          <span class="subscription-option-hint">Cancel anytime</span>
        </button>

        <div class="paywall-divider"><span>or buy once</span></div>

        <div class="credit-packs">
          <button
            v-for="(pack, key) in PACKS"
            :key="key"
            class="credit-pack"
            :class="{ 'credit-pack-featured': key === 'regular' }"
            :disabled="loading"
            @click="emit('buy', key as string)"
          >
            <span v-if="key === 'regular'" class="credit-pack-badge">Best Value</span>
            <span class="credit-pack-credits">{{ pack.credits }}</span>
            <span class="credit-pack-label">snaps</span>
            <span class="credit-pack-price">{{ pack.price }}</span>
          </button>
        </div>

        <p class="paywall-hint">One-time purchase. Credits never expire.</p>
      </template>

      <UButton
        block
        variant="ghost"
        color="neutral"
        class="mt-4 text-[var(--text-light)]"
        @click="handleClose"
      >
        Maybe later
      </UButton>
    </div>
  </UModal>
</template>

<style scoped>
.paywall-content {
  padding: 2rem;
  text-align: center;
}

.paywall-icon {
  font-size: 3rem;
  margin-bottom: 1rem;
}

.paywall-title {
  font-size: 1.25rem;
  font-weight: 600;
  margin: 0 0 0.75rem;
  color: var(--text);
}

.paywall-description {
  color: var(--text-light);
  margin: 0 0 1.5rem;
  line-height: 1.5;
}

.paywall-btn {
  width: 100%;
  padding: 0.875rem 1.5rem;
  border-radius: 0.5rem;
  font-size: 1rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  border: none;
}

.paywall-btn-social {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  background: rgba(255, 255, 255, 0.05);
  color: var(--text);
  border: 1px solid var(--border);
  margin-bottom: 0.75rem;
}

.paywall-btn-social:hover {
  background: rgba(255, 255, 255, 0.1);
}

.paywall-hint {
  font-size: 0.8rem;
  color: var(--text-light);
  margin: 0.75rem 0 0;
}

.paywall-divider {
  display: flex;
  align-items: center;
  margin: 1rem 0;
  color: var(--text-light);
  font-size: 0.8rem;
}

.paywall-divider::before,
.paywall-divider::after {
  content: '';
  flex: 1;
  height: 1px;
  background: var(--border);
}

.paywall-divider span {
  padding: 0 1rem;
}

.paywall-email-form {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.paywall-input {
  width: 100%;
  padding: 0.75rem 1rem;
  border: 1px solid var(--border);
  border-radius: 0.5rem;
  font-size: 1rem;
  background: rgba(255, 255, 255, 0.05);
  color: var(--text);
  box-sizing: border-box;
}

.paywall-input:focus {
  outline: none;
  border-color: var(--primary);
}

.paywall-error {
  color: #ef4444;
  font-size: 0.85rem;
  margin: 0;
}

.paywall-success {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
}

.paywall-success-icon {
  font-size: 2.5rem;
}

.paywall-success-text {
  font-size: 1.1rem;
  font-weight: 600;
  color: var(--text);
  margin: 0;
}

/* Subscription Option */
.subscription-option {
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.25rem;
  padding: 1.25rem;
  border-radius: 0.75rem;
  border: 2px solid var(--primary);
  background: rgba(76, 175, 80, 0.1);
  color: var(--text);
  cursor: pointer;
  transition: all 0.2s;
  position: relative;
  margin-bottom: 0.5rem;
}

.subscription-option:hover {
  background: rgba(76, 175, 80, 0.18);
}

.subscription-option:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.subscription-option-badge {
  position: absolute;
  top: -0.6rem;
  font-size: 0.65rem;
  font-weight: 600;
  background: var(--primary);
  color: white;
  padding: 0.15rem 0.5rem;
  border-radius: 1rem;
  white-space: nowrap;
}

.subscription-option-credits {
  font-size: 1.75rem;
  font-weight: 700;
}

.subscription-option-label {
  font-size: 0.8rem;
  color: var(--text-light);
}

.subscription-option-price {
  font-size: 1.1rem;
  font-weight: 600;
  margin-top: 0.25rem;
}

.subscription-option-hint {
  font-size: 0.7rem;
  color: var(--text-light);
}

/* Credit Packs */
.credit-packs {
  display: flex;
  gap: 0.75rem;
  margin-bottom: 1rem;
}

.credit-pack {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.25rem;
  padding: 1.25rem 0.5rem;
  border-radius: 0.75rem;
  border: 1px solid var(--border);
  background: rgba(255, 255, 255, 0.05);
  color: var(--text);
  cursor: pointer;
  transition: all 0.2s;
  position: relative;
}

.credit-pack:hover {
  border-color: var(--primary);
}

.credit-pack:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.credit-pack-featured {
  border-color: var(--primary);
  background: rgba(76, 175, 80, 0.1);
}

.credit-pack-badge {
  position: absolute;
  top: -0.6rem;
  font-size: 0.65rem;
  font-weight: 600;
  background: var(--primary);
  color: white;
  padding: 0.15rem 0.5rem;
  border-radius: 1rem;
  white-space: nowrap;
}

.credit-pack-credits {
  font-size: 1.5rem;
  font-weight: 700;
}

.credit-pack-label {
  font-size: 0.75rem;
  color: var(--text-light);
}

.credit-pack-price {
  font-size: 1rem;
  font-weight: 600;
  margin-top: 0.25rem;
}

.paywall-btn-primary-ui {
  background: var(--primary) !important;
}
</style>
