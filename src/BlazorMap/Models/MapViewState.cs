namespace BlazorMapKit;

/// <summary>Current map viewport after pan or zoom.</summary>
public sealed class MapViewState
{
    public LatLng Center { get; init; }
    public double Zoom { get; init; }
    public LatLngBounds Bounds { get; init; }
}
