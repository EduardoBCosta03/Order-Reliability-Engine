# Order Reliability Engine — Design

## Purpose

Order Reliability Engine is a production-oriented portfolio project focused on reliable backend and infrastructure engineering through an order-processing workflow.

The system coordinates order creation, inventory reservation, payment processing, asynchronous jobs, payment callbacks, retries, failure recovery, and final order confirmation. A small web interface exists only to demonstrate and inspect the backend behavior.

The project is intentionally scoped as an engineering system rather than a complete e-commerce product.

## Goals

The repository should demonstrate practical competence with:

- TypeScript and NestJS backend development
- PostgreSQL data modeling and transactional consistency
- Redis and BullMQ for asynchronous processing
- idempotent request and webhook handling
- concurrency control around inventory and order state
- retryable background jobs and failure visibility
- Docker-based local infrastructure
- CI with GitHub Actions
- health checks, structured logs, and operational visibility
- a minimal React/Next.js interface for inspection and demonstration

## Non-goals

The first version will not include:

- a complete storefront
- real payment processing
- multi-tenancy
- Kubernetes
- Kafka
- microservice decomposition for its own sake
- complex authentication or authorization
- recommendation, search, pricing, shipping, or catalog systems

These may only be added later when they demonstrate a specific engineering concern.

## Repository structure

```text
Order-Reliability-Engine/
├── apps/
│   ├── api/
│   ├── worker/
│   ├── fake-gateway/
│   └── web/
├── packages/
│   ├── contracts/
│   └── config/
├── infra/
│   └── docker/
├── docs/
│   ├── architecture.md
│   ├── decisions/
│   └── superpowers/
│       ├── specs/
│       └── plans/
├── .github/
│   └── workflows/
├── compose.yaml
├── .env.example
├── package.json
└── README.md
```

## Components

### API

NestJS HTTP service responsible for:

- creating orders
- exposing order and inventory state
- validating idempotency keys for order creation
- handling payment gateway callbacks
- applying state transitions and transactional invariants
- exposing health endpoints

The API must not perform simulated payment processing inline.

### Worker

BullMQ worker responsible for asynchronous operations, initially:

- processing queued payment attempts
- calling the fake payment gateway
- retrying transient failures
- surfacing exhausted jobs as failed work

The worker shares contracts with the API but owns its execution logic independently.

### Fake payment gateway

A local service used to simulate an external dependency.

It supports deterministic success and failure scenarios so the project can demonstrate:

- asynchronous payment completion
- delayed callbacks
- duplicate callbacks
- transient failures
- permanent failures

The gateway must behave like an external system from the application's perspective rather than being implemented as a direct function call inside the API.

### Web

Minimal React/Next.js interface.

Initial screens:

- Orders
- Inventory
- Event / processing history
- Failed jobs

The UI is an operational demo, not a storefront.

## Initial order flow

```text
POST /orders
    |
    v
CREATED
    |
    v
INVENTORY_RESERVED
    |
    v
PAYMENT_PENDING
    |
    v
payment job queued
    |
    v
fake gateway
    |
    v
payment callback
    |
    +---- success ----> CONFIRMED
    |
    +---- failure ----> PAYMENT_FAILED -> inventory released -> CANCELLED
```

## Reliability concerns

### Idempotency

Order creation accepts an idempotency key.

Repeated requests with the same key and equivalent payload must return the existing operation result rather than create a second order.

Payment callbacks must also be safe to process more than once.

### Concurrency

Inventory reservation must remain correct when multiple order requests attempt to reserve the same stock concurrently.

The implementation should prefer database transactions and explicit constraints or locking over process-local mutexes.

### Asynchronous processing

Payment attempts are handled through BullMQ.

Transient failures are retried using a bounded retry policy. Exhausted jobs remain inspectable rather than disappearing silently.

### State transitions

Order transitions must be explicit and validated. Invalid transitions are rejected.

The order aggregate is the source of truth for its current lifecycle state.

### Failure recovery

If payment permanently fails after inventory reservation, reserved stock is released and the order is cancelled.

Recovery actions must also be idempotent.

## Data model — first version

Core entities:

- Order
- OrderItem
- Product
- Inventory
- PaymentAttempt
- IdempotencyRecord
- ProcessingEvent

Exact Prisma schema details belong to the implementation plan, but the model must preserve:

- immutable order item price snapshots
- auditable order state transitions
- payment attempt history
- unique idempotency keys
- safe inventory reservation semantics

## Observability

The first public version should include:

- structured application logs
- request correlation IDs
- health endpoint
- worker and job lifecycle logging
- processing events visible in the demo UI

Metrics and tracing may be added after the primary workflow is stable.

## Local development

The repository should run from a documented local workflow with Docker Compose providing infrastructure dependencies.

Expected developer experience:

1. install JavaScript dependencies
2. copy `.env.example`
3. start PostgreSQL and Redis with Docker Compose
4. run database migrations
5. start API, worker, fake gateway, and web
6. exercise the checkout flow from the UI or HTTP API

## CI

GitHub Actions should initially verify:

- dependency installation
- lint
- type checking
- unit tests
- integration tests
- build

CI should grow with the project rather than contain placeholder jobs.

## Testing strategy

The project should favor behavior-oriented tests around reliability boundaries.

Priority coverage:

1. order state transitions
2. idempotent order creation
3. concurrent inventory reservation
4. duplicate payment callbacks
5. payment retry behavior
6. compensation after permanent payment failure
7. end-to-end happy path

## Delivery phases

### Phase 1 — Recruiter-ready foundation

- repository structure
- serious README
- workspace/tooling configuration
- API, worker, web, and fake gateway skeletons
- PostgreSQL and Redis via Docker Compose
- CI baseline
- health checks

### Phase 2 — Reliable order flow

- order model and API
- inventory reservation
- idempotent order creation
- BullMQ payment workflow
- fake gateway
- callback handling
- retries and compensation
- tests for failure and concurrency cases

### Phase 3 — Operational demo

- minimal web interface
- order and inventory inspection
- processing event timeline
- failed-job visibility
- improved logs and operational documentation

## Success criteria

A recruiter or engineer opening the repository should be able to understand within roughly 30 seconds:

- what problem the system solves
- why reliability is the central engineering concern
- which technologies are used
- how to run it
- where to inspect architecture and tests

A technical interviewer should be able to use the repository to discuss concrete decisions around idempotency, transactions, queues, retries, concurrency, failure recovery, observability, and CI/CD.
