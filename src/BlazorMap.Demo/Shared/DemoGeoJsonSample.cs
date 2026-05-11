namespace BlazorMap.Demo.Shared;

/// <summary>Shared GeoJSON for demos (Leaflet / MapLibre / Mapbox).</summary>
public static class DemoGeoJsonSample
{
    public const string FeatureCollection =
        """
        {
          "type": "FeatureCollection",
          "features": [
            {
              "type": "Feature",
              "properties": { "name": "Downtown box" },
              "geometry": {
                "type": "Polygon",
                "coordinates": [[
                  [-74.02, 40.72], [-73.98, 40.72], [-73.98, 40.75], [-74.02, 40.75], [-74.02, 40.72]
                ]]
              }
            },
            {
              "type": "Feature",
              "properties": { "name": "Uptown line" },
              "geometry": {
                "type": "LineString",
                "coordinates": [[-74.01, 40.78], [-73.99, 40.805], [-73.97, 40.82]]
              }
            }
          ]
        }
        """;
}
