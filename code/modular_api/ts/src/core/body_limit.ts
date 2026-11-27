// ============================================================
// core/body_limit.ts
// Validation of JSON body limits. body-parser turns a string it cannot
// parse into `null`, and raw-body then applies NO limit, so a typo would
// silently remove the cap. Validate with the same `bytes` package Express uses.
// ============================================================

import bytes from 'bytes';

/** True when `express.json({ limit })` would enforce a real limit. */
export function isValidBodyLimit(limit: unknown): limit is string | number {
  if (typeof limit === 'number') return Number.isFinite(limit) && limit >= 0;
  if (typeof limit === 'string') return bytes.parse(limit) !== null;
  return false;
}
