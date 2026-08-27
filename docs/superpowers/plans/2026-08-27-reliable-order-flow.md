# Reliable Order Flow Implementation Plan

**Goal:** Implement the first end-to-end reliability path for Order Reliability Engine: durable order data, concurrency-safe inventory reservation, idempotent creation, queued payment work, payment callbacks, and compensation.

**Branch:** `feat/reliable-order-flow`

## Milestone 1 — Durable inventory and concurrency

- Add Prisma and the initial PostgreSQL schema.
- Add migrations for Product, Inventory, Order, OrderItem, IdempotencyRecord, PaymentAttempt, and ProcessingEvent.
- Prove with an integration test that two concurrent reservations cannot consume the same final unit of stock.
- Implement reservation with an atomic database update inside a transaction.
- Ensure multi-item reservation can roll back as a unit.

## Milestone 2 — Idempotent order creation

- Add `POST /orders`.
- Require `Idempotency-Key`.
- Persist a request hash with the key.
- Return the existing order for the same key and same payload.
- Reject reuse of a key with a different payload.
- Reserve inventory and create the order in one transaction boundary where practical.

## Milestone 3 — Asynchronous payment

- Enqueue payment work in BullMQ.
- Make the worker call the fake gateway over HTTP.
- Support deterministic success, transient failure, and permanent failure.
- Bound retries and retain failed jobs for inspection.

## Milestone 4 — Callback safety and compensation

- Receive payment callbacks.
- Deduplicate callback event IDs.
- Confirm paid orders exactly once.
- Mark permanent failures and release reserved stock idempotently.
- Record processing events with correlation IDs.

## Milestone 5 — Verification and demo

- Add integration tests for duplicate order requests.
- Add integration tests for duplicate callbacks.
- Add end-to-end happy and failure paths.
- Wire operational UI to real API state.
- Update README only with behavior proven by tests.
