const surfaces = [
  {
    title: 'Orders',
    description:
      'Inspect lifecycle state, idempotency keys, and the path from creation to confirmation or cancellation.',
    status: 'Foundation',
  },
  {
    title: 'Inventory',
    description:
      'Observe reservation state and, in the next phase, concurrency-safe stock updates and compensation.',
    status: 'Foundation',
  },
  {
    title: 'Processing Events',
    description:
      'Trace the operational story of each order across API, queue, worker, and payment callbacks.',
    status: 'Foundation',
  },
  {
    title: 'Failed Jobs',
    description:
      'Expose exhausted asynchronous work instead of allowing failed operations to disappear silently.',
    status: 'Foundation',
  },
] as const;

const lifecycle = [
  'CREATED',
  'INVENTORY_RESERVED',
  'PAYMENT_PENDING',
  'CONFIRMED',
] as const;

export default function HomePage() {
  return (
    <main className="shell">
      <header className="hero">
        <p className="eyebrow">Operational demo · Phase 1</p>
        <h1>Order Reliability Engine</h1>
        <p className="lede">
          A checkout orchestration project built around the failures that make
          production systems interesting: duplicate requests, concurrent stock
          updates, asynchronous payments, retries, and compensation.
        </p>
        <div className="statusRow" aria-label="Foundation status">
          <span className="statusDot" aria-hidden="true" />
          <span>Foundation active</span>
          <span className="separator">·</span>
          <span>Order flow implementation is next</span>
        </div>
      </header>

      <section aria-labelledby="surfaces-title">
        <div className="sectionHeading">
          <div>
            <p className="eyebrow">Operational surfaces</p>
            <h2 id="surfaces-title">What the system will expose</h2>
          </div>
          <span className="phaseTag">No storefront</span>
        </div>

        <div className="grid">
          {surfaces.map((surface) => (
            <article className="card" key={surface.title}>
              <div className="cardTop">
                <h3>{surface.title}</h3>
                <span className="badge">{surface.status}</span>
              </div>
              <p>{surface.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="lifecyclePanel" aria-labelledby="lifecycle-title">
        <div>
          <p className="eyebrow">Explicit state machine</p>
          <h2 id="lifecycle-title">Happy-path lifecycle</h2>
          <p className="muted">
            Invalid state jumps are rejected by a shared, tested domain rule.
          </p>
        </div>

        <ol className="lifecycle">
          {lifecycle.map((state, index) => (
            <li key={state}>
              <span className="step">{String(index + 1).padStart(2, '0')}</span>
              <code>{state}</code>
            </li>
          ))}
        </ol>

        <p className="failurePath">
          Failure path: <code>PAYMENT_PENDING</code> →{' '}
          <code>PAYMENT_FAILED</code> → <code>CANCELLED</code>
        </p>
      </section>

      <footer>
        <span>TypeScript · NestJS · PostgreSQL · Redis · BullMQ · Next.js</span>
        <span>Reliability over CRUD.</span>
      </footer>
    </main>
  );
}
