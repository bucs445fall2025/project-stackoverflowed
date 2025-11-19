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

  const anySelected = selected.size > 0;

  return (
    <div className="wrap">
      <StarsBackground count={240} />

      <main className="content">
        <div className="card">
          <nav className="tab-row">
            <Link href="/dashboard" className="tab-pill">
              <span className="tab-label">Product Finder</span>
            </Link>
            <Link href="/amazon-dashboard" className="tab-pill">
              <span className="tab-label">Amazon Dashboard</span>
            </Link>
            <Link href="/saved-products" className="tab-pill active">
              <span className="tab-label">Saved</span>
            </Link>
          </nav>

          <h1 className={`${spaceGrotesk.className} title`}>Saved Products</h1>

          {/* Action Buttons */}
          <div className="actions">
            <button
              className={`action-btn remove ${anySelected ? "enabled" : ""}`}
              disabled={!anySelected}
              onClick={removeSelected}
            >
              Remove Selected
            </button>
            
            <button
              className={`action-btn export ${anySelected ? "enabled" : ""}`}
              disabled={!anySelected}
            >
              Export Selected
            </button>
          </div>

          {/* Product Grid */}
          <div className="grid">
            {items.map((p) => (
              <div className="product-row" key={p.asin}>
                {/* Checkbox */}
                <label className="checkbox-wrap">
                  <input
                    type="checkbox"
                    checked={selected.has(p.asin)}
                    onChange={() => toggleSelect(p.asin)}
                  />
                </label>

                <div className="row-body">
                  {/* AMAZON BLOCK */}
                  <div className="side-block">
                    <div className="side-header">AMAZON</div>

                    <div className="thumb-wrap small">
                      <img
                        src={p.amazonThumbnail}
                        alt={p.amazonTitle}
                        loading="lazy"
                      />
                      <span className="thumb-label">Amazon</span>
                    </div>

                    <a
                      className="deal-title"
                      href={p.amazonURL}
                      target="_blank"
                      rel="noreferrer"
                      title={p.amazonTitle}
                    >
                      {p.amazonTitle}
                    </a>

                    <div className="row price-row">
                      <span className="label">Price</span>
                      <span className="price">
                        ${Number(p.amazonPrice).toFixed(2)}
                      </span>
                    </div>
                  </div>

                  {/* MATCH BLOCK */}
                  <div className="side-block">
                    <div className="side-header">MATCH DEAL</div>

                    <div className="thumb-wrap small">
                      <img
                        src={p.matchThumbnail}
                        alt={p.matchTitle}
                        loading="lazy"
                      />
                      <span className="thumb-label">Match</span>
                    </div>

                    <a
                      className="deal-title"
                      href={p.matchURL}
                      target="_blank"
                      rel="noreferrer"
                      title={p.matchTitle}
                    >
                      {p.matchTitle}
                    </a>

                    <div className="row price-row">
                      <span className="label">Price</span>
                      <span className="price">
                        ${Number(p.matchPrice).toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))}

            {items.length === 0 && (
              <p className="subtitle">You have no saved products yet.</p>
            )}
          </div>
        </div>
      </main>

      <style jsx>{`
        .wrap {
          position: relative;
          min-height: 100vh;
          background: radial-gradient(1200px 800px at 20% -10%, #4b1d7a 0%, transparent 60%),
            radial-gradient(1200px 800px at 80% -10%, #2a0c52 0%, transparent 60%),
            #1c0333;
          display: grid;
          place-items: center;
          padding: 2rem;
        }

        .content {
          width: min(1120px, 100%);
        }

        .card {
          background: rgba(22, 16, 34, 0.78);
          border-radius: 16px;
          border: 1px solid rgba(255, 255, 255, 0.08);
          padding: 24px;
          color: #fff;
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
          text-decoration: none;
          color: rgba(248, 250, 252, 0.8);
        }
        .tab-pill.active {
          background: radial-gradient(circle at top left, #a855f7, #4c1d95);
          border-color: rgba(216, 180, 254, 0.8);
        }

        .actions {
          display: flex;
          gap: 10px;
          margin-bottom: 16px;
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

        /* Saved row grid (like dashboard) */
        .grid {
          display: flex;
          flex-direction: column;
          gap: 16px;
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
          padding: 14px;
          display: flex;
          gap: 12px;
          transition: transform 0.15s ease-out, box-shadow 0.15s ease-out;
          overflow: hidden;
        }

        .product-row:hover {
          border-color: rgba(255, 255, 255, 0.95);
          transform: translateY(-3px);
          box-shadow: 0 14px 35px rgba(0, 0, 0, 0.55);
        }

        .checkbox-wrap {
          position: absolute;
          top: 10px;
          left: 10px;
        }

        .row-body {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
          width: 100%;
        }

        .side-block {
          background: rgba(13, 15, 26, 0.95);
          border-radius: 14px;
          border: 1px solid rgba(255, 255, 255, 0.12);
          padding: 10px 12px;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .side-header {
          font-size: 0.75rem;
          text-transform: uppercase;
          opacity: 0.7;
          letter-spacing: 0.18em;
        }

        .thumb-wrap.small {
          background: white;
          padding: 8px;
          border-radius: 12px;
          display: grid;
          place-items: center;
          position: relative;
          height: 150px;
        }

        .thumb-wrap.small img {
          max-width: 100%;
          max-height: 130px;
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

        .deal-title {
          color: #fff;
          text-decoration: none;
          font-weight: 800;
          font-size: 0.95rem;
          line-height: 1.28;
          overflow: hidden;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
        }

        .row.price-row {
          display: flex;
          justify-content: space-between;
          font-size: 0.9rem;
        }

        .price {
          color: #c7d2fe;
          font-weight: 900;
        }
      `}</style>
    </div>
  );
}
