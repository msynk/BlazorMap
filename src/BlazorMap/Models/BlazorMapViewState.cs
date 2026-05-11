namespace BlazorMap;

/// <summary>Current map viewport after pan or zoom.</summary>
public sealed class BlazorMapViewState
{
    public BlazorMapLatLng Center { get; init; }
    public double Zoom { get; init; }
    public BlazorMapLatLngBounds Bounds { get; init; }
}
