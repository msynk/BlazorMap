/**
 * BlazorMapLibreMap — MapLibre GL JS bridge. Loads maplibre-gl from CDN on first init.
 * Center is latitude/longitude in options; MapLibre uses [lng, lat] internally.
 */
import { loadScript, loadStylesheet, resetScript } from "./mapDependencyLoader.js";

const maps = new Map();

let maplibreLoadPromise = null;

const MAPLIBRE_VER = "4.7.1";
const MAPLIBRE_JS  = `https://unpkg.com/maplibre-gl@${MAPLIBRE_VER}/dist/maplibre-gl.js`;
const MAPLIBRE_CSS = `https://unpkg.com/maplibre-gl@${MAPLIBRE_VER}/dist/maplibre-gl.css`;

async function ensureMapLibre() {
  if (globalThis.maplibregl) return;
  if (!maplibreLoadPromise) {
    maplibreLoadPromise = (async () => {
      await loadStylesheet(MAPLIBRE_CSS).catch(() => {});
      await loadScript(MAPLIBRE_JS);
    })();
  }
  try {
    await maplibreLoadPromise;
  } catch (err) {
    maplibreLoadPromise = null;
    resetScript(MAPLIBRE_JS);
    throw err;
  }
  if (!globalThis.maplibregl) {
    maplibreLoadPromise = null;
    resetScript(MAPLIBRE_JS);
    throw new Error("MapLibre GL JS failed to load from CDN.");
  }
}

function pick(o, camel, pascal) {
  const v = o?.[camel];
  return v !== undefined && v !== null ? v : o?.[pascal];
}

function readCenterLngLat(o) {
  const c = pick(o, "center", "Center");
  if (!c) return [-0.09, 51.505];
  const lat = pick(c, "lat", "Latitude");
  const lng = pick(c, "lng", "Longitude");
  return [lng, lat];
}

function readBoundsLngLatBounds(mb) {
  if (!mb) return null;
  const sw = pick(mb, "southWest", "SouthWest");
  const ne = pick(mb, "northEast", "NorthEast");
  if (!sw || !ne) return null;
  const swLng = pick(sw, "lng", "Longitude");
  const swLat = pick(sw, "lat", "Latitude");
  const neLng = pick(ne, "lng", "Longitude");
  const neLat = pick(ne, "lat", "Latitude");
  return [
    [swLng, swLat],
    [neLng, neLat],
  ];
}

function toLngLatLine(coords) {
  return coords.map((p) => [pick(p, "lng", "Longitude"), pick(p, "lat", "Latitude")]);
}

function pathStylePaint(style, isLine) {
  if (!style) {
    return isLine
      ? { "line-color": "#3388ff", "line-width": 3, "line-opacity": 1 }
      : {
          "fill-color": "#3388ff",
          "fill-opacity": 0.2,
          "fill-outline-color": "#3388ff",
        };
  }
  const color = pick(style, "color", "Color") ?? "#3388ff";
  const opacity = pick(style, "opacity", "Opacity") ?? 1;
  const weight = pick(style, "weight", "Weight") ?? 3;
  const fillColor = pick(style, "fillColor", "FillColor") ?? color;
  const fillOpacity = pick(style, "fillOpacity", "FillOpacity") ?? 0.2;
  if (isLine) {
    const dash = pick(style, "dashArray", "DashArray");
    const paint = {
      "line-color": color,
      "line-width": weight,
      "line-opacity": opacity,
    };
    if (dash) paint["line-dasharray"] = dash.split(",").map((x) => parseFloat(x.trim(), 10));
    return paint;
  }
  return {
    "fill-color": fillColor,
    "fill-opacity": fillOpacity,
    "fill-outline-color": color,
  };
}

function escapeTemplateForTiles(url) {
  return (url || "").replace("{s}", "a");
}

function getState(mapId) {
  const s = maps.get(mapId);
  if (!s) throw new Error(`BlazorMapLibreMap: unknown map id '${mapId}'`);
  return s;
}

function removeVectorInternal(map, catalog, layerId) {
  const entry = catalog.get(layerId);
  if (!entry) return;
  for (const lid of entry.layerIds) {
    try {
      if (map.getLayer(lid)) map.removeLayer(lid);
    } catch {
      /* ignore */
    }
  }
  try {
    if (map.getSource(entry.sourceId)) map.removeSource(entry.sourceId);
  } catch {
    /* ignore */
  }
  catalog.delete(layerId);
}

function notifyView(map, dotNetRef) {
  queueMicrotask(() => {
    const c = map.getCenter();
    const b = map.getBounds();
    dotNetRef.invokeMethodAsync("ReportViewChanged", {
      center: { lat: c.lat, lng: c.lng },
      zoom: map.getZoom(),
      bounds: {
        southWest: { lat: b.getSouthWest().lat, lng: b.getSouthWest().lng },
        northEast: { lat: b.getNorthEast().lat, lng: b.getNorthEast().lng },
      },
    });
  });
}

function applyInteractivity(map, o) {
  const sw = pick(o, "scrollWheelZoom", "ScrollWheelZoom");
  if (sw === false) map.scrollZoom.disable();
  else map.scrollZoom.enable();

  const dz = pick(o, "doubleClickZoom", "DoubleClickZoom");
  if (dz === false) map.doubleClickZoom.disable();
  else map.doubleClickZoom.enable();

  const bz = pick(o, "boxZoom", "BoxZoom");
  if (bz === false) map.boxZoom.disable();
  else map.boxZoom.enable();

  const dp = pick(o, "dragPan", "DragPan");
  if (dp === false) map.dragPan.disable();
  else map.dragPan.enable();

  const dr = pick(o, "dragRotate", "DragRotate");
  if (dr === false) {
    map.dragRotate.disable();
    if (map.touchZoomRotate) map.touchZoomRotate.disableRotation();
  } else {
    map.dragRotate.enable();
    if (map.touchZoomRotate) map.touchZoomRotate.enableRotation();
  }

  const kb = pick(o, "keyboard", "Keyboard") ?? pick(o, "keyboardNavigation", "KeyboardNavigation");
  if (map.keyboard && typeof map.keyboard.disable === "function") {
    if (kb === false) map.keyboard.disable();
    else map.keyboard.enable();
  }
}

function ensureNavigationControl(s, o) {
  const m = globalThis.maplibregl;
  const show = pick(o, "showNavigationControl", "ShowNavigationControl") !== false;
  if (show && !s.navControl) {
    s.navControl = new m.NavigationControl();
    s.map.addControl(s.navControl, "top-right");
  } else if (!show && s.navControl) {
    s.map.removeControl(s.navControl);
    s.navControl = null;
  } else if (show && s.navControl) {
    s.map.removeControl(s.navControl);
    s.navControl = new m.NavigationControl();
    s.map.addControl(s.navControl, "top-right");
  }
}

function circleRingLngLat(lat, lng, radiusMeters, points = 64) {
  const R = 6371000;
  const ring = [];
  const lat1 = (lat * Math.PI) / 180;
  const lng1 = (lng * Math.PI) / 180;
  const angular = radiusMeters / R;
  for (let i = 0; i <= points; i++) {
    const bearing = (i / points) * 2 * Math.PI;
    const lat2 = Math.asin(
      Math.sin(lat1) * Math.cos(angular) + Math.cos(lat1) * Math.sin(angular) * Math.cos(bearing)
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

export async function initMap(mapId, element, dotNetRef, options) {
  await ensureMapLibre();
  const maplibregl = globalThis.maplibregl;
  const o = options || {};

  const center = readCenterLngLat(o);
  const zoom = pick(o, "zoom", "Zoom") ?? 13;
  const styleUrl =
    pick(o, "styleUrl", "StyleUrl") || "https://demotiles.maplibre.org/style.json";

  const map = new maplibregl.Map({
    container: element,
    style: styleUrl,
    center,
    zoom,
    minZoom: pick(o, "minZoom", "MinZoom") ?? undefined,
    maxZoom: pick(o, "maxZoom", "MaxZoom") ?? undefined,
    attributionControl: pick(o, "attributionControl", "AttributionControl") !== false,
  });

  await new Promise((resolve, reject) => {
    map.once("load", resolve);
    map.once("error", (e) => reject(e.error || new Error("MapLibre map error")));
    setTimeout(() => reject(new Error("MapLibre map load timeout (30s)")), 30000);
  });

  const mb = readBoundsLngLatBounds(pick(o, "maxBounds", "MaxBounds"));
  if (mb) map.setMaxBounds(mb);

  applyInteractivity(map, o);

  const s = {
    map,
    dotNetRef,
    markers: new Map(),
    vectorCatalog: new Map(),
    tileOverlayCatalog: new Map(),
    navControl: null,
    lastStyleUrl: styleUrl,
  };
  ensureNavigationControl(s, o);

  map.on("click", (e) => {
    dotNetRef.invokeMethodAsync("ReportMapClick", { lat: e.lngLat.lat, lng: e.lngLat.lng });
  });

  map.on("dblclick", (e) => {
    dotNetRef.invokeMethodAsync("ReportMapDoubleClick", { lat: e.lngLat.lat, lng: e.lngLat.lng });
  });

  map.on("moveend", () => notifyView(map, dotNetRef));
  map.on("zoomend", () => notifyView(map, dotNetRef));

  maps.set(mapId, s);
  queueMicrotask(() => {
    map.resize();
    notifyView(map, dotNetRef);
  });
  return mapId;
}

export function syncMapOptions(mapId, o) {
  const s = getState(mapId);
  const map = s.map;
  const center = readCenterLngLat(o);
  const zoom = pick(o, "zoom", "Zoom");
  map.jumpTo({ center, zoom: zoom ?? map.getZoom(), essential: true });

  const styleUrl = pick(o, "styleUrl", "StyleUrl");
  if (styleUrl && styleUrl !== s.lastStyleUrl) {
    s.lastStyleUrl = styleUrl;
    map.setStyle(styleUrl);
    map.once("styledata", () => {
      /* style replaced; vector layers cleared */
      s.vectorCatalog.clear();
      s.tileOverlayCatalog.clear();
    });
  }

  const mb = readBoundsLngLatBounds(pick(o, "maxBounds", "MaxBounds"));
  if (mb) map.setMaxBounds(mb);
  else map.setMaxBounds(null);

  applyInteractivity(map, o);
  ensureNavigationControl(s, o);
}

export function destroyMap(mapId) {
  const s = maps.get(mapId);
  if (!s) return;
  try {
    for (const m of s.markers.values()) {
      try {
        m.marker.remove();
      } catch {
        /* ignore */
      }
    }
    s.markers.clear();
    if (s.navControl) {
      try {
        s.map.removeControl(s.navControl);
      } catch {
        /* ignore */
      }
    }
    s.map.remove();
  } catch {
    /* ignore */
  }
  maps.delete(mapId);
}

export function invalidateSize(mapId) {
  const s = maps.get(mapId);
  if (!s) return;
  try {
    s.map.resize();
  } catch {
    /* ignore */
  }
}

export function setView(mapId, lat, lng, zoom, animate) {
  const s = getState(mapId);
  const z = zoom ?? s.map.getZoom();
  s.map.jumpTo({
    center: [lng, lat],
    zoom: z,
    essential: animate === false,
  });
}

export function flyTo(mapId, lat, lng, zoom) {
  const s = getState(mapId);
  s.map.flyTo({
    center: [lng, lat],
    zoom: zoom ?? s.map.getZoom(),
    essential: true,
  });
}

export function fitBounds(mapId, swLat, swLng, neLat, neLng, paddingPx) {
  const s = getState(mapId);
  const pad = paddingPx ?? 48;
  s.map.fitBounds(
    [
      [swLng, swLat],
      [neLng, neLat],
    ],
    { padding: pad, maxZoom: 18 }
  );
}

export function fitBoundsToMarkers(mapId, paddingPx) {
  const s = getState(mapId);
  if (s.markers.size === 0) return;
  const maplibregl = globalThis.maplibregl;
  const b = new maplibregl.LngLatBounds();
  for (const { marker } of s.markers.values()) {
    b.extend(marker.getLngLat());
  }
  s.map.fitBounds(b, { padding: paddingPx ?? 48, maxZoom: 18 });
}

export function getView(mapId) {
  const s = getState(mapId);
  const c = s.map.getCenter();
  const b = s.map.getBounds();
  return {
    center: { lat: c.lat, lng: c.lng },
    zoom: s.map.getZoom(),
    bounds: {
      southWest: { lat: b.getSouthWest().lat, lng: b.getSouthWest().lng },
      northEast: { lat: b.getNorthEast().lat, lng: b.getNorthEast().lng },
    },
  };
}

export function addMarker(mapId, markerId, opts) {
  const s = getState(mapId);
  const maplibregl = globalThis.maplibregl;
  const lat = pick(opts, "lat", "Lat") ?? pick(opts, "latitude", "Latitude");
  const lng = pick(opts, "lng", "Lng") ?? pick(opts, "longitude", "Longitude");
  const draggable = !!pick(opts, "draggable", "Draggable");

  let marker;
  const iconUrl = pick(opts, "iconUrl", "IconUrl");
  if (iconUrl) {
    const el = document.createElement("div");
    el.style.width = `${pick(opts, "iconWidth", "IconWidth") || 32}px`;
    el.style.height = `${pick(opts, "iconHeight", "IconHeight") || 32}px`;
    el.style.backgroundImage = `url(${iconUrl})`;
    el.style.backgroundSize = "contain";
    el.style.cursor = "pointer";
    marker = new maplibregl.Marker({ element: el, draggable }).setLngLat([lng, lat]).addTo(s.map);
  } else {
    marker = new maplibregl.Marker({ draggable }).setLngLat([lng, lat]).addTo(s.map);
  }

  const popupHtml = pick(opts, "popupHtml", "PopupHtml");
  if (popupHtml) {
    marker.setPopup(new maplibregl.Popup({ offset: 25 }).setHTML(String(popupHtml)));
  }

  const title = pick(opts, "title", "Title");
  if (title && marker.getElement()) marker.getElement().setAttribute("title", title);

  marker.getElement()?.addEventListener("click", (ev) => {
    ev.stopPropagation();
    s.dotNetRef.invokeMethodAsync("ReportMarkerClick", markerId);
  });

  if (draggable) {
    marker.on("dragend", () => {
      const p = marker.getLngLat();
      s.dotNetRef.invokeMethodAsync("ReportMarkerDragEnd", markerId, { lat: p.lat, lng: p.lng });
    });
  }

  s.markers.set(markerId, { marker });
}

export function removeMarker(mapId, markerId) {
  const s = maps.get(mapId);
  if (!s) return;
  const row = s.markers.get(markerId);
  if (row) {
    row.marker.remove();
    s.markers.delete(markerId);
  }
}

export function clearMarkers(mapId) {
  const s = maps.get(mapId);
  if (!s) return;
  for (const { marker } of s.markers.values()) {
    marker.remove();
  }
  s.markers.clear();
}

export function setMarkerLatLng(mapId, markerId, lat, lng) {
  const s = maps.get(mapId);
  if (!s) return;
  const row = s.markers.get(markerId);
  if (row) row.marker.setLngLat([lng, lat]);
}

export function openMarkerPopup(mapId, markerId) {
  const s = maps.get(mapId);
  if (!s) return;
  const row = s.markers.get(markerId);
  if (!row) return;
  const popup = row.marker.getPopup();
  if (!popup) return;
  if (typeof popup.isOpen === "function") {
    if (!popup.isOpen()) row.marker.togglePopup();
  } else {
    row.marker.togglePopup();
  }
}

export function addPolyline(mapId, layerId, latlngs, style) {
  const s = getState(mapId);
  const map = s.map;
  removeVectorInternal(map, s.vectorCatalog, layerId);
  const sourceId = `bm-src-${mapId}-${layerId}`;
  const lineId = `bm-line-${mapId}-${layerId}`;
  const geo = {
    type: "Feature",
    properties: {},
    geometry: {
      type: "LineString",
      coordinates: toLngLatLine(latlngs),
    },
  };
  map.addSource(sourceId, { type: "geojson", data: geo });
  map.addLayer({
    id: lineId,
    type: "line",
    source: sourceId,
    layout: { "line-join": "round", "line-cap": "round" },
    paint: pathStylePaint(style, true),
  });
  map.on("click", lineId, (e) => {
    s.dotNetRef.invokeMethodAsync("ReportVectorClick", layerId, "polyline", {
      lat: e.lngLat.lat,
      lng: e.lngLat.lng,
    });
  });
  s.vectorCatalog.set(layerId, { sourceId, layerIds: [lineId] });
}

export function addPolygon(mapId, layerId, latlngs, style) {
  const s = getState(mapId);
  const map = s.map;
  removeVectorInternal(map, s.vectorCatalog, layerId);
  const sourceId = `bm-src-${mapId}-${layerId}`;
  const fillId = `bm-fill-${mapId}-${layerId}`;
  const lineId = `bm-line-${mapId}-${layerId}`;
  const ring = toLngLatLine(latlngs);
  if (ring.length > 0) {
    const a = ring[0];
    const b = ring[ring.length - 1];
    if (a[0] !== b[0] || a[1] !== b[1]) ring.push([...a]);
  }
  const geo = {
    type: "Feature",
    properties: {},
    geometry: { type: "Polygon", coordinates: [ring] },
  };
  map.addSource(sourceId, { type: "geojson", data: geo });
  map.addLayer({
    id: fillId,
    type: "fill",
    source: sourceId,
    paint: pathStylePaint(style, false),
  });
  map.addLayer({
    id: lineId,
    type: "line",
    source: sourceId,
    layout: { "line-join": "round", "line-cap": "round" },
    paint: pathStylePaint(style, true),
  });
  const onClick = (e) => {
    s.dotNetRef.invokeMethodAsync("ReportVectorClick", layerId, "polygon", {
      lat: e.lngLat.lat,
      lng: e.lngLat.lng,
    });
  };
  map.on("click", fillId, onClick);
  map.on("click", lineId, onClick);
  s.vectorCatalog.set(layerId, { sourceId, layerIds: [fillId, lineId] });
}

export function addCircle(mapId, layerId, lat, lng, radiusMeters, style) {
  const s = getState(mapId);
  const map = s.map;
  removeVectorInternal(map, s.vectorCatalog, layerId);
  const sourceId = `bm-src-${mapId}-${layerId}`;
  const fillId = `bm-fill-${mapId}-${layerId}`;
  const lineId = `bm-line-${mapId}-${layerId}`;
  const ring = circleRingLngLat(lat, lng, radiusMeters);
  const geo = {
    type: "Feature",
    properties: {},
    geometry: { type: "Polygon", coordinates: [ring] },
  };
  map.addSource(sourceId, { type: "geojson", data: geo });
  map.addLayer({
    id: fillId,
    type: "fill",
    source: sourceId,
    paint: pathStylePaint(style, false),
  });
  map.addLayer({
    id: lineId,
    type: "line",
    source: sourceId,
    paint: pathStylePaint(style, true),
  });
  const onClick = (e) => {
    s.dotNetRef.invokeMethodAsync("ReportVectorClick", layerId, "circle", {
      lat: e.lngLat.lat,
      lng: e.lngLat.lng,
    });
  };
  map.on("click", fillId, onClick);
  map.on("click", lineId, onClick);
  s.vectorCatalog.set(layerId, { sourceId, layerIds: [fillId, lineId] });
}

export function addRectangle(mapId, layerId, swLat, swLng, neLat, neLng, style) {
  const ring = [
    [swLng, swLat],
    [neLng, swLat],
    [neLng, neLat],
    [swLng, neLat],
    [swLng, swLat],
  ];
  const s = getState(mapId);
  const map = s.map;
  removeVectorInternal(map, s.vectorCatalog, layerId);
  const sourceId = `bm-src-${mapId}-${layerId}`;
  const fillId = `bm-fill-${mapId}-${layerId}`;
  const lineId = `bm-line-${mapId}-${layerId}`;
  const geo = {
    type: "Feature",
    properties: {},
    geometry: { type: "Polygon", coordinates: [ring] },
  };
  map.addSource(sourceId, { type: "geojson", data: geo });
  map.addLayer({
    id: fillId,
    type: "fill",
    source: sourceId,
    paint: pathStylePaint(style, false),
  });
  map.addLayer({
    id: lineId,
    type: "line",
    source: sourceId,
    paint: pathStylePaint(style, true),
  });
  const onClick = (e) => {
    s.dotNetRef.invokeMethodAsync("ReportVectorClick", layerId, "rectangle", {
      lat: e.lngLat.lat,
      lng: e.lngLat.lng,
    });
  };
  map.on("click", fillId, onClick);
  map.on("click", lineId, onClick);
  s.vectorCatalog.set(layerId, { sourceId, layerIds: [fillId, lineId] });
}

export function addGeoJson(mapId, layerId, geoJsonString, style) {
  const s = getState(mapId);
  const map = s.map;
  let gj;
  try {
    gj = JSON.parse(geoJsonString);
  } catch {
    throw new Error("Invalid GeoJSON string");
  }
  removeVectorInternal(map, s.vectorCatalog, layerId);
  const sourceId = `bm-src-${mapId}-${layerId}`;
  const fillId = `bm-fill-${mapId}-${layerId}`;
  const lineId = `bm-line-${mapId}-${layerId}`;
  map.addSource(sourceId, { type: "geojson", data: gj });
  map.addLayer({
    id: fillId,
    type: "fill",
    source: sourceId,
    paint: pathStylePaint(style, false),
  });
  map.addLayer({
    id: lineId,
    type: "line",
    source: sourceId,
    paint: pathStylePaint(style, true),
  });
  map.on("click", fillId, (e) => {
    if (e.features?.[0]) {
      s.dotNetRef.invokeMethodAsync("ReportGeoJsonFeatureClick", layerId, e.features[0].properties || {});
    }
  });
  map.on("click", lineId, (e) => {
    if (e.features?.[0]) {
      s.dotNetRef.invokeMethodAsync("ReportGeoJsonFeatureClick", layerId, e.features[0].properties || {});
    }
  });
  s.vectorCatalog.set(layerId, { sourceId, layerIds: [fillId, lineId] });
}

export function removeLayer(mapId, layerId) {
  const s = maps.get(mapId);
  if (!s) return;
  removeVectorInternal(s.map, s.vectorCatalog, layerId);
}

export function clearVectorLayers(mapId) {
  const s = maps.get(mapId);
  if (!s) return;
  for (const id of [...s.vectorCatalog.keys()]) {
    removeVectorInternal(s.map, s.vectorCatalog, id);
  }
}

export function addTileOverlay(mapId, opts) {
  const s = getState(mapId);
  const map = s.map;
  const id = pick(opts, "id", "Id");
  const url = escapeTemplateForTiles(pick(opts, "urlTemplate", "UrlTemplate"));
  const sourceId = `bm-raster-${mapId}-${id}`;
  const layerId = `bm-raster-layer-${mapId}-${id}`;
  if (map.getSource(sourceId)) return;
  map.addSource(sourceId, {
    type: "raster",
    tiles: [url],
    tileSize: 256,
    attribution: pick(opts, "attribution", "Attribution") || "",
    maxzoom: pick(opts, "maxZoom", "MaxZoom") ?? 19,
  });
  map.addLayer({
    id: layerId,
    type: "raster",
    source: sourceId,
    paint: { "raster-opacity": pick(opts, "opacity", "Opacity") ?? 1 },
  });
  try {
    map.setPaintProperty(layerId, "raster-opacity", pick(opts, "opacity", "Opacity") ?? 1);
  } catch {
    /* ignore */
  }
  s.tileOverlayCatalog.set(id, { sourceId, layerId });
}

export function removeTileOverlay(mapId, overlayId) {
  const s = maps.get(mapId);
  if (!s) return;
  const row = s.tileOverlayCatalog.get(overlayId);
  if (!row) return;
  try {
    if (s.map.getLayer(row.layerId)) s.map.removeLayer(row.layerId);
    if (s.map.getSource(row.sourceId)) s.map.removeSource(row.sourceId);
  } catch {
    /* ignore */
  }
  s.tileOverlayCatalog.delete(overlayId);
}
