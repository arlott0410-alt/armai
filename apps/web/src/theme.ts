/**
 * ArmAI enterprise theme: premium super-admin; clear, readable merchant operations.
 * Design tokens for spacing and typography keep UI consistent.
 */

export const theme = {
  background: '#0B0B0B',
  surface: '#121212',
  surfaceElevated: '#1a1a1a',
  border: 'rgba(212, 175, 55, 0.2)',
  borderMuted: 'rgba(255,255,255,0.08)',

  primary: '#D4AF37',
  primaryHover: '#E5C04A',
  highlight: '#F5D67A',
  goldMuted: 'rgba(212, 175, 55, 0.5)',

  text: '#fafafa',
  textSecondary: '#a1a1aa',
  textMuted: '#71717a',

  success: '#22c55e',
  successMuted: 'rgba(34, 197, 94, 0.2)',
  warning: '#eab308',
  warningMuted: 'rgba(234, 179, 8, 0.2)',
  danger: '#ef4444',
  dangerMuted: 'rgba(239, 68, 68, 0.2)',
  info: '#3b82f6',
  infoMuted: 'rgba(59, 130, 246, 0.2)',
} as const;

/** Spacing scale (px). Use for padding, gaps, margins. */
export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

/** Typography: font size and weight for hierarchy. */
export const typography = {
  pageTitle: { fontSize: 22, fontWeight: 600, letterSpacing: '-0.02em' as const },
  sectionTitle: { fontSize: 15, fontWeight: 600, letterSpacing: '0.02em' as const },
  body: { fontSize: 14 },
  bodySmall: { fontSize: 13 },
  caption: { fontSize: 12 },
} as const;

export type Theme = typeof theme;
