/**
 * Swagger UI docs handler — serves an HTML page with the Swagger UI widget.
 *
 * Loads `swagger-ui-dist@5` from jsdelivr CDN and points it at the local
 * `/openapi.json` endpoint.  No server-side dependencies; no npm packages
 * required.
 *
 * Canonical HTML payload defined in PRD-003.
 */

import type { RequestHandler } from 'express';

const SWAGGER_UI_HTML_TEMPLATE = `<!DOCTYPE html>
<html>
  <head>
    <title>{{title}} — API Reference</title>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <link
      rel="stylesheet"
      href="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui.css"
    />
    <style>
      /* ── Light mode baseline (Swagger UI default) ───────────── */
      :root {
        --bg-primary:   #ffffff;
        --bg-secondary: #f7f7f7;
        --bg-block:     #ffffff;
        --border-color: #e8e8e8;
        --text-primary: #3b4151;
        --text-muted:   #6b7280;
        --input-bg:     #ffffff;
        --input-text:   #3b4151;
        --input-border: #d9d9d9;
      }

      /* ── Dark mode overrides ───────────────────────────── */
      @media (prefers-color-scheme: dark) {
        :root {
          --bg-primary:   #1a1a1a;
          --bg-secondary: #222222;
          --bg-block:     #2a2a2a;
          --border-color: #3a3a3a;
          --text-primary: #e0e0e0;
          --text-muted:   #a0a0a0;
          --input-bg:     #2a2a2a;
          --input-text:   #e0e0e0;
          --input-border: #444444;
        }

        body {
          background-color: var(--bg-primary);
        }

        /* ── General text ──────────────────────────────── */
        .swagger-ui,
        .swagger-ui .info .title,
        .swagger-ui .info p,
        .swagger-ui .info li,
        .swagger-ui .info a,
        .swagger-ui .opblock-tag,
        .swagger-ui .opblock-tag small,
        .swagger-ui table thead tr td,
        .swagger-ui table thead tr th,
        .swagger-ui .response-col_status,
        .swagger-ui .response-col_description,
        .swagger-ui .parameter__name,
        .swagger-ui .parameter__type,
        .swagger-ui .parameter__in,
        .swagger-ui .tab li,
        .swagger-ui .model-title,
        .swagger-ui .model,
        .swagger-ui .prop-type,
        .swagger-ui .prop-format {
          color: var(--text-primary);
        }

        /* ── Backgrounds ───────────────────────────────── */
        .swagger-ui .wrapper,
        .swagger-ui .scheme-container,
        .swagger-ui section.models,
        .swagger-ui section.models .model-container,
        .swagger-ui .model-box {
          background: var(--bg-secondary);
          border-color: var(--border-color);
        }

        /* ── Operation blocks ────────────────────────────── */
        .swagger-ui .opblock {
          background: var(--bg-block);
          border-color: var(--border-color);
          box-shadow: none;
        }

        .swagger-ui .opblock .opblock-summary {
          background: var(--bg-block);
          border-color: var(--border-color);
        }

        .swagger-ui .opblock .opblock-section-header {
          background: var(--bg-secondary);
          border-color: var(--border-color);
        }

        .swagger-ui .opblock .opblock-section-header h4 {
          color: var(--text-primary);
        }

        /* HTTP method accent colors preserved in dark mode */
        .swagger-ui .opblock.opblock-post   { border-color: #49cc90; }
        .swagger-ui .opblock.opblock-get    { border-color: #61affe; }
        .swagger-ui .opblock.opblock-put    { border-color: #fca130; }
        .swagger-ui .opblock.opblock-delete { border-color: #f93e3e; }
        .swagger-ui .opblock.opblock-patch  { border-color: #50e3c2; }

        .swagger-ui .opblock.opblock-post   .opblock-summary-method { background: #49cc90; }
        .swagger-ui .opblock.opblock-get    .opblock-summary-method { background: #61affe; }
        .swagger-ui .opblock.opblock-put    .opblock-summary-method { background: #fca130; }
        .swagger-ui .opblock.opblock-delete .opblock-summary-method { background: #f93e3e; }
        .swagger-ui .opblock.opblock-patch  .opblock-summary-method { background: #50e3c2; }

        /* ── Inputs and controls ─────────────────────────── */
        .swagger-ui input[type=text],
        .swagger-ui input[type=password],
        .swagger-ui input[type=search],
        .swagger-ui input[type=email],
        .swagger-ui textarea,
        .swagger-ui select {
          background: var(--input-bg);
          color: var(--input-text);
          border-color: var(--input-border);
        }

        /* ── Buttons ───────────────────────────────────── */
        .swagger-ui .btn {
          background: var(--bg-block);
          color: var(--text-primary);
          border-color: var(--border-color);
        }

        .swagger-ui .btn.execute {
          background: #4a90e2;
          color: #ffffff;
          border-color: #4a90e2;
        }

        .swagger-ui .btn.authorize {
          color: #49cc90;
          border-color: #49cc90;
        }

        /* ── Response area ─────────────────────────────── */
        .swagger-ui .responses-inner,
        .swagger-ui .response-col_description__inner {
          background: var(--bg-secondary);
          color: var(--text-primary);
        }

        .swagger-ui .highlight-code,
        .swagger-ui .microlight {
          background: #111111 !important;
          color: #e0e0e0 !important;
        }

        /* ── Topbar ────────────────────────────────────── */
        .swagger-ui .topbar {
          background-color: #111111;
        }

        /* ── Expand/collapse arrows ──────────────────────── */
        .swagger-ui .expand-methods svg,
        .swagger-ui .expand-operation svg {
          fill: var(--text-muted);
        }

        /* ── Filter input ──────────────────────────────── */
        .swagger-ui .filter .operation-filter-input {
          background: var(--input-bg);
          color: var(--input-text);
          border-color: var(--input-border);
        }

        /* ── Scrollbar (webkit) ──────────────────────────── */
        ::-webkit-scrollbar { width: 8px; height: 8px; }
        ::-webkit-scrollbar-track { background: var(--bg-primary); }
        ::-webkit-scrollbar-thumb { background: #444444; border-radius: 4px; }
        ::-webkit-scrollbar-thumb:hover { background: #555555; }
      }
    </style>
  </head>
  <body>
    <div id="swagger-ui"></div>
    <script src="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui-bundle.js">
    </script>
    <script>
      SwaggerUIBundle({
        url: "/openapi.json",
        dom_id: "#swagger-ui",
        presets: [
          SwaggerUIBundle.presets.apis,
          SwaggerUIBundle.SwaggerUIStandalonePreset
        ],
        layout: "BaseLayout",
        deepLinking: true
      })
    </script>
  </body>
</html>`;

/**
 * Returns an Express handler that serves the Swagger UI HTML.
 *
 * Usage:
 * ```ts
 * app.get('/docs', swaggerDocsHandler({ title: 'My API' }));
 * ```
 */
export function swaggerDocsHandler(options: { title: string }): RequestHandler {
  const html = SWAGGER_UI_HTML_TEMPLATE.replace('{{title}}', options.title);

  return (_req, res) => {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  };
}
