#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod ge_api;
use ge_api::{get_latest_prices, get_item_mapping};

fn main() {
    osrs_algotrading_lib::run()
}
