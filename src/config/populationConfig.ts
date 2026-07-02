export const POPULATION_CONFIG = {
  categories: {
    small: { min: 2_000_000, max: 15_000_000 },
    medium: { min: 15_000_000, max: 60_000_000 },
    large: { min: 60_000_000, max: 150_000_000 },
    superpower: { min: 150_000_000, max: 400_000_000 }
  },
  baseRates: {
    birthRate: 0.02, // 2% per tick/year
    deathRate: 0.008, // 0.8% per tick/year
    conscriptablePercentage: 0.15, // 15% of total population can be conscripted
  },
  effects: {
    warDeathRateMultiplier: 3.5, // Wars increase death rate
    famineDeathRateMultiplier: 5.0, // Famines heavily increase death rate
    bombingDeathRateMultiplier: 10.0, // Bombings devastate local population
    diseaseDeathRateMultiplier: 7.0, // Diseases spread
    peaceGrowthMultiplier: 1.2, // Faster growth in peace
    loyaltyChangeWar: -1, // Loyalty drops slightly per tick in long wars
    loyaltyChangePeace: +0.5, // Loyalty increases slowly in peace
  },
  // Scale thresholds (for calculating buffs/debuffs)
  scaling: {
    taxIncomePerMillion: 50, // Gold per 1M civilians
    resourceProductionBoostPerMillion: 0.01, // 1% boost per 1M civilians
    militaryStrengthBoostPerMillion: 0.005, // 0.5% boost to raw strength per 1M
    recruitmentSpeedBoostPerMillion: 0.02, // 2% faster recruitment per 1M
    buildingSpeedBoostPerMillion: 0.015, // 1.5% faster building per 1M
    researchSpeedBoostPerMillion: 0.02, // 2% faster research per 1M
  }
};

export function initPopulationSystem(basePop: number) {
  // Add some randomness to starting numbers for variation
  const variance = 0.9 + Math.random() * 0.2; // 0.9 to 1.1
  const total = Math.floor(basePop * variance);
  
  // Calculate civilian vs conscriptable
  const conscriptable = Math.floor(total * POPULATION_CONFIG.baseRates.conscriptablePercentage);
  const civilian = total - conscriptable;
  
  return {
    total,
    civilian,
    conscriptable,
    birthRate: POPULATION_CONFIG.baseRates.birthRate,
    deathRate: POPULATION_CONFIG.baseRates.deathRate,
    growthRate: POPULATION_CONFIG.baseRates.birthRate - POPULATION_CONFIG.baseRates.deathRate,
    happiness: 60 + Math.floor(Math.random() * 20), // 60-80
    education: 50 + Math.floor(Math.random() * 30), // 50-80
    health: 60 + Math.floor(Math.random() * 25), // 60-85
    loyalty: 70 + Math.floor(Math.random() * 20), // 70-90
    density: 20 + Math.floor(Math.random() * 100), // generic initial value
  };
}
