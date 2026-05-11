namespace BlazorMap;

public partial class BlazorOpenLayersMap
{
    protected override string JsModulePath => "./_content/BlazorMap/js/blazorOpenLayersMap.js";

    protected override object ToMapOptionsPayload(BlazorOpenLayersMapOptions o) =>
        new
        {
            center = new { lat = o.Center.Latitude, lng = o.Center.Longitude },
            zoom = o.Zoom,
            minZoom = o.MinZoom,
            maxZoom = o.MaxZoom,
            zoomControl = o.ZoomControl,
            attributionControl = o.AttributionControl,
            tileUrl = o.TileUrl,
            tileAttribution = o.TileAttribution,
            tileMaxZoom = o.TileMaxZoom,
            tileOpacity = o.TileOpacity,
            maxBounds = BoundsToJs(o.MaxBounds),
            showScaleControl = o.ShowScaleControl,
            scaleControlImperial = o.ScaleControlImperial,
            scrollWheelZoom = o.ScrollWheelZoom,
            doubleClickZoom = o.DoubleClickZoom,
            boxZoom = o.BoxZoom,
            dragging = o.Dragging,
            keyboardNavigation = o.KeyboardNavigation,
        };

    private static object? BoundsToJs(BlazorMapLatLngBounds? b) =>
        b is { } v
            ? new
            {
                southWest = new { lat = v.SouthWest.Latitude, lng = v.SouthWest.Longitude },
                northEast = new { lat = v.NorthEast.Latitude, lng = v.NorthEast.Longitude },
            }
            : null;

    protected override BlazorOpenLayersMapOptions CloneOptions(BlazorOpenLayersMapOptions o) =>
        new()
        {
            Center = o.Center,
            Zoom = o.Zoom,
            MinZoom = o.MinZoom,
            MaxZoom = o.MaxZoom,
            ZoomControl = o.ZoomControl,
            AttributionControl = o.AttributionControl,
            TileUrl = o.TileUrl,
            TileAttribution = o.TileAttribution,
            TileMaxZoom = o.TileMaxZoom,
            TileOpacity = o.TileOpacity,
            MaxBounds = o.MaxBounds,
            ShowScaleControl = o.ShowScaleControl,
            ScaleControlImperial = o.ScaleControlImperial,
            ScrollWheelZoom = o.ScrollWheelZoom,
            DoubleClickZoom = o.DoubleClickZoom,
            BoxZoom = o.BoxZoom,
            Dragging = o.Dragging,
            KeyboardNavigation = o.KeyboardNavigation,
        };

    protected override bool OptionsEqual(BlazorOpenLayersMapOptions a, BlazorOpenLayersMapOptions b) =>
        a.Center.Equals(b.Center)
        && Math.Abs(a.Zoom - b.Zoom) < 1e-6
        && a.MinZoom == b.MinZoom
        && a.MaxZoom == b.MaxZoom
        && a.ZoomControl == b.ZoomControl
        && a.AttributionControl == b.AttributionControl
        && a.TileUrl == b.TileUrl
        && a.TileAttribution == b.TileAttribution
        && a.TileMaxZoom == b.TileMaxZoom
        && Math.Abs(a.TileOpacity - b.TileOpacity) < 1e-9
        && BoundsEqual(a.MaxBounds, b.MaxBounds)
        && a.ShowScaleControl == b.ShowScaleControl
        && a.ScaleControlImperial == b.ScaleControlImperial
        && a.ScrollWheelZoom == b.ScrollWheelZoom
        && a.DoubleClickZoom == b.DoubleClickZoom
        && a.BoxZoom == b.BoxZoom
        && a.Dragging == b.Dragging
        && a.KeyboardNavigation == b.KeyboardNavigation;

    private static bool BoundsEqual(BlazorMapLatLngBounds? a, BlazorMapLatLngBounds? b)
    {
        if (a is null && b is null) return true;
        if (a is null || b is null) return false;
        return a.Value.SouthWest.Equals(b.Value.SouthWest) && a.Value.NorthEast.Equals(b.Value.NorthEast);
    }
}
