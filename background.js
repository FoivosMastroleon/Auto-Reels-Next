function drawIcon(enabled) {
    const canvas = new OffscreenCanvas(32, 32);
    const ctx = canvas.getContext("2d");

    ctx.fillStyle = enabled ? "#ff0000" : "#888888";
    ctx.beginPath();
    ctx.arc(16, 16, 15, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "white";
    ctx.beginPath();
    ctx.moveTo(8, 9);
    ctx.lineTo(20, 16);
    ctx.lineTo(8, 23);
    ctx.closePath();
    ctx.fill();

    ctx.fillRect(21, 9, 3, 14);

    return ctx.getImageData(0, 0, 32, 32);
}

function updateIcon(enabled) {
    chrome.action.setIcon({ imageData: { 32: drawIcon(enabled) } });
}

chrome.storage.local.get({ enabled: true }, ({ enabled }) => updateIcon(enabled));
chrome.storage.onChanged.addListener((changes) => {
    if (changes.enabled) updateIcon(changes.enabled.newValue);
});

// Re-inject content script on SPA navigation to Shorts
chrome.webNavigation.onHistoryStateUpdated.addListener((details) => {
    if (!details.url.includes("/shorts/")) return;

    chrome.scripting.executeScript({
        target: { tabId: details.tabId },
        files: ["content.js"]
    });
}, { url: [{ hostEquals: "www.youtube.com" }] });
