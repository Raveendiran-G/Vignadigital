/** All money is stored as integer paise. Never use floats for currency. */
export const inr = (paise: number) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: paise % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(paise / 100);

/** Thermal printers often lack the ₹ glyph, so receipts use "Rs.". */
export const rs = (paise: number) => `Rs.${(paise / 100).toFixed(2)}`;

export function totals(subtotalPaise: number, gstRatePercent: number) {
  const gst = Math.round((subtotalPaise * gstRatePercent) / 100);
  return { subtotal: subtotalPaise, gst, total: subtotalPaise + gst };
}
