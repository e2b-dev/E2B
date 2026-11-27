---
name: tdd
description: Rules for writing tests - which seams to test at, what to mock, and the red-green loop. Use before writing, changing or fixing any test, including a test that is only part of a bug fix or a feature, and when the user asks for TDD, "red-green-refactor" or integration tests.
---

# Test-Driven Development

TDD is the red → green loop. This skill is the reference that makes that loop produce tests worth keeping: what a good test is, where tests go, the anti-patterns, and the rules of the loop. Every section applies on every cycle: consult them before and during the loop, not after.

## Before the first test

1. Read [tests.md](tests.md) and [mocking.md](mocking.md) in full. They are short, and the rules below rely on them.
2. Settle the seams (see below) before any test exists.
3. Do not take the project's existing tests as the standard. A neighbouring test that replaces an internal module or calls a private helper is a pattern to leave behind, not one to copy for consistency.

## What a good test is

Tests verify behavior through public interfaces, not implementation details. Code can change entirely; tests shouldn't. A good test reads like a specification: "user can checkout with valid cart" tells you exactly what capability exists, and it survives refactors because it doesn't care about internal structure.

See [tests.md](tests.md) for examples and [mocking.md](mocking.md) for mocking guidelines.

## Seams: where tests go

A **seam** is the public boundary you test at: the interface where you observe behavior without reaching inside. Tests live at seams, never against internals.

**Test only at agreed seams.** Before writing any test, write down the seams under test, each with a one-line note on what it catches and what it misses. You can't test everything, so agreeing the seams up front is how testing effort lands on the critical paths and complex logic instead of every edge case.

How the seams get agreed depends on where you are:

- **The project's agent instructions list them** (`CLAUDE.md`, `AGENTS.md` or similar). Use those and say which ones you are using. Only a seam that is not on that list needs the user's confirmation.
- **Nothing is listed and the user can answer.** Ask: "What's the public interface, and which seams should we test?" Wait for the answer; no test is written at an unconfirmed seam.
- **Nothing is listed and you cannot ask** (you are running unattended). Choose the seams these rules lead to, put them at the top of your report with their one-line notes, and mark them unconfirmed. Do not skip the step silently.

When a behavior cannot be observed at an agreed seam, say so and ask or flag it. Do not reach inside for it.

## Anti-patterns

- **Implementation-coupled**: mocks internal collaborators, tests private methods, or verifies through a side channel (querying the database instead of using the interface). The tell: the test breaks when you refactor but behavior hasn't changed.
- **Tautological**: the assertion recomputes the expected value the way the code does (`expect(add(a, b)).toBe(a + b)`, a snapshot derived by hand the same way, a constant asserted equal to itself), so it passes by construction and can never disagree with the code. Expected values must come from an independent source of truth: a known-good literal, a worked example, the spec.
- **Horizontal slicing**: writing all tests first, then all implementation. Bulk tests verify _imagined_ behavior: you test the _shape_ of things rather than user-facing behavior, the tests go insensitive to real changes, and you commit to test structure before understanding the implementation. Work in **vertical slices** instead: one test → one implementation → repeat, each test a **tracer bullet** that responds to what the last cycle taught you.

## Rules of the loop

- **Red before green.** Write the failing test first and run it. See it fail for the reason you expect, then write only enough code to pass it. Don't anticipate future tests or add speculative features.
- **One slice at a time.** One seam, one test, one minimal implementation per cycle. One behavior tried with several inputs is one slice; five behaviors are five slices, not one batch.
- **A changed test is a new test.** When you edit a test's expectation, see it fail against the code as it was.
- **A test that passes before the change is outside the loop.** It pins behavior that must stay as it is. Write one only for that purpose, and say that it is one.
- **Refactor only on green.** Refactoring is a separate step after the loop, never mixed into a red → green cycle; the tests stay unchanged and must keep passing.

## Before you report

Check each of these, and say in the report where one does not hold:

- Every new or changed test was seen red against the code without the change, or is named as pinning existing behavior.
- Every test goes through an agreed seam. Nothing inside the project is replaced or called directly.
- Mocks sit at system boundaries only.
- Each test makes one logical assertion and has a name that says what holds, not how.
- Anything you could not test at a seam is listed, with the reason.

---

Adapted from [mattpocock/skills `tdd`](https://github.com/mattpocock/skills/tree/3f599139104dfceabc7754eeb91319802f85e042/skills/engineering/tdd) by Matt Pocock, used under the MIT License:

Copyright (c) 2026 Matt Pocock

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
