/**
 * @macss/docs-ui — Self-contained API documentation widget.
 *
 * Wraps Swagger UI with system-aware dark mode (prefers-color-scheme).
 * Loads swagger-ui-dist@5 from jsdelivr CDN at runtime — no install needed
 * in the consuming project.
 *
 * Usage from a `<script>` tag (IIFE build):
 *
 *   <script src="https://cdn.jsdelivr.net/npm/@macss/docs-ui@0.1/dist/docs-ui.js"></script>
 *   <script>DocsUI.init({ specUrl: "/openapi.json" })</script>
 */

import './docs-ui.css';

const SWAGGER_UI_CDN = 'https://cdn.jsdelivr.net/npm/swagger-ui-dist@5';

/**
 * Initialise the API documentation widget.
 *
 * Dynamically loads the Swagger UI stylesheet and JS bundle from the
 * jsdelivr CDN, then creates a SwaggerUIBundle instance pointed at the
 * given spec URL.
 *
 * @param {object}  options
 * @param {string}  [options.specUrl='/openapi.json']  URL of the OpenAPI spec.
 * @param {string}  [options.element='#swagger-ui']    CSS selector of the mount point.
 */
export function init({ specUrl = '/openapi.json', element = '#swagger-ui' } = {}) {
  loadStylesheet(`${SWAGGER_UI_CDN}/swagger-ui.css`);

  loadScript(`${SWAGGER_UI_CDN}/swagger-ui-bundle.js`).then(() => {
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
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = href;
  document.head.appendChild(link);
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
