var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// src/worker.js
var CACHE_SECONDS = 900;
var YOUTUBE_CHANNEL_ID = "UC3E-VzmHn3vDjkopgFPJJqA";
var YOUTUBE_FEED_URL = `https://www.youtube.com/feeds/videos.xml?channel_id=${YOUTUBE_CHANNEL_ID}`;
var worker_default = {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname === "/api/latest-youtube") {
      return getLatestYouTubeUpload(request, ctx);
    }
    return env.ASSETS.fetch(request);
  }
};
async function getLatestYouTubeUpload(request, ctx) {
  if (request.method !== "GET") {
    return jsonResponse(
      { error: "Method not allowed." },
      405,
      { Allow: "GET" }
    );
  }
  const cache = caches.default;
  const cacheKey = new Request(
    new URL("/api/latest-youtube", request.url),
    { method: "GET" }
  );
  const cachedResponse = await cache.match(cacheKey);
  if (cachedResponse) {
    return cachedResponse;
  }
  try {
    const feedResponse = await fetch(YOUTUBE_FEED_URL, {
      headers: {
        "User-Agent": "AburnsyWebsite/1.0",
        Accept: "application/atom+xml, application/xml, text/xml"
      }
    });
    if (!feedResponse.ok) {
      throw new Error(
        `YouTube feed request failed with status ${feedResponse.status}.`
      );
    }
    const xml = await feedResponse.text();
    const firstEntry = extractFirstTag(xml, "entry");
    if (!firstEntry) {
      throw new Error("No public YouTube upload was found.");
    }
    const videoId = decodeXml(
      extractTagValue(firstEntry, "yt:videoId")
    );
    const title = decodeXml(
      extractTagValue(firstEntry, "title")
    );
    const publishedAt = decodeXml(
      extractTagValue(firstEntry, "published")
    );
    const description = decodeXml(
      extractTagValue(firstEntry, "media:description")
    );
    const thumbnail = extractAttribute(firstEntry, "media:thumbnail", "url") || (videoId ? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg` : null);
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
      embedUrl: `https://www.youtube.com/embed/${videoId}`
    };
    const response = jsonResponse(result, 200, {
      "Cache-Control": `public, max-age=60, s-maxage=${CACHE_SECONDS}`
    });
    ctx.waitUntil(cache.put(cacheKey, response.clone()));
    return response;
  } catch (error) {
    console.error("Latest YouTube upload error:", error);
    return jsonResponse(
      {
        error: "The latest YouTube upload could not be loaded."
      },
      502,
      {
        "Cache-Control": "no-store"
      }
    );
  }
}
__name(getLatestYouTubeUpload, "getLatestYouTubeUpload");
function extractFirstTag(xml, tagName) {
  const escapedTag = escapeRegExp(tagName);
  const match = xml.match(
    new RegExp(
      `<${escapedTag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${escapedTag}>`,
      "i"
    )
  );
  return match?.[1]?.trim() ?? "";
}
__name(extractFirstTag, "extractFirstTag");
function extractTagValue(xml, tagName) {
  const escapedTag = escapeRegExp(tagName);
  const match = xml.match(
    new RegExp(
      `<${escapedTag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${escapedTag}>`,
      "i"
    )
  );
  return match?.[1]?.trim() ?? "";
}
__name(extractTagValue, "extractTagValue");
function extractAttribute(xml, tagName, attributeName) {
  const escapedTag = escapeRegExp(tagName);
  const escapedAttribute = escapeRegExp(attributeName);
  const match = xml.match(
    new RegExp(
      `<${escapedTag}\\b[^>]*\\b${escapedAttribute}=["']([^"']+)["'][^>]*>`,
      "i"
    )
  );
  return match?.[1] ?? "";
}
__name(extractAttribute, "extractAttribute");
function decodeXml(value) {
  return value.replaceAll("<![CDATA[", "").replaceAll("]]>", "").replaceAll("&amp;", "&").replaceAll("&quot;", '"').replaceAll("&#39;", "'").replaceAll("&apos;", "'").replaceAll("&lt;", "<").replaceAll("&gt;", ">");
}
__name(decodeXml, "decodeXml");
function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
__name(escapeRegExp, "escapeRegExp");
function jsonResponse(data, status = 200, additionalHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...additionalHeaders
    }
  });
}
__name(jsonResponse, "jsonResponse");

// node_modules/wrangler/templates/middleware/middleware-ensure-req-body-drained.ts
var drainBody = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } finally {
    try {
      if (request.body !== null && !request.bodyUsed) {
        const reader = request.body.getReader();
        while (!(await reader.read()).done) {
        }
      }
    } catch (e) {
      console.error("Failed to drain the unused request body.", e);
    }
  }
}, "drainBody");
var middleware_ensure_req_body_drained_default = drainBody;

// node_modules/wrangler/templates/middleware/middleware-miniflare3-json-error.ts
function reduceError(e) {
  return {
    name: e?.name,
    message: e?.message ?? String(e),
    stack: e?.stack,
    cause: e?.cause === void 0 ? void 0 : reduceError(e.cause)
  };
}
__name(reduceError, "reduceError");
var jsonError = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } catch (e) {
    const error = reduceError(e);
    const body = JSON.stringify(error);
    const headers = {
      "Content-Type": "application/json",
      "MF-Experimental-Error-Stack": "true"
    };
    const encoded = encodeURIComponent(body);
    if (encoded.length <= 8192) {
      headers["MF-Experimental-Error-Stack-Payload"] = encoded;
    }
    return new Response(body, { status: 500, headers });
  }
}, "jsonError");
var middleware_miniflare3_json_error_default = jsonError;

// .wrangler/tmp/bundle-hZmw4J/middleware-insertion-facade.js
var __INTERNAL_WRANGLER_MIDDLEWARE__ = [
  middleware_ensure_req_body_drained_default,
  middleware_miniflare3_json_error_default
];
var middleware_insertion_facade_default = worker_default;

// node_modules/wrangler/templates/middleware/common.ts
var __facade_middleware__ = [];
function __facade_register__(...args) {
  __facade_middleware__.push(...args.flat());
}
__name(__facade_register__, "__facade_register__");
function __facade_invokeChain__(request, env, ctx, dispatch, middlewareChain) {
  const [head, ...tail] = middlewareChain;
  const middlewareCtx = {
    dispatch,
    next(newRequest, newEnv) {
      return __facade_invokeChain__(newRequest, newEnv, ctx, dispatch, tail);
    }
  };
  return head(request, env, ctx, middlewareCtx);
}
__name(__facade_invokeChain__, "__facade_invokeChain__");
function __facade_invoke__(request, env, ctx, dispatch, finalMiddleware) {
  return __facade_invokeChain__(request, env, ctx, dispatch, [
    ...__facade_middleware__,
    finalMiddleware
  ]);
}
__name(__facade_invoke__, "__facade_invoke__");

// .wrangler/tmp/bundle-hZmw4J/middleware-loader.entry.ts
var __Facade_ScheduledController__ = class ___Facade_ScheduledController__ {
  constructor(scheduledTime, cron, noRetry) {
    this.scheduledTime = scheduledTime;
    this.cron = cron;
    this.#noRetry = noRetry;
  }
  scheduledTime;
  cron;
  static {
    __name(this, "__Facade_ScheduledController__");
  }
  #noRetry;
  noRetry() {
    if (!(this instanceof ___Facade_ScheduledController__)) {
      throw new TypeError("Illegal invocation");
    }
    this.#noRetry();
  }
};
function wrapExportedHandler(worker) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return worker;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  const fetchDispatcher = /* @__PURE__ */ __name(function(request, env, ctx) {
    if (worker.fetch === void 0) {
      throw new Error("Handler does not export a fetch() function.");
    }
    return worker.fetch(request, env, ctx);
  }, "fetchDispatcher");
  return {
    ...worker,
    fetch(request, env, ctx) {
      const dispatcher = /* @__PURE__ */ __name(function(type, init) {
        if (type === "scheduled" && worker.scheduled !== void 0) {
          const controller = new __Facade_ScheduledController__(
            Date.now(),
            init.cron ?? "",
            () => {
            }
          );
          return worker.scheduled(controller, env, ctx);
        }
      }, "dispatcher");
      return __facade_invoke__(request, env, ctx, dispatcher, fetchDispatcher);
    }
  };
}
__name(wrapExportedHandler, "wrapExportedHandler");
function wrapWorkerEntrypoint(klass) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return klass;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  return class extends klass {
    #fetchDispatcher = /* @__PURE__ */ __name((request, env, ctx) => {
      this.env = env;
      this.ctx = ctx;
      if (super.fetch === void 0) {
        throw new Error("Entrypoint class does not define a fetch() function.");
      }
      return super.fetch(request);
    }, "#fetchDispatcher");
    #dispatcher = /* @__PURE__ */ __name((type, init) => {
      if (type === "scheduled" && super.scheduled !== void 0) {
        const controller = new __Facade_ScheduledController__(
          Date.now(),
          init.cron ?? "",
          () => {
          }
        );
        return super.scheduled(controller);
      }
    }, "#dispatcher");
    fetch(request) {
      return __facade_invoke__(
        request,
        this.env,
        this.ctx,
        this.#dispatcher,
        this.#fetchDispatcher
      );
    }
  };
}
__name(wrapWorkerEntrypoint, "wrapWorkerEntrypoint");
var WRAPPED_ENTRY;
if (typeof middleware_insertion_facade_default === "object") {
  WRAPPED_ENTRY = wrapExportedHandler(middleware_insertion_facade_default);
} else if (typeof middleware_insertion_facade_default === "function") {
  WRAPPED_ENTRY = wrapWorkerEntrypoint(middleware_insertion_facade_default);
}
var middleware_loader_entry_default = WRAPPED_ENTRY;
export {
  __INTERNAL_WRANGLER_MIDDLEWARE__,
  middleware_loader_entry_default as default
};
//# sourceMappingURL=worker.js.map
