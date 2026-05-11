/**
 * BlazorArcGisMap — ArcGIS Maps SDK for JavaScript 5.0 bridge.
 * ArcGIS 5.0 dropped the AMD CDN loader in favour of a pure ES-module CDN that
 * exposes a global $arcgis.import() helper.  We load the CDN via a
 * <script type="module"> tag (so the browser treats it as an ES module) and
 * then use $arcgis.import() to pull individual core-API classes.
 */
import { loadStylesheet } from "./mapDependencyLoader.js";

const maps = new Map();

const ARCGIS_VER = "5.0";
const ARCGIS_CDN_URL = `https://js.arcgis.com/${ARCGIS_VER}/`;
const ARCGIS_CSS_URL = `https://js.arcgis.com/${ARCGIS_VER}/esri/themes/light/main.css`;

// Deduplicated <script type="module"> loader (loadScript from mapDependencyLoader
// does not set type="module", which causes "Cannot use import statement outside
// a module" for ArcGIS 5.0's ESM-only CDN entry point).
const _moduleScripts = new Map();

function loadModuleScript(src) {
  let p = _moduleScripts.get(src);
  if (p) return p;
  p = new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) { resolve(); return; }
    const el = document.createElement("script");
    el.type = "module";
    el.src = src;
    el.onload = () => resolve();
    el.onerror = () => reject(new Error(`Failed to load ArcGIS CDN: ${src}`));
    document.head.appendChild(el);
  });
  _moduleScripts.set(src, p);
  return p;
}

/** Polls until globalThis.$arcgis.import is available (set by the CDN module). */
function waitForArcGis(timeoutMs = 30_000) {
  const t0 = Date.now();
  return new Promise((resolve, reject) => {
    const tick = () => {
      if (typeof globalThis.$arcgis?.import === "function") {
        resolve(globalThis.$arcgis);
      } else if (Date.now() - t0 > timeoutMs) {
        reject(new Error("Timed out waiting for $arcgis global (ArcGIS CDN not ready)"));
      } else {
        setTimeout(tick, 50);
      }
    };
    tick();
  });
}

/** @type {Promise<object> | null} */
let esriLoadPromise = null;

async function loadEsriModules() {
  if (esriLoadPromise) return esriLoadPromise;
  esriLoadPromise = (async () => {
    // CSS — silently ignore errors; ArcGIS 5.0 may auto-inject styles via ESM.
    await loadStylesheet(ARCGIS_CSS_URL).catch(() => {});

    // Load the ArcGIS CDN as a proper ES module.
    await loadModuleScript(ARCGIS_CDN_URL);

    // Wait for the $arcgis global exposed by the CDN script.
    const $arcgis = await waitForArcGis();
    const imp = (path) => $arcgis.import(path);

    // $arcgis.import returns the default export of each module (the class/singleton).
    // For webMercatorUtils (utility namespace) it returns the namespace object.
    const [
      EsriMap, MapView, GraphicsLayer, WebTileLayer,
      Graphic, Point, Polyline, Polygon, Extent,
      SimpleMarkerSymbol, PictureMarkerSymbol,
      SimpleLineSymbol, SimpleFillSymbol,
      webMercatorUtils, ScaleBar, esriConfig, reactiveUtils,
    ] = await Promise.all([
      imp("@arcgis/core/Map.js"),
      imp("@arcgis/core/views/MapView.js"),
      imp("@arcgis/core/layers/GraphicsLayer.js"),
      imp("@arcgis/core/layers/WebTileLayer.js"),
      imp("@arcgis/core/Graphic.js"),
      imp("@arcgis/core/geometry/Point.js"),
      imp("@arcgis/core/geometry/Polyline.js"),
      imp("@arcgis/core/geometry/Polygon.js"),
      imp("@arcgis/core/geometry/Extent.js"),
      imp("@arcgis/core/symbols/SimpleMarkerSymbol.js"),
      imp("@arcgis/core/symbols/PictureMarkerSymbol.js"),
      imp("@arcgis/core/symbols/SimpleLineSymbol.js"),
      imp("@arcgis/core/symbols/SimpleFillSymbol.js"),
      imp("@arcgis/core/geometry/support/webMercatorUtils.js"),
      imp("@arcgis/core/widgets/ScaleBar.js"),
      imp("@arcgis/core/config.js"),
      imp("@arcgis/core/core/reactiveUtils.js"),
    ]);

    return {
      esriConfig, EsriMap, MapView, GraphicsLayer, WebTileLayer,
      Graphic, Point, Polyline, Polygon, Extent,
      SimpleMarkerSymbol, PictureMarkerSymbol,
      SimpleLineSymbol, SimpleFillSymbol,
      webMercatorUtils, ScaleBar, reactiveUtils,
    };
  })();
  return esriLoadPromise;
}

// ---------------------------------------------------------------------------
// Utility helpers
// ---------------------------------------------------------------------------

function pick(o, camel, pascal) {
  const v = o?.[camel];
  return v !== undefined && v !== null ? v : o?.[pascal];
}

function readCenter(o) {
  const c = pick(o, "center", "Center");
  if (!c) return [-0.09, 51.505]; // [lng, lat]
  const lat = pick(c, "lat", "Latitude") ?? 51.505;
  const lng = pick(c, "lng", "Longitude") ?? -0.09;
  return [lng, lat];
}

/** Converts a CSS hex colour + alpha (0-1) to an ArcGIS [r, g, b, a] array (a is 0-255). */
function hexToRgba(hex, alpha) {
  const a = Math.round((alpha ?? 1) * 255);
  if (!hex || typeof hex !== "string") return [51, 136, 255, a];
  let h = hex.replace("#", "");
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  const n = parseInt(h, 16);
  if (Number.isNaN(n)) return [51, 136, 255, a];
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255, a];
}

function getState(mapId) {
  const s = maps.get(mapId);
  if (!s) throw new Error(`BlazorArcGisMap: unknown map id '${mapId}'`);
  return s;
}

/** Approximate a circle as a closed polygon ring in geographic coordinates. */
function circleRing(lat, lng, radiusMeters, points = 64) {
  const R = 6371000;
  const ring = [];
  const lat1 = (lat * Math.PI) / 180;
  const lng1 = (lng * Math.PI) / 180;
  const angular = radiusMeters / R;
  for (let i = 0; i <= points; i++) {
    const bearing = (i / points) * 2 * Math.PI;
    const lat2 = Math.asin(
      Math.sin(lat1) * Math.cos(angular) +
        Math.cos(lat1) * Math.sin(angular) * Math.cos(bearing)
    );
    const lng2 =
      lng1 +
      Math.atan2(
        Math.sin(bearing) * Math.sin(angular) * Math.cos(lat1),
        Math.cos(angular) - Math.sin(lat1) * Math.sin(lat2)
      );
    ring.push([(lng2 * 180) / Math.PI, (lat2 * 180) / Math.PI]);
  }
  return ring;
}

// ---------------------------------------------------------------------------
// Symbol factories
// ---------------------------------------------------------------------------

function makeLineSymbol(esri, style) {
  const color = pick(style, "color", "Color") ?? "#3388ff";
  const weight = pick(style, "weight", "Weight") ?? 3;
  const opacity = pick(style, "opacity", "Opacity") ?? 1;
  const dash = pick(style, "dashArray", "DashArray");
  return new esri.SimpleLineSymbol({
    color: hexToRgba(color, opacity),
    width: weight,
    style: dash ? "dash" : "solid",
  });
}

function makeFillSymbol(esri, style) {
  const color = pick(style, "color", "Color") ?? "#3388ff";
  const weight = pick(style, "weight", "Weight") ?? 3;
  const opacity = pick(style, "opacity", "Opacity") ?? 1;
  const fillColor = pick(style, "fillColor", "FillColor") ?? color;
  const fillOpacity = pick(style, "fillOpacity", "FillOpacity") ?? 0.2;
  const dash = pick(style, "dashArray", "DashArray");
  return new esri.SimpleFillSymbol({
    color: hexToRgba(fillColor, fillOpacity),
    outline: new esri.SimpleLineSymbol({
      color: hexToRgba(color, opacity),
      width: weight,
      style: dash ? "dash" : "solid",
    }),
  });
}

function makePointSymbol(esri, style) {
  const color = pick(style, "color", "Color") ?? "#3388ff";
  return new esri.SimpleMarkerSymbol({
    color: hexToRgba(color, 1),
    outline: { color: [255, 255, 255, 255], width: 2 },
    size: 8,
  });
}

function markerSymbolFromOpts(esri, opts) {
  const iconUrl = pick(opts, "iconUrl", "IconUrl");
  if (iconUrl) {
    const w = pick(opts, "iconWidth", "IconWidth") || 32;
    const h = pick(opts, "iconHeight", "IconHeight") || 32;
    return new esri.PictureMarkerSymbol({ url: iconUrl, width: w, height: h });
  }
  return new esri.SimpleMarkerSymbol({
    color: [51, 136, 255, 255],
    outline: { color: [255, 255, 255, 255], width: 2 },
    size: 14,
  });
}

// ---------------------------------------------------------------------------
// GeoJSON → Graphic helpers
// ---------------------------------------------------------------------------

function geoJsonToGraphics(esri, geoJsonString, style, layerId) {
  let gj;
  try {
    gj = typeof geoJsonString === "string" ? JSON.parse(geoJsonString) : geoJsonString;
  } catch {
    throw new Error("BlazorArcGisMap: invalid GeoJSON string");
  }
  const features =
    gj.type === "FeatureCollection"
      ? gj.features
      : gj.type === "Feature"
      ? [gj]
      : [{ type: "Feature", geometry: gj, properties: {} }];
  return features.flatMap((f) => featureToGraphics(esri, f, style, layerId));
}

function featureToGraphics(esri, feature, style, layerId) {
  const geom = feature.geometry;
  const props = feature.properties || {};
  if (!geom) return [];
  const attrs = { ...props, layerId, bmKind: "geojson" };

  switch (geom.type) {
    case "Point":
      return [
        new esri.Graphic({
          geometry: new esri.Point({
            longitude: geom.coordinates[0],
            latitude: geom.coordinates[1],
          }),
          symbol: makePointSymbol(esri, style),
          attributes: attrs,
        }),
      ];
    case "MultiPoint":
      return geom.coordinates.map(
        (c) =>
          new esri.Graphic({
            geometry: new esri.Point({ longitude: c[0], latitude: c[1] }),
            symbol: makePointSymbol(esri, style),
            attributes: attrs,
          })
      );
    case "LineString":
      return [
        new esri.Graphic({
          geometry: new esri.Polyline({
            paths: [geom.coordinates],
            spatialReference: { wkid: 4326 },
          }),
          symbol: makeLineSymbol(esri, style),
          attributes: attrs,
        }),
      ];
    case "MultiLineString":
      return [
        new esri.Graphic({
          geometry: new esri.Polyline({
            paths: geom.coordinates,
            spatialReference: { wkid: 4326 },
          }),
          symbol: makeLineSymbol(esri, style),
          attributes: attrs,
        }),
      ];
    case "Polygon":
      return [
        new esri.Graphic({
          geometry: new esri.Polygon({
            rings: geom.coordinates,
            spatialReference: { wkid: 4326 },
          }),
          symbol: makeFillSymbol(esri, style),
          attributes: attrs,
        }),
      ];
    case "MultiPolygon":
      return geom.coordinates.map(
        (rings) =>
          new esri.Graphic({
            geometry: new esri.Polygon({
              rings,
              spatialReference: { wkid: 4326 },
            }),
            symbol: makeFillSymbol(esri, style),
            attributes: attrs,
          })
      );
    default:
      return [];
  }
}

// ---------------------------------------------------------------------------
// View-state helpers
// ---------------------------------------------------------------------------

function extentToGeographic(esri, view) {
  const ext = view.extent;
  if (!ext) return null;
  try {
    const sr = view.spatialReference;
    if (sr && (sr.isWebMercator || sr.wkid === 3857 || sr.wkid === 102100)) {
      return esri.webMercatorUtils.webMercatorToGeographic(ext);
    }
    return ext; // already geographic
  } catch {
    return null;
  }
}

function notifyView(s) {
  if (!s.view?.ready) return;
  const center = s.view.center;
  if (!center) return;
  const zoom = s.view.zoom ?? 0;
  const geoExt = extentToGeographic(s.esri, s.view);
  const bounds = geoExt
    ? {
        southWest: { lat: geoExt.ymin, lng: geoExt.xmin },
        northEast: { lat: geoExt.ymax, lng: geoExt.xmax },
      }
    : { southWest: { lat: 0, lng: 0 }, northEast: { lat: 0, lng: 0 } };

  queueMicrotask(() => {
    s.dotNetRef.invokeMethodAsync("ReportViewChanged", {
      center: { lat: center.latitude, lng: center.longitude },
      zoom,
      bounds,
    });
  });
}

// ---------------------------------------------------------------------------
// Interaction / widget helpers
// ---------------------------------------------------------------------------

function applyNavigationToggles(view, o) {
  // Navigation.mouseWheelZoomEnabled was removed in ArcGIS SDK 5.0.
  // Use Navigation.actionMap (available since 4.32) for both 4.x and 5.0.
  const am = view.navigation?.actionMap;
  if (!am) return;
  const sw = pick(o, "scrollWheelZoom", "ScrollWheelZoom");
  const dr = pick(o, "dragging", "Dragging");
  am.mouseWheel = sw !== false ? "zoom" : null;
  am.dragPrimary = dr !== false ? "pan" : null;
}

function ensureScaleBar(s, o) {
  const show = !!pick(o, "showScaleControl", "ShowScaleControl");
  if (show && !s.scaleBar) {
    s.scaleBar = new s.esri.ScaleBar({ view: s.view, unit: "dual" });
    s.view.ui.add(s.scaleBar, "bottom-left");
  } else if (!show && s.scaleBar) {
    s.view.ui.remove(s.scaleBar);
    s.scaleBar.destroy();
    s.scaleBar = null;
  }
}

// ---------------------------------------------------------------------------
// Event wiring
// ---------------------------------------------------------------------------

function wireEvents(s) {
  const { view } = s;

  // Hover tooltip tracking
  const hoverEl = document.createElement("div");
  hoverEl.className = "blazor-map-arcgis-tooltip";
  hoverEl.style.cssText =
    "position:absolute;pointer-events:none;background:rgba(0,0,0,.72);color:#fff;" +
    "padding:2px 7px;border-radius:3px;font:12px system-ui;white-space:nowrap;" +
    "z-index:9999;display:none;";
  view.container.style.position = "relative";
  view.container.appendChild(hoverEl);
  s.hoverEl = hoverEl;

  // Drag state
  let hoveredDraggableId = null;
  let dragState = null;

  view.on("pointer-move", (event) => {
    if (dragState) {
      event.stopPropagation();
      const pt = view.toMap({ x: event.x, y: event.y });
      if (pt && dragState.graphic) {
        dragState.graphic.geometry = pt;
        hoverEl.style.display = "none";
      }
      return;
    }
    // { include: [markerLayer] } filters by our GraphicsLayer so every result is a marker.
    view.hitTest(event, { include: [s.markerLayer] }).then((response) => {
      const markerHits = response.results.filter((r) => r.graphic?.attributes?.markerId);
      if (markerHits.length > 0) {
        const g = markerHits[0].graphic;
        hoveredDraggableId = g.attributes.draggable ? g.attributes.markerId : null;
        const tip = g.attributes.tooltipHtml;
        if (tip && !g.attributes.tooltipPermanent) {
          hoverEl.innerHTML = tip;
          hoverEl.style.display = "block";
          hoverEl.style.left = event.x + 10 + "px";
          hoverEl.style.top = event.y - 30 + "px";
          return;
        }
      } else {
        hoveredDraggableId = null;
      }
      hoverEl.style.display = "none";
    });
  });

  view.on("pointer-leave", () => {
    hoverEl.style.display = "none";
    hoveredDraggableId = null;
  });

  // Drag interception
  view.on("drag", (event) => {
    if (event.action === "start" && hoveredDraggableId) {
      event.stopPropagation();
      const entry = s.markers.get(hoveredDraggableId);
      if (entry) dragState = { graphic: entry.graphic, markerId: hoveredDraggableId };
      return;
    }
    if (dragState && (event.action === "update" || event.action === "end")) {
      event.stopPropagation();
      const pt = view.toMap({ x: event.x, y: event.y });
      if (pt && dragState.graphic) dragState.graphic.geometry = pt;
      if (event.action === "end") {
        const g = dragState.graphic.geometry;
        if (g) {
          s.dotNetRef.invokeMethodAsync("ReportMarkerDragEnd", dragState.markerId, {
            lat: g.latitude,
            lng: g.longitude,
          });
        }
        dragState = null;
      }
    }
  });

  // Click
  // Graphic.layer was removed in SDK 5.0 for hitTest results; use attribute-based
  // identification instead — all our graphics carry layerId / bmKind / markerId attributes.
  view.on("click", (event) => {
    hoverEl.style.display = "none";
    view.hitTest(event).then((response) => {
      let hit = false;
      for (const result of response.results) {
        const g = result.graphic;
        if (!g?.attributes) continue;
        const attrs = g.attributes;

        // Our markers always carry a markerId that exists in s.markers
        const markerId = attrs.markerId;
        if (markerId && s.markers.has(markerId)) {
          hit = true;
          s.dotNetRef.invokeMethodAsync("ReportMarkerClick", markerId);
          const html = attrs.popupHtml;
          if (html) {
            view.popup.open({
              content: html,
              title: attrs.title || "",
              location: g.geometry,
            });
          }
          break;
        }

        // GeoJSON features carry bmKind === "geojson" and a layerId in s.geoJsonLayers
        if (attrs.bmKind === "geojson") {
          const geoLayerId = attrs.layerId;
          if (geoLayerId && s.geoJsonLayers.has(geoLayerId)) {
            hit = true;
            const props = { ...attrs };
            delete props.layerId;
            delete props.bmKind;
            s.dotNetRef.invokeMethodAsync("ReportGeoJsonFeatureClick", geoLayerId, props);
            break;
          }
        }

        // Vector graphics carry bmVectorKind and a layerId in s.layers
        if (attrs.bmVectorKind) {
          const vectorLayerId = attrs.layerId;
          if (vectorLayerId && s.layers.has(vectorLayerId)) {
            hit = true;
            const info = s.layers.get(vectorLayerId);
            s.dotNetRef.invokeMethodAsync("ReportVectorClick", vectorLayerId, info.kind, {
              lat: event.mapPoint.latitude,
              lng: event.mapPoint.longitude,
            });
            break;
          }
        }
      }

      if (!hit && event.mapPoint) {
        s.dotNetRef.invokeMethodAsync("ReportMapClick", {
          lat: event.mapPoint.latitude,
          lng: event.mapPoint.longitude,
        });
      }
    });
  });

  // Double-click
  view.on("double-click", (event) => {
    if (!s.options.doubleClickZoom) event.stopPropagation();
    if (event.mapPoint) {
      s.dotNetRef.invokeMethodAsync("ReportMapDoubleClick", {
        lat: event.mapPoint.latitude,
        lng: event.mapPoint.longitude,
      });
    }
  });

  // Key-down
  view.on("key-down", (event) => {
    if (!s.options.keyboardNavigation) event.stopPropagation();
  });

  // View-change debounce
  let viewTimer = null;
  s.esri.reactiveUtils.watch(
    () => [view.center, view.zoom],
    () => { clearTimeout(viewTimer); viewTimer = setTimeout(() => notifyView(s), 80); }
  );
}

// ---------------------------------------------------------------------------
// Public API — initMap
// ---------------------------------------------------------------------------

export async function initMap(mapId, element, dotNetRef, options) {
  const esri = await loadEsriModules();
  const o = options || {};

  const apiKey = pick(o, "apiKey", "ApiKey");
  if (apiKey) esri.esriConfig.apiKey = apiKey;

  const [lng0, lat0] = readCenter(o);
  const zoom = pick(o, "zoom", "Zoom") ?? 4;
  const basemapId = pick(o, "basemapId", "BasemapId") || "osm";

  const scrollWheelEnabled = pick(o, "scrollWheelZoom", "ScrollWheelZoom") !== false;
  const draggingEnabled = pick(o, "dragging", "Dragging") !== false;
  const zoomOn = pick(o, "zoomControl", "ZoomControl") !== false;
  const attributionOn = pick(o, "attributionControl", "AttributionControl") !== false;

  const map = new esri.EsriMap({ basemap: basemapId });

  // Build MapView options carefully.
  // ① Do NOT pass ui.components with strings — ArcGIS 5.0's DefaultUI2D no longer
  //    resolves plain strings to DOM nodes; doing so throws "parameter 1 is not of
  //    type 'Node'".  Instead we call view.ui.remove() after view.when().
  // ② Do NOT pass constraints: undefined — that triggers the setter crash.
  const viewOptions = {
    container: element,
    map,
    center: [lng0, lat0],
    zoom,
    // actionMap is the 5.0-compatible navigation API (available since SDK 4.32).
    // Navigation.mouseWheelZoomEnabled was removed in 5.0.
    navigation: {
      actionMap: {
        mouseWheel: scrollWheelEnabled ? "zoom" : null,
        dragPrimary: draggingEnabled ? "pan" : null,
      },
    },
    popup: {
      dockEnabled: false,
      dockOptions: { buttonEnabled: false },
    },
  };

  // Only add constraints when minZoom / maxZoom are actually provided.
  const minZoom = pick(o, "minZoom", "MinZoom");
  const maxZoom = pick(o, "maxZoom", "MaxZoom");
  if (minZoom != null || maxZoom != null) {
    viewOptions.constraints = {};
    if (minZoom != null) viewOptions.constraints.minZoom = minZoom;
    if (maxZoom != null) viewOptions.constraints.maxZoom = maxZoom;
  }

  const view = new esri.MapView(viewOptions);

  // Marker GraphicsLayer
  const markerLayer = new esri.GraphicsLayer({ listMode: "hide" });
  map.add(markerLayer);

  const state = {
    esri,
    map,
    view,
    dotNetRef,
    options: {
      doubleClickZoom: pick(o, "doubleClickZoom", "DoubleClickZoom") !== false,
      keyboardNavigation: pick(o, "keyboardNavigation", "KeyboardNavigation") !== false,
      scrollWheelZoom: pick(o, "scrollWheelZoom", "ScrollWheelZoom") !== false,
    },
    markerLayer,
    markers: new Map(),
    layers: new Map(),
    geoJsonLayers: new Map(),
    tileOverlays: new Map(),
    scaleBar: null,
    zIndexCounter: 100,
  };

  ensureScaleBar(state, o);
  wireEvents(state);
  maps.set(mapId, state);

  await view.when();

  // After the view is ready the default UI widgets exist in the DOM.
  // Remove ones the caller has disabled by finding them by name and passing the
  // instance (not a string) to view.ui.remove().  Wrapped in try/catch because
  // the widget names can vary across SDK versions.
  if (!zoomOn) {
    try { const w = view.ui.find("zoom"); if (w) view.ui.remove(w); } catch {}
  }
  if (!attributionOn) {
    try { const w = view.ui.find("attribution"); if (w) view.ui.remove(w); } catch {}
  }

  notifyView(state);
  return mapId;
}

// ---------------------------------------------------------------------------
// syncMapOptions
// ---------------------------------------------------------------------------

export async function syncMapOptions(mapId, o) {
  const s = getState(mapId);
  const { view, map, esri } = s;

  const [lng0, lat0] = readCenter(o);
  const zoom = pick(o, "zoom", "Zoom");
  view.goTo({ center: [lng0, lat0], zoom: zoom ?? view.zoom }, { animate: false }).catch(() => {});

  const newBasemap = pick(o, "basemapId", "BasemapId");
  if (newBasemap && newBasemap !== map.basemap?.id) map.basemap = newBasemap;

  applyNavigationToggles(view, o);
  ensureScaleBar(s, o);

  // Update cached interaction flags
  s.options.doubleClickZoom = pick(o, "doubleClickZoom", "DoubleClickZoom") !== false;
  s.options.keyboardNavigation = pick(o, "keyboardNavigation", "KeyboardNavigation") !== false;
  s.options.scrollWheelZoom = pick(o, "scrollWheelZoom", "ScrollWheelZoom") !== false;
}

// ---------------------------------------------------------------------------
// destroyMap
// ---------------------------------------------------------------------------

export function destroyMap(mapId) {
  const s = maps.get(mapId);
  if (!s) return;
  try {
    if (s.scaleBar) { s.scaleBar.destroy(); s.scaleBar = null; }
    // Revoke any GeoJSON Blob URLs
    for (const info of s.geoJsonLayers.values()) {
      if (info.blobUrl) URL.revokeObjectURL(info.blobUrl);
    }
    s.view.destroy();
  } catch {
    /* ignore */
  }
  maps.delete(mapId);
}

// ---------------------------------------------------------------------------
// View controls
// ---------------------------------------------------------------------------

export function invalidateSize(mapId) {
  const s = maps.get(mapId);
  if (!s) return;
  // ArcGIS views auto-resize via ResizeObserver; dispatch a resize event to nudge it.
  globalThis.dispatchEvent(new Event("resize"));
}

export function setView(mapId, lat, lng, zoom, animate) {
  const s = getState(mapId);
  const opts = animate === false ? { animate: false } : {};
  s.view.goTo({ center: [lng, lat], zoom: zoom ?? s.view.zoom }, opts).catch(() => {});
}

export function flyTo(mapId, lat, lng, zoom) {
  const s = getState(mapId);
  s.view
    .goTo({ center: [lng, lat], zoom: zoom ?? s.view.zoom }, { duration: 1200, easing: "in-out-expo" })
    .catch(() => {});
}

export function fitBounds(mapId, swLat, swLng, neLat, neLng, paddingPx) {
  const s = getState(mapId);
  const pad = paddingPx ?? 48;
  // Expand the extent by a percentage to approximate pixel padding.
  const latFrac = ((neLat - swLat) * pad) / 300;
  const lngFrac = ((neLng - swLng) * pad) / 400;
  const ext = new s.esri.Extent({
    xmin: swLng - lngFrac,
    ymin: swLat - latFrac,
    xmax: neLng + lngFrac,
    ymax: neLat + latFrac,
    spatialReference: { wkid: 4326 },
  });
  s.view.goTo(ext).catch(() => {});
}

export function fitBoundsToMarkers(mapId, paddingPx) {
  const s = maps.get(mapId);
  if (!s) return;
  const geometries = s.markerLayer.graphics.toArray()
    .map((g) => g.geometry)
    .filter(Boolean);
  if (geometries.length === 0) return;
  s.view.goTo(geometries, { padding: { top: paddingPx ?? 48, right: paddingPx ?? 48, bottom: paddingPx ?? 48, left: paddingPx ?? 48 } }).catch(() => {});
}

export function getView(mapId) {
  const s = getState(mapId);
  const { view, esri } = s;
  const center = view.center;
  const geoExt = extentToGeographic(esri, view);
  return {
    center: { lat: center?.latitude ?? 0, lng: center?.longitude ?? 0 },
    zoom: view.zoom ?? 0,
    bounds: geoExt
      ? { southWest: { lat: geoExt.ymin, lng: geoExt.xmin }, northEast: { lat: geoExt.ymax, lng: geoExt.xmax } }
      : { southWest: { lat: 0, lng: 0 }, northEast: { lat: 0, lng: 0 } },
  };
}

// ---------------------------------------------------------------------------
// Markers
// ---------------------------------------------------------------------------

export function addMarker(mapId, markerId, opts) {
  const s = getState(mapId);
  const { esri } = s;
  const lat = pick(opts, "lat", "Lat") ?? pick(opts, "latitude", "Latitude") ?? 0;
  const lng = pick(opts, "lng", "Lng") ?? pick(opts, "longitude", "Longitude") ?? 0;
  const graphic = new esri.Graphic({
    geometry: new esri.Point({ longitude: lng, latitude: lat }),
    symbol: markerSymbolFromOpts(esri, opts),
    attributes: {
      markerId,
      popupHtml: pick(opts, "popupHtml", "PopupHtml") || "",
      title: pick(opts, "title", "Title") || "",
      draggable: !!pick(opts, "draggable", "Draggable"),
      tooltipHtml: pick(opts, "tooltipHtml", "TooltipHtml") || "",
      tooltipPermanent: !!pick(opts, "tooltipPermanent", "TooltipPermanent"),
      tooltipDirection: pick(opts, "tooltipDirection", "TooltipDirection") || "auto",
    },
  });
  s.markerLayer.add(graphic);
  const entry = { graphic };
  s.markers.set(markerId, entry);

  // Permanent tooltip: show as a pinned label overlay
  const tipHtml = graphic.attributes.tooltipHtml;
  const isPerm = graphic.attributes.tooltipPermanent;
  if (tipHtml && isPerm) {
    const el = document.createElement("div");
    el.className = "blazor-map-arcgis-tooltip-perm";
    el.innerHTML = tipHtml;
    el.style.cssText =
      "position:absolute;pointer-events:none;background:rgba(0,0,0,.72);color:#fff;" +
      "padding:2px 7px;border-radius:3px;font:12px system-ui;white-space:nowrap;z-index:9999;";
    s.view.container.appendChild(el);
    // Position the label over the graphic on every view change
    const positionEl = () => {
      const sp = s.view.toScreen(graphic.geometry);
      if (sp) {
        el.style.left = sp.x - el.offsetWidth / 2 + "px";
        el.style.top = sp.y - 32 + "px";
      }
    };
    const handle = s.esri.reactiveUtils.watch(() => s.view.extent, positionEl);
    entry.tooltipEl = el;
    entry.tooltipHandle = handle;
    // Initial position after first render
    setTimeout(positionEl, 100);
  }
}

export function removeMarker(mapId, markerId) {
  const s = maps.get(mapId);
  if (!s) return;
  const entry = s.markers.get(markerId);
  if (!entry) return;
  s.markerLayer.remove(entry.graphic);
  if (entry.tooltipEl) entry.tooltipEl.remove();
  if (entry.tooltipHandle) entry.tooltipHandle.remove();
  s.markers.delete(markerId);
}

export function clearMarkers(mapId) {
  const s = maps.get(mapId);
  if (!s) return;
  for (const entry of s.markers.values()) {
    if (entry.tooltipEl) entry.tooltipEl.remove();
    if (entry.tooltipHandle) entry.tooltipHandle.remove();
  }
  s.markers.clear();
  s.markerLayer.removeAll();
}

export function setMarkerLatLng(mapId, markerId, lat, lng) {
  const s = maps.get(mapId);
  if (!s) return;
  const entry = s.markers.get(markerId);
  if (!entry) return;
  entry.graphic.geometry = new s.esri.Point({ longitude: lng, latitude: lat });
}

export function openMarkerPopup(mapId, markerId) {
  const s = maps.get(mapId);
  if (!s) return;
  const entry = s.markers.get(markerId);
  if (!entry) return;
  const html = entry.graphic.attributes?.popupHtml;
  if (!html) return;
  s.view.popup.open({
    content: html,
    title: entry.graphic.attributes?.title || "",
    location: entry.graphic.geometry,
  });
}

// ---------------------------------------------------------------------------
// Vector layers
// ---------------------------------------------------------------------------

function addGraphicsLayer(s, layerId, graphics, kind) {
  const gl = new s.esri.GraphicsLayer({ listMode: "hide" });
  graphics.forEach((g) => gl.add(g));
  s.map.add(gl);
  s.layers.set(layerId, { graphicsLayer: gl, kind });
}

export function addPolyline(mapId, layerId, latlngs, style) {
  const s = getState(mapId);
  const paths = [latlngs.map((p) => [pick(p, "lng", "Longitude"), pick(p, "lat", "Latitude")])];
  const graphic = new s.esri.Graphic({
    geometry: new s.esri.Polyline({ paths, spatialReference: { wkid: 4326 } }),
    symbol: makeLineSymbol(s.esri, style),
    attributes: { layerId, bmVectorKind: "polyline" },
  });
  addGraphicsLayer(s, layerId, [graphic], "polyline");
}

export function addPolygon(mapId, layerId, latlngs, style) {
  const s = getState(mapId);
  const rings = [latlngs.map((p) => [pick(p, "lng", "Longitude"), pick(p, "lat", "Latitude")])];
  const graphic = new s.esri.Graphic({
    geometry: new s.esri.Polygon({ rings, spatialReference: { wkid: 4326 } }),
    symbol: makeFillSymbol(s.esri, style),
    attributes: { layerId, bmVectorKind: "polygon" },
  });
  addGraphicsLayer(s, layerId, [graphic], "polygon");
}

export function addCircle(mapId, layerId, lat, lng, radiusMeters, style) {
  const s = getState(mapId);
  const rings = [circleRing(lat, lng, radiusMeters)];
  const graphic = new s.esri.Graphic({
    geometry: new s.esri.Polygon({ rings, spatialReference: { wkid: 4326 } }),
    symbol: makeFillSymbol(s.esri, style),
    attributes: { layerId, bmVectorKind: "circle" },
  });
  addGraphicsLayer(s, layerId, [graphic], "circle");
}

export function addRectangle(mapId, layerId, swLat, swLng, neLat, neLng, style) {
  const s = getState(mapId);
  const rings = [[
    [swLng, swLat], [neLng, swLat], [neLng, neLat], [swLng, neLat], [swLng, swLat],
  ]];
  const graphic = new s.esri.Graphic({
    geometry: new s.esri.Polygon({ rings, spatialReference: { wkid: 4326 } }),
    symbol: makeFillSymbol(s.esri, style),
    attributes: { layerId, bmVectorKind: "rectangle" },
  });
  addGraphicsLayer(s, layerId, [graphic], "rectangle");
}

export function addGeoJson(mapId, layerId, geoJsonString, style) {
  const s = getState(mapId);
  const graphics = geoJsonToGraphics(s.esri, geoJsonString, style, layerId);
  const gl = new s.esri.GraphicsLayer({ listMode: "hide" });
  graphics.forEach((g) => gl.add(g));
  s.map.add(gl);
  s.geoJsonLayers.set(layerId, { graphicsLayer: gl });
}

export function removeLayer(mapId, layerId) {
  const s = maps.get(mapId);
  if (!s) return;
  const info = s.layers.get(layerId) ?? s.geoJsonLayers.get(layerId);
  if (info) {
    s.map.remove(info.graphicsLayer);
    s.layers.delete(layerId);
    s.geoJsonLayers.delete(layerId);
  }
}

export function clearVectorLayers(mapId) {
  const s = maps.get(mapId);
  if (!s) return;
  for (const info of s.layers.values()) s.map.remove(info.graphicsLayer);
  for (const info of s.geoJsonLayers.values()) s.map.remove(info.graphicsLayer);
  s.layers.clear();
  s.geoJsonLayers.clear();
}

// ---------------------------------------------------------------------------
// Tile overlays  (WebTileLayer, XYZ-compatible)
// ---------------------------------------------------------------------------

function normalizeArcGisTileUrl(url) {
  // ArcGIS WebTileLayer uses {level}/{col}/{row}; our API uses {z}/{x}/{y}
  return (url || "")
    .replaceAll("{z}", "{level}")
    .replaceAll("{x}", "{col}")
    .replaceAll("{y}", "{row}")
    .replaceAll("{s}", "a");
}

export function addTileOverlay(mapId, opts) {
  const s = getState(mapId);
  const id = pick(opts, "id", "Id");
  const url = normalizeArcGisTileUrl(pick(opts, "urlTemplate", "UrlTemplate") || "");
  const layer = new s.esri.WebTileLayer({
    urlTemplate: url,
    copyright: pick(opts, "attribution", "Attribution") || "",
    opacity: pick(opts, "opacity", "Opacity") ?? 1,
  });
  s.map.layers.add(layer);
  s.tileOverlays.set(id, layer);
}

export function removeTileOverlay(mapId, overlayId) {
  const s = maps.get(mapId);
  if (!s) return;
  const layer = s.tileOverlays.get(overlayId);
  if (layer) {
    s.map.layers.remove(layer);
    s.tileOverlays.delete(overlayId);
  }
}
