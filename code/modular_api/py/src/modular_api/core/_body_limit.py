"""Size grammar for ``json_body_limit`` (#43).

Same grammar as the npm ``bytes`` package that Express uses in the TypeScript SDK: a number of
bytes, or a string of an optional decimal number and a case-insensitive unit (``b``, ``kb``, ``mb``,
``gb``, ``tb``, ``pb``; base 1024), optionally separated by spaces. A bare numeric string is bytes.
"""

from __future__ import annotations

import re

_UNITS: dict[str, int] = {
    "b": 1,
    "kb": 1024,
    "mb": 1024**2,
    "gb": 1024**3,
    "tb": 1024**4,
    "pb": 1024**5,
}

_PATTERN = re.compile(r"^\s*(\d+(?:\.\d+)?)\s*(b|kb|mb|gb|tb|pb)?\s*$", re.IGNORECASE | re.ASCII)


def parse_body_limit(value: int | str) -> int:
    """Return the limit in bytes, or raise ``ValueError`` when it is invalid or negative."""
    if isinstance(value, bool) or not isinstance(value, (int, str)):  # pyright: ignore[reportUnnecessaryIsInstance]
        raise ValueError(f"Invalid json_body_limit: {value!r}")
    if isinstance(value, int):
        if value < 0:
            raise ValueError(f"json_body_limit must not be negative: {value}")
        return value
    match = _PATTERN.match(value)
    if match is None:
        raise ValueError(f"Invalid json_body_limit: {value!r}")
    unit = (match.group(2) or "b").lower()
    return int(float(match.group(1)) * _UNITS[unit])


def resolve_body_limit(use_case: int | str | None, instance: int | str | None) -> int | None:
    """Effective limit in bytes: use case, else instance, else ``None`` (no limit)."""
    chosen = use_case if use_case is not None else instance
    return None if chosen is None else parse_body_limit(chosen)
