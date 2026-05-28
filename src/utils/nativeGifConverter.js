import { Capacitor, registerPlugin } from '@capacitor/core'

export const NativeGifConverter = registerPlugin('NativeGifConverter')

export function isNativeAndroid() {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android'
}

