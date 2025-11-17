const API_BASE = "https://diligent-spontaneity-production-d286.up.railway.app";

function initPanel() {
  const params = new URLSearchParams(window.location.search);

  const asin = params.get("asin") || "";
  const title = params.get("title") || "";
  const brand = params.get("brand") || "";
  const thumb = params.get("thumb") || "";
  const priceStr = params.get("price");
  const price = priceStr ? parseFloat(priceStr) : NaN;

  const app = document.getElementById("app");

  const safeTitle =
    title.length > 80 ? title.slice(0, 77).trimEnd() + "…" : title;

  app.innerHTML = `
    <div style="
      position: relative;
      padding: 16px 14px 18px;
      color: #fff;
      font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: radial-gradient(1200px 800px at 20% -10%, #4b1d7a 0%, transparent 60%),
                  radial-gradient(1200px 800px at 80% -10%, #2a0c52 0%, transparent 60%),
                  #1c0333;
      height: 100vh;
      box-sizing: border-box;
    ">
      <h2 style="
        margin: 0 0 4px;
        font-size: 18px;
        letter-spacing: .03em;
        text-transform: uppercase;
      ">
        FBAlgo Savings
      </h2>
      <p style="margin: 0 0 10px; opacity: 0.8; font-size: 12px;">
        Live Walmart vs Amazon deal check.
      </p>

      <div style="
        display: flex;
        gap: 10px;
        align-items: flex-start;
        margin-bottom: 10px;
      ">
        ${
          thumb
            ? `<div style="flex:0 0 60px;">
                 <div style="
                   width:60px;
                   height:60px;
                   border-radius:12px;
                   background:#111;
                   display:flex;
                   align-items:center;
                   justify-content:center;
                   overflow:hidden;
                 ">
                   <img src="${thumb}" style="max-width:100%;max-height:100%;object-fit:contain;" />
                 </div>
               </div>`
            : ""
        }
        <div style="flex:1;">
          <div style="font-size:13px;font-weight:600;margin-bottom:4px;">
            ${safeTitle || "Amazon product"}
          </div>
          ${
            brand
              ? `<div style="font-size:11px;opacity:0.8;">Brand: ${brand}</div>`
              : ""
          }
          ${
            !isNaN(price)
              ? `<div style="font-size:13px;margin-top:4px;">
                   Amazon price: <strong>$${price.toFixed(2)}</strong>
                 </div>`
              : `<div style="font-size:12px;margin-top:4px;opacity:.8;">
                   Amazon price: <em>not detected</em>
                 </div>`
          }
        </div>
      </div>

      <button id="fb-find-deals" style="
        width: 100%;
        padding: 10px 12px;
        border-radius: 999px;
        border: 1px solid rgba(255,255,255,0.25);
        background: linear-gradient(135deg, #a855f7, #4c1d95);
        color: #fff;
        font-weight: 600;
        cursor: pointer;
        font-size: 13px;
      ">
        Find Walmart Savings
      </button>

      <div id="fb-results" style="margin-top:12px;font-size:13px;"></div>
    </div>
  `;

  const button = document.getElementById("fb-find-deals");
  const results = document.getElementById("fb-results");

  button.addEventListener("click", async () => {
    if (!title || isNaN(price)) {
      results.innerHTML =
        "<span style='color:#f97373;'>Missing title or price; try refreshing the page.</span>";
      return;
    }

    results.textContent = "Searching Walmart for this product…";

    try {
      const res = await fetch(`${API_BASE}/extension/find-walmart-deal`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          asin: asin || null,
          title,
          price,
          brand: brand || null,
          thumbnail: thumb || null,
        }),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`HTTP ${res.status}: ${text}`);
      }

      const data = await res.json();

      if (!data.match_found || !data.walmart) {
        results.innerHTML =
          "<span>No cheaper Walmart match found yet for this item.</span>";
        return;
      }

      const amzPrice = data.amazon.price;
      const wmPrice = data.walmart.price;
      const savingsAbs = data.savings_abs;
      const savingsPct = data.savings_pct;
      const wmLink = data.walmart.link;

      results.innerHTML = `
        <div style="
          margin-top:6px;
          padding:8px 9px;
          border-radius:10px;
          background:rgba(16,185,129,0.1);
          border:1px solid rgba(16,185,129,0.35);
        ">
          <div style="font-weight:600;margin-bottom:4px;">
            Walmart match found!
          </div>
          <div>Amazon: <strong>$${amzPrice.toFixed(2)}</strong></div>
          <div>Walmart: <strong>$${wmPrice.toFixed(2)}</strong></div>
          <div style="margin-top:4px;">
            You save <strong>$${savingsAbs.toFixed(
              2
            )}</strong> (${savingsPct.toFixed(1)}%) by buying at Walmart.
          </div>
          ${
            wmLink
              ? `<div style="margin-top:6px;">
                   <a href="${wmLink}" target="_blank" rel="noreferrer" style="color:#a78bfa;font-weight:600;">
                     Open Walmart listing →
                   </a>
                 </div>`
              : ""
          }
        </div>
      `;
    } catch (err) {
      console.error(err);
      results.innerHTML =
        "<span style='color:#f97373;'>Error: " +
        (err.message || "Unknown error") +
        "</span>";
    }
  });
}

// run immediately when the module is loaded
initPanel();
