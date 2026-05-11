using System.Text.Json;
using Microsoft.AspNetCore.Components;
using Microsoft.JSInterop;

namespace BlazorMap;

/// <summary>
/// Shared interop surface for provider-specific map components (Leaflet, MapLibre GL, Mapbox GL, OpenLayers, etc.).
/// </summary>
public abstract class BlazorInteractiveMapBase<TOptions> : ComponentBase, IAsyncDisposable
    where TOptions : class, new()
{
    private readonly string _mapId = $"bm_{Guid.NewGuid():N}";
    protected ElementReference _mapElement;
    private IJSObjectReference? _module;
    private DotNetObjectReference<BlazorInteractiveMapBase<TOptions>>? _dotNetRef;
    private bool _initialized;
    private TOptions _lastOptions = new();

    [Inject] private IJSRuntime Js { get; set; } = default!;

    protected abstract string JsModulePath { get; }

    /// <summary>CSS height of the map container (e.g. <c>400px</c>, <c>50vh</c>).</summary>
    [Parameter] public string Height { get; set; } = "320px";

    /// <summary>CSS width (default full width of parent).</summary>
    [Parameter] public string Width { get; set; } = "100%";

    [Parameter] public string? CssClass { get; set; }

    [Parameter] public TOptions Options { get; set; } = new();

    [Parameter] public EventCallback<BlazorMapLatLng> OnMapClick { get; set; }

    [Parameter] public EventCallback<BlazorMapLatLng> OnMapDoubleClick { get; set; }

    [Parameter] public EventCallback<BlazorMapViewState> OnViewChanged { get; set; }

    [Parameter] public EventCallback<string> OnMarkerClick { get; set; }

    [Parameter] public EventCallback<(string Id, BlazorMapLatLng Position)> OnMarkerDragEnd { get; set; }

    [Parameter]
    public EventCallback<(string LayerId, string Kind, BlazorMapLatLng Position)> OnVectorClick { get; set; }

    [Parameter] public EventCallback<(string LayerId, JsonElement Properties)> OnGeoJsonFeatureClick { get; set; }

    /// <summary>
    /// Raised once after the map has been created and imperative APIs (<see cref="AddMarkerAsync"/>, etc.) are safe to call.
    /// Prefer this over the parent page <c>OnAfterRenderAsync</c>, which can run before the map finishes initializing.
    /// </summary>
    [Parameter] public EventCallback OnMapReady { get; set; }

    [Parameter] public RenderFragment? ChildContent { get; set; }

    public string MapId => _mapId;

    /// <summary>True after the map instance is ready for JS interop calls.</summary>
    public bool IsMapReady => _initialized;

    public async ValueTask InvalidateSizeAsync()
    {
        if (!_initialized || _module is null) return;
        await _module.InvokeVoidAsync("invalidateSize", _mapId);
    }

    public async Task<BlazorMapViewState> GetViewAsync()
    {
        await EnsureMapAsync();
        var el = await _module!.InvokeAsync<JsonElement>("getView", _mapId);
        return ParseViewState(el);
    }

    public async ValueTask SetViewAsync(BlazorMapLatLng center, double? zoom = null, bool animate = true)
    {
        await EnsureMapAsync();
        await _module!.InvokeVoidAsync(
            "setView",
            _mapId,
            center.Latitude,
            center.Longitude,
            zoom,
            animate);
    }

    public async ValueTask FlyToAsync(BlazorMapLatLng center, double? zoom = null)
    {
        await EnsureMapAsync();
        await _module!.InvokeVoidAsync("flyTo", _mapId, center.Latitude, center.Longitude, zoom);
    }

    public async ValueTask FitBoundsAsync(BlazorMapLatLngBounds bounds, int paddingPixels = 48)
    {
        await EnsureMapAsync();
        await _module!.InvokeVoidAsync(
            "fitBounds",
            _mapId,
            bounds.SouthWest.Latitude,
            bounds.SouthWest.Longitude,
            bounds.NorthEast.Latitude,
            bounds.NorthEast.Longitude,
            paddingPixels);
    }

    /// <summary>Fits the view to the union of all markers.</summary>
    public async ValueTask FitBoundsToMarkersAsync(int paddingPixels = 48)
    {
        await EnsureMapAsync();
        await _module!.InvokeVoidAsync("fitBoundsToMarkers", _mapId, paddingPixels);
    }

    public async ValueTask AddMarkerAsync(BlazorMapMarkerModel marker)
    {
        await EnsureMapAsync();
        await _module!.InvokeVoidAsync(
            "addMarker",
            _mapId,
            marker.Id,
            new
            {
                lat = marker.Position.Latitude,
                lng = marker.Position.Longitude,
                popupHtml = marker.PopupHtml,
                title = marker.Title,
                draggable = marker.Draggable,
                iconUrl = marker.IconUrl,
                iconWidth = marker.IconWidth,
                iconHeight = marker.IconHeight,
                tooltipHtml = marker.TooltipHtml,
                tooltipPermanent = marker.TooltipPermanent,
                tooltipDirection = marker.TooltipDirection,
                zIndexOffset = marker.ZIndexOffset,
            });
    }

    public async ValueTask RemoveMarkerAsync(string markerId)
    {
        if (!_initialized || _module is null) return;
        await _module.InvokeVoidAsync("removeMarker", _mapId, markerId);
    }

    public async ValueTask ClearMarkersAsync()
    {
        if (!_initialized || _module is null) return;
        await _module.InvokeVoidAsync("clearMarkers", _mapId);
    }

    public async ValueTask SetMarkerPositionAsync(string markerId, BlazorMapLatLng position)
    {
        if (!_initialized || _module is null) return;
        await _module.InvokeVoidAsync(
            "setMarkerLatLng",
            _mapId,
            markerId,
            position.Latitude,
            position.Longitude);
    }

    public async ValueTask OpenMarkerPopupAsync(string markerId)
    {
        if (!_initialized || _module is null) return;
        await _module.InvokeVoidAsync("openMarkerPopup", _mapId, markerId);
    }

    public async ValueTask AddPolylineAsync(string layerId, IReadOnlyList<BlazorMapLatLng> path, BlazorMapVectorPathStyle? style = null)
    {
        await EnsureMapAsync();
        await _module!.InvokeVoidAsync("addPolyline", _mapId, layerId, ToJsBlazorMapLatLngs(path), ToJsStyle(style));
    }

    public async ValueTask AddPolygonAsync(string layerId, IReadOnlyList<BlazorMapLatLng> ring, BlazorMapVectorPathStyle? style = null)
    {
        await EnsureMapAsync();
        await _module!.InvokeVoidAsync("addPolygon", _mapId, layerId, ToJsBlazorMapLatLngs(ring), ToJsStyle(style));
    }

    public async ValueTask AddCircleAsync(
        string layerId,
        BlazorMapLatLng center,
        double radiusMeters,
        BlazorMapVectorPathStyle? style = null)
    {
        await EnsureMapAsync();
        await _module!.InvokeVoidAsync(
            "addCircle",
            _mapId,
            layerId,
            center.Latitude,
            center.Longitude,
            radiusMeters,
            ToJsStyle(style));
    }

    public async ValueTask AddRectangleAsync(string layerId, BlazorMapLatLngBounds bounds, BlazorMapVectorPathStyle? style = null)
    {
        await EnsureMapAsync();
        await _module!.InvokeVoidAsync(
            "addRectangle",
            _mapId,
            layerId,
            bounds.SouthWest.Latitude,
            bounds.SouthWest.Longitude,
            bounds.NorthEast.Latitude,
            bounds.NorthEast.Longitude,
            ToJsStyle(style));
    }

    public async ValueTask AddGeoJsonAsync(string layerId, string geoJson, BlazorMapVectorPathStyle? style = null)
    {
        await EnsureMapAsync();
        await _module!.InvokeVoidAsync("addGeoJson", _mapId, layerId, geoJson, ToJsStyle(style));
    }

    public async ValueTask AddTileOverlayAsync(BlazorMapTileOverlayOptions overlay)
    {
        await EnsureMapAsync();
        await _module!.InvokeVoidAsync(
            "addTileOverlay",
            _mapId,
            new
            {
                id = overlay.Id,
                urlTemplate = overlay.UrlTemplate,
                attribution = overlay.Attribution,
                opacity = overlay.Opacity,
                zIndex = overlay.ZIndex,
                maxZoom = overlay.MaxZoom,
            });
    }

    public async ValueTask RemoveTileOverlayAsync(string overlayId)
    {
        if (!_initialized || _module is null) return;
        await _module.InvokeVoidAsync("removeTileOverlay", _mapId, overlayId);
    }

    public async ValueTask RemoveLayerAsync(string layerId)
    {
        if (!_initialized || _module is null) return;
        await _module.InvokeVoidAsync("removeLayer", _mapId, layerId);
    }

    public async ValueTask ClearVectorLayersAsync()
    {
        if (!_initialized || _module is null) return;
        await _module.InvokeVoidAsync("clearVectorLayers", _mapId);
    }

    public async ValueTask SyncMarkersAsync(IEnumerable<BlazorMapMarkerModel> markers)
    {
        await ClearMarkersAsync();
        foreach (var m in markers)
        {
            await AddMarkerAsync(m);
        }
    }

    protected abstract object ToMapOptionsPayload(TOptions options);

    protected abstract TOptions CloneOptions(TOptions options);

    protected abstract bool OptionsEqual(TOptions a, TOptions b);

    private async ValueTask EnsureMapAsync()
    {
        if (!_initialized || _module is null)
        {
            throw new InvalidOperationException("The map has not finished initializing yet.");
        }
    }

    protected override async Task OnAfterRenderAsync(bool firstRender)
    {
        if (!firstRender) return;

        _module = await Js.InvokeAsync<IJSObjectReference>("import", JsModulePath);
        _dotNetRef = DotNetObjectReference.Create((BlazorInteractiveMapBase<TOptions>)this);

        await _module.InvokeVoidAsync("initMap", _mapId, _mapElement, _dotNetRef, ToMapOptionsPayload(Options));

        _initialized = true;
        _lastOptions = CloneOptions(Options);

        if (OnMapReady.HasDelegate)
        {
            await OnMapReady.InvokeAsync();
        }
    }

    protected override async Task OnParametersSetAsync()
    {
        if (!_initialized || _module is null) return;

        var o = Options;
        if (!OptionsEqual(_lastOptions, o))
        {
            await _module.InvokeVoidAsync("syncMapOptions", _mapId, ToMapOptionsPayload(o));
            _lastOptions = CloneOptions(o);
        }
    }

    [JSInvokable]
    public async Task ReportMapClick(JsonElement e)
    {
        var ll = ReadBlazorMapLatLng(e);
        if (OnMapClick.HasDelegate)
        {
            await OnMapClick.InvokeAsync(ll);
        }
    }

    [JSInvokable]
    public async Task ReportMapDoubleClick(JsonElement e)
    {
        if (!OnMapDoubleClick.HasDelegate) return;
        await OnMapDoubleClick.InvokeAsync(ReadBlazorMapLatLng(e));
    }

    [JSInvokable]
    public async Task ReportViewChanged(JsonElement e)
    {
        if (!OnViewChanged.HasDelegate) return;
        await OnViewChanged.InvokeAsync(ParseViewState(e));
    }

    [JSInvokable]
    public async Task ReportMarkerClick(string markerId)
    {
        if (OnMarkerClick.HasDelegate)
        {
            await OnMarkerClick.InvokeAsync(markerId);
        }
    }

    [JSInvokable]
    public async Task ReportMarkerDragEnd(string markerId, JsonElement position)
    {
        if (!OnMarkerDragEnd.HasDelegate) return;
        await OnMarkerDragEnd.InvokeAsync((markerId, ReadBlazorMapLatLng(position)));
    }

    [JSInvokable]
    public async Task ReportVectorClick(string layerId, string kind, JsonElement position)
    {
        if (!OnVectorClick.HasDelegate) return;
        await OnVectorClick.InvokeAsync((layerId, kind, ReadBlazorMapLatLng(position)));
    }

    [JSInvokable]
    public async Task ReportGeoJsonFeatureClick(string layerId, JsonElement properties)
    {
        if (!OnGeoJsonFeatureClick.HasDelegate) return;
        await OnGeoJsonFeatureClick.InvokeAsync((layerId, properties));
    }

    private static BlazorMapViewState ParseViewState(JsonElement e)
    {
        var center = ReadBlazorMapLatLng(e.GetProperty("center"));
        var zoom = e.GetProperty("zoom").GetDouble();
        var b = e.GetProperty("bounds");
        var sw = ReadBlazorMapLatLng(b.GetProperty("southWest"));
        var ne = ReadBlazorMapLatLng(b.GetProperty("northEast"));
        return new BlazorMapViewState
        {
            Center = center,
            Zoom = zoom,
            Bounds = new BlazorMapLatLngBounds(sw, ne),
        };
    }

    private static BlazorMapLatLng ReadBlazorMapLatLng(JsonElement e) =>
        new(e.GetProperty("lat").GetDouble(), e.GetProperty("lng").GetDouble());

    private static object[] ToJsBlazorMapLatLngs(IReadOnlyList<BlazorMapLatLng> pts) =>
        pts.Select(p => (object)new { lat = p.Latitude, lng = p.Longitude }).ToArray();

    private static object? ToJsStyle(BlazorMapVectorPathStyle? s)
    {
        if (s is null) return null;
        return new
        {
            s.Color,
            s.Weight,
            s.Opacity,
            fillColor = s.FillColor,
            s.FillOpacity,
            dashArray = s.DashArray,
        };
    }

    public async ValueTask DisposeAsync()
    {
        if (_module is not null)
        {
            try
            {
                if (_initialized)
                {
                    await _module.InvokeVoidAsync("destroyMap", _mapId);
                }
            }
            catch (JSDisconnectedException)
            {
                /* circuit gone */
            }

            try
            {
                await _module.DisposeAsync();
            }
            catch
            {
                /* ignore */
            }
        }

        _dotNetRef?.Dispose();
        _dotNetRef = null;
        _module = null;
        _initialized = false;
    }
}
