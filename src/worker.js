const CACHE_SECONDS = 900;

const YOUTUBE_CHANNEL_ID = "UC3E-VzmHn3vDjkopgFPJJqA";

const YOUTUBE_FEED_URL =
  `https://www.youtube.com/feeds/videos.xml?channel_id=${YOUTUBE_CHANNEL_ID}`;

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (url.pathname === "/api/latest-youtube") {
      return getLatestYouTubeUpload(request, ctx);
    }

    return env.ASSETS.fetch(request);
  },
};

async function getLatestYouTubeUpload(request, ctx) {
  if (request.method !== "GET") {
    return jsonResponse(
      { error: "Method not allowed." },
      405,
      { Allow: "GET" },
    );
  }

  const cache = caches.default;

  const cacheKey = new Request(
    new URL("/api/latest-youtube", request.url),
    { method: "GET" },
  );

  const cachedResponse = await cache.match(cacheKey);

  if (cachedResponse) {
    return cachedResponse;
  }

  try {
    const feedResponse = await fetch(YOUTUBE_FEED_URL, {
      headers: {
        "User-Agent": "AburnsyWebsite/1.0",
        Accept: "application/atom+xml, application/xml, text/xml",
      },
    });

    if (!feedResponse.ok) {
      throw new Error(
        `YouTube feed request failed with status ${feedResponse.status}.`,
      );
    }

    const xml = await feedResponse.text();
    const firstEntry = extractFirstTag(xml, "entry");

    if (!firstEntry) {
      throw new Error("No public YouTube upload was found.");
    }

    const videoId = decodeXml(
      extractTagValue(firstEntry, "yt:videoId"),
    );

    const title = decodeXml(
      extractTagValue(firstEntry, "title"),
    );

    const publishedAt = decodeXml(
      extractTagValue(firstEntry, "published"),
    );

    const description = decodeXml(
      extractTagValue(firstEntry, "media:description"),
    );

    const thumbnail =
      extractAttribute(firstEntry, "media:thumbnail", "url") ||
      (videoId
        ? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`
        : null);

    if (!videoId) {
      throw new Error("The latest upload did not include a video ID.");
    }

    const result = {
      videoId,
      title: title || "Latest Aburnsy upload",
      description: description || "",
      publishedAt: publishedAt || null,
      thumbnail,
      url: `https://www.youtube.com/watch?v=${videoId}`,
      embedUrl: `https://www.youtube.com/embed/${videoId}`,
    };

    const response = jsonResponse(result, 200, {
      "Cache-Control": `public, max-age=60, s-maxage=${CACHE_SECONDS}`,
    });

    ctx.waitUntil(cache.put(cacheKey, response.clone()));

    return response;
  } catch (error) {
    console.error("Latest YouTube upload error:", error);

    return jsonResponse(
      {
        error: "The latest YouTube upload could not be loaded.",
      },
      502,
      {
        "Cache-Control": "no-store",
      },
    );
  }
}

function extractFirstTag(xml, tagName) {
  const escapedTag = escapeRegExp(tagName);

  const match = xml.match(
    new RegExp(
      `<${escapedTag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${escapedTag}>`,
      "i",
    ),
  );

  return match?.[1]?.trim() ?? "";
}

function extractTagValue(xml, tagName) {
  const escapedTag = escapeRegExp(tagName);

  const match = xml.match(
    new RegExp(
      `<${escapedTag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${escapedTag}>`,
      "i",
    ),
  );

  return match?.[1]?.trim() ?? "";
}

function extractAttribute(xml, tagName, attributeName) {
  const escapedTag = escapeRegExp(tagName);
  const escapedAttribute = escapeRegExp(attributeName);

  const match = xml.match(
    new RegExp(
      `<${escapedTag}\\b[^>]*\\b${escapedAttribute}=["']([^"']+)["'][^>]*>`,
      "i",
    ),
  );

  return match?.[1] ?? "";
}

function decodeXml(value) {
  return value
    .replaceAll("<![CDATA[", "")
    .replaceAll("]]>", "")
    .replaceAll("&amp;", "&")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'")
    .replaceAll("&apos;", "'")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">");
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function jsonResponse(data, status = 200, additionalHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...additionalHeaders,
    },
  });
}