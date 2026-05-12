# E2E Tests (Playwright)

```bash
# install browser binaries first time
npx playwright install --with-deps chromium

# run all tests against local dev server
npm run dev          # in another terminal
PLAYWRIGHT_BASE_URL=http://localhost:8080 npx playwright test

# headed for debugging
npx playwright test --headed --project=chromium

# just the billing suite
npx playwright test e2e/billing.spec.ts
```

In CI, set `PLAYWRIGHT_BASE_URL` to the deployed preview URL.
