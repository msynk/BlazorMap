/**
 * Load external scripts and stylesheets once (deduped by URL).
 * Used by map provider modules so host apps do not need index.html tags.
 */

const scriptPromises = new Map();
const stylePromises = new Map();

export function loadStylesheet(href) {
  if (!href) return Promise.resolve();
  let p = stylePromises.get(href);
  if (p) return p;
  p = new Promise((resolve, reject) => {
    const el = document.createElement("link");
    el.rel = "stylesheet";
    el.href = href;
    el.onload = () => resolve();
    el.onerror = () => reject(new Error(`Failed to load stylesheet: ${href}`));
    document.head.appendChild(el);
  });
  stylePromises.set(href, p);
  return p;
}

export function loadScript(src) {
  if (!src) return Promise.resolve();
  let p = scriptPromises.get(src);
  if (p) return p;
  p = new Promise((resolve, reject) => {
    const el = document.createElement("script");
    el.src = src;
    el.async = true;
    el.crossOrigin = "anonymous";
    el.onload = () => resolve();
    el.onerror = () => reject(new Error(`Failed to load script: ${src}`));
    document.head.appendChild(el);
  });
  scriptPromises.set(src, p);
  return p;
}
