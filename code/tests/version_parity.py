"""Gate 1 of ADR-0006: the three manifests of a project carry one version.

For each project in `.release-please-manifest.json`, the Dart, TypeScript and Python manifests (and
the root entries of the npm lockfile) must agree with each other and with the release-please
manifest. release-please writes all of them in one commit, so on its own pull requests this holds by
construction; the gate is there for the hand edit that does not.

Usage, from the repository root:

    python code/tests/version_parity.py

docs-ui has its own manifest, `.release-please-manifest.docs-ui.json`; its package.json is checked
against it.

Exits non-zero, listing every mismatch, when a project disagrees with itself.
"""

from __future__ import annotations

import json
import re
import sys
import tomllib
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
MANIFESTS = (".release-please-manifest.json", ".release-please-manifest.docs-ui.json")

# `version: 0.7.1 # x-release-please-version` — the annotation is what the generic updater targets.
PUBSPEC_VERSION = re.compile(r"^version:\s*([^\s#]+)", re.MULTILINE)


def sdk_versions(project: Path) -> dict[str, str | None]:
    pubspec = (project / "dart" / "pubspec.yaml").read_text(encoding="utf-8")
    match = PUBSPEC_VERSION.search(pubspec)
    package = json.loads((project / "ts" / "package.json").read_text(encoding="utf-8"))
    lock = json.loads((project / "ts" / "package-lock.json").read_text(encoding="utf-8"))
    pyproject = tomllib.loads((project / "py" / "pyproject.toml").read_text(encoding="utf-8"))
    return {
        "dart/pubspec.yaml": match.group(1) if match else None,
        "ts/package.json": package.get("version"),
        "ts/package-lock.json ($.version)": lock.get("version"),
        "ts/package-lock.json ($.packages[''].version)": lock.get("packages", {}).get("", {}).get("version"),
        "py/pyproject.toml": pyproject.get("project", {}).get("version"),
    }


def node_versions(project: Path) -> dict[str, str | None]:
    package = json.loads((project / "package.json").read_text(encoding="utf-8"))
    return {"package.json": package.get("version")}


def main() -> int:
    manifest: dict[str, str] = {}
    for name in MANIFESTS:
        manifest.update(json.loads((ROOT / name).read_text(encoding="utf-8")))
    failures: list[str] = []

    for path, expected in manifest.items():
        project = ROOT / path
        is_sdk = (project / "dart").is_dir() and (project / "ts").is_dir() and (project / "py").is_dir()
        found = sdk_versions(project) if is_sdk else node_versions(project)
        wrong = {file: version for file, version in found.items() if version != expected}
        if wrong:
            for file, version in wrong.items():
                failures.append(f"{path}/{file}: {version} (manifest says {expected})")
        else:
            print(f"ok    {path} {expected}")

    if failures:
        print("\nVersion parity broken:", file=sys.stderr)
        for failure in failures:
            print(f"  {failure}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
