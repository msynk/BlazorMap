/**
 * BlazorOpenLayersMap — OpenLayers bridge. Loads OpenLayers from esm.sh on first init
 * (?bundle resolves bare npm specifiers like rbush for native ESM in the browser).
 * Mirrors the imperative export surface of blazorLeafletMap.js for BlazorInteractiveMapBase.
 */
import { loadStylesheet } from "./mapDependencyLoader.js";

const maps = new Map();

const OL_VER = "10.5.0";
/** esm.sh rewrites/bundles ol's dependency graph; raw npm URLs leave bare imports (rbush, etc.) unresolved. */
const OL_CSS = `https://cdn.jsdelivr.net/npm/ol@${OL_VER}/ol.css`;
const olBundleUrl = (path) => `https://esm.sh/ol@${OL_VER}/${path}?bundle`;

/** @type {Promise<any> | null} */
let olLoadPromise = null;

async function loadOlModules() {
  if (olLoadPromise) return olLoadPromise;
  olLoadPromise = (async () => {
    await loadStylesheet(OL_CSS);
    const [
      { default: Map },
      { default: View },
      { default: TileLayer },
      { default: XYZ },
      { fromLonLat, toLonLat, transformExtent },
      { defaults },
      { default: VectorLayer },
      { default: VectorSource },
      { default: Feature },
      { default: Point },
      { default: LineString },
      { default: Polygon },
      { default: GeoJSON },
      { default: Style },
      { default: Fill },
      { default: Stroke },
      { default: Icon },
      { default: CircleStyle },
      { default: Overlay },
      { default: Translate },
      { default: Collection },
      { default: ScaleLine },
      { default: MouseWheelZoom },
      { default: DoubleClickZoom },
      { default: DragPan },
      { default: KeyboardPan },
      { default: KeyboardZoom },
    ] = await Promise.all([
      import(olBundleUrl("Map.js")),
      import(olBundleUrl("View.js")),
      import(olBundleUrl("layer/Tile.js")),
      import(olBundleUrl("source/XYZ.js")),
      import(olBundleUrl("proj.js")),
      import(olBundleUrl("control/defaults.js")),
      import(olBundleUrl("layer/Vector.js")),
      import(olBundleUrl("source/Vector.js")),
      import(olBundleUrl("Feature.js")),
      import(olBundleUrl("geom/Point.js")),
      import(olBundleUrl("geom/LineString.js")),
      import(olBundleUrl("geom/Polygon.js")),
      import(olBundleUrl("format/GeoJSON.js")),
      import(olBundleUrl("style/Style.js")),
      import(olBundleUrl("style/Fill.js")),
      import(olBundleUrl("style/Stroke.js")),
      import(olBundleUrl("style/Icon.js")),
      import(olBundleUrl("style/Circle.js")),
      import(olBundleUrl("Overlay.js")),
      import(olBundleUrl("interaction/Translate.js")),
      import(olBundleUrl("Collection.js")),
      import(olBundleUrl("control/ScaleLine.js")),
      import(olBundleUrl("interaction/MouseWheelZoom.js")),
      import(olBundleUrl("interaction/DoubleClickZoom.js")),
      import(olBundleUrl("interaction/DragPan.js")),
      import(olBundleUrl("interaction/KeyboardPan.js")),
      import(olBundleUrl("interaction/KeyboardZoom.js")),
    ]);
    return {
      Map,
      View,
      TileLayer,
      XYZ,
      fromLonLat,
      toLonLat,
      transformExtent,
      defaults,
      VectorLayer,
      VectorSource,
      Feature,
      Point,
      LineString,
      Polygon,
      GeoJSON,
      Style,
      Fill,
      Stroke,
      Icon,
      CircleStyle,
      Overlay,
      Translate,
      Collection,
      ScaleLine,
      MouseWheelZoom,
      DoubleClickZoom,
      DragPan,
      KeyboardPan,
      KeyboardZoom,
    };
  })();
  return olLoadPromise;
}

function pick(o, camel, pascal) {
  const v = o?.[camel];
  return v !== undefined && v !== null ? v : o?.[pascal];
}

function readCenterLonLat(o) {
  const c = pick(o, "center", "Center");
  if (!c) return [-0.09, 51.505];
  const lat = pick(c, "lat", "Latitude");
  const lng = pick(c, "lng", "Longitude");
  return [lng, lat];
}

/** EPSG:4326 box [minLng, minLat, maxLng, maxLat] from any two corners (same contract as Leaflet LatLngBounds). */
function extent4326FromLngLatCorners(lngA, latA, lngB, latB) {
  const minLng = Math.min(lngA, lngB);
  const maxLng = Math.max(lngA, lngB);
  const minLat = Math.min(latA, latB);
  const maxLat = Math.max(latA, latB);
  return [minLng, minLat, maxLng, maxLat];
}

function readBoundsExtent(ol, o) {
  const mb = pick(o, "maxBounds", "MaxBounds");
  if (!mb) return null;
  const sw = pick(mb, "southWest", "SouthWest");
  const ne = pick(mb, "northEast", "NorthEast");
  if (!sw || !ne) return null;
  const swLng = pick(sw, "lng", "Longitude");
  const swLat = pick(sw, "lat", "Latitude");
  const neLng = pick(ne, "lng", "Longitude");
  const neLat = pick(ne, "lat", "Latitude");
  const box = extent4326FromLngLatCorners(swLng, swLat, neLng, neLat);
  return ol.transformExtent(box, "EPSG:4326", "EPSG:3857");
}

function normalizeTileUrl(url) {
  return (url || "").replaceAll("{s}", "a");
}

function to3857Coords(ol, arr) {
  return arr.map((p) => ol.fromLonLat([pick(p, "lng", "Longitude"), pick(p, "lat", "Latitude")]));
}

function pathStyle(ol, style) {
  if (!style) {
    return {
      stroke: new ol.Stroke({ color: "#3388ff", width: 3 }),
      fill: new ol.Fill({ color: "rgba(51,136,255,0.2)" }),
    };
  }
  const color = pick(style, "color", "Color") ?? "#3388ff";
  const weight = pick(style, "weight", "Weight") ?? 3;
  const opacity = pick(style, "opacity", "Opacity") ?? 1;
  const fillColor = pick(style, "fillColor", "FillColor") ?? color;
  const fillOpacity = pick(style, "fillOpacity", "FillOpacity") ?? 0.2;
  const dash = pick(style, "dashArray", "DashArray");
  return {
    stroke: new ol.Stroke({
      color: hexToRgba(color, opacity),
      width: weight,
      lineDash: dash ? dash.split(",").map((x) => parseFloat(x.trim(), 10)) : undefined,
    }),
    fill: new ol.Fill({
      color: hexToRgba(fillColor, fillOpacity),
    }),
  };
}

function hexToRgba(hex, alpha) {
  if (!hex || typeof hex !== "string") return `rgba(51,136,255,${alpha})`;
  let h = hex.replace("#", "");
  if (h.length === 3) {
    h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  }
  const n = parseInt(h, 16);
  if (Number.isNaN(n)) return `rgba(51,136,255,${alpha})`;
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return `rgba(${r},${g},${b},${alpha})`;
}

function circleRing3857(ol, lat, lng, radiusMeters, points = 64) {
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
    ring.push(ol.fromLonLat([(lng2 * 180) / Math.PI, (lat2 * 180) / Math.PI]));
  }
  return ring;
}

function defaultMarkerStyle(ol) {
  return new ol.Style({
    image: new ol.CircleStyle({
      radius: 7,
      fill: new ol.Fill({ color: "#3388ff" }),
      stroke: new ol.Stroke({ color: "#ffffff", width: 2 }),
    }),
  });
}

function markerStyleFromOpts(ol, opts) {
  const iconUrl = pick(opts, "iconUrl", "IconUrl");
  if (iconUrl) {
    const w = pick(opts, "iconWidth", "IconWidth") || 32;
    const h = pick(opts, "iconHeight", "IconHeight") || 32;
    return new ol.Style({
      image: new ol.Icon({
        src: iconUrl,
        anchor: [0.5, 1],
        anchorXUnits: "fraction",
        anchorYUnits: "fraction",
        scale: 1,
      }),
    });
  }
  return defaultMarkerStyle(ol);
}

function getState(mapId) {
  const s = maps.get(mapId);
  if (!s) throw new Error(`BlazorOpenLayersMap: unknown map id '${mapId}'`);
  return s;
}

function findInteraction(map, Cls) {
  return map
    .getInteractions()
    .getArray()
    .find((i) => i instanceof Cls);
}

function applyInteractionToggles(s, o) {
  const map = s.map;
  const ol = s.ol;
  const sw = pick(o, "scrollWheelZoom", "ScrollWheelZoom");
  const mw = findInteraction(map, ol.MouseWheelZoom);
  if (mw) {
    if (sw === false) mw.setActive(false);
    else mw.setActive(true);
  }

  const dz = pick(o, "doubleClickZoom", "DoubleClickZoom");
  const ddz = findInteraction(map, ol.DoubleClickZoom);
  if (ddz) {
    if (dz === false) ddz.setActive(false);
    else ddz.setActive(true);
  }

  const dr = pick(o, "dragging", "Dragging");
  const dp = findInteraction(map, ol.DragPan);
  if (dp) {
    if (dr === false) dp.setActive(false);
    else dp.setActive(true);
  }

  const kb = pick(o, "keyboardNavigation", "KeyboardNavigation");
  const kbp = findInteraction(map, ol.KeyboardPan);
  const kbz = findInteraction(map, ol.KeyboardZoom);
  if (kbp) {
    if (kb === false) kbp.setActive(false);
    else kbp.setActive(true);
  }
  if (kbz) {
    if (kb === false) kbz.setActive(false);
    else kbz.setActive(true);
  }
}

function ensureScaleLine(s, o) {
  const ol = s.ol;
  const show = !!pick(o, "showScaleControl", "ShowScaleControl");
  const imperial = !!pick(o, "scaleControlImperial", "ScaleControlImperial");
  const units = imperial ? "us" : "metric";
  if (show && !s.scaleLine) {
    s.scaleLine = new ol.ScaleLine({ units });
    s.map.addControl(s.scaleLine);
  } else if (!show && s.scaleLine) {
    s.map.removeControl(s.scaleLine);
    s.scaleLine = null;
  } else if (show && s.scaleLine) {
    s.map.removeControl(s.scaleLine);
    s.scaleLine = new ol.ScaleLine({ units });
    s.map.addControl(s.scaleLine);
  }
}

function notifyView(s) {
  const ol = s.ol;
  const view = s.map.getView();
  const c3857 = view.getCenter();
  const c = c3857 ? ol.toLonLat(c3857) : [0, 0];
  const extent = s.map.getView().calculateExtent(s.map.getSize());
  const sw = ol.toLonLat([extent[0], extent[1]]);
  const ne = ol.toLonLat([extent[2], extent[3]]);
  queueMicrotask(() => {
    s.dotNetRef.invokeMethodAsync("ReportViewChanged", {
      center: { lat: c[1], lng: c[0] },
      zoom: view.getZoom() ?? 0,
      bounds: {
        southWest: { lat: sw[1], lng: sw[0] },
        northEast: { lat: ne[1], lng: ne[0] },
      },
    });
  });
}

function wireMapEvents(s) {
  const map = s.map;
  const ol = s.ol;

  map.on("singleclick", (evt) => {
    let hit = false;
    map.forEachFeatureAtPixel(
      evt.pixel,
      (feature, layer) => {
        if (layer === s.markerLayer) {
          hit = true;
          const id = feature.get("markerId");
          if (id) s.dotNetRef.invokeMethodAsync("ReportMarkerClick", id);
          const html = feature.get("popupHtml");
          if (html && s.popupEl) {
            s.popupEl.innerHTML = html;
            s.popupOverlay.setPosition(feature.getGeometry().getCoordinates());
          }
          return true;
        }
        const lid = layer?.get("layerId");
        if (lid && layer.get("bmKind") === "geojson") {
          hit = true;
          const props = { ...feature.getProperties() };
          delete props.geometry;
          s.dotNetRef.invokeMethodAsync("ReportGeoJsonFeatureClick", lid, props);
          return true;
        }
        if (lid) {
          hit = true;
          const ll = ol.toLonLat(evt.coordinate);
          const kind = layer.get("bmVectorKind") || "vector";
          s.dotNetRef.invokeMethodAsync("ReportVectorClick", lid, kind, { lat: ll[1], lng: ll[0] });
          return true;
        }
        return false;
      },
      { hitTolerance: 6 }
    );
    if (!hit) {
      const ll = ol.toLonLat(evt.coordinate);
      s.dotNetRef.invokeMethodAsync("ReportMapClick", { lat: ll[1], lng: ll[0] });
    }
  });

  map.on("dblclick", (evt) => {
    const ll = ol.toLonLat(evt.coordinate);
    s.dotNetRef.invokeMethodAsync("ReportMapDoubleClick", { lat: ll[1], lng: ll[0] });
  });

  map.on("moveend", () => notifyView(s));

  map.on("pointermove", (evt) => {
    for (const entry of s.markers.values()) {
      if (!entry.tooltipHover || !entry.tooltipOverlay || !entry.tooltipEl) continue;
      let onThis = false;
      map.forEachFeatureAtPixel(
        evt.pixel,
        (feat) => {
          if (feat === entry.feature) onThis = true;
          return onThis;
        },
        { layerFilter: (ly) => ly === s.markerLayer, hitTolerance: 8 }
      );
      entry.tooltipEl.style.display = onThis ? "block" : "none";
      if (onThis) entry.tooltipOverlay.setPosition(entry.feature.getGeometry().getCoordinates());
    }
  });
}

export async function initMap(mapId, element, dotNetRef, options) {
  const ol = await loadOlModules();

  const o = options || {};
  const [lng0, lat0] = readCenterLonLat(o);
  const zoom = pick(o, "zoom", "Zoom") ?? 13;

  const baseTile = new ol.TileLayer({
    source: new ol.XYZ({
      url: normalizeTileUrl(
        pick(o, "tileUrl", "TileUrl") || "https://tile.openstreetmap.org/{z}/{x}/{y}.png"
      ),
      maxZoom: pick(o, "tileMaxZoom", "TileMaxZoom") ?? 19,
      attributions: pick(o, "tileAttribution", "TileAttribution") || "&copy; OpenStreetMap contributors",
    }),
    opacity: pick(o, "tileOpacity", "TileOpacity") ?? 1,
  });

  // Pass view options inside a Promise, not `new View(...)`: each esm.sh ?bundle chunk
  // carries its own View class, so `instanceof View` inside Map fails and OL treats a
  // concrete View as a Promise and calls `.then` (runtime error).
  const viewInit = Promise.resolve({
    center: ol.fromLonLat([lng0, lat0]),
    zoom,
    minZoom: pick(o, "minZoom", "MinZoom") ?? undefined,
    maxZoom: pick(o, "maxZoom", "MaxZoom") ?? undefined,
  });

  const attributionOn = pick(o, "attributionControl", "AttributionControl") !== false;
  const zoomOn = pick(o, "zoomControl", "ZoomControl") !== false;

  const map = new ol.Map({
    target: element,
    layers: [baseTile],
    view: viewInit,
    controls: ol.defaults({
      attribution: attributionOn,
      zoom: zoomOn,
      rotate: false,
    }),
  });

  const markerSource = new ol.VectorSource();
  const markerLayer = new ol.VectorLayer({
    source: markerSource,
    zIndex: 900,
  });
  markerLayer.set("isMarkerLayer", true);
  map.addLayer(markerLayer);

  const popupEl = document.createElement("div");
  popupEl.className = "blazor-map-ol-popup";
  popupEl.style.cssText =
    "background:#fff;border:1px solid #ccc;border-radius:4px;padding:6px 8px;min-width:120px;box-shadow:0 2px 8px rgba(0,0,0,.2);";
  const popupOverlay = new ol.Overlay({
    element: popupEl,
    autoPan: { animation: { duration: 200 } },
  });
  map.addOverlay(popupOverlay);

  const draggableFeatures = new ol.Collection();
  const translate = new ol.Translate({ features: draggableFeatures });
  map.addInteraction(translate);
  translate.on("translateend", (e) => {
    const moved = e.features.getArray();
    for (const f of moved) {
      const id = f.get("markerId");
      if (!id) continue;
      const c = f.getGeometry().getCoordinates();
      const ll = ol.toLonLat(c);
      dotNetRef.invokeMethodAsync("ReportMarkerDragEnd", id, { lat: ll[1], lng: ll[0] });
    }
  });

  const state = {
    ol,
    map,
    dotNetRef,
    baseTileLayer: baseTile,
    markers: new Map(),
    layers: new Map(),
    tileOverlays: new Map(),
    markerSource,
    markerLayer,
    popupOverlay,
    popupEl,
    draggableFeatures,
    translate,
    scaleLine: null,
    zIndexCounter: 100,
  };

  await Promise.resolve();
  const mapView = map.getView();
  const ext = readBoundsExtent(ol, o);
  if (ext) mapView.set("extent", ext);

  applyInteractionToggles(state, o);
  ensureScaleLine(state, o);
  wireMapEvents(state);

  maps.set(mapId, state);
  queueMicrotask(() => {
    map.updateSize();
    notifyView(state);
  });
  return mapId;
}

export function syncMapOptions(mapId, o) {
  const s = getState(mapId);
  const view = s.map.getView();
  const ol = s.ol;
  const [lng0, lat0] = readCenterLonLat(o);
  const zoom = pick(o, "zoom", "Zoom");
  view.setCenter(ol.fromLonLat([lng0, lat0]));
  if (zoom !== undefined && zoom !== null) view.setZoom(zoom);

  const tUrl = normalizeTileUrl(pick(o, "tileUrl", "TileUrl"));
  const tAttr = pick(o, "tileAttribution", "TileAttribution");
  const tMax = pick(o, "tileMaxZoom", "TileMaxZoom");
  const tOp = pick(o, "tileOpacity", "TileOpacity");
  s.baseTileLayer.setSource(
    new ol.XYZ({
      url: tUrl || "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
      maxZoom: tMax ?? 19,
      attributions: tAttr || "&copy; OpenStreetMap contributors",
    })
  );
  s.baseTileLayer.setOpacity(tOp ?? 1);

  const ext = readBoundsExtent(ol, o);
  if (ext) view.set("extent", ext);
  else view.set("extent", undefined);

  const attributionOn = pick(o, "attributionControl", "AttributionControl") !== false;
  const zoomOn = pick(o, "zoomControl", "ZoomControl") !== false;
  s.map.getControls().clear();
  const defaultCtrls = ol.defaults({ attribution: attributionOn, zoom: zoomOn, rotate: false });
  defaultCtrls.getArray().forEach((c) => s.map.addControl(c));
  if (s.scaleLine) s.map.addControl(s.scaleLine);

  applyInteractionToggles(s, o);
  ensureScaleLine(s, o);
}

export function destroyMap(mapId) {
  const s = maps.get(mapId);
  if (!s) return;
  try {
    for (const tl of s.tileOverlays.values()) {
      s.map.removeLayer(tl);
    }
    s.tileOverlays.clear();
    if (s.scaleLine) s.map.removeControl(s.scaleLine);
    s.map.setTarget(null);
  } catch {
    /* ignore */
  }
  maps.delete(mapId);
}

export function invalidateSize(mapId) {
  const s = maps.get(mapId);
  if (!s) return;
  s.map.updateSize();
}

export function setView(mapId, lat, lng, zoom, animate) {
  const s = getState(mapId);
  const ol = s.ol;
  const view = s.map.getView();
  const z = zoom ?? view.getZoom() ?? 0;
  view.setCenter(ol.fromLonLat([lng, lat]));
  view.setZoom(z);
  if (animate === false) {
    /* OL animates some ops; immediate: */
    view.setCenter(ol.fromLonLat([lng, lat]));
    view.setZoom(z);
  }
}

export function fitBounds(mapId, swLat, swLng, neLat, neLng, paddingPx) {
  const s = getState(mapId);
  const ol = s.ol;
  const view = s.map.getView();
  const box = extent4326FromLngLatCorners(swLng, swLat, neLng, neLat);
  const extent = ol.transformExtent(box, "EPSG:4326", "EPSG:3857");
  const pad = paddingPx ?? 48;
  view.fit(extent, { padding: [pad, pad, pad, pad], maxZoom: 18, duration: 0 });
}

export function fitBoundsToMarkers(mapId, paddingPx) {
  const s = getState(mapId);
  const ext = s.markerSource.getExtent();
  if (!ext || !Number.isFinite(ext[0])) return;
  const pad = paddingPx ?? 48;
  s.map.getView().fit(ext, { padding: [pad, pad, pad, pad], maxZoom: 18, duration: 0 });
}

export function flyTo(mapId, lat, lng, zoom) {
  const s = getState(mapId);
  const ol = s.ol;
  const view = s.map.getView();
  view.animate({
    center: ol.fromLonLat([lng, lat]),
    zoom: zoom ?? view.getZoom(),
    duration: 1200,
  });
}

export function getView(mapId) {
  const s = getState(mapId);
  const ol = s.ol;
  const view = s.map.getView();
  const c3857 = view.getCenter();
  const c = c3857 ? ol.toLonLat(c3857) : [0, 0];
  const extent = view.calculateExtent(s.map.getSize());
  const sw = ol.toLonLat([extent[0], extent[1]]);
  const ne = ol.toLonLat([extent[2], extent[3]]);
  return {
    center: { lat: c[1], lng: c[0] },
    zoom: view.getZoom() ?? 0,
    bounds: {
      southWest: { lat: sw[1], lng: sw[0] },
      northEast: { lat: ne[1], lng: ne[0] },
    },
  };
}

export function addMarker(mapId, markerId, opts) {
  const s = getState(mapId);
  const ol = s.ol;
  const lat = pick(opts, "lat", "Lat") ?? pick(opts, "latitude", "Latitude");
  const lng = pick(opts, "lng", "Lng") ?? pick(opts, "longitude", "Longitude");
  const f = new ol.Feature({
    geometry: new ol.Point(ol.fromLonLat([lng, lat])),
    markerId,
    popupHtml: pick(opts, "popupHtml", "PopupHtml") || "",
    title: pick(opts, "title", "Title") || "",
    draggable: !!pick(opts, "draggable", "Draggable"),
    tooltipHtml: pick(opts, "tooltipHtml", "TooltipHtml") || "",
    tooltipPermanent: !!pick(opts, "tooltipPermanent", "TooltipPermanent"),
    tooltipDirection: pick(opts, "tooltipDirection", "TooltipDirection") || "auto",
  });
  f.setId(markerId);
  f.setStyle(markerStyleFromOpts(ol, opts));

  s.markerSource.addFeature(f);
  const entry = { feature: f, tooltipOverlay: null, tooltipEl: null, tooltipHover: false };
  s.markers.set(markerId, entry);

  if (f.get("draggable")) {
    s.draggableFeatures.push(f);
  }

  const tip = f.get("tooltipHtml");
  if (tip) {
    const el = document.createElement("div");
    el.className = "blazor-map-ol-tooltip";
    el.innerHTML = tip;
    el.style.cssText =
      "background:rgba(0,0,0,.75);color:#fff;padding:2px 6px;border-radius:3px;font:12px system-ui;white-space:nowrap;";
    const ov = new ol.Overlay({
      element: el,
      offset: [0, -28],
      positioning: "bottom-center",
    });
    s.map.addOverlay(ov);
    ov.setPosition(f.getGeometry().getCoordinates());
    f.getGeometry().on("change", () => ov.setPosition(f.getGeometry().getCoordinates()));
    entry.tooltipOverlay = ov;
    entry.tooltipEl = el;
    if (!f.get("tooltipPermanent")) {
      el.style.display = "none";
      entry.tooltipHover = true;
    }
  }
}

export function removeMarker(mapId, markerId) {
  const s = maps.get(mapId);
  if (!s) return;
  const entry = s.markers.get(markerId);
  if (!entry) return;
  try {
    s.markerSource.removeFeature(entry.feature);
    s.draggableFeatures.remove(entry.feature);
  } catch {
    /* ignore */
  }
  if (entry.tooltipOverlay) s.map.removeOverlay(entry.tooltipOverlay);
  s.markers.delete(markerId);
}

export function clearMarkers(mapId) {
  const s = maps.get(mapId);
  if (!s) return;
  for (const e of s.markers.values()) {
    if (e.tooltipOverlay) s.map.removeOverlay(e.tooltipOverlay);
    try {
      s.draggableFeatures.remove(e.feature);
    } catch {
      /* ignore */
    }
  }
  s.markers.clear();
  s.markerSource.clear();
}

export function setMarkerLatLng(mapId, markerId, lat, lng) {
  const s = maps.get(mapId);
  if (!s) return;
  const e = s.markers.get(markerId);
  if (!e) return;
  e.feature.getGeometry().setCoordinates(s.ol.fromLonLat([lng, lat]));
}

export function openMarkerPopup(mapId, markerId) {
  const s = maps.get(mapId);
  if (!s) return;
  const e = s.markers.get(markerId);
  if (!e) return;
  const html = e.feature.get("popupHtml");
  if (!html) return;
  s.popupEl.innerHTML = html;
  s.popupOverlay.setPosition(e.feature.getGeometry().getCoordinates());
}

export function addPolyline(mapId, layerId, latlngs, style) {
  const s = getState(mapId);
  const ol = s.ol;
  const coords = to3857Coords(ol, latlngs);
  const f = new ol.Feature({ geometry: new ol.LineString(coords) });
  const ps = pathStyle(ol, style);
  f.setStyle(
    new ol.Style({
      stroke: ps.stroke,
    })
  );
  const src = new ol.VectorSource({ features: [f] });
  const layer = new ol.VectorLayer({
    source: src,
    zIndex: ++s.zIndexCounter,
  });
  layer.set("layerId", layerId);
  layer.set("bmVectorKind", "polyline");
  s.map.addLayer(layer);
  s.layers.set(layerId, layer);
}

export function addPolygon(mapId, layerId, latlngs, style) {
  const s = getState(mapId);
  const ol = s.ol;
  const ring = to3857Coords(ol, latlngs);
  if (ring.length && (ring[0][0] !== ring[ring.length - 1][0] || ring[0][1] !== ring[ring.length - 1][1])) {
    ring.push(ring[0]);
  }
  const f = new ol.Feature({ geometry: new ol.Polygon([ring]) });
  const ps = pathStyle(ol, style);
  f.setStyle(
    new ol.Style({
      stroke: ps.stroke,
      fill: ps.fill,
    })
  );
  const src = new ol.VectorSource({ features: [f] });
  const layer = new ol.VectorLayer({
    source: src,
    zIndex: ++s.zIndexCounter,
  });
  layer.set("layerId", layerId);
  layer.set("bmVectorKind", "polygon");
  s.map.addLayer(layer);
  s.layers.set(layerId, layer);
}

export function addCircle(mapId, layerId, lat, lng, radiusMeters, style) {
  const s = getState(mapId);
  const ol = s.ol;
  const ring = circleRing3857(ol, lat, lng, radiusMeters);
  const f = new ol.Feature({ geometry: new ol.Polygon([ring]) });
  const ps = pathStyle(ol, style);
  f.setStyle(
    new ol.Style({
      stroke: ps.stroke,
      fill: ps.fill,
    })
  );
  const src = new ol.VectorSource({ features: [f] });
  const layer = new ol.VectorLayer({
    source: src,
    zIndex: ++s.zIndexCounter,
  });
  layer.set("layerId", layerId);
  layer.set("bmVectorKind", "circle");
  s.map.addLayer(layer);
  s.layers.set(layerId, layer);
}

export function addRectangle(mapId, layerId, swLat, swLng, neLat, neLng, style) {
  const consts = getState(mapId);
  const ol = consts.ol;
  const ring = [
    ol.fromLonLat([swLng, swLat]),
    ol.fromLonLat([neLng, swLat]),
    ol.fromLonLat([neLng, neLat]),
    ol.fromLonLat([swLng, neLat]),
    ol.fromLonLat([swLng, swLat]),
  ];
  const f = new ol.Feature({ geometry: new ol.Polygon([ring]) });
  const ps = pathStyle(ol, style);
  f.setStyle(
    new ol.Style({
      stroke: ps.stroke,
      fill: ps.fill,
    })
  );
  const src = new ol.VectorSource({ features: [f] });
  const layer = new ol.VectorLayer({
    source: src,
    zIndex: ++consts.zIndexCounter,
  });
  layer.set("layerId", layerId);
  layer.set("bmVectorKind", "rectangle");
  consts.map.addLayer(layer);
  consts.layers.set(layerId, layer);
}

export function addGeoJson(mapId, layerId, geoJsonString, style) {
  const s = getState(mapId);
  const ol = s.ol;
  let gj;
  try {
    gj = JSON.parse(geoJsonString);
  } catch {
    throw new Error("Invalid GeoJSON string");
  }
  const fmt = new ol.GeoJSON();
  const features = fmt.readFeatures(gj, {
    dataProjection: "EPSG:4326",
    featureProjection: "EPSG:3857",
  });
  const ps = pathStyle(ol, style);
  const styleFn = (feature) => {
    const g = feature.getGeometry();
    const t = g.getType();
    if (t === "LineString" || t === "MultiLineString") {
      return new ol.Style({ stroke: ps.stroke });
    }
    return new ol.Style({ stroke: ps.stroke, fill: ps.fill });
  };
  const src = new ol.VectorSource({ features });
  const layer = new ol.VectorLayer({
    source: src,
    style: styleFn,
    zIndex: ++s.zIndexCounter,
  });
  layer.set("layerId", layerId);
  layer.set("bmKind", "geojson");
  s.map.addLayer(layer);
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
  const ol = s.ol;
  const id = pick(opts, "id", "Id");
  const url = normalizeTileUrl(pick(opts, "urlTemplate", "UrlTemplate"));
  const tl = new ol.TileLayer({
    source: new ol.XYZ({
      url,
      maxZoom: pick(opts, "maxZoom", "MaxZoom") ?? 19,
      attributions: pick(opts, "attribution", "Attribution") || "",
    }),
    opacity: pick(opts, "opacity", "Opacity") ?? 1,
    zIndex: pick(opts, "zIndex", "ZIndex") ?? 100,
  });
  s.map.addLayer(tl);
  tl.set("overlayId", id);
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
