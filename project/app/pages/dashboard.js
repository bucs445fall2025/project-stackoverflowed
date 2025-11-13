// pages/dashboard.js  (or app/dashboard/page.js)
import { useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { Space_Grotesk } from "next/font/google";

const API_BASE =
  process.env.NEXT_PUBLIC_BACKEND_URL ||
  "https://feisty-renewal-production.up.railway.app";

const StarsBackground = dynamic(() => import("../components/StarsBackground"), {
  ssr: false,
});

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  weight: ["600", "700"],
});

export default function Dashboard() {
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
    "Spices",
    "non perishable food",
    "Christmas",
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

  // Fetch deals by category label; backend maps label -> collections safely
  const fetchDealsByCategory = async (label) => {
    if (!label) return;
    setDealsLoading(true);
    setDealsMsg("");
    setDeals([]);

    try {
      const r = await fetch(`${API_BASE}/api/commerce/deals`, {
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
          {/* Top nav tabs */}
          <div className="tab-bar">
            <Link href="/dashboard" className="tab active">
              Product Finder
            </Link>
            <Link href="/amazon-dashboard" className="tab">
              Amazon Dashboard
            </Link>
            <Link href="/chat-bot" className="tab">
              Chat Bot
            </Link>
          </div>

          <h1 className={`${spaceGrotesk.className} title`}>Product Finder</h1>
          <p className="subtitle">
            Compare Walmart vs Amazon products, images, and pricing in one place.
          </p>

          {/* Category selector */}
          <div className="actions" style={{ alignItems: "center", marginTop: "0.5rem" }}>
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
                <option
                  value=""
                  disabled
                  style={{ background: "#151020", color: "#fff" }}
                >
                  Select a category…
                </option>
                {CATEGORY_LABELS.map((label) => (
                  <option
                    key={label}
                    value={label}
                    style={{ background: "#151020", color: "#fff" }}
                  >
                    {label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {dealsMsg && <div className="status">{dealsMsg}</div>}
          {dealsLoading && <div className="status">Loading deals…</div>}

          {/* Product rows */}
          <div className="product-rows">
            {deals.map((d, i) => {
              const wm = d.wm || {};
              const amz = d.amz || {};

              const wmPrice = Number(wm.price ?? 0);
              const amzPrice = Number(amz.price ?? 0);

              const roi =
                wmPrice > 0 ? ((amzPrice - wmPrice) / wmPrice) * 100 : 0;

              // keep behavior similar to old badge: only show when ROI is solid
              const showBadge = roi >= 20;

              const wmThumb = wm.thumbnail || FALLBACK_SVG;
              const amzThumb = amz.thumbnail || FALLBACK_SVG;

              return (
                <div
                  className="product-row"
                  key={`${wm.product_id || amz.asin || wm.link || i}`}
                >
                  {/* Left: images + ROI badge */}
                  <div className="product-media">
                    <div className="thumb-pair">
                      <div className="thumb-wrap small">
                        <img
                          src={wmThumb}
                          alt={wm.title || "Walmart product"}
                          loading="lazy"
                          referrerPolicy="no-referrer"
                          onError={(e) => {
                            e.currentTarget.src = FALLBACK_SVG;
                          }}
                        />
                        <span className="thumb-label">Walmart</span>
                      </div>

                      <div className="thumb-wrap small">
                        <img
                          src={amzThumb}
                          alt={amz.title || "Amazon product"}
                          loading="lazy"
                          referrerPolicy="no-referrer"
                          onError={(e) => {
                            e.currentTarget.src = FALLBACK_SVG;
                          }}
                        />
                        <span className="thumb-label">Amazon</span>
                      </div>
                    </div>

                    {showBadge && (
                      <div className="badge">
                        {roi.toFixed(1)}% ROI
                      </div>
                    )}
                  </div>

                  {/* Right: text + prices stacked Walmart then Amazon */}
                  <div className="product-info">
                    {/* Walmart block */}
                    <div className="side-block">
                      <div className="side-header">Walmart</div>
                      <a
                        className="deal-title"
                        href={wm.link || "#"}
                        target="_blank"
                        rel="noreferrer"
                        title={wm.title}
                      >
                        {wm.title || "Untitled Walmart product"}
                      </a>
                      <div className="row">
                        <span className="label">Price</span>
                        <span className="price">
                          ${wmPrice.toFixed(2)}
                        </span>
                      </div>
                    </div>

                    {/* Amazon block */}
                    <div className="side-block">
                      <div className="side-header">Amazon</div>
                      <a
                        className="deal-title"
                        href={amz.link || "#"}
                        target="_blank"
                        rel="noreferrer"
                        title={amz.title}
                      >
                        {amz.title || "Untitled Amazon product"}
                      </a>
                      <div className="row">
                        <span className="label">Price</span>
                        <span className="price">
                          ${amzPrice.toFixed(2)}
                        </span>
                      </div>
                    </div>

                    {/* Summary row */}
                    <div className="summary-row">
                      <span>
                        Difference:{" "}
                        <strong>
                          ${(amzPrice - wmPrice).toFixed(2)}
                        </strong>
                      </span>
                      <span>
                        ROI:{" "}
                        <strong>
                          {roi.toFixed(1)}%
                        </strong>
                      </span>
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
        }
        .card {
          background: var(--card-bg);
          backdrop-filter: blur(8px);
          border: 1px solid var(--panel-border);
          border-radius: 16px;
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.45);
          color: #fff;
          padding: 24px;
        }

        .tab-bar {
          display: flex;
          gap: 0.5rem;
          margin-bottom: 1rem;
        }
        .tab {
          padding: 8px 14px;
          border-radius: 999px;
          font-size: 0.9rem;
          text-decoration: none;
          color: rgba(255, 255, 255, 0.8);
          background: rgba(255, 255, 255, 0.06);
          border: 1px solid rgba(255, 255, 255, 0.08);
          transition: background 0.2s, color 0.2s, transform 0.15s, box-shadow 0.15s;
        }
        .tab:hover {
          transform: translateY(-1px);
          box-shadow: 0 6px 15px rgba(0, 0, 0, 0.25);
        }
        .tab.active {
          background: linear-gradient(90deg, #8a2be2, #5b21b6);
          color: #fff;
          border-color: transparent;
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
        .status {
          margin-top: 0.5rem;
        }

        /* Product rows */
        .product-rows {
          margin-top: 1rem;
          display: flex;
          flex-direction: column;
          gap: 14px;
        }
        .product-row {
          display: grid;
          grid-template-columns: minmax(0, 260px) minmax(0, 1fr);
          gap: 16px;
          padding: 14px 16px;
          border-radius: 14px;
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid var(--panel-border);
        }

        .product-media {
          position: relative;
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .thumb-pair {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .thumb-wrap.small {
          position: relative;
          background: #fff;
          border-radius: 10px;
          padding: 6px;
          display: grid;
          place-items: center;
          overflow: hidden;
        }
        .thumb-wrap.small img {
          max-width: 100%;
          max-height: 120px;
          object-fit: contain;
          display: block;
        }
        .thumb-label {
          position: absolute;
          bottom: 4px;
          left: 6px;
          font-size: 0.7rem;
          font-weight: 700;
          background: rgba(0, 0, 0, 0.6);
          padding: 2px 6px;
          border-radius: 999px;
        }

        .badge {
          align-self: flex-start;
          background: #22c55e;
          color: #06260d;
          font-weight: 800;
          padding: 6px 10px;
          border-radius: 999px;
          font-size: 0.8rem;
          border: 1px solid rgba(0, 0, 0, 0.15);
        }

        .product-info {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .side-block {
          background: var(--panel-bg);
          border-radius: 10px;
          border: 1px solid var(--panel-border);
          padding: 8px 10px;
        }
        .side-header {
          font-size: 0.8rem;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          opacity: 0.75;
          margin-bottom: 4px;
        }

        .deal-title {
          color: #fff;
          text-decoration: none;
          font-weight: 800;
          font-size: 0.95rem;
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
          font-size: 0.9rem;
          margin-top: 4px;
        }
        .label {
          opacity: 0.82;
          letter-spacing: 0.02em;
        }
        .price {
          font-weight: 900;
        }

        .summary-row {
          display: flex;
          justify-content: space-between;
          font-size: 0.86rem;
          margin-top: 4px;
          opacity: 0.9;
        }

        @media (max-width: 860px) {
          .product-row {
            grid-template-columns: 1fr;
          }
          .product-media {
            flex-direction: row;
            justify-content: space-between;
          }
          .thumb-pair {
            flex-direction: row;
          }
        }

        @media (max-width: 600px) {
          .product-media {
            flex-direction: column;
          }
          .thumb-pair {
            flex-direction: column;
          }
          .summary-row {
            flex-direction: column;
            gap: 2px;
          }
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
