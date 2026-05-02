/**
 * BlazorMap — Leaflet bridge. Requires window.L (Leaflet) loaded before first init.
 */
const maps = new Map();

/** Leaflet's default marker images break when the script is on a CDN and the app is on another origin. */
let leafletDefaultIconPatched = false;

function ensureLeafletDefaultIcon(L) {
  if (leafletDefaultIconPatched) return;
  leafletDefaultIconPatched = true;
  const ver = "1.9.4";
  const base = `https://unpkg.com/leaflet@${ver}/dist/images/`;
  try {
    delete L.Icon.Default.prototype._getIconUrl;
    L.Icon.Default.mergeOptions({
      iconRetinaUrl: `${base}marker-icon-2x.png`,
      iconUrl: `${base}marker-icon.png`,
      shadowUrl: `${base}marker-shadow.png`,
    });
  } catch {
    /* ignore */
  }
}

function getL() {
  const L = globalThis.L;
  if (!L) {
    throw new Error(
      "Leaflet is not loaded. Add leaflet.css and leaflet.js to your host page before Blazor starts."
    );
  }
  return L;
}

function getState(mapId) {
  const s = maps.get(mapId);
  if (!s) {
    throw new Error(`BlazorMap: unknown map id '${mapId}'`);
  }
  return s;
}

function pick(o, camel, pascal) {
  const v = o?.[camel];
  return v !== undefined && v !== null ? v : o?.[pascal];
}

function readCenter(o) {
  const c = pick(o, "center", "Center");
  if (!c) return null;
  return [pick(c, "lat", "Latitude"), pick(c, "lng", "Longitude")];
}

function readBoundsPair(sw, ne) {
  if (!sw || !ne) return null;
  const L = getL();
  return L.latLngBounds(
    L.latLng(pick(sw, "lat", "Latitude"), pick(sw, "lng", "Longitude")),
    L.latLng(pick(ne, "lat", "Latitude"), pick(ne, "lng", "Longitude"))
  );
}

function toLatLngs(arr) {
  return arr.map((p) => [pick(p, "lat", "Latitude"), pick(p, "lng", "Longitude")]);
}

function pathStyle(style) {
  if (!style) return {};
  return {
    color: pick(style, "color", "Color") ?? "#3388ff",
    weight: pick(style, "weight", "Weight") ?? 3,
    opacity: pick(style, "opacity", "Opacity") ?? 1,
    fillColor: pick(style, "fillColor", "FillColor") ?? pick(style, "color", "Color") ?? "#3388ff",
    fillOpacity: pick(style, "fillOpacity", "FillOpacity") ?? 0.2,
    dashArray: pick(style, "dashArray", "DashArray") ?? undefined,
  };
}

function applyMaxBounds(map, o) {
  const L = getL();
  const mb = pick(o, "maxBounds", "MaxBounds");
  if (!mb) {
    try {
      map.setMaxBounds(null);
    } catch {
      try {
        map.setMaxBounds(L.latLngBounds(L.latLng(-85, -180), L.latLng(85, 180)));
      } catch {
        /* ignore */
      }
    }
    return;
  }
  const sw = pick(mb, "southWest", "SouthWest");
  const ne = pick(mb, "northEast", "NorthEast");
  const b = readBoundsPair(sw, ne);
  if (b) map.setMaxBounds(b);
}

function applyInteraction(map, o) {
  const sw = pick(o, "scrollWheelZoom", "ScrollWheelZoom");
  if (sw === false) map.scrollWheelZoom.disable();
  else map.scrollWheelZoom.enable();

  const dz = pick(o, "doubleClickZoom", "DoubleClickZoom");
  if (dz === false) map.doubleClickZoom.disable();
  else map.doubleClickZoom.enable();

  const bz = pick(o, "boxZoom", "BoxZoom");
  if (bz === false) map.boxZoom.disable();
  else map.boxZoom.enable();

  const dr = pick(o, "dragging", "Dragging");
  if (dr === false) map.dragging.disable();
  else map.dragging.enable();

  const kb = pick(o, "keyboardNavigation", "KeyboardNavigation");
  if (map.keyboard && typeof map.keyboard.disable === "function") {
    if (kb === false) map.keyboard.disable();
    else map.keyboard.enable();
  }
}

function ensureScale(s, o) {
  const L = getL();
  const show = !!pick(o, "showScaleControl", "ShowScaleControl");
  const imperial = !!pick(o, "scaleControlImperial", "ScaleControlImperial");
  if (show && !s.scaleControl) {
    s.scaleControl = L.control.scale({ imperial, metric: true }).addTo(s.map);
  } else if (!show && s.scaleControl) {
    s.map.removeControl(s.scaleControl);
    s.scaleControl = null;
  } else if (show && s.scaleControl) {
    s.map.removeControl(s.scaleControl);
    s.scaleControl = L.control.scale({ imperial, metric: true }).addTo(s.map);
  }
}

function tileOptsFrom(o) {
  return {
    maxZoom: pick(o, "tileMaxZoom", "TileMaxZoom") ?? 19,
    attribution: pick(o, "tileAttribution", "TileAttribution") || "&copy; OpenStreetMap contributors",
    opacity: pick(o, "tileOpacity", "TileOpacity") ?? 1,
  };
}

export function initMap(mapId, element, dotNetRef, options) {
  const L = getL();
  ensureLeafletDefaultIcon(L);
  const o = options || {};
  const center = readCenter(o) || [51.505, -0.09];
  const zoom = pick(o, "zoom", "Zoom") ?? 13;

  const map = L.map(element, {
    center,
    zoom,
    minZoom: pick(o, "minZoom", "MinZoom") ?? undefined,
    maxZoom: pick(o, "maxZoom", "MaxZoom") ?? undefined,
    zoomControl: pick(o, "zoomControl", "ZoomControl") !== false,
    attributionControl: pick(o, "attributionControl", "AttributionControl") !== false,
    scrollWheelZoom: pick(o, "scrollWheelZoom", "ScrollWheelZoom") !== false,
    doubleClickZoom: pick(o, "doubleClickZoom", "DoubleClickZoom") !== false,
    boxZoom: pick(o, "boxZoom", "BoxZoom") !== false,
    dragging: pick(o, "dragging", "Dragging") !== false,
    keyboard: pick(o, "keyboardNavigation", "KeyboardNavigation") !== false,
  });

  const tUrl =
    pick(o, "tileUrl", "TileUrl") || "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
  const base = L.tileLayer(tUrl, tileOptsFrom(o)).addTo(map);

  const state = {
    map,
    dotNetRef,
    markers: new Map(),
    layers: new Map(),
    baseTileLayer: base,
    tileOverlays: new Map(),
    scaleControl: null,
  };

  applyMaxBounds(map, o);
  applyInteraction(map, o);
  ensureScale(state, o);

  map.on("click", (e) => {
    dotNetRef.invokeMethodAsync("ReportMapClick", {
      lat: e.latlng.lat,
      lng: e.latlng.lng,
    });
  });

  map.on("dblclick", (e) => {
    dotNetRef.invokeMethodAsync("ReportMapDoubleClick", {
      lat: e.latlng.lat,
      lng: e.latlng.lng,
    });
  });

  const notifyView = () => {
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
  };

  map.on("moveend", notifyView);
  map.on("zoomend", notifyView);

  maps.set(mapId, state);
  queueMicrotask(() => {
    map.invalidateSize();
    notifyView();
  });
  return mapId;
}

export function syncMapOptions(mapId, o) {
  const s = getState(mapId);
  const map = s.map;
  const c = readCenter(o);
  const zoom = pick(o, "zoom", "Zoom");
  if (c) {
    map.setView(c, zoom ?? map.getZoom(), { animate: false });
  }

  const tUrl = pick(o, "tileUrl", "TileUrl");
  const tAttr = pick(o, "tileAttribution", "TileAttribution");
  const tMax = pick(o, "tileMaxZoom", "TileMaxZoom");
  const tOp = pick(o, "tileOpacity", "TileOpacity");
  if (s.baseTileLayer) {
    map.removeLayer(s.baseTileLayer);
  }
  const L = getL();
  s.baseTileLayer = L.tileLayer(
    tUrl || "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    {
      maxZoom: tMax ?? 19,
      attribution: tAttr || "&copy; OpenStreetMap contributors",
      opacity: tOp ?? 1,
    }
  ).addTo(map);
  s.baseTileLayer.bringToBack();
  for (const ov of s.tileOverlays.values()) {
    try {
      ov.bringToFront();
    } catch {
      /* ignore */
    }
  }

  applyMaxBounds(map, o);
  applyInteraction(map, o);
  ensureScale(s, o);
}

export function destroyMap(mapId) {
  const s = maps.get(mapId);
  if (!s) return;
  try {
    for (const lyr of s.tileOverlays.values()) {
      s.map.removeLayer(lyr);
    }
    s.tileOverlays.clear();
    if (s.scaleControl) s.map.removeControl(s.scaleControl);
    s.map.remove();
  } catch {
    /* ignore */
  }
  maps.delete(mapId);
}

export function invalidateSize(mapId) {
  const s = maps.get(mapId);
  if (!s) return;
  s.map.invalidateSize({ animate: false });
}

export function setView(mapId, lat, lng, zoom, animate) {
  const s = getState(mapId);
  const z = zoom ?? s.map.getZoom();
  if (animate === false) {
    s.map.setView([lat, lng], z, { animate: false });
  } else {
    s.map.setView([lat, lng], z);
  }
}

export function fitBounds(mapId, swLat, swLng, neLat, neLng, paddingPx) {
  const s = getState(mapId);
  const L = getL();
  const pad = paddingPx ?? 48;
  s.map.fitBounds(
    L.latLngBounds(L.latLng(swLat, swLng), L.latLng(neLat, neLng)),
    { padding: [pad, pad], maxZoom: 18 }
  );
}

export function fitBoundsToMarkers(mapId, paddingPx) {
  const s = getState(mapId);
  const L = getL();
  if (s.markers.size === 0) return;
  const layers = [...s.markers.values()];
  const g = L.featureGroup(layers);
  const b = g.getBounds();
  if (!b.isValid()) return;
  const pad = paddingPx ?? 48;
  s.map.fitBounds(b, { padding: [pad, pad], maxZoom: 18 });
}

export function flyTo(mapId, lat, lng, zoom) {
  const s = getState(mapId);
  s.map.flyTo([lat, lng], zoom ?? s.map.getZoom(), { duration: 1.2 });
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
  const L = getL();
  const lat = pick(opts, "lat", "Lat") ?? pick(opts, "latitude", "Latitude");
  const lng = pick(opts, "lng", "Lng") ?? pick(opts, "longitude", "Longitude");
  const iconUrl = pick(opts, "iconUrl", "IconUrl");
  const iconSizeW = pick(opts, "iconWidth", "IconWidth");
  const iconSizeH = pick(opts, "iconHeight", "IconHeight");
  let icon;
  if (iconUrl) {
    const w = iconSizeW || 32;
    const h = iconSizeH || 32;
    icon = L.icon({
      iconUrl,
      iconSize: [w, h],
      iconAnchor: [Math.floor(w / 2), h],
      popupAnchor: [0, -h],
    });
  }
  const zio = pick(opts, "zIndexOffset", "ZIndexOffset") ?? 0;
  const markerOpts = {
    draggable: !!pick(opts, "draggable", "Draggable"),
    title: pick(opts, "title", "Title") || undefined,
    zIndexOffset: zio,
  };
  if (icon) {
    markerOpts.icon = icon;
  }
  const m = L.marker([lat, lng], markerOpts);
  const popupHtml = pick(opts, "popupHtml", "PopupHtml");
  if (popupHtml) {
    m.bindPopup(popupHtml);
  }
  const tooltipHtml = pick(opts, "tooltipHtml", "TooltipHtml");
  if (tooltipHtml) {
    m.bindTooltip(tooltipHtml, {
      permanent: !!pick(opts, "tooltipPermanent", "TooltipPermanent"),
      direction: pick(opts, "tooltipDirection", "TooltipDirection") || "auto",
    });
  }
  m.addTo(s.map);
  m.on("click", () => {
    s.dotNetRef.invokeMethodAsync("ReportMarkerClick", markerId);
  });
  if (pick(opts, "draggable", "Draggable")) {
    m.on("dragend", (e) => {
      const p = e.target.getLatLng();
      s.dotNetRef.invokeMethodAsync("ReportMarkerDragEnd", markerId, {
        lat: p.lat,
        lng: p.lng,
      });
    });
  }
  s.markers.set(markerId, m);
}

export function removeMarker(mapId, markerId) {
  const s = maps.get(mapId);
  if (!s) return;
  const m = s.markers.get(markerId);
  if (m) {
    s.map.removeLayer(m);
    s.markers.delete(markerId);
  }
}

export function clearMarkers(mapId) {
  const s = maps.get(mapId);
  if (!s) return;
  for (const m of s.markers.values()) {
    s.map.removeLayer(m);
  }
  s.markers.clear();
}

export function setMarkerLatLng(mapId, markerId, lat, lng) {
  const s = maps.get(mapId);
  if (!s) return;
  const m = s.markers.get(markerId);
  if (m) m.setLatLng([lat, lng]);
}

export function openMarkerPopup(mapId, markerId) {
  const s = maps.get(mapId);
  if (!s) return;
  const m = s.markers.get(markerId);
  if (m && m.getPopup()) m.openPopup();
}

export function addPolyline(mapId, layerId, latlngs, style) {
  const s = getState(mapId);
  const L = getL();
  const pl = L.polyline(toLatLngs(latlngs), pathStyle(style)).addTo(s.map);
  pl.on("click", (e) => {
    L.DomEvent.stopPropagation(e);
    s.dotNetRef.invokeMethodAsync("ReportVectorClick", layerId, "polyline", {
      lat: e.latlng.lat,
      lng: e.latlng.lng,
    });
  });
  s.layers.set(layerId, pl);
}

export function addPolygon(mapId, layerId, latlngs, style) {
  const s = getState(mapId);
  const L = getL();
  const poly = L.polygon(toLatLngs(latlngs), pathStyle(style)).addTo(s.map);
  poly.on("click", (e) => {
    L.DomEvent.stopPropagation(e);
    s.dotNetRef.invokeMethodAsync("ReportVectorClick", layerId, "polygon", {
      lat: e.latlng.lat,
      lng: e.latlng.lng,
    });
  });
  s.layers.set(layerId, poly);
}

export function addCircle(mapId, layerId, lat, lng, radiusMeters, style) {
  const s = getState(mapId);
  const L = getL();
  const c = L.circle([lat, lng], {
    radius: radiusMeters,
    ...pathStyle(style),
  }).addTo(s.map);
  c.on("click", (e) => {
    L.DomEvent.stopPropagation(e);
    s.dotNetRef.invokeMethodAsync("ReportVectorClick", layerId, "circle", {
      lat: e.latlng.lat,
      lng: e.latlng.lng,
    });
  });
  s.layers.set(layerId, c);
}

export function addRectangle(mapId, layerId, swLat, swLng, neLat, neLng, style) {
  const s = getState(mapId);
  const L = getL();
  const r = L.rectangle(
    L.latLngBounds(L.latLng(swLat, swLng), L.latLng(neLat, neLng)),
    pathStyle(style)
  ).addTo(s.map);
  r.on("click", (e) => {
    L.DomEvent.stopPropagation(e);
    s.dotNetRef.invokeMethodAsync("ReportVectorClick", layerId, "rectangle", {
      lat: e.latlng.lat,
      lng: e.latlng.lng,
    });
  });
  s.layers.set(layerId, r);
}

export function addGeoJson(mapId, layerId, geoJsonString, style) {
  const s = getState(mapId);
  const L = getL();
  let gj;
  try {
    gj = JSON.parse(geoJsonString);
  } catch {
    throw new Error("Invalid GeoJSON string");
  }
  const layer = L.geoJSON(gj, {
    style: () => pathStyle(style),
    onEachFeature(feature, lyr) {
      lyr.on("click", (e) => {
        L.DomEvent.stopPropagation(e);
        s.dotNetRef.invokeMethodAsync("ReportGeoJsonFeatureClick", layerId, feature?.properties || {});
      });
    },
  }).addTo(s.map);
  s.layers.set(layerId, layer);
}

export function removeLayer(mapId, layerId) {
  const s = maps.get(mapId);
  if (!s) return;
  const lyr = s.layers.get(layerId);
  if (lyr) {
    s.map.removeLayer(lyr);
    s.layers.delete(layerId);
  }
}

export function clearVectorLayers(mapId) {
  const s = maps.get(mapId);
  if (!s) return;
  for (const lyr of s.layers.values()) {
    s.map.removeLayer(lyr);
  }
  s.layers.clear();
}

export function addTileOverlay(mapId, opts) {
  const s = getState(mapId);
  const L = getL();
  const id = pick(opts, "id", "Id");
  const url = pick(opts, "urlTemplate", "UrlTemplate");
  const tl = L.tileLayer(url, {
    opacity: pick(opts, "opacity", "Opacity") ?? 1,
    zIndex: pick(opts, "zIndex", "ZIndex") ?? 100,
    maxZoom: pick(opts, "maxZoom", "MaxZoom") ?? 19,
    attribution: pick(opts, "attribution", "Attribution") || "",
  });
  tl.addTo(s.map);
  s.tileOverlays.set(id, tl);
}

export function removeTileOverlay(mapId, overlayId) {
  const s = maps.get(mapId);
  if (!s) return;
  const tl = s.tileOverlays.get(overlayId);
  if (tl) {
    s.map.removeLayer(tl);
    s.tileOverlays.delete(overlayId);
  }
}
