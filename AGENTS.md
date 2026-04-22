<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Project Collaboration Notes

## Default Working Style
- Default to executing directly instead of asking for confirmation on every step.
- When an issue appears during implementation, continue investigating and self-correct when it is safe to do so.
- Only stop to ask the user when an action is risky, destructive, requires external credentials, login, payment, or manual system interaction.

## Product Direction
- This project starts as an AI Chat app and evolves toward an Agent architecture.
- Keep the product learning-friendly for a frontend developer.
- Prefer real integrations and real product behavior over fake demos whenever practical.

## UI And UX Rules
- Default UI copy should be Chinese.
- Prioritize stable layout, readable long conversations, and clear tool/agent feedback.
- Long content must stay inside local scroll containers instead of breaking the overall page shell.

## Architecture Rules
- Keep page components focused on UI and interaction.
- Keep orchestration in service-layer modules.
- Keep model/provider adaptation in provider-layer modules.
- Keep storage access in repository-layer modules.
- Prefer small, composable components and modules over large all-in-one files.
- When adding code, consider extensibility up front so new states, tools, and panels can be added without rewriting the original file.
- If a file starts mixing multiple responsibilities, split it during the change instead of postponing the cleanup.
- Avoid repeating the pattern of letting one file grow too large and then paying the refactor cost later.

## Encoding Rules
- Treat source files as `UTF-8` only.
- Prefer `LF` line endings.
- If terminal output looks garbled on Windows, do not use that output as replacement source text.
- If JSX is already damaged, prefer whole-block rewrites over line-based patching.

## Verification And Worklog Rules
- Every code change must be self-verified before completion.
- Default verification should include `npm run lint`.
- When the change may affect build, routing, module resolution, or types, also run `npm run build`.
- Record operations, verification results, and next steps in `docs/worklog.md` after each code change.
- Worklog entries should also note structural decisions when a change involves component extraction, module boundaries, or extensibility tradeoffs.
