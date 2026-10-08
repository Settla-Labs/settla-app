# Settla Frontend

![CI](https://github.com/Settla-Labs/settla-app/actions/workflows/ci-cd.yml/badge.svg)
![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)
![Stellar](https://img.shields.io/badge/Stellar-Soroban-7D00FF?logo=stellar&logoColor=white)

Settla connects peer-to-peer marketplace activity with Stellar wallet actions. People can publish offers, open trades, coordinate local payment, and settle the crypto side with USDC on Stellar. This repository is the Next.js web client; the API and Stellar integrations live in the [Settla backend](https://github.com/Settla/settla-backend).

> **Network status:** the app defaults to Stellar Testnet. Testnet balances and transactions have no real-world value. Mainnet behavior depends on deployment configuration and should not be inferred from this source tree alone.

## Table of Contents

- [What the app does](#what-the-app-does)
- [How Settla uses Stellar](#how-settla-uses-stellar)
- [Architecture and code map](#architecture-and-code-map)
- [Prerequisites](#prerequisites)
- [Run locally](#run-locally)
- [Quality checks](#quality-checks)
- [Environment variables](#environment-variables)
- [Contributing](#contributing)
- [Security and trust](#security-and-trust)

## What the app does

- Connects Stellar wallets through [Stellar Wallets Kit](https://github.com/Creit-Tech/Stellar-Wallets-Kit), including Freighter, LOBSTR, Albedo, xBull, Rabet, and Hana.
- Lets users sign a short-lived wallet challenge to authenticate without entering a private key into Settla.
- Provides a peer-to-peer offer and order flow with counterparty chat, local payment instructions, evidence uploads, and escrow status.
- Prepares direct USDC sends to a Stellar address or Settla alias, requests the user's wallet signature, and shows the resulting transaction status.
- Shows wallet balances, activity, transaction history, profile, and security settings.

## How Settla uses Stellar

The browser delegates wallet connection, network checks, message signing, and transaction signing to Stellar Wallets Kit. The backend never receives a user's wallet secret through this flow.

```mermaid
sequenceDiagram
    participant User
    participant App as Settla web app
    participant Wallet as Stellar wallet
    participant API as Settla API
    participant Stellar as Stellar network
    User->>App: Connect wallet
    App->>Wallet: Request public key and network
    User->>Wallet: Approve connection
    App->>API: Request one-time auth challenge
    API-->>App: Challenge
    App->>Wallet: Request challenge signature
    Wallet-->>App: Signed challenge
    App->>API: Verify signature and create session
    API-->>App: Session token
    App->>API: Prepare USDC payment
    API-->>App: Unsigned transaction XDR
    App->>Wallet: Request transaction signature
    Wallet-->>App: Signed XDR
    App->>API: Submit signed transaction
    API->>Stellar: Broadcast transaction
```

For peer-to-peer trades, the API coordinates a USDC multi-release escrow through Trustless Work on Soroban. A configured platform operator key signs escrow deployment; the seller's wallet signs the funding transaction. Local fiat payments happen between the users outside Stellar. Stellar escrow state and API order state are synchronized for the app to display. The platform signer and the external escrow integration are important trust assumptions; this client is not itself an escrow contract.

For protocol background, see Stellar's [developer documentation](https://developers.stellar.org/docs), [Horizon API guide](https://developers.stellar.org/docs/data/apis/horizon), and [Stellar RPC guide](https://developers.stellar.org/docs/data/apis/rpc).

### On-chain and off-chain responsibilities

| Activity | Where it happens |
| --- | --- |
| Wallet connection and user transaction signatures | User-selected Stellar wallet |
| USDC transfers and escrow state | Stellar; escrow orchestration uses Trustless Work |
| Offers, order chat, payment instructions, and evidence | Settla API and configured storage |
| Local bank or cash payment | Between the two users, outside Stellar |

Escrow currently accepts USDC. The application has no in-app on-chain refund operation; cancelling an order must not be described as reversing funds already deposited into escrow.

## Architecture and code map

- `src/app/` — Next.js App Router pages, public information pages, and protected product screens.
- `src/features/wallet/` — wallet providers, network validation, authentication, and transaction signing.
- `src/features/offer/`, `src/features/order/`, `src/features/escrow/`, `src/features/chat/` — marketplace and trade workflows.
- `src/features/transactions/`, `src/features/dashboard/`, `src/features/settings/` — wallet activity and account experience.
- `src/features/user/` — user models, account setup, and shared user context.
- `src/features/notifications/` — notification state, deduplication, and toast components.
- `src/features/market-data/` — USDC price fetching, response types, and price formatting.
- `src/features/paymentMethod/` — payment providers, saved payment methods, and payee-details validation.
- `src/features/stats/` — marketplace statistics models and data hooks.
- `src/app/api/market-data/usdc-price/route.ts` — the `GET /api/market-data/usdc-price` server route that proxies USDC/USD prices from CoinGecko.
- `src/config/demo-mode.ts` — the build-time flag controlling demo-only data and routes.
- `src/utils/keyboardNavigation.ts` — shared roving-focus keyboard navigation helpers.
- `src/lib/` — API client and shared integration helpers.
- `public/` — static assets and Settla brand marks.

Feature folders under `src/features/<name>/` use `models/`, `hooks/`, `components/`, `services/`, `types/`, and `utils/` as needed. Not every feature needs every directory; some also keep React context in `context/` or `presentation/context/`, with tests beside the code or in `__tests__/`.

The public pages in the app also describe the current project: `/info`, `/info/features`, and `/info/security`.

## Prerequisites

| Tool | Notes |
| --- | --- |
| **Node.js** | 20+ and npm |
| **A Stellar wallet** | Freighter, xBull, Albedo, LOBSTR, Rabet, or Hana |
| **Settla API** | running locally or a deployed URL |

## Run locally

Requirements: Node.js 20+ and pnpm. Start the backend separately; see its [setup guide](https://github.com/Settla/settla-backend#local-development).

```bash
pnpm install
cp .env.example .env.local
```

Set the API URL and Stellar network in `.env.local`:

```dotenv
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_STELLAR_NETWORK=TESTNET
```

Then run the app at `http://localhost:3000`:

```bash
pnpm dev
```

Do not put wallet secrets or server credentials in `NEXT_PUBLIC_*` values; Next.js exposes those values to the browser. For demo-only UI validation, `NEXT_PUBLIC_DEMO_MODE` is disabled by default and should not be enabled in production.

## Quality checks

```bash
pnpm lint       # ESLint
pnpm test       # Vitest and Testing Library
pnpm build      # Production build
pnpm analyze    # Build with bundle analysis
```

Tests use `*.test.ts` or `*.test.tsx` and commonly live beside the feature or in `__tests__/`. Add coverage for wallet network handling, user-signature flows, API errors, and order state changes when touching those paths.

## Environment variables

Copy `.env.example` to `.env` and fill in your values (see the file for inline docs). Key groups:

| Variable group | Key variables |
| --- | --- |
| API | `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_TRUSTLESS_WORK_API_URL`, `NEXT_PUBLIC_TRUSTLESS_WORK_API_KEY` |
| Stellar | `NEXT_PUBLIC_USDC_ISSUER`, `NEXT_PUBLIC_STELLAR_NETWORK` |
| Demo | `NEXT_PUBLIC_DEMO_MODE` |

## Contributing

Read [CONTRIBUTING.md](CONTRIBUTING.md) before opening a pull request. Keep frontend and backend API changes coordinated, describe user impact, link the relevant issue, and include screenshots for visible UI changes. Drips Wave participation requires repository application and organizer approval; see the [maintainer guide](https://docs.drips.network/wave/maintainers/participating-in-a-wave/) for the process.

## Security and trust

Never request or commit a wallet secret, recovery phrase, token, or real user payment data. User transaction signing is requested from the connected wallet. Escrow deployment also depends on a separately configured platform operator key in the backend, so deployments must secure and restrict that key. See the [backend architecture notes](https://github.com/Settla/settla-backend/blob/main/docs/architecture.md) for the complete trust boundary.

## License

Settla is licensed under the MIT License. See [LICENSE](LICENSE).
