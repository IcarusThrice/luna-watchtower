# Luna Watchtower

Security watch for Terra (phoenix-1). One static page, three tabs:

- **Watchtower** — the 21-day unbonding queue, the largest exits, the restricted addresses from Terra core v2.22.0, validator voting-power concentration, governance, and a personal watchlist.
- **Checkup** — paste a public address to see whether it is restricted, what it holds, and which authz grants, fee allowances and CW20 allowances it has given out, with a revoke command for each.
- **Quantum** — Terra's path to post-quantum signatures, scored from the versions a live node reports, plus a check for whether an address's public key is already on-chain.

The page is read-only. It never asks for a recovery phrase, signs nothing and sends nothing. All chain data is fetched in the visitor's browser from public phoenix-1 REST nodes.

## Status

First build. The logic is tested in a headless browser against mocked chain responses (`test/run.js`). It has not yet been verified against the live chain.

Not built yet: one-click revoke through a wallet, IBC outflow tracking, contract admin-change feed, alerts while the page is closed, dormant-wallet detection, and a chain-wide map of exposed public keys. Most of these need a small indexer.

## Layout

| Path | What it is |
|---|---|
| `src/page.html` | The page: markup, styles and script in one file |
| `data/restricted.json` | Restricted addresses, extracted from `app/ante/blacklist/blacklist.go` at Terra core tag `v2.22.0` |
| `build.py` | Injects the list into the page and writes `dist/index.html` |
| `dist/index.html` | The deployable site |
| `docs/index.html` | The same file, where GitHub Pages serves it from |
| `test/run.js` | Playwright test with mocked REST responses |

## Build and test

```sh
python3 build.py
npm install playwright   # once
node test/run.js
```

## Deploy

Any static host works.

- **GitHub Pages:** Settings → Pages → Deploy from a branch → `main`, folder `/docs`.
- **Cloudflare Pages:** no build command, output directory `dist`.

At runtime the page also tries to read the current restricted list from the `release/v2.22` branch of `phoenix-directive/core` and falls back to the bundled copy.

## Sources

- [Phoenix Foundation: Preliminary Incident Report, Legacy Terra Station Desktop Wallet Compromise](https://medium.com/@PhoenixDirective/preliminary-incident-report-legacy-terra-station-desktop-wallet-compromise-9657c4de1dbd)
- [Terra core v2.22.0 restriction list](https://github.com/phoenix-directive/core/blob/v2.22.0/app/ante/blacklist/blacklist.go)
- [Cosmos: Post-Quantum Ledger Security 2026.1](https://cosmos.network/blog/post-quantum-ledger-security-20261)

Built by the [Deep State Luna](https://deepstateluna.com) validator.
