/**
 * @macss/docs-ui — Self-contained API documentation widget.
 *
 * Wraps Swagger UI with system-aware dark mode (prefers-color-scheme).
 * Loads swagger-ui-dist@5 from jsdelivr CDN at runtime — no install needed
 * in the consuming project.
 *
 * CSS is embedded in this module and injected AFTER swagger-ui.css loads,
 * guaranteeing that dark-mode overrides win in the cascade.  A single
 * `<script>` tag is all the consumer needs — no separate CSS `<link>`.
 *
 * Usage from a `<script>` tag (IIFE build):
 *
 *   <script src="https://cdn.jsdelivr.net/npm/@macss/docs-ui@0.1/dist/docs-ui.js"></script>
 *   <script>DocsUI.init({ specUrl: "/openapi.json" })</script>
 */

// Vite inlines the CSS as a raw string at build time (no separate .css file).
import cssText from './docs-ui.css?inline';

const SWAGGER_UI_CDN = 'https://cdn.jsdelivr.net/npm/swagger-ui-dist@5';

/**
 * Initialise the API documentation widget.
 *
 * Loads the Swagger UI stylesheet first, then injects the docs-ui dark-mode
 * overrides so they take precedence in the cascade.  Finally loads the
 * Swagger UI JS bundle and creates the instance.
 *
 * @param {object}  options
 * @param {string}  [options.specUrl='/openapi.json']  URL of the OpenAPI spec.
 * @param {string}  [options.element='#swagger-ui']    CSS selector of the mount point.
 */
export function init({ specUrl = '/openapi.json', element = '#swagger-ui' } = {}) {
  // 1. Load swagger-ui.css from CDN.
  // 2. Once loaded, inject our overrides AFTER it (cascade order wins).
  // 3. Load the JS bundle and initialise.
  loadStylesheet(`${SWAGGER_UI_CDN}/swagger-ui.css`).then(() => {
    injectStyles(cssText);

    return loadScript(`${SWAGGER_UI_CDN}/swagger-ui-bundle.js`);
  }).then(() => {
    SwaggerUIBundle({
      url: specUrl,
      dom_id: element,
      presets: [
        SwaggerUIBundle.presets.apis,
        SwaggerUIBundle.SwaggerUIStandalonePreset,
      ],
      layout: 'BaseLayout',
      deepLinking: true,
    });
  });
}

/* ── Private helpers ─────────────────────────────────────── */

function loadStylesheet(href) {
  return new Promise((resolve, reject) => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    link.onload = resolve;
    link.onerror = reject;
    document.head.appendChild(link);
  });
}

function injectStyles(css) {
  const style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);
}

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = src;
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });
}
