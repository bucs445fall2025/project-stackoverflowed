// pages/saved-products.js
import { useEffect, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { Space_Grotesk } from "next/font/google";
import React from "react";

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

// ⭐ Prevent Stars from remounting
const MemoStars = React.memo(StarsBackground);

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

  // Load saved products
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
      <MemoStars count={240} />

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

          {/* ACTION BUTTONS */}
          <div className="actions">
            <button
              className={`action-btn remove ${selected.size ? "enabled" : ""}`}
              onClick={removeSelected}
              disabled={selected.size === 0}
            >
              Remove Selected
            </button>

            <button className="action-btn export">
              Export Selected (Soon)
            </button>
          </div>

          {/* PRODUCT CARDS */}
          <div className="product-rows">
            {items.map((p) => {
              const amzPrice = Number(p.amazonPrice ?? 0);
              const matchPrice = Number(p.matchPrice ?? 0);

              const diff = amzPrice - matchPrice;
              const roi =
                matchPrice > 0
                  ? ((amzPrice - matchPrice) / matchPrice) * 100
                  : 0;

              const roiClass =
                roi > 0
                  ? "roi-pill positive"
                  : roi < 0
                  ? "roi-pill negative"
                  : "roi-pill neutral";

              return (
                <div className="product-row" key={p.asin}>
                  {/* Checkbox */}
                  <div className="checkbox-container">
                    <input
                      type="checkbox"
                      checked={selected.has(p.asin)}
                      onChange={() => toggleSelect(p.asin)}
                    />
                  </div>

                  {/* Header */}
                  <div className="row-header">
                    <div className={roiClass}>{roi.toFixed(1)}% ROI</div>
                    <div className="row-header-meta">
                      Difference:{" "}
                      <span className="strong">${diff.toFixed(2)}</span>
                    </div>
                  </div>

                  {/* Body */}
                  <div className="row-body">
                    {/* images */}
                    <div className="product-media">
                      <div className="thumb-pair">
                        <div className="thumb-wrap small">
                          <img
                            src={p.amazonThumbnail || FALLBACK_SVG}
                            alt={p.amazonTitle}
                          />
                          <span className="thumb-label">Amazon</span>
                        </div>

                        <div className="thumb-wrap small">
                          <img
                            src={p.matchThumbnail || FALLBACK_SVG}
                            alt={p.matchTitle}
                          />
                          <span className="thumb-label">Match</span>
                        </div>
                      </div>
                    </div>

                    {/* text */}
                    <div className="product-info">
                      <div className="side-block">
                        <div className="side-header">AMAZON</div>
                        <a className="deal-title" href={p.amazonURL} target="_blank">
                          {p.amazonTitle}
                        </a>
                        <div className="row price-row">
                          <span className="label">Price</span>
                          <span className="price">${amzPrice.toFixed(2)}</span>
                        </div>
                      </div>

                      <div className="side-block">
                        <div className="side-header">MATCH</div>
                        <a className="deal-title" href={p.matchURL} target="_blank">
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

      {/* FULL STYLING COPIED FROM PRODUCT FINDER */}
      <style jsx>{`
        :root {
          --card-bg: rgba(22, 16, 34, 0.78);
          --panel-bg: rgba(13, 15, 26, 0.95);
          --panel-border: rgba(255, 255, 255, 0.08);
        }

        .dash-wrap {
          position: relative;
          min-height: 100vh;
          background: radial-gradient(1200px 800px at 20% -10%, #4b1d7a 0%, transparent 60%),
            radial-gradient(1200px 800px at 80% -10%, #2a0c52 0%, transparent 60%),
            #1c0333;
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
          border-radius: 16px;
          padding: 24px;
          color: white;
        }

        .tab-row {
          display: flex;
          gap: 0.5rem;
          margin-bottom: 1.2rem;
        }

        .tab-pill {
          padding: 8px 18px;
          border-radius: 999px;
          background: rgba(15, 23, 42, 0.85);
          border: 1px solid rgba(148, 163, 184, 0.45);
          color: rgba(248, 250, 252, 0.85);
          text-decoration: none;
        }

        .tab-pill.active {
          background: radial-gradient(circle at top left, #a855f7, #4c1d95);
          border-color: rgba(216, 180, 254, 0.8);
          color: white;
        }

        .title {
          font-size: clamp(2rem, 4vw, 3rem);
          margin: 0 0 1.2rem;
          font-weight: 700;
        }

        .actions {
          margin-bottom: 1rem;
          display: flex;
          gap: 10px;
        }

        .action-btn {
          padding: 10px 16px;
          border-radius: 12px;
          background: rgba(255, 255, 255, 0.1);
          border: 1px solid rgba(255, 255, 255, 0.15);
          color: white;
          cursor: pointer;
          opacity: 0.6;
        }

        .action-btn.enabled {
          opacity: 1;
        }

        .action-btn.remove.enabled {
          background: rgba(239, 68, 68, 0.2);
          border-color: rgba(239, 68, 68, 0.5);
        }

        .product-rows {
          display: flex;
          flex-direction: column;
          gap: 14px;
        }

        .checkbox-container {
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
          border: 1px solid rgba(255, 255, 255, 0.08);
          padding: 14px;
          box-shadow: 0 10px 25px rgba(0, 0, 0, 0.4);
        }

        .product-row:hover {
          border-color: rgba(255, 255, 255, 0.95);
        }

        .row-header {
          display: flex;
          justify-content: space-between;
          padding-bottom: 4px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.06);
        }

        .roi-pill {
          padding: 4px 10px;
          border-radius: 999px;
          font-weight: bold;
          font-size: 0.8rem;
        }
        .roi-pill.positive {
          background: rgba(34, 197, 94, 0.14);
          border: 1px solid rgba(34, 197, 94, 0.5);
          color: #bbf7d0;
        }
        .roi-pill.negative {
          background: rgba(239, 68, 68, 0.14);
          border: 1px solid rgba(248, 113, 113, 0.5);
          color: #fecaca;
        }
        .roi-pill.neutral {
          background: rgba(148, 163, 184, 0.14);
          border: 1px solid rgba(148, 163, 184, 0.5);
          color: white;
        }

        .row-body {
          margin-top: 10px;
          display: grid;
          grid-template-columns: minmax(0, 260px) minmax(0, 1fr);
          gap: 16px;
        }

        .thumb-pair {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .thumb-wrap {
          background: radial-gradient(circle at top, white, #e5e7eb);
          border-radius: 14px;
          padding: 8px;
          position: relative;
        }

        .thumb-label {
          position: absolute;
          bottom: 6px;
          left: 6px;
          padding: 2px 6px;
          border-radius: 999px;
          font-size: 0.7rem;
          background: rgba(15, 23, 42, 0.8);
        }

        .side-block {
          background: var(--panel-bg);
          border: 1px solid rgba(255, 255, 255, 0.08);
          padding: 8px 10px;
          border-radius: 12px;
        }

        .deal-title {
          color: white;
          font-weight: bold;
          text-decoration: none;
        }
      `}</style>
    </div>
  );
}
