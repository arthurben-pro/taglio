const STORAGE_KEY = "taglioSavedPosts";
const LINKEDIN_MATCHER = /linkedin\.com/i;

const browserApi = createBrowserApi();
let activeContext = null;

document.addEventListener("DOMContentLoaded", async () => {
  const refs = getRefs();

  refs.form.addEventListener("submit", (event) => handleSave(event, refs));
  refs.search.addEventListener("input", () => renderLibrary(refs, refs.search.value));
  refs.clearForm.addEventListener("click", () => applyContextToForm(refs));
  refs.refreshContext.addEventListener("click", async () => {
    await loadContext(refs);
  });
  refs.savedPosts.addEventListener("click", (event) => handleLibraryAction(event, refs));

  await loadContext(refs);
  await renderLibrary(refs, "");
});

function getRefs() {
  return {
    badge: document.getElementById("context-badge"),
    clearForm: document.getElementById("clear-form"),
    contextMeta: document.getElementById("context-meta"),
    contextTitle: document.getElementById("context-title"),
    form: document.getElementById("save-form"),
    librarySummary: document.getElementById("library-summary"),
    notes: document.getElementById("notes"),
    refreshContext: document.getElementById("refresh-context"),
    savedPosts: document.getElementById("saved-posts"),
    search: document.getElementById("search"),
    status: document.getElementById("status"),
    title: document.getElementById("title"),
    author: document.getElementById("author"),
    tags: document.getElementById("tags"),
    url: document.getElementById("url")
  };
}

async function loadContext(refs) {
  setStatus(refs, "Loading current page…");

  try {
    const [tab] = await browserApi.queryActiveTab();
    const extracted = await browserApi.extractPostFromTab(tab);
    const url = extracted?.url || tab?.url || "";
    const title = extracted?.title || tab?.title || "Untitled LinkedIn post";
    const author = extracted?.author || "";
    const excerpt = extracted?.excerpt || "Save a LinkedIn post to keep its context, tags, and notes together.";
    const isLinkedIn = LINKEDIN_MATCHER.test(url);

    activeContext = { title, author, url, excerpt, notes: "" };

    refs.contextTitle.textContent = title;
    refs.contextMeta.textContent = author
      ? `${author} • ${excerpt}`
      : excerpt;
    refs.badge.textContent = isLinkedIn ? "LinkedIn" : "Manual save";
    refs.badge.classList.toggle("badge--warning", !isLinkedIn);

    applyContextToForm(refs);
    setStatus(refs, isLinkedIn ? "LinkedIn page loaded." : "LinkedIn page not detected. You can still save manually.", isLinkedIn ? "success" : "");
  } catch (error) {
    activeContext = {
      title: "",
      author: "",
      url: "",
      excerpt: "Open LinkedIn in the active tab, then refresh Taglio.",
      notes: ""
    };
    refs.contextTitle.textContent = "Could not read the current page";
    refs.contextMeta.textContent = "Open a LinkedIn post or fill the form manually.";
    refs.badge.textContent = "Manual save";
    refs.badge.classList.add("badge--warning");
    applyContextToForm(refs);
    setStatus(refs, error.message || "Could not read the current tab.", "error");
  }
}

function applyContextToForm(refs) {
  refs.title.value = activeContext?.title || "";
  refs.author.value = activeContext?.author || "";
  refs.url.value = activeContext?.url || "";
  refs.notes.value = activeContext?.notes || "";
  refs.tags.value = "";
}

async function handleSave(event, refs) {
  event.preventDefault();

  const payload = {
    title: refs.title.value.trim(),
    author: refs.author.value.trim(),
    url: refs.url.value.trim(),
    notes: refs.notes.value.trim(),
    excerpt: activeContext?.excerpt || "",
    tags: refs.tags.value
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean)
  };

  if (!payload.title || !payload.url) {
    setStatus(refs, "Title and post URL are required.", "error");
    return;
  }

  const savedPosts = await getSavedPosts();
  const existing = savedPosts.find((post) => post.url === payload.url);
  const now = new Date().toISOString();
  const record = {
    id: existing?.id || createId(),
    createdAt: existing?.createdAt || now,
    updatedAt: now,
    ...payload
  };

  const nextPosts = existing
    ? savedPosts.map((post) => (post.id === existing.id ? record : post))
    : [record, ...savedPosts];

  await browserApi.storageSet(STORAGE_KEY, nextPosts);
  refs.tags.value = "";
  setStatus(refs, existing ? "Saved changes to existing post." : "Post saved to Taglio.", "success");
  await renderLibrary(refs, refs.search.value);
}

async function renderLibrary(refs, query) {
  const savedPosts = await getSavedPosts();
  const normalizedQuery = query.trim().toLowerCase();
  const filteredPosts = normalizedQuery
    ? savedPosts.filter((post) =>
        [post.title, post.author, post.notes, post.excerpt, ...(post.tags || [])]
          .join(" ")
          .toLowerCase()
          .includes(normalizedQuery)
      )
    : savedPosts;

  refs.librarySummary.textContent = `${savedPosts.length} post${savedPosts.length === 1 ? "" : "s"} saved`;
  refs.savedPosts.innerHTML = "";

  if (!filteredPosts.length) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = normalizedQuery
      ? "No saved posts match that search."
      : "No posts saved yet. Open LinkedIn, capture a post, and build the first entry.";
    refs.savedPosts.appendChild(empty);
    return;
  }

  filteredPosts.forEach((post) => {
    refs.savedPosts.appendChild(buildEntryCard(post));
  });
}

function buildEntryCard(post) {
  const card = document.createElement("article");
  card.className = "entry";

  const titleRow = document.createElement("div");
  titleRow.className = "entry__title-row";

  const title = document.createElement("h3");
  title.className = "entry__title";
  title.textContent = post.title;

  const meta = document.createElement("p");
  meta.className = "entry__meta";
  meta.textContent = post.author
    ? `${post.author} • Saved ${formatDate(post.updatedAt)}`
    : `Saved ${formatDate(post.updatedAt)}`;

  titleRow.append(title);

  const excerpt = document.createElement("p");
  excerpt.className = "entry__excerpt";
  excerpt.textContent = post.notes || post.excerpt || "Saved without notes.";

  const tags = document.createElement("p");
  tags.className = "entry__tags";
  tags.textContent = post.tags?.length ? `Tags: ${post.tags.join(", ")}` : "Tags: none";

  const actions = document.createElement("div");
  actions.className = "entry__actions";

  const openButton = document.createElement("button");
  openButton.type = "button";
  openButton.className = "entry__button";
  openButton.dataset.action = "open";
  openButton.dataset.id = post.id;
  openButton.textContent = "Open";

  const deleteButton = document.createElement("button");
  deleteButton.type = "button";
  deleteButton.className = "entry__button entry__button--danger";
  deleteButton.dataset.action = "delete";
  deleteButton.dataset.id = post.id;
  deleteButton.textContent = "Delete";

  actions.append(openButton, deleteButton);

  card.append(titleRow, meta, excerpt, tags, actions);
  return card;
}

async function handleLibraryAction(event, refs) {
  const button = event.target.closest("button[data-action]");

  if (!button) {
    return;
  }

  const { action, id } = button.dataset;
  const savedPosts = await getSavedPosts();
  const targetPost = savedPosts.find((post) => post.id === id);

  if (!targetPost) {
    return;
  }

  if (action === "open") {
    await browserApi.openUrl(targetPost.url);
    return;
  }

  if (action === "delete") {
    const nextPosts = savedPosts.filter((post) => post.id !== id);
    await browserApi.storageSet(STORAGE_KEY, nextPosts);
    setStatus(refs, "Post removed from Taglio.", "success");
    await renderLibrary(refs, refs.search.value);
  }
}

async function getSavedPosts() {
  const stored = await browserApi.storageGet(STORAGE_KEY);
  return Array.isArray(stored) ? stored : [];
}

function setStatus(refs, message, type = "") {
  refs.status.textContent = message;
  refs.status.className = "status";

  if (type) {
    refs.status.classList.add(`status--${type}`);
  }
}

function createId() {
  return `taglio-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
}

function formatDate(value) {
  try {
    return new Intl.DateTimeFormat(undefined, {
      month: "short",
      day: "numeric"
    }).format(new Date(value));
  } catch (_error) {
    return "recently";
  }
}

function createBrowserApi() {
  if (window.chrome?.storage?.local && window.chrome?.tabs) {
    return {
      async storageGet(key) {
        const result = await chrome.storage.local.get([key]);
        return result[key];
      },
      async storageSet(key, value) {
        await chrome.storage.local.set({ [key]: value });
      },
      queryActiveTab() {
        return chrome.tabs.query({ active: true, currentWindow: true });
      },
      async extractPostFromTab(tab) {
        if (!tab?.id) {
          return null;
        }

        try {
          return await chrome.tabs.sendMessage(tab.id, { type: "TAGLIO_EXTRACT_POST" });
        } catch (_error) {
          return null;
        }
      },
      async openUrl(url) {
        await chrome.tabs.create({ url });
      }
    };
  }

  return {
    async storageGet(key) {
      const raw = window.localStorage.getItem(key);
      return raw ? JSON.parse(raw) : [];
    },
    async storageSet(key, value) {
      window.localStorage.setItem(key, JSON.stringify(value));
    },
    async queryActiveTab() {
      return [
        {
          id: 0,
          title: "How top B2B teams structure LinkedIn swipe files",
          url: "https://www.linkedin.com/feed/update/urn:li:activity:123456789/"
        }
      ];
    },
    async extractPostFromTab(tab) {
      return {
        title: tab.title,
        author: "Preview mode",
        url: tab.url,
        excerpt: "Popup preview mode uses mock LinkedIn data so the interface can be reviewed outside Chrome."
      };
    },
    async openUrl(url) {
      window.open(url, "_blank", "noopener,noreferrer");
    }
  };
}
