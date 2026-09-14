import type { BottomNavItem } from './BottomNav.tsx'

import { HomeIcon, SlidersIcon, ClipboardIcon, CalendarIcon, CreditCardIcon, ChatIcon, StarNavIcon, BarChartIcon, NewspaperIcon } from './BottomNavIcons.tsx'

export const ADMIN_BOTTOM_NAV: readonly BottomNavItem[] = [
  { value: 'overview', label: 'Overview', icon: (a) => <HomeIcon active={a} /> },
  { value: 'manage', label: 'Manage', icon: (a) => <SlidersIcon active={a} /> },
  { value: 'posts', label: 'Posts', icon: (a) => <NewspaperIcon active={a} /> },
  { value: 'billing', label: 'Billing', icon: (a) => <CreditCardIcon active={a} /> },
  { value: 'messages', label: 'Messages', icon: (a) => <ChatIcon active={a} /> },
]

export const COACH_BOTTOM_NAV: readonly BottomNavItem[] = [
  { value: 'schedule', label: 'Schedule', icon: (a) => <CalendarIcon active={a} /> },
  { value: 'squad', label: 'Squad', icon: (a) => <ClipboardIcon active={a} /> },
  { value: 'stats', label: 'Stats', icon: (a) => <BarChartIcon active={a} /> },
  { value: 'feed', label: 'Feed', icon: (a) => <NewspaperIcon active={a} /> },
  { value: 'messages', label: 'Messages', icon: (a) => <ChatIcon active={a} /> },
]

export const PARENT_BOTTOM_NAV: readonly BottomNavItem[] = [
  { value: 'schedule', label: 'Schedule', icon: (a) => <CalendarIcon active={a} /> },
  { value: 'development', label: 'Development', icon: (a) => <StarNavIcon active={a} /> },
  { value: 'children', label: 'My children', icon: (a) => <ClipboardIcon active={a} /> },
  { value: 'feed', label: 'Feed', icon: (a) => <NewspaperIcon active={a} /> },
  { value: 'messages', label: 'Messages', icon: (a) => <ChatIcon active={a} /> },
]

/** Senior / self-registered player portal (matches `PlayerTab` values). */
export const PLAYER_BOTTOM_NAV: readonly BottomNavItem[] = [
  { value: 'schedule', label: 'Schedule', icon: (a) => <CalendarIcon active={a} /> },
  { value: 'feed', label: 'Feed', icon: (a) => <NewspaperIcon active={a} /> },
  { value: 'profile', label: 'Profile', icon: (a) => <ClipboardIcon active={a} /> },
  { value: 'billing', label: 'Billing', icon: (a) => <CreditCardIcon active={a} /> },
  { value: 'messages', label: 'Messages', icon: (a) => <ChatIcon active={a} /> },
]
