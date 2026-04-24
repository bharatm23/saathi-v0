import { fitbitProvider } from './fitbit'
// Add new providers here — one line each:
// import { whoopProvider } from './whoop'
import { garminProvider } from './garmin'
import { ultrahumanProvider } from './ultrahuman'

export const providers = {
  fitbit: fitbitProvider,
  // whoop: whoopProvider,
  garmin: garminProvider,
  ultrahuman: ultrahumanProvider,
} as const

export type ProviderId = keyof typeof providers
export { type ProviderConfig, type HealthMetric } from './types'