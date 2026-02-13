(function () {
  "use strict";

  const DEFAULT_IMAGE =
    "data:image/svg+xml;utf8," +
    encodeURIComponent(
      '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#14532d"/><stop offset="1" stop-color="#0f172a"/></linearGradient></defs><rect width="64" height="64" fill="url(#g)"/><circle cx="20" cy="40" r="10" fill="#bbf7d0"/><path d="M18 36c4-8 10-14 18-16" stroke="#bbf7d0" stroke-width="2" fill="none" stroke-linecap="round"/><path d="M32 20c2 3 3 6 3 10" stroke="#bbf7d0" stroke-width="2" fill="none" stroke-linecap="round"/></svg>'
    );

  const state = {
    items: [],
    filtered: [],
    generatedAt: null
  };

  function escapeText(text) {
    // We only ever assign to textContent, but keep this for any future safety.
    return String(text == null ? "" : text);
  }

  function formatDate(iso) {
    if (!iso) return "Unknown date";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "Unknown date";
    return d.toLocaleDateString("en-GB", {
      year: "numeric",
      month: "short",
      day: "numeric"
    });
  }

  function formatGeneratedAt(iso) {
    if (!iso) return "";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    return d.toLocaleString("en-GB", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZoneName: "short"
    });
  }

  function render() {
    const container = document.getElementById("articles");
    const countEl = document.getElementById("count");
    const genEl = document.getElementById("generated");

    if (!container) return;

    const items = state.filtered;

    container.innerHTML = "";

    if (!items.length) {
      const p = document.createElement("p");
      p.textContent = "No articles match your current filters.";
      container.appendChild(p);
    } else {
      for (const item of items) {
        const card = document.createElement("article");
        card.className = "card";

        const imageUrl = item.image || DEFAULT_IMAGE;
        const img = document.createElement("img");
        img.className = "card-image";
        img.src = imageUrl;
        img.alt = item.title
          ? `Image for ${item.title}`
          : "Article image";

        const h2 = document.createElement("h2");
        h2.className = "card-title";
        const link = document.createElement("a");
        link.href = item.link || "#";
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        link.textContent = escapeText(item.title || "(Untitled)");
        h2.appendChild(link);

        const meta = document.createElement("div");
        meta.className = "meta";
        const source = escapeText(item.source || "Unknown source");
        const date = formatDate(item.date);
        meta.textContent = `${source} \u00b7 ${date}`;

        const excerpt = document.createElement("p");
        excerpt.className = "excerpt";
        excerpt.textContent = escapeText(item.excerpt || "");

        card.appendChild(img);
        card.appendChild(h2);
        card.appendChild(meta);
        card.appendChild(excerpt);

        if (Array.isArray(item.tags) && item.tags.length > 0) {
          const tagsWrap = document.createElement("div");
          tagsWrap.className = "tags";
          for (const tag of item.tags) {
            const span = document.createElement("span");
            span.className = "tag";
            span.textContent = escapeText(tag);
            tagsWrap.appendChild(span);
          }
          card.appendChild(tagsWrap);
        }

        container.appendChild(card);
      }
    }

    if (countEl) {
      const total = state.items.length;
      const visible = items.length;
      countEl.textContent =
        total && visible !== total
          ? `${visible} of ${total} articles`
          : `${visible} articles`;
    }

    if (genEl) {
      const formatted = formatGeneratedAt(state.generatedAt);
      genEl.textContent = formatted ? `Updated ${formatted}` : "";
    }
  }

  function applyFilter(term) {
    const query = term.trim().toLowerCase();
    if (!query) {
      state.filtered = state.items.slice();
      render();
      return;
    }

    state.filtered = state.items.filter((item) => {
      const haystack =
        (item.title || "") +
        " " +
        (item.source || "") +
        " " +
        (item.excerpt || "") +
        " " +
        (Array.isArray(item.tags) ? item.tags.join(" ") : "");

      return haystack.toLowerCase().includes(query);
    });

    render();
  }

  async function load() {
    const container = document.getElementById("articles");
    if (!container) return;

    try {
      const res = await fetch("data/articles.json", {
        cache: "no-store"
      });
      if (!res.ok) {
        throw new Error("Failed to load data");
      }
      const data = await res.json();
      const items = Array.isArray(data.items) ? data.items : [];

      state.items = items;
      state.filtered = items.slice();
      state.generatedAt = data.generatedAt || null;
      render();
    } catch (err) {
      container.innerHTML = "";
      const p = document.createElement("p");
      p.textContent =
        "There was a problem loading the latest articles. Please try again later.";
      container.appendChild(p);
      // Also log to console for debugging.
      console.error(err);
    }
  }

  document.addEventListener("DOMContentLoaded", function () {
    const input = document.getElementById("search");
    if (input) {
      input.addEventListener("input", function (event) {
        applyFilter(event.target.value || "");
      });
    }
    load();
  });
})();

