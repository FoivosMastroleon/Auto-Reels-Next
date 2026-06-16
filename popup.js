const platforms = ["youtube", "instagram", "facebook"];

chrome.storage.local.get({
    enabled_youtube: true,
    enabled_instagram: true,
    enabled_facebook: true,
    speed: 1,
    counter: 0
}, (res) => {
    for (const p of platforms) {
        document.getElementById(`tog-${p}`).checked = res[`enabled_${p}`];
    }
    setActiveSpeed(res.speed);
    document.getElementById("counter").textContent = res.counter;
});

// Platform toggles
for (const p of platforms) {
    document.getElementById(`tog-${p}`).addEventListener("change", (e) => {
        chrome.storage.local.set({ [`enabled_${p}`]: e.target.checked });
    });
}

// Speed buttons
for (const btn of document.querySelectorAll(".speed-btn")) {
    btn.addEventListener("click", () => {
        const speed = parseFloat(btn.dataset.speed);
        chrome.storage.local.set({ speed });
        setActiveSpeed(speed);
    });
}

function setActiveSpeed(speed) {
    for (const btn of document.querySelectorAll(".speed-btn")) {
        btn.classList.toggle("active", parseFloat(btn.dataset.speed) === speed);
    }
}

// Counter reset
document.getElementById("reset").addEventListener("click", () => {
    chrome.storage.local.set({ counter: 0 });
    document.getElementById("counter").textContent = "0";
});

// Live counter update (ενημερώνεται αν αλλάξει ενώ το popup είναι ανοιχτό)
chrome.storage.onChanged.addListener((changes) => {
    if (changes.counter) {
        document.getElementById("counter").textContent = changes.counter.newValue;
    }
});
