namespace BlazorMap;

public partial class BlazorAzureMapsMap
{
    protected override string JsModulePath => "./_content/BlazorMap/js/blazorAzureMapsMap.js";

    protected override object ToMapOptionsPayload(BlazorAzureMapsMapOptions o) =>
        new
        {
            center           = new { lat = o.Center.Latitude, lng = o.Center.Longitude },
            zoom             = o.Zoom,
            minZoom          = o.MinZoom,
            maxZoom          = o.MaxZoom,
            zoomControl      = o.ZoomControl,
            attributionControl = o.AttributionControl,
            style            = o.Style,
            subscriptionKey  = o.SubscriptionKey,
            showScaleControl = o.ShowScaleControl,
            scrollWheelZoom  = o.ScrollWheelZoom,
            doubleClickZoom  = o.DoubleClickZoom,
            dragging         = o.Dragging,
            keyboardNavigation = o.KeyboardNavigation,
        };

    protected override BlazorAzureMapsMapOptions CloneOptions(BlazorAzureMapsMapOptions o) =>
        new()
        {
            Center             = o.Center,
            Zoom               = o.Zoom,
            MinZoom            = o.MinZoom,
            MaxZoom            = o.MaxZoom,
            ZoomControl        = o.ZoomControl,
            AttributionControl = o.AttributionControl,
            Style              = o.Style,
            SubscriptionKey    = o.SubscriptionKey,
            ShowScaleControl   = o.ShowScaleControl,
            ScrollWheelZoom    = o.ScrollWheelZoom,
            DoubleClickZoom    = o.DoubleClickZoom,
            Dragging           = o.Dragging,
            KeyboardNavigation = o.KeyboardNavigation,
        };

    protected override bool OptionsEqual(BlazorAzureMapsMapOptions a, BlazorAzureMapsMapOptions b) =>
        a.Center.Equals(b.Center)
        && Math.Abs(a.Zoom - b.Zoom) < 1e-6
        && a.MinZoom            == b.MinZoom
        && a.MaxZoom            == b.MaxZoom
        && a.ZoomControl        == b.ZoomControl
        && a.AttributionControl == b.AttributionControl
        && a.Style              == b.Style
        && a.SubscriptionKey    == b.SubscriptionKey
        && a.ShowScaleControl   == b.ShowScaleControl
        && a.ScrollWheelZoom    == b.ScrollWheelZoom
        && a.DoubleClickZoom    == b.DoubleClickZoom
        && a.Dragging           == b.Dragging
        && a.KeyboardNavigation == b.KeyboardNavigation;
}
