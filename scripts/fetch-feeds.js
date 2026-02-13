/* Fetch and filter RSS feeds for British folklore and UK foraging. */
const fs = require("fs");
const path = require("path");
const Parser = require("rss-parser");

const parser = new Parser();

const OUTPUT_PATH = path.join(__dirname, "..", "data", "articles.json");

const KEYWORDS = [
  "folklore",
  "myth",
  "legend",
  "faerie",
  "ghost",
  "fairy",
  "witch",
  "witchcraft",
  "spell",
  "magic",
  "vampire",
  "foraging",
  "wild food",
  "hedgerow",
  "mushroom",
  "fungi",
  "seaweed"
];

const FEEDS = [
  {
    url: "https://www.eatweeds.co.uk/feed",
    source: "Eatweeds (Foraging)"
  },
  {
    url: "https://www.wildfooduk.com/articles/feed/",
    source: "Wild Food UK (Foraging)"
  },
  {
    url: "https://publicdomainreview.org/rss.xml",
    source: "The Public Domain Review (Folklore & Culture)"
  },
  {
    url: "https://www.mushroomguide.com/rss/news",
    source: "Mushroom Guide (Mushrooms)"
  },
  {
    url: "https://www.britishmyths.org.uk/feed/",
    source: "British Myths (Folklore & Myth)"
  },
  {
    url: "https://www.sfs.org.uk/feed/",
    source: "Society for Storytelling"
  },
  {
    url: "https://archaeology.co.uk/feed",
    source: "Current Archaeology"
  },
  {
    url: "https://the-past.com/feed/",
    source: "The Past"
  },
  {
    url: "https://folklorethursday.com/feed",
    source: "Folklore Thursday"
  },
  {
    url: "https://news.google.com/rss/search?q=uk+folklore+when:7d&hl=en-GB&gl=GB&ceid=GB:en",
    source: "Google Folklore News"
  },
  {
    url: "https://thetravellingtalesman.wordpress.com/feed",
    source: "The Travelling Talesman"
  },
  {
    url: "https://feeds.blubrry.com/feeds/thefolklorepodcast.xml",
    source: "The Folklore Podcast"
  },
  {
    url: "https://feeds.acast.com/public/shows/6705a49ded8ff5205e0064c0",
    source: "Wyrd Folk Podcast"
  },
  {
    url: "https://historyandfolklorepodcast.libsyn.com/rss",
    source: "History and Folklore Podcast"
  }
 
];

function normaliseText(value) {
  if (!value) return "";
  return String(value)
    .replace(/<[^>]+>/g, " ") // strip HTML tags
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function buildExcerpt(item) {
  const raw =
    item.contentSnippet ||
    item.summary ||
    item.content ||
    item.description ||
    item.title ||
    "";

  let text = String(raw).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  const limit = 280;
  if (text.length > limit) {
    text = text.slice(0, limit - 1).trimEnd() + "…";
  }
  return text;
}

function extractDate(item) {
  if (item.isoDate) {
    return item.isoDate;
  }
  if (item.pubDate) {
    const d = new Date(item.pubDate);
    if (!isNaN(d.getTime())) {
      return d.toISOString();
    }
  }
  return null;
}

function getSearchableText(item) {
  return [
    item.title,
    item.description,
    item.content,
    item.summary,
    item.contentSnippet
  ]
    .filter(Boolean)
    .join(" ");
}

function extractImage(item) {
  // Prefer enclosure URL if provided
  if (item.enclosure && item.enclosure.url) {
    return item.enclosure.url;
  }

  // Check for itunes:image or media:content
  if (item.itunes && item.itunes.image) {
    return item.itunes.image;
  }
  if (item.media && item.media.content && item.media.content.url) {
    return item.media.content.url;
  }

  // Fallback: first <img> in HTML content/description
  const html = item.content || item.description || "";
  if (!html) return null;
  
  // Try multiple regex patterns to catch different image formats
  let match = String(html).match(/<img[^>]+src=["']([^"']+)["']/i);
  if (!match) {
    match = String(html).match(/<img[^>]+src=([^\s>]+)/i);
  }
  
  if (!match) return null;
  
  let imageUrl = match[1];
  
  // Resolve relative URLs
  if (imageUrl.startsWith("//")) {
    imageUrl = "https:" + imageUrl;
  } else if (imageUrl.startsWith("/") && item.link) {
    try {
      const baseUrl = new URL(item.link);
      imageUrl = baseUrl.origin + imageUrl;
    } catch (e) {
      // If URL parsing fails, return as-is
    }
  } else if (!imageUrl.startsWith("http")) {
    // Relative URL without leading slash
    if (item.link) {
      try {
        const baseUrl = new URL(item.link);
        imageUrl = new URL(imageUrl, baseUrl.origin + "/").href;
      } catch (e) {
        // If URL parsing fails, return as-is
      }
    }
  }
  
  return imageUrl;
}

function itemMatchesKeywords(item) {
  const text = normaliseText(getSearchableText(item));
  if (!text) return false;
  return KEYWORDS.some((kw) => text.includes(kw.toLowerCase()));
}

function extractTags(item) {
  const text = normaliseText(getSearchableText(item));
  if (!text) return [];
  const tags = KEYWORDS.filter((kw) => text.includes(kw.toLowerCase()));
  return Array.from(new Set(tags));
}

function isWithinLastMonth(isoDate) {
  if (!isoDate) return false;
  const itemDate = new Date(isoDate);
  if (Number.isNaN(itemDate.getTime())) return false;

  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  return itemDate >= thirtyDaysAgo;
}

async function fetchFeed(feed) {
  const feedData = await parser.parseURL(feed.url);
  const items = Array.isArray(feedData.items) ? feedData.items : [];

  return items
    .filter((item) => itemMatchesKeywords(item))
    .map((item) => {
      const link = item.link || item.guid || "";
      const date = extractDate(item);
      const tags = extractTags(item);
       const image = extractImage(item);

      return {
        title: item.title || "(Untitled)",
        link,
        date,
        source: feed.source,
        tags,
        excerpt: buildExcerpt(item),
        image: image || null
      };
    });
}

async function main() {
  try {
    const allItems = [];

    for (const feed of FEEDS) {
      try {
        const items = await fetchFeed(feed);
        allItems.push(...items);
      } catch (err) {
        console.error(`Failed to fetch feed ${feed.url}:`, err.message || err);
      }
    }

    // Deduplicate by link
    const byLink = new Map();
    for (const item of allItems) {
      if (!item.link) continue;
      if (!byLink.has(item.link)) {
        byLink.set(item.link, item);
      }
    }

    let uniqueItems = Array.from(byLink.values());

    // Sort newest first (date filter removed - show all matching articles)
    uniqueItems.sort((a, b) => {
      const aTime = a.date ? new Date(a.date).getTime() : 0;
      const bTime = b.date ? new Date(b.date).getTime() : 0;
      return bTime - aTime;
    });

    // Limit to 120 items
    uniqueItems = uniqueItems.slice(0, 120);

    const output = {
      generatedAt: new Date().toISOString(),
      items: uniqueItems
    };

    const outDir = path.dirname(OUTPUT_PATH);
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(OUTPUT_PATH, JSON.stringify(output, null, 2), "utf8");

    console.log(
      `Wrote ${uniqueItems.length} articles to ${path.relative(
        process.cwd(),
        OUTPUT_PATH
      )}`
    );
  } catch (err) {
    console.error("Unexpected error while fetching feeds:", err);
    process.exitCode = 1;
  }
}

if (require.main === module) {
  main();
}

