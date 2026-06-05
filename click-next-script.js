let lastTrigger = 0;

setInterval(() => {
    const v = document.querySelector("video");
    if (!v || !v.duration || v.paused) return;

    const remaining = v.duration - v.currentTime;
    const now = Date.now();

    // Trigger when 0.3s or less remaining, with 3s cooldown to avoid double-firing
    if (remaining <= 0.3 && remaining > 0 && (now - lastTrigger) > 3000) {
        lastTrigger = now;
        console.log("Near end, navigating to next short");

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
