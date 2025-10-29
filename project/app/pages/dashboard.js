// pages/dashboard.js  (or app/dashboard/page.js)
import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import Products from "./products";
import { Space_Grotesk } from "next/font/google";

const API_BASE =
  process.env.NEXT_PUBLIC_BACKEND_URL ||
  "https://feisty-renewal-production.up.railway.app";

// FastAPI base for deals/scrape (kept for parity even if unused here)
const PYAPI_BASE =
  process.env.NEXT_PUBLIC_PYAPI_URL ||
  "https://diligent-spontaneity-production-d286.up.railway.app";

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

  // Walmart states
  const [wmItems, setWmItems] = useState([]);
  const [wmLoading, setWmLoading] = useState(false);
  const [wmIngesting, setWmIngesting] = useState(false);
  const [wmMsg, setWmMsg] = useState("");

  // Deals (Walmart vs Amazon, title/brand)
  const [deals, setDeals] = useState([]);
  const [dealsLoading, setDealsLoading] = useState(false);
  const [dealsMsg, setDealsMsg] = useState("");

  // Filters
  const [dealCategory, setDealCategory] = useState("");
  const [dealMinPct, setDealMinPct] = useState(0.2); // 20%
  const [dealMinAbs, setDealMinAbs] = useState(5);
  const [dealLimit, setDealLimit] = useState(200);
  const [dealMinScore, setDealMinScore] = useState(0.62); // title match score

  // Fallback thumbnail (prevents big blank slabs on bad URLs)
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

  // After OAuth
  useEffect(() => {
    if (typeof window !== "undefined" && (window.location.search || window.location.hash)) {
      runSandboxCheck();
    }
  }, []);

  const handleLinkFBA = () => {
    window.location.href = `${API_BASE}/api/amazon/auth/login`;
  };

  const scrapeWalmartCategory = async (categoryKey, query) => {
    const r = await fetch(`${API_BASE}/api/amazon/walmart/scrape-category`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ category_key: categoryKey, query, pages: 1 }),
    });
    return r.json();
  };

  const scrapeAmazonCategory = async (categoryKey, query) => {
    const r = await fetch(`${API_BASE}/api/amazon/scrape-category`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ category_key: categoryKey, query, pages: 1 }),
    });
    return r.json();
  };

  // Walmart: ingest via Node proxy -> pyapi
  const ingestWalmart = async () => {
    setWmIngesting(true);
    setWmMsg("");
    try {
      const body = { query: "protein powder", pages: 1, max_products: 80, delay_ms: 700 };
      const r = await fetch(`${API_BASE}/api/amazon/walmart/scrape?t=${Date.now()}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Cache-Control": "no-cache" },
        cache: "no-store",
        body: JSON.stringify(body),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data?.detail || data?.error || "Ingestion failed");
      setWmMsg(`Ingested ${data.inserted} new / ${data.updated} updated (processed ${data.total_processed})`);
      const e = await enrichUPC(200);
      setWmMsg((prev) => `${prev} | UPCs: considered ${e.considered ?? "?"}, updated ${e.updated ?? "0"}`);
      await fetchWalmartItems();
    } catch (e) {
      setWmMsg(`Error: ${e.message}`);
    } finally {
      setWmIngesting(false);
    }
  };

  async function enrichUPC(limit = 200) {
    const r = await fetch(`${API_BASE}/api/amazon/walmart/enrich-upc?limit=${limit}`, {
      method: "POST",
      headers: { "Cache-Control": "no-cache" },
      cache: "no-store",
    });
    const data = await r.json();
    if (!r.ok) throw new Error(data?.detail || data?.error || "UPC enrich failed");
    return data;
  }

  // Walmart: fetch items
  const fetchWalmartItems = async () => {
    setWmLoading(true);
    setWmMsg("");
    try {
      const r = await fetch(`${API_BASE}/api/amazon/walmart/items?limit=30&t=${Date.now()}`, {
        headers: { "Cache-Control": "no-cache" },
        cache: "no-store",
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data?.error || "Failed to load items");
      setWmItems(Array.isArray(data.items) ? data.items : []);
      if (!Array.isArray(data.items) || data.items.length === 0) {
        setWmMsg("No items found yet. Try 'Ingest Walmart (SerpAPI)'.");
      }
    } catch (e) {
      setWmMsg(`Error: ${e.message}`);
    } finally {
      setWmLoading(false);
    }
  };

  // Build Amazon cache by title/brand
  const buildAmazonCache = async () => {
    setDealsMsg("");
    setDealsLoading(true);
    try {
      // 1) UPC-first
      const r1 = await fetch(`${API_BASE}/api/amazon/index-upc`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Cache-Control": "no-cache" },
        cache: "no-store",
        body: JSON.stringify({ limit: 300, recache_hours: 24 }),
      });
      const j1 = await r1.json();
      if (!r1.ok) throw new Error(j1?.detail || j1?.error || "UPC index failed");

      // 2) strict title fallback (kept as-is to not change behavior)
      const r2 = await fetch(`${API_BASE}/api/amazon/index-by-title?t=${Date.now()}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Cache-Control": "no-cache" },
        cache: "no-store",
        body: JSON.stringify({ limit_items: 120, max_serp_calls: 60, min_score: 0.80, recache_hours: 24 }),
      });
      const j2 = await r2.json();

      setDealsMsg(
        `Amazon cache → UPC fetched: ${j1.fetched ?? 0} (misses ${j1.misses ?? 0}); Title fetched: ${j2.fetched_now ?? 0} (misses ${j2.misses ?? 0})`
      );
    } catch (e) {
      setDealsMsg(`Error: ${e.message}`);
    } finally {
      setDealsLoading(false);
    }
  };

  // Fetch deals (title/brand match)
  const fetchDeals = async () => {
    setDealsLoading(true);
    setDealsMsg("");
    try {
      const qs = new URLSearchParams({
        min_pct: String(dealMinPct),
        min_abs: String(dealMinAbs),
        limit: String(Math.max(dealLimit, 100)),
      });

      const upcR = await fetch(`${API_BASE}/api/amazon/deals-by-upc?${qs.toString()}&t=${Date.now()}`, {
        headers: { "Cache-Control": "no-cache" },
        cache: "no-store",
      });
      const upcJ = await upcR.json();
      const upcDeals = Array.isArray(upcJ.deals) ? upcJ.deals : [];

      // Strict title fallback (kept as-is)
      const titleR = await fetch(
            `${API_BASE}/api/amazon/deals/by-title?${qs.toString()}&min_sim=${Math.round(dealMinScore * 100)}&t=${Date.now()}`,
        {
          headers: { "Cache-Control": "no-cache" },
          cache: "no-store",
        }
      );
      const titleJ = await titleR.json();
      const titleDeals = Array.isArray(titleJ.deals) ? titleJ.deals : [];

      const merged = [...upcDeals, ...titleDeals];
      setDeals(merged);
      if (!merged.length) setDealsMsg("No deals yet. Try a broader scrape, or build more Amazon cache.");
    } catch (e) {
      setDealsMsg(`Error: ${e.message}`);
    } finally {
      setDealsLoading(false);
    }
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

        {/* Walmart Inventory Card */}
        <div className="card">
          <h2 className={`${spaceGrotesk.className} products-title`}>Walmart Inventory (SerpAPI → Mongo)</h2>
          <p className="subtitle">Ingest from SerpAPI and view items we’ve stored in MongoDB.</p>

          <div className="actions">
            <button className="primary" onClick={ingestWalmart} disabled={wmIngesting}>
              {wmIngesting ? "Ingesting…" : "Ingest Walmart (SerpAPI)"}
            </button>
            <button className="secondary" onClick={fetchWalmartItems} disabled={wmLoading}>
              {wmLoading ? "Loading…" : "Refresh Items"}
            </button>
          </div>

          {wmMsg && <div className="status">{wmMsg}</div>}

          <div className="grid">
            {wmItems.map((it) => (
              <div className="wm-card" key={it.product_id || it.key || it._id}>
                <div className="thumb-wrap">
                  <img
                    src={it.thumbnail || FALLBACK_SVG}
                    alt={it.title || "thumbnail"}
                    loading="lazy"
                    referrerPolicy="no-referrer"
                    onError={(e) => {
                      e.currentTarget.src = FALLBACK_SVG;
                    }}
                  />
                </div>
                <div className="wm-meta">
                  <a className="wm-title" href={it.link || "#"} target="_blank" rel="noreferrer" title={it.title}>
                    {it.title || "Untitled"}
                  </a>
                  <div className="wm-row">
                    <span className="wm-price">
                      {typeof it.price === "number" ? `$${it.price.toFixed(2)}` : it.price || "—"}
                    </span>
                    <span className="wm-currency">{it.currency || ""}</span>
                  </div>
                  <div className="wm-row">
                    <span className="wm-rating">{it.rating ? `★ ${it.rating}` : "No rating"}</span>
                    <span className="wm-reviews">{it.reviews ? `(${it.reviews} reviews)` : ""}</span>
                  </div>
                  <div className="wm-row small">
                    <span>{it.brand || it.seller || it.source || ""}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {wmItems.length === 0 && !wmLoading && <p className="subtitle">Nothing to show yet.</p>}
        </div>

        {/* Deals finder (Title/Brand) */}
        <div className="card">
          <h2 className={`${spaceGrotesk.className} products-title`}>Find Deals (Walmart vs Amazon)</h2>
          <p className="subtitle">
            Walmart items cheaper than Amazon by your thresholds. Build the Amazon cache first, then find deals.
          </p>

          {/* Filters */}
          <div className="actions" style={{ alignItems: "center" }}>
            <label style={{ display: "flex", gap: 8, alignItems: "center", color: "#fff" }}>
              Category:
              <input
                value={dealCategory}
                onChange={(e) => setDealCategory(e.target.value)}
                placeholder="optional (e.g., Electronics)"
                style={{
                  padding: "8px 10px",
                  borderRadius: 8,
                  border: "1px solid rgba(255,255,255,0.2)",
                  background: "rgba(255,255,255,0.08)",
                  color: "#fff",
                }}
              />
            </label>

            <label style={{ display: "flex", gap: 8, alignItems: "center", color: "#fff" }}>
              Min %:
              <input
                type="number"
                step="0.05"
                min="0"
                value={dealMinPct}
                onChange={(e) => setDealMinPct(parseFloat(e.target.value || "0"))}
                style={{
                  width: 90,
                  padding: "8px 10px",
                  borderRadius: 8,
                  border: "1px solid rgba(255,255,255,0.2)",
                  background: "rgba(255,255,255,0.08)",
                  color: "#fff",
                }}
              />
            </label>

            <label style={{ display: "flex", gap: 8, alignItems: "center", color: "#fff" }}>
              Min $:
              <input
                type="number"
                step="1"
                min="0"
                value={dealMinAbs}
                onChange={(e) => setDealMinAbs(parseFloat(e.target.value || "0"))}
                style={{
                  width: 90,
                  padding: "8px 10px",
                  borderRadius: 8,
                  border: "1px solid rgba(255,255,255,0.2)",
                  background: "rgba(255,255,255,0.08)",
                  color: "#fff",
                }}
              />
            </label>

            <label style={{ display: "flex", gap: 8, alignItems: "center", color: "#fff" }}>
              Min score:
              <input
                type="number"
                step="0.01"
                min="0"
                max="1"
                value={dealMinScore}
                onChange={(e) => setDealMinScore(parseFloat(e.target.value || "0.62"))}
                style={{
                  width: 90,
                  padding: "8px 10px",
                  borderRadius: 8,
                  border: "1px solid rgba(255,255,255,0.2)",
                  background: "rgba(255,255,255,0.08)",
                  color: "#fff",
                }}
              />
            </label>

            <label style={{ display: "flex", gap: 8, alignItems: "center", color: "#fff" }}>
              Limit:
              <input
                type="number"
                step="1"
                min="1"
                max="200"
                value={dealLimit}
                onChange={(e) => setDealLimit(parseInt(e.target.value || "24", 10))}
                style={{
                  width: 90,
                  padding: "8px 10px",
                  borderRadius: 8,
                  border: "1px solid rgba(255,255,255,0.2)",
                  background: "rgba(255,255,255,0.08)",
                  color: "#fff",
                }}
              />
            </label>

            <button className="secondary" onClick={buildAmazonCache} disabled={dealsLoading}>
              {dealsLoading ? "Indexing…" : "Build Amazon Cache"}
            </button>
            <button className="primary" onClick={fetchDeals} disabled={dealsLoading}>
              {dealsLoading ? "Searching…" : "Find Deals"}
            </button>
          </div>

          {dealsMsg && <div className="status">{dealsMsg}</div>}

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
                      <span>Category: {wm.category || "—"}</span>
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

        /* Responsive filter labels on small screens */
        @media (max-width: 860px) {
          .actions label {
            flex-direction: column;
            align-items: flex-start !important;
          }
          .actions input {
            width: 180px !important;
          }
        }

        /* Walmart grid */
        .grid {
          margin-top: 1rem;
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(230px, 1fr));
          gap: 12px;
        }
        .wm-card {
          display: grid;
          grid-template-rows: 160px auto;
          background: rgba(255, 255, 255, 0.04);
          border-radius: 12px;
          overflow: hidden;
          border: 1px solid var(--panel-border);
        }
        .thumb-wrap {
          background: #fff;
          display: grid;
          place-items: center;
          padding: 10px;
        }
        .thumb-wrap img {
          max-width: 100%;
          max-height: 140px;
          object-fit: contain;
          display: block;
        }
        .wm-meta {
          padding: 10px 12px 12px;
          display: grid;
          gap: 6px;
          background: var(--panel-bg);
          border-top: 1px solid var(--panel-border);
          min-height: 110px;
        }
        .wm-title {
          color: #fff;
          text-decoration: none;
          font-weight: 700;
          font-size: 0.98rem;
          line-height: 1.25;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
        .wm-title:hover {
          text-decoration: underline;
        }
        .wm-row {
          display: flex;
          align-items: baseline;
          gap: 8px;
          font-size: 0.95rem;
          opacity: 0.95;
        }
        .wm-row.small {
          font-size: 0.8rem;
          color: var(--muted);
        }
        .wm-price {
          font-weight: 800;
        }
        .wm-currency {
          opacity: 0.7;
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
