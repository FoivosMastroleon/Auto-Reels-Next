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

    function getVisibleVideo() {
        let bestV = null, bestArea = 0;
        for (const v of document.querySelectorAll("video")) {
            const r = v.getBoundingClientRect();
            const visW = Math.max(0, Math.min(r.right, window.innerWidth) - Math.max(r.left, 0));
            const visH = Math.max(0, Math.min(r.bottom, window.innerHeight) - Math.max(r.top, 0));
            const area = visW * visH;
            if (area > bestArea) { bestArea = area; bestV = v; }
        }
        return bestV;
    }

    function scrollToNext(v) {
        if (platform === 'youtube') {
            const btn = document.querySelector(
                '#navigation-button-down button, ' +
                '#navigation-button-down yt-icon-button'
            );
            if (btn) { btn.click(); return; }
            // Fallback: keyboard Down arrow
            document.dispatchEvent(new KeyboardEvent('keydown', {
                key: 'ArrowDown', keyCode: 40, which: 40, bubbles: true, cancelable: true
            }));
            return;
        }
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

    function scrollToPrev(v) {
        if (platform === 'youtube') {
            const btn = document.querySelector(
                '#navigation-button-up button, ' +
                '#navigation-button-up yt-icon-button'
            );
            if (btn) { btn.click(); return; }
            document.dispatchEvent(new KeyboardEvent('keydown', {
                key: 'ArrowUp', keyCode: 38, which: 38, bubbles: true, cancelable: true
            }));
            return;
        }
        let el = v.parentElement;
        while (el && el !== document.body) {
            const { overflow, overflowY } = window.getComputedStyle(el);
            if (/(auto|scroll)/.test(overflow + overflowY)) {
                el.scrollBy({ top: -el.clientHeight, behavior: "smooth" });
                return;
            }
            el = el.parentElement;
        }
        document.dispatchEvent(new WheelEvent("wheel", {
            deltaY: -window.innerHeight,
            bubbles: true,
            cancelable: true,
            view: window
        }));
    }

    let triggeredSrc = null;
    let triggerTime = 0;

    chrome.runtime.onMessage.addListener((msg) => {
        if (msg.type === "VOICE_ACTION") runVoiceAction(msg.action);
        if (msg.type === "VOICE_BADGE") {
            msg.text ? showVoiceBadge(msg.text, msg.ms || 0) : hideVoiceBadge();
        }
    });

    // ── Voice ───────────────────────────────────────────────────────────────

    const VOICE_CMDS = {
        next:     ['επόμενο', 'επόμενη', 'next'],
        previous: ['προηγούμενο', 'πίσω', 'previous', 'back'],
        stop:     ['σταμάτα', 'stop', 'παύση', 'pause'],
        start:    ['ξεκίνα', 'start', 'play', 'παίξε', 'συνέχισε'],
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
    let voiceAbortCount = 0;
    let voiceLastError = null;
    let voiceLastActioned = null;
    let voiceLang = 'el-GR';
    let voiceActionAt = 0; // timestamp of last fired action — global cooldown

    // Reset abort loop when user switches back to this tab
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible' && voiceRec) {
            voiceAbortCount = 0;
        }
    });

    async function startVoice(triggerWord, lang) {
        stopVoice();
        voiceAbortCount = 0;
        voiceLastError = null;
        voiceLang = lang || 'el-GR';

        const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SR) { showVoiceBadge('❌ SpeechRecognition δεν υποστηρίζεται', 5000); return; }

        showVoiceBadge('🔄 Ενεργοποίηση...', 0);

        voiceRec = new SR();
        voiceRec.lang = voiceLang;
        voiceRec.continuous = true;
        voiceRec.interimResults = true;
        voiceRec.maxAlternatives = 3;

        voiceRec.onstart = () => {
            voiceAbortCount = 0;
            document.getElementById('__arVoiceBanner')?.remove();
            showVoiceBadge('🟢 Voice ενεργό', 3000);
        };

        voiceRec.onresult = (e) => {
            voiceAbortCount = 0;
            const result = e.results[e.results.length - 1];
            const isFinal = result.isFinal;

            // Check all alternatives for best match
            let action = null;
            let transcript = result[0].transcript.toLowerCase().trim();
            for (let i = 0; i < result.length; i++) {
                const t = result[i].transcript.toLowerCase().trim();
                action = matchVoiceCmd(t);
                if (action) { transcript = t; break; }
            }

            showVoiceBadge('👂 ' + transcript + (action ? '  ✓' : ''), isFinal ? 1500 : 0);

            const now = Date.now();
            if (action && action !== voiceLastActioned && now - voiceActionAt > 1000) {
                voiceLastActioned = action;
                voiceActionAt = now;
                runVoiceAction(action);
                setTimeout(() => { voiceLastActioned = null; }, 1500);
            }
        };

        voiceRec.onerror = (e) => {
            voiceLastError = e.error;
            if (e.error === 'aborted') {
                voiceAbortCount++;
            } else if (e.error !== 'no-speech') {
                showVoiceBadge('⚠ ' + e.error, 3000);
            }
        };

        voiceRec.onend = () => {
            if (!voiceRec) return;
            if (voiceLastError === 'not-allowed' || voiceLastError === 'network') {
                showVoiceBadge('❌ ' + voiceLastError + ' — δεν μπορεί να συνεχίσει', 0);
                voiceRec = null;
                return;
            }
            const delay = voiceLastError === 'aborted'
                ? Math.min(200 * voiceAbortCount, 2000)
                : 150;
            voiceLastError = null;
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
                setTimeout(() => b.remove(), 5000);
            }
        });
    }

    async function initVoiceForSite(triggerWord, lang) {
        try {
            const perm = await navigator.permissions.query({ name: 'microphone' });
            if (perm.state === 'granted') {
                startVoice(triggerWord, lang);
                return;
            }
            if (perm.state === 'denied') {
                showVoiceBadge('❌ Μικρόφωνο απορρίφθηκε — κλικ στο 🔒 για να αλλάξεις', 0);
                return;
            }
        } catch (_) {}
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
                const v = getActiveVideo() || getVisibleVideo();
                if (v) { v.pause(); triggerTime = Date.now(); scrollToNext(v); }
                showVoiceBadge('▶▶ Επόμενο', 1500);
                break;
            }
            case 'previous': {
                const v = getActiveVideo() || getVisibleVideo();
                if (v) { v.pause(); triggerTime = Date.now() + 10000; scrollToPrev(v); }
                // Poll until new video is ready, then restart from beginning
                let polls = 0;
                const prevPoll = setInterval(() => {
                    const nv = getVisibleVideo();
                    if ((nv && nv.readyState >= 2) || ++polls >= 15) {
                        clearInterval(prevPoll);
                        if (nv) { nv.currentTime = 0; nv.play().catch(() => {}); }
                        triggerTime = Date.now();
                    }
                }, 150);
                showVoiceBadge('◀◀ Προηγούμενο', 1500);
                break;
            }
            case 'stop': {
                document.querySelectorAll('video').forEach(v => v.pause());
                triggerTime = Date.now() + 3600000; // block auto-next until explicit 'start'
                chrome.storage.local.set({ [enabledKey]: false });
                showVoiceBadge('⏸ Pause', 1500);
                break;
            }
            case 'start': {
                const vPlay = getVisibleVideo();
                if (vPlay) vPlay.play();
                triggerTime = Date.now(); // reset: allow auto-next after cooldown
                chrome.storage.local.set({ [enabledKey]: true });
                showVoiceBadge('▶ Play', 1500);
                break;
            }
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
