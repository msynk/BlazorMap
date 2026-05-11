namespace BlazorMap;

/// <summary>Display and interaction options for <see cref="BlazorAzureMapsMap"/>.</summary>
public sealed class BlazorAzureMapsMapOptions
{
    public BlazorMapLatLng Center { get; set; } = new(51.505, -0.09);
    public double Zoom { get; set; } = 4;
    public int? MinZoom { get; set; }
    public int? MaxZoom { get; set; }

    /// <summary>Show the Azure Maps zoom control widget.</summary>
    public bool ZoomControl { get; set; } = true;

    /// <summary>Show the Microsoft logo attribution (recommended for compliance).</summary>
    public bool AttributionControl { get; set; } = true;

    /// <summary>
    /// Azure Maps map style.
    /// Common values: <c>"road"</c>, <c>"satellite"</c>, <c>"satellite_road_labels"</c>,
    /// <c>"grayscale_light"</c>, <c>"grayscale_dark"</c>, <c>"night"</c>, <c>"road_shaded_relief"</c>.
    /// All styles require a <see cref="SubscriptionKey"/>.
    /// </summary>
    public string Style { get; set; } = "road";

    /// <summary>
    /// Azure Maps subscription key.
    /// Required to load map tiles and services.
    /// Obtain a free key at <see href="https://portal.azure.com"/>.
    /// Without a key the map container initialises but tiles will not load.
    /// </summary>
    public string? SubscriptionKey { get; set; }

    /// <summary>Show an Azure Maps <c>ScaleControl</c> widget.</summary>
    public bool ShowScaleControl { get; set; }

    /// <summary>Enable scroll-wheel zoom.</summary>
    public bool ScrollWheelZoom { get; set; } = true;

    /// <summary>Enable double-click to zoom.</summary>
    public bool DoubleClickZoom { get; set; } = true;

    /// <summary>Enable drag to pan.</summary>
    public bool Dragging { get; set; } = true;

    /// <summary>Enable keyboard arrow-pan and +/- zoom.</summary>
    public bool KeyboardNavigation { get; set; } = true;
}
