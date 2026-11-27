"""The size grammar of ``json_body_limit`` matches the npm ``bytes`` package used by the TS SDK (#43)."""

from __future__ import annotations

import pytest

from modular_api.core._body_limit import parse_body_limit


@pytest.mark.parametrize(
    ("value", "expected"),
    [
        ("100kb", 102400),
        ("100KB", 102400),
        ("1mb", 1048576),
        ("2mb", 2097152),
        ("1.5mb", 1572864),
        ("1.5MB", 1572864),
        ("1 gb", 1024**3),
        ("1tb", 1024**4),
        ("1pb", 1024**5),
        ("5b", 5),
        ("10", 10),
        (" 10 ", 10),
        (10, 10),
        (0, 0),
        ("0", 0),
    ],
)
def test_valid(value: int | str, expected: int) -> None:
    assert parse_body_limit(value) == expected


@pytest.mark.parametrize("value", ["", "abc", "10xb", "kb", "-1kb", "-5", "1..5mb", "1 2mb", -1, True, 1.5])
def test_invalid(value: object) -> None:
    with pytest.raises(ValueError):
        parse_body_limit(value)  # type: ignore[arg-type]
