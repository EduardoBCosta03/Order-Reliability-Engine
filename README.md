# Order Reliability Engine

[![CI](https://github.com/EduardoBCosta03/Order-Reliability-Engine/actions/workflows/ci.yml/badge.svg)](https://github.com/EduardoBCosta03/Order-Reliability-Engine/actions/workflows/ci.yml)

A production-oriented order processing system built to explore the failure modes that make checkout systems difficult in the real world: **duplicate requests, concurrent inventory updates, asynchronous payments, retries, compensation, and operational visibility**.

> **Status:** Phase 1 foundation is implemented. The end-to-end reliable order flow is the next phase.

## Implemented foundation

- pnpm TypeScript monorepo with explicit runtime boundaries
- NestJS API with `GET /health`
- request correlation ID generation and propagation
- separate NestJS fake payment gateway with `GET /health`
- BullMQ payment worker boundary and Redis connection parsing
- tested shared order state machine
- PostgreSQL and Redis local infrastructure through Docker Compose
- GitHub Actions pipeline for lint, typecheck, tests, and production builds
- minimal Next.js operational dashboard shell
- architecture documentation and ADRs

## Reliability problems this project targets

The next implementation phase builds the actual order workflow around:

- idempotent order creation and payment callbacks
- database-backed concurrency control for inventory
- asynchronous payment processing through BullMQ
- bounded retries for transient dependency failures
- compensation after permanent payment failure
- durable processing events and operational visibility

Those behaviors are intentionally **not** presented as complete until their tests and implementations land.

## Architecture

```text
                    +------------------+
                    |   Next.js Web    |
                    +--------+---------+
                             |
                             v
+-------------+      +-------+--------+       +----------------+
| PostgreSQL  | <--> |   NestJS API   | ----> | Redis / BullMQ |
+-------------+      +-------+--------+       +-------+--------+
                             ^                        |
                             |                        v
                             |                +-------+--------+
                             |                | Payment Worker |
                             |                +-------+--------+
                             |                        |
                             |                        v
                             |                +-------+--------+
                             +----------------| Fake Gateway   |
                              payment callback+----------------+
```

The API owns order state and transactional invariants. Payment work is queued rather than performed inside HTTP requests. The fake gateway is a separate runtime so failures, retries, and callbacks can be modeled as interactions with an external dependency.

See [docs/architecture.md](docs/architecture.md) for component boundaries and [the design spec](docs/superpowers/specs/2026-08-27-order-reliability-engine-design.md) for the full project intent.

## Order lifecycle

The shared state machine is already implemented and tested:

```text
CREATED
  -> INVENTORY_RESERVED
  -> PAYMENT_PENDING
      -> CONFIRMED
      -> PAYMENT_FAILED
          -> CANCELLED
```

Invalid state jumps are rejected by the domain rule.

## Repository layout

```text
apps/
  api/            NestJS HTTP API
  worker/         BullMQ background worker
  fake-gateway/   simulated external payment provider
  web/            minimal operational UI
packages/
  contracts/      shared domain contracts and state-machine rules
docs/
  architecture.md
  decisions/
  superpowers/
.github/
  workflows/
```

## Run locally

Requirements:

- Node.js 22+
- pnpm 10+
- Docker with Compose

Install dependencies:

```bash
pnpm install
```

Start PostgreSQL and Redis:

```bash
cp .env.example .env
docker compose up -d
```

Run the available applications in separate terminals:

```bash
pnpm --filter @ore/api dev
pnpm --filter @ore/worker dev
pnpm --filter @ore/fake-gateway dev
pnpm --filter @ore/web dev
```

Default local ports:

- Web: `http://localhost:3000`
- API health: `http://localhost:3001/health`
- Fake gateway health: `http://localhost:3002/health`
- PostgreSQL: `localhost:5432`
- Redis: `localhost:6379`

Run the same verification gates used by CI:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

## Engineering decisions

Architecture decisions are recorded in [docs/decisions](docs/decisions) rather than being hidden in implementation details.

The first decision is intentionally boring: keep the system in a monorepo until separate deployment boundaries create a real reason to split it.

## Why this exists

Most checkout demos stop after CRUD. This project starts where CRUD stops being enough.

The useful engineering questions are:

- What happens when a client retries the same request?
- What happens when two orders reserve the last item simultaneously?
- What happens when a payment succeeds but its callback is delivered twice?
- What happens when a dependency fails transiently?
- How do we recover reserved inventory after a permanent payment failure?
- How can an operator understand what happened after the fact?

The repository is being built so each answer is visible in code, tests, and operational behavior rather than only described in a README.
