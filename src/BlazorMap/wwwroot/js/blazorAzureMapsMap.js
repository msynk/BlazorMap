/**
 * BlazorAzureMapsMap — Azure Maps Web SDK v3 bridge.
 * Loads the Atlas SDK from the Microsoft CDN on first use via mapDependencyLoader.
 * Mirrors the imperative export surface of blazorArcGisMap.js / blazorOpenLayersMap.js.
 */
import { loadScript, loadStylesheet } from "./mapDependencyLoader.js";

const maps = new Map();

const ATLAS_VER = "3";
const ATLAS_JS_URL  = `https://atlas.microsoft.com/sdk/javascript/mapcontrol/${ATLAS_VER}/atlas.min.js`;
const ATLAS_CSS_URL = `https://atlas.microsoft.com/sdk/javascript/mapcontrol/${ATLAS_VER}/atlas.min.css`;

/** @type {Promise<any> | null} */
let atlasLoadPromise = null;

async function loadAtlas() {
  if (atlasLoadPromise) return atlasLoadPromise;
  atlasLoadPromise = (async () => {
    await loadStylesheet(ATLAS_CSS_URL).catch(() => {});
    await loadScript(ATLAS_JS_URL);
    return waitForAtlas();
  })();
  return atlasLoadPromise;
}

function waitForAtlas(timeoutMs = 30_000) {
  const t0 = Date.now();
  return new Promise((resolve, reject) => {
    const tick = () => {
      if (typeof globalThis.atlas?.Map === "function") {
        resolve(globalThis.atlas);
      } else if (Date.now() - t0 > timeoutMs) {
        reject(new Error("Timed out waiting for atlas global (Azure Maps CDN not ready)"));
      } else {
        setTimeout(tick, 50);
      }
    };
    tick();
  });
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

function hexToRgba(hex, alpha) {
  if (!hex || typeof hex !== "string") return `rgba(51,136,255,${alpha ?? 1})`;
  let h = hex.replace("#", "");
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  const n = parseInt(h, 16);
  if (Number.isNaN(n)) return `rgba(51,136,255,${alpha ?? 1})`;
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha ?? 1})`;
}

function getState(mapId) {
  const s = maps.get(mapId);
  if (!s) throw new Error(`BlazorAzureMapsMap: unknown map id '${mapId}'`);
  return s;
}

/** Approximate a circle as a closed GeoJSON polygon ring. */
function circleRingCoords(lat, lng, radiusMeters, points = 64) {
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

// ---------------------------------------------------------------------------
// Style helpers
// ---------------------------------------------------------------------------

function readStyle(style) {
  if (!style) return { color: "#3388ff", weight: 3, opacity: 1, fillColor: null, fillOpacity: 0.2, dashArray: null };
  return {
    color:       pick(style, "color",       "Color")       ?? "#3388ff",
    weight:      pick(style, "weight",      "Weight")      ?? 3,
    opacity:     pick(style, "opacity",     "Opacity")     ?? 1,
    fillColor:   pick(style, "fillColor",   "FillColor")   ?? null,
    fillOpacity: pick(style, "fillOpacity", "FillOpacity") ?? 0.2,
    dashArray:   pick(style, "dashArray",   "DashArray")   ?? null,
  };
}

function dashStringToArray(dash) {
  if (!dash) return undefined;
  const arr = dash.split(/[\s,]+/).map(Number).filter(n => !isNaN(n));
  return arr.length > 0 ? arr : undefined;
}

// ---------------------------------------------------------------------------
// View helpers
// ---------------------------------------------------------------------------

function notifyView(s) {
  try {
    const cam = s.map.getCamera();
    if (!cam) return;
    const center = cam.center ?? [0, 0];
    const zoom   = cam.zoom   ?? 0;
    const b      = cam.bounds; // [west, south, east, north]
    const bounds = b
      ? { southWest: { lat: b[1], lng: b[0] }, northEast: { lat: b[3], lng: b[2] } }
      : { southWest: { lat: 0,   lng: 0   }, northEast: { lat: 0,   lng: 0   } };
    queueMicrotask(() => {
      s.dotNetRef.invokeMethodAsync("ReportViewChanged", {
        center: { lat: center[1], lng: center[0] },
        zoom,
        bounds,
      });
    });
  } catch {
    /* ignore */
  }
}

// ---------------------------------------------------------------------------
// Control helpers
// ---------------------------------------------------------------------------

function ensureZoomControl(s, show) {
  if (show && !s.zoomControl) {
    s.zoomControl = new s.atlas.control.ZoomControl();
    s.map.controls.add(s.zoomControl, { position: "top-right" });
  } else if (!show && s.zoomControl) {
    s.map.controls.remove(s.zoomControl);
    s.zoomControl = null;
  }
}

function ensureScaleControl(s, show) {
  if (show && !s.scaleControl) {
    s.scaleControl = new s.atlas.control.ScaleControl();
    s.map.controls.add(s.scaleControl, { position: "bottom-left" });
  } else if (!show && s.scaleControl) {
    s.map.controls.remove(s.scaleControl);
    s.scaleControl = null;
  }
}

// ---------------------------------------------------------------------------
// Event wiring
// ---------------------------------------------------------------------------

function wireEvents(s) {
  const { map, atlas } = s;

  // Hover tooltip container
  const hoverEl = document.createElement("div");
  hoverEl.className = "blazor-map-az-tooltip";
  hoverEl.style.cssText =
    "position:absolute;pointer-events:none;background:rgba(0,0,0,.72);color:#fff;" +
    "padding:2px 7px;border-radius:3px;font:12px system-ui;white-space:nowrap;" +
    "z-index:9999;display:none;";
  const container = map.getMapContainer();
  if (container) {
    container.style.position = "relative";
    container.appendChild(hoverEl);
  }
  s.hoverEl = hoverEl;

  // Hover tooltip tracking
  map.events.add("mousemove", (e) => {
    let shown = false;
    for (const entry of s.markers.values()) {
      if (!entry.tooltipHtml || !entry.tooltipPermanent) continue;
      // Permanent tooltips are already shown as fixed labels — skip hover
    }
    if (!shown) hoverEl.style.display = "none";
  });

  // Map click — handles plain map click and vector/GeoJSON feature clicks
  map.events.add("click", (e) => {
    // If a marker click handler already handled this event, skip
    const ts = e.originalEvent?.timeStamp ?? NaN;
    if (!isNaN(ts) && ts === s._lastHandledClickTs) return;

    // Check if a DataSource shape was clicked (vector or GeoJSON layer)
    if (e.shapes && e.shapes.length > 0) {
      const shape = e.shapes[0];
      const props = shape.getProperties ? shape.getProperties() : (shape.properties ?? {});
      const bmLayerId    = props._bmLayerId;
      const bmKind       = props._bmKind;
      const bmVectorKind = props._bmVectorKind;

      if (bmKind === "geojson" && s.geoJsonLayers.has(bmLayerId)) {
        const cleanProps = {};
        for (const [k, v] of Object.entries(props)) {
          if (!k.startsWith("_bm")) cleanProps[k] = v;
        }
        s.dotNetRef.invokeMethodAsync("ReportGeoJsonFeatureClick", bmLayerId, cleanProps);
        return;
      }
      if (bmKind === "vector" && s.layers.has(bmLayerId)) {
        const pos = e.position ?? [0, 0];
        s.dotNetRef.invokeMethodAsync("ReportVectorClick", bmLayerId, bmVectorKind || "vector", {
          lat: pos[1], lng: pos[0],
        });
        return;
      }
    }

    // Plain map click
    const pos = e.position;
    if (pos) {
      s.dotNetRef.invokeMethodAsync("ReportMapClick", { lat: pos[1], lng: pos[0] });
    }
  });

  // Double-click
  map.events.add("dblclick", (e) => {
    const pos = e.position;
    if (pos) {
      s.dotNetRef.invokeMethodAsync("ReportMapDoubleClick", { lat: pos[1], lng: pos[0] });
    }
  });

  // View change — debounced
  let viewTimer = null;
  map.events.add("moveend", () => {
    clearTimeout(viewTimer);
    viewTimer = setTimeout(() => notifyView(s), 80);
  });
}

// ---------------------------------------------------------------------------
// Public API — initMap
// ---------------------------------------------------------------------------

export async function initMap(mapId, element, dotNetRef, options) {
  const atlas = await loadAtlas();
  const o = options || {};

  const [lng0, lat0] = readCenter(o);
  const zoom         = pick(o, "zoom",         "Zoom")         ?? 4;
  const minZoom      = pick(o, "minZoom",      "MinZoom")      ?? undefined;
  const maxZoom      = pick(o, "maxZoom",      "MaxZoom")      ?? undefined;
  const style        = pick(o, "style",        "Style")        || "road";
  const subscriptionKey = pick(o, "subscriptionKey", "SubscriptionKey");
  const zoomOn       = pick(o, "zoomControl",         "ZoomControl")        !== false;
  const showLogo     = pick(o, "attributionControl",  "AttributionControl") !== false;
  const scrollWheel  = pick(o, "scrollWheelZoom",     "ScrollWheelZoom")    !== false;
  const dblClick     = pick(o, "doubleClickZoom",     "DoubleClickZoom")    !== false;
  const dragging     = pick(o, "dragging",            "Dragging")           !== false;
  const keyboard     = pick(o, "keyboardNavigation",  "KeyboardNavigation") !== false;

  const authOptions = subscriptionKey
    ? { authType: "subscriptionKey", subscriptionKey }
    : { authType: "subscriptionKey", subscriptionKey: "" };

  const mapOptions = {
    center: [lng0, lat0],
    zoom,
    style,
    language: "en-US",
    authOptions,
    showLogo,
    showFeedbackLink: false,
    disableTelemetry: true,
    // Interactions
    scrollZoomInteraction: scrollWheel,
    dragPanInteraction: dragging,
    dblClickZoomInteraction: dblClick,
    keyboardInteraction: keyboard,
  };
  if (minZoom != null) mapOptions.minZoom = minZoom;
  if (maxZoom != null) mapOptions.maxZoom = maxZoom;

  const map = new atlas.Map(element, mapOptions);

  // Wait for ready event
  await new Promise((resolve) => {
    map.events.add("ready", resolve);
  });

  const state = {
    atlas,
    map,
    dotNetRef,
    markers:      new Map(),
    layers:       new Map(),
    geoJsonLayers: new Map(),
    tileOverlays: new Map(),
    zoomControl:  null,
    scaleControl: null,
    hoverEl:      null,
    _lastHandledClickTs: NaN,
    zIndexCounter: 100,
  };

  maps.set(mapId, state);

  ensureZoomControl(state,  zoomOn);
  ensureScaleControl(state, !!pick(o, "showScaleControl", "ShowScaleControl"));
  wireEvents(state);

  notifyView(state);
  return mapId;
}

// ---------------------------------------------------------------------------
// syncMapOptions
// ---------------------------------------------------------------------------

export function syncMapOptions(mapId, o) {
  const s = getState(mapId);
  const [lng0, lat0] = readCenter(o);
  const zoom = pick(o, "zoom", "Zoom");

  s.map.setCamera({ center: [lng0, lat0], zoom: zoom ?? s.map.getCamera().zoom, type: "jump" });

  const newStyle = pick(o, "style", "Style");
  if (newStyle) s.map.setStyle({ style: newStyle });

  s.map.setUserInteraction({
    scrollZoomInteraction:  pick(o, "scrollWheelZoom",    "ScrollWheelZoom")    !== false,
    dragPanInteraction:     pick(o, "dragging",           "Dragging")           !== false,
    dblClickZoomInteraction: pick(o, "doubleClickZoom",   "DoubleClickZoom")    !== false,
    keyboardInteraction:    pick(o, "keyboardNavigation", "KeyboardNavigation") !== false,
  });

  const minZoom = pick(o, "minZoom", "MinZoom");
  const maxZoom = pick(o, "maxZoom", "MaxZoom");
  if (minZoom != null || maxZoom != null) {
    const camOpts = {};
    if (minZoom != null) camOpts.minZoom = minZoom;
    if (maxZoom != null) camOpts.maxZoom = maxZoom;
    s.map.setCamera(camOpts);
  }

  ensureZoomControl(s,  pick(o, "zoomControl",       "ZoomControl")       !== false);
  ensureScaleControl(s, !!pick(o, "showScaleControl", "ShowScaleControl"));
}

// ---------------------------------------------------------------------------
// destroyMap
// ---------------------------------------------------------------------------

export function destroyMap(mapId) {
  const s = maps.get(mapId);
  if (!s) return;
  try {
    if (s.hoverEl) s.hoverEl.remove();
    // Clean up popup elements from permanent tooltips
    for (const entry of s.markers.values()) {
      if (entry.tooltipEl) entry.tooltipEl.remove();
    }
    s.map.dispose();
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
  s.map.resize();
}

export function setView(mapId, lat, lng, zoom, animate) {
  const s = getState(mapId);
  s.map.setCamera({
    center: [lng, lat],
    zoom:   zoom ?? s.map.getCamera().zoom,
    type:   animate === false ? "jump" : "ease",
  });
}

export function flyTo(mapId, lat, lng, zoom) {
  const s = getState(mapId);
  s.map.setCamera({
    center:   [lng, lat],
    zoom:     zoom ?? s.map.getCamera().zoom,
    type:     "fly",
    duration: 1200,
  });
}

export function fitBounds(mapId, swLat, swLng, neLat, neLng, paddingPx) {
  const s = getState(mapId);
  const pad = paddingPx ?? 48;
  s.map.setCamera({
    bounds:  [swLng, swLat, neLng, neLat],
    padding: { top: pad, right: pad, bottom: pad, left: pad },
    type:    "ease",
  });
}

export function fitBoundsToMarkers(mapId, paddingPx) {
  const s = getState(mapId);
  if (s.markers.size === 0) return;
  const positions = [];
  for (const entry of s.markers.values()) {
    const pos = entry.marker.getOptions().position;
    if (pos) positions.push(pos);
  }
  if (positions.length === 0) return;
  const bounds = s.atlas.data.BoundingBox.fromPositions(positions);
  const pad = paddingPx ?? 48;
  s.map.setCamera({
    bounds,
    padding: { top: pad, right: pad, bottom: pad, left: pad },
    type:    "ease",
  });
}

export function getView(mapId) {
  const s = getState(mapId);
  const cam = s.map.getCamera();
  const center = cam.center ?? [0, 0];
  const b      = cam.bounds;
  return {
    center: { lat: center[1], lng: center[0] },
    zoom:   cam.zoom ?? 0,
    bounds: b
      ? { southWest: { lat: b[1], lng: b[0] }, northEast: { lat: b[3], lng: b[2] } }
      : { southWest: { lat: 0,   lng: 0   }, northEast: { lat: 0,   lng: 0   } },
  };
}

// ---------------------------------------------------------------------------
// Markers
// ---------------------------------------------------------------------------

export function addMarker(mapId, markerId, opts) {
  const s = getState(mapId);
  const lat = pick(opts, "lat", "Lat") ?? pick(opts, "latitude", "Latitude") ?? 0;
  const lng = pick(opts, "lng", "Lng") ?? pick(opts, "longitude", "Longitude") ?? 0;
  const popupHtml   = pick(opts, "popupHtml",   "PopupHtml")   || "";
  const title       = pick(opts, "title",       "Title")       || "";
  const draggable   = !!pick(opts, "draggable", "Draggable");
  const iconUrl     = pick(opts, "iconUrl",     "IconUrl");
  const iconWidth   = pick(opts, "iconWidth",   "IconWidth")   || 32;
  const iconHeight  = pick(opts, "iconHeight",  "IconHeight")  || 32;
  const tooltipHtml = pick(opts, "tooltipHtml", "TooltipHtml") || "";
  const tooltipPerm = !!pick(opts, "tooltipPermanent", "TooltipPermanent");

  // Build HTML content: custom icon or default push-pin
  let htmlContent;
  if (iconUrl) {
    htmlContent =
      `<div style="position:relative;width:${iconWidth}px;height:${iconHeight}px;` +
      `transform:translate(-50%,-100%);">` +
      `<img src="${iconUrl}" width="${iconWidth}" height="${iconHeight}" alt="" />` +
      `</div>`;
  }

  const markerOpts = {
    position: [lng, lat],
    draggable,
  };
  if (htmlContent) markerOpts.htmlContent = htmlContent;
  if (title)       markerOpts.title = title;

  // Popup
  let popup = null;
  if (popupHtml) {
    popup = new s.atlas.Popup({
      content: `<div style="padding:6px 8px;">${popupHtml}</div>`,
      pixelOffset: [0, -28],
      closeButton: true,
    });
    markerOpts.popup = popup;
  }

  const marker = new s.atlas.HtmlMarker(markerOpts);
  s.map.markers.add(marker);

  const entry = { marker, popup, tooltipHtml, tooltipPermanent: tooltipPerm, tooltipEl: null };
  s.markers.set(markerId, entry);

  // Per-marker click: store timestamp to prevent map click double-fire
  s.map.events.add("click", marker, (e) => {
    s._lastHandledClickTs = e.originalEvent?.timeStamp ?? NaN;
    // Try to stop propagation so the map's click event doesn't also fire
    e.originalEvent?.stopPropagation?.();
    s.dotNetRef.invokeMethodAsync("ReportMarkerClick", markerId);
    if (popup) marker.togglePopup();
  });

  // Drag end
  if (draggable) {
    s.map.events.add("dragend", marker, () => {
      const pos = marker.getOptions().position ?? [0, 0];
      s.dotNetRef.invokeMethodAsync("ReportMarkerDragEnd", markerId, {
        lat: pos[1], lng: pos[0],
      });
    });
  }

  // Permanent tooltip: render a pinned label element
  if (tooltipHtml) {
    if (tooltipPerm) {
      const el = document.createElement("div");
      el.className = "blazor-map-az-tooltip-perm";
      el.innerHTML = tooltipHtml;
      el.style.cssText =
        "position:absolute;pointer-events:none;background:rgba(0,0,0,.72);color:#fff;" +
        "padding:2px 7px;border-radius:3px;font:12px system-ui;white-space:nowrap;z-index:9999;";
      const container = s.map.getMapContainer();
      if (container) container.appendChild(el);
      entry.tooltipEl = el;

      const positionEl = () => {
        const sp = s.map.positionsToPixels([[lng, lat]])[0];
        if (sp) {
          el.style.left = (sp[0] - el.offsetWidth / 2) + "px";
          el.style.top  = (sp[1] - el.offsetHeight - 32) + "px";
        }
      };
      // Position on map move
      s.map.events.add("moveend", positionEl);
      s.map.events.add("zoomend", positionEl);
      setTimeout(positionEl, 150);
    } else {
      // Hover tooltip: show on mouseenter, hide on mouseleave
      const el = document.createElement("div");
      el.className = "blazor-map-az-tooltip-hover";
      el.innerHTML = tooltipHtml;
      el.style.cssText =
        "display:none;position:absolute;pointer-events:none;background:rgba(0,0,0,.72);color:#fff;" +
        "padding:2px 7px;border-radius:3px;font:12px system-ui;white-space:nowrap;z-index:9999;";
      const container = s.map.getMapContainer();
      if (container) container.appendChild(el);
      entry.tooltipEl = el;

      const markerDiv = marker.getElement();
      if (markerDiv) {
        markerDiv.addEventListener("mouseenter", (ev) => {
          const rect = s.map.getMapContainer()?.getBoundingClientRect?.() ?? { left: 0, top: 0 };
          el.style.left = (ev.clientX - rect.left + 8) + "px";
          el.style.top  = (ev.clientY - rect.top  - 30) + "px";
          el.style.display = "block";
        });
        markerDiv.addEventListener("mouseleave", () => {
          el.style.display = "none";
        });
      }
    }
  }
}

export function removeMarker(mapId, markerId) {
  const s = maps.get(mapId);
  if (!s) return;
  const entry = s.markers.get(markerId);
  if (!entry) return;
  if (entry.popup) entry.popup.remove();
  if (entry.tooltipEl) entry.tooltipEl.remove();
  s.map.markers.remove(entry.marker);
  s.markers.delete(markerId);
}

export function clearMarkers(mapId) {
  const s = maps.get(mapId);
  if (!s) return;
  for (const entry of s.markers.values()) {
    if (entry.popup)      entry.popup.remove();
    if (entry.tooltipEl)  entry.tooltipEl.remove();
    s.map.markers.remove(entry.marker);
  }
  s.markers.clear();
}

export function setMarkerLatLng(mapId, markerId, lat, lng) {
  const s = maps.get(mapId);
  if (!s) return;
  const entry = s.markers.get(markerId);
  if (!entry) return;
  entry.marker.setOptions({ position: [lng, lat] });
}

export function openMarkerPopup(mapId, markerId) {
  const s = maps.get(mapId);
  if (!s) return;
  const entry = s.markers.get(markerId);
  if (!entry?.popup) return;
  const pos = entry.marker.getOptions().position;
  if (pos) entry.popup.setOptions({ position: pos });
  entry.popup.open(s.map);
}

// ---------------------------------------------------------------------------
// Vector layers — each logical layer uses a DataSource + one or more Layers
// ---------------------------------------------------------------------------

function addVectorLayer(s, layerId, features, layerDefs, kind) {
  const ds = new s.atlas.source.DataSource();
  s.map.sources.add(ds);
  ds.add(features);

  const atlasLayerIds = [];
  for (const def of layerDefs) {
    let lyr;
    if (def.type === "line") {
      lyr = new s.atlas.layer.LineLayer(ds, def.id, def.options);
    } else if (def.type === "polygon") {
      lyr = new s.atlas.layer.PolygonLayer(ds, def.id, def.options);
    } else if (def.type === "bubble") {
      lyr = new s.atlas.layer.BubbleLayer(ds, def.id, def.options);
    }
    if (lyr) {
      s.map.layers.add(lyr);
      atlasLayerIds.push(def.id);
    }
  }
  s.layers.set(layerId, { source: ds, layerIds: atlasLayerIds, kind });
}

function makeLineFeature(latlngs, layerId) {
  const coords = latlngs.map((p) => [pick(p, "lng", "Longitude"), pick(p, "lat", "Latitude")]);
  return {
    type: "Feature",
    geometry: { type: "LineString", coordinates: coords },
    properties: { _bmLayerId: layerId, _bmKind: "vector", _bmVectorKind: "polyline" },
  };
}

function makePolygonFeature(ring, layerId, kind) {
  const coords = ring.map((p) => [pick(p, "lng", "Longitude"), pick(p, "lat", "Latitude")]);
  // Close ring
  if (coords.length > 0 && (coords[0][0] !== coords[coords.length - 1][0] || coords[0][1] !== coords[coords.length - 1][1])) {
    coords.push(coords[0]);
  }
  return {
    type: "Feature",
    geometry: { type: "Polygon", coordinates: [coords] },
    properties: { _bmLayerId: layerId, _bmKind: "vector", _bmVectorKind: kind },
  };
}

export function addPolyline(mapId, layerId, latlngs, style) {
  const s = getState(mapId);
  const st = readStyle(style);
  const feature = makeLineFeature(latlngs, layerId);
  addVectorLayer(s, layerId, [feature], [
    {
      id: layerId,
      type: "line",
      options: {
        strokeColor:   hexToRgba(st.color, st.opacity),
        strokeWidth:   st.weight,
        strokeDashArray: dashStringToArray(st.dashArray),
      },
    },
  ], "polyline");
}

export function addPolygon(mapId, layerId, latlngs, style) {
  const s = getState(mapId);
  const st = readStyle(style);
  const fillColor = st.fillColor || st.color;
  const feature = makePolygonFeature(latlngs, layerId, "polygon");
  addVectorLayer(s, layerId, [feature], [
    {
      id: `${layerId}-fill`,
      type: "polygon",
      options: {
        fillColor:   hexToRgba(fillColor, st.fillOpacity),
        fillOpacity: st.fillOpacity,
      },
    },
    {
      id: `${layerId}-outline`,
      type: "line",
      options: {
        strokeColor: hexToRgba(st.color, st.opacity),
        strokeWidth: st.weight,
        strokeDashArray: dashStringToArray(st.dashArray),
      },
    },
  ], "polygon");
}

export function addCircle(mapId, layerId, lat, lng, radiusMeters, style) {
  const s = getState(mapId);
  const st = readStyle(style);
  const fillColor = st.fillColor || st.color;
  const ring = circleRingCoords(lat, lng, radiusMeters);
  const feature = {
    type: "Feature",
    geometry: { type: "Polygon", coordinates: [ring] },
    properties: { _bmLayerId: layerId, _bmKind: "vector", _bmVectorKind: "circle" },
  };
  addVectorLayer(s, layerId, [feature], [
    {
      id: `${layerId}-fill`,
      type: "polygon",
      options: { fillColor: hexToRgba(fillColor, st.fillOpacity) },
    },
    {
      id: `${layerId}-outline`,
      type: "line",
      options: { strokeColor: hexToRgba(st.color, st.opacity), strokeWidth: st.weight },
    },
  ], "circle");
}

export function addRectangle(mapId, layerId, swLat, swLng, neLat, neLng, style) {
  const s = getState(mapId);
  const st = readStyle(style);
  const fillColor = st.fillColor || st.color;
  const ring = [
    [swLng, swLat], [neLng, swLat], [neLng, neLat], [swLng, neLat], [swLng, swLat],
  ];
  const feature = {
    type: "Feature",
    geometry: { type: "Polygon", coordinates: [ring] },
    properties: { _bmLayerId: layerId, _bmKind: "vector", _bmVectorKind: "rectangle" },
  };
  addVectorLayer(s, layerId, [feature], [
    {
      id: `${layerId}-fill`,
      type: "polygon",
      options: {
        fillColor:   hexToRgba(fillColor, st.fillOpacity),
        strokeDashArray: dashStringToArray(st.dashArray),
      },
    },
    {
      id: `${layerId}-outline`,
      type: "line",
      options: {
        strokeColor: hexToRgba(st.color, st.opacity),
        strokeWidth: st.weight,
        strokeDashArray: dashStringToArray(st.dashArray),
      },
    },
  ], "rectangle");
}

export function addGeoJson(mapId, layerId, geoJsonString, style) {
  const s = getState(mapId);
  const st = readStyle(style);
  const fillColor = st.fillColor || st.color;

  let gj;
  try { gj = typeof geoJsonString === "string" ? JSON.parse(geoJsonString) : geoJsonString; }
  catch { throw new Error("BlazorAzureMapsMap: invalid GeoJSON string"); }

  // Augment all features with our internal metadata
  const augment = (f) => ({
    ...f,
    properties: {
      ...(f.properties ?? {}),
      _bmLayerId: layerId,
      _bmKind: "geojson",
    },
  });

  let augmented;
  if (gj.type === "FeatureCollection") {
    augmented = { ...gj, features: gj.features.map(augment) };
  } else if (gj.type === "Feature") {
    augmented = { type: "FeatureCollection", features: [augment(gj)] };
  } else {
    // Bare geometry
    augmented = { type: "FeatureCollection", features: [augment({ type: "Feature", geometry: gj, properties: {} })] };
  }

  const ds = new s.atlas.source.DataSource();
  s.map.sources.add(ds);
  ds.add(augmented);

  const polygonLayer = new s.atlas.layer.PolygonLayer(ds, `${layerId}-fill`, {
    fillColor:   hexToRgba(fillColor, st.fillOpacity),
    filter: ["any", ["==", ["geometry-type"], "Polygon"], ["==", ["geometry-type"], "MultiPolygon"]],
  });
  const lineLayer = new s.atlas.layer.LineLayer(ds, `${layerId}-line`, {
    strokeColor: hexToRgba(st.color, st.opacity),
    strokeWidth: st.weight,
    strokeDashArray: dashStringToArray(st.dashArray),
  });
  const bubbleLayer = new s.atlas.layer.BubbleLayer(ds, `${layerId}-bubble`, {
    color:       hexToRgba(st.color, 1),
    radius:      6,
    strokeColor: "#ffffff",
    strokeWidth: 2,
    filter: ["==", ["geometry-type"], "Point"],
  });

  s.map.layers.add([polygonLayer, lineLayer, bubbleLayer]);
  s.geoJsonLayers.set(layerId, {
    source: ds,
    layerIds: [`${layerId}-fill`, `${layerId}-line`, `${layerId}-bubble`],
  });
}

export function removeLayer(mapId, layerId) {
  const s = maps.get(mapId);
  if (!s) return;
  const info = s.layers.get(layerId) ?? s.geoJsonLayers.get(layerId);
  if (!info) return;
  for (const lid of info.layerIds) {
    try { s.map.layers.remove(lid); } catch { /* ignore */ }
  }
  try { s.map.sources.remove(info.source); } catch { /* ignore */ }
  s.layers.delete(layerId);
  s.geoJsonLayers.delete(layerId);
}

export function clearVectorLayers(mapId) {
  const s = maps.get(mapId);
  if (!s) return;
  for (const info of [...s.layers.values(), ...s.geoJsonLayers.values()]) {
    for (const lid of info.layerIds) {
      try { s.map.layers.remove(lid); } catch { /* ignore */ }
    }
    try { s.map.sources.remove(info.source); } catch { /* ignore */ }
  }
  s.layers.clear();
  s.geoJsonLayers.clear();
}

// ---------------------------------------------------------------------------
// Tile overlays
// ---------------------------------------------------------------------------

export function addTileOverlay(mapId, opts) {
  const s = getState(mapId);
  const id  = pick(opts, "id",          "Id");
  const url = (pick(opts, "urlTemplate", "UrlTemplate") || "").replaceAll("{s}", "a");
  const tileLayerId = `_bm_tile_${id}`;

  const tileLayer = new s.atlas.layer.TileLayer({
    tileUrl:       url,
    opacity:       pick(opts, "opacity",  "Opacity")  ?? 1,
    maxSourceZoom: pick(opts, "maxZoom",  "MaxZoom")  ?? 19,
  }, tileLayerId);

  s.map.layers.add(tileLayer);
  s.tileOverlays.set(id, tileLayerId);
}

export function removeTileOverlay(mapId, overlayId) {
  const s = maps.get(mapId);
  if (!s) return;
  const tileLayerId = s.tileOverlays.get(overlayId);
  if (!tileLayerId) return;
  try { s.map.layers.remove(tileLayerId); } catch { /* ignore */ }
  s.tileOverlays.delete(overlayId);
}
