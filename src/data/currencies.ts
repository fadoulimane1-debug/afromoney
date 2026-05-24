/** Devises alignées sur vos classeurs AFROMONEY (STOCK / suivi). */
export type CurrencyCode =
  | 'EUR'
  | 'USD'
  | 'GBP'
  | 'CAD'
  | 'SAR'
  | 'AED'
  | 'CHF'
  | 'MAD'
  | 'KWD'
  | 'QAR'
  | 'BHD'

export type CurrencyRow = {
  code: CurrencyCode
  label: string
  flag: string
  buy: string
  sell: string
}

export const DISPLAY_CURRENCIES: CurrencyRow[] = [
  { code: 'EUR', label: 'Euro', flag: '🇪🇺', buy: '10,58', sell: '10,84' },
  { code: 'USD', label: 'Dollar US', flag: '🇺🇸', buy: '9,05', sell: '9,38' },
  { code: 'GBP', label: 'Livre', flag: '🇬🇧', buy: '12,10', sell: '12,42' },
  { code: 'CAD', label: 'Dollar CAN', flag: '🇨🇦', buy: '6,42', sell: '6,78' },
  { code: 'SAR', label: 'Riyal', flag: '🇸🇦', buy: '2,38', sell: '2,58' },
  { code: 'AED', label: 'Dirham UAE', flag: '🇦🇪', buy: '2,44', sell: '2,62' },
  { code: 'CHF', label: 'Franc suisse', flag: '🇨🇭', buy: '11,20', sell: '11,55' },
  { code: 'MAD', label: 'Dirham', flag: '🇲🇦', buy: '1,00', sell: '1,00' },
]
