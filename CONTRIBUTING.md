# Contributing

Thanks for helping improve Aircraft Registry Explorer.

Before making a non-trivial change, read [AGENTS.md](./AGENTS.md). It defines the public API, privacy, server-only key, history, scope, and copy boundaries that contributions must preserve.

## Local workflow

```bash
pnpm install
cp .env.example .env.local
pnpm dev
```

Before opening a pull request:

```bash
pnpm check
```

Keep pull requests focused. A useful PR should explain the developer task it improves, the public API contract it relies on, and any user-visible limitation that needs to remain explicit.

Do not include API keys, production credentials, copied FAA bulk datasets, registrant PII fixtures, or private Grizzly Bulls implementation details in issues, commits, tests, or pull requests.
