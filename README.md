# BlazorMap

A **Blazor WebAssembly** map component built on [Leaflet](https://leafletjs.com/). The library exposes a Razor component plus C# APIs for markers, vector layers, GeoJSON, optional tile overlays, and map events—backed by a small ES module under `_content/BlazorMap/js/`.

Geographic DTOs (`LatLng`, `LatLngBounds`, `MapDisplayOptions`, etc.) live in the **`BlazorMapKit`** namespace so they stay easy to reuse without colliding with other map types in your app.

## Requirements

- **.NET 10** SDK
- **Leaflet 1.9.x** loaded on the host page **before** Blazor starts (CSS + JS). The interop module expects `window.L` to exist; otherwise initialization throws with a clear error.

## Quick start

### 1. Reference the library

Add a project reference to `src/BlazorMap/BlazorMap.csproj` from your Blazor WebAssembly app (or pack the project as a NuGet package if you prefer).

### 2. Load Leaflet on `index.html`

Match the pattern used in the demo—Leaflet scripts in `<head>` / end of `<body>` **before** `_framework/blazor.webassembly*.js`:

```html
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" crossorigin="" />
<!-- ... -->
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js" crossorigin=""></script>
<script src="_framework/blazor.webassembly#[.{fingerprint}].js"></script>
```

### 3. Use the component

```razor
@using BlazorMap.Components
@using BlazorMapKit

<BlazorMap @ref="_map"
           Height="420px"
           Options="_options"
           OnMapReady="OnMapReady"
           OnViewChanged="OnViewChanged" />

@code {
    private BlazorMap? _map;
    private readonly MapDisplayOptions _options = new()
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

Use **`OnMapReady`** (or check `IsMapReady`) before calling imperative methods such as `AddMarkerAsync`—`OnAfterRenderAsync` on the parent page can run before the map finishes initializing.

## Features

- **Display**: center, zoom, min/max zoom, base tile URL and attribution, tile opacity, optional `MaxBounds`, zoom/attribution/scale controls, scroll wheel / double-click / box zoom / drag / keyboard toggles.
- **Markers**: HTML popups, tooltips, custom icons, drag end callbacks, `SyncMarkersAsync`, fit bounds to markers.
- **Vectors**: polylines, polygons, circles, rectangles, GeoJSON layers; shared `VectorPathStyle` (color, weight, opacity, fill, dash array).
- **Tile overlays**: additional `TileOverlayOptions` layers on top of the base map.
- **Events**: map click/double-click, view changed, marker click/drag end, vector click, GeoJSON feature click (properties as `JsonElement`).
- **View helpers**: `GetViewAsync`, `SetViewAsync`, `FlyToAsync`, `FitBoundsAsync`, `InvalidateSizeAsync` (e.g. after layout changes).

## Run the demo

From the repository root:

```bash
dotnet run --project src/BlazorMap.Demo/BlazorMap.Demo.csproj
```

The demo includes pages for markers, vectors, GeoJSON, tiles, events, and enterprise-style options (e.g. max bounds, scale control).

## Project layout

| Path | Role |
|------|------|
| `src/BlazorMap/` | Razor class library: `BlazorMap` component, models, `wwwroot/js/blazorMap.js` |
| `src/BlazorMap.Demo/` | Sample Blazor WebAssembly host |

## License

This project is licensed under the [MIT License](LICENSE).
