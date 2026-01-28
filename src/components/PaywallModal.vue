<script setup>
import { ref } from 'vue'
import { useMonetization } from '../composables/useMonetization'

const emit = defineEmits(['close', 'unlocked'])

const { validateCode, getPaywallType } = useMonetization()

const unlockCode = ref('')
const codeError = ref('')
const showCodeInput = ref(false)

const BMC_URL = 'https://buymeacoffee.com/elpeyotl'

const handleCodeSubmit = () => {
  codeError.value = ''
  if (validateCode(unlockCode.value)) {
    emit('unlocked')
    emit('close')
  } else {
    codeError.value = 'Invalid code. Please check and try again.'
  }
}

const openBMC = () => {
  window.open(BMC_URL, '_blank')
}
</script>

<template>
  <div class="paywall-overlay" @click.self="$emit('close')">
    <div class="paywall-modal">
      <button class="paywall-close" @click="$emit('close')">×</button>

      <div class="paywall-icon">🍳</div>

      <h2 class="paywall-title">You've used your free snaps!</h2>

      <p class="paywall-description">
        Support Recipe Snap to unlock unlimited ingredient scanning and recipe suggestions.
      </p>

      <template v-if="getPaywallType() === 'buymeacoffee'">
        <button class="paywall-btn paywall-btn-primary" @click="openBMC">
          ☕ Buy Me a Coffee
        </button>

        <p class="paywall-hint">
          After supporting, you'll receive an unlock code via email.
        </p>

        <div class="paywall-divider">
          <span>or</span>
        </div>

        <button
          v-if="!showCodeInput"
          class="paywall-btn paywall-btn-secondary"
          @click="showCodeInput = true"
        >
          I have an unlock code
        </button>

        <div v-else class="paywall-code-form">
          <input
            v-model="unlockCode"
            type="text"
            placeholder="Enter unlock code"
            class="paywall-code-input"
            @keyup.enter="handleCodeSubmit"
          />
          <button class="paywall-btn paywall-btn-primary" @click="handleCodeSubmit">
            Unlock
          </button>
          <p v-if="codeError" class="paywall-error">{{ codeError }}</p>
        </div>
      </template>

      <template v-else>
        <button class="paywall-btn paywall-btn-primary">
          Unlock Unlimited - $2.99
        </button>
        <p class="paywall-hint">One-time purchase. No subscription.</p>
      </template>
    </div>
  </div>
</template>

<style scoped>
.paywall-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.7);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 1rem;
}

.paywall-modal {
  background: var(--card-bg);
  border-radius: 1rem;
  padding: 2rem;
  max-width: 400px;
  width: 100%;
  text-align: center;
  position: relative;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.4);
}

.paywall-close {
  position: absolute;
  top: 0.75rem;
  right: 0.75rem;
  background: none;
  border: none;
  font-size: 1.5rem;
  color: var(--text-secondary);
  cursor: pointer;
  width: 2rem;
  height: 2rem;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  transition: background 0.2s;
}

.paywall-close:hover {
  background: var(--bg-secondary);
}

.paywall-icon {
  font-size: 3rem;
  margin-bottom: 1rem;
}

.paywall-title {
  font-size: 1.25rem;
  font-weight: 600;
  margin: 0 0 0.75rem;
  color: var(--text-primary);
}

.paywall-description {
  color: var(--text-secondary);
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

.paywall-btn-primary {
  background: var(--primary);
  color: white;
}

.paywall-btn-primary:hover {
  background: var(--primary-dark);
}

.paywall-btn-secondary {
  background: transparent;
  color: var(--text-secondary);
  border: 1px solid var(--border);
}

.paywall-btn-secondary:hover {
  background: var(--bg-secondary);
  color: var(--text-primary);
}

.paywall-hint {
  font-size: 0.8rem;
  color: var(--text-secondary);
  margin: 0.75rem 0 0;
}

.paywall-divider {
  display: flex;
  align-items: center;
  margin: 1.25rem 0;
  color: var(--text-secondary);
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

.paywall-code-form {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.paywall-code-input {
  width: 100%;
  padding: 0.75rem 1rem;
  border: 1px solid var(--border);
  border-radius: 0.5rem;
  font-size: 1rem;
  background: var(--bg-secondary);
  color: var(--text-primary);
  text-align: center;
  letter-spacing: 0.1em;
}

.paywall-code-input:focus {
  outline: none;
  border-color: var(--primary);
}

.paywall-error {
  color: #ef4444;
  font-size: 0.85rem;
  margin: 0;
}
</style>
