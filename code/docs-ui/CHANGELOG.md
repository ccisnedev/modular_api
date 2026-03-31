# Changelog
All notable changes to this project will be documented in this file.

The format loosely follows [Keep a Changelog](https://keepachangelog.com/)
and the project adheres to [Semantic Versioning](https://semver.org/).

## 0.1.1 — 2026-03-14

### Fixed

- Text legibility in dark mode — added missing selectors for endpoint path, summary
  description, operation description, "No parameters", "Links" column, and rendered
  Markdown paragraphs.
- CSS cascade order — embed styles in JS bundle and inject after swagger-ui.css
  to guarantee dark-mode overrides win.
- Servers box layout — constrain `.scheme-container` to `max-width: 1460px` so it
  aligns with the info header and operation blocks.

## 0.1.0 — 2026-03-14

First release. Extracts the duplicated Swagger UI HTML/CSS/JS from the three
SDK servers (Dart, TypeScript, Python) into a single, standalone web package.

### Added
- `DocsUI.init({ specUrl, element })` — bootstraps Swagger UI with a single call.
- System-aware dark mode via `@media (prefers-color-scheme: dark)`.
- Custom CSS variables for light/dark theming (`--bg-primary`, `--text-primary`, etc.).
- Dark-mode overrides for operation blocks, inputs, buttons, code blocks,
  response area, models section, and scrollbar.
- HTTP method accent colors preserved in dark mode (POST green, GET blue,
  PUT orange, DELETE red, PATCH teal).
- Vite library-mode build producing a single IIFE file (`dist/docs-ui.js`,
  ~4.6 kB / gzip ~1.3 kB) with CSS embedded.
- Swagger UI dist@5 loaded at runtime from jsdelivr CDN.
- Development page (`index.html`) with `?specUrl=` query-param support.
- Sample OpenAPI spec (`sample-spec.json`) for local development.
- 8 unit tests covering CSS content, JS exports, and build output.

### Changed
- SDK bootloaders reduced from ~200 lines of inline HTML to ~15-line
  templates that load `docs-ui.js` from CDN.