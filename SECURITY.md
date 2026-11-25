# Security Policy

`modular_api` is infrastructure: applications built on it rely on its routing, middleware pipeline and request handling to enforce their own security controls. We take vulnerabilities in it seriously and appreciate responsible disclosure.

## Supported versions

The project is pre-1.0. Security fixes are released for the **latest minor version** of each SDK. Older minors do not receive backports, so the remediation is to upgrade.

| SDK | Package | Supported |
|---|---|---|
| TypeScript | [`@macss/modular-api`](https://www.npmjs.com/package/@macss/modular-api) on npm | latest minor (currently 0.7.x) |
| Python | [`macss-modular-api`](https://pypi.org/project/macss-modular-api/) on PyPI | latest minor (currently 0.7.x) |
| Dart | [`modular_api`](https://pub.dev/packages/modular_api) on pub.dev | latest minor (currently 0.7.x) |

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

Because the three SDKs aim for behavioural parity, a report against one SDK is also checked against the other two.

## Scope

**In scope:** the code of the three SDKs in this repository, including:

- routing;
- the middleware and plugin pipeline;
- input parsing and validation;
- the built-in operational endpoints (`/health`, `/metrics`, `/docs`, OpenAPI);
- the logging, metrics and tracing middlewares;
- documentation that recommends an insecure pattern.

**Out of scope:**

- Vulnerabilities in applications built with `modular_api` that are caused by the application's own code or configuration. Please report those to the application owner.
- Vulnerabilities in third-party dependencies (Express, Starlette, shelf, etc.) that `modular_api` does not make worse. Please report those upstream.
