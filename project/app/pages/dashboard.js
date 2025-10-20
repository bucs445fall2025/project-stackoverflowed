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

  // Walmart states
  const [wmItems, setWmItems] = useState([]);
  const [wmLoading, setWmLoading] = useState(false);
  const [wmIngesting, setWmIngesting] = useState(false);
  const [wmMsg, setWmMsg] = useState("");

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

  // Optional: try a check after OAuth return
  useEffect(() => {
    if (typeof window !== "undefined" && (window.location.search || window.location.hash)) {
      runSandboxCheck();
    }
  }, []);

  const handleLinkFBA = () => {
    window.location.href = `${API_BASE}/api/amazon/auth/login`;
  };

  // ── Walmart: Ingest via SerpAPI (pyapi) through Node proxy ────────────────
  const ingestWalmart = async () => {
    setWmIngesting(true);
    setWmMsg("");
    try {
      // change the query to what you want to ingest
      const body = { query: "protein powder", max_pages: 1, delay_ms: 700 };
      const r = await fetch(`${API_BASE}/api/amazon/walmart/scrape`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data?.detail || data?.error || "Ingestion failed");
      setWmMsg(
        `Ingested ${data.inserted} new / ${data.updated} updated (processed ${data.total_processed})`
      );
      // after ingest, refresh list
      await fetchWalmartItems();
    } catch (e) {
      setWmMsg(`Error: ${e.message}`);
    } finally {
      setWmIngesting(false);
    }
  };

  // ── Walmart: Fetch items from Mongo via Node read route ───────────────────
  const fetchWalmartItems = async () => {
    setWmLoading(true);
    setWmMsg("");
    try {
      const r = await fetch(`${API_BASE}/api/amazon/walmart/items?limit=30`);
      const data = await r.json();
      if (!r.ok) throw new Error(data?.error || "Failed to load items");
      // Expecting { items: [...] }
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

  // auto-load items once on mount (optional)
  useEffect(() => {
    fetchWalmartItems();
  }, []);

  return (
    <div className="dash-wrap">
      {/* starfield behind everything */}
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

        {/* Products viewer appears once sandbox is linked */}
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
              <div className="wm-card" key={it.key || it._id}>
                <div className="thumb-wrap">
                  {/* title attribute shows full title on hover */}
                  {it.thumbnail ? (
                    <img src={it.thumbnail} alt={it.title || "thumbnail"} />
                  ) : (
                    <div className="no-thumb">No image</div>
                  )}
                </div>
                <div className="wm-meta">
                  <a
                    className="wm-title"
                    href={it.link || "#"}
                    target="_blank"
                    rel="noreferrer"
                    title={it.title}
                  >
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

          {wmItems.length === 0 && !wmLoading && (
            <p className="subtitle">Nothing to show yet.</p>
          )}
        </div>
      </main>

      {/* page-specific styles */}
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
        .card,
        .products-card {
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
          background: linear-gradient(90deg, #8a2be2, #4b0082);
          color: #fff;
        }
        .secondary {
          background: rgba(255, 255, 255, 0.12);
          color: #fff;
        }
        .primary:hover,
        .secondary:hover {
          transform: translateY(-2px);
          box-shadow: 0 5px 15px rgba(0, 0, 0, 0.3);
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
        /* Walmart grid */
        .grid {
          margin-top: 1rem;
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
          gap: 12px;
        }
        .wm-card {
          display: grid;
          grid-template-rows: 160px auto;
          background: rgba(255,255,255,0.04);
          border-radius: 12px;
          overflow: hidden;
          border: 1px solid rgba(255,255,255,0.06);
        }
        .thumb-wrap {
          background: rgba(0,0,0,0.25);
          display: grid;
          place-items: center;
        }
        .thumb-wrap img {
          max-width: 100%;
          max-height: 100%;
          object-fit: contain;
          display: block;
        }
        .no-thumb {
          color: rgba(255,255,255,0.7);
          font-size: 0.9rem;
        }
        .wm-meta {
          padding: 10px 12px 12px;
          display: grid;
          gap: 6px;
        }
        .wm-title {
          color: #fff;
          text-decoration: none;
          font-weight: 700;
          font-size: 0.98rem;
          line-height: 1.2;
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
          opacity: 0.8;
        }
        .wm-price {
          font-weight: 800;
        }
      `}</style>

      {/* global styles align with Home page */}
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
