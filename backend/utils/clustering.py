import numpy as np
import hdbscan


def run_hdbscan(df):
    df = df[df["validation_status"] == "approved"].copy()

    coords_rad = np.radians(df[['latitude', 'longitude']].values)

    MIN_CLUSTER_SIZE = 100

    model = hdbscan.HDBSCAN(
        min_cluster_size=MIN_CLUSTER_SIZE,
        metric='haversine'
    )

    df['geo_cluster'] = model.fit_predict(coords_rad)

    cluster_df = df[df['geo_cluster'] != -1].copy()


    dominant_station = (
        cluster_df.groupby('geo_cluster')['police_station']
        .agg(lambda x: x.value_counts().index[0])
        .reset_index()
        .rename(columns={'police_station': 'dominant_station'})
    )

    return df, cluster_df, dominant_station