namespace BlazorMap;

/// <summary>Stroke and fill styling for polylines, polygons, circles, and GeoJSON.</summary>
public sealed class VectorPathStyle
{
    public string Color { get; set; } = "#3388ff";
    public double Weight { get; set; } = 3;
    public double Opacity { get; set; } = 1;
    public string? FillColor { get; set; }
    public double FillOpacity { get; set; } = 0.2;
    public string? DashArray { get; set; }
}
