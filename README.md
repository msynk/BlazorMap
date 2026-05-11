# BlazorMap

A **Blazor WebAssembly** map library with **provider-specific** Razor components (**Leaflet**, **MapLibre GL JS**, **Mapbox GL JS**, and more). Each component imports a small ES module under `_content/BlazorMap/js/` that loads the vendor CSS/JS from a CDN the first time that provider initializes, so the host app does **not** need manual `<script>` / `<link>` tags for those libraries.

All public types (map components, `LatLng`, `LatLngBounds`, `LeafletMapDisplayOptions`, `MapLibreMapDisplayOptions`, `MapboxMapDisplayOptions`, etc.) live in the single **`BlazorMap`** namespace so consuming apps only need one `@using` directive.

## Requirements

- **.NET 10** SDK
- **Network access at runtime** (first load) to the CDN used by the provider you choose (unpkg for Leaflet and MapLibre, Mapbox for Mapbox GL).

## Quick start

### 1. Reference the library

Add a project reference to `src/BlazorMap/BlazorMap.csproj` from your Blazor WebAssembly app (or pack the project as a NuGet package if you prefer).

### 2. Use a component (no vendor scripts in `index.html`)

```razor
@using BlazorMap

<BlazorLeafletMap @ref="_map"
                  Height="420px"
                  Options="_options"
                  OnMapReady="OnMapReady"
                  OnViewChanged="OnViewChanged" />

@code {
    private BlazorLeafletMap? _map;
    private readonly LeafletMapDisplayOptions _options = new()
    {
        Center = new LatLng(51.505, -0.09),
        Zoom = 13
    };

    private async Task OnMapReady()
    {
        if (_map is null) return;
        await _map.AddMarkerAsync(new MapMarkerModel
        {
            Id = "home",
            Position = _options.Center,
            Title = "London"
        });
    }

    private Task OnViewChanged(MapViewState state) => Task.CompletedTask;
}
```

**MapLibre GL** (open source, no token for the default demo style) uses `BlazorMapLibreMap` and `MapLibreMapDisplayOptions`:

```razor
<BlazorMapLibreMap Options="@_libreOptions" Height="420px" />

@code {
    private readonly MapLibreMapDisplayOptions _libreOptions = new()
    {
        Center = new LatLng(51.505, -0.09),
        Zoom = 13
    };
}
```

**Mapbox GL** uses `BlazorMapboxMap` and `MapboxMapDisplayOptions` (requires a [Mapbox access token](https://docs.mapbox.com/help/getting-started/access-tokens/) for `mapbox://` styles):

```razor
<BlazorMapboxMap Options="@_mapboxOptions" Height="420px" />

@code {
    private readonly MapboxMapDisplayOptions _mapboxOptions = new()
    {
        AccessToken = "YOUR_TOKEN",
        Center = new LatLng(51.505, -0.09),
        Zoom = 13
    };
}
```

Use **`OnMapReady`** (or check `IsMapReady`) before calling imperative methods such as `AddMarkerAsync`—`OnAfterRenderAsync` on the parent page can run before the map finishes initializing.

## Features

Shared API on `BlazorInteractiveMapBase<TOptions>` (implemented by each provider component):

- **Display**: center, zoom, min/max zoom, interaction toggles; Leaflet adds base tile URL/attribution/opacity and scale control; MapLibre/Mapbox GL add style URL and navigation control (Mapbox also uses an access token for Mapbox-hosted assets).
- **Markers**: HTML popups (GL engines: no Leaflet-style tooltips on markers), custom icons, drag end callbacks, `SyncMarkersAsync`, fit bounds to markers.
- **Vectors**: polylines, polygons, circles, rectangles, GeoJSON layers; shared `VectorPathStyle`.
- **Tile overlays** (Leaflet and GL raster): `TileOverlayOptions` on top of the base map.
- **Events**: map click/double-click, view changed, marker click/drag end, vector click, GeoJSON feature click (properties as `JsonElement`).
- **View helpers**: `GetViewAsync`, `SetViewAsync`, `FlyToAsync`, `FitBoundsAsync`, `InvalidateSizeAsync`.

## Run the demo

From the repository root:

```bash
dotnet run --project src/BlazorMap.Demo/BlazorMap.Demo.csproj
```

The demo includes Leaflet pages (markers, vectors, GeoJSON, tiles, events, enterprise-style options), **MapLibre** (`/maplibre`, no token), and **Mapbox** (`/mapbox`). For Mapbox, set `Mapbox:AccessToken` in `src/BlazorMap.Demo/wwwroot/appsettings.json`.

## Project layout

| Path | Role |
|------|------|
| `src/BlazorMap/` | Razor class library: `Components/<ComponentName>/` for each map, `Models/`, `wwwroot/js/` modules |
| `src/BlazorMap.Demo/` | Sample Blazor WebAssembly host |

## License

This project is licensed under the [MIT License](LICENSE).
