"""Tests of the sibling gate (ADR-0006 §6). Run from the repository root:

    python -m pytest code/tests/test_sibling_constraints.py     # or: python -m unittest discover -s code/tests
"""

import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from sibling_constraints import Edge, admits, admits_pep440, check  # noqa: E402

CORE = "code/modular_api"
SQL = "code/modular_api_sqlserver"


class Constraints(unittest.TestCase):
    def test_caret_on_zero_minor_stops_at_next_minor(self):
        # Dart (pub) and npm agree: ^0.7.0 is >=0.7.0 <0.8.0.
        self.assertTrue(admits("^0.7.0", "0.7.3"))
        self.assertFalse(admits("^0.7.0", "0.8.0"))
        self.assertFalse(admits("^0.7.0", "0.6.9"))

    def test_caret_on_major_stops_at_next_major(self):
        self.assertTrue(admits("^1.2.0", "1.9.0"))
        self.assertFalse(admits("^1.2.0", "2.0.0"))

    def test_explicit_range(self):
        self.assertTrue(admits(">=0.7.0 <0.9.0", "0.8.0"))
        self.assertTrue(admits('">=0.7.0 <0.9.0"', "0.7.0"))
        self.assertFalse(admits(">=0.7.0 <0.9.0", "0.9.0"))

    def test_unreadable_constraint_is_refused(self):
        with self.assertRaises(ValueError):
            admits("any", "0.8.0")

    def test_pep440(self):
        self.assertTrue(admits_pep440(">=0.7.0,<0.9.0", "0.8.0"))
        self.assertFalse(admits_pep440(">=0.7.0,<0.8.0", "0.8.0"))


class DependentLeftBehind(unittest.TestCase):
    """modular_api is released as 0.8.0; modular_api_sqlserver depends on it and is not released."""

    manifest = {CORE: "0.8.0", SQL: "0.7.3"}

    def run_gate(self, constraint, language="dart", released=frozenset({CORE})):
        return check([Edge(SQL, language, CORE, constraint)], self.manifest, set(released))

    def test_caret_that_excludes_the_new_version_fails(self):
        oks, failures = self.run_gate("^0.7.0")
        self.assertEqual(oks, [])
        self.assertEqual(len(failures), 1)
        message = failures[0]
        for expected in (SQL, "'^0.7.0'", "0.8.0", "fix(deps)", "same Release PR"):
            self.assertIn(expected, message)

    def test_widened_range_passes(self):
        oks, failures = self.run_gate(">=0.7.0 <0.9.0")
        self.assertEqual(failures, [])
        self.assertEqual(len(oks), 1)

    def test_npm_caret_fails_the_same_way(self):
        _, failures = self.run_gate("^0.7.0", language="ts")
        self.assertEqual(len(failures), 1)

    def test_python_specifier_fails_the_same_way(self):
        _, failures = self.run_gate(">=0.7.0,<0.8.0", language="py")
        self.assertEqual(len(failures), 1)
        _, failures = self.run_gate(">=0.7.0,<0.9.0", language="py")
        self.assertEqual(failures, [])

    def test_unreadable_constraint_fails_loudly(self):
        _, failures = self.run_gate("any")
        self.assertEqual(len(failures), 1)

    def test_nothing_released_checks_nothing(self):
        self.assertEqual(self.run_gate("^0.7.0", released=frozenset()), ([], []))

    def test_unrelated_release_does_not_check_the_edge(self):
        other = "code/modular_api_postgres"
        manifest = {**self.manifest, other: "0.7.4"}
        result = check([Edge(SQL, "dart", CORE, "^0.7.0")], manifest, {other})
        self.assertEqual(result, ([], []))


class ReleasedDependent(unittest.TestCase):
    """The original rule: a released project may not exclude the sibling's version."""

    def test_released_dependent_with_stale_constraint_fails(self):
        manifest = {CORE: "0.8.0", SQL: "0.7.4"}
        _, failures = check([Edge(SQL, "dart", CORE, "^0.7.0")], manifest, {SQL})
        self.assertEqual(len(failures), 1)
        self.assertIn("excluded", failures[0])

    def test_both_released_with_widened_constraint_passes(self):
        manifest = {CORE: "0.8.0", SQL: "0.7.4"}
        oks, failures = check([Edge(SQL, "dart", CORE, ">=0.7.0 <0.9.0")], manifest, {CORE, SQL})
        self.assertEqual(failures, [])
        self.assertEqual(len(oks), 1)


if __name__ == "__main__":
    unittest.main()
