import { Component, OnInit } from "@angular/core";
import { CommonModule } from "@angular/common";
import { ActivatedRoute, Router } from "@angular/router";
import { invoke } from "@tauri-apps/api/core";
import {
  TradeAnalyzerService,
  TradeOpportunity,
} from "../trade/trade-analyzer.service";
import { DEFAULT_CONFIG } from "../trade/trading.config";

interface ItemDetailData {
  priceData: {
    avgHighPrice: number;
    avgLowPrice: number;
    highPriceVolume: number;
    lowPriceVolume: number;
  };
  details: {
    name: string;
    examine: string;
    members: boolean;
    limit: number;
    highalch: number;
    icon: string;
  };
  tradeOpportunity: TradeOpportunity;
}

@Component({
  selector: "app-item-detail",
  standalone: true,
  imports: [CommonModule],
  templateUrl: './item-detail.component.html',
})
export class ItemDetailComponent implements OnInit {
  getTradeStatusClasses(): string {
    if (!this.item?.tradeOpportunity) {
      return "bg-gray-900/20 border-l-4 border-gray-500";
    }
    return this.item.tradeOpportunity.profitPerItem > 0
      ? "bg-green-900/20 border-l-4 border-green-500"
      : "bg-red-900/20 border-l-4 border-red-500";
  }

  getTradeStatusTextClass(): string {
    if (!this.item?.tradeOpportunity) {
      return "text-gray-500";
    }
    return this.item.tradeOpportunity.profitPerItem > 0
      ? "text-green-500"
      : "text-red-500";
  }

  getTradeStatusTitle(): string {
    if (!this.item?.tradeOpportunity) {
      return "Trading Analysis Unavailable";
    }
    return this.item.tradeOpportunity.profitPerItem > 0
      ? "Profitable Trade"
      : "Losing Trade";
  }

  getTradeStatusDescription(): string {
    if (!this.item?.tradeOpportunity) {
      const hasErrors = this.validationErrors.length > 0;
      return hasErrors
        ? "Unable to analyze trade due to data validation issues."
        : "Unable to perform trade analysis for this item.";
    }
    return this.item.tradeOpportunity.profitPerItem > 0
      ? "This item currently shows potential for profit."
      : "This item would result in a loss at current prices.";
  }
  item: ItemDetailData | null = null;
  loading = true;
  error: string | null = null;
  validationErrors: string[] = [];
  warnings: string[] = [];
  volumeAnalysis: string = "";
  tradingAdvice: string = "";

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private tradeAnalyzer: TradeAnalyzerService
  ) {}

  ngOnInit() {
    const itemId = this.route.snapshot.paramMap.get("id");
    if (itemId) {
      this.loadItemData(itemId);
    } else {
      this.error = "No item ID provided";
      this.loading = false;
    }
  }

  getItemIconUrl(item: ItemDetailData): string {
    if (!item.details?.name) return '';
    return `https://oldschool.runescape.wiki/images/${item.details.name
      .replaceAll(' ', '_')
      .replaceAll('\'', '%27')
      .replaceAll('(', '%28')
      .replaceAll(')', '%29')}.png`;
  }

  calculateTotalVolume(priceData: any): number {
    if (!priceData) return 0;
    return (priceData.highPriceVolume || 0) + (priceData.lowPriceVolume || 0);
  }

  private async loadItemData(itemId: string) {
    try {
      console.log("Loading data for item ID:", itemId);
      this.resetErrors();

      // Fetch mapping data
      let mappingData;
      try {
        mappingData = (await invoke<any[]>("get_item_mapping"));
        console.log("Mapping data received:", mappingData);
      } catch (mappingError) {
        console.error("Error fetching item mapping:", mappingError);
        throw new Error("Failed to fetch item mapping data from the server");
      }

      // Fetch price data
      let priceData;
      try {
        const response = await invoke<any>("get_all_items");
        console.log("Price data received:", response);
        priceData = response.data;
      } catch (priceError) {
        console.error("Error fetching price data:", priceError);
        throw new Error("Failed to fetch price data from the server");
      }

      // Find item details
      const details = Array.isArray(mappingData)
        ? mappingData.find((m) => m.id.toString() === itemId)
        : null;

      details.limit > 0 ? details.limit : details.limit = 1;
      const itemPriceData = priceData?.[itemId];

      console.log("Found item details:", details);
      console.log("Found item price data:", itemPriceData);

      if (!itemPriceData || !details) {
        throw new Error(`Item ${itemId} was not found in the database`);
      }

      const itemForAnalysis = {
        itemId,
        ...itemPriceData,
        details,
      };

      // Validate the item first
      const validation = this.tradeAnalyzer.validateTrade(itemForAnalysis);

      if (!validation.isValid) {
        this.validationErrors = validation.errors;
        return;
      }

      // Check for warnings
      if (itemPriceData.avgHighPrice && itemPriceData.avgLowPrice) {
        const priceSpread =
          (itemPriceData.avgHighPrice - itemPriceData.avgLowPrice) /
          itemPriceData.avgLowPrice;
        if (priceSpread > 0.5) {
          this.warnings.push(
            `High price volatility detected (${(priceSpread * 100).toFixed(
              1
            )}% spread)`
          );
        }
      }

      // Analyze trade opportunity
      const tradeOpportunity = this.tradeAnalyzer.analyzeItem(
        itemForAnalysis,
        DEFAULT_CONFIG
      );

      if (!tradeOpportunity) {
        throw new Error("Unable to analyze trade opportunity for this item");
      }

      this.item = {
        priceData: itemPriceData,
        details,
        tradeOpportunity,
      };

      this.volumeAnalysis = this.tradeAnalyzer.getVolumeAnalysis(
        tradeOpportunity.volume,
        tradeOpportunity.buyLimit
      );

      this.tradingAdvice = this.tradeAnalyzer.getTradingAdvice(
        tradeOpportunity.volume,
        tradeOpportunity.priceStability,
        tradeOpportunity.confidence
      );

      console.log("Successfully loaded item data:", this.item);
    } catch (err) {
      console.error("Error in loadItemData:", err);
      this.error =
        err instanceof Error
          ? err.message
          : "An unexpected error occurred while loading item data";
    } finally {
      this.loading = false;
    }
  }

  private resetErrors() {
    this.error = null;
    this.validationErrors = [];
    this.warnings = [];
  }

  handleImageError(event: any) {
    event.target.src = "/assets/placeholder.webp";
  }

  navigateBack() {
    this.router.navigate(["/items"]);
  }
}
