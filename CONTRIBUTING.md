# Contributing

Thank you for contributing to Prepigo!

## Dev environment

- Node.js: 20.x LTS (pinned)
- Package manager: pnpm (recommended)
- TypeScript strict mode is enabled.

### Quick setup

1. Use Node 20 LTS
   - With nvm:
     ```bash
     nvm use
     # If not installed locally:
     nvm install 20 && nvm use 20
     ```
   - Or install Node 20.x via your preferred tool.

2. Install dependencies
   ```bash
   pnpm install
   ```

3. Run the app
   ```bash
   pnpm dev
   ```

4. Build
   ```bash
   pnpm build
   ```

## Coding standards

- TypeScript strict mode. Fix all type errors before committing.
- Run lint locally:
  ```bash
  pnpm lint
  ```
- Keep source under `src/`. Do not add new source files outside `src/`.
- Use shadcn/ui + Radix UI for components. Tailwind CSS for styling.

## Storage & offline-first

- IndexedDB via Dexie only. Import storage APIs from `@/lib/storage`.
- DB changes must:
  - Bump Dexie DB version.
  - Provide reversible migrations when possible.
  - Add notes to `CHANGELOG.md`.

## Commit hygiene

- Prefer small, focused commits.
- Include context in commit messages (what/why).

## Node 22 note

- Node 22 can cause Vite HMR WebSocket RSV1 errors. Use Node 20 LTS for development.
