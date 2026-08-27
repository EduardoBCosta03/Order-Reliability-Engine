# Architecture

## System boundary

Order Reliability Engine models a checkout orchestration boundary rather than an entire commerce platform.

The system accepts orders, protects inventory invariants, delegates payment work asynchronously, reacts to payment outcomes, and records enough operational context to explain what happened.

## Components

### API

The NestJS API is the source of truth for order lifecycle state and transactional rules.

Responsibilities:

- accept and validate order requests
- enforce idempotent creation
- reserve inventory transactionally
- expose order and inventory state
- receive payment callbacks
- apply valid state transitions
- emit work to the payment queue
- expose health and operational endpoints

The API does **not** call the payment provider synchronously during checkout.

### Worker

The worker consumes payment jobs from BullMQ.

Responsibilities:

- execute payment attempts outside the request lifecycle
- call the fake payment gateway over HTTP
- classify transient and permanent failures
- rely on bounded queue retry behavior
- surface exhausted work for operational inspection

### Fake payment gateway

The fake gateway is intentionally separated from the API process so the system experiences it like an external dependency.

It will support deterministic scenarios for:

- success
- transient failure
- permanent failure
- delayed callbacks
- duplicate callbacks

### Web

The Next.js application is an operational demo, not a storefront.

Its purpose is to expose:

- orders
- inventory
- processing events
- failed jobs

Visual polish is secondary to making backend behavior understandable.

## Data ownership

PostgreSQL stores durable application state.

Redis is used for ephemeral queue infrastructure through BullMQ. Redis is not the source of truth for order state.

## Reliability model

### Idempotency

Duplicate client requests and duplicate provider callbacks are expected behavior, not exceptional behavior.

### Concurrency

Inventory correctness must be enforced by the database boundary, using transactions and explicit locking or constraints rather than process-local locks.

### Asynchrony

Payment processing is decoupled from HTTP request latency.

### Compensation

A permanently failed payment after inventory reservation triggers an idempotent stock release and cancellation path.

### Observability

Request correlation IDs, structured logs, job lifecycle logs, and durable processing events allow a failed workflow to be reconstructed.

## Dependency direction

Shared packages contain contracts and pure domain rules. Apps may depend on shared packages; shared packages must not depend on apps.

Infrastructure concerns must not leak into the pure order state machine.
