import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.copilotsecurity.guard',
  appName: 'CO PILOT GUARD',
  webDir: 'dist',
  server: { androidScheme: 'https' },
  plugins: { PushNotifications: { presentationOptions: ['badge', 'sound', 'alert'] } },
}

export default config
