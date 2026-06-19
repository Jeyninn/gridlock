from utils.preprocessing import *
from utils.clustering import *
from utils.trends import *
from utils.congestion import *
from utils.poi import *
from utils.scoring import *
from utils.patrol import *
from utils.mapping import *


def run_training_pipeline(raw_csv_path):
    df = load_dataset(raw_csv_path)
    df = clean_data(df)
    df = feature_engineering(df)

    df, cluster_df, dominant_station = run_hdbscan(df)

    cluster_centers = build_cluster_summary(
        cluster_df,
        dominant_station
    )

    cluster_centers = compute_trends(
        cluster_df,
        cluster_centers
    )

    cluster_centers = compute_congestion(cluster_centers)
    cluster_centers = enrich_pois(cluster_centers)
    cluster_centers = compute_priority(cluster_centers)

    schedule = generate_patrol_schedule(
        cluster_df,
        cluster_centers
    )

    map_path = build_folium_map(df, schedule)

    schedule.to_csv("outputs/cluster_results.csv", index=False)
    df.to_csv("outputs/processed_violations.csv", index=False)

    return {
        "cluster_csv": "outputs/cluster_results.csv",
        "processed_csv": "outputs/processed_violations.csv",
        "map_html": map_path
    }