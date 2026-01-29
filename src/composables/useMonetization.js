import { ref } from 'vue'
import { usePlatform } from './usePlatform'

const FREE_SNAPS = 3
const UNLOCK_CODE = import.meta.env.VITE_UNLOCK_CODE || ''
const LIMIT_SNAPS = import.meta.env.VITE_LIMIT_SNAPS !== 'false' // defaults to true, set VITE_LIMIT_SNAPS=false to disable
const STORAGE_KEY_SNAPS = 'recipe-snap-count'
const STORAGE_KEY_UNLOCKED = 'recipe-snap-unlocked'

// Shared state (singleton) - created once, shared across all useMonetization() calls
const snapCount = ref(parseInt(localStorage.getItem(STORAGE_KEY_SNAPS) || '0'))
const isUnlocked = ref(localStorage.getItem(STORAGE_KEY_UNLOCKED) === 'true')

export function useMonetization() {
  const { isWeb } = usePlatform()

  const incrementSnap = () => {
    snapCount.value++
    localStorage.setItem(STORAGE_KEY_SNAPS, snapCount.value.toString())
  }

  const shouldShowPaywall = () => {
    if (!LIMIT_SNAPS) return false
    if (isUnlocked.value) return false
    return snapCount.value >= FREE_SNAPS
  }

  const getRemainingFreeSnaps = () => {
    if (!LIMIT_SNAPS) return Infinity
    if (isUnlocked.value) return Infinity
    return Math.max(0, FREE_SNAPS - snapCount.value)
  }

  const validateCode = (code) => {
    console.log('Entered code:', code.trim().toUpperCase())
    console.log('Expected code:', UNLOCK_CODE)
    if (!UNLOCK_CODE || !code.trim()) {
      console.log('Empty code or unlock code not set')
      return false
    }
    const isValid = code.trim().toUpperCase() === UNLOCK_CODE.toUpperCase()
    console.log('Is valid:', isValid)
    if (isValid) {
      isUnlocked.value = true
      localStorage.setItem(STORAGE_KEY_UNLOCKED, 'true')
    }
    return isValid
  }

  const unlock = () => {
    isUnlocked.value = true
    localStorage.setItem(STORAGE_KEY_UNLOCKED, 'true')
  }

  const getPaywallType = () => {
    return isWeb() ? 'buymeacoffee' : 'iap'
  }

  return {
    snapCount,
    isUnlocked,
    incrementSnap,
    shouldShowPaywall,
    getRemainingFreeSnaps,
    validateCode,
    unlock,
    getPaywallType,
    FREE_SNAPS
  }
}
