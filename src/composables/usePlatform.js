// Platform detection utility
export function usePlatform() {
  const isNative = () => {
    return window.Capacitor !== undefined
  }

  const isWeb = () => {
    return !isNative()
  }

  const getPlatform = () => {
    if (isNative()) {
      return window.Capacitor.getPlatform() // 'ios', 'android', or 'web'
    }
    return 'web'
  }

  return {
    isNative,
    isWeb,
    getPlatform
  }
}
