// ge_api.rs
use reqwest;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

// Base API endpoints from the OSRS GE API.
const FIVE_MIN_URL: &str = "https://prices.runescape.wiki/api/v1/osrs/1h";
const MAPPING_URL: &str = "https://prices.runescape.wiki/api/v1/osrs/mapping";

/// Represents pricing data for an individual item.
///
/// Fields are optional since not every endpoint response may include every price.
#[derive(Deserialize, Serialize, Debug)]
pub struct PriceData {
    #[serde(default)]
    pub avgHighPrice: Option<u64>,
    #[serde(default)]
    pub avgLowPrice: Option<u64>,
    #[serde(default)]
    pub highPriceVolume: Option<u64>,
    #[serde(default)]
    pub lowPriceVolume: Option<u64>,
}

#[derive(Deserialize, Serialize, Debug)]
pub struct FiveMinResponse {
    pub data: HashMap<String, PriceData>,
    pub timestamp: u64,
}

/// A single data point in a timeseries response.
#[derive(Deserialize, Serialize, Debug)]
pub struct TimeseriesPoint {
    pub timestamp: u64,
    pub price: u64,
}

/// Response structure for timeseries data.
#[derive(Deserialize, Serialize, Debug)]
pub struct TimeseriesResponse {
    pub data: Vec<TimeseriesPoint>,
}

/// Structure representing an individual item in the mapping.
#[derive(Deserialize, Serialize, Debug)]
pub struct ItemMapping {
    pub id: u32,
    pub name: String,
    pub examine: String,
    pub members: bool,
    #[serde(default)]
    pub lowalch: u32,
    #[serde(default)]
    pub limit: u32,
    #[serde(default)]
    pub value: u32,
    #[serde(default)]
    pub highalch: u32,
    pub icon: String,
}

/// Response structure for the item mapping endpoint.
pub type MappingResponse = Vec<ItemMapping>;

/// Fetches the latest price data for all items from the GE API.
pub async fn get_latest_prices() -> Result<FiveMinResponse, Box<dyn std::error::Error>> {
  let client = reqwest::Client::builder()
      .user_agent("osrs-ge-tracker")
      .build()?;

  let response = client
      .get(FIVE_MIN_URL)
      .header("Accept", "application/json")
      .send()
      .await?;

  println!("Response status: {}", response.status());

  let text = response.text().await?;
  println!("Response text (first 100 chars): {}", &text[..100.min(text.len())]);

  let latest_prices = serde_json::from_str::<FiveMinResponse>(&text)?;
  Ok(latest_prices)
}

/// Retrieves the item mapping (ID to name) from the GE API.
pub async fn get_item_mapping() -> Result<Vec<ItemMapping>, Box<dyn std::error::Error>> {
  let client = reqwest::Client::builder()
      .user_agent("osrs-ge-tracker")
      .build()?;

  let response = client
      .get(MAPPING_URL)
      .header("Accept", "application/json")
      .send()
      .await?;

  println!("Response status: {}", response.status());

  let text = response.text().await?;
  println!("Response text (first 100 chars): {}", &text[..100.min(text.len())]);

  let mappings = serde_json::from_str::<Vec<ItemMapping>>(&text)?;
  Ok(mappings)
}