"""`info.version` must reflect the `version` given to `ModularApi` (#38).

Two instances with different versions must produce different documents: a test that checks a single
value would also pass with the field hard-coded to that value.
"""

from __future__ import annotations

import re

import pytest
from starlette.testclient import TestClient

from modular_api import ModularApi


@pytest.mark.parametrize("version", ["2.0.0", "9.9.9"])
def test_openapi_documents_carry_the_configured_version(version: str) -> None:
    client = TestClient(ModularApi(base_path="/api", title="Versioned", version=version).build())

    spec = client.get("/api/openapi.json")
    assert spec.status_code == 200
    assert spec.json()["info"]["version"] == version

    yaml = client.get("/api/openapi.yaml")
    assert yaml.status_code == 200
    assert re.search(rf'^  version: "?{re.escape(version)}"?$', yaml.text, re.MULTILINE)
