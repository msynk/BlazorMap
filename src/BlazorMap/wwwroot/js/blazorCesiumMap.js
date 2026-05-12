/**
 * BlazorCesiumMap — CesiumJS bridge.
 * Loads CesiumJS from the official CDN on first use via mapDependencyLoader.
 * Mirrors the imperative export surface of other BlazorMap provider modules.
 */
import { loadScript, loadStylesheet } from "./mapDependencyLoader.js";

const maps = new Map();

const CESIUM_VER     = "1.124";
const CESIUM_BASE    = `https://cesium.com/downloads/cesiumjs/releases/${CESIUM_VER}/Build/Cesium/`;
const CESIUM_JS_URL  = `${CESIUM_BASE}Cesium.js`;
const CESIUM_CSS_URL = `${CESIUM_BASE}Widgets/widgets.css`;

// Default marker: red teardrop SVG pin
const DEFAULT_PIN =
  "data:image/svg+xml;charset=utf-8," +
  "<svg xmlns='http://www.w3.org/2000/svg' width='27' height='41' viewBox='0 0 27 41'>" +
  "<path fill='%23e53935' d='M13.5 0C6.04 0 0 6.04 0 13.5c0 10.125 13.5 27.5 13.5 27.5S27 23.625 27 13.5C27 6.04 20.96 0 13.5 0z'/>" +
  "<circle cx='13.5' cy='13.5' r='5' fill='%23fff'/></svg>";

/** @type {Promise<typeof Cesium> | null} */
let cesiumLoadPromise = null;

async function loadCesium() {
  if (cesiumLoadPromise) return cesiumLoadPromise;
  cesiumLoadPromise = (async () => {
    await loadStylesheet(CESIUM_CSS_URL).catch(() => {});
    // CESIUM_BASE_URL must be set before the script executes so web workers resolve correctly.
    if (!globalThis.CESIUM_BASE_URL) {
      globalThis.CESIUM_BASE_URL = CESIUM_BASE;
    }
    await loadScript(CESIUM_JS_URL);
    return waitForCesium();
  })();
  return cesiumLoadPromise;
}

function waitForCesium(timeoutMs = 30_000) {
  const t0 = Date.now();
  return new Promise((resolve, reject) => {
    const tick = () => {
      if (typeof globalThis.Cesium?.Viewer === "function") {
        resolve(globalThis.Cesium);
      } else if (Date.now() - t0 > timeoutMs) {
        reject(new Error("Timed out waiting for Cesium global (CesiumJS CDN not ready)"));
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

function getState(mapId) {
  const s = maps.get(mapId);
  if (!s) throw new Error(`BlazorCesiumMap: unknown map id '${mapId}'`);
  return s;
}

function readStyle(style) {
  if (!style) return { color: "#3388ff", weight: 3, opacity: 1, fillColor: null, fillOpacity: 0.2 };
  return {
    color:       pick(style, "color",       "Color")       ?? "#3388ff",
    weight:      pick(style, "weight",      "Weight")      ?? 3,
    opacity:     pick(style, "opacity",     "Opacity")     ?? 1,
    fillColor:   pick(style, "fillColor",   "FillColor")   ?? null,
    fillOpacity: pick(style, "fillOpacity", "FillOpacity") ?? 0.2,
  };
}

function cssColor(Cesium, hex, alpha) {
  try {
    const c = Cesium.Color.fromCssColorString(hex ?? "#3388ff");
    return alpha != null ? c.withAlpha(alpha) : c;
  } catch {
    return new Cesium.Color(0.2, 0.53, 1.0, alpha ?? 1.0);
  }
}

// Approximate zoom level → camera altitude above ground (metres)
function zoomToAltitude(zoom) {
  if (zoom == null || isNaN(zoom)) return 10_000_000;
  return Math.max(10, 20_000_000 / Math.pow(2, zoom));
}

// Camera altitude → approximate zoom level
function altitudeToZoom(altMetres) {
  if (!altMetres || altMetres <= 0) return 1;
  return Math.max(0, Math.min(21, Math.log2(20_000_000 / altMetres)));
}

function computeView(s) {
  const { viewer, Cesium } = s;
  const canvas = viewer.canvas;
  const w = canvas.clientWidth  || canvas.width  || 1;
  const h = canvas.clientHeight || canvas.height || 1;

  let lat = 0, lng = 0;
  const centerPick = viewer.camera.pickEllipsoid(new Cesium.Cartesian2(w / 2, h / 2));
  if (Cesium.defined(centerPick)) {
    const carto = Cesium.Cartographic.fromCartesian(centerPick);
    lat = Cesium.Math.toDegrees(carto.latitude);
    lng = Cesium.Math.toDegrees(carto.longitude);
  }

  const altitude = viewer.camera.positionCartographic.height;
  const zoom     = altitudeToZoom(altitude);

  // Approximate bounds by picking the four screen corners
  const picks = [
    viewer.camera.pickEllipsoid(new Cesium.Cartesian2(0, 0)),
    viewer.camera.pickEllipsoid(new Cesium.Cartesian2(w, 0)),
    viewer.camera.pickEllipsoid(new Cesium.Cartesian2(0, h)),
    viewer.camera.pickEllipsoid(new Cesium.Cartesian2(w, h)),
  ].filter(p => Cesium.defined(p));

  let swLat = lat - 10, swLng = lng - 10, neLat = lat + 10, neLng = lng + 10;
  if (picks.length === 4) {
    const lats = picks.map(p => Cesium.Math.toDegrees(Cesium.Cartographic.fromCartesian(p).latitude));
    const lngs = picks.map(p => Cesium.Math.toDegrees(Cesium.Cartographic.fromCartesian(p).longitude));
    swLat = Math.min(...lats); neLat = Math.max(...lats);
    swLng = Math.min(...lngs); neLng = Math.max(...lngs);
  }

  return {
    center: { lat, lng },
    zoom,
    bounds: { southWest: { lat: swLat, lng: swLng }, northEast: { lat: neLat, lng: neLng } },
  };
}

function notifyView(s) {
  try {
    const view = computeView(s);
    queueMicrotask(() => s.dotNetRef.invokeMethodAsync("ReportViewChanged", view));
  } catch { /* ignore */ }
}

// ---------------------------------------------------------------------------
// Imagery setup
// ---------------------------------------------------------------------------

function setupImagery(viewer, Cesium, opts, token) {
  viewer.imageryLayers.removeAll();
  const style = (pick(opts, "imageryStyle", "ImageryStyle") ?? "osm").toLowerCase();

  if (style === "none") return;

  if (style === "bing_aerial" && token) {
    Cesium.BingMapsImageryProvider.fromUrl("https://dev.virtualearth.net", {
      key: token, mapStyle: Cesium.BingMapsStyle.AERIAL,
    }).then(p => { viewer.imageryLayers.removeAll(); viewer.imageryLayers.addImageryProvider(p); }).catch(() => {});
    return;
  }
  if (style === "bing_labels" && token) {
    Cesium.BingMapsImageryProvider.fromUrl("https://dev.virtualearth.net", {
      key: token, mapStyle: Cesium.BingMapsStyle.AERIAL_WITH_LABELS_ON_DEMAND,
    }).then(p => { viewer.imageryLayers.removeAll(); viewer.imageryLayers.addImageryProvider(p); }).catch(() => {});
    return;
  }

  // Default: OSM (works without any token)
  viewer.imageryLayers.addImageryProvider(
    new Cesium.UrlTemplateImageryProvider({
      url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
      minimumLevel: 0,
      maximumLevel: 19,
      credit: "© OpenStreetMap contributors",
    })
  );
}

// ---------------------------------------------------------------------------
// Initialization
// ---------------------------------------------------------------------------

export async function initMap(mapId, element, dotNetRef, options) {
  const Cesium = await loadCesium();
  const opts   = options ?? {};

  const center = pick(opts, "center", "Center") ?? {};
  const lat    = pick(center, "lat", "Latitude")  ?? 20;
  const lng    = pick(center, "lng", "Longitude") ?? 0;
  const alt    = pick(opts, "altitude", "Altitude") ?? 15_000_000;

  const token = pick(opts, "ionAccessToken", "IonAccessToken");
  if (token) Cesium.Ion.defaultAccessToken = token;

  const sceneModeStr = pick(opts, "sceneMode", "SceneMode") ?? "scene3d";
  const sceneMode = {
    scene3d:  Cesium.SceneMode.SCENE3D,
    scene2d:  Cesium.SceneMode.SCENE2D,
    columbus: Cesium.SceneMode.COLUMBUS_VIEW,
  }[sceneModeStr] ?? Cesium.SceneMode.SCENE3D;

  const viewer = new Cesium.Viewer(element, {
    sceneMode,
    animation:            pick(opts, "animationWidget",      "AnimationWidget")      ?? false,
    timeline:             pick(opts, "timelineWidget",       "TimelineWidget")       ?? false,
    baseLayerPicker:      pick(opts, "baseLayerPicker",      "BaseLayerPicker")      ?? false,
    navigationHelpButton: pick(opts, "navigationHelpButton", "NavigationHelpButton") ?? true,
    homeButton:           pick(opts, "homeButton",           "HomeButton")           ?? true,
    fullscreenButton:     pick(opts, "fullscreenButton",     "FullscreenButton")     ?? false,
    geocoder:             pick(opts, "geocoder",             "Geocoder")             ?? false,
    infoBox:              pick(opts, "infoBox",              "InfoBox")              ?? true,
    selectionIndicator:   true,
    shadows:              pick(opts, "shadowsEnabled",       "ShadowsEnabled")       ?? false,
    terrainProvider:      new Cesium.EllipsoidTerrainProvider(),
  });

  // Stop the simulation clock (no time-dependent features by default)
  viewer.clock.shouldAnimate = false;

  setupImagery(viewer, Cesium, opts, token);

  if (pick(opts, "terrainEnabled", "TerrainEnabled") && token) {
    Cesium.createWorldTerrainAsync()
      .then(tp => { viewer.terrainProvider = tp; })
      .catch(() => {});
  }

  viewer.camera.setView({
    destination: Cesium.Cartesian3.fromDegrees(lng, lat, alt),
    orientation: { heading: 0.0, pitch: Cesium.Math.toRadians(-90.0), roll: 0.0 },
  });

  const state = {
    viewer,
    Cesium,
    dotNetRef,
    markers:       new Map(),    // markerId → { entity, popupHtml, tooltipHtml, draggable }
    vectorLayers:  new Map(),    // layerId  → Entity[]
    geoJsonSources: new Map(),   // layerId  → DataSource
    tileOverlays:  new Map(),    // overlayId → ImageryLayer
    entityMeta:    new WeakMap(), // Entity   → { markerId?, layerId?, kind?, vectorKind? }
    handler:       null,
    dragEntity:    null,
    isDragging:    false,
    hoverEl:       null,
  };
  maps.set(mapId, state);

  wireEvents(state);
}

// ---------------------------------------------------------------------------
// Event wiring
// ---------------------------------------------------------------------------

function wireEvents(s) {
  const { viewer, Cesium } = s;

  // Hover tooltip overlay
  const container = viewer.container;
  container.style.position = "relative";
  const hoverEl = document.createElement("div");
  hoverEl.style.cssText =
    "position:absolute;pointer-events:none;background:rgba(0,0,0,.72);color:#fff;" +
    "padding:2px 8px;border-radius:3px;font:12px system-ui;white-space:nowrap;" +
    "z-index:9999;display:none;transform:translate(-50%,-130%);";
  container.appendChild(hoverEl);
  s.hoverEl = hoverEl;

  const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
  s.handler = handler;

  // Left-click: marker / vector / geojson / plain map click
  handler.setInputAction((event) => {
    if (s.isDragging) return;

    const picked = viewer.scene.pick(event.position);
    if (Cesium.defined(picked) && picked.id) {
      const entity = picked.id;
      const meta   = s.entityMeta.get(entity);

      if (meta?.markerId) {
        s.dotNetRef.invokeMethodAsync("ReportMarkerClick", meta.markerId).catch(() => {});
        return;
      }
      if (meta?.layerId && meta.kind === "vector") {
        const cart = viewer.camera.pickEllipsoid(event.position);
        if (Cesium.defined(cart)) {
          const c = Cesium.Cartographic.fromCartesian(cart);
          s.dotNetRef.invokeMethodAsync("ReportVectorClick",
            meta.layerId,
            meta.vectorKind ?? "vector",
            { lat: Cesium.Math.toDegrees(c.latitude), lng: Cesium.Math.toDegrees(c.longitude) }
          ).catch(() => {});
        }
        return;
      }
      if (meta?.layerId && meta.kind === "geojson") {
        const props = {};
        if (entity.properties) {
          for (const key of Object.keys(entity.properties)) {
            if (key.startsWith("_bm")) continue;
            try {
              const raw = entity.properties[key];
              props[key] = raw?.getValue ? raw.getValue(Cesium.JulianDate.now()) : raw;
            } catch { /* ignore */ }
          }
        }
        s.dotNetRef.invokeMethodAsync("ReportGeoJsonFeatureClick", meta.layerId, props).catch(() => {});
        return;
      }
    }

    // Plain map click — project to ellipsoid surface
    const cart = viewer.camera.pickEllipsoid(event.position);
    if (Cesium.defined(cart)) {
      const c = Cesium.Cartographic.fromCartesian(cart);
      s.dotNetRef.invokeMethodAsync("ReportMapClick", {
        lat: Cesium.Math.toDegrees(c.latitude),
        lng: Cesium.Math.toDegrees(c.longitude),
      }).catch(() => {});
    }
  }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

  // Double-click
  handler.setInputAction((event) => {
    const cart = viewer.camera.pickEllipsoid(event.position);
    if (Cesium.defined(cart)) {
      const c = Cesium.Cartographic.fromCartesian(cart);
      s.dotNetRef.invokeMethodAsync("ReportMapDoubleClick", {
        lat: Cesium.Math.toDegrees(c.latitude),
        lng: Cesium.Math.toDegrees(c.longitude),
      }).catch(() => {});
    }
  }, Cesium.ScreenSpaceEventType.LEFT_DOUBLE_CLICK);

  // Mouse down — start drag on draggable markers
  handler.setInputAction((event) => {
    const picked = viewer.scene.pick(event.position);
    if (!Cesium.defined(picked) || !picked.id) return;
    const meta = s.entityMeta.get(picked.id);
    if (meta?.markerId && s.markers.get(meta.markerId)?.draggable) {
      s.dragEntity = picked.id;
      s.isDragging = false;
      viewer.scene.screenSpaceCameraController.enableRotate    = false;
      viewer.scene.screenSpaceCameraController.enableTranslate = false;
      viewer.scene.screenSpaceCameraController.enableZoom      = false;
    }
  }, Cesium.ScreenSpaceEventType.LEFT_DOWN);

  // Mouse move — drag or hover tooltip
  handler.setInputAction((event) => {
    if (s.dragEntity) {
      s.isDragging = true;
      const cart = viewer.camera.pickEllipsoid(event.endPosition);
      if (Cesium.defined(cart)) {
        s.dragEntity.position = cart;
      }
      return;
    }

    // Hover tooltip
    const picked = viewer.scene.pick(event.endPosition);
    if (Cesium.defined(picked) && picked.id) {
      const meta = s.entityMeta.get(picked.id);
      if (meta?.markerId) {
        const m = s.markers.get(meta.markerId);
        if (m?.tooltipHtml) {
          hoverEl.innerHTML = m.tooltipHtml;
          hoverEl.style.left    = event.endPosition.x + "px";
          hoverEl.style.top     = event.endPosition.y + "px";
          hoverEl.style.display = "block";
          return;
        }
      }
    }
    hoverEl.style.display = "none";
  }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);

  // Mouse up — finish drag
  handler.setInputAction((_event) => {
    if (s.dragEntity && s.isDragging) {
      const pos  = s.dragEntity.position.getValue(Cesium.JulianDate.now());
      const meta = s.entityMeta.get(s.dragEntity);
      if (Cesium.defined(pos) && meta?.markerId) {
        const c = Cesium.Cartographic.fromCartesian(pos);
        s.dotNetRef.invokeMethodAsync("ReportMarkerDragEnd", meta.markerId, {
          lat: Cesium.Math.toDegrees(c.latitude),
          lng: Cesium.Math.toDegrees(c.longitude),
        }).catch(() => {});
      }
    }
    s.dragEntity = null;
    s.isDragging = false;
    viewer.scene.screenSpaceCameraController.enableRotate    = true;
    viewer.scene.screenSpaceCameraController.enableTranslate = true;
    viewer.scene.screenSpaceCameraController.enableZoom      = true;
  }, Cesium.ScreenSpaceEventType.LEFT_UP);

  // Throttled view-changed notifications
  let viewTimer = null;
  viewer.camera.changed.addEventListener(() => {
    if (viewTimer) clearTimeout(viewTimer);
    viewTimer = setTimeout(() => { notifyView(s); viewTimer = null; }, 150);
  });
}

// ---------------------------------------------------------------------------
// Map lifecycle
// ---------------------------------------------------------------------------

export function destroyMap(mapId) {
  const s = maps.get(mapId);
  if (!s) return;
  try { s.handler?.destroy();  } catch { /* ignore */ }
  try { s.hoverEl?.remove();   } catch { /* ignore */ }
  try { if (!s.viewer.isDestroyed()) s.viewer.destroy(); } catch { /* ignore */ }
  maps.delete(mapId);
}

export function syncMapOptions(mapId, options) {
  const s = maps.get(mapId);
  if (!s) return;
  const { Cesium, viewer } = s;
  const opts   = options ?? {};
  const center = pick(opts, "center", "Center") ?? {};
  const lat    = pick(center, "lat", "Latitude")  ?? 0;
  const lng    = pick(center, "lng", "Longitude") ?? 0;
  const alt    = pick(opts, "altitude", "Altitude") ?? viewer.camera.positionCartographic.height;

  viewer.camera.flyTo({
    destination: Cesium.Cartesian3.fromDegrees(lng, lat, alt),
    orientation: { heading: 0.0, pitch: Cesium.Math.toRadians(-90.0), roll: 0.0 },
    duration: 1.0,
  });
  viewer.shadows = pick(opts, "shadowsEnabled", "ShadowsEnabled") ?? false;
}

export function invalidateSize(mapId) {
  const s = maps.get(mapId);
  if (!s) return;
  try { s.viewer.resize();             } catch { /* ignore */ }
  try { s.viewer.scene.requestRender(); } catch { /* ignore */ }
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

export function getView(mapId) {
  return computeView(getState(mapId));
}

export function setView(mapId, lat, lng, zoom, animate) {
  const { Cesium, viewer } = getState(mapId);
  const dest   = Cesium.Cartesian3.fromDegrees(lng, lat, zoomToAltitude(zoom));
  const orient = { heading: 0.0, pitch: Cesium.Math.toRadians(-90.0), roll: 0.0 };
  if (animate !== false) {
    viewer.camera.flyTo({ destination: dest, orientation: orient, duration: 1.5 });
  } else {
    viewer.camera.setView({ destination: dest, orientation: orient });
  }
}

export function flyTo(mapId, lat, lng, zoom) {
  const { Cesium, viewer } = getState(mapId);
  const alt = zoom != null ? zoomToAltitude(zoom) : viewer.camera.positionCartographic.height;
  viewer.camera.flyTo({
    destination: Cesium.Cartesian3.fromDegrees(lng, lat, alt),
    orientation: { heading: 0.0, pitch: Cesium.Math.toRadians(-90.0), roll: 0.0 },
    duration: 1.5,
  });
}

export function fitBounds(mapId, swLat, swLng, neLat, neLng, _padding) {
  const { Cesium, viewer } = getState(mapId);
  viewer.camera.flyTo({
    destination: Cesium.Rectangle.fromDegrees(swLng, swLat, neLng, neLat),
    duration: 1.5,
  });
}

export function fitBoundsToMarkers(mapId, _padding) {
  const s = getState(mapId);
  const { Cesium, viewer } = s;
  if (s.markers.size === 0) return;

  const positions = [];
  for (const m of s.markers.values()) {
    const pos = m.entity.position.getValue(Cesium.JulianDate.now());
    if (Cesium.defined(pos)) positions.push(pos);
  }
  if (positions.length === 0) return;

  const sphere = Cesium.BoundingSphere.fromPoints(positions);
  viewer.camera.flyToBoundingSphere(sphere, {
    offset:   new Cesium.HeadingPitchRange(0, Cesium.Math.toRadians(-90), sphere.radius * 3.0),
    duration: 1.5,
  });
}

// ---------------------------------------------------------------------------
// Markers
// ---------------------------------------------------------------------------

export function addMarker(mapId, markerId, opts) {
  const s = getState(mapId);
  const { Cesium, viewer } = s;

  removeMarker(mapId, markerId);

  const lat          = pick(opts, "lat",           "Latitude")        ?? 0;
  const lng          = pick(opts, "lng",           "Longitude")       ?? 0;
  const iconUrl      = pick(opts, "iconUrl",       "IconUrl");
  const title        = pick(opts, "title",         "Title");
  const popupHtml    = pick(opts, "popupHtml",     "PopupHtml");
  const tooltipHtml  = pick(opts, "tooltipHtml",   "TooltipHtml");
  const tooltipPerm  = pick(opts, "tooltipPermanent", "TooltipPermanent") ?? false;
  const draggable    = pick(opts, "draggable",     "Draggable")       ?? false;
  const iconWidth    = pick(opts, "iconWidth",     "IconWidth")       ?? 27;
  const iconHeight   = pick(opts, "iconHeight",    "IconHeight")      ?? 41;

  const displayLabel = tooltipPerm && (tooltipHtml || title);

  const entity = viewer.entities.add({
    position:    Cesium.Cartesian3.fromDegrees(lng, lat),
    billboard: {
      image:                    iconUrl ?? DEFAULT_PIN,
      width:                    iconWidth,
      height:                   iconHeight,
      verticalOrigin:           Cesium.VerticalOrigin.BOTTOM,
      disableDepthTestDistance: Number.POSITIVE_INFINITY,
    },
    label: displayLabel ? {
      text:                     tooltipHtml ? stripHtml(tooltipHtml) : (title ?? ""),
      font:                     "13px system-ui, sans-serif",
      style:                    Cesium.LabelStyle.FILL_AND_OUTLINE,
      fillColor:                Cesium.Color.WHITE,
      outlineColor:             Cesium.Color.BLACK,
      outlineWidth:             2,
      pixelOffset:              new Cesium.Cartesian2(0, -(iconHeight + 4)),
      disableDepthTestDistance: Number.POSITIVE_INFINITY,
    } : undefined,
    description: popupHtml ?? undefined,
  });

  s.entityMeta.set(entity, { markerId });
  s.markers.set(markerId, { entity, popupHtml, tooltipHtml, draggable });
}

function stripHtml(html) {
  return html ? html.replace(/<[^>]*>/g, "").trim() : "";
}

export function removeMarker(mapId, markerId) {
  const s = maps.get(mapId);
  if (!s) return;
  const m = s.markers.get(markerId);
  if (!m) return;
  s.viewer.entities.remove(m.entity);
  s.markers.delete(markerId);
}

export function clearMarkers(mapId) {
  const s = maps.get(mapId);
  if (!s) return;
  for (const m of s.markers.values()) s.viewer.entities.remove(m.entity);
  s.markers.clear();
}

export function setMarkerLatLng(mapId, markerId, lat, lng) {
  const s = maps.get(mapId);
  if (!s) return;
  const m = s.markers.get(markerId);
  if (m) m.entity.position = s.Cesium.Cartesian3.fromDegrees(lng, lat);
}

export function openMarkerPopup(mapId, markerId) {
  const s = maps.get(mapId);
  if (!s) return;
  const m = s.markers.get(markerId);
  if (m) s.viewer.selectedEntity = m.entity;
}

// ---------------------------------------------------------------------------
// Vector layers
// ---------------------------------------------------------------------------

export function addPolyline(mapId, layerId, latlngs, style) {
  const s = getState(mapId);
  const { Cesium, viewer } = s;
  const st = readStyle(style);

  removeLayer(mapId, layerId);

  const positions = latlngs.map(p =>
    Cesium.Cartesian3.fromDegrees(pick(p, "lng", "Longitude"), pick(p, "lat", "Latitude"))
  );

  const entity = viewer.entities.add({
    polyline: {
      positions,
      width:         st.weight,
      material:      cssColor(Cesium, st.color, st.opacity),
      clampToGround: true,
    },
  });

  s.entityMeta.set(entity, { layerId, kind: "vector", vectorKind: "polyline" });
  s.vectorLayers.set(layerId, [entity]);
}

export function addPolygon(mapId, layerId, latlngs, style) {
  const s = getState(mapId);
  const { Cesium, viewer } = s;
  const st = readStyle(style);
  const fillHex = st.fillColor || st.color;

  removeLayer(mapId, layerId);

  const positions = latlngs.map(p =>
    Cesium.Cartesian3.fromDegrees(pick(p, "lng", "Longitude"), pick(p, "lat", "Latitude"))
  );

  const entity = viewer.entities.add({
    polygon: {
      hierarchy:     new Cesium.PolygonHierarchy(positions),
      material:      cssColor(Cesium, fillHex, st.fillOpacity),
      outline:       true,
      outlineColor:  cssColor(Cesium, st.color, st.opacity),
      outlineWidth:  st.weight,
      height:        0,
    },
  });

  s.entityMeta.set(entity, { layerId, kind: "vector", vectorKind: "polygon" });
  s.vectorLayers.set(layerId, [entity]);
}

export function addCircle(mapId, layerId, lat, lng, radiusMeters, style) {
  const s = getState(mapId);
  const { Cesium, viewer } = s;
  const st = readStyle(style);
  const fillHex = st.fillColor || st.color;

  removeLayer(mapId, layerId);

  const entity = viewer.entities.add({
    position: Cesium.Cartesian3.fromDegrees(lng, lat),
    ellipse: {
      semiMajorAxis: radiusMeters,
      semiMinorAxis: radiusMeters,
      material:      cssColor(Cesium, fillHex, st.fillOpacity),
      outline:       true,
      outlineColor:  cssColor(Cesium, st.color, st.opacity),
      outlineWidth:  st.weight,
      height:        0,
    },
  });

  s.entityMeta.set(entity, { layerId, kind: "vector", vectorKind: "circle" });
  s.vectorLayers.set(layerId, [entity]);
}

export function addRectangle(mapId, layerId, swLat, swLng, neLat, neLng, style) {
  const s = getState(mapId);
  const { Cesium, viewer } = s;
  const st = readStyle(style);
  const fillHex = st.fillColor || st.color;

  removeLayer(mapId, layerId);

  const entity = viewer.entities.add({
    rectangle: {
      coordinates:  Cesium.Rectangle.fromDegrees(swLng, swLat, neLng, neLat),
      material:     cssColor(Cesium, fillHex, st.fillOpacity),
      outline:      true,
      outlineColor: cssColor(Cesium, st.color, st.opacity),
      outlineWidth: st.weight,
      height:       0,
    },
  });

  s.entityMeta.set(entity, { layerId, kind: "vector", vectorKind: "rectangle" });
  s.vectorLayers.set(layerId, [entity]);
}

export async function addGeoJson(mapId, layerId, geoJsonString, style) {
  const s = getState(mapId);
  const { Cesium, viewer } = s;
  const st = readStyle(style);
  const fillHex = st.fillColor || st.color;

  removeLayer(mapId, layerId);

  let gj;
  try { gj = typeof geoJsonString === "string" ? JSON.parse(geoJsonString) : geoJsonString; }
  catch { throw new Error("BlazorCesiumMap: invalid GeoJSON string"); }

  const dataSource = await Cesium.GeoJsonDataSource.load(gj, {
    stroke:        cssColor(Cesium, st.color, st.opacity),
    fill:          cssColor(Cesium, fillHex, st.fillOpacity),
    strokeWidth:   st.weight,
    clampToGround: true,
  });

  for (const entity of dataSource.entities.values) {
    s.entityMeta.set(entity, { layerId, kind: "geojson" });
  }

  await viewer.dataSources.add(dataSource);
  s.geoJsonSources.set(layerId, dataSource);
}

export function removeLayer(mapId, layerId) {
  const s = maps.get(mapId);
  if (!s) return;

  const entities = s.vectorLayers.get(layerId);
  if (entities) {
    for (const e of entities) s.viewer.entities.remove(e);
    s.vectorLayers.delete(layerId);
  }

  const ds = s.geoJsonSources.get(layerId);
  if (ds) {
    s.viewer.dataSources.remove(ds, true);
    s.geoJsonSources.delete(layerId);
  }
}

export function clearVectorLayers(mapId) {
  const s = maps.get(mapId);
  if (!s) return;

  for (const entities of s.vectorLayers.values()) {
    for (const e of entities) s.viewer.entities.remove(e);
  }
  s.vectorLayers.clear();

  for (const ds of s.geoJsonSources.values()) {
    s.viewer.dataSources.remove(ds, true);
  }
  s.geoJsonSources.clear();
}

// ---------------------------------------------------------------------------
// Tile / imagery overlays
// ---------------------------------------------------------------------------

export function addTileOverlay(mapId, opts) {
  const s = getState(mapId);
  const { Cesium, viewer } = s;

  const id  = pick(opts, "id",          "Id");
  const url = (pick(opts, "urlTemplate", "UrlTemplate") ?? "").replaceAll("{s}", "a");

  const layer = viewer.imageryLayers.addImageryProvider(
    new Cesium.UrlTemplateImageryProvider({
      url,
      minimumLevel: 0,
      maximumLevel: pick(opts, "maxZoom", "MaxZoom") ?? 19,
    })
  );
  layer.alpha = pick(opts, "opacity", "Opacity") ?? 1;
  s.tileOverlays.set(id, layer);
}

export function removeTileOverlay(mapId, overlayId) {
  const s = maps.get(mapId);
  if (!s) return;
  const layer = s.tileOverlays.get(overlayId);
  if (!layer) return;
  try { s.viewer.imageryLayers.remove(layer); } catch { /* ignore */ }
  s.tileOverlays.delete(overlayId);
}
