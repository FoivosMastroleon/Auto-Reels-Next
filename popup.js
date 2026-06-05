const toggle = document.getElementById("toggle");
const label = document.getElementById("label");
let enabled = true;

chrome.storage.local.get({ enabled: true }, ({ enabled: e }) => {
    enabled = e;
    render();
});

toggle.addEventListener("change", () => {
    enabled = toggle.checked;
    chrome.storage.local.set({ enabled });
    render();
});

function render() {
    toggle.checked = enabled;
    label.textContent = enabled ? "Ενεργό" : "Ανενεργό";
    label.style.color = enabled ? "#ff4444" : "#888";
}
