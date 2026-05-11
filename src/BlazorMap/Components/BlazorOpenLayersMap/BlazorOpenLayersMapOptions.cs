namespace BlazorMap;

/// <summary>Initial display and tile settings for <see cref="BlazorOpenLayersMap"/>.</summary>
public sealed class BlazorOpenLayersMapOptions
{
    public BlazorMapLatLng Center { get; set; } = new(51.505, -0.09);
    public double Zoom { get; set; } = 13;
    public int? MinZoom { get; set; }
    public int? MaxZoom { get; set; }
    public bool ZoomControl { get; set; } = true;
    public bool AttributionControl { get; set; } = true;

    /// <summary>Tile URL template (XYZ), e.g. OSM with <c>{z}</c>, <c>{x}</c>, <c>{y}</c> placeholders.</summary>
    public string TileUrl { get; set; } =
        "https://tile.openstreetmap.org/{z}/{x}/{y}.png";

    public string TileAttribution { get; set; } =
        "&copy; <a href=\"https://www.openstreetmap.org/copyright\">OpenStreetMap</a> contributors";

    public int TileMaxZoom { get; set; } = 19;

    /// <summary>Opacity of the base tile layer (0–1).</summary>
    public double TileOpacity { get; set; } = 1;

    /// <summary>When set, panning is limited to this geographic rectangle.</summary>
    public BlazorMapLatLngBounds? MaxBounds { get; set; }

    /// <summary>Show OpenLayers scale line.</summary>
    public bool ShowScaleControl { get; set; }

    /// <summary>When <see cref="ShowScaleControl"/> is true, show imperial alongside metric where supported.</summary>
    public bool ScaleControlImperial { get; set; }

    public bool ScrollWheelZoom { get; set; } = true;

    public bool DoubleClickZoom { get; set; } = true;

    /// <summary>Shift-drag box zoom is not wired for OpenLayers; kept for API parity with Leaflet.</summary>
    public bool BoxZoom { get; set; } = true;

    public bool Dragging { get; set; } = true;

    public bool KeyboardNavigation { get; set; } = true;
}
