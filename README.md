# Modular API — Meta Repository

Use-case-centric toolkit for building modular HTTP APIs.
One specification, multiple language implementations.

## Implementations

| Package | Language | Framework | Registry |
|---------|----------|-----------|----------|
| [modular_api_dart](https://github.com/macss-dev/modular_api_dart) | Dart | [shelf](https://pub.dev/packages/shelf) | [pub.dev](https://pub.dev/packages/modular_api) |
| [modular_api_ts](https://github.com/macss-dev/modular_api_ts) | TypeScript | [Express](https://expressjs.com/) | [npm](https://www.npmjs.com/package/@macss/modular-api) |
| [modular_api_py](https://github.com/macss-dev/modular_api_py) | Python | [Starlette](https://www.starlette.io/) | [PyPI](https://pypi.org/project/macss-modular-api/) |

All implementations conform to the same [Architecture Specification](docs/architecture.md).


## Repository Structure

```
modular_api/
├── .meta                 # meta tool config (sub-repo mapping)
├── docs/                 # Language-agnostic specification and architecture
│   └── architecture.md   # Canonical reference (the spec)
├── dart/                 # → modular_api_dart
├── ts/                   # → modular_api_ts
└── py/                   # → modular_api_py
```

## Documentation

| Document | Description |
|----------|-------------|
| [Architecture Specification](docs/architecture.md) | Canonical, language-agnostic spec for all implementations |

Each implementation also carries its own `README.md`, `doc/` folder, and `CHANGELOG.md`
with language-specific guides and examples.

## License

See [LICENSE](LICENSE) for details.
