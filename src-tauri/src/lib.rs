// in lib.rs
mod ge_api;
use ge_api::{get_latest_prices, get_item_mapping as fetch_item_mapping};

#[tauri::command]
async fn get_item_mapping() -> Result<Vec<ge_api::ItemMapping>, String> {
    match ge_api::get_item_mapping().await {
        Ok(data) => {
            println!("Successfully fetched mappings: {} items", data.len());
            Ok(data)
        },
        Err(err) => {
            println!("Error fetching mappings: {:?}", err);
            Err(format!("Error: {}", err))
        }
    }
}

#[tauri::command]
async fn fetch_latest() -> Result<String, String> {
    match get_latest_prices().await {
        Ok(data) => Ok(format!("Fetched {} items.", data.data.len())),
        Err(err) => Err(format!("Error: {}", err)),
    }
}

#[tauri::command]
async fn get_all_items() -> Result<ge_api::FiveMinResponse, String> {
    match ge_api::get_latest_prices().await {
        Ok(data) => Ok(data),
        Err(err) => Err(format!("Error: {}", err)),
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            get_item_mapping,
            fetch_latest,
            get_all_items
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}