/**
 * ClubOS subscription packages and feature entitlements.
 *
 * Prices and allocations are provisional and live only in this catalogue.
 * Code should ask `hasFeature()` rather than test plan names or prices.
 * ClubOS subscription revenue is separate from membership fees a club
 * collects from its own members through its own Stripe account.
 */
import type { RegistryClub } from './registry.ts'

export const FEATURES = [
  'coreManagement',
  'registration',
  'attendance',
  'communication',
  'basicPayments',
  'playerDevelopment',
  'advancedFinance',
  'associationIntegrations',
  'advancedAdmin',
  'websiteBuilder',
  'mediaStudio',
  'customDomain',
  'advancedAutomation',
] as const
export type Feature = (typeof FEATURES)[number]

export interface Plan {
  id: string
  name: string
  /** Monthly price in pence (GBP). Display only; billing uses the operator's Stripe catalogue. */
  monthlyPricePence: number
  features: readonly Feature[]
}

const STARTER: readonly Feature[] = ['coreManagement', 'registration', 'attendance', 'communication', 'basicPayments']
const CLUB: readonly Feature[] = [...STARTER, 'playerDevelopment', 'advancedFinance', 'associationIntegrations', 'advancedAdmin']
const COMPLETE: readonly Feature[] = [...CLUB, 'websiteBuilder', 'mediaStudio', 'customDomain', 'advancedAutomation']

/** Provisional catalogue. Change here only; never hard-code these elsewhere. */
export const DEFAULT_PLANS: readonly Plan[] = [
  { id: 'starter', name: 'Starter', monthlyPricePence: 1900, features: STARTER },
  { id: 'club', name: 'Club', monthlyPricePence: 3900, features: CLUB },
  { id: 'complete', name: 'Complete', monthlyPricePence: 6900, features: COMPLETE },
]

export function isFeature(value: string): value is Feature {
  return (FEATURES as readonly string[]).includes(value)
}

/**
 * Effective features for a club: its plan's features plus operator overrides.
 * A club with no registry entry (a standalone deployment such as Ambassadors FC
 * today) keeps every feature so existing behaviour is unchanged. A club with an
 * unknown plan gets the core features only, never everything.
 */
export function resolveFeatures(club: RegistryClub | null, plans: readonly Plan[] = DEFAULT_PLANS): Set<Feature> {
  if (!club) return new Set(FEATURES)
  const plan = club.plan ? plans.find((candidate) => candidate.id === club.plan) : undefined
  const features = new Set<Feature>(plan?.features ?? STARTER)
  for (const [key, enabled] of Object.entries(club.features ?? {})) {
    if (!isFeature(key)) continue
    if (enabled) features.add(key)
    else features.delete(key)
  }
  return features
}

export function hasFeature(club: RegistryClub | null, feature: Feature, plans: readonly Plan[] = DEFAULT_PLANS): boolean {
  return resolveFeatures(club, plans).has(feature)
}

export function formatPlanPrice(plan: Plan): string {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(plan.monthlyPricePence / 100)
}
