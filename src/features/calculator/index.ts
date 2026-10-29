/** Public surface of the financial calculator feature. */

export {
  annuityPresentValue,
  futureValue,
  netPresentValue,
  parseCashFlows,
  presentValue,
  type Calculation,
} from './finance';
export {
  closestTreasury,
  describeTerm,
  fetchTreasuryRates,
  useTreasuryRates,
  type TreasuryRates,
  type TreasuryYield,
} from './treasury';
