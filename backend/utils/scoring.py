from sklearn.preprocessing import MinMaxScaler


def compute_priority(cluster_centers):
    scaler = MinMaxScaler()

    cluster_centers['n_density'] = scaler.fit_transform(
        cluster_centers[['violation_count']]
    )

    cluster_centers['n_congestion'] = scaler.fit_transform(
        cluster_centers[['congestion_impact']]
    )

    cluster_centers['n_peak'] = cluster_centers['peak_pct']

    trend_bonus_map = {
        'Emerging': 0.10,
        'Stable': 0.00,
        'Declining': -0.05
    }

    cluster_centers['trend_bonus'] = (
        cluster_centers['trend_label']
        .str.strip()
        .map(trend_bonus_map)
    )

    W_DENSITY = 0.40
    W_CONGESTION = 0.30
    W_PEAK = 0.20
    W_TREND = 0.10

    cluster_centers['priority_raw'] = (
        W_DENSITY * cluster_centers['n_density'] +
        W_CONGESTION * cluster_centers['n_congestion'] +
        W_PEAK * cluster_centers['n_peak'] +
        W_TREND * cluster_centers['trend_bonus']
    )

    cluster_centers['priority_rank_pct'] = (
        cluster_centers['priority_raw']
        .rank(pct=True, method='first')
    )

    def label_tier_by_percentile(pct):
        if pct >= 0.85:
            return 'HIGH'
        elif pct >= 0.55:
            return 'MEDIUM'
        return 'LOW'

    cluster_centers['priority_tier'] = (
        cluster_centers['priority_rank_pct']
        .apply(label_tier_by_percentile)
    )

    cluster_centers['priority_score'] = (
        cluster_centers['priority_rank_pct'] * 100
    ).round(1)

    return cluster_centers