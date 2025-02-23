import { Injectable } from "@angular/core";
import { TradingConfig, DEFAULT_CONFIG } from "./trading.config";

export interface TimeEstimate {
  min: number;
  max: number;
  formatted: string;
}

export interface TradeTimeAnalysis {
  buyTime: TimeEstimate;
  sellTime: TimeEstimate;
  totalTime: TimeEstimate;
  confidence: number;
  factors: string[];
  advice: string[];
}

export interface TradeOpportunity {
  itemId: string;
  name: string;
  buyPrice: number;
  sellPrice: number;
  volume: number;
  profitPerItem: number;
  totalPotentialProfit: number;
  roi: number;
  buyLimit: number;
  confidence: number;
  expectedTimeToSell: string;
  priceStability: number;
  recommendedQuantity: number;
  timeAnalysis: TradeTimeAnalysis;
  icon?: string;
  confidenceToProfit: number;
}

interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

@Injectable({
  providedIn: "root",
})
export class TradeAnalyzerService {
  private readonly GE_TAX = 0.01; // 1% GE tax

  constructor() {}

  analyzeItem(
    item: any,
    config: TradingConfig = DEFAULT_CONFIG
  ): TradeOpportunity {
    const validation = this.validateTrade(item);

    const buyPrice = item.avgLowPrice;
    const sellPrice = item.avgHighPrice * (1 - this.GE_TAX);
    const profitPerItem = sellPrice - buyPrice;
    const volume = (item.highPriceVolume || 0) + (item.lowPriceVolume || 0);
    const roi = (profitPerItem / buyPrice) * 100;

    const buyLimit = item.details?.limit > 0 ? item.details?.limit : 100;
    const volumePerHour = volume;

    const confidence = this.calculateTradeConfidence(volume, item);
    const priceStability = this.calculatePriceStability(item);
    const recommendedQuantity = this.calculateRecommendedQuantity(
      volume,
      buyLimit,
      buyPrice,
      config
    );
    const expectedTimeToSell = this.calculateExpectedTimeToSell(
      volumePerHour,
      recommendedQuantity
    );
    const timeAnalysis = this.analyzeTradeTime(item);

    // Generate icon URL
    const iconName = item.details?.name
      .replaceAll(" ", "_")
      .replaceAll("'", "%27")
      .replaceAll("\\(", "%28")
      .replaceAll("\\)", "%29")
      .replaceAll("_seed", "_seed_5");
    const icon = `https://oldschool.runescape.wiki/images/${iconName}.png`;

    return {
      itemId: item.itemId,
      name: item.details?.name || item.itemId,
      buyPrice,
      sellPrice: item.avgHighPrice,
      volume,
      profitPerItem,
      totalPotentialProfit: profitPerItem * recommendedQuantity,
      roi,
      buyLimit,
      confidence,
      expectedTimeToSell,
      priceStability,
      recommendedQuantity,
      timeAnalysis,
      icon,
      confidenceToProfit:
        Math.sqrt(confidence * Math.sqrt(profitPerItem * recommendedQuantity)) /
        10,
    };
  }

  calculateTradeConfidence(volume: number, item: any): number {
    const volumeScore = Math.min(1, volume / 10000);
    const priceStability = this.calculatePriceStability(item);
    const spreadScore = Math.min(
      1,
      ((item.avgHighPrice - item.avgLowPrice) / item.avgLowPrice) * 10
    );

    return volumeScore * 0.4 + priceStability * 0.4 + (1 - spreadScore) * 0.2;
  }

  calculatePriceStability(item: any): number {
    const avgPrice = (item.avgHighPrice + item.avgLowPrice) / 2;
    const priceSpread = item.avgHighPrice - item.avgLowPrice;
    const spreadPercentage = priceSpread / avgPrice;

    return Math.max(0, 1 - spreadPercentage * 2);
  }

  private calculateRecommendedQuantity(
    volume: number,
    buyLimit: number,
    buyPrice: number,
    config: TradingConfig
  ): number {
    const volumeBasedLimit = Math.floor(volume * 0.1);
    const investmentBasedLimit = Math.floor(config.maxInvestment / buyPrice);
    const buyLimitBasedLimit = buyLimit;

    return Math.min(volumeBasedLimit, investmentBasedLimit, buyLimitBasedLimit);
  }

  private calculateExpectedTimeToSell(
    volumePerHour: number,
    quantity: number
  ): string {
    const hours = quantity / volumePerHour;

    if (hours < 1) {
      return "Less than 1 hour";
    } else if (hours < 24) {
      const roundedHours = Math.ceil(hours);
      return `~${roundedHours} hour${roundedHours > 1 ? "s" : ""}`;
    } else {
      const days = Math.ceil(hours / 24);
      return `~${days} day${days > 1 ? "s" : ""}`;
    }
  }

  validateTrade(item: any): ValidationResult {
    const errors: string[] = [];

    // Check if item exists
    if (!item) {
      errors.push("Item is undefined or null");
      return { isValid: false, errors };
    }

    // Check price data
    if (!item.avgHighPrice) {
      errors.push("Missing average high price");
    }
    if (!item.avgLowPrice) {
      errors.push("Missing average low price");
    }
    // Check if prices exist and are valid (but don't require profitable spread)
    if (item.avgHighPrice && item.avgLowPrice) {
      if (item.avgHighPrice < 0 || item.avgLowPrice < 0) {
        errors.push("Prices cannot be negative");
      }
    }

    // Check item details
    if (!item.details) {
      errors.push("Missing item details");
    } else {
      if (!item.details.limit) {
        errors.push("Missing or invalid buy limit");
      } else if (item.details.limit <= 0) {
        errors.push("Buy limit must be greater than 0");
      }
    }

    // Check volume data
    if (!item.highPriceVolume && !item.lowPriceVolume) {
      errors.push("Missing trading volume data");
    }

    // Check for negative values
    if (item.avgHighPrice < 0) {
      errors.push("High price cannot be negative");
    }
    if (item.avgLowPrice < 0) {
      errors.push("Low price cannot be negative");
    }

    // Add price volatility warning (not an error)
    if (item.avgHighPrice && item.avgLowPrice) {
      const priceSpread =
        (item.avgHighPrice - item.avgLowPrice) / item.avgLowPrice;
      if (priceSpread > 0.5) {
        console.warn(
          `High price volatility detected (${(priceSpread * 100).toFixed(
            1
          )}% spread)`
        );
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  getValidationSummary(item: any): string {
    const validation = this.validateTrade(item);
    if (validation.isValid) {
      return "Item is valid for trading";
    }
    return `Invalid trade: ${validation.errors.join("; ")}`;
  }

  analyzeTradeTime(item: any): TradeTimeAnalysis {
    const volume = (item.highPriceVolume || 0) + (item.lowPriceVolume || 0);
    const volumePerHour = volume / 24;
    const buyLimit = item.details?.limit > 0 ? item.details?.limit : 1 || 1;
    const quantity = this.calculateRecommendedQuantity(
      volume,
      buyLimit,
      item.avgLowPrice,
      DEFAULT_CONFIG
    );
    const priceStability = this.calculatePriceStability(item);

    const baseBuyTime = this.calculateBuyTime(
      quantity,
      volumePerHour,
      priceStability
    );
    const baseSellTime = this.calculateSellTime(
      quantity,
      volumePerHour,
      priceStability
    );

    const factors: string[] = [];
    const advice: string[] = [];

    if (volume < 1000) {
      factors.push("Very low trading volume");
      advice.push("Consider reducing trade size due to low volume");
    } else if (volume > 10000) {
      factors.push("High trading volume indicates good liquidity");
      advice.push("Can likely complete trades faster than estimated");
    }

    if (priceStability < 0.3) {
      factors.push("High price volatility");
      advice.push("Use multiple small orders instead of one large order");
    } else if (priceStability > 0.7) {
      factors.push("Stable price trends");
      advice.push("Can use larger order sizes safely");
    }

    if (quantity >= buyLimit) {
      factors.push("Trade size reaches buy limit");
      advice.push("Will need multiple 4-hour periods to complete purchase");
    }

    const buyTime = this.adjustTimeForBuyLimit(baseBuyTime, quantity, buyLimit);
    const sellTime = baseSellTime;
    const totalTime = this.combineTimes(buyTime, sellTime);

    const confidence = this.calculateTimeEstimateConfidence(
      volume,
      priceStability,
      quantity,
      buyLimit
    );

    return {
      buyTime,
      sellTime,
      totalTime,
      confidence,
      factors,
      advice,
    };
  }

  private calculateBuyTime(
    quantity: number,
    volumePerHour: number,
    priceStability: number
  ): TimeEstimate {
    const baseHours = quantity / volumePerHour;
    const stabilityFactor = 1 + (1 - priceStability);

    const minHours = baseHours * 0.7 * stabilityFactor;
    const maxHours = baseHours * 1.3 * stabilityFactor;

    return {
      min: minHours,
      max: maxHours,
      formatted: this.formatTimeRange(minHours, maxHours),
    };
  }

  private calculateSellTime(
    quantity: number,
    volumePerHour: number,
    priceStability: number
  ): TimeEstimate {
    const sellFactor = 1.2;
    const baseHours = (quantity / volumePerHour) * sellFactor;
    const stabilityFactor = 1 + (1 - priceStability);

    const minHours = baseHours * 0.7 * stabilityFactor;
    const maxHours = baseHours * 1.3 * stabilityFactor;

    return {
      min: minHours,
      max: maxHours,
      formatted: this.formatTimeRange(minHours, maxHours),
    };
  }

  private adjustTimeForBuyLimit(
    time: TimeEstimate,
    quantity: number,
    buyLimit: number
  ): TimeEstimate {
    if (quantity <= buyLimit) {
      return time;
    }

    const periodsNeeded = Math.ceil(quantity / buyLimit);
    const limitHours = periodsNeeded * 4;

    return {
      min: Math.max(time.min, limitHours),
      max: Math.max(time.max, limitHours * 1.2),
      formatted: this.formatTimeRange(
        Math.max(time.min, limitHours),
        Math.max(time.max, limitHours * 1.2)
      ),
    };
  }

  private combineTimes(
    buyTime: TimeEstimate,
    sellTime: TimeEstimate
  ): TimeEstimate {
    return {
      min: buyTime.min + sellTime.min,
      max: buyTime.max + sellTime.max,
      formatted: this.formatTimeRange(
        buyTime.min + sellTime.min,
        buyTime.max + sellTime.max
      ),
    };
  }

  private calculateTimeEstimateConfidence(
    volume: number,
    priceStability: number,
    quantity: number,
    buyLimit: number
  ): number {
    let confidence = 1.0;

    if (volume < 1000) confidence *= 0.7;
    else if (volume < 5000) confidence *= 0.85;
    else if (volume > 20000) confidence *= 1.1;

    confidence *= 0.5 + priceStability / 2;

    if (quantity > buyLimit) {
      confidence *= 0.9;
    }

    return Math.min(1, Math.max(0, confidence));
  }

  private formatTimeRange(minHours: number, maxHours: number): string {
    const formatTime = (hours: number): string => {
      if (hours < 1) return "Less than 1 hour";
      if (hours < 24) return `${Math.ceil(hours)} hours`;
      const days = Math.ceil(hours / 24);
      return `${days} day${days > 1 ? "s" : ""}`;
    };

    if (Math.floor(minHours) === Math.floor(maxHours)) {
      return formatTime(minHours);
    }

    return `${formatTime(minHours)} - ${formatTime(maxHours)}`;
  }

  getVolumeAnalysis(volume: number, buyLimit: number): string {
    const volumePerHour = volume / 24;
    const analysisPoints = [];

    if (volumePerHour < buyLimit / 24) {
      analysisPoints.push(
        "Trading volume is lower than the buy limit, suggesting potential delays in completing trades."
      );
    } else {
      analysisPoints.push(
        "Good trading volume relative to buy limit, indicating potential for quick trades."
      );
    }

    if (volume > 10000) {
      analysisPoints.push("High daily volume suggests excellent liquidity.");
    } else if (volume > 5000) {
      analysisPoints.push("Moderate daily volume indicates decent liquidity.");
    } else if (volume > 1000) {
      analysisPoints.push(
        "Low daily volume suggests caution when trading larger quantities."
      );
    } else {
      analysisPoints.push(
        "Very low daily volume indicates high risk of delayed trades."
      );
    }

    return analysisPoints.join(" ");
  }

  getTradingAdvice(
    volume: number,
    priceStability: number,
    confidence: number
  ): string {
    const advice = [];

    if (volume > 10000) {
      advice.push("High volume makes this item suitable for frequent trading.");
    } else if (volume < 1000) {
      advice.push(
        "Low volume suggests this item is better for patient traders."
      );
    }

    if (priceStability > 0.8) {
      advice.push("Price stability is high, making this a lower-risk trade.");
    } else if (priceStability < 0.5) {
      advice.push(
        "Price volatility suggests higher risk but potential for better profits."
      );
    }

    if (confidence > 0.8) {
      advice.push(
        "High confidence rating suggests this is a reliable trading opportunity."
      );
    } else if (confidence < 0.5) {
      advice.push(
        "Lower confidence rating indicates careful monitoring is recommended."
      );
    }

    return advice.join(" ");
  }
}
