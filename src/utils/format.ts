const currencyToLocaleMap: Record<string, string> = {
  INR: 'en-IN',
  USD: 'en-US',
  EUR: 'de-DE',
  GBP: 'en-GB',
  JPY: 'ja-JP',
  CAD: 'en-CA',
  AUD: 'en-AU'
};

export const formatCurrency = (amount: number, currencyCode: string = 'INR'): string => {
  const locale = currencyToLocaleMap[currencyCode] || 'en-US';
  const formatter = new Intl.NumberFormat(locale, {
    style: "currency",
    currency: currencyCode,
    maximumFractionDigits: 0
  });
  return formatter.format(amount);
};

export const formatCompactCurrency = (amount: number, currencyCode: string = 'INR'): string => {
  const locale = currencyToLocaleMap[currencyCode] || 'en-US';
  const formatter = new Intl.NumberFormat(locale, {
    style: "currency",
    currency: currencyCode,
    notation: "compact",
    compactDisplay: "short",
    maximumFractionDigits: 1
  });
  return formatter.format(amount);
};
