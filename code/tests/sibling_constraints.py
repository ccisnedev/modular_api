"""Gate 2 of ADR-0006: a project is not released with a constraint that excludes a sibling's version.

A sibling is another project of this repository. The dependencies on siblings are read from the
manifests themselves — `dependencies` in `pubspec.yaml`, `dependencies` and `peerDependencies` in
`package.json`, `project.dependencies` in `pyproject.toml` — so a new edge is checked without editing
this file.

Two rules, both on the version in `.release-please-manifest.json`:

1. A project being released must not declare a constraint on a sibling that excludes the sibling's
   version. This is the defect found while preparing 0.7.0: three packages still asked for `^0.6.0` of
   a sibling that was about to be 0.7.0.
2. A project being released must not get a version that the constraint of *any* in-repo dependent
   excludes, even a dependent that is not being released. This is what happened with `modular_api`
   0.8.0 and `modular_api_sqlserver ^0.7.0`: the plugin could not be installed next to the newest core.
   The dependent is released in the same Release PR by widening its constraint in a `fix(deps):` pull
   request first (ADR-0006 §6).

Usage, from the repository root:

    python code/tests/sibling_constraints.py --base origin/main   # projects whose version changes
    python code/tests/sibling_constraints.py                      # every project

With `--base`, only the edges that touch a project whose version in the release-please manifest
differs from `--base` are checked: on a Release PR, the ones it releases; on any other pull request,
none. A dependent may fall behind after a breaking release only until that Release PR: it cannot be
merged while the dependent still excludes the new version.

Exits non-zero, listing every violation, when either rule is broken.
"""

from __future__ import annotations

import argparse
import json
import re
import subprocess
import sys
import tomllib
from dataclasses import dataclass
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
MANIFEST = ".release-please-manifest.json"

VERSION = re.compile(r"^(\d+)\.(\d+)\.(\d+)$")
PEP508_NAME = re.compile(r"^\s*([A-Za-z0-9][A-Za-z0-9._-]*)\s*(?:\[[^\]]*\])?\s*(.*)$")


@dataclass(frozen=True)
class Edge:
    project: str
    language: str
    sibling: str
    constraint: str


def parse_version(text: str) -> tuple[int, int, int]:
    match = VERSION.match(text.strip())
    if not match:
        raise ValueError(f"not a plain x.y.z version: {text!r}")
    return int(match[1]), int(match[2]), int(match[3])


def caret_upper(lower: tuple[int, int, int]) -> tuple[int, int, int]:
    """The exclusive upper bound of `^lower`, with the same 0.x rule in pub, npm and this ADR."""
    major, minor, patch = lower
    if major > 0:
        return major + 1, 0, 0
    if minor > 0:
        return 0, minor + 1, 0
    return 0, 0, patch + 1


def admits(constraint: str, version: str) -> bool:
    """Whether a pub or npm constraint admits `version`.

    Supports what the manifests use and what a reviewer can read at a glance: `^x.y.z`, an exact
    `x.y.z`, and space-separated comparators such as `>=0.7.0 <0.9.0`. Anything else is refused, so a
    constraint this gate cannot read fails loudly instead of passing.
    """
    target = parse_version(version)
    text = constraint.strip().strip("'\"")
    if text.startswith("^"):
        lower = parse_version(text[1:])
        return lower <= target < caret_upper(lower)
    if VERSION.match(text):
        return parse_version(text) == target
    comparators = re.findall(r"(>=|<=|>|<|=)\s*(\d+\.\d+\.\d+)", text)
    if comparators and re.fullmatch(r"(\s*(>=|<=|>|<|=)\s*\d+\.\d+\.\d+\s*)+", text):
        checks = {
            ">=": lambda v: target >= v,
            "<=": lambda v: target <= v,
            ">": lambda v: target > v,
            "<": lambda v: target < v,
            "=": lambda v: target == v,
        }
        return all(checks[op](parse_version(v)) for op, v in comparators)
    raise ValueError(f"constraint this gate cannot read: {constraint!r}")


def admits_pep440(specifier: str, version: str) -> bool:
    """A PEP 440 specifier set such as `>=0.7.0,<0.8.0`; `~=` and wildcards are refused."""
    target = parse_version(version)
    if not specifier.strip():
        return True
    checks = {
        ">=": lambda v: target >= v,
        "<=": lambda v: target <= v,
        ">": lambda v: target > v,
        "<": lambda v: target < v,
        "==": lambda v: target == v,
        "!=": lambda v: target != v,
    }
    for part in specifier.split(";")[0].split(","):
        match = re.fullmatch(r"\s*(>=|<=|==|!=|>|<)\s*(\d+\.\d+\.\d+)\s*", part)
        if not match:
            raise ValueError(f"specifier this gate cannot read: {specifier!r}")
        if not checks[match[1]](parse_version(match[2])):
            return False
    return True


def read_manifest(ref: str | None) -> dict[str, str]:
    if ref is None:
        return json.loads((ROOT / MANIFEST).read_text(encoding="utf-8"))
    shown = subprocess.run(
        ["git", "show", f"{ref}:{MANIFEST}"], cwd=ROOT, capture_output=True, text=True, check=True
    )
    return json.loads(shown.stdout)


def names(project: Path) -> dict[str, str]:
    """The package name of a project in each language."""
    pubspec = (project / "dart" / "pubspec.yaml").read_text(encoding="utf-8")
    dart = re.search(r"^name:\s*(\S+)", pubspec, re.MULTILINE)
    ts = json.loads((project / "ts" / "package.json").read_text(encoding="utf-8"))["name"]
    py = tomllib.loads((project / "py" / "pyproject.toml").read_text(encoding="utf-8"))["project"]["name"]
    return {"dart": dart[1] if dart else "", "ts": ts, "py": py.lower().replace("_", "-")}


def dart_dependencies(project: Path) -> dict[str, str]:
    """`name: constraint` entries of the top-level `dependencies:` block of pubspec.yaml."""
    deps: dict[str, str] = {}
    inside = False
    for line in (project / "dart" / "pubspec.yaml").read_text(encoding="utf-8").splitlines():
        if re.match(r"^\S", line):
            inside = line.rstrip() == "dependencies:"
            continue
        entry = re.match(r"^  ([A-Za-z0-9_]+):\s*(.*?)\s*(?:#.*)?$", line)
        if inside and entry:
            deps[entry[1]] = entry[2]
    return deps


def edges(projects: dict[str, Path]) -> list[Edge]:
    by_language: dict[str, dict[str, str]] = {"dart": {}, "ts": {}, "py": {}}
    for path, project in projects.items():
        for language, name in names(project).items():
            by_language[language][name] = path

    found: list[Edge] = []
    for path, project in projects.items():
        for name, constraint in dart_dependencies(project).items():
            sibling = by_language["dart"].get(name)
            if sibling and sibling != path:
                found.append(Edge(path, "dart", sibling, constraint))

        package = json.loads((project / "ts" / "package.json").read_text(encoding="utf-8"))
        for field in ("dependencies", "peerDependencies"):
            for name, constraint in package.get(field, {}).items():
                sibling = by_language["ts"].get(name)
                if sibling and sibling != path:
                    found.append(Edge(path, "ts", sibling, constraint))

        pyproject = tomllib.loads((project / "py" / "pyproject.toml").read_text(encoding="utf-8"))
        for requirement in pyproject.get("project", {}).get("dependencies", []):
            match = PEP508_NAME.match(requirement)
            if not match:
                continue
            sibling = by_language["py"].get(match[1].lower().replace("_", "-"))
            if sibling and sibling != path:
                found.append(Edge(path, "py", sibling, match[2]))
    return found


def check(
    found: list[Edge], manifest: dict[str, str], released: set[str]
) -> tuple[list[str], list[str]]:
    """Check every edge that touches a released project; returns (ok lines, failures).

    An edge is checked when its dependent is released (it must not ship a constraint that excludes the
    sibling) or when its sibling is released (the new version must not be excluded by a dependent, even
    one that is not being released).
    """
    oks: list[str] = []
    failures: list[str] = []
    for edge in found:
        dependent_released = edge.project in released
        sibling_released = edge.sibling in released
        if not (dependent_released or sibling_released):
            continue
        version = manifest[edge.sibling]
        line = f"{edge.project} ({edge.language}) -> {edge.sibling} {edge.constraint!r} vs {version}"
        try:
            ok = admits_pep440(edge.constraint, version) if edge.language == "py" else admits(edge.constraint, version)
        except ValueError as error:
            failures.append(f"{edge.project} ({edge.language}) -> {edge.sibling}: {error}")
            continue
        if ok:
            oks.append(line)
        elif sibling_released and not dependent_released:
            failures.append(
                f"{edge.sibling} is released as {version}, which {edge.project} ({edge.language}) excludes "
                f"with its constraint {edge.constraint!r}, and {edge.project} is not in this release. "
                f"Widen the constraint of {edge.project} in a `fix(deps):` pull request, so release-please "
                f"releases {edge.project} in the same Release PR as {edge.sibling} {version}."
            )
        else:
            failures.append(f"{line}: excluded")
    return oks, failures


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    parser.add_argument("--base", help="git ref to compare the release-please manifest against")
    args = parser.parse_args()

    manifest = read_manifest(None)
    projects = {path: ROOT / path for path in manifest}
    released = set(projects)
    if args.base:
        before = read_manifest(args.base)
        released = {path for path, version in manifest.items() if before.get(path) != version}

    if released:
        print("Released: " + ", ".join(sorted(released)))

    oks, failures = check(edges(projects), manifest, released)
    for line in oks:
        print(f"ok    {line}")

    if not released:
        print("No project changes version against the base; nothing is being released.")
    if failures:
        print("\nA release would leave a project and its sibling incompatible:", file=sys.stderr)
        for failure in failures:
            print(f"  {failure}", file=sys.stderr)
        print("\nSee ADR-0006 §6: a release may not publish a version that an in-repo dependent excludes.", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
