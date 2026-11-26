# 6. Per-Project Versioning Across the Three SDKs

Date: 2026-08-02 — **revised 2026-11-11**

## Status

Proposed

Supersedes [ADR-0002](0002-synchronized-versioning-across-sdks.md) once accepted. It is accepted when
the repository layout, the release-please configuration and the publish workflow described below
exist, and each per-project publish has been proven once (issue
[#32](https://github.com/ccisnedev/modular_api/issues/32)). Until then ADR-0002's decision — the three
SDKs of one package share a version — stays in force; its 15-package extension does not, see the
erratum in ADR-0002.

> **Revision note (2026-11-11).** The first draft of this ADR (2026-08-02) kept the per-project rule
> but proposed a home-grown trigger: publish on a push to the default branch whenever a project's three
> manifests declared a version absent from the registries. This revision keeps the rule and replaces
> the mechanism: the repository is reorganized by project and releases are driven by release-please.
> The draft was never accepted, so it is rewritten in place; git history holds the original text.

## Context

modular_api is five projects — `modular_api`, `modular_api_rest_client`,
`modular_api_graphql_client`, `modular_api_sqlserver`, `modular_api_postgres` — each published in
three languages: Dart (pub.dev), TypeScript (npm) and Python (PyPI). Fifteen packages in total, plus
`docs-ui`, the documentation front end.

ADR-0002 decided, after the stale-`dist/` incident of TypeScript `0.4.5`:

> We adopt **synchronized versioning**: all three SDKs always share the same version number.

That sentence is about **the three SDKs of one package**, and it is right: a consumer comparing Dart
`0.7.0` against Python `0.7.0` of the same package should get the same behaviour.

A section appended later for `0.5.0` stretched it to all fifteen packages — "synchronized versioning
now covers 15 packages" — and `release.yml` was built to enforce that: one tag `v<version>`, fifteen
manifests checked against it. That extension was never decided; it was a misreading of ADR-0002 that
ended up written into it. The evidence against it:

**It was violated as soon as it met a real case.** The three cores sat at `0.6.1` while the twelve
satellites sat at `0.6.0`. A core-only fix did not justify twelve releases with no content.

**It publishes releases that say nothing.** `0.7.1` was a TypeScript-only fix in the core (#41). It
bumped all fifteen manifests; twelve packages were published with a changelog entry that only says
"version bump for cross-SDK parity", into registries where nothing can be deleted.

**It does not protect what actually breaks.** Preparing `0.7.0`, three packages still constrained
their siblings to `^0.6.0`, which resolves to `>=0.6.0 <0.7.0`. Synchronizing the `version:` fields
did not synchronize the constraints between packages.

**The single tag was a workaround, not a decision.** `release.yml` explains it: GitHub suppresses
tag push events when more than three tags are pushed at once, so per-package tags silently published
nothing.

A second problem sits underneath the first. The repository is organized **by language**
(`code/dart/<project>`, `code/ts/<project>`, `code/py/<project>`), so a project is three
directories, and no tool that reasons about "what changed in this project" can see it as one unit.

## Decision

### 1. Parity is per project, across its three languages

Each project versions independently. Within a project, the Dart, TypeScript and Python packages
always carry the same version and are released together. `docs-ui` versions on its own line.

`modular_api 0.9.x` next to `modular_api_sqlserver 0.7.x` is the correct state, not drift.

### 2. The repository is organized by project

```
code/
  modular_api/
    dart/   ts/   py/
    CHANGELOG.md
  modular_api_rest_client/
  modular_api_graphql_client/
  modular_api_sqlserver/
  modular_api_postgres/
  docs-ui/
  infra/    tests/
```

Each language directory keeps its native layout (`pubspec.yaml`, `package.json`, `pyproject.toml`).
`infra/` and `tests/` (cross-SDK integration tests) are not projects and are not released.

### 3. Releases are driven by release-please

One release-please manifest configuration with **one component per project**, plus `docs-ui`
(`release-type: node`). A project component is `release-type: simple`, and its three manifests are
updated through `extra-files`:

| File | `extra-files` entry |
| --- | --- |
| `dart/pubspec.yaml` | `{"type": "generic", "path": "dart/pubspec.yaml"}`, with `# x-release-please-version` on the `version:` line |
| `ts/package.json` | `{"type": "json", "path": "ts/package.json", "jsonpath": "$.version"}` |
| `ts/package-lock.json` | `{"type": "json", "path": "ts/package-lock.json", "jsonpath": "$.version"}` and `"$.packages[''].version"` |
| `py/pyproject.toml` | `{"type": "toml", "path": "py/pyproject.toml", "jsonpath": "$.project.version"}` |

`pubspec.yaml` must use the `generic` updater. The `yaml` updater, and a bare path ending in
`.yaml`, re-serialize the whole file (see Evidence).

The flow:

1. Pull requests merge into `main` with Conventional Commit titles (squash merge, title validated).
   Merging a feature does **not** publish anything.
2. release-please keeps one Release PR up to date, with the next version and changelog of every
   project that has unreleased commits. **Which project a commit belongs to is decided by the paths
   it touches**, not by its title. A commit touching two projects bumps both.
3. Merging the Release PR creates one tag per released project (`<project>-v<version>`) and the
   publish jobs run from release-please's outputs. No tag push triggers anything, so the three-tag
   limit no longer applies.

Parity between the three languages is therefore structural: one version per component, written to
three manifests by the same tool. It is still checked (gate 1 below), but it no longer depends on
someone remembering it.

### 4. Version numbers follow semver, with the pre-1.0 convention

Both options are enabled:

```json
"bump-minor-pre-major": true,
"bump-patch-for-minor-pre-major": true
```

| Commit | In `0.x` | From `1.0` |
| --- | --- | --- |
| `fix:` | `0.7.1 → 0.7.2` | `1.2.3 → 1.2.4` |
| `feat:` | `0.7.1 → 0.7.2` | `1.2.3 → 1.3.0` |
| breaking (`!` or `BREAKING CHANGE:`) | `0.7.1 → 0.8.0` | `1.2.3 → 2.0.0` |

Before 1.0 the minor number plays the role of the major one. That is how the caret ranges of npm and
pub read a `0.x` constraint — `^0.7.0` admits `>=0.7.0 <0.8.0` — so the number tells a dependent
exactly what its constraint will accept. In `0.x`, `feat` and `fix` move the same number; the
changelog keeps them apart, under separate sections.

Without the first option, the first breaking change in `0.x` jumps to `1.0.0`. Without the second,
every `feat` moves the minor number and falls outside every dependent's `^0.x` constraint.

A project reaches `1.0.0` deliberately, with a `Release-As: 1.0.0` footer, when it is declared
stable. From then on the two options have no effect on it. A `Release-As:` footer can also force any
other version, but no rule requires it.

### 5. Gates in the publish path

1. **Parity.** The three manifests of a project agree with each other and with
   `.release-please-manifest.json`. Checked in CI, so a hand edit that breaks parity fails before
   merge.
2. **Constraints on siblings.** A package whose constraint on a sibling excludes that sibling's
   version is not published. Checked on the Release PR, so it blocks the merge.
3. **Dependency order.** The graph is small and must stay small: `modular_api_sqlserver` →
   `modular_api`, and `modular_api_graphql_client` → `modular_api_rest_client` (Dart and TypeScript;
   Python has none). The dependency publishes first.
4. **Idempotence.** A version already present in a registry is skipped with a notice, so a partial
   failure can be re-run.
5. **`npm ci`, not `npm install`.** The lockfile is authoritative at publish time.

### 6. A breaking change in a dependency is released in two steps

Siblings resolve each other from the registries, not from the working tree. When `modular_api`
releases `0.8.0`, `modular_api_sqlserver` cannot move its constraint to `^0.8.0` in the same Release
PR: its CI would ask pub.dev for a `modular_api 0.8.0` that does not exist yet.

So: the core is released first; then a pull request widens the dependent's constraint, and the
dependent is released in its own Release PR. Updating dependents after a breaking release is the
publisher's responsibility, as it would be for any independent package. Every combination tested in
CI is one that exists in the registries.

### 7. One changelog per project

release-please writes `code/<project>/CHANGELOG.md`. It is the only source of truth. pub.dev reads
the changelog inside the published Dart package, and npm ships whatever is inside `ts/`, so the publish
job copies the project changelog into `dart/` and `ts/` before publishing. The copy exists only on the
runner and is never committed.

The fifteen hand-written per-language changelogs are consolidated once, during the migration, under a
"Before release-please" section of each project changelog, one subsection per language. Nothing is
lost, and pub.dev keeps showing the whole history.

Commit scopes name the language when a change touches only one (`fix(ts): …`), and are omitted when it
touches all three. The scope appears in bold in the changelog, so a Dart reader can tell at a glance
which entries do not concern them.

### 8. The starting point

`.release-please-manifest.json` starts with every project at `0.7.1`, the version in the registries,
and the configuration sets `bootstrap-sha` to the commit where release-please is adopted, so the first
changelog does not walk the whole history. The existing global tags (`v0.5.0` … `v0.7.1`) stay; the
first per-project tags are created by the first Release PR, after which `bootstrap-sha` is removed.

## Evidence

Verified on 2026-11-11 against release-please 17.9.0, using its own updaters on the repository's real
manifests (`HEAD`, LF line endings, as the Action reads them), bumping `0.7.1 → 0.7.2`:

| File | Updater | Result |
| --- | --- | --- |
| `pyproject.toml` | `toml`, `$.project.version` | only the version line changes |
| `package.json` | `json`, `$.version` | only the version line changes |
| `package-lock.json` | `json`, `$.version` and `$.packages[''].version` | only those two lines change |
| `pubspec.yaml` | `yaml`, `$.version` | **rewrites the file**: drops blank lines, re-quotes strings, folds the repository URL |
| `pubspec.yaml` | `generic` + `# x-release-please-version` | only the version line changes |

Version bumps computed by release-please's `DefaultVersioningStrategy`:

| Options | `0.7.1` fix | `0.7.1` feat | `0.7.1` breaking | `1.2.3` fix / feat / breaking |
| --- | --- | --- | --- | --- |
| none | 0.7.2 | 0.8.0 | 1.0.0 | 1.2.4 / 1.3.0 / 2.0.0 |
| `bump-minor-pre-major` | 0.7.2 | 0.8.0 | 0.8.0 | 1.2.4 / 1.3.0 / 2.0.0 |
| both (this decision) | 0.7.2 | 0.7.2 | 0.8.0 | 1.2.4 / 1.3.0 / 2.0.0 |

`npm ci` succeeds whether or not the lockfile's own `version` matches `package.json`; the lockfile is
updated anyway, for coherence.

The `toml` updater fails on files with CRLF line endings. The Action is not affected (the index stores
LF), but local tooling on Windows checkouts is: the repository needs a `.gitattributes` that fixes LF.

Not yet verified: the end-to-end behaviour against GitHub — path-to-component routing, tag names,
changelog rendering, `bootstrap-sha`. That is checked with `release-please release-pr --dry-run`
against the reorganization branch before any publish.

## Alternatives considered

- **Keep the 15-package lockstep.** Rejected for the reasons in Context.
- **Publish on a manifest version change (the first draft of this ADR).** Workable, but the release
  decision becomes a hand edit of three manifests, the changelog stays hand-written, and parity is
  only as good as the check. release-please derives the version and the changelog from the commits and
  writes all three manifests itself.
- **Keep the by-language layout and use 15 release-please components with the `linked-versions`
  plugin.** Rejected: fifteen tags and fifteen changelogs per release, empty changelog entries in the
  languages a change did not touch, and the unit people reason about — the project — would exist only
  as a configured group.
- **Only `bump-minor-pre-major`.** Rejected: every `feat` of the core would fall outside the
  dependents' `^0.x` constraints and force releases with nothing in them.
- **Local overrides in CI so dependents test against the sibling's working tree.** Rejected:
  `ci.yml` already declines it — it tests combinations no consumer will ever have. The two-step release
  covers the case instead.

## Consequences

- **A project's release says something.** Its changelog contains only changes to it.
- **Cross-language parity is structural**, and checked anyway.
- **Merging is not releasing.** Work accumulates in the Release PR until someone decides to publish.
- **Versions across projects diverge, visibly.** ADR-0002's "consumers can assume version alignment"
  stops holding **across** projects and keeps holding **within** one.
- **In `0.x`, a new capability is a patch release**, as long as it breaks nothing. Breaking changes —
  and only those — move the minor number and require dependents to widen their constraints.
- **A breaking change in `modular_api` or `modular_api_rest_client` takes two Release PRs.**
- **Commit titles carry the version.** Conventional Commits stop being style and become input, so PR
  titles are validated.
- **The by-language paths disappear.** `ci.yml`, the cross-SDK test scripts, every manifest's
  `repository`/`homepage` field and the docs that cite paths are updated. The manifests' URLs are
  normalized to `https://github.com/ccisnedev/modular_api` (some pointed to `macss-dev`).
- **`release.yml` and the fifteen `publish-*.yml` are retired**, replaced by one release workflow.

## Migration

Tracked in [issue #32](https://github.com/ccisnedev/modular_api/issues/32).

1. ~~Publish `0.7.0` for all fifteen with the existing machinery.~~ Done; `0.7.1` followed under the
   same machinery.
2. **Freeze releases** until step 5. Nothing is published while the layout is half moved.
3. **Reorganize the repository** (`git mv` and path updates only; no version changes, CI green).
4. **Adopt release-please**: configuration, manifest, the release workflow with the gates, the
   consolidated changelogs, title validation; retire `release.yml` and the `publish-*.yml`. Before
   merging, verify the end-to-end behaviour with `release-please release-pr --dry-run`.
5. **Prove each project's publish once**, starting with the leaves (`modular_api_postgres`,
   `modular_api_sqlserver`, `modular_api_graphql_client`), with a `Release-As:` patch if no real change
   is pending. `modular_api` and `modular_api_rest_client` are proven on their first real release.
6. Mark this ADR `Accepted` and ADR-0002 `Superseded`.
