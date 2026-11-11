import { useEffect, useState, type FormEvent } from "react";

type Page =
  | "home"
  | "product"
  | "industries"
  | "features"
  | "pricing"
  | "about"
  | "contact"
  | "register"
  | "login"
  | "docs";

type Plan = {
  code: string;
  name: string;
  description: string | null;
  priceMinor: number;
  currency: string;
  interval: string;
};

const API = (import.meta.env.VITE_API_URL as string | undefined) ?? "http://127.0.0.1:3001/v1";
const ADMIN_URL = (import.meta.env.VITE_ADMIN_URL as string | undefined) ?? "http://127.0.0.1:5175";
const PLATFORM_URL =
  (import.meta.env.VITE_PLATFORM_URL as string | undefined) ?? "http://127.0.0.1:5175/platform";

const NAV: Array<{ id: Page; label: string }> = [
  { id: "home", label: "Home" },
  { id: "product", label: "Product" },
  { id: "industries", label: "Industries" },
  { id: "features", label: "Features" },
  { id: "pricing", label: "Pricing" },
  { id: "about", label: "About" },
  { id: "contact", label: "Contact" },
  { id: "docs", label: "Help" },
];

export function App() {
  const [page, setPage] = useState<Page>("home");

  return (
    <div className="shell">
      <header className="nav">
        <button type="button" className="brand" onClick={() => setPage("home")}>
          SokoOS
        </button>
        <nav className="nav-links" aria-label="Primary">
          {NAV.map((n) => (
            <button
              key={n.id}
              type="button"
              className={page === n.id ? "active" : undefined}
              onClick={() => setPage(n.id)}
            >
              {n.label}
            </button>
          ))}
          <button type="button" onClick={() => setPage("register")}>
            Register
          </button>
          <button type="button" onClick={() => setPage("login")}>
            Login
          </button>
        </nav>
      </header>

      {page === "home" ? <Home onGo={setPage} /> : null}
      {page === "product" ? (
        <Section title="Product overview" lead="One operating system for sales, stock, teams, and industry workflows — with a platform control plane for SokoOS operators.">
          <p>
            Tenant Admin and POS stay dedicated apps. Subdomains map each business to its environment. Platform
            administration lives separately and never shares tenant cookies.
          </p>
        </Section>
      ) : null}
      {page === "industries" ? (
        <Section title="Industries" lead="Feature packs — not separate products.">
          <p>Retail, restaurant, hotel, pharmacy, wholesale, hardware/electronics, and services share commerce primitives with additive domain tables.</p>
        </Section>
      ) : null}
      {page === "features" ? (
        <Section title="Features" lead="Built for multi-branch African retail and hospitality.">
          <ul>
            <li>Offline-capable POS with sync</li>
            <li>Inventory movements and warehouses</li>
            <li>Departments, roles, and configuration inheritance</li>
            <li>Paid plans and entitlements</li>
            <li>Central + tenant support</li>
          </ul>
        </Section>
      ) : null}
      {page === "pricing" ? <Pricing /> : null}
      {page === "about" ? (
        <Section title="About" lead="SokoOS is a centrally managed commercial SaaS business operating system.">
          <p>We host the cloud control plane; businesses run on verified tenant subdomains with isolation enforced server-side.</p>
        </Section>
      ) : null}
      {page === "contact" ? (
        <Section title="Contact" lead="Talk to us about onboarding or enterprise domains.">
          <p>Email support@sokoos.com (configure in production). Existing clients use in-app Support.</p>
        </Section>
      ) : null}
      {page === "docs" ? (
        <Section title="Documentation & help" lead="Operator and tenant help.">
          <div className="entry-links">
            <a className="btn btn-ghost" href={`${ADMIN_URL}/activate`}>
              Activate invitation
            </a>
            <a className="btn btn-ghost" href={PLATFORM_URL}>
              Platform administration
            </a>
          </div>
        </Section>
      ) : null}
      {page === "register" ? <Register /> : null}
      {page === "login" ? <LoginLinks /> : null}
    </div>
  );
}

function Home({ onGo }: { onGo: (p: Page) => void }) {
  return (
    <>
      <section className="hero">
        <h1>SokoOS</h1>
        <p>The business operating system for modern shops, restaurants, and multi-branch teams.</p>
        <div className="cta-row">
          <button type="button" className="btn btn-primary" onClick={() => onGo("register")}>
            Start registration
          </button>
          <button type="button" className="btn btn-ghost" onClick={() => onGo("pricing")}>
            View pricing
          </button>
        </div>
      </section>
      <Section title="Clear entry points" lead="Choose how you enter the platform.">
        <div className="entry-links">
          <a className="btn btn-primary" href={ADMIN_URL}>
            Existing clients — Admin login
          </a>
          <button type="button" className="btn btn-ghost" onClick={() => onGo("register")}>
            Prospective businesses — Register
          </button>
          <a className="btn btn-ghost" href={PLATFORM_URL}>
            Platform administration
          </a>
        </div>
      </Section>
    </>
  );
}

function Section({
  title,
  lead,
  children,
}: {
  title: string;
  lead: string;
  children: React.ReactNode;
}) {
  return (
    <section className="section">
      <h2>{title}</h2>
      <p className="lead">{lead}</p>
      {children}
    </section>
  );
}

function Pricing() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void fetch(`${API}/public/plans`)
      .then(async (r) => {
        if (!r.ok) throw new Error("Unable to load plans");
        const json = (await r.json()) as { data: Plan[] };
        setPlans(json.data);
      })
      .catch((e: Error) => setError(e.message));
  }, []);

  return (
    <Section title="Pricing" lead="Plans come from live catalog records — not hardcoded marketing copies.">
      {error ? <p className="msg err">{error}</p> : null}
      <div className="plan-grid">
        {plans.map((p) => (
          <article key={p.code} className="plan">
            <h3>{p.name}</h3>
            <p className="price">
              {(p.priceMinor / 100).toLocaleString(undefined, {
                style: "currency",
                currency: p.currency,
              })}
              <span style={{ fontSize: "0.9rem", fontWeight: 400 }}> / {p.interval}</span>
            </p>
            <p>{p.description}</p>
          </article>
        ))}
      </div>
    </Section>
  );
}

function Register() {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    setMsg(null);
    const fd = new FormData(e.currentTarget);
    const body = {
      businessName: String(fd.get("businessName") ?? ""),
      legalName: String(fd.get("legalName") ?? "") || undefined,
      contactName: String(fd.get("contactName") ?? ""),
      email: String(fd.get("email") ?? ""),
      phone: String(fd.get("phone") ?? "") || undefined,
      country: String(fd.get("country") ?? "KE"),
      industry: String(fd.get("industry") ?? "retail"),
      businessSize: String(fd.get("businessSize") ?? "small"),
      preferredSlug: String(fd.get("preferredSlug") ?? "").toLowerCase(),
      requestedModules: [String(fd.get("industry") ?? "retail")],
    };
    try {
      const res = await fetch(`${API}/public/registrations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = (await res.json()) as {
        data?: { request: { id: string }; emailVerifyToken?: string };
        error?: { message: string };
      };
      if (!res.ok) throw new Error(json.error?.message ?? "Registration failed");
      setMsg(
        `Registration received (${json.data?.request.id}). Check email to verify. Dev token: ${json.data?.emailVerifyToken ?? "sent via mail"}`,
      );
      e.currentTarget.reset();
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Section title="Register your business" lead="Self-registration requires email verification and platform approval before provisioning.">
      <form className="form" onSubmit={(e) => void onSubmit(e)}>
        <label>
          Business name
          <input name="businessName" required minLength={2} />
        </label>
        <label>
          Legal name
          <input name="legalName" />
        </label>
        <label>
          Contact person
          <input name="contactName" required minLength={2} />
        </label>
        <label>
          Email
          <input name="email" type="email" required />
        </label>
        <label>
          Phone
          <input name="phone" />
        </label>
        <label>
          Country
          <input name="country" defaultValue="KE" />
        </label>
        <label>
          Industry
          <select name="industry" defaultValue="retail">
            <option value="retail">Retail</option>
            <option value="restaurant">Restaurant</option>
            <option value="hotel">Hotel</option>
            <option value="pharmacy">Pharmacy</option>
            <option value="wholesale">Wholesale</option>
            <option value="hardware">Hardware</option>
            <option value="services">Services</option>
          </select>
        </label>
        <label>
          Business size
          <select name="businessSize" defaultValue="small">
            <option value="solo">Solo</option>
            <option value="small">Small</option>
            <option value="medium">Medium</option>
            <option value="enterprise">Enterprise</option>
          </select>
        </label>
        <label>
          Preferred tenant slug
          <input name="preferredSlug" required minLength={2} pattern="[a-z0-9]+(?:-[a-z0-9]+)*" />
        </label>
        <button className="btn btn-primary" type="submit" disabled={busy}>
          {busy ? "Submitting…" : "Submit registration"}
        </button>
        {err ? <p className="msg err">{err}</p> : null}
        {msg ? <p className="msg ok">{msg}</p> : null}
      </form>
    </Section>
  );
}

function LoginLinks() {
  return (
    <Section title="Login" lead="Use your business hostname in production. Local demos use the Admin app.">
      <div className="entry-links">
        <a className="btn btn-primary" href={`${ADMIN_URL}/login`}>
          Client Admin login
        </a>
        <a className="btn btn-ghost" href={PLATFORM_URL}>
          Platform operators
        </a>
      </div>
    </Section>
  );
}
