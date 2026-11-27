# Security Policy

`modular_api` is infrastructure: applications built on it rely on its routing, middleware pipeline and request handling to enforce their own security controls. We take vulnerabilities in it seriously and appreciate responsible disclosure.

## Supported versions

The repository holds several projects, each versioned on its own (ADR-0006). Within a project, the Dart, TypeScript and Python packages always share the same version. Every project is pre-1.0: security fixes are released for the **latest minor version** of each project, and older minors do not receive backports, so the remediation is to upgrade.

| Project | Dart (pub.dev) | TypeScript (npm) | Python (PyPI) | Supported |
|---|---|---|---|---|
| Core | [`modular_api`](https://pub.dev/packages/modular_api) | [`@macss/modular-api`](https://www.npmjs.com/package/@macss/modular-api) | [`macss-modular-api`](https://pypi.org/project/macss-modular-api/) | latest minor |
| PostgreSQL plugin | [`modular_api_postgres`](https://pub.dev/packages/modular_api_postgres) | [`@macss/modular-api-postgres`](https://www.npmjs.com/package/@macss/modular-api-postgres) | [`macss-modular-api-postgres`](https://pypi.org/project/macss-modular-api-postgres/) | latest minor |
| SQL Server plugin | [`modular_api_sqlserver`](https://pub.dev/packages/modular_api_sqlserver) | [`@macss/modular-api-sqlserver`](https://www.npmjs.com/package/@macss/modular-api-sqlserver) | [`macss-modular-api-sqlserver`](https://pypi.org/project/macss-modular-api-sqlserver/) | latest minor |
| REST client | [`modular_api_rest_client`](https://pub.dev/packages/modular_api_rest_client) | [`@macss/modular-api-rest-client`](https://www.npmjs.com/package/@macss/modular-api-rest-client) | [`macss-modular-api-rest-client`](https://pypi.org/project/macss-modular-api-rest-client/) | latest minor |
| GraphQL client | [`modular_api_graphql_client`](https://pub.dev/packages/modular_api_graphql_client) | [`@macss/modular-api-graphql-client`](https://www.npmjs.com/package/@macss/modular-api-graphql-client) | [`macss-modular-api-graphql-client`](https://pypi.org/project/macss-modular-api-graphql-client/) | latest minor |
| Docs UI | — | [`@macss/docs-ui`](https://www.npmjs.com/package/@macss/docs-ui) | — | latest minor |

The current version of each project is in [`.release-please-manifest.json`](.release-please-manifest.json) and [`.release-please-manifest.docs-ui.json`](.release-please-manifest.docs-ui.json).

## Reporting a vulnerability

**Please do not report security vulnerabilities through public issues, discussions or pull requests.**

Report them privately through GitHub:

1. Go to the [Security tab](https://github.com/ccisnedev/modular_api/security) of this repository.
2. Click **Report a vulnerability**.
3. Fill in the advisory form.

Please include as much of the following as you can:

- Affected SDK(s) and version(s).
- The type of issue (for example authentication bypass, injection or information disclosure).
- Steps to reproduce, ideally a minimal app or test.
- The impact: what an attacker can achieve.
- Any known workaround or suggested fix.

## What to expect

| Step | Target |
|---|---|
| Acknowledgement of your report | within 5 business days |
| Initial assessment (confirmed or not, severity) | within 10 business days |
| Fix or mitigation plan for confirmed issues | communicated in the advisory |

We work on confirmed issues in a private advisory and keep you informed there. When a fix is released, we publish the advisory, credit you unless you prefer to stay anonymous, and request a CVE when appropriate.

Because the Dart, TypeScript and Python packages of a project aim for behavioural parity, a report against one language is also checked against the other two.

## Scope

**In scope:** the code of every project in the table above, including:

- routing;
- the middleware and plugin pipeline;
- input parsing and validation;
- the built-in operational endpoints (`/health`, `/metrics`, `/docs`, OpenAPI) and the Docs UI they serve;
- the logging, metrics and tracing middlewares;
- the PostgreSQL and SQL Server plugins, for example query construction and credential handling;
- the REST and GraphQL clients;
- documentation that recommends an insecure pattern.

**Out of scope:**

- Vulnerabilities in applications built with `modular_api` that are caused by the application's own code or configuration. Please report those to the application owner.
- Vulnerabilities in third-party dependencies (Express, Starlette, shelf, etc.) that `modular_api` does not make worse. Please report those upstream.
