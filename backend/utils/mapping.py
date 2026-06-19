import folium
from folium.plugins import HeatMap


def build_folium_map(df, schedule):
    m = folium.Map(
        location=[12.9716, 77.5946],
        zoom_start=12,
        tiles='CartoDB positron'
    )

    # Heatmap layer
    heat_data = df[['latitude', 'longitude']].values.tolist()

    HeatMap(
        heat_data,
        radius=15,
        blur=10,
        min_opacity=0.3,
        name='Violation Heatmap'
    ).add_to(m)

    # Cluster markers
    tier_color = {
        'HIGH': 'red',
        'MEDIUM': 'orange',
        'LOW': 'green'
    }

    for _, row in schedule.iterrows():
        color = tier_color.get(row['priority_tier'], 'blue')

        popup_html = f"""
        <b>Cluster {int(row['geo_cluster'])} — {row['priority_tier']}</b><hr>
        Violations       : {int(row['violation_count'])}<br>
        Priority Score   : {row['priority_score']:.1f}<br>
        Road Type        : {row['road_type']}<br>
        Congestion Impact: {row['congestion_impact']:.1f}<br>
        Trend            : {row['trend_label']}<br>
        Nearby POIs      : {row['nearby_pois']}<br>
        Peak Hour        : {int(row['peak_hour']):02d}:00<br>
        <b>Action:</b> {row['recommended_action']}
        """

        folium.CircleMarker(
            location=[row['latitude'], row['longitude']],
            radius=9,
            color=color,
            fill=True,
            fill_opacity=0.85,
            popup=folium.Popup(popup_html, max_width=280),
            tooltip=f"C{int(row['geo_cluster'])} | {row['priority_tier']} | Score {row['priority_score']:.0f}"
        ).add_to(m)

    # Legend
    legend_html = """
    <div style="position:fixed;bottom:30px;left:30px;z-index:1000;
         background:white;padding:12px 16px;border-radius:8px;
         border:1px solid #ccc;font-size:13px;line-height:1.8">
      <b> Enforcement Priority</b><br>
      HIGH ≥ 70<br>
      MEDIUM 40–70<br>
      LOW < 40<br>
      <hr style='margin:6px 0'>
      Emerging = escalating hotspot<br>
      CI = Congestion Impact (viol/lane)<br>
      <i>Click marker for patrol details</i>
    </div>
    """

    m.get_root().html.add_child(folium.Element(legend_html))

    folium.LayerControl().add_to(m)


    m.save("outputs/parking_hotspot_map.html")

    return "outputs/parking_hotspot_map.html"