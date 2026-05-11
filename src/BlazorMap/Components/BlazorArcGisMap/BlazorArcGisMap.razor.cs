namespace BlazorMap;

public partial class BlazorArcGisMap
{
    protected override string JsModulePath => "./_content/BlazorMap/js/blazorArcGisMap.js";

    protected override object ToMapOptionsPayload(BlazorArcGisMapOptions o) =>
        new
        {
            center = new { lat = o.Center.Latitude, lng = o.Center.Longitude },
            zoom = o.Zoom,
            minZoom = o.MinZoom,
            maxZoom = o.MaxZoom,
            zoomControl = o.ZoomControl,
            attributionControl = o.AttributionControl,
            basemapId = o.BasemapId,
            apiKey = o.ApiKey,
            showScaleControl = o.ShowScaleControl,
            scrollWheelZoom = o.ScrollWheelZoom,
            doubleClickZoom = o.DoubleClickZoom,
            dragging = o.Dragging,
            keyboardNavigation = o.KeyboardNavigation,
        };

    protected override BlazorArcGisMapOptions CloneOptions(BlazorArcGisMapOptions o) =>
        new()
        {
            Center = o.Center,
            Zoom = o.Zoom,
            MinZoom = o.MinZoom,
            MaxZoom = o.MaxZoom,
            ZoomControl = o.ZoomControl,
            AttributionControl = o.AttributionControl,
            BasemapId = o.BasemapId,
            ApiKey = o.ApiKey,
            ShowScaleControl = o.ShowScaleControl,
            ScrollWheelZoom = o.ScrollWheelZoom,
            DoubleClickZoom = o.DoubleClickZoom,
            Dragging = o.Dragging,
            KeyboardNavigation = o.KeyboardNavigation,
        };

    protected override bool OptionsEqual(BlazorArcGisMapOptions a, BlazorArcGisMapOptions b) =>
        a.Center.Equals(b.Center)
        && Math.Abs(a.Zoom - b.Zoom) < 1e-6
        && a.MinZoom == b.MinZoom
        && a.MaxZoom == b.MaxZoom
        && a.ZoomControl == b.ZoomControl
        && a.AttributionControl == b.AttributionControl
        && a.BasemapId == b.BasemapId
        && a.ApiKey == b.ApiKey
        && a.ShowScaleControl == b.ShowScaleControl
        && a.ScrollWheelZoom == b.ScrollWheelZoom
        && a.DoubleClickZoom == b.DoubleClickZoom
        && a.Dragging == b.Dragging
        && a.KeyboardNavigation == b.KeyboardNavigation;
}
