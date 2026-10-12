import InstanceBadge from "../components/InstanceBadge.jsx";

export default function Home({ instance, instanceLoading, setPage }) {
  return (
    <main className="container home">
      <section className="hero">
        <div className="hero-copy">
          <p className="overline">CLOUD PERFORMANCE LAB</p>
          <h1>
            Built to handle
            <br />
            <em>the unexpected.</em>
          </h1>
          <p className="hero-text">
            A stateless web application designed to demonstrate how Google Cloud
            autoscaling maintains performance under peak traffic.
          </p>
          <div className="hero-actions">
            <button
              className="button primary"
              onClick={() => setPage("performance")}
            >
              Open performance lab <span>→</span>
            </button>
            <button className="button ghost" onClick={() => setPage("status")}>
              View system status
            </button>
          </div>
        </div>
        <div className="hero-panel">
          <div className="system-illustration">
            <div className="cloud">☁</div>
            <div className="route-lines">
              <i />
              <i />
              <i />
            </div>
            <div className="nodes">
              <b>VM</b>
              <b>VM</b>
              <b>VM</b>
            </div>
          </div>
          <InstanceBadge
            hostname={instance?.hostname}
            loading={instanceLoading}
          />
        </div>
      </section>
      <section className="architecture">
        <div>
          <p className="overline">HOW IT WORKS</p>
          <h2>One application. Elastic capacity.</h2>
        </div>
        <div className="architecture-flow">
          <span>Users</span>
          <i>→</i>
          <span>Load Balancer</span>
          <i>→</i>
          <span>Managed Instance Group</span>
          <i>→</i>
          <span>Cloud Monitoring</span>
        </div>
      </section>
      <section className="feature-grid">
        <article>
          <span className="feature-icon">◌</span>
          <h3>Load distribution</h3>
          <p>
            Requests are routed across healthy instances by the Application Load
            Balancer.
          </p>
        </article>
        <article>
          <span className="feature-icon">⌁</span>
          <h3>Measured workload</h3>
          <p>
            Controlled CPU workloads create reproducible traffic conditions for
            testing.
          </p>
        </article>
        <article>
          <span className="feature-icon">↻</span>
          <h3>Self-healing</h3>
          <p>
            Unhealthy instances can be replaced automatically by the Auto
            Scaling Group.
          </p>
        </article>
      </section>
    </main>
  );
}
