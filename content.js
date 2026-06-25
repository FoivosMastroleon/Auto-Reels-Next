(function () {
    if (window.__autoReelsRunning) return;
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

    let triggeredSrc = null;
    let triggerTime = 0;

    if (platform !== "youtube") {
        const s = document.createElement("script");
        s.src = chrome.runtime.getURL("injected.js");
        document.head.appendChild(s);
    }

    chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
        if (msg.type === "download") {
            if (platform === "youtube") { sendResponse({ ok: false, platform }); return true; }
            getPageVideoUrl().then(url => {
                sendResponse(url ? { ok: true, src: url } : { ok: false, platform });
            });
            return true;
        }
        if (msg.type === "VOICE_ACTION") runVoiceAction(msg.action);
        if (msg.type === "VOICE_BADGE") {
            msg.text ? showVoiceBadge(msg.text, msg.ms || 0) : hideVoiceBadge();
        }
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

    // ── Voice ───────────────────────────────────────────────────────────────

    const VOICE_CMDS = {
        next:     ['επόμενο', 'επόμενη', 'next', 'μετά'],
        stop:     ['σταμάτα', 'stop', 'παύση', 'pause'],
        start:    ['ξεκίνα', 'start', 'play', 'παίξε', 'συνέχισε'],
        download: ['κατέβασε', 'download', 'λήψη'],
        faster:   ['γρηγορότερα', 'faster', 'γρήγορα'],
        normal:   ['κανονικά', 'normal', 'αργά', 'slower'],
    };

    function matchVoiceCmd(text) {
        const words = text.trim().split(/\s+/);
        for (const [action, kws] of Object.entries(VOICE_CMDS)) {
            if (kws.some(kw => words.includes(kw))) return action;
        }
        return null;
    }

    let voiceRec = null;

    async function startVoice(triggerWord, lang) {
        stopVoice();

        const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SR) { showVoiceBadge('❌ SpeechRecognition δεν υποστηρίζεται', 5000); return; }

        voiceRec = new SR();
        voiceRec.lang = lang || 'el-GR';
        voiceRec.continuous = true;
        voiceRec.interimResults = true;
        voiceRec.maxAlternatives = 1;

        voiceRec.onstart = () => showVoiceBadge('🟢 Voice ενεργό', 2000);

        let lastActioned = null;
        voiceRec.onresult = (e) => {
            abortCount = 0;
            const result = e.results[e.results.length - 1];
            const transcript = result[0].transcript.toLowerCase().trim();
            const isFinal = result.isFinal;

            const action = matchVoiceCmd(transcript);
            showVoiceBadge('👂 ' + transcript + (action ? '  ✓' : ''), isFinal ? 1500 : 0);

            if (action && action !== lastActioned) {
                lastActioned = action;
                runVoiceAction(action);
                setTimeout(() => { lastActioned = null; }, 1500);
            }
        };

        let lastError = null;
        let abortCount = 0;

        voiceRec.onerror = (e) => {
            lastError = e.error;
            if (e.error === 'aborted') abortCount++;
            else if (e.error !== 'no-speech') showVoiceBadge('⚠ ' + e.error, 3000);
        };
        voiceRec.onend = () => {
            if (!voiceRec) return;
            if (lastError === 'not-allowed' || lastError === 'network') {
                showVoiceBadge('❌ ' + lastError + ' — δεν μπορεί να συνεχίσει', 0);
                voiceRec = null;
                return;
            }
            const delay = lastError === 'aborted' ? Math.min(500 * abortCount, 4000) : 800;
            lastError = null;
            setTimeout(() => {
                if (!voiceRec) return;
                try { voiceRec.start(); }
                catch (err) { showVoiceBadge('⚠ restart: ' + err.message, 3000); }
            }, delay);
        };

        try {
            voiceRec.start();
        } catch (err) {
            showVoiceBadge('❌ start error: ' + err.message, 5000);
        }
    }

    function stopVoice() {
        hideVoiceBadge();
        if (voiceRec) { const r = voiceRec; voiceRec = null; try { r.stop(); } catch (_) {} }
    }

    // Shows a click-to-activate banner — getUserMedia needs a user gesture on this site
    function showMicBanner(triggerWord, lang) {
        if (document.getElementById('__arVoiceBanner')) return;
        const b = document.createElement('div');
        b.id = '__arVoiceBanner';
        Object.assign(b.style, {
            position: 'fixed', top: '16px', left: '50%', transform: 'translateX(-50%)',
            background: 'rgba(10,10,10,0.92)', color: '#fff', padding: '10px 20px',
            borderRadius: '24px', fontSize: '13px', zIndex: '2147483647',
            cursor: 'pointer', border: '1px solid rgba(255,68,68,0.5)',
            backdropFilter: 'blur(8px)', fontFamily: '-apple-system, sans-serif',
            whiteSpace: 'nowrap', boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
        });
        b.textContent = '🎙 Κλικ εδώ για να ενεργοποιήσεις φωνητικές εντολές';
        document.body.appendChild(b);

        b.addEventListener('click', async () => {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                stream.getTracks().forEach(t => t.stop());
                b.remove();
                startVoice(triggerWord, lang);
            } catch {
                b.textContent = '❌ Δεν δόθηκε άδεια. Κλικ στο 🔒 της σελίδας.';
                setTimeout(() => b.remove(), 4000);
            }
        });

        setTimeout(() => b.remove(), 15000);
    }

    async function initVoiceForSite(triggerWord, lang) {
        // If permission already granted for this site, start directly (no user gesture needed)
        try {
            const perm = await navigator.permissions.query({ name: 'microphone' });
            if (perm.state === 'granted') {
                startVoice(triggerWord, lang);
                return;
            }
        } catch (_) {}
        // First time: show banner so user can click (user gesture → getUserMedia dialog)
        showMicBanner(triggerWord, lang);
    }

    chrome.storage.local.get({ voice_enabled: false, trigger_word: 'computer', voice_lang: 'el-GR' }, (res) => {
        if (res.voice_enabled) initVoiceForSite(res.trigger_word, res.voice_lang);
    });

    chrome.storage.onChanged.addListener((changes) => {
        const enabled = changes.voice_enabled?.newValue;
        const settingsChanged = 'trigger_word' in changes || 'voice_lang' in changes;
        if (enabled === true || (enabled === undefined && settingsChanged)) {
            chrome.storage.local.get({ trigger_word: 'computer', voice_lang: 'el-GR', voice_enabled: false }, (res) => {
                if (res.voice_enabled) initVoiceForSite(res.trigger_word, res.voice_lang);
            });
        }
        if (enabled === false) stopVoice();
    });

    // ── Voice actions ───────────────────────────────────────────────────────

    function runVoiceAction(action) {
        showVoiceBadge('⚡ ' + action + '…', 3000);
        switch (action) {
            case 'next': {
                const v = getActiveVideo();
                if (v) { v.pause(); triggerTime = 0; scrollToNext(v); }
                showVoiceBadge('▶▶ Επόμενο', 1500);
                break;
            }
            case 'stop': {
                document.querySelectorAll('video').forEach(v => v.pause());
                chrome.storage.local.set({ [enabledKey]: false });
                showVoiceBadge('⏸ Pause', 1500);
                break;
            }
            case 'start': {
                document.querySelectorAll('video').forEach(v => v.play());
                chrome.storage.local.set({ [enabledKey]: true });
                showVoiceBadge('▶ Play', 1500);
                break;
            }
            case 'download':
                getPageVideoUrl().then(url => {
                    if (url) chrome.runtime.sendMessage({ type: 'VOICE_DOWNLOAD', url });
                });
                showVoiceBadge('⬇ Κατεβαίνει…', 2000);
                break;
            case 'faster':
                chrome.storage.local.set({ speed: 2 });
                showVoiceBadge('⚡ 2×', 1500);
                break;
            case 'normal':
                chrome.storage.local.set({ speed: 1 });
                showVoiceBadge('▶ 1×', 1500);
                break;
        }
    }

    let voiceBadge = null;
    let badgeTimer = null;

    function showVoiceBadge(text, autohideMs = 0) {
        if (!voiceBadge) {
            voiceBadge = document.createElement('div');
            Object.assign(voiceBadge.style, {
                position: 'fixed',
                bottom: '24px',
                right: '24px',
                background: 'rgba(10,10,10,0.9)',
                color: '#fff',
                padding: '10px 18px',
                borderRadius: '24px',
                fontSize: '14px',
                fontFamily: '-apple-system, sans-serif',
                zIndex: '2147483647',
                border: '1px solid rgba(255,68,68,0.5)',
                boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
                backdropFilter: 'blur(8px)',
                pointerEvents: 'none',
            });
            document.body.appendChild(voiceBadge);
        }
        clearTimeout(badgeTimer);
        voiceBadge.textContent = text;
        voiceBadge.style.display = 'block';
        if (autohideMs) badgeTimer = setTimeout(hideVoiceBadge, autohideMs);
    }

    function hideVoiceBadge() {
        if (voiceBadge) voiceBadge.style.display = 'none';
    }

    // ── Auto-next interval ──────────────────────────────────────────────────

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
            const isLoop = src === triggeredSrc;
            const cooldown = isLoop ? 1500 : 500;

            if (now - triggerTime > cooldown) {
                triggeredSrc = src;
                triggerTime = now;
                v.pause();
                chrome.storage.local.get({ counter: 0 }, ({ counter }) => {
                    chrome.storage.local.set({ counter: counter + 1 });
                });
                scrollToNext(v);
            }
        }
    }, 300);

})();
