# Stockyard Live-Location Chassis Matching

## Problem

AutoStock receives live stockyard locations keyed by chassis number. Thirty-seven active AutoStock vehicles have chassis values with a scan tag, such as `MBJAABAA201437814~0826`, while the stockyard platform stores the corresponding base VIN, `MBJAABAA201437814`. The current endpoint removes scan tags only from incoming values, so these records do not match.

The other blank rows in `Book3.xlsx` have no corresponding vehicle in the stockyard database and are outside this fix.

## Design

Keep both databases' chassis values unchanged. In the AutoStock sync endpoint, normalize both operands used for matching by trimming whitespace, converting to uppercase, and comparing only the portion before the first `~`.

The endpoint will continue to update only `Vehicle.stockyardLiveLocation`. It will not create vehicles or modify `Vehicle.chassisNumber`, manual stockyard locations, statuses, or stockyard records.

## Data Flow

1. The stockyard job sends batches containing `chassisNumber` and `stockyardLocation`.
2. AutoStock normalizes each incoming chassis number.
3. The bulk update compares it with the normalized base portion of each stored `Vehicle.chassisNumber`.
4. Matching vehicles receive the supplied `stockyardLiveLocation`; unmatched vehicles remain unchanged and are counted as not found.

## Error Handling

Existing authentication, Zod validation, batch limits, and error middleware remain unchanged. Empty batches retain their existing response. The change introduces no fallback or fuzzy matching beyond the explicit scan-tag suffix rule.

## Verification

- A tagged stored chassis matches an untagged incoming VIN.
- Plain stored and incoming chassis numbers continue to match.
- Case and surrounding whitespace do not prevent a match.
- Unrelated chassis numbers remain unmatched.
- The backend TypeScript build passes.
- A read-only comparison against `Book3.xlsx` and the stockyard database confirms the 37 affected rows satisfy the new matching rule.

