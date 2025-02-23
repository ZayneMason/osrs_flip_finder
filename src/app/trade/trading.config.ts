// trading.config.ts
export interface TradingConfig {
  minVolume: number;
  minSpreadPercentage: number;
  minProfitPerItem: number;
  maxInvestment: number;
  minROI: number;
}

export const DEFAULT_CONFIG: TradingConfig = {
  minVolume: 1,          // Minimum total volume
  minSpreadPercentage: 1,  // Minimum spread as percentage
  minProfitPerItem: 1,   // Minimum profit per item in gp
  maxInvestment: 2147483647, // Maximum investment per trade
  minROI: 1               // Minimum ROI percentage
};