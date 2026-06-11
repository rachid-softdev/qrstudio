<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

<!-- BEGIN:global-agent-rules -->

## Behavior Rules

### Think before coding
- State assumptions if unclear
- Ask only if ambiguity blocks progress
- Do not silently choose between multiple interpretations
- Ask only if ambiguity blocks progress or risks incorrect implementation

### Simplicity first
- Implement only what is requested
- Avoid unnecessary abstractions
- Prefer the smallest working solution
- Do not introduce new dependencies unless strictly necessary (no built-in or simple alternative exists)

### Surgical changes
- Only modify code related to the task
- Do not refactor unrelated parts
- Keep existing style

### Execution
- Define a clear success condition before coding
- Prefer verifiable outcomes (tests, reproducible checks)

### Speed vs caution
- For trivial tasks, execute immediately without overthinking

<!-- END:global-agent-rules -->

<!-- BEGIN:design-context -->
## Design Context

This project has a formal design system documented at the root:

- **PRODUCT.md** — Strategic register (product), brand personality (fiable·moderne·efficace), anti-references (Linear/Raycast/Vercel energy), 5 design principles
- **DESIGN.md** — Visual system: "The Workshop" north star, grayscale-dominant palette, Inter single-family, Flat-By-Default elevation (ring borders, no shadows), 5 documented components

Key rules to follow:
- Monochrome discipline: colour is for signalling, not decorating (only red for danger)
- Density: 14px body, 8px grid, compact components
- No shadows at rest — use ring borders for depth
- Ink (near-black) on Paper (white) is the primary contrast axis
- No gradient text, glassmorphism, side-stripe borders
- WCAG 2.1 AA, high contrast, never colour-only states
- `.impeccable/live/config.json` exists for live variant mode
<!-- END:design-context -->