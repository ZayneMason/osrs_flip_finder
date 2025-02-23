import { Component, OnInit } from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { invoke } from "@tauri-apps/api/core";
import {
  TradeAnalyzerService,
  TradeOpportunity,
} from "../trade/trade-analyzer.service";
import { TradingConfig, DEFAULT_CONFIG } from "../trade/trading.config";
import { Router, RouterModule } from "@angular/router";

// API Response Types
interface PriceData {
  avgHighPrice: number;
  avgLowPrice: number;
  highPriceVolume: number;
  lowPriceVolume: number;
}

interface ItemMapping {
  id: number;
  name: string;
  examine: string;
  members: boolean;
  lowalch: number;
  limit: number;
  value: number;
  highalch: number;
  icon: string;
}

// Component Types
interface ItemDetails {
  name: string;
  examine: string;
  icon: string;
  members: boolean;
  limit: number;
  highalch: number;
  value: number;
}

interface ProcessedItem {
  itemId: string;
  avgHighPrice: number;
  avgLowPrice: number;
  highPriceVolume: number;
  lowPriceVolume: number;
  margin: number;
  marginPercent: number;
  details?: ItemDetails;
  icon?: string;
}

@Component({
  selector: "app-items",
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: "./items.component.html",
  styleUrl: "./items.component.css",
})
export class ItemsComponent implements OnInit {
  items: ProcessedItem[] = [];
  timestamp: string | null = "";
  error: string | null = null;
  viewMode: "opportunities" | "table" | "cards" = "opportunities";
  sortField: keyof ProcessedItem = "margin";
  sortTradeField: keyof TradeOpportunity = "confidence";
  sortDirection: "asc" | "desc" = "desc";
  searchTerm = "";
  membersFilter: "all" | "members" | "f2p" = "all";
  tradingConfig: TradingConfig = DEFAULT_CONFIG;
  opportunities: TradeOpportunity[] = [];
  filteredOpportunities: TradeOpportunity[] = [];
  lastUpdated: number = Date.now();
  filterCriteria = DEFAULT_CONFIG;
  loading: boolean = false;

  columns = [
    { field: "itemId" as keyof ProcessedItem, name: "Item" },
    { field: "avgHighPrice" as keyof ProcessedItem, name: "High" },
    { field: "avgLowPrice" as keyof ProcessedItem, name: "Low" },
    { field: "margin" as keyof ProcessedItem, name: "Margin" },
    { field: "marginPercent" as keyof ProcessedItem, name: "Margin %" },
  ];

  constructor(
    private tradeAnalyzer: TradeAnalyzerService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.loadData();
    this.filteredOpportunities = [...this.opportunities];
  }

  setView(mode: "opportunities" | "table" | "cards"): void {
    this.viewMode = mode;
  }

  async loadData(): Promise<void> {
    try {
      this.lastUpdated = Date.now();
      // Load item mappings first
      const mappings = await invoke<ItemMapping[]>("get_item_mapping");
      const mappingsMap = new Map(
        mappings.map((item) => [
          item.id.toString(),
          {
            name: item.name,
            examine: item.examine,
            icon: item.icon,
            members: item.members,
            limit: item.limit > 0 ? item.limit : Number.MAX_SAFE_INTEGER | 100,
            highalch: item.highalch,
            value: item.value,
          },
        ])
      );

      // Then load prices
      const { data } = await invoke<{
        data: { [key: string]: PriceData };
      }>("get_all_items");

      // Process and combine the data
      this.items = Object.entries(data)
        .filter(
          ([_, priceData]) => priceData.avgHighPrice && priceData.avgLowPrice
        ) // Filter out items with no prices
        .map(([itemId, priceData]) => {
          const avgHigh = priceData.avgHighPrice || 0;
          const avgLow = priceData.avgLowPrice || 0;
          return {
            itemId,
            ...priceData,
            margin: avgHigh - avgHigh * 0.01 - avgLow,
            marginPercent: avgLow > 0 ? ((avgHigh - avgLow) / avgLow) * 100 : 0,
            details: mappingsMap.get(itemId),
          };
        })
        .filter(
          (item) =>
            item.details?.name &&
            item.details.name.trim() !== "" &&
            item.details.name != "Old school bond"
        ); // Filter out items with blank names

      this.opportunities = this.items
        .map((item) => this.tradeAnalyzer.analyzeItem(item, this.tradingConfig))
        .filter(
          (opportunity): opportunity is TradeOpportunity => opportunity !== null
        );

      this.timestamp = this.getFormattedTime(this.lastUpdated);
      this.sortItems();
    } catch (err) {
      console.error("Error loading data:", err);
      this.error = "Failed to load item data.";
    }
  }

  get filteredItems(): ProcessedItem[] {
    return this.items
      .filter((item) => {
        // Apply member/f2p filter
        if (this.membersFilter === "members" && !item.details?.members)
          return false;
        if (this.membersFilter === "f2p" && item.details?.members) return false;

        // Apply search filter
        if (this.searchTerm) {
          const searchLower = this.searchTerm.toLowerCase();
          const itemName = (item.details?.name || item.itemId).toLowerCase();
          return itemName.includes(searchLower);
        }

        return true;
      })
      .sort((a, b) => {
        let aValue = a[this.sortField];
        let bValue = b[this.sortField];

        // Handle special sorting for fields that might be nested in details
        if (this.sortField === "itemId" && a.details?.name && b.details?.name) {
          aValue = a.details.name;
          bValue = b.details.name;
        }

        if (typeof aValue === "number" && typeof bValue === "number") {
          return this.sortDirection === "asc"
            ? aValue - bValue
            : bValue - aValue;
        }

        // String comparison
        const aStr = String(aValue || "");
        const bStr = String(bValue || "");
        const comparison = aStr.localeCompare(bStr);
        return this.sortDirection === "asc" ? comparison : -comparison;
      });
  }

  get highConfidenceOpportunities(): TradeOpportunity[] {
    return this.opportunities.filter((opp) => opp.confidence > 0.7);
  }

  get highROIOpportunities(): TradeOpportunity[] {
    return this.opportunities.filter((opp) => opp.roi > 5); // 5% ROI
  }

  get highVolumeOpportunities(): TradeOpportunity[] {
    return this.opportunities.filter((opp) => opp.volume > 1000);
  }

  getItemIconUrl(item: ProcessedItem): string {
    if (!item.details?.name) return "";
    return `https://oldschool.runescape.wiki/images/${item.details.name
      .replaceAll(" ", "_")
      .replaceAll("'", "%27")
      .replaceAll("(", "%28")
      .replaceAll(")", "%29")}.png`;
  }

  handleImageError(event: any) {
    event.target.src = "/assets/placeholder.webp";
  }

  getVolumeAnalysis(volume: number, buyLimit: number): string {
    if (volume < 1000) {
      return "Low volume - trade carefully";
    } else if (volume < 5000) {
      return "Moderate volume";
    } else {
      return "High volume - good liquidity";
    }
  }

  handleSort(field: keyof ProcessedItem): void {
    if (this.sortField === field) {
      this.sortDirection = this.sortDirection === "asc" ? "desc" : "asc";
    } else {
      this.sortField = field;
      this.sortDirection = "desc";
    }
  }

  handleTradeSort(field: keyof TradeOpportunity) {
    if (this.sortTradeField === field) {
      this.sortDirection = this.sortDirection === "asc" ? "desc" : "asc";
    } else {
      this.sortTradeField = field;
      this.sortDirection = "desc";
    }

    this.filterOpportunities();
  }

  toggleMembersFilter(filter: "members" | "f2p"): void {
    this.membersFilter = this.membersFilter === filter ? "all" : filter;
  }

  sortItems(): void {
    this.handleSort("margin");
    this.handleTradeSort("confidence");
    this.filterOpportunities(); // Apply sort to filtered opportunities
  }

  filterOpportunities() {
    this.loading = true;

    setTimeout(() => {
      this.filteredOpportunities = this.opportunities
        .filter((opp) => {
          return (
            opp.volume >= this.filterCriteria.minVolume &&
            opp.roi >= this.filterCriteria.minROI &&
            opp.profitPerItem >= this.filterCriteria.minProfitPerItem &&
            opp.buyPrice * opp.buyLimit <= this.filterCriteria.maxInvestment
          );
        })
        .sort((a, b) => {
          const aValue = a[this.sortTradeField];
          const bValue = b[this.sortTradeField];
          return this.sortDirection === "asc"
            ? (aValue as number) - (bValue as number)
            : (bValue as number) - (aValue as number);
        });

      this.loading = false;
    }, 50);
  }

  navigateToItem(itemId: string, event: Event) {
    event.preventDefault();
    event.stopPropagation();
    this.router.navigate(["/items", itemId]).then(() => {
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  }

  getRelativeTime(): string {
    const now = Date.now();
    const diff = now - this.lastUpdated;
    const seconds = Math.floor(diff / 1000);

    if (seconds < 60) return `${seconds}s ago`;

    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;

    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;

    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  }

  getFormattedTime(timestamp: number): string {
    const date = new Date(timestamp);
    const hours = date.getHours();
    const minutes = date.getMinutes();
    const seconds = date.getSeconds();
    const ampm = hours >= 12 ? "PM" : "AM";
    const formattedHours = hours % 12 || 12;

    return `${formattedHours}:${String(minutes).padStart(2, "0")}:${String(
      seconds
    ).padStart(2, "0")} ${ampm}`;
  }
}
