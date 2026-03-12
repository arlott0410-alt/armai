/**
 * ArmAI Enterprise theme: luxury palette — gold #D4AF37, velvet black #1A1A1A.
 * Use for inline styles; CSS vars in index.css for Tailwind/dark mode.
 */

export const theme = {
  background: 'var(--armai-bg)',
  surface: 'var(--armai-surface)',
  surfaceElevated: 'var(--armai-surface-elevated)',
  border: 'var(--armai-border)',
  borderMuted: 'var(--armai-border-muted)',

  primary: '#D4AF37',
  primaryHover: '#B8860B',
  highlight: '#D4AF37',
  goldMuted: 'rgba(212, 175, 55, 0.2)',
  goldGlow: 'rgba(212, 175, 55, 0.3)',
  secondary: '#1A1A1A',
  accent: '#FFFFFF',
  accentHover: '#f0f0f0',

  text: 'var(--armai-text)',
  textSecondary: 'var(--armai-text-secondary)',
  textMuted: 'var(--armai-text-muted)',

  success: '#22c55e',
  successMuted: 'rgba(34, 197, 94, 0.2)',
  warning: '#eab308',
  warningMuted: 'rgba(234, 179, 8, 0.2)',
  danger: '#ef4444',
  dangerMuted: 'rgba(239, 68, 68, 0.2)',
  info: '#D4AF37',
  infoMuted: 'rgba(212, 175, 55, 0.15)',
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
