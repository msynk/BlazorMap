namespace BlazorMap;

/// <summary>Optional XYZ tile layer stacked above the base map (weather, labels, etc.).</summary>
public sealed class BlazorMapTileOverlayOptions
{
    public required string Id { get; init; }

    /// <summary>Leaflet tile URL template with <c>{z}</c>, <c>{x}</c>, <c>{y}</c>, optional <c>{s}</c>.</summary>
    public required string UrlTemplate { get; init; }

    public string? Attribution { get; init; }
    public double Opacity { get; init; } = 1;
    public int ZIndex { get; init; } = 100;
    public int MaxZoom { get; init; } = 19;
}
