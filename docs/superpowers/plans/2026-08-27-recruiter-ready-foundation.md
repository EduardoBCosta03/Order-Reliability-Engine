# Recruiter-Ready Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first recruiter-ready, runnable foundation of Order Reliability Engine with a monorepo, shared order domain contracts, API/worker/fake-gateway/web applications, local PostgreSQL/Redis infrastructure, CI, health checks, and clear engineering documentation.

**Architecture:** A pnpm workspace hosts four apps (`api`, `worker`, `fake-gateway`, `web`) and shared packages. The API and fake gateway use NestJS; the worker uses NestJS application context plus BullMQ; the UI uses Next.js. PostgreSQL and Redis run through Docker Compose. Shared domain behavior lives in `packages/contracts`, starting with an explicit order state machine.

**Tech Stack:** TypeScript, Node.js 22, pnpm 10, NestJS 11, Next.js 15/React 19, PostgreSQL 17, Redis 7, BullMQ 5, Jest 29, ESLint 9, Docker Compose, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-08-27-order-reliability-engine-design.md`

## Global Constraints

- The first version is an engineering system, not a storefront.
- No real payments, multi-tenancy, Kubernetes, Kafka, or premature microservice decomposition.
- API payment work is never processed inline.
- Order lifecycle transitions are explicit and validated.
- The repository must explain the problem, architecture, local run path, and engineering concerns within roughly 30 seconds.
- All public documentation is written in English.

---

### Task 1: Workspace and recruiter-facing documentation

**Files:**
- Create: `package.json`
- Create: `pnpm-workspace.yaml`
- Create: `tsconfig.base.json`
- Create: `eslint.config.mjs`
- Create: `.gitignore`
- Create: `.env.example`
- Create: `README.md`
- Create: `docs/architecture.md`
- Create: `docs/decisions/001-monorepo.md`
- Create: `compose.yaml`

**Interfaces:**
- Produces: workspace commands `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`; local PostgreSQL on 5432 and Redis on 6379.

- [ ] **Step 1:** Add root pnpm workspace and TypeScript configuration.
- [ ] **Step 2:** Add ESLint flat config for TypeScript/TSX.
- [ ] **Step 3:** Add Docker Compose for PostgreSQL and Redis with health checks.
- [ ] **Step 4:** Add environment template.
- [ ] **Step 5:** Write recruiter-first README and architecture documentation.
- [ ] **Step 6:** Commit as `chore: scaffold monorepo foundation`.

### Task 2: Shared order state machine — RED

**Files:**
- Create: `packages/contracts/package.json`
- Create: `packages/contracts/tsconfig.json`
- Create: `packages/contracts/src/order-status.ts`
- Create: `packages/contracts/src/order-state-machine.spec.ts`
- Create: `packages/contracts/src/index.ts`

**Interfaces:**
- Produces: `OrderStatus`, `canTransition(from, to): boolean`, `assertOrderTransition(from, to): void`.
- Initial allowed lifecycle:
  - CREATED -> INVENTORY_RESERVED
  - INVENTORY_RESERVED -> PAYMENT_PENDING
  - PAYMENT_PENDING -> CONFIRMED
  - PAYMENT_PENDING -> PAYMENT_FAILED
  - PAYMENT_FAILED -> CANCELLED

- [ ] **Step 1: Write the failing tests**

```ts
describe('order state machine', () => {
  it('allows the happy-path transitions', () => {
    expect(canTransition(OrderStatus.CREATED, OrderStatus.INVENTORY_RESERVED)).toBe(true);
    expect(canTransition(OrderStatus.INVENTORY_RESERVED, OrderStatus.PAYMENT_PENDING)).toBe(true);
    expect(canTransition(OrderStatus.PAYMENT_PENDING, OrderStatus.CONFIRMED)).toBe(true);
  });

  it('rejects skipping directly from CREATED to CONFIRMED', () => {
    expect(() => assertOrderTransition(OrderStatus.CREATED, OrderStatus.CONFIRMED))
      .toThrow('Invalid order transition: CREATED -> CONFIRMED');
  });

  it('allows failure compensation path', () => {
    expect(canTransition(OrderStatus.PAYMENT_PENDING, OrderStatus.PAYMENT_FAILED)).toBe(true);
    expect(canTransition(OrderStatus.PAYMENT_FAILED, OrderStatus.CANCELLED)).toBe(true);
  });
});
```

- [ ] **Step 2:** Commit test without implementation as `test: define order lifecycle behavior`.
- [ ] **Step 3:** Run GitHub Actions and verify the test job fails because `canTransition` / `assertOrderTransition` are not implemented.

### Task 3: Shared order state machine — GREEN

**Files:**
- Modify: `packages/contracts/src/order-state-machine.ts`
- Modify: `packages/contracts/src/index.ts`

**Interfaces:**
- Consumes: `OrderStatus`.
- Produces: exact functions from Task 2.

- [ ] **Step 1: Implement minimal transition map**

```ts
const transitions: Record<OrderStatus, readonly OrderStatus[]> = {
  CREATED: [OrderStatus.INVENTORY_RESERVED],
  INVENTORY_RESERVED: [OrderStatus.PAYMENT_PENDING],
  PAYMENT_PENDING: [OrderStatus.CONFIRMED, OrderStatus.PAYMENT_FAILED],
  PAYMENT_FAILED: [OrderStatus.CANCELLED],
  CONFIRMED: [],
  CANCELLED: [],
};
```

- [ ] **Step 2:** Export `canTransition` and `assertOrderTransition`.
- [ ] **Step 3:** Run GitHub Actions and verify contracts tests pass.
- [ ] **Step 4:** Commit as `feat: add explicit order state machine`.

### Task 4: API health and request correlation

**Files:**
- Create: `apps/api/package.json`
- Create: `apps/api/tsconfig.json`
- Create: `apps/api/src/main.ts`
- Create: `apps/api/src/app.module.ts`
- Create: `apps/api/src/health/health.controller.ts`
- Create: `apps/api/src/health/health.controller.spec.ts`
- Create: `apps/api/src/http/correlation-id.middleware.ts`
- Create: `apps/api/src/http/correlation-id.middleware.spec.ts`

**Interfaces:**
- Produces: `GET /health -> { status: "ok", service: "api" }`.
- Produces: `x-correlation-id` response header, preserving incoming header or generating a UUID.

- [ ] **Step 1:** Add failing unit tests for health payload and correlation-id preservation/generation.
- [ ] **Step 2:** Verify CI fails for missing implementations.
- [ ] **Step 3:** Implement the minimal NestJS API.
- [ ] **Step 4:** Verify unit tests and build pass.
- [ ] **Step 5:** Commit as `feat(api): add health and correlation ids`.

### Task 5: Fake payment gateway foundation

**Files:**
- Create: `apps/fake-gateway/package.json`
- Create: `apps/fake-gateway/tsconfig.json`
- Create: `apps/fake-gateway/src/main.ts`
- Create: `apps/fake-gateway/src/app.module.ts`
- Create: `apps/fake-gateway/src/health.controller.ts`
- Create: `apps/fake-gateway/src/health.controller.spec.ts`

**Interfaces:**
- Produces: `GET /health -> { status: "ok", service: "fake-gateway" }`.
- Later payment endpoints will be added in the reliable-order-flow plan.

- [ ] **Step 1:** Write failing health test.
- [ ] **Step 2:** Verify expected CI failure.
- [ ] **Step 3:** Implement minimal gateway app.
- [ ] **Step 4:** Verify green CI.
- [ ] **Step 5:** Commit as `feat(gateway): scaffold fake payment service`.

### Task 6: Worker and queue configuration foundation

**Files:**
- Create: `apps/worker/package.json`
- Create: `apps/worker/tsconfig.json`
- Create: `apps/worker/src/main.ts`
- Create: `apps/worker/src/queue/payment-queue.ts`
- Create: `apps/worker/src/queue/payment-queue.spec.ts`

**Interfaces:**
- Produces: queue constant `PAYMENT_QUEUE = "payment-processing"`.
- Produces: `createRedisConnection(url): Redis` and a worker boot process.
- No payment behavior yet.

- [ ] **Step 1:** Write failing test for queue name and Redis URL parsing/connection options boundary.
- [ ] **Step 2:** Verify expected CI failure.
- [ ] **Step 3:** Implement minimal queue configuration.
- [ ] **Step 4:** Verify green CI.
- [ ] **Step 5:** Commit as `feat(worker): scaffold payment worker`.

### Task 7: Operational web demo foundation

**Files:**
- Create: `apps/web/package.json`
- Create: `apps/web/tsconfig.json`
- Create: `apps/web/next.config.ts`
- Create: `apps/web/app/layout.tsx`
- Create: `apps/web/app/page.tsx`
- Create: `apps/web/app/globals.css`

**Interfaces:**
- Produces a simple operational landing page that explains the project and exposes cards for Orders, Inventory, Processing Events, and Failed Jobs.
- No backend fetching in this phase.

- [ ] **Step 1:** Add minimal Next.js app.
- [ ] **Step 2:** Build in CI.
- [ ] **Step 3:** Commit as `feat(web): add operational demo shell`.

### Task 8: CI baseline

**Files:**
- Create: `.github/workflows/ci.yml`

**Interfaces:**
- Runs on push and pull_request.
- Uses Node 22 and pnpm 10.
- Executes install, lint, typecheck, test, and build.

- [ ] **Step 1:** Add CI workflow with pnpm cache.
- [ ] **Step 2:** Push branch and inspect workflow result.
- [ ] **Step 3:** Fix only real setup/type/test issues revealed by CI.
- [ ] **Step 4:** Commit any CI fixes as `fix: make foundation CI green`.

### Task 9: Foundation completion

**Files:**
- Modify: `README.md` only if commands/status changed during implementation.

**Interfaces:**
- Recruiter can understand project purpose, stack, architecture, and run path.
- All baseline CI checks pass.

- [ ] **Step 1:** Verify GitHub Actions is green.
- [ ] **Step 2:** Verify README does not claim unimplemented payment behavior as complete.
- [ ] **Step 3:** Open a pull request from `feat/recruiter-ready-foundation` to `main` summarizing architecture and verification.
