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
        FBALGO SAVINGS
      </h2>
      <p style="margin: 0 0 10px; opacity: 0.8; font-size: 12px;">
        Live deal check across Walmart & niche stores.
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
        Find Savings
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

    results.textContent = "Searching Walmart & other stores for this product…";

    try {
      const res = await fetch(`${API_BASE}/extension/find-deals-by-image`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          asin: asin || null,
          title,
          price,
          brand: brand || null,
          thumbnail: thumb || null,
          image_url: params.get("image_url") || null,
        }),
      });

      console.log("find-deals status", res.status);
      const data = await res.json();
      console.log("find-deals data", data);

      if (
        !data.match_found ||
        !data.best_deals ||
        data.best_deals.length === 0
      ) {
        results.innerHTML =
          "<span>No cheaper offers found yet for this item.</span>";
        return;
      }

      const amazonPrice = price;
      // sort all deals by lowest price first
      const sortedDeals = [...data.best_deals].sort(
        (a, b) => a.price - b.price
      );

      const cardsHtml = sortedDeals
        .map((deal) => {
          const merchant = deal.merchant || "other store";
          const rawDomain =
            deal.source_domain ||
            (merchant === "walmart" ? "walmart.com" : merchant);

          // Clean label for display (strip scheme + www)
          const storeLabel = (rawDomain || "").replace(
            /^https?:\/\/(www\.)?/i,
            ""
          );

          const dealPrice = deal.price;
          const savingsAbs = deal.savings_abs;
          const savingsPct = deal.savings_pct;
          const link = deal.url;
          const titleText = deal.title || storeLabel;
          const thumbDeal = deal.thumbnail || thumb;

          const titleHtml = link
            ? `<a href="${link}" target="_blank" rel="noreferrer"
                   style="color:#e5e7eb;font-weight:600;text-decoration:underline;">
                 ${titleText}
               </a>`
            : `<span style="font-weight:600;">${titleText}</span>`;

          return `
            <div style="
              margin-top:8px;
              padding:9px 10px;
              border-radius:12px;
              background:rgba(15,23,42,0.6);
              border:1px solid rgba(148,163,184,0.45);
            ">
              <div style="display:flex;gap:8px;align-items:flex-start;">
                ${
                  thumbDeal
                    ? `<div style="flex:0 0 48px;">
                         <div style="
                           width:48px;
                           height:48px;
                           border-radius:10px;
                           background:#020617;
                           display:flex;
                           align-items:center;
                           justify-content:center;
                           overflow:hidden;
                         ">
                           <img src="${thumbDeal}" style="max-width:100%;max-height:100%;object-fit:contain;" />
                         </div>
                       </div>`
                    : ""
                }
                <div style="flex:1;">
                  <div style="font-size:11px;opacity:.8;margin-bottom:2px;">
                    ${storeLabel || merchant}
                  </div>
                  <div style="font-size:13px;margin-bottom:2px;">
                    ${titleHtml}
                  </div>
                  <div style="font-size:12px;margin-top:2px;">
                    <strong>$${dealPrice.toFixed(2)}</strong>
                    <span style="opacity:.8;"> · Save $${savingsAbs.toFixed(
                      2
                    )} (${savingsPct.toFixed(1)}% vs Amazon)</span>
                  </div>
                </div>
              </div>
            </div>
          `;
        })
        .join("");

      results.innerHTML = `
        <div style="
          margin-bottom:6px;
          padding:6px 8px;
          border-radius:8px;
          background:rgba(148,163,184,0.18);
          border:1px dashed rgba(148,163,184,0.5);
          font-size:12px;
        ">
          Found <strong>${sortedDeals.length}</strong> cheaper offer${
        sortedDeals.length > 1 ? "s" : ""
      } vs Amazon ($${amazonPrice.toFixed(2)}).
        </div>
        ${cardsHtml}
      `;
    } catch (err) {
      console.error("find-deals error", err);
      results.innerHTML =
        "<span style='color:#f97373;'>Error: " +
        (err.message || "Unknown error") +
        "</span>";
    }
  });
}

initPanel();
