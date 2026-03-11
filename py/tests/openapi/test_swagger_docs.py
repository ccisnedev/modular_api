"""Tests for the Swagger UI docs handler (PRD-003).

Validates that /docs serves a self-contained Swagger UI page loaded from
the swagger-ui-dist@5 CDN — replacing the previous Scalar widget.
"""

from starlette.routing import Route
from starlette.testclient import TestClient

from modular_api.openapi.swagger_docs import swagger_docs_handler


class TestSwaggerDocsHandler:
    """GET /docs returns an HTML page embedding Swagger UI from CDN."""

    def _client(self, *, title: str = "My API") -> TestClient:
        endpoint = swagger_docs_handler(title=title)
        app = Route("/docs", endpoint=endpoint)
        return TestClient(app)

    # --- HTTP basics ---

    def test_returns_200(self) -> None:
        response = self._client().get("/docs")
        assert response.status_code == 200

    def test_content_type_is_html(self) -> None:
        response = self._client().get("/docs")
        assert "text/html" in response.headers["content-type"]

    # --- Swagger UI CDN assets ---

    def test_swagger_ui_css_from_cdn(self) -> None:
        """PRD-003: must load swagger-ui-dist@5 stylesheet."""
        response = self._client().get("/docs")
        assert "swagger-ui-dist@5" in response.text
        assert ".css" in response.text

    def test_swagger_ui_js_bundle_from_cdn(self) -> None:
        """PRD-003: must load swagger-ui-bundle from swagger-ui-dist@5."""
        response = self._client().get("/docs")
        assert "swagger-ui-bundle.js" in response.text

    # --- Configuration ---

    def test_references_openapi_json(self) -> None:
        """Swagger UI must point at the local /openapi.json spec."""
        response = self._client().get("/docs")
        assert 'url: "/openapi.json"' in response.text

    def test_no_scalar_regression(self) -> None:
        """PRD-003 regression guard: Scalar must not appear anywhere."""
        response = self._client().get("/docs")
        assert "scalar" not in response.text.lower()

    # --- Title interpolation ---

    def test_title_interpolated_in_html(self) -> None:
        response = self._client(title="Pet Store").get("/docs")
        assert "Pet Store" in response.text

    # --- HTML validity ---

    def test_html_is_valid_document(self) -> None:
        response = self._client().get("/docs")
        assert response.text.strip().startswith("<!DOCTYPE html>")
        assert "</html>" in response.text

    # --- PRD-004: System-aware dark mode ---

    def test_dark_mode_media_query_present(self) -> None:
        """PRD-004: must include prefers-color-scheme media query."""
        response = self._client().get("/docs")
        assert "prefers-color-scheme: dark" in response.text

    def test_dark_mode_css_custom_properties(self) -> None:
        """PRD-004: must define --bg-primary CSS custom property."""
        response = self._client().get("/docs")
        assert "--bg-primary" in response.text

    def test_dark_mode_http_method_accent_colors(self) -> None:
        """PRD-004: must preserve HTTP POST accent color in dark mode."""
        response = self._client().get("/docs")
        assert "#49cc90" in response.text
