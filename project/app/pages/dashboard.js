// pages/dashboard.js  (or app/dashboard/page.js)
import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import Products from "./products";
import { Space_Grotesk } from "next/font/google";

const API_BASE =
  process.env.NEXT_PUBLIC_BACKEND_URL ||
  "https://feisty-renewal-production.up.railway.app";

// Load StarsBackground only on client
const StarsBackground = dynamic(() => import("../components/StarsBackground"), {
  ssr: false,
});

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  weight: ["600", "700"],
});

export default function Dashboard() {
  const [status, setStatus] = useState("Not linked");
  const [error, setError] = useState(null);
  const [checkResult, setCheckResult] = useState(null);
  const [checking, setChecking] = useState(false);

  // Category labels (frontend only; server maps label -> collections)
  const CATEGORY_LABELS = [
    "Electronics",
    "Health & Wellness",
    "Home & Kitchen",
    "Toys & Games",
    "Beauty",
    "Grocery",
    "Sports & Outdoors",
    "Pet Supplies",
    "Cleaning Supplies",
    "Hair Care",
    "Spices"
  ];

  // Deals (dropdown only)
  const [deals, setDeals] = useState([]);
  const [dealsLoading, setDealsLoading] = useState(false);
  const [dealsMsg, setDealsMsg] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");

  // Fallback thumbnail
  const FALLBACK_SVG =
    "data:image/svg+xml;utf8," +
    encodeURIComponent(`
      <svg xmlns='http://www.w3.org/2000/svg' width='320' height='200'>
        <rect width='100%' height='100%' fill='#f4f5f7'/>
        <text x='50%' y='50%' dominant-baseline='middle' text-anchor='middle'
              font-family='Inter, Arial, sans-serif' font-size='14' fill='#8b8fa3'>
          No image
        </text>
      </svg>
    `);

  // Sandbox check
  const runSandboxCheck = async () => {
    setChecking(true);
    setError(null);
    setStatus("Contacting Amazon sandbox…");
    try {
      const res = await fetch(`${API_BASE}/spapi/sandbox-check`);
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Sandbox check failed");
      setCheckResult(data);
      setStatus("Sandbox linked ✅");
    } catch (e) {
      setError(e.message);
      setStatus("Failed to link sandbox ❌");
    } finally {
      setChecking(false);
    }
  };

  // After OAuth
  useEffect(() => {
    if (typeof window !== "undefined" && (window.location.search || window.location.hash)) {
      runSandboxCheck();
    }
  }, []);

  const handleLinkFBA = () => {
    window.location.href = `${API_BASE}/auth/login`;
  };

  // Fetch deals by category label; backend maps label -> collections safely
  const fetchDealsByCategory = async (label) => {
    if (!label) return;
    setDealsLoading(true);
    setDealsMsg("");
    setDeals([]);

    try {
      const r = await fetch(`${API_BASE}/api/commerce/matches`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category: label }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error || j?.detail || "Failed to load deals");

      const list = Array.isArray(j.deals) ? j.deals : [];
      setDeals(list);
      if (!list.length) setDealsMsg("No deals yet for this category.");
    } catch (e) {
      setDealsMsg(`Error: ${e.message}`);
    } finally {
      setDealsLoading(false);
    }
  };

  // When user selects a category, fetch deals immediately
  const onCategoryChange = (e) => {
    const cat = e.target.value;
    setSelectedCategory(cat);
    fetchDealsByCategory(cat);
  };

  return (
    <div className="dash-wrap">
      <StarsBackground count={240} />

      <main className="content">
        <div className="card">
          <h1 className={`${spaceGrotesk.className} title`}>Dashboard</h1>
          <p className="subtitle">Welcome back — link your Amazon Seller (FBA) account to continue.</p>

          <div className="actions">
            <button className="primary" onClick={handleLinkFBA}>
              Link FBA Account
            </button>
            <button className="secondary" onClick={runSandboxCheck} disabled={checking}>
              {checking ? "Checking…" : "Refresh Sandbox Check"}
            </button>
          </div>

          <div className="status">
            <strong>Status:</strong> {status}
          </div>
          {error && <pre className="error">{error}</pre>}

          {checkResult && (
            <details className="details">
              <summary>Sandbox check payload</summary>
              <pre>{JSON.stringify(checkResult, null, 2)}</pre>
            </details>
          )}
        </div>

        {checkResult && (
          <div className="products-card">
            <h2 className={`${spaceGrotesk.className} products-title`}>Your Products (Sandbox)</h2>
            <Products apiBase={API_BASE} />
          </div>
        )}

        {/* Deals finder (Dropdown only) */}
        <div className="card">
          <h2 className={`${spaceGrotesk.className} products-title`}>Find Deals (Walmart vs Amazon)</h2>
          <p className="subtitle">Choose a category to fetch example deals.</p>

          <div className="actions" style={{ alignItems: "center" }}>
            <label
              style={{
                display: "flex",
                gap: 8,
                alignItems: "center",
                color: "#fff",
              }}
            >
              Category:
              <select
                value={selectedCategory}
                onChange={onCategoryChange}
                style={{
                  padding: "10px 12px",
                  borderRadius: 8,
                  border: "1px solid rgba(255,255,255,0.3)",
                  background: "rgba(0, 0, 0, 0.45)",
                  color: "#fff",
                  minWidth: 220,
                  appearance: "none",
                  WebkitAppearance: "none",
                  MozAppearance: "none",
                }}
              >
                <option value="" disabled style={{ background: "#151020", color: "#fff" }}>
                  Select a category…
                </option>
                {CATEGORY_LABELS.map((label) => (
                  <option key={label} value={label} style={{ background: "#151020", color: "#fff" }}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {dealsMsg && <div className="status">{dealsMsg}</div>}
          {dealsLoading && <div className="status">Loading deals…</div>}

          <div className="deals-grid">
            {deals.map((d, i) => {
              const wm = d.wm || {};
              const amz = d.amz || {};
              const badge = (d.savings_pct ?? 0) >= 20 ? "20%+ cheaper" : null;
              return (
                <div className="deal-card" key={`${wm.product_id || amz.asin || wm.link || i}`}>
                  <div className="thumb-wrap">
                    <img
                      src={wm.thumbnail || FALLBACK_SVG}
                      alt={wm.title || "thumbnail"}
                      loading="lazy"
                      referrerPolicy="no-referrer"
                      onError={(e) => {
                        e.currentTarget.src = FALLBACK_SVG;
                      }}
                    />
                    {badge && <div className="badge">{badge}</div>}
                  </div>
                  <div className="deal-meta">
                    <a className="deal-title" href={wm.link || "#"} target="_blank" rel="noreferrer" title={wm.title}>
                      {wm.title || "Untitled"}
                    </a>

                    <div className="row">
                      <span className="label">Walmart</span>
                      <span className="price">${Number(wm.price ?? 0).toFixed(2)}</span>
                    </div>
                    <div className="row">
                      <span className="label">Amazon</span>
                      <a className="price linky" href={amz.link || "#"} target="_blank" rel="noreferrer">
                        ${Number(amz.price ?? 0).toFixed(2)}
                      </a>
                    </div>

                    <div className="savings">
                      Save ${Number(d.savings_abs ?? 0).toFixed(2)} ({Number(d.savings_pct ?? 0).toFixed(1)}%)
                    </div>

                    <div className="row tiny">
                      <span>ASIN: {amz.asin || "—"}</span>
                      <span>Category: {wm.category || selectedCategory || "—"}</span>
                    </div>
                    <div className="row tiny">
                      <span>Match: {amz.match_score != null ? Number(amz.match_score).toFixed(2) : "—"}</span>
                      <span>Checked: {amz.checked_at ? new Date(amz.checked_at).toLocaleString() : "—"}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {deals.length === 0 && !dealsLoading && <p className="subtitle">Nothing to show yet.</p>}
        </div>
      </main>

      <style jsx>{`
        :root {
          --card-bg: rgba(22, 16, 34, 0.78);
          --panel-bg: rgba(13, 15, 26, 0.95);
          --panel-border: rgba(255, 255, 255, 0.08);
          --muted: rgba(255, 255, 255, 0.75);
          --accent: #a78bfa;
          --save-bg: rgba(34, 197, 94, 0.1);
          --save-brd: rgba(34, 197, 94, 0.22);
        }

        .dash-wrap {
          position: relative;
          min-height: 100vh;
          background: radial-gradient(1200px 800px at 20% -10%, #4b1d7a 0%, transparent 60%),
            radial-gradient(1200px 800px at 80% -10%, #2a0c52 0%, transparent 60%), #1c0333;
          display: grid;
          place-items: center;
          overflow: hidden;
          padding: 2rem;
        }
        .content {
          position: relative;
          z-index: 1;
          width: min(1120px, 100%);
          display: grid;
          gap: 1.25rem;
        }
        .card,
        .products-card {
          background: var(--card-bg);
          backdrop-filter: blur(8px);
          border: 1px solid var(--panel-border);
          border-radius: 16px;
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.45);
          color: #fff;
          padding: 24px;
        }
        .title {
          font-weight: 700;
          font-size: clamp(2rem, 4vw, 3rem);
          letter-spacing: 0.5px;
          margin: 0 0 0.25rem;
        }
        .subtitle {
          margin: 0.25rem 0 1rem;
          opacity: 0.9;
        }
        .actions {
          display: flex;
          flex-wrap: wrap;
          gap: 0.75rem;
          margin: 1rem 0;
        }
        .primary,
        .secondary {
          border: none;
          border-radius: 12px;
          padding: 12px 16px;
          font-weight: 700;
          cursor: pointer;
          transition: transform 0.2s, box-shadow 0.2s, opacity 0.2s;
        }
        .primary {
          background: linear-gradient(90deg, #8a2be2, #5b21b6);
          color: #fff;
        }
        .secondary {
          background: rgba(255, 255, 255, 0.12);
          color: #fff;
        }
        .primary:hover,
        .secondary:hover {
          transform: translateY(-2px);
          box-shadow: 0 5px 15px rgba(0, 0, 0, 0.35);
        }
        .secondary:disabled,
        .primary:disabled {
          opacity: 0.6;
          cursor: not-allowed;
          transform: none;
          box-shadow: none;
        }
        .status {
          margin-top: 0.5rem;
        }
        .error {
          color: #ffb4b4;
          white-space: pre-wrap;
          margin-top: 0.5rem;
        }
        .details {
          margin-top: 1rem;
        }
        .details pre {
          white-space: pre-wrap;
        }
        .products-title {
          font-weight: 700;
          margin: 0 0 0.5rem;
        }

        /* Responsive dropdown on small screens */
        @media (max-width: 860px) {
          .actions label {
            flex-direction: column;
            align-items: flex-start !important;
          }
          .actions select {
            width: 220px !important;
          }
        }

        /* Deals grid */
        .deals-grid {
          margin-top: 1rem;
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
          gap: 16px;
        }
        .deal-card {
          display: grid;
          grid-template-rows: 180px auto;
          background: rgba(255, 255, 255, 0.04);
          border-radius: 14px;
          overflow: hidden;
          border: 1px solid var(--panel-border);
        }
        .deal-card .thumb-wrap {
          position: relative;
          background: #fff;
          display: grid;
          place-items: center;
          padding: 12px;
        }
        .deal-card .thumb-wrap img {
          max-width: 100%;
          max-height: 160px;
          object-fit: contain;
          display: block;
        }
        .badge {
          position: absolute;
          top: 10px;
          left: 10px;
          background: #22c55e;
          color: #06260d;
          font-weight: 800;
          padding: 6px 10px;
          border-radius: 999px;
          font-size: 0.75rem;
          border: 1px solid rgba(0, 0, 0, 0.15);
        }
        .deal-meta {
          padding: 12px 12px 14px;
          display: grid;
          gap: 8px;
          background: var(--panel-bg);
          border-top: 1px solid var(--panel-border);
          min-height: 175px;
        }
        .deal-title {
          color: #fff;
          text-decoration: none;
          font-weight: 800;
          font-size: 1rem;
          line-height: 1.28;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
        .deal-title:hover {
          text-decoration: underline;
        }
        .row {
          display: flex;
          align-items: baseline;
          justify-content: space-between;
          gap: 12px;
          font-size: 0.96rem;
        }
        .row.tiny {
          font-size: 0.8rem;
          opacity: 0.8;
          display: flex;
          justify-content: space-between;
        }
        .label {
          opacity: 0.82;
          letter-spacing: 0.02em;
        }
        .price {
          font-weight: 900;
        }
        .linky {
          color: var(--accent);
          text-decoration: underline;
          text-underline-offset: 2px;
        }
        .linky:hover {
          opacity: 0.9;
        }
        .savings {
          font-weight: 900;
          color: #8fffbc;
          background: var(--save-bg);
          border: 1px solid var(--save-brd);
          padding: 6px 8px;
          border-radius: 8px;
          font-size: 0.95rem;
        }
      `}</style>

      <style jsx global>{`
        html,
        body,
        #__next {
          height: 100%;
          background: #1b0633;
        }
        body {
          margin: 0;
          overscroll-behavior: none;
        }
        * {
          box-sizing: border-box;
        }
      `}</style>
    </div>
  );
}
