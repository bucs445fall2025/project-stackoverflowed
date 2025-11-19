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
    const t = localStorage.getItem("authToken");
    if (!t) return;
  
    fetch(`${API_BASE}/api/users/saved-products`, {
      headers: { Authorization: "Bearer " + localStorage.getItem("authToken")},
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
        Authorization: "Bearer " + t,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ asins: Array.from(selected) }),
    });

    // Refresh UI
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
              <div className="product-card" key={p.asin}>
                <label className="checkbox-wrap">
                  <input
                    type="checkbox"
                    checked={selected.has(p.asin)}
                    onChange={() => toggleSelect(p.asin)}
                  />
                </label>

                <img src={p.thumbnail} alt="" className="thumb" />

                <div className="info">
                  <div className="title">{p.title}</div>
                  <div className="price">${Number(p.price).toFixed(2)}</div>
                  <a href={p.url} target="_blank" className="view">
                    View Product →
                  </a>
                </div>
              </div>
            ))}

            {items.length === 0 && (
              <p className="subtitle">You have no saved products yet.</p>
            )}
          </div>
        </div>
      </main>

      {/* Styling */}
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
        .remove.enabled {
          background: rgba(239, 68, 68, 0.25);
          border: 1px solid rgba(239, 68, 68, 0.45);
        }
        .export.enabled {
          background: rgba(167, 139, 250, 0.25);
          border: 1px solid rgba(167, 139, 250, 0.45);
        }

        .grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
          gap: 16px;
        }

        .product-card {
          position: relative;
          border-radius: 16px;
          padding: 14px;
          background: rgba(15, 23, 42, 0.85);
          border: 1px solid rgba(255, 255, 255, 0.08);
        }

        .checkbox-wrap {
          position: absolute;
          top: 10px;
          left: 10px;
        }

        .thumb {
          width: 100%;
          height: 180px;
          object-fit: contain;
          background: white;
          border-radius: 12px;
          margin-bottom: 8px;
        }

        .info .title {
          font-weight: 700;
          font-size: 0.9rem;
          margin-bottom: 6px;
        }
        .info .price {
          color: #c7d2fe;
          margin-bottom: 8px;
        }
        .info .view {
          color: #a78bfa;
          font-size: 0.8rem;
          text-decoration: none;
        }
      `}</style>
    </div>
  );
}
