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

// Download current reel
const dlBtn = document.getElementById("download-btn");
const dlStatus = document.getElementById("dl-status");

dlBtn.addEventListener("click", () => {
    dlBtn.classList.add("loading");
    dlStatus.textContent = "";
    dlStatus.className = "download-status";

    chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
        if (!tab?.id) {
            setDlState("error", "Δεν βρέθηκε ενεργή καρτέλα.");
            return;
        }

        chrome.tabs.sendMessage(tab.id, { type: "download" }, (res) => {
            if (chrome.runtime.lastError || !res) {
                setDlState("error", "Άνοιξε πρώτα ένα Reel/Short.");
                return;
            }
            if (!res.ok) {
                setDlState("error", res.platform === "youtube"
                    ? "Τα YouTube Shorts δεν υποστηρίζουν άμεση λήψη."
                    : "Δεν βρέθηκε URL. Κάνε scroll σε ένα reel και ξαναπάτα."
                );
                return;
            }
            startDownload(res.src);
        });
    });
});

function startDownload(url) {
    const filename = "reel_" + Date.now() + ".mp4";
    chrome.downloads.download({ url, filename }, (id) => {
        if (chrome.runtime.lastError || id === undefined) {
            setDlState("error", "Αποτυχία λήψης.");
        } else {
            setDlState("success", "Η λήψη ξεκίνησε!");
        }
    });
}

function setDlState(state, msg) {
    dlBtn.classList.remove("loading");
    dlBtn.className = "download-btn" + (state === "error" ? " error" : state === "success" ? " success" : "");
    dlStatus.textContent = msg;
    dlStatus.className = "download-status" + (state === "error" ? " err" : "");
    if (state !== "error") setTimeout(() => {
        dlBtn.className = "download-btn";
        dlStatus.textContent = "";
    }, 2500);
}
