(function () {

  // --------------------------
  // Extract ASIN
  // --------------------------
  function getASIN() {
    const url = window.location.href;
    const match =
      url.match(/\/dp\/([A-Z0-9]{10})/) ||
      url.match(/\/product\/([A-Z0-9]{10})/);

    return match ? match[1] : null;
  }

  // --------------------------
  // NEW: Extract BEST possible Amazon image
  // --------------------------
  function extractAmazonMainImage() {
    // 1. Main product image
    const landing = document.querySelector("#landingImage");
    if (landing) {
      // highest quality
      const hires = landing.getAttribute("data-old-hires");
      if (hires && hires.length > 5) return hires;

      const src = landing.src;
      if (src && src.length > 5) return src;
    }

    // 2. Dynamic image object (Amazon uses this frequently)
    const dynImg = document.querySelector("img[data-a-dynamic-image]");
    if (dynImg) {
      try {
        const json = JSON.parse(dynImg.getAttribute("data-a-dynamic-image") || "{}");
        const bestUrl = Object.keys(json)[0];
        if (bestUrl && bestUrl.length > 5) return bestUrl;
      } catch (e) {}
    }

    // 3. Fallback (same as your old logic)
    const imgEl =
      document.getElementById("landingImage") ||
      document.querySelector("#imgTagWrapperId img") ||
      document.querySelector("img[src*='images/I']");
    if (imgEl && imgEl.src) return imgEl.src;

    return "";
  }

  // --------------------------
  // Scrape title / brand / price / thumbnail
  // --------------------------
  function scrapeProductInfo() {
    // Title
    const titleEl = document.getElementById("productTitle");
    const title = titleEl ? titleEl.textContent.trim() : "";

    // Price
    let priceText = "";
    const priceEl =
      document.querySelector("#corePrice_feature_div span.a-offscreen") ||
      document.querySelector("#corePrice_desktop span.a-offscreen") ||
      document.querySelector("span.a-offscreen");

    if (priceEl) priceText = priceEl.textContent.trim();
    const price = priceText
      ? parseFloat(priceText.replace(/[^0-9.]/g, ""))
      : null;

    // Brand
    const brandEl =
      document.querySelector("#bylineInfo") ||
      document.querySelector("tr.po-brand td.a-span9 span");
    const brand = brandEl ? brandEl.textContent.trim() : "";

    // OLD thumbnail
    const imgEl =
      document.getElementById("landingImage") ||
      document.querySelector("#imgTagWrapperId img") ||
      document.querySelector("img[src*='images/I']");
    const thumbnail = imgEl ? imgEl.src : "";

    // NEW best image
    const image_url = extractAmazonMainImage();

    return { title, price, brand, thumbnail, image_url };
  }

  // --------------------------
  // Build panel URL with full product info
  // --------------------------
  function buildPanelSrc(asin, info) {
    const url = new URL(chrome.runtime.getURL("panel.html"));
    url.searchParams.set("asin", asin);

    if (info) {
      if (info.title) url.searchParams.set("title", info.title);
      if (info.price != null) url.searchParams.set("price", String(info.price));
      if (info.brand) url.searchParams.set("brand", info.brand);
      if (info.thumbnail) url.searchParams.set("thumb", info.thumbnail);

      // NEW: send best full-size image to panel.js
      if (info.image_url) url.searchParams.set("image_url", info.image_url);
    }

    return url.toString();
  }

  // --------------------------
  // Inject the panel iframe
  // --------------------------
  function injectSidebar(asin, info) {
    if (!asin) return;

    const src = buildPanelSrc(asin, info);

    const existing = document.getElementById("fbalgo-extension-sidebar");
    if (existing) {
      existing.src = src; // update on SPA navigation
      return;
    }

    const iframe = document.createElement("iframe");
    iframe.id = "fbalgo-extension-sidebar";
    iframe.src = src;

    iframe.style.position = "fixed";
    iframe.style.top = "0";
    iframe.style.right = "0";
    iframe.style.width = "380px";
    iframe.style.height = "100vh";
    iframe.style.border = "none";
    iframe.style.background = "transparent";
    iframe.style.zIndex = "999999999";
    iframe.style.boxShadow = "0 0 12px rgba(0,0,0,0.25)";

    document.body.appendChild(iframe);
  }

  // --------------------------
  // Init
  // --------------------------
  function init() {
    const asin = getASIN();
    if (!asin) return;

    const info = scrapeProductInfo();
    injectSidebar(asin, info);
  }

  // Initial load
  window.addEventListener("load", init);

  // Detect Amazon's SPA changes
  let lastUrl = location.href;
  setInterval(() => {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      init();
    }
  }, 800);

})();
