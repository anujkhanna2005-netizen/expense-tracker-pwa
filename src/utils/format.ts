export const formatCurrency = (amount: number, currencySymbol: string = '₹'): string => {
  const formatter = new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0
  });
  
  const formatted = formatter.format(amount);
  
  if (currencySymbol !== '₹') {
    return formatted.replace('₹', currencySymbol);
  }
  return formatted;
};

export const formatCompactCurrency = (amount: number, currencySymbol: string = '₹'): string => {
  const formatter = new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    notation: "compact",
    compactDisplay: "short",
    maximumFractionDigits: 1
  });
  
  let formatted = formatter.format(amount);
  
  if (currencySymbol !== '₹') {
    return formatted.replace('₹', currencySymbol);
  }
  return formatted;
};
