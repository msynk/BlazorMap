namespace BlazorMap;

/// <summary>Display and interaction options for <see cref="BlazorArcGisMap"/>.</summary>
public sealed class BlazorArcGisMapOptions
{
    public BlazorMapLatLng Center { get; set; } = new(51.505, -0.09);
    public double Zoom { get; set; } = 4;
    public int? MinZoom { get; set; }
    public int? MaxZoom { get; set; }
    public bool ZoomControl { get; set; } = true;
    public bool AttributionControl { get; set; } = true;

    /// <summary>
    /// ArcGIS basemap identifier, e.g. <c>"osm"</c>, <c>"streets-vector"</c>,
    /// <c>"satellite"</c>, <c>"hybrid"</c>, <c>"topo-vector"</c>, <c>"dark-gray-vector"</c>.
    /// The <c>"osm"</c> basemap works without an API key; all Esri-hosted basemaps require
    /// an <see cref="ApiKey"/>.
    /// </summary>
    public string BasemapId { get; set; } = "osm";

    /// <summary>
    /// ArcGIS API key. Required for Esri-hosted basemaps and premium services.
    /// Leave <c>null</c> to use the open <c>"osm"</c> basemap without sign-in.
    /// Obtain one at <see href="https://developers.arcgis.com/"/>.
    /// </summary>
    public string? ApiKey { get; set; }

    /// <summary>Show an ArcGIS <c>ScaleBar</c> widget.</summary>
    public bool ShowScaleControl { get; set; }

    /// <summary>Scroll-wheel zoom (ArcGIS <c>mouseWheelZoomEnabled</c>).</summary>
    public bool ScrollWheelZoom { get; set; } = true;

    /// <summary>Double-click to zoom (default ArcGIS navigation behaviour).</summary>
    public bool DoubleClickZoom { get; set; } = true;

    /// <summary>Drag to pan the map.</summary>
    public bool Dragging { get; set; } = true;

    /// <summary>Keyboard arrow-pan and +/- zoom.</summary>
    public bool KeyboardNavigation { get; set; } = true;
}
