import {
  DollarSign,
  PoundSterling,
  Euro,
  JapaneseYen,
  IndianRupee,
} from "lucide-react";

/**
 * Map a currency code to the matching lucide icon.
 *
 * Prevents a $ glyph from appearing next to a £- or €-formatted value,
 * which was confusing readers into thinking the underlying number was
 * in USD. Falls back to $ for unknown codes and for USD itself.
 */
export function getCurrencyIcon(currency: string | null | undefined, size: number) {
  switch ((currency ?? "USD").toUpperCase()) {
    case "GBP":
      return <PoundSterling size={size} />;
    case "EUR":
      return <Euro size={size} />;
    case "JPY":
      return <JapaneseYen size={size} />;
    case "INR":
      return <IndianRupee size={size} />;
    case "USD":
    default:
      return <DollarSign size={size} />;
  }
}
