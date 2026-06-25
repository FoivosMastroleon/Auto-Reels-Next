function drawIcon(anyEnabled) {
    const canvas = new OffscreenCanvas(32, 32);
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = anyEnabled ? "#ff0000" : "#888888";
    ctx.beginPath(); ctx.arc(16, 16, 15, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "white";
    ctx.beginPath(); ctx.moveTo(8, 9); ctx.lineTo(20, 16); ctx.lineTo(8, 23); ctx.closePath(); ctx.fill();
    ctx.fillRect(21, 9, 3, 14);
    return ctx.getImageData(0, 0, 32, 32);
}

function updateIcon() {
    chrome.storage.local.get({ enabled_youtube: true, enabled_instagram: true, enabled_facebook: true }, (res) => {
        const on = res.enabled_youtube || res.enabled_instagram || res.enabled_facebook;
        chrome.action.setIcon({ imageData: { 32: drawIcon(on) } });
    });
}
updateIcon();

chrome.storage.onChanged.addListener((changes) => {
    if ("enabled_youtube" in changes || "enabled_instagram" in changes || "enabled_facebook" in changes) {
        updateIcon();
    }
});

// ── Video URL cache ──────────────────────────────────────────────────────────

const tabVideoCache = new Map();

chrome.webRequest.onBeforeRequest.addListener(
    ({ url, tabId }) => {
        if (tabId < 0 || !url.split("?")[0].endsWith(".mp4")) return;
        try {
            const u = new URL(url);
            u.searchParams.delete("bytestart");
            u.searchParams.delete("byteend");
            tabVideoCache.set(tabId, u.toString());
        } catch { tabVideoCache.set(tabId, url); }
    },
    { urls: ["*://*.cdninstagram.com/*", "*://*.fbcdn.net/*"], types: ["media", "xmlhttprequest", "other"] }
);

// ── Messages ─────────────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg.type === "get_cached_video") {
        sendResponse({ url: tabVideoCache.get(msg.tabId) || null });
        return true;
    }
    if (msg.type === "VOICE_DOWNLOAD") {
        chrome.downloads.download({ url: msg.url, filename: "reel_" + Date.now() + ".mp4" });
    }
});

// ── Content script injection ─────────────────────────────────────────────────

function injectIfReels(details) {
    const url = details.url;
    if (
        url.includes("youtube.com/shorts/") ||
        url.includes("instagram.com/reels") ||
        url.includes("instagram.com/reel/") ||
        url.includes("facebook.com/reels") ||
        url.includes("facebook.com/reel/")
    ) {
        chrome.scripting.executeScript({ target: { tabId: details.tabId }, files: ["content.js"] });
    }
}

chrome.webNavigation.onHistoryStateUpdated.addListener(injectIfReels, {
    url: [
        { hostEquals: "www.youtube.com" },
        { hostEquals: "www.instagram.com" },
        { hostEquals: "www.facebook.com" }
    ]
});
