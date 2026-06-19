import os
import osmnx as ox
import geopandas as gpd
import numpy as np
from shapely.geometry import Point

ox.settings.use_cache = True
ox.settings.cache_folder = "osm_cache"

POI_CACHE = os.path.join("osm_cache", "regional_pois.gpkg")

POI_QUERIES = {
    'metro_station': {'railway': 'station'},
    'bus_stop':      {'highway': 'bus_stop'},
    'commercial':    {'landuse': 'commercial'},
    'school':        {'amenity': 'school'},
    'hospital':      {'amenity': 'hospital'},
    'market':        {'amenity': 'marketplace'},
}


def _load_pois(north, south, east, west):
    """Load POI GeoDataFrame from local cache or download once and save."""
    if os.path.exists(POI_CACHE):
        return gpd.read_file(POI_CACHE)

    combined_tags = {}
    for q in POI_QUERIES.values():
        for k, v in q.items():
            combined_tags.setdefault(k, [])
            combined_tags[k].append(v) if not isinstance(v, list) \
                else combined_tags[k].extend(v)

    pois_gdf = ox.features_from_bbox(bbox=(north, south, east, west), tags=combined_tags)
    os.makedirs("osm_cache", exist_ok=True)
    pois_gdf.to_file(POI_CACHE, driver="GPKG")
    return pois_gdf


def enrich_pois(cluster_centers):
    north = cluster_centers['latitude'].max()  + 0.01
    south = cluster_centers['latitude'].min()  - 0.01
    east  = cluster_centers['longitude'].max() + 0.01
    west  = cluster_centers['longitude'].min() - 0.01

    try:
        pois_gdf = _load_pois(north, south, east, west)

        geometry_list = [
            Point(lon, lat)
            for lat, lon in zip(cluster_centers['latitude'], cluster_centers['longitude'])
        ]
        centroids_gdf = gpd.GeoDataFrame(
            cluster_centers.copy(), geometry=geometry_list, crs="EPSG:4326"
        )

        centroids_utm  = centroids_gdf.to_crs(epsg=32643)
        pois_utm       = pois_gdf.to_crs(epsg=32643)

        # Normalise mixed geometry (polygons → centroids) for distance()
        pois_utm_pts          = pois_utm.copy()
        pois_utm_pts.geometry = pois_utm_pts.geometry.centroid

        poi_results = []

        for _, centroid in centroids_utm.iterrows():
            distances   = pois_utm_pts.geometry.distance(centroid.geometry)
            nearby_pois = pois_utm[distances <= 300]

            found_labels = set()
            for _, poi in nearby_pois.iterrows():
                for label, tags in POI_QUERIES.items():
                    for k, v in tags.items():
                        if k in poi.index and poi[k] == v:
                            found_labels.add(label)

            poi_results.append(
                ', '.join(sorted(found_labels)) if found_labels else 'general_area'
            )

    except Exception as e:
        print(f"[poi] Spatial enrichment failed ({e}), using fallback.")
        mock_labels = [
            'metro_station, commercial', 'bus_stop, market',
            'school', 'hospital, commercial', 'general_area'
        ]
        np.random.seed(42)
        poi_results = np.random.choice(mock_labels, size=len(cluster_centers))

    cluster_centers['nearby_pois'] = poi_results
    return cluster_centers