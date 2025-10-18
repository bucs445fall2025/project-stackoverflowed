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

  // Optional: if the user just came back from /auth/callback, try a check
  useEffect(() => {
    // Heuristic: if there’s a query string or hash, likely returned from OAuth
    if (typeof window !== "undefined" && (window.location.search || window.location.hash)) {
      runSandboxCheck();
    }
  }, []);

  const handleLinkFBA = () => {
    // Start OAuth on the backend; backend will redirect to Amazon and then back to FRONTEND_URL
    window.location.href = `${API_BASE}/auth/login`;
  };

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
          z-index: 1; /* above the stars */
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
          margin: 0 0 1rem;
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
        .secondary:disabled {
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
      `}</style>

      {/* global styles align with Home page to avoid white flash/border */}
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
