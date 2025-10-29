// pages/dashboard.js (or app/dashboard/page.js)
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

  // Deals (rendered list)
  const [deals, setDeals] = useState([]);
  const [dealsLoading, setDealsLoading] = useState(false);
  const [dealsMsg, setDealsMsg] = useState("");

  // Category dropdown (loaded from Node backend)
  const [categories, setCategories] = useState([]);
  const [selectedCat, setSelectedCat] = useState("");

  // Deal thresholds
  const [dealMinPct, setDealMinPct] = useState(0.20); // 20%
  const [dealMinAbs, setDealMinAbs] = useState(5);
  const [dealLimit, setDealLimit] = useState(200);

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

  // --- Sandbox check (unchanged) ---
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

  // --- NEW: load categories for dropdown ---
  useEffect(() => {
    (async () => {
      try {
        // Expect Node backend to return: { categories: ["petfood","containers","spices", ...] }
        const r = await fetch(`${API_BASE}/api/amazon/categories`, { cache: "no-store" });
        const j = await r.json();
        if (!r.ok) throw new Error(j?.error || "Failed to load categories");
        const arr = Array.isArray(j?.categories) ? j.categories : [];
        setCategories(arr);
        if (arr.length && !selectedCat) setSelectedCat(arr[0]);
      } catch (e) {
        // Graceful fallback: empty dropdown
        console.warn("Category load failed:", e.message);
      }
    })();
  }, []); // load once

  // --- Find deals: send selected category to Node backend ---
  const fetchDeals = async () => {
    if (!selectedCat) {
      setDealsMsg("Pick a category first.");
      return;
    }
    setDealsLoading(true);
    setDealsMsg("");
    try {
      // Option A (preferred): a single Node route that merges UPC + title logic.
      // POST body allows cleaner expansion later.
      const r = await fetch(`${API_BASE}/api/amazon/deals`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Cache-Control": "no-cache" },
        cache: "no-store",
        body: JSON.stringify({
          category: selectedCat,
          min_pct: dealMinPct,
          min_abs: dealMinAbs,
          limit: Math.max(50, dealLimit),
        }),
      });

      // If your Node API isn’t combined yet, you can instead:
      //  - call `${API_BASE}/api/amazon/deals-by-upc?...&category=${selectedCat}`
      //  - call `${API_BASE}/api/amazon/deals/by-title?...&category=${selectedCat}&min_sim=90`
      //  - merge results client-side (same shape as before)
      // Just swap the fetch above for two calls and concat.

      const j = await r.json();
      if (!r.ok) throw new Error(j?.detail || j?.error || "Deal search failed");
      const list = Array.isArray(j?.deals) ? j.deals : [];
      setDeals(list);
      if (!list.length) setDealsMsg("No deals yet for this category. Try widening thresholds.");
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

        {/* ===================== AMAZON DEALS PANEL (Dropdown + Button) ===================== */}
        <div className="card">
          <h2 className={`${spaceGrotesk.className} products-title`}>Find Deals (Amazon vs Walmart)</h2>
          <p className="subtitle">Pick a pre-loaded MongoDB category and search for deals.</p>

          <div className="actions" style={{ alignItems: "center" }}>
            <label style={{ display: "flex", gap: 8, alignItems: "center", color: "#fff" }}>
              Category:
              <select
                value={selectedCat}
                onChange={(e) => setSelectedCat(e.target.value)}
                style={{
                  padding: "8px 10px",
                  borderRadius: 8,
                  border: "1px solid rgba(255,255,255,0.2)",
                  background: "rgba(255,255,255,0.08)",
                  color: "#fff",
                  minWidth: 220,
                }}
              >
                {categories.length === 0 && <option value="">(No categories found)</option>}
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
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
              Limit:
              <input
                type="number"
                step="1"
                min="1"
                max="200"
                value={dealLimit}
                onChange={(e) => setDealLimit(parseInt(e.target.value || "200", 10))}
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

            <button className="primary" onClick={fetchDeals} disabled={dealsLoading || !selectedCat}>
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
                      <span>Category: {wm.category || selectedCat || "—"}</span>
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

      {/* styles unchanged, omitted for brevity — keep your existing <style jsx> blocks */}
    </div>
  );
}
