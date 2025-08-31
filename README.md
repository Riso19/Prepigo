# Prepigo

## Requirements

- Node.js 20.x LTS (pinned). Use `nvm use` to switch automatically.
- pnpm as the package manager.

## Quick start

```bash
nvm use              # ensures Node 20.x
pnpm install        # install deps
pnpm dev            # start dev server
pnpm build          # production build
```

## Notes

- TypeScript is in strict mode.
- Storage uses Dexie (IndexedDB) via `@/lib/storage`.
- See `CONTRIBUTING.md` for development guidelines and `CHANGELOG.md` for DB migrations.
