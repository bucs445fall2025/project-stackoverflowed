// pages/dashboard.js  (or app/dashboard/page.js)
import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { Space_Grotesk } from "next/font/google";

const API_BASE =
  process.env.NEXT_PUBLIC_BACKEND_URL ||
  "https://feisty-renewal-production.up.railway.app"; // your Node backend (kept for FBA sandbox etc.)

const PYAPI_BASE =
  process.env.NEXT_PUBLIC_PYAPI_URL ||
  "https://diligent-spontaneity-production-d286.up.railway.app"; // your FastAPI (deals, scrape, etc.)

// Load background only on the client
const StarsBackground = dynamic(() => import("../components/StarsBackground"), {
  ssr: false,
});

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  weight: ["600", "700"],
});

export default function Dashboard() {
  // FBA sandbox bits (kept from your original)
  const [status, setStatus] = useState("Not linked");
  const [error, setError] = useState(null);
  const [checkResult, setCheckResult] = useState(null);
  const [checking, setChecking] = useState(false);

  // Admin messages
  const [msg, setMsg] = useState("");

  // Deals state (Walmart vs Amazon)
  const [deals, setDeals] = useState([]);
  const [dealsMsg, setDealsMsg] = useState("");
  const [dealsLoading, setDealsLoading] = useState(false);

  // Simple filters
  const [minPct, setMinPct] = useState(0.2); // 20% cheaper
  const [minAbs, setMinAbs] = useState(5);   // $5 absolute savings
  const [category, setCategory] = useState(""); // optional
  const [limit, setLimit] = useState(24);

  // --- FBA sandbox helpers (unchanged) ---
  const runSandboxCheck = async () => {
    setChecking(true);
    setError(null);
    setStatus("Contacting Amazon sandbox…");
    try {
      const res = await fetch(`${API_BASE}/api/amazon/spapi/sandbox-check`);
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

  useEffect(() => {
    if (typeof window !== "undefined" && (window.location.search || window.location.hash)) {
      runSandboxCheck();
    }
  }, []);

  const handleLinkFBA = () => {
    window.location.href = `${API_BASE}/api/amazon/auth/login`;
  };

  // --- DEALS FETCHER (FastAPI) ---
  const fetchDeals = async () => {
    setDealsLoading(true);
    setDealsMsg("");
    try {
      const params = new URLSearchParams({
        min_pct: String(minPct),
        min_abs: String(minAbs),
        limit: String(limit),
      });
      if (category) params.set("category", category);
      const r = await fetch(`${PYAPI_BASE}/deals/by-category?${params.toString()}`);
      const data = await r.json();
      if (!r.ok) throw new Error(data?.detail || data?.error || "Failed to load deals");
      const arr = Array.isArray(data.deals) ? data.deals : [];
      setDeals(arr);
      if (!arr.length) {
        setDealsMsg("No deals yet — run Ingest → Enrich UPCs → Index Amazon, then refresh deals.");
      }
    } catch (e) {
      setDealsMsg(`Error: ${e.message}`);
    } finally {
      setDealsLoading(false);
    }
  };

  useEffect(() => {
    fetchDeals();
  }, []);

  // --- Admin buttons (call FastAPI directly) ---
  const ingestWalmart = async () => {
    setMsg("Ingesting Walmart via SerpAPI…");
    try {
      const body = { query: "protein powder", pages: 1, max_products: 40, enrich_upc: false, max_detail_calls: 0, delay_ms: 500 };
      const r = await fetch(`${PYAPI_BASE}/walmart/scrape`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data?.detail || data?.error || "Walmart ingest failed");
      setMsg(`Walmart ingest: inserted ${data.inserted}, updated ${data.updated} (processed ${data.total_processed})`);
    } catch (e) {
      setMsg(`Error: ${e.message}`);
    }
  };

  const enrichUPCs = async () => {
    setMsg("Enriching UPCs from Walmart product detail…");
    try {
      const r = await fetch(`${PYAPI_BASE}/walmart/enrich-upc`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ limit: 25, recrawl_hours: 168 }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data?.detail || data?.error || "UPC enrichment failed");
      setMsg(`UPC enrich: checked ${data.checked}, updated ${data.updated}`);
    } catch (e) {
      setMsg(`Error: ${e.message}`);
    }
  };

  const indexAmazon = async () => {
    setMsg("Indexing Amazon offers by UPC…");
    try {
      const r = await fetch(`${PYAPI_BASE}/amazon/index-by-upc`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category: category || null, limit_upcs: 60, recache_hours: 72, max_serp_calls: 25 }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data?.detail || data?.error || "Amazon index failed");
      setMsg(`Amazon index: distinct_upcs ${data.distinct_upcs}, fetched_now ${data.fetched_now}, cached ${data.cached}, failures ${data.failures}`);
    } catch (e) {
      setMsg(`Error: ${e.message}`);
    }
  };

  // --- Render ---
  return (
    <div className="dash-wrap">
      <StarsBackground count={240} />

      <main className="content">
        {/* Top card: FBA link + sandbox */}
        <div className="card">
          <h1 className={`${spaceGrotesk.className} title`}>Dashboard</h1>
          <p className="subtitle">Welcome back — link your Amazon Seller (FBA) account to continue.</p>

          <div className="actions">
            <button className="primary" onClick={handleLinkFBA}>Link FBA Account</button>
            <button className="secondary" onClick={runSandboxCheck} disabled={checking}>
              {checking ? "Checking…" : "Refresh Sandbox Check"}
            </button>
          </div>

          <div className="status"><strong>Status:</strong> {status}</div>
          {error && <pre className="error">{error}</pre>}

          {checkResult && (
            <details className="details">
              <summary>Sandbox check payload</summary>
              <pre>{JSON.stringify(checkResult, null, 2)}</pre>
            </details>
          )}
        </div>

        {/* Admin actions for pipeline */}
        <div className="card">
          <h2 className={`${spaceGrotesk.className} products-title`}>Data Pipeline (Walmart → UPC → Amazon)</h2>
          <p className="subtitle">Use these to populate data, then refresh deals below.</p>
          <div className="actions" style={{ flexWrap: "wrap" }}>
            <button className="secondary" onClick={ingestWalmart}>Ingest Walmart (SerpAPI)</button>
            <button className="secondary" onClick={enrichUPCs}>Enrich UPCs</button>
            <button className="secondary" onClick={indexAmazon}>Index Amazon by UPC</button>
            <button className="primary" onClick={fetchDeals} disabled={dealsLoading}>
              {dealsLoading ? "Loading Deals…" : "Refresh Deals"}
            </button>
          </div>
          {msg && <div className="status">{msg}</div>}
        </div>

        {/* Deals Grid */}
        <div className="card">
          <h2 className={`${spaceGrotesk.className} products-title`}>Deals (Walmart vs Amazon)</h2>
          <p className="subtitle">Items where Walmart is cheaper than Amazon by your thresholds.</p>

          {/* Controls */}
          <div className="actions" style={{ alignItems: "center" }}>
            <label style={{ display: "flex", gap: 8, alignItems: "center", color: "#fff" }}>
              Category:
              <input
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="optional (e.g., Electronics)"
                style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.2)", background: "rgba(255,255,255,0.08)", color: "#fff"}}
              />
            </label>
            <label style={{ display: "flex", gap: 8, alignItems: "center", color: "#fff" }}>
              Min %:
              <input
                type="number"
                step="0.05"
                min="0"
                value={minPct}
                onChange={(e) => setMinPct(parseFloat(e.target.value || "0"))}
                style={{ width: 90, padding: "8px 10px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.2)", background: "rgba(255,255,255,0.08)", color: "#fff"}}
              />
            </label>
            <label style={{ display: "flex", gap: 8, alignItems: "center", color: "#fff" }}>
              Min $:
              <input
                type="number"
                step="1"
                min="0"
                value={minAbs}
                onChange={(e) => setMinAbs(parseFloat(e.target.value || "0"))}
                style={{ width: 90, padding: "8px 10px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.2)", background: "rgba(255,255,255,0.08)", color: "#fff"}}
              />
            </label>
            <label style={{ display: "flex", gap: 8, alignItems: "center", color: "#fff" }}>
              Limit:
              <input
                type="number"
                step="1"
                min="1"
                max="200"
                value={limit}
                onChange={(e) => setLimit(parseInt(e.target.value || "24", 10))}
                style={{ width: 90, padding: "8px 10px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.2)", background: "rgba(255,255,255,0.08)", color: "#fff"}}
              />
            </label>
            <button className="primary" onClick={fetchDeals} disabled={dealsLoading}>
              {dealsLoading ? "Loading…" : "Apply Filters"}
            </button>
          </div>

          {dealsMsg && <div className="status">{dealsMsg}</div>}

          <div className="grid">
            {deals.map((d, i) => {
              const wm = d.wm || {};
              const amz = d.amz || {};
              const badge = d.savings_pct >= 20 ? "20%+ cheaper" : null;
              return (
                <div className="deal-card" key={`${wm.upc || wm.link || amz.asin || i}`}>
                  <div className="thumb-wrap">
                    {wm.thumbnail ? (
                      <img src={wm.thumbnail} alt={wm.title || "thumbnail"} />
                    ) : (
                      <div className="no-thumb">No image</div>
                    )}
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
                      <span>UPC: {wm.upc || "—"}</span>
                      <span>ASIN: {amz.asin || "—"}</span>
                    </div>

                    <div className="row tiny">
                      <span>Category: {wm.category || "—"}</span>
                      <span>Checked: {amz.checked_at ? new Date(amz.checked_at).toLocaleString() : "—"}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {deals.length === 0 && !dealsLoading && (
            <p className="subtitle">Nothing to show yet.</p>
          )}
        </div>
      </main>

      {/* styles */}
      <style jsx>{`
        .dash-wrap {
          position: relative;
          min-height: 100vh;
          background: linear-gradient(135deg, #360f5a, #1c0333);
          display: grid;
          place-items: center;
          overflow: hidden;
          padding: 2rem;
        }
        .content {
          position: relative;
          z-index: 1;
          width: min(1100px, 100%);
          display: grid;
          gap: 1.25rem;
        }
        .card {
          background: rgba(255, 255, 255, 0.05);
          backdrop-filter: blur(10px);
          border-radius: 16px;
          box-shadow: 0 0 30px rgba(0, 0, 0, 0.5);
          color: white;
          padding: 24px;
        }
        .title {
          font-weight: 700;
          font-size: clamp(2rem, 4vw, 3rem);
          letter-spacing: 0.5px;
          margin: 0 0 0.5rem;
          text-shadow: 0 0 24px rgba(255, 255, 255, 0.2), 0 2px 12px rgba(0, 0, 0, 0.6);
        }
        .subtitle { margin: 0.25rem 0 1rem; opacity: 0.9; }
        .actions {
          display: flex; gap: 0.75rem; margin: 1rem 0; flex-wrap: wrap;
        }
        .primary, .secondary {
          border: none; border-radius: 12px; padding: 12px 16px;
          font-weight: 700; cursor: pointer;
          transition: transform 0.2s, box-shadow 0.2s, opacity 0.2s;
        }
        .primary { background: linear-gradient(90deg, #8a2be2, #4b0082); color: #fff; }
        .secondary { background: rgba(255, 255, 255, 0.12); color: #fff; }
        .primary:hover, .secondary:hover {
          transform: translateY(-2px); box-shadow: 0 5px 15px rgba(0,0,0,0.3);
        }
        .secondary:disabled, .primary:disabled {
          opacity: 0.6; cursor: not-allowed; transform: none; box-shadow: none;
        }
        .status { margin-top: 0.5rem; }
        .error { color: #ffb4b4; white-space: pre-wrap; margin-top: 0.5rem; }
        .details { margin-top: 1rem; }
        .details pre { white-space: pre-wrap; }

        /* Deals grid */
        .grid {
          margin-top: 1rem;
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
          gap: 14px;
        }
        .deal-card {
          display: grid;
          grid-template-rows: 180px auto;
          background: rgba(255,255,255,0.04);
          border-radius: 12px;
          overflow: hidden;
          border: 1px solid rgba(255,255,255,0.06);
        }
        .thumb-wrap {
          position: relative;
          background: rgba(0,0,0,0.25);
          display: grid; place-items: center;
        }
        .thumb-wrap img {
          max-width: 100%; max-height: 100%; object-fit: contain; display: block;
        }
        .badge {
          position: absolute; top: 10px; left: 10px;
          background: #22c55e; color: #0b1a0b; font-weight: 800;
          padding: 6px 10px; border-radius: 999px; font-size: 0.75rem;
        }
        .no-thumb { color: rgba(255,255,255,0.7); font-size: 0.9rem; }
        .deal-meta { padding: 12px 12px 14px; display: grid; gap: 8px; }
        .deal-title {
          color: #fff; text-decoration: none; font-weight: 700;
          font-size: 1.0rem; line-height: 1.25;
        }
        .deal-title:hover { text-decoration: underline; }
        .row {
          display: flex; align-items: baseline; justify-content: space-between;
          gap: 8px; font-size: 0.96rem; opacity: 0.95;
        }
        .row.tiny { font-size: 0.8rem; opacity: 0.8; }
        .label { opacity: 0.85; }
        .price { font-weight: 800; }
        .linky { color: #c9f; }
        .savings { font-weight: 800; color: #8fffbc; }
      `}</style>

      {/* global styles */}
      <style jsx global>{`
        html, body, #__next { height: 100%; background: #1b0633; }
        body { margin: 0; overscroll-behavior: none; }
        * { box-sizing: border-box; }
      `}</style>
    </div>
  );
}
