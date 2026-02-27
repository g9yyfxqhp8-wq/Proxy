import fetchModule from "node-fetch";
const fetch = fetchModule;

export default async function handler(req, res) {
  const url = req.query.url;
  if (!url) return res.status(400).send("Missing URL");

  const shoppingKeywords = ['amazon','ebay','aliexpress','shop','checkout','cart','buy','store'];
  if (shoppingKeywords.some(k => url.toLowerCase().includes(k))) {
    return res.send(`
      <h2>Shopping Not Supported</h2>
      <p>This site is blocked on YousefOS Browser.</p>
    `);
  }

  try {
    const response = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
    const contentType = response.headers.get("content-type") || "";

    if (!contentType.includes("text/html")) {
      const buffer = await response.arrayBuffer();
      res.setHeader("Content-Type", contentType);
      return res.send(Buffer.from(buffer));
    }

    let html = await response.text();
    const baseUrl = new URL(url).origin;

    html = html.replace(/<(link|script|img|a|form)(.*?)>/gi, (match, tag, attrs) => {
      return match.replace(
        /(src|href|action)=["'](.*?)["']/gi,
        (m, attr, link) => {
          if (!link) return m;
          if (link.startsWith("http") || link.startsWith("data:") || link.startsWith("javascript:")) {
            return `${attr}="/api/fetch?url=${encodeURIComponent(link)}"`;
          }
          return `${attr}="/api/fetch?url=${encodeURIComponent(new URL(link, baseUrl).href)}"`;
        }
      );
    });

    const injectScript = `
      <script>
        const originalFetch = window.fetch;
        window.fetch = function(url, options) {
          if (typeof url === "string" && !url.startsWith("/api/fetch")) {
            url = "/api/fetch?url=" + encodeURIComponent(url);
          }
          return originalFetch(url, options);
        };
        const originalOpen = XMLHttpRequest.prototype.open;
        XMLHttpRequest.prototype.open = function(method, url) {
          if (!url.startsWith("/api/fetch")) {
            url = "/api/fetch?url=" + encodeURIComponent(url);
          }
          return originalOpen.apply(this, [method, url]);
        };
      </script>
    `;
    html = html.replace("</head>", injectScript + "</head>");
    res.setHeader("Content-Type", "text/html");
    res.send(html);

  } catch (err) {
    res.send(`<h2>Failed to load site</h2><p>${err.message}</p>`);
  }
}
