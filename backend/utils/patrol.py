def generate_patrol_schedule(cluster_df, cluster_centers):
    hourly = (
        cluster_df.groupby(['geo_cluster', 'hour'])['latitude']
        .count().reset_index()
    )

    hourly.columns = ['geo_cluster', 'hour', 'count']

    peak_hours_per_cluster = hourly.loc[
        hourly.groupby('geo_cluster')['count'].idxmax()
    ]

    peak_hours_per_cluster = peak_hours_per_cluster.rename(
        columns={'hour': 'peak_hour', 'count': 'peak_count'}
    )

    vehicle_dom = (
        cluster_df.groupby(['geo_cluster', 'vehicle_type'])['latitude']
        .count().reset_index()
    )

    vehicle_dom = vehicle_dom.loc[
        vehicle_dom.groupby('geo_cluster')['latitude'].idxmax()
    ]

    vehicle_dom = vehicle_dom[['geo_cluster', 'vehicle_type']].rename(
        columns={'vehicle_type': 'dominant_vehicle'}
    )

    schedule = (
        cluster_centers[
            ['geo_cluster','latitude','longitude','priority_score',
             'priority_tier','violation_count','trend_label',
             'road_type','congestion_impact','nearby_pois']
        ]
        .merge(
            peak_hours_per_cluster[['geo_cluster','peak_hour']],
            on='geo_cluster'
        )
        .merge(vehicle_dom, on='geo_cluster')
        .sort_values('priority_score', ascending=False)
    )

    def recommend_action(row):
        if row['priority_score'] >= 70:
            action = 'Permanent tow zone + CCTV'
        elif row['peak_hour'] in range(7, 11):
            action = 'Morning rush patrol (7–10 AM)'
        elif row['peak_hour'] in range(17, 21):
            action = 'Evening rush patrol (5–8 PM)'
        else:
            action = f"Targeted patrol @ {row['peak_hour']:02d}:00"

        if row['trend_label'].startswith('Emerg'):
            action += 'ESCALATING'

        return action

    schedule['recommended_action'] = schedule.apply(
        recommend_action,
        axis=1
    )

    return schedule