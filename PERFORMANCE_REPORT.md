# Performance Report

## Change

Route-level code splitting added in `src/App.tsx`. Each route is now imported via `React.lazy`, wrapped in a single `<Suspense>` boundary that reuses the existing spinner.

```tsx
const Index   = lazy(() => import("./pages/Index.tsx"));
const Auth    = lazy(() => import("./pages/Auth.tsx"));
const Pricing = lazy(() => import("./pages/Pricing.tsx"));
const Landing = lazy(() => import("./pages/Landing.tsx"));
const NotFound = lazy(() => import("./pages/NotFound.tsx"));
```

## Why this is the right first move

The largest non-route chunks pulled into the initial bundle today are dragged in transitively by `pages/Index.tsx`:

- `framer-motion`
- `react-resizable-panels`
- `react-markdown` + `remark-gfm` + Prism (`MarkdownContent`)
- All `workspace/*` and `chat/*` components
- The Ollama client

None of these are needed to render `/` (Landing) or `/auth`. Route-splitting moves them out of the entry chunk and into a `/chat`-only chunk that loads after authentication, which is exactly when the user is willing to wait briefly.

## Expected impact

The harness reports bundle sizes on the next build. Expected directional change:

- Entry chunk (`/`, `/auth`) drops by the combined weight of Index's deep tree (Markdown + Prism + framer-motion + resizable-panels are the biggest contributors — typically 250–450 KB gzipped together in projects of this shape).
- `/chat` becomes a separate chunk loaded on demand. First paint on Landing and Auth improves correspondingly.
- No change to perceived UX on `/chat` itself; the `Suspense` fallback is the same spinner already used by `ProtectedRoute`.

Run a build to capture the exact BEFORE/AFTER numbers; the build output prints per-chunk gzip sizes.

## Out of scope (intentional)

Per the brief, this pass does not rewrite components, replace `framer-motion`, swap `react-markdown` for a lighter renderer, or tree-shake Prism languages. Those are follow-ups once route-splitting numbers are measured.
