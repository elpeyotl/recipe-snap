export function usePlatform() {
  const isNative = (): boolean => {
    if (!import.meta.client) return false
    return (window as any).Capacitor !== undefined
  }

  const isWeb = (): boolean => {
    return !isNative()
  }

  const getPlatform = (): string => {
    if (isNative()) {
      return (window as any).Capacitor.getPlatform() // 'ios', 'android', or 'web'
    }
    return 'web'
  }

  return {
    isNative,
    isWeb,
    getPlatform
  }
}
