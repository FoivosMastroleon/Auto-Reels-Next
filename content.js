if (window.__autoShortsRunning) throw new Error("already running");
window.__autoShortsRunning = true;

let lastTrigger = 0;
let enabled = true;

chrome.storage.local.get({ enabled: true }, ({ enabled: e }) => { enabled = e; });
chrome.storage.onChanged.addListener((changes) => {
    if (changes.enabled) enabled = changes.enabled.newValue;
});

setInterval(() => {
    if (!enabled) return;

    const v = document.querySelector("video");
    if (!v || !v.duration || v.paused) return;

    const remaining = v.duration - v.currentTime;
    const now = Date.now();

    if (remaining <= 0.3 && remaining > 0 && (now - lastTrigger) > 3000) {
        lastTrigger = now;

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
}, 300);
