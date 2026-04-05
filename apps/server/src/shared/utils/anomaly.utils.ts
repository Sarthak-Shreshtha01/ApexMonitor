/**
 * Calculates the Z-Score of a value against a historical dataset.
 * A Z-Score > 3 is generally considered a significant anomaly.
 */
export function calculateZScore(currentValue: number, history: number[]): number {
  if (history.length < 5) return 0; // Not enough data points to form a baseline

  const mean = history.reduce((acc, val) => acc + val, 0) / history.length;
  
  // Calculate Standard Deviation
  const variance = history.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / history.length;
  const standardDeviation = Math.sqrt(variance);

  if (standardDeviation === 0) return 0; // Prevent division by zero if all historical values are identical

  return (currentValue - mean) / standardDeviation;
}