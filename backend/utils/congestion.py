import os
import osmnx as ox
import numpy as np

ox.settings.use_cache = True
ox.settings.cache_folder = "osm_cache"


GRAPH_CACHE = os.path.join("osm_cache", "road_network.graphml")

LANE_LOOKUP = {
    'motorway': 6,
    'motorway_link': 3,
    'trunk': 4,
    'trunk_link': 2,
    'primary': 4,
    'primary_link': 2,
    'secondary': 3,
    'secondary_link': 2,
    'tertiary': 2,
    'tertiary_link': 1,
    'residential': 1,
    'living_street': 1,
    'unclassified': 1,
    'service': 1,
}


def _load_graph(north, south, east, west):
    """Load graph from local cache or download once and save."""
    if os.path.exists(GRAPH_CACHE):
        return ox.load_graphml(GRAPH_CACHE)

    G = ox.graph_from_bbox(bbox=(north, south, east, west), network_type='drive')
    os.makedirs("osm_cache", exist_ok=True)
    ox.save_graphml(G, GRAPH_CACHE)
    return G


def compute_congestion(cluster_centers):
    north = cluster_centers['latitude'].max()  + 0.01
    south = cluster_centers['latitude'].min()  - 0.01
    east  = cluster_centers['longitude'].max() + 0.01
    west  = cluster_centers['longitude'].min() - 0.01

    try:
        G = _load_graph(north, south, east, west)

        lons = cluster_centers['longitude'].values
        lats = cluster_centers['latitude'].values
        nearest_edges = ox.nearest_edges(G, X=lons, Y=lats)

        road_types, lane_counts = [], []

        for u, v, k in nearest_edges:
            edge_data = G.get_edge_data(u, v, k)

            hw = edge_data.get('highway', 'unclassified')
            if isinstance(hw, list):
                hw = hw[0]
            hw = str(hw).lower()

            raw_lanes = edge_data.get('lanes', None)
            if isinstance(raw_lanes, list):
                raw_lanes = raw_lanes[0]

            lanes = int(raw_lanes) if raw_lanes and str(raw_lanes).isdigit() \
                    else LANE_LOOKUP.get(hw, 1)

            road_types.append(hw)
            lane_counts.append(lanes)

    except Exception as e:
        print(f"[congestion] Graph load failed ({e}), using fallback.")
        mock_types = ['primary', 'secondary', 'residential', 'tertiary']
        np.random.seed(42)
        road_types  = np.random.choice(mock_types, size=len(cluster_centers))
        lane_counts = [LANE_LOOKUP[t] for t in road_types]

    cluster_centers['road_type']         = road_types
    cluster_centers['est_lanes']         = lane_counts
    cluster_centers['congestion_impact'] = (
        cluster_centers['violation_count'] / cluster_centers['est_lanes']
    ).round(1)

    return cluster_centers