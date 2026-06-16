if (window.__autoReelsRunning) throw new Error("already running");
window.__autoReelsRunning = true;

const platform = detectPlatform();
let platformEnabled = true;
let speed = 1;

function detectPlatform() {
    const h = location.hostname;
    if (h.includes("youtube")) return "youtube";
    if (h.includes("instagram")) return "instagram";
    return "facebook";
}

const enabledKey = `enabled_${platform}`;
chrome.storage.local.get({ [enabledKey]: true, speed: 1 }, (res) => {
    platformEnabled = res[enabledKey];
    speed = res.speed;
    applySpeed();
});

chrome.storage.onChanged.addListener((changes) => {
    if (changes[enabledKey]) platformEnabled = changes[enabledKey].newValue;
    if (changes.speed) {
        speed = changes.speed.newValue;
        applySpeed();
    }
});

function applySpeed() {
    document.querySelectorAll("video").forEach(v => { v.playbackRate = speed; });
}

// Apply speed to videos added dynamically
const observer = new MutationObserver((mutations) => {
    for (const m of mutations) {
        for (const node of m.addedNodes) {
            if (node.nodeType !== 1) continue;
            if (node.tagName === "VIDEO") node.playbackRate = speed;
            node.querySelectorAll?.("video").forEach(v => { v.playbackRate = speed; });
        }
    }
});
observer.observe(document.body, { childList: true, subtree: true });

function getActiveVideo() {
    for (const v of document.querySelectorAll("video")) {
        if (!v.paused && v.duration && v.readyState >= 2) return v;
    }
    return null;
}

function scrollToNext(v) {
    let el = v.parentElement;
    while (el && el !== document.body) {
        const { overflow, overflowY } = window.getComputedStyle(el);
        if (/(auto|scroll)/.test(overflow + overflowY)) {
            el.scrollBy({ top: el.clientHeight, behavior: "smooth" });
            return;
        }
        el = el.parentElement;
    }
    document.dispatchEvent(new WheelEvent("wheel", {
        deltaY: window.innerHeight,
        bubbles: true,
        cancelable: true,
        view: window
    }));
}

// Loop detection: track last triggered video src and time
let triggeredSrc = null;
let triggerTime = 0;

// Inject immediately so the fetch wrapper is ready before the user scrolls
if (platform !== "youtube") {
    const s = document.createElement("script");
    s.src = chrome.runtime.getURL("injected.js");
    document.head.appendChild(s);
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg.type !== "download") return;

    if (platform === "youtube") {
        sendResponse({ ok: false, platform });
        return true;
    }

    getPageVideoUrl().then(url => {
        if (url) {
            sendResponse({ ok: true, src: url });
        } else {
            sendResponse({ ok: false, platform });
        }
    });
    return true;
});

function getPageVideoUrl() {
    return new Promise((resolve) => {
        let done = false;
        const handler = (e) => {
            if (done) return;
            done = true;
            window.removeEventListener("__reels_url_ready__", handler);
            resolve(e.detail?.url || null);
        };
        window.addEventListener("__reels_url_ready__", handler);
        window.dispatchEvent(new CustomEvent("__reels_request_url__"));

        setTimeout(() => {
            if (done) return;
            done = true;
            window.removeEventListener("__reels_url_ready__", handler);
            resolve(null);
        }, 2000);
    });
}

setInterval(() => {
    if (!platformEnabled) return;

    const v = getActiveVideo();
    if (!v) return;

    if (v.playbackRate !== speed) v.playbackRate = speed;
    if (v.muted) v.muted = false;

    const remaining = v.duration - v.currentTime;
    const now = Date.now();
    const src = v.currentSrc || v.src;

    if (remaining <= 0.3 && remaining > 0) {
        // isLoop: same video is ending again (looped by platform)
        const isLoop = src === triggeredSrc;
        const cooldown = isLoop ? 1500 : 500;

        if (now - triggerTime > cooldown) {
            triggeredSrc = src;
            triggerTime = now;

            chrome.storage.local.get({ counter: 0 }, ({ counter }) => {
                chrome.storage.local.set({ counter: counter + 1 });
            });

            scrollToNext(v);
        }
    }
}, 300);
