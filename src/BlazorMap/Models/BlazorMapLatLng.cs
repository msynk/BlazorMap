namespace BlazorMap;

/// <summary>Geographic coordinate in WGS84 (EPSG:4326).</summary>
public readonly record struct BlazorMapLatLng(double Latitude, double Longitude)
{
    public double Lat => Latitude;
    public double Lng => Longitude;
}
