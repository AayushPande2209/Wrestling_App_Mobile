export const colors = {
  bg: '#000000',
  surface: '#1C1C1E',
  surfaceElevated: '#2C2C2E',
  separator: '#38383A',
  accent: '#FF6B2C',
  accentMuted: 'rgba(255, 107, 44, 0.15)',
  text: '#FFFFFF',
  textSecondary: '#8E8E93',
  textTertiary: '#636366',
  success: '#30D158',
  successMuted: 'rgba(48, 209, 88, 0.15)',
  error: '#FF453A',
  errorMuted: 'rgba(255, 69, 58, 0.15)',
  warning: '#FFD60A',
}

export const typography = {
  largeTitle: { fontSize: 34, fontWeight: '700', lineHeight: 41, color: colors.text },
  title1: { fontSize: 28, fontWeight: '700', lineHeight: 34, color: colors.text },
  title2: { fontSize: 22, fontWeight: '700', lineHeight: 28, color: colors.text },
  headline: { fontSize: 17, fontWeight: '600', lineHeight: 22, color: colors.text },
  body: { fontSize: 17, fontWeight: '400', lineHeight: 22, color: colors.text },
  callout: { fontSize: 16, fontWeight: '400', lineHeight: 21, color: colors.text },
  subhead: { fontSize: 15, fontWeight: '400', lineHeight: 20, color: colors.textSecondary },
  footnote: { fontSize: 13, fontWeight: '400', lineHeight: 18, color: colors.textSecondary },
  caption: { fontSize: 12, fontWeight: '400', lineHeight: 16, color: colors.textTertiary },
  stat: {
    fontSize: 34,
    fontWeight: '700',
    lineHeight: 41,
    color: colors.text,
    fontVariant: ['tabular-nums'],
  },
}

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
}

export const radii = {
  sm: 8,
  md: 12,
  lg: 16,
  full: 999,
}

export const shadows = {
  card: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
}

export const hitSlop = { top: 8, bottom: 8, left: 8, right: 8 }

export const MIN_TOUCH = 44
