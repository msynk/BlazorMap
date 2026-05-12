# BlazorMap

A **Blazor WebAssembly** map library with **provider-specific** Razor components for **Leaflet**, **MapLibre GL JS**, **Mapbox GL JS**, **OpenLayers**, **ArcGIS Maps SDK**, **Azure Maps**, and **CesiumJS** (3D globe). Each component imports a small ES module under `_content/BlazorMap/js/` that loads the vendor CSS/JS from a CDN the first time that provider initializes, so the host app does **not** need manual `<script>` / `<link>` tags for those libraries.

All public types live in the single **`BlazorMap`** namespace — consuming apps only need one `@using` directive.

## Requirements

- **.NET 10** SDK
- **Network access at runtime** (first load) to the CDN used by the chosen provider.

## Providers

| Component | Options class | CDN source | Token required |
|-----------|---------------|------------|----------------|
| `BlazorLeafletMap` | `BlazorLeafletMapOptions` | unpkg | No (OSM tiles) |
| `BlazorMapLibreMap` | `BlazorMapLibreMapOptions` | unpkg | No (default demo style) |
| `BlazorMapboxMap` | `BlazorMapboxMapOptions` | Mapbox CDN | **Yes** — [Mapbox access token](https://docs.mapbox.com/help/getting-started/access-tokens/) |
| `BlazorOpenLayersMap` | `BlazorOpenLayersMapOptions` | esm.sh + jsDelivr | No (OSM tiles) |
| `BlazorArcGisMap` | `BlazorArcGisMapOptions` | Esri CDN | No for `"osm"` basemap; **Yes** for Esri-hosted basemaps |
| `BlazorAzureMapsMap` | `BlazorAzureMapsMapOptions` | Microsoft CDN | **Yes** — [Azure Maps subscription key](https://portal.azure.com) |
| `BlazorCesiumMap` | `BlazorCesiumMapOptions` | Cesium CDN | No (OSM tiles + flat terrain); **Yes** for Cesium World Terrain + Bing imagery |

## Quick start

### 1. Reference the library

Add a project reference to `src/BlazorMap/BlazorMap.csproj` from your Blazor WebAssembly app (or pack the project as a NuGet package if you prefer).

### 2. Use a component (no vendor scripts in `index.html`)

**Leaflet** — tile-based raster map, no token needed for OSM:

```razor
@using BlazorMap

<BlazorLeafletMap @ref="_map"
                  Height="420px"
                  Options="_options"
                  OnMapReady="OnMapReady"
                  OnViewChanged="OnViewChanged" />

@code {
    private BlazorLeafletMap? _map;
    private readonly BlazorLeafletMapOptions _options = new()
    {
        Center = new BlazorMapLatLng(51.505, -0.09),
        Zoom = 13
    };

    private async Task OnMapReady()
    {
        if (_map is null) return;
        await _map.AddMarkerAsync(new BlazorMapMarkerModel
        {
            Id = "home",
            Position = _options.Center,
            Title = "London"
        });
    }

    private Task OnViewChanged(BlazorMapViewState state) => Task.CompletedTask;
}
```

**MapLibre GL** — open-source vector tiles, no token for the default demo style:

```razor
<BlazorMapLibreMap Options="@_libreOptions" Height="420px" />

@code {
    private readonly BlazorMapLibreMapOptions _libreOptions = new()
    {
        Center = new BlazorMapLatLng(51.505, -0.09),
        Zoom = 13
    };
}
```

**Mapbox GL** — requires a [Mapbox access token](https://docs.mapbox.com/help/getting-started/access-tokens/) for `mapbox://` styles:

```razor
<BlazorMapboxMap Options="@_mapboxOptions" Height="420px" />

@code {
    private readonly BlazorMapboxMapOptions _mapboxOptions = new()
    {
        AccessToken = "YOUR_MAPBOX_TOKEN",
        Center = new BlazorMapLatLng(51.505, -0.09),
        Zoom = 13
    };
}
```

**OpenLayers** — XYZ tile source (OSM by default), no token needed:

```razor
<BlazorOpenLayersMap Options="@_olOptions" Height="420px" />

@code {
    private readonly BlazorOpenLayersMapOptions _olOptions = new()
    {
        Center = new BlazorMapLatLng(51.505, -0.09),
        Zoom = 13
    };
}
```

**ArcGIS Maps SDK** — `"osm"` basemap works without a key; Esri-hosted basemaps (`"streets-vector"`, `"satellite"`, `"hybrid"`, etc.) require an [ArcGIS API key](https://developers.arcgis.com/):

```razor
<BlazorArcGisMap Options="@_arcGisOptions" Height="420px" />

@code {
    private readonly BlazorArcGisMapOptions _arcGisOptions = new()
    {
        Center = new BlazorMapLatLng(51.505, -0.09),
        Zoom = 5,
        BasemapId = "osm",          // free — no ApiKey needed
        // BasemapId = "satellite", // requires ApiKey
        // ApiKey = "YOUR_ARCGIS_API_KEY",
    };
}
```

**Azure Maps** — requires an [Azure Maps subscription key](https://portal.azure.com):

```razor
<BlazorAzureMapsMap Options="@_azureOptions" Height="420px" />

@code {
    private readonly BlazorAzureMapsMapOptions _azureOptions = new()
    {
        Center = new BlazorMapLatLng(51.505, -0.09),
        Zoom = 5,
        Style = "road",             // "satellite", "night", "grayscale_dark", …
        SubscriptionKey = "YOUR_AZURE_MAPS_KEY",
    };
}
```

**CesiumJS** — 3D globe; OSM tiles and smooth-ellipsoid terrain work without a token; a free [Cesium ion token](https://cesium.com/ion/) unlocks Cesium World Terrain and Bing imagery:

```razor
<BlazorCesiumMap Options="@_cesiumOptions" Height="480px" />

@code {
    private readonly BlazorCesiumMapOptions _cesiumOptions = new()
    {
        Center = new BlazorMapLatLng(20, 0),
        Altitude = 15_000_000,      // camera height in metres above surface
        SceneMode = "scene3d",      // "scene2d" | "columbus"
        // IonAccessToken = "YOUR_CESIUM_ION_TOKEN",
        // TerrainEnabled = true,   // requires IonAccessToken
    };
}
```

Use **`OnMapReady`** (or check `IsMapReady`) before calling imperative methods such as `AddMarkerAsync` — `OnAfterRenderAsync` on the parent page can fire before the map finishes initializing.

## Features

All components inherit from `BlazorInteractiveMapBase<TOptions>` and expose an identical imperative API:

### Markers

| Method | Description |
|--------|-------------|
| `AddMarkerAsync(marker)` | Add a marker with optional popup HTML, tooltip, custom icon, and drag support |
| `RemoveMarkerAsync(id)` | Remove a single marker by ID |
| `ClearMarkersAsync()` | Remove all markers |
| `SyncMarkersAsync(markers)` | Replace all markers in one call |
| `SetMarkerPositionAsync(id, latlng)` | Move a marker programmatically |
| `OpenMarkerPopupAsync(id)` | Open a marker's popup |
| `FitBoundsToMarkersAsync(padding?)` | Zoom/pan to fit all current markers |

### Vectors

| Method | Description |
|--------|-------------|
| `AddPolylineAsync(id, path, style?)` | Draw a polyline |
| `AddPolygonAsync(id, ring, style?)` | Draw a filled polygon |
| `AddCircleAsync(id, center, radiusM, style?)` | Draw a circle (radius in metres) |
| `AddRectangleAsync(id, bounds, style?)` | Draw a rectangle |
| `AddGeoJsonAsync(id, geoJson, style?)` | Render a GeoJSON string as a layer |
| `RemoveLayerAsync(id)` | Remove a vector layer by ID |
| `ClearVectorLayersAsync()` | Remove all vector layers |

### Tile overlays

| Method | Description |
|--------|-------------|
| `AddTileOverlayAsync(options)` | Add a raster tile overlay (`BlazorMapTileOverlayOptions`) |
| `RemoveTileOverlayAsync(id)` | Remove a tile overlay by ID |

### View helpers

| Method | Description |
|--------|-------------|
| `GetViewAsync()` | Returns current `BlazorMapViewState` (center, zoom, bounds) |
| `SetViewAsync(center, zoom?, animate?)` | Set center and optional zoom level |
| `FlyToAsync(center, zoom?)` | Animated pan/zoom |
| `FitBoundsAsync(bounds, padding?)` | Fit view to a `BlazorMapLatLngBounds` |
| `InvalidateSizeAsync()` | Recalculate map size after a container resize |

### Events

| Callback | Payload | Description |
|----------|---------|-------------|
| `OnMapReady` | — | Fired once after the map is ready for JS interop calls |
| `OnMapClick` | `BlazorMapLatLng` | User clicked the map |
| `OnMapDoubleClick` | `BlazorMapLatLng` | User double-clicked the map |
| `OnViewChanged` | `BlazorMapViewState` | Map panned or zoomed |
| `OnMarkerClick` | `string` (marker ID) | User clicked a marker |
| `OnMarkerDragEnd` | `(string Id, BlazorMapLatLng Position)` | Draggable marker dropped |
| `OnVectorClick` | `(string LayerId, string Kind, BlazorMapLatLng Position)` | User clicked a vector layer |
| `OnGeoJsonFeatureClick` | `(string LayerId, JsonElement Properties)` | User clicked a GeoJSON feature |

### Provider-specific options

Beyond the common `Center`, `Zoom`, `MinZoom`, `MaxZoom`, and interaction toggles (`ScrollWheelZoom`, `DoubleClickZoom`, `Dragging`, `KeyboardNavigation`), each provider adds its own options:

- **Leaflet / OpenLayers**: `TileUrl`, `TileAttribution`, `TileOpacity`, `TileMaxZoom`, `MaxBounds`, `ShowScaleControl`, `ScaleControlImperial`, `BoxZoom`.
- **MapLibre GL / Mapbox GL**: `StyleUrl`, `ShowNavigationControl`. Mapbox adds `AccessToken`.
- **ArcGIS**: `BasemapId` (`"osm"`, `"streets-vector"`, `"satellite"`, `"hybrid"`, `"topo-vector"`, `"dark-gray-vector"`, …), `ApiKey`, `ShowScaleControl`.
- **Azure Maps**: `Style` (`"road"`, `"satellite"`, `"satellite_road_labels"`, `"night"`, `"grayscale_dark"`, …), `SubscriptionKey`, `ShowScaleControl`.
- **CesiumJS**: `Altitude`, `ImageryStyle` (`"osm"`, `"bing_aerial"`, `"bing_labels"`, `"none"`), `IonAccessToken`, `SceneMode` (`"scene3d"`, `"scene2d"`, `"columbus"`), `TerrainEnabled`, `ShadowsEnabled`, and widget toggles: `AnimationWidget`, `TimelineWidget`, `BaseLayerPicker`, `NavigationHelpButton`, `HomeButton`, `FullscreenButton`, `Geocoder`, `InfoBox`.

## Shared models

| Type | Description |
|------|-------------|
| `BlazorMapLatLng` | Geographic coordinate (`Latitude`, `Longitude`) |
| `BlazorMapLatLngBounds` | Bounding box (`SouthWest`, `NorthEast`) |
| `BlazorMapMarkerModel` | Marker descriptor: `Id`, `Position`, `Title`, `PopupHtml`, `TooltipHtml`, `TooltipPermanent`, `TooltipDirection`, `IconUrl`, `IconWidth`, `IconHeight`, `Draggable`, `ZIndexOffset` |
| `BlazorMapViewState` | Snapshot of current view: `Center`, `Zoom`, `Bounds` |
| `BlazorMapTileOverlayOptions` | Tile overlay: `Id`, `UrlTemplate`, `Attribution`, `Opacity`, `ZIndex`, `MaxZoom` |
| `BlazorMapVectorPathStyle` | Stroke/fill style: `Color`, `Weight`, `Opacity`, `FillColor`, `FillOpacity`, `DashArray` |

## Run the demo

```bash
dotnet run --project src/BlazorMap.Demo/BlazorMap.Demo.csproj
```

Each provider has a dedicated section with the same set of demo pages:

| Route prefix | Provider | Token/key |
|---|---|---|
| `/leaflet` | Leaflet | None (OSM) |
| `/maplibre` | MapLibre GL | None |
| `/mapbox` | Mapbox GL | Set `Mapbox:AccessToken` in `wwwroot/appsettings.json` |
| `/openlayers` | OpenLayers | None (OSM) |
| `/arcgis` | ArcGIS Maps SDK | None for OSM basemap |
| `/azuremaps` | Azure Maps | Paste key in the demo UI |
| `/cesium` | CesiumJS | Paste ion token in the demo UI |

Each provider exposes the same sub-pages: **markers**, **vectors**, **geojson**, **tiles**, **events**, and **enterprise** (advanced options).

## Project layout

| Path | Role |
|------|------|
| `src/BlazorMap/` | Razor class library |
| `src/BlazorMap/Components/BlazorInteractiveMapBase.cs` | Shared base component and full imperative API |
| `src/BlazorMap/Components/<Name>/` | Per-provider component (`.razor` + `.razor.cs`) and options class |
| `src/BlazorMap/Models/` | Shared DTOs: `BlazorMapLatLng`, `BlazorMapLatLngBounds`, `BlazorMapMarkerModel`, `BlazorMapViewState`, `BlazorMapTileOverlayOptions`, `BlazorMapVectorPathStyle` |
| `src/BlazorMap/wwwroot/js/` | ES modules (`blazorLeafletMap.js`, `blazorMapLibreMap.js`, `blazorMapboxMap.js`, `blazorOpenLayersMap.js`, `blazorArcGisMap.js`, `blazorAzureMapsMap.js`, `blazorCesiumMap.js`) + `mapDependencyLoader.js` |
| `src/BlazorMap.Demo/` | Sample Blazor WebAssembly host with per-provider demo pages |

## License

This project is licensed under the [MIT License](LICENSE).
