/**
 * LAK (Lao Kip) formatting for Laos launch. Use everywhere for prices.
 */
export const formatLAK = (value: number): string =>
  new Intl.NumberFormat('lo-LA', {
    style: 'currency',
    currency: 'LAK',
    maximumFractionDigits: 0,
  }).format(value)

export const LAK_FORMAT = new Intl.NumberFormat('lo-LA', { maximumFractionDigits: 0 })
