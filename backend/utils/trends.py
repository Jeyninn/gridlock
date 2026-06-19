import scipy.stats as stats


def build_cluster_summary(cluster_df, dominant_station):
    cluster_centers = (
        cluster_df.groupby('geo_cluster')
        .agg(
            latitude=('latitude', 'mean'),
            longitude=('longitude', 'mean'),
            violation_count=('latitude', 'count'),
            peak_violations=('is_peak', 'sum'),
            weekend_violations=('is_weekend', 'sum'),
        )
        .reset_index()
    )

    cluster_centers['peak_pct'] = (
        cluster_centers['peak_violations'] /
        cluster_centers['violation_count']
    )

    cluster_centers['weekend_pct'] = (
        cluster_centers['weekend_violations'] /
        cluster_centers['violation_count']
    )

    cluster_centers = cluster_centers.merge(
        dominant_station,
        on='geo_cluster'
    )

    return cluster_centers


def compute_trends(cluster_df, cluster_centers):
    monthly = (
        cluster_df.groupby(['geo_cluster', 'month'])['latitude']
        .count()
        .reset_index()
        .rename(columns={'latitude': 'count'})
    )

    def trend_slope(grp):
        if len(grp) < 2:
            return 0.0
        slope, _, _, _, _ = stats.linregress(grp['month'], grp['count'])
        return slope

    trends = monthly.groupby('geo_cluster').apply(trend_slope).reset_index()
    trends.columns = ['geo_cluster', 'trend_slope']

    max_abs = trends['trend_slope'].abs().max()

    if max_abs > 0:
        trends['trend_norm'] = trends['trend_slope'] / max_abs
    else:
        trends['trend_norm'] = 0.0

    def label_trend(norm):
        if norm > 0.3:
            return 'Emerging'
        if norm < -0.3:
            return 'Declining'
        return 'Stable'

    trends['trend_label'] = trends['trend_norm'].apply(label_trend)

    cluster_centers = cluster_centers.merge(trends, on='geo_cluster')

    return cluster_centers