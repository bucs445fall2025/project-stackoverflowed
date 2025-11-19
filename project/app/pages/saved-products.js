// pages/saved-products.js
import { useEffect, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { Space_Grotesk } from "next/font/google";

const StarsBackground = dynamic(() => import("../components/StarsBackground"), {
  ssr: false,
});

const API_BASE =
  process.env.NEXT_PUBLIC_BACKEND_URL ||
  "https://feisty-renewal-production.up.railway.app";

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  weight: ["600", "700"],
});

export default function SavedProducts() {
  const [items, setItems] = useState([]);
  const [selected, setSelected] = useState(new Set());

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

  // Load Saved Products
  useEffect(() => {
    const token = localStorage.getItem("authToken");
    if (!token) return;

    fetch(`${API_BASE}/api/users/saved-products`, {
      headers: { Authorization: "Bearer " + token },
    })
      .then((r) => r.json())
      .then((d) => setItems(d.products || []));
  }, []);

  const toggleSelect = (asin) => {
    const s = new Set(selected);
    s.has(asin) ? s.delete(asin) : s.add(asin);
    setSelected(s);
  };

  const removeSelected = async () => {
    if (selected.size === 0) return;

    await fetch(`${API_BASE}/api/users/remove-saved-products`, {
      method: "POST",
      headers: {
        Authorization: "Bearer " + localStorage.getItem("authToken"),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ asins: Array.from(selected) }),
    });

    setItems(items.filter((p) => !selected.has(p.asin)));
    setSelected(new Set());
  };

  return (
    <div className="dash-wrap">
      <StarsBackground count={240} />

      <main className="content">
        <div className="card">
          {/* Tabs */}
          <nav className="tab-row">
            <Link href="/dashboard" className="tab-pill">
              <span className="tab-label">Product Finder</span>
            </Link>
            <Link href="/amazon-dashboard" className="tab-pill">
              <span className="tab-label">Amazon Dashboard</span>
            </Link>
            <Link href="/chat-bot" className="tab-pill">
              <span className="tab-label">Chat Bot</span>
            </Link>
            <Link href="/saved-products" className="tab-pill active">
              <span className="tab-label">Saved</span>
            </Link>
          </nav>

          <h1 className={`${spaceGrotesk.className} title`}>Saved Products</h1>

          <div className="actions">
            <button
              className={`action-btn remove ${selected.size ? "enabled" : ""}`}
              onClick={removeSelected}
              disabled={selected.size === 0}
            >
              Remove Selected
            </button>
          </div>

          {/* PRODUCT ROWS */}
          <div className="product-rows">
            {items.map((p) => {
              const amzPrice = Number(p.amazonPrice ?? 0);
              const matchPrice = Number(p.matchPrice ?? 0);

              const diff = amzPrice - matchPrice;
              const roi =
                matchPrice > 0 ? ((amzPrice - matchPrice) / matchPrice) * 100 : 0;

              const amzThumb = p.amazonThumbnail || FALLBACK_SVG;
              const matchThumb = p.matchThumbnail || FALLBACK_SVG;

              const roiClass =
                roi > 0
                  ? "roi-pill positive"
                  : roi < 0
                  ? "roi-pill negative"
                  : "roi-pill neutral";

              return (
                <div className="product-row" key={p.asin}>
                  <label className="checkbox-wrap">
                    <input
                      type="checkbox"
                      checked={selected.has(p.asin)}
                      onChange={() => toggleSelect(p.asin)}
                    />
                  </label>

                  {/* Header Row */}
                  <div className="row-header">
                    <div className={roiClass}>{roi.toFixed(1)}% ROI</div>
                    <div className="row-header-meta">
                      Difference: <span className="strong">${diff.toFixed(2)}</span>
                    </div>
                  </div>

                  {/* BODY */}
                  <div className="row-body">
                    {/* LEFT: IMAGES */}
                    <div className="product-media">
                      <div className="thumb-pair">
                        <div className="thumb-wrap small">
                          <img src={amzThumb} alt={p.amazonTitle} />
                          <span className="thumb-label">Amazon</span>
                        </div>

                        <div className="thumb-wrap small">
                          <img src={matchThumb} alt={p.matchTitle} />
                          <span className="thumb-label">Match</span>
                        </div>
                      </div>
                    </div>

                    {/* RIGHT: DETAILS */}
                    <div className="product-info">
                      {/* AMAZON BOX */}
                      <div className="side-block">
                        <div className="side-header">AMAZON</div>
                        <a
                          className="deal-title"
                          href={p.amazonURL}
                          target="_blank"
                          rel="noreferrer"
                        >
                          {p.amazonTitle}
                        </a>

                        <div className="row price-row">
                          <span className="label">Price</span>
                          <span className="price">${amzPrice.toFixed(2)}</span>
                        </div>
                      </div>

                      {/* MATCH BOX */}
                      <div className="side-block">
                        <div className="side-header">MATCH</div>
                        <a
                          className="deal-title"
                          href={p.matchURL}
                          target="_blank"
                          rel="noreferrer"
                        >
                          {p.matchTitle}
                        </a>

                        <div className="row price-row">
                          <span className="label">Price</span>
                          <span className="price">${matchPrice.toFixed(2)}</span>
                        </div>
                      </div>

                      <div className="meta-row">
                        <span>ASIN: {p.asin}</span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}

            {items.length === 0 && (
              <p className="subtitle">You have no saved products yet.</p>
            )}
          </div>
        </div>
      </main>

      {/* ===== CSS — FULL COPY FROM DASHBOARD ===== */}
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

        .tab-row {
          display: flex;
          gap: 0.5rem;
          margin-bottom: 1.2rem;
          flex-wrap: wrap;
        }

        .tab-pill {
          position: relative;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 8px 18px;
          border-radius: 999px;
          background: rgba(15, 23, 42, 0.85);
          border: 1px solid rgba(148, 163, 184, 0.45);
          cursor: pointer;
          text-decoration: none;
          color: rgba(248, 250, 252, 0.8);
          font-size: 0.85rem;
          letter-spacing: 0.03em;
          text-transform: uppercase;
          overflow: hidden;
          transition:
            background 0.2s ease-out,
            color 0.2s ease-out,
            box-shadow 0.2s ease-out,
            transform 0.15s ease-out;
        }

        .tab-pill.active {
          background: radial-gradient(circle at top left, #a855f7, #4c1d95);
          color: #f9fafb;
          border-color: rgba(216, 180, 254, 0.8);
        }

        .tab-label {
          position: relative;
          z-index: 1;
        }

        .action-btn {
          padding: 10px 16px;
          border-radius: 10px;
          font-weight: 700;
          opacity: 0.5;
          cursor: not-allowed;
          border: none;
        }

        .action-btn.enabled {
          opacity: 1;
          cursor: pointer;
        }

        .remove.enabled {
          background: rgba(239, 68, 68, 0.25);
          border: 1px solid rgba(239, 68, 68, 0.45);
        }

        /* PRODUCT GRID */
        .product-rows {
          margin-top: 1rem;
          display: flex;
          flex-direction: column;
          gap: 14px;
        }

        .checkbox-wrap {
          position: absolute;
          top: 10px;
          left: 10px;
          z-index: 10;
        }

        .product-row {
          position: relative;
          border-radius: 18px;
          background: linear-gradient(
            135deg,
            rgba(167, 139, 250, 0.09),
            rgba(15, 23, 42, 0.85)
          );
          border: 1px solid rgba(255, 255, 255, 0.1);
          box-shadow: 0 10px 25px rgba(0, 0, 0, 0.4);
          padding: 12px 14px 14px;
          display: flex;
          flex-direction: column;
          gap: 10px;
          transition:
            border-color 0.18s ease-out,
            box-shadow 0.18s ease-out,
            transform 0.15s ease-out;
          overflow: hidden;
        }

        .product-row:hover {
          border-color: rgba(255, 255, 255, 0.95);
          transform: translateY(-3px);
          box-shadow: 0 14px 35px rgba(0, 0, 0, 0.55);
        }

        .row-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding-bottom: 4px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.06);
        }

        .row-header-meta {
          font-size: 0.85rem;
          opacity: 0.9;
        }

        .strong {
          font-weight: 700;
        }

        .row-body {
          display: grid;
          grid-template-columns: minmax(0, 260px) minmax(0, 1fr);
          gap: 16px;
        }

        .product-media {
          display: flex;
          align-items: center;
        }

        .thumb-pair {
          display: flex;
          flex-direction: column;
          gap: 10px;
          width: 100%;
        }

        .thumb-wrap.small {
          background: radial-gradient(circle at top, #ffffff, #e5e7eb);
          border-radius: 14px;
          padding: 8px;
          display: grid;
          place-items: center;
        }

        .thumb-wrap.small img {
          max-width: 100%;
          max-height: 120px;
          object-fit: contain;
        }

        .thumb-label {
          position: absolute;
          bottom: 6px;
          left: 8px;
          font-size: 0.7rem;
          font-weight: 700;
          background: rgba(15, 23, 42, 0.8);
          padding: 2px 6px;
          border-radius: 999px;
        }

        .product-info {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .side-block {
          background: var(--panel-bg);
          border-radius: 12px;
          border: 1px solid var(--panel-border);
          padding: 8px 10px;
        }

        .side-header {
          font-size: 0.75rem;
          text-transform: uppercase;
          opacity: 0.7;
          margin-bottom: 3px;
        }

        .deal-title {
          color: #fff;
          font-weight: 800;
          font-size: 0.95rem;
          text-decoration: none;
          line-height: 1.28;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
          transition: color 0.15s ease-out, text-shadow 0.15s ease-out;
        }

        .deal-title:hover {
          color: #e9d5ff;
          text-shadow: 0 0 8px rgba(167, 139, 250, 0.45);
        }

        .row {
          display: flex;
          justify-content: space-between;
          font-size: 0.9rem;
          margin-top: 4px;
        }

        .price-row .price {
          font-size: 1.02rem;
          color: #c7d2fe;
          font-weight: 900;
        }

        .meta-row {
          margin-top: 4px;
          font-size: 0.8rem;
        }

        .roi-pill {
          padding: 4px 10px;
          border-radius: 999px;
          font-size: 0.8rem;
          font-weight: 800;
          border: 1px solid transparent;
        }
        .roi-pill.positive {
          background: rgba(34, 197, 94, 0.14);
          border-color: rgba(34, 197, 94, 0.5);
          color: #bbf7d0;
        }
        .roi-pill.negative {
          background: rgba(239, 68, 68, 0.14);
          border-color: rgba(248, 113, 113, 0.5);
          color: #fecaca;
        }
        .roi-pill.neutral {
          background: rgba(148, 163, 184, 0.14);
          border-color: rgba(148, 163, 184, 0.5);
          color: #e5e7eb;
        }

        @media (max-width: 860px) {
          .row-body {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
}
