namespace BlazorMapKit;

/// <summary>Geographic coordinate in WGS84 (EPSG:4326).</summary>
public readonly record struct LatLng(double Latitude, double Longitude)
{
    public double Lat => Latitude;
    public double Lng => Longitude;
}
