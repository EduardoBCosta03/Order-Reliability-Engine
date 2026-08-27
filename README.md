# Order Reliability Engine

[![CI](https://github.com/EduardoBCosta03/Order-Reliability-Engine/actions/workflows/ci.yml/badge.svg)](https://github.com/EduardoBCosta03/Order-Reliability-Engine/actions/workflows/ci.yml)

A production-oriented order processing system built to explore the failure modes that make checkout systems difficult in the real world: **duplicate requests, concurrent inventory updates, asynchronous payments, retries, compensation, and operational visibility**.

> **Status:** foundation in active development. The repository is being built in public; implemented capabilities are documented separately from planned ones.

## What this project demonstrates

- TypeScript and NestJS backend engineering
- PostgreSQL transactional consistency
- Redis and BullMQ background processing
- idempotent request and callback handling
- explicit order lifecycle transitions
- concurrency-safe inventory reservation
- retry and compensation workflows
- structured operational events and correlation IDs
- Docker-based local infrastructure
- GitHub Actions CI
- a minimal Next.js operational UI

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

The API owns order state and transactional invariants. Payment work is queued rather than performed inside HTTP requests. A separate fake gateway behaves like an external dependency so retries, duplicate callbacks, and failures can be exercised deliberately.

See [docs/architecture.md](docs/architecture.md) for the component boundaries and [the design spec](docs/superpowers/specs/2026-08-27-order-reliability-engine-design.md) for the complete intent.

## Planned order lifecycle

```text
CREATED
  -> INVENTORY_RESERVED
  -> PAYMENT_PENDING
      -> CONFIRMED
      -> PAYMENT_FAILED
          -> CANCELLED
```

Every transition is explicit. Invalid state jumps are rejected.

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
infra/
  docker/
```

## Local infrastructure

Requirements:

- Node.js 22+
- pnpm 10+
- Docker with Compose

Start PostgreSQL and Redis:

```bash
cp .env.example .env
docker compose up -d
```

Install dependencies and run repository checks:

```bash
pnpm install
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Application-specific development commands will be documented as each component becomes executable.

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

Those are the behaviors this repository is designed to make visible and testable.
