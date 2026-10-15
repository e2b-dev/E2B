---
name: triaging-issues
description: "Triage conventions for GitHub issues in e2b-dev/E2B: classification dimensions, label usage, spam handling, and the triage comment format. Use when classifying or labeling an issue."
---

# Triaging Issues

New issues are normally auto-triaged by an automation; follow the same conventions when triaging manually so results stay consistent.

## Classification dimensions

- `type`: bug | feature | refactor | question | chore | security
- `priority`: critical | high | medium | low
- `complexity`: trivial | small | medium | large
- `affected_area`: best-guess component (e.g. "js-sdk/filesystem", "python-sdk/commands", "cli/templates", "CI pipeline", "unknown")
- `actionable`: whether there's enough information to act
- `needs_clarification`: only true when proceeding would risk building the wrong thing entirely; list the specific questions
- `summary`: one-sentence restatement (note assumptions here instead of blocking)

Be decisive: classify with best judgment when intent is clear, even if details are thin.

## Labels

Apply matching **existing** repository labels (`gh label list` to see them — e.g. bug, feature, Improvement, sdk, cli, envd, Infrastructure, Build System, Code Interpreter) with `gh issue edit <n> --add-label ...`. Never create new labels.

## Spam

Check the issue and each comment for spam/promotional content (off-topic self-promotion, link-farming, credit-solicitation, AI filler). Hide spam comments via the GraphQL `minimizeComment` mutation with `classifier: SPAM` (`gh api graphql`). If the issue itself is spam: `type: chore`, `priority: low`, note "spam" in the summary and that it should be closed.

## Comment format

Post the classification as an issue comment:

```md
**Triage**

- **type**: bug
- **priority**: high
- **complexity**: small
- **affected_area**: js-sdk/network transform
- **actionable**: yes
- **needs_clarification**: false
- **questions**: (only when needs_clarification is true, as a nested list)
- **summary**: One-sentence restatement of the work item.
```
