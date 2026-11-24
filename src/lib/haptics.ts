/**
 * Lightweight, zero-cost haptic feedback helper for mobile PWA interactions.
 * Uses native Web Vibration API safely when available.
 */
export function triggerHaptic(type: 'light' | 'medium' | 'success' | 'warning' = 'light') {
  if (typeof window !== 'undefined' && 'vibrate' in navigator && typeof navigator.vibrate === 'function') {
    try {
      if (type === 'light') {
        navigator.vibrate(12);
      } else if (type === 'medium') {
        navigator.vibrate(25);
      } else if (type === 'success') {
        navigator.vibrate([15, 40, 20]);
      } else if (type === 'warning') {
        navigator.vibrate([30, 50, 30]);
      }
    } catch {
      // Ignore vibration errors on unsupported or muted devices
    }
  }
}
