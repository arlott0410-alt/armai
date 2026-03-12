/**
 * ArmAI Enterprise theme: neutral palette (#0070f3, #f0f0f0, #4caf50).
 * Use for inline styles; CSS vars in index.css for Tailwind/dark mode.
 */

export const theme = {
  background: 'var(--armai-bg)',
  surface: 'var(--armai-surface)',
  surfaceElevated: 'var(--armai-surface-elevated)',
  border: 'var(--armai-border)',
  borderMuted: 'var(--armai-border-muted)',

  primary: '#0070f3',
  primaryHover: '#0060df',
  highlight: '#0070f3',
  goldMuted: 'rgba(0, 112, 243, 0.2)',
  secondary: '#f0f0f0',
  accent: '#4caf50',
  accentHover: '#43a047',

  text: 'var(--armai-text)',
  textSecondary: 'var(--armai-text-secondary)',
  textMuted: 'var(--armai-text-muted)',

  success: '#4caf50',
  successMuted: 'rgba(76, 175, 80, 0.2)',
  warning: '#eab308',
  warningMuted: 'rgba(234, 179, 8, 0.2)',
  danger: '#ef4444',
  dangerMuted: 'rgba(239, 68, 68, 0.2)',
  info: '#0070f3',
  infoMuted: 'rgba(0, 112, 243, 0.15)',
} as const

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const

export const typography = {
  pageTitle: { fontSize: 22, fontWeight: 600, letterSpacing: '-0.02em' as const },
  sectionTitle: { fontSize: 15, fontWeight: 600, letterSpacing: '0.02em' as const },
  body: { fontSize: 14 },
  bodySmall: { fontSize: 13 },
  caption: { fontSize: 12 },
} as const

export type Theme = typeof theme
