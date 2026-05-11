namespace BlazorMap;

public partial class BlazorMapLibreMap
{
    protected override string JsModulePath => "./_content/BlazorMap/js/blazorMapLibreMap.js";

    protected override object ToMapOptionsPayload(MapLibreMapDisplayOptions o) =>
        new
        {
            center = new { lat = o.Center.Latitude, lng = o.Center.Longitude },
            zoom = o.Zoom,
            minZoom = o.MinZoom,
            maxZoom = o.MaxZoom,
            styleUrl = o.StyleUrl,
            showNavigationControl = o.ShowNavigationControl,
            attributionControl = o.AttributionControl,
            maxBounds = BoundsToJs(o.MaxBounds),
            scrollWheelZoom = o.ScrollWheelZoom,
            doubleClickZoom = o.DoubleClickZoom,
            boxZoom = o.BoxZoom,
            dragPan = o.DragPan,
            dragRotate = o.DragRotate,
            keyboardNavigation = o.KeyboardNavigation,
        };

    private static object? BoundsToJs(LatLngBounds? b) =>
        b is { } v
            ? new
            {
                southWest = new { lat = v.SouthWest.Latitude, lng = v.SouthWest.Longitude },
                northEast = new { lat = v.NorthEast.Latitude, lng = v.NorthEast.Longitude },
            }
            : null;

    protected override MapLibreMapDisplayOptions CloneOptions(MapLibreMapDisplayOptions o) =>
        new()
        {
            Center = o.Center,
            Zoom = o.Zoom,
            MinZoom = o.MinZoom,
            MaxZoom = o.MaxZoom,
            StyleUrl = o.StyleUrl,
            ShowNavigationControl = o.ShowNavigationControl,
            AttributionControl = o.AttributionControl,
            MaxBounds = o.MaxBounds,
            ScrollWheelZoom = o.ScrollWheelZoom,
            DoubleClickZoom = o.DoubleClickZoom,
            BoxZoom = o.BoxZoom,
            DragPan = o.DragPan,
            DragRotate = o.DragRotate,
            KeyboardNavigation = o.KeyboardNavigation,
        };

    protected override bool OptionsEqual(MapLibreMapDisplayOptions a, MapLibreMapDisplayOptions b) =>
        a.Center.Equals(b.Center)
        && Math.Abs(a.Zoom - b.Zoom) < 1e-6
        && a.MinZoom == b.MinZoom
        && a.MaxZoom == b.MaxZoom
        && a.StyleUrl == b.StyleUrl
        && a.ShowNavigationControl == b.ShowNavigationControl
        && a.AttributionControl == b.AttributionControl
        && BoundsEqual(a.MaxBounds, b.MaxBounds)
        && a.ScrollWheelZoom == b.ScrollWheelZoom
        && a.DoubleClickZoom == b.DoubleClickZoom
        && a.BoxZoom == b.BoxZoom
        && a.DragPan == b.DragPan
        && a.DragRotate == b.DragRotate
        && a.KeyboardNavigation == b.KeyboardNavigation;

    private static bool BoundsEqual(LatLngBounds? x, LatLngBounds? y)
    {
        if (x is null && y is null) return true;
        if (x is null || y is null) return false;
        return x.Value.SouthWest.Equals(y.Value.SouthWest) && x.Value.NorthEast.Equals(y.Value.NorthEast);
    }
}
