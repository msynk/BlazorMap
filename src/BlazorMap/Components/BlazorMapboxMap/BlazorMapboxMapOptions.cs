namespace BlazorMap;

/// <summary>Initial display settings for <see cref="BlazorMapboxMap"/> (Mapbox GL JS).</summary>
public sealed class BlazorMapboxMapOptions
{
    public LatLng Center { get; set; } = new(51.505, -0.09);

    public double Zoom { get; set; } = 13;

    public int? MinZoom { get; set; }

    public int? MaxZoom { get; set; }

    /// <summary>Mapbox access token (required for <c>mapbox://</c> styles and Mapbox-hosted tiles).</summary>
    public string AccessToken { get; set; } = "";

    /// <summary>Mapbox style URL, e.g. <c>mapbox://styles/mapbox/streets-v12</c> or an HTTPS style URL.</summary>
    public string StyleUrl { get; set; } = "mapbox://styles/mapbox/streets-v12";

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
