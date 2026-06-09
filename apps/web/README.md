# LifeOS AI Web

The active Next.js web app currently lives in `src/` at the repository root while the repository transitions into the target monorepo layout. `apps/web/package.json` proxies the root Next.js commands so CI and deployment scripts can target the web app path without duplicating source files.

```txt
apps/web
apps/mobile
packages/ui
packages/types
packages/utils
packages/ai
backend/database
docs
```

Move the root Next.js app here once package workspaces are fully introduced.
