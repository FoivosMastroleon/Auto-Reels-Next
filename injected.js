if (!window.__reelsInjected) {
    window.__reelsInjected = true;
    window.__reelsCurrentUrl = null;

    function _decode(s) {
        return s
            .replace(/\\u0026/g, "&")
            .replace(/\\u002F/g, "/")
            .replace(/\\\//g, "/");
    }

    // playable_url is always the combined audio+video MP4.
    // video_url / audio_url are separate DASH tracks — never use them.
    function _extract(text) {
        for (const key of ["playable_url_quality_hd", "playable_url"]) {
            const m = text.match(new RegExp('"' + key + '"\\s*:\\s*"(https?:[^"]{20,})"'));
            if (!m) continue;
            const url = _decode(m[1]);
            if (url.includes("cdninstagram.com") || url.includes("fbcdn.net")) return url;
        }
        return null;
    }

    // Scan script tags present at injection time (handles initial page load)
    for (const el of document.querySelectorAll("script")) {
        const t = el.textContent || "";
        if (!t.includes("playable_url")) continue;
        const url = _extract(t);
        if (url) { window.__reelsCurrentUrl = url; break; }
    }

    // Wrap fetch so every future reel API response is captured automatically
    const _orig = window.fetch;
    window.fetch = async function(...args) {
        const resp = await _orig.apply(this, args);
        try {
            const reqUrl = typeof args[0] === "string" ? args[0] : (args[0]?.url || "");
            if (reqUrl.includes("graphql") || reqUrl.includes("/api/")) {
                resp.clone().text().then(text => {
                    if (!text.includes("playable_url")) return;
                    const url = _extract(text);
                    if (url) window.__reelsCurrentUrl = url;
                }).catch(() => {});
            }
        } catch {}
        return resp;
    };
}

// Persistent listener — responds every time content script asks
window.addEventListener("__reels_request_url__", function() {
    window.dispatchEvent(new CustomEvent("__reels_url_ready__", {
        detail: { url: window.__reelsCurrentUrl || null }
    }));
});
