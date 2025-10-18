// pages/dashboard.js  (or app/dashboard/page.js)
import { useEffect, useState } from 'react';
import Products from './products';

const API_BASE =
  process.env.NEXT_PUBLIC_BACKEND_URL || 'https://feisty-renewal-production.up.railway.app';

export default function Dashboard() {
  const [status, setStatus] = useState('Initializing…');
  const [checkResult, setCheckResult] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    // prime backend with sellerId/marketplaceId
    (async () => {
      try {
        setStatus('Contacting Amazon sandbox…');
        const res = await fetch(`${API_BASE}/spapi/sandbox-check`);
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || 'Sandbox check failed');
        setCheckResult(data);
        setStatus('Sandbox linked ✅');
      } catch (e) {
        setError(e.message);
        setStatus('Failed to link sandbox ❌');
      }
    })();
  }, []);

  return (
    <div style={{ color: 'white', padding: '2rem' }}>
      <h1>Log in successful</h1>
      <h2>Dashboard</h2>

      <p><strong>Status:</strong> {status}</p>
      {error && <pre style={{ color: '#ffb4b4' }}>{error}</pre>}

      {/* Optional: show a tiny snippet of what came back */}
      {checkResult && (
        <details style={{ margin: '1rem 0' }}>
          <summary>Sandbox check payload</summary>
          <pre style={{ whiteSpace: 'pre-wrap' }}>{JSON.stringify(checkResult, null, 2)}</pre>
        </details>
      )}

      {/* Your products viewer */}
      <Products apiBase={API_BASE} />
    </div>
  );
}
