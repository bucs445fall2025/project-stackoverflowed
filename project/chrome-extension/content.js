(function () {

    function getASIN() {
      const url = window.location.href;
      const match =
        url.match(/\/dp\/([A-Z0-9]{10})/) ||
        url.match(/\/product\/([A-Z0-9]{10})/);
  
      return match ? match[1] : null;
    }
  
    function scrapeProductInfo() {
      // Title
      const titleEl = document.getElementById("productTitle");
      const title = titleEl ? titleEl.textContent.trim() : "";
  
      // Price – grab first visible price Amazon shows
      let priceText = "";
      const priceEl =
        document.querySelector("#corePrice_feature_div span.a-offscreen") ||
        document.querySelector("#corePrice_desktop span.a-offscreen") ||
        document.querySelector("span.a-offscreen");
  
      if (priceEl) {
        priceText = priceEl.textContent.trim();
      }
      const price = priceText
        ? parseFloat(priceText.replace(/[^0-9.]/g, ""))
        : null;
  
      // Brand (best-effort)
      const brandEl =
        document.querySelector("#bylineInfo") ||
        document.querySelector("tr.po-brand td.a-span9 span");
      const brand = brandEl ? brandEl.textContent.trim() : "";
  
      // Thumbnail
      const imgEl =
        document.getElementById("landingImage") ||
        document.querySelector("#imgTagWrapperId img") ||
        document.querySelector("img[src*='images/I']");
      const thumbnail = imgEl ? imgEl.src : "";
  
      return { title, price, brand, thumbnail };
    }
  
    function buildPanelSrc(asin, info) {
      const url = new URL(chrome.runtime.getURL("panel.html"));
      url.searchParams.set("asin", asin);
  
      if (info) {
        if (info.title) url.searchParams.set("title", info.title);
        if (info.price != null) url.searchParams.set("price", String(info.price));
        if (info.brand) url.searchParams.set("brand", info.brand);
        if (info.thumbnail) url.searchParams.set("thumb", info.thumbnail);
      }
  
      return url.toString();
    }
  
    function injectSidebar(asin, info) {
      if (!asin) return;
  
      const src = buildPanelSrc(asin, info);
  
      // If sidebar already exists, just update src (in case of SPA nav)
      const existing = document.getElementById("fbalgo-extension-sidebar");
      if (existing) {
        existing.src = src;
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
  
    function init() {
      const asin = getASIN();
      if (!asin) return;
  
      const info = scrapeProductInfo();
      injectSidebar(asin, info);
    }
  
    // run once on load
    window.addEventListener("load", init);
  
    // ALSO detect SPA navigation (Amazon!)
    let lastUrl = location.href;
    setInterval(() => {
      if (location.href !== lastUrl) {
        lastUrl = location.href;
        init();
      }
    }, 800);
  
  })();
  