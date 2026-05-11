/**
 * Load external scripts and stylesheets once (deduped by URL).
 * Used by map provider modules so host apps do not need index.html tags.
 *
 * Design notes:
 * - loadScript deliberately does NOT check the DOM before appending a new
 *   element.  A DOM check for an existing-but-failed element would return
 *   Promise.resolve() even though the script never executed, leaving the
 *   expected global (window.L, window.mapboxgl, …) unset.
 * - Rejected promises are evicted from the cache so the next navigation can
 *   retry the load rather than replaying the same stale error forever.
 * - resetScript() removes both the cache entry and every <script> tag for
 *   the given URL so the next loadScript() call makes a completely fresh
 *   attempt — call it when post-load verification of a global fails.
 */

const scriptPromises = new Map();
const stylePromises = new Map();

export function loadStylesheet(href) {
  if (!href) return Promise.resolve();
  let p = stylePromises.get(href);
  if (p) return p;
  // Stylesheet already in DOM — avoid a duplicate <link> element.
  if (document.querySelector(`link[rel="stylesheet"][href="${href}"]`)) {
    p = Promise.resolve();
    stylePromises.set(href, p);
    return p;
  }
  p = new Promise((resolve, reject) => {
    const el = document.createElement("link");
    el.rel = "stylesheet";
    el.href = href;
    el.onload = () => resolve();
    el.onerror = () => reject(new Error(`Failed to load stylesheet: ${href}`));
    document.head.appendChild(el);
  });
  p = p.catch(err => { stylePromises.delete(href); throw err; });
  stylePromises.set(href, p);
  return p;
}

export function loadScript(src) {
  if (!src) return Promise.resolve();
  let p = scriptPromises.get(src);
  if (p) return p;
  p = new Promise((resolve, reject) => {
    // Leaflet, MapLibre and Mapbox GL all use the UMD pattern:
    //   typeof define === 'function' && define.amd ? define([…], factory) : (global.L = …)
    // ArcGIS Maps SDK 5.0 installs globalThis.define (a compat surface for its
    // module system).  If define.amd is truthy the UMD picks the AMD branch and
    // NEVER writes window.L / window.maplibregl / window.mapboxgl.
    // Fix: zero out define.amd before the element is appended so the UMD code
    // sees a falsy value and falls through to the browser-global branch.
    // Restore happens in onload/onerror, which fire only AFTER script execution.
    const hasDef = typeof globalThis.define === 'function';
    const savedAmd = hasDef ? globalThis.define.amd : null;
    if (hasDef && savedAmd) globalThis.define.amd = undefined;

    const el = document.createElement("script");
    el.src = src;
    el.async = true;
    el.onload = () => {
      if (hasDef && savedAmd) globalThis.define.amd = savedAmd;
      resolve();
    };
    el.onerror = () => {
      if (hasDef && savedAmd) globalThis.define.amd = savedAmd;
      reject(new Error(`Failed to load script: ${src}`));
    };
    document.head.appendChild(el);
  });
  p = p.catch(err => { scriptPromises.delete(src); throw err; });
  scriptPromises.set(src, p);
  return p;
}

/**
 * Clear the cached promise AND remove every <script> tag for `src` from the
 * DOM so that the next loadScript() call starts completely from scratch.
 * Call this when loadScript() resolves but the expected global is still unset
 * (CDN served wrong content, execution error, etc.).
 */
export function resetScript(src) {
  scriptPromises.delete(src);
  document.querySelectorAll(`script[src="${src}"]`).forEach(el => el.remove());
}
