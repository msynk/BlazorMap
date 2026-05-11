namespace BlazorMap;

/// <summary>Initial display settings for <see cref="BlazorMapLibreMap"/> (MapLibre GL JS, open source).</summary>
public sealed class BlazorMapLibreMapOptions
{
    public LatLng Center { get; set; } = new(51.505, -0.09);

    public double Zoom { get; set; } = 13;

    public int? MinZoom { get; set; }

    public int? MaxZoom { get; set; }

    /// <summary>Map style URL (JSON). Default uses MapLibre public demo tiles; use your own style + tile endpoints for production.</summary>
    public string StyleUrl { get; set; } = "https://demotiles.maplibre.org/style.json";

    public bool ShowNavigationControl { get; set; } = true;

    public bool AttributionControl { get; set; } = true;

    /// <summary>When set, panning is limited to this geographic rectangle.</summary>
    public LatLngBounds? MaxBounds { get; set; }

    public bool ScrollWheelZoom { get; set; } = true;

    public bool DoubleClickZoom { get; set; } = true;

    public bool BoxZoom { get; set; } = true;

    public bool DragPan { get; set; } = true;

    public bool DragRotate { get; set; } = true;

    /// <summary>Keyboard +/- and arrows when the map is focused.</summary>
    public bool KeyboardNavigation { get; set; } = true;
}
