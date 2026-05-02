namespace BlazorMapKit;

/// <summary>Initial display and tile settings for <see cref="T:BlazorMap.Components.BlazorMap"/>.</summary>
public sealed class MapDisplayOptions
{
    public LatLng Center { get; set; } = new(51.505, -0.09);
    public double Zoom { get; set; } = 13;
    public int? MinZoom { get; set; }
    public int? MaxZoom { get; set; }
    public bool ZoomControl { get; set; } = true;
    public bool AttributionControl { get; set; } = true;

    /// <summary>Tile URL template, e.g. OSM <c>https://{{s}}.tile.openstreetmap.org/{{z}}/{{x}}/{{y}}.png</c>.</summary>
    public string TileUrl { get; set; } =
        "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";

    public string TileAttribution { get; set; } =
        "&copy; <a href=\"https://www.openstreetmap.org/copyright\">OpenStreetMap</a> contributors";

    public int TileMaxZoom { get; set; } = 19;

    /// <summary>Opacity of the base tile layer (0–1).</summary>
    public double TileOpacity { get; set; } = 1;

    /// <summary>When set, panning is limited to this geographic rectangle (common in enterprise maps).</summary>
    public LatLngBounds? MaxBounds { get; set; }

    /// <summary>Show a metric/imperial scale bar (similar to map controls in commercial suites).</summary>
    public bool ShowScaleControl { get; set; }

    /// <summary>When <see cref="ShowScaleControl"/> is true, include imperial units alongside metric.</summary>
    public bool ScaleControlImperial { get; set; }

    /// <summary>Mouse wheel zoom (Syncfusion / Telerik-style interaction toggle).</summary>
    public bool ScrollWheelZoom { get; set; } = true;

    public bool DoubleClickZoom { get; set; } = true;

    public bool BoxZoom { get; set; } = true;

    public bool Dragging { get; set; } = true;

    /// <summary>Keyboard +/- and arrow pan when the map container is focused.</summary>
    public bool KeyboardNavigation { get; set; } = true;
}
