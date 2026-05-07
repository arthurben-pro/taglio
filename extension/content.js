chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== "TAGLIO_EXTRACT_POST") {
    return false;
  }

  sendResponse(extractCurrentPost());
  return false;
});

function extractCurrentPost() {
  const canonical = document.querySelector('link[rel="canonical"]')?.href;
  const url = canonical || window.location.href.split("#")[0];
  const title = firstText([
    "main h1",
    "article h1",
    'div[data-test-id="main-feed-activity-card"] span[dir="ltr"]',
    "article span[dir='ltr']"
  ]) || cleanDocumentTitle(document.title);
  const author = firstText([
    'a[href*="/in/"] span[aria-hidden="true"]',
    'a[href*="/company/"] span[aria-hidden="true"]',
    "main h1 + div span[aria-hidden='true']"
  ]);
  const excerpt = firstLongText([
    "article span[dir='ltr']",
    "main span[dir='ltr']",
    "main p"
  ]) || "Save this LinkedIn post to Taglio and organize it with tags and notes.";

  return {
    title: truncate(title, 160),
    author: truncate(author, 120),
    url,
    excerpt: truncate(excerpt, 220)
  };
}

function firstText(selectors) {
  for (const selector of selectors) {
    const nodes = document.querySelectorAll(selector);

    for (const node of nodes) {
      const text = node.textContent?.replace(/\s+/g, " ").trim();

      if (text) {
        return text;
      }
    }
  }

  return "";
}

function firstLongText(selectors) {
  const texts = [];

  selectors.forEach((selector) => {
    document.querySelectorAll(selector).forEach((node) => {
      const text = node.textContent?.replace(/\s+/g, " ").trim();

      if (text && text.length > 40) {
        texts.push(text);
      }
    });
  });

  texts.sort((a, b) => b.length - a.length);
  return texts[0] || "";
}

function cleanDocumentTitle(title) {
  return title.replace(/\s+\|\s+LinkedIn.*$/, "").trim();
}

function truncate(value, maxLength) {
  if (!value || value.length <= maxLength) {
    return value || "";
  }

  return `${value.slice(0, maxLength - 1).trim()}…`;
}
