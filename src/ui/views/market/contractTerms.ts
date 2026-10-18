import { GOOD_CONTENT, type Treaty } from '../../../sim';
import { formatCroreFine } from '../../format';
import { t } from '../../i18n';

/** "India sells 2 Mt of steel a month at ₹4,900 cr" for a goods supply contract (a trade treaty with a good). */
export function contractTerms(treaty: Treaty): string {
  const { good, side, quantity, price } = treaty.terms;
  if (!good || !side) return '';
  return t('market.contractTerms', {
    side: t(`market.sides.${side}`),
    quantity: quantity ?? 0,
    unit: GOOD_CONTENT[good].unit,
    good: GOOD_CONTENT[good].name.toLowerCase(),
    price: formatCroreFine(price ?? 0),
  });
}
