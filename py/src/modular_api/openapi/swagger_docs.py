"""Docs UI handler — serves the ``@macss/docs-ui`` widget from CDN.

Loads ``@macss/docs-ui`` from jsdelivr CDN, which wraps Swagger UI with
system-aware dark mode.  The local ``/openapi.json`` endpoint provides
the spec.  Styling, dark mode, and Swagger UI loading are handled
entirely by docs-ui — no inline CSS or JS in this template.

See: https://github.com/macss-dev/modular_api/tree/main/docs-ui
"""

from __future__ import annotations

from starlette.requests import Request
from starlette.responses import HTMLResponse

_DOCS_UI_CDN = "https://cdn.jsdelivr.net/npm/@macss/docs-ui@0.1/dist"

# {title} is the only placeholder — str.replace() is a literal match,
# so JavaScript braces pass through unaffected.
_DOCS_UI_HTML_TEMPLATE = """\
<!DOCTYPE html>
<html>
  <head>
    <title>{title} — API Reference</title>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <link rel="stylesheet" href=""" + f'"{_DOCS_UI_CDN}/docs-ui.css"' + """ />
  </head>
  <body>
    <div id="swagger-ui"></div>
    <script src=""" + f'"{_DOCS_UI_CDN}/docs-ui.js"' + """></script>
    <script>DocsUI.init({ specUrl: "/openapi.json" })</script>
  </body>
</html>"""


def swagger_docs_handler(*, title: str) -> object:
    """Return a Starlette endpoint that serves a docs-ui HTML page.

    Usage::

        Route("/docs", endpoint=swagger_docs_handler(title="My API"))
    """
    html = _DOCS_UI_HTML_TEMPLATE.replace("{title}", title)

    async def _endpoint(request: Request) -> HTMLResponse:
        return HTMLResponse(html)

    return _endpoint
