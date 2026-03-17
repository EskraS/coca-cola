(() => {

    // ─── Config ───────────────────────────────────────────────────────────────
    history.scrollRestoration = 'manual';

    const CFG = {
        frameCount: 351,
        frameDir: 'sequence',
        framePrefix: 'frame',
        frameExt: 'jpg',
        padLength: 4,
        introFrames: 180,
        introDuration: 4500,
        frameSmooth: 0.085,
        seqScrollVh: 2,
    };

    const SCROLL1_END = CFG.frameCount - 1;

    // ─── DOM refs ─────────────────────────────────────────────────────────────
    const canvas = document.getElementById('sequence-canvas');
    const ctx = canvas?.getContext('2d') ?? null;
    const loader = document.getElementById('loader');
    const loaderFill = document.getElementById('loader-fill');
    const introText = document.getElementById('intro-text');

    const frameTextRight = document.getElementById('frame-text-right');
    const frameLine = frameTextRight?.querySelector('.frame-line');
    const frameTitle = frameTextRight?.querySelector('.frame-title');
    const frameBody = frameTextRight?.querySelector('.frame-body');
    const frameCta = frameTextRight?.querySelector('.frame-cta');

    const calloutLeft = document.getElementById('frame-callout-left');
    const calloutRight = document.getElementById('frame-callout-right');
    const navDots = document.querySelectorAll('.section-nav-dot');
    const page2 = document.getElementById('page-2');
    const page3 = document.getElementById('page-3');
    const page4 = document.getElementById('page-4');
    const topNavInner = document.querySelector('.top-nav-inner');

    const page2Title = document.querySelector('#page-2 .page2-title');
    const page2Articles = document.querySelector('#page-2 .page2-articles');
    const page2Buy = document.querySelector('#page-2 .page2-buy');
    const page3Title = document.querySelector('#page-3 .page3-title');
    const page3Articles = document.querySelector('#page-3 .page3-articles');
    const page3Buy = document.querySelector('#page-3 .page3-buy');

    // ─── State ────────────────────────────────────────────────────────────────
    const frames = new Array(CFG.frameCount);
    let loadedCount = 0;
    let currentFrame = 0;
    let frameIndex = 0;
    let introStartTime = null;
    let snapForceOff = false;

    // ─── Utilities ────────────────────────────────────────────────────────────

    const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
    const lerp = (a, b, t) => a + (b - a) * t;
    const pad = (n) => String(n).padStart(CFG.padLength, '0');
    const frameSrc = (i) => `${CFG.frameDir}/${CFG.framePrefix}${pad(i)}.${CFG.frameExt}`;

    /** Normalize value from [inLo, inHi] to [0, 1], clamped. */
    const norm = (v, lo, hi) => clamp((v - lo) / (hi - lo), 0, 1);

    // ─── Section nav ──────────────────────────────────────────────────────────

    function setActiveNav(section) {
        navDots.forEach(dot =>
            dot.classList.toggle('is-active', Number(dot.dataset.section) === section)
        );
    }

    // ─── Top nav interactions ────────────────────────────────────────────────
    topNavInner?.addEventListener('click', (e) => {
        const btn = e.target?.closest?.('[data-nav]');
        if (!btn) return;
        const target = btn.getAttribute('data-nav');
        if (target === 'home') {
            snapForceOff = true;
            const root = document.documentElement;
            root.classList.remove('snap-enabled');
            root.style.scrollSnapType = 'none';
            requestAnimationFrame(() => {
                window.scrollTo(0, 0);
                requestAnimationFrame(() => { root.style.scrollSnapType = ''; });
            });
            return;
        }
        if (target === 'family' || target === 'contact') {
            if (!page4) return;
            window.scrollTo({ top: page4.offsetTop, behavior: 'smooth' });
        }
    });

    // ─── Scroll-to buttons ────────────────────────────────────────────────────
    document.addEventListener('click', (e) => {
        const btn = e.target?.closest?.('[data-scroll-to]');
        if (!btn) return;
        const id = btn.getAttribute('data-scroll-to');
        const el = id ? document.getElementById(id) : null;
        if (!el) return;

        snapForceOff = true;
        const root = document.documentElement;
        root.classList.remove('snap-enabled');
        root.style.scrollSnapType = 'none';
        requestAnimationFrame(() => {
            window.scrollTo({ top: el.offsetTop, behavior: 'smooth' });
            requestAnimationFrame(() => { root.style.scrollSnapType = ''; });
        });
    });

    // ─── Canvas ───────────────────────────────────────────────────────────────

    function drawImage(img) {
        if (!img?.complete || !img.naturalWidth) return;
        const { width: cw, height: ch } = canvas;
        const scale = Math.max(cw / img.naturalWidth, ch / img.naturalHeight);
        const dw = Math.round(img.naturalWidth * scale);
        const dh = Math.round(img.naturalHeight * scale);
        const dx = Math.round((cw - dw) / 2);
        const dy = Math.round((ch - dh) / 2);
        ctx.drawImage(img, dx, dy, dw, dh);
    }

    function drawFrame(index) {
        if (!ctx) return;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.imageSmoothingEnabled = false;
        drawImage(frames[index]);
    }

    function drawFrameBlended(indexFloat) {
        if (!ctx) return;
        const i0 = Math.floor(indexFloat);
        const i1 = Math.min(i0 + 1, SCROLL1_END);
        const alpha = indexFloat - i0;

        ctx.imageSmoothingEnabled = true;

        if (alpha <= 0 || i1 === i0) {
            ctx.globalAlpha = 1;
            drawImage(frames[i0]);
        } else {
            ctx.globalAlpha = 1 - alpha; drawImage(frames[i0]);
            ctx.globalAlpha = alpha; drawImage(frames[i1]);
            ctx.globalAlpha = 1;
        }
    }

    function resizeCanvas() {
        if (!canvas || !ctx) return;
        const dpr = clamp(window.devicePixelRatio || 1, 1, 2);
        canvas.width = Math.round(window.innerWidth * dpr);
        canvas.height = Math.round(window.innerHeight * dpr);
        canvas.style.width = `${window.innerWidth}px`;
        canvas.style.height = `${window.innerHeight}px`;
        drawFrame(currentFrame);
    }

    // ─── Preloader ────────────────────────────────────────────────────────────

    function preloadFrames(onComplete) {
        const onSettle = () => {
            loadedCount++;
            if (loaderFill) loaderFill.style.width = `${(loadedCount / CFG.frameCount) * 100}%`;
            if (loadedCount === CFG.frameCount) onComplete();
        };
        for (let i = 0; i < CFG.frameCount; i++) {
            const img = new Image();
            img.onload = img.onerror = onSettle;
            img.src = frameSrc(i + 1);
            frames[i] = img;
        }
    }

    // ─── Phase 1 — auto intro ─────────────────────────────────────────────────

    function startIntro() {
        document.documentElement.style.overflow = 'hidden';
        document.body.style.overflow = 'hidden';
        setActiveNav(1);
        setTimeout(() => introText?.classList.add('is-visible'), 400);
        requestAnimationFrame(introLoop);
    }

    function introLoop(ts) {
        introStartTime ??= ts;
        const progress = clamp((ts - introStartTime) / CFG.introDuration, 0, 1);
        const eased = 1 - Math.pow(1 - progress, 2);
        const target = Math.min(CFG.introFrames - 1, Math.floor(eased * CFG.introFrames));

        if (target !== currentFrame) {
            currentFrame = target;
            drawFrame(currentFrame);
        }

        if (progress < 1) {
            requestAnimationFrame(introLoop);
        } else {
            frameIndex = CFG.introFrames;
            startScrollPhase();
        }
    }

    // ─── Phase 2 — scroll driven ──────────────────────────────────────────────

    function startScrollPhase() {
        document.documentElement.style.overflow = '';
        document.body.style.overflow = '';
        window.scrollTo(0, 0);
        requestAnimationFrame(scrollLoop);
    }

    function scrollLoop() {
        const vh = window.innerHeight;
        const scroll = window.scrollY;
        const seqEnd = vh * CFG.seqScrollVh;

        // ── Frame sequence ────────────────────────────────────────────────────
        if (scroll < seqEnd) {
            const scrollP = clamp(scroll / vh, 0, 1);
            const targetFrame = CFG.introFrames + scrollP * (SCROLL1_END - CFG.introFrames);

            frameIndex = lerp(frameIndex, targetFrame, CFG.frameSmooth);
            currentFrame = Math.round(frameIndex);

            Math.abs(frameIndex - targetFrame) < 0.02
                ? (frameIndex = targetFrame, drawFrame(currentFrame))
                : drawFrameBlended(frameIndex);
        } else {
            drawFrame(SCROLL1_END);
            frameIndex = SCROLL1_END;
        }

        // ── Intro text ────────────────────────────────────────────────────────
        if (introText) {
            if (scroll > 0) {
                introText.classList.toggle('is-visible', scroll < vh * 0.15);
            }
        }

        // ── frame-text-right ──────────────────────────────────────────────────
        if (frameTextRight) {
            const f = frameIndex;
            const opacity =
                f < 226 ? 0 :
                    f < 256 ? norm(f, 226, 256) :
                        f <= 290 ? 1 :
                            clamp(1 - norm(f, 290, 320), 0, 1);

            frameTextRight.style.opacity = String(opacity);
            frameTextRight.classList.toggle('is-interactive', opacity > 0.05);

            const lineP = norm(f, 226, 256);
            if (frameLine) frameLine.style.transform = `scaleX(${lineP})`;

            const contentP = norm(f, 226, 256);
            const off = `${8 * (1 - contentP)}px`;
            for (const el of [frameTitle, frameBody, frameCta]) {
                if (!el) continue;
                el.style.opacity = String(contentP);
                el.style.transform = `translateY(${off})`;
            }
        }

        // ── Endcards ──────────────────────────────────────────────────────────
        const page2Rect = page2 ? page2.getBoundingClientRect() : null;
        const page2Top = page2Rect ? page2Rect.top : Infinity;
        const page3Rect = page3 ? page3.getBoundingClientRect() : null;

        const inView = (rect) => !!rect && rect.top < vh * 0.8 && rect.bottom > vh * 0.2;
        const toggleFade = (el, on) => el && el.classList.toggle('is-visible', !!on);

        const fadeOutP = clamp((page2Top - vh * 0.2) / (vh * 1.5 - vh * 0.2), 0, 1);
        const endcardP =
            frameIndex < 325 ? 0 :
                frameIndex < 350 ? norm(frameIndex, 325, 350) :
                    fadeOutP;

        applyEndcard(calloutLeft, endcardP);
        applyEndcard(calloutRight, endcardP);

        // ── Page-2 fade in ────────────────────────────────────────────────────
        page2Title?.classList.add('page-fade');
        page2Articles?.classList.add('page-fade');
        page2Buy?.classList.add('page-fade');

        toggleFade(page2Title, inView(page2Rect));
        toggleFade(page2Articles, inView(page2Rect));

        toggleFade(page2Buy, inView(page2Rect));

        // ── Page-3 fade in ────────────────────────────────────────────────────
        page3Title?.classList.add('page-fade');
        page3Articles?.classList.add('page-fade');
        page3Buy?.classList.add('page-fade');

        toggleFade(page3Title, inView(page3Rect));
        toggleFade(page3Articles, inView(page3Rect));

        toggleFade(page3Buy, inView(page3Rect));

        // ── Scroll snapping ───────────────────────────────────────────────────
        const page2OffsetTop = page2 ? page2.offsetTop : Infinity;
        if (snapForceOff) {
            document.documentElement.classList.remove('snap-enabled');
            if (scroll < page2OffsetTop - 40) snapForceOff = false;
        } else {
            document.documentElement.classList.toggle('snap-enabled', scroll >= page2OffsetTop - 1);
        }

        // ── Section nav ───────────────────────────────────────────────────────
        const page2Y = page2 ? page2.offsetTop : Infinity;
        const page3Y = page3 ? page3.offsetTop : Infinity;
        const page4Y = page4 ? page4.offsetTop : Infinity;

        const section =
            scroll >= page4Y - 1 ? 6 :
                scroll >= page3Y - 1 ? 5 :
                    scroll >= page2Y - 1 ? 4 :
                        frameIndex >= 310 ? 3 :
                            frameIndex >= 230 ? 2 : 1;

        setActiveNav(section);

        // ── Header theme ──────────────────────────────────────────────────────
        const header = document.getElementById('top-nav');
        if (header) {
            header.classList.toggle('nav-light', scroll >= page2OffsetTop - 1);
        }

        requestAnimationFrame(scrollLoop);
    }

    function applyEndcard(root, p) {
        if (!root) return;
        const off = `${8 * (1 - p)}px`;
        root.style.opacity = String(p);
        root.classList.toggle('is-interactive', p > 0.02);
        const line = root.querySelector('.frame-line');
        if (line) line.style.transform = `scaleX(${p})`;
        for (const el of root.querySelectorAll('.frame-title, .frame-body, .frame-cta')) {
            el.style.opacity = String(p);
            el.style.transform = `translateY(${off})`;
        }
    }

    // ─── Init ─────────────────────────────────────────────────────────────────

    window.addEventListener('resize', resizeCanvas, { passive: true });
    resizeCanvas();

    preloadFrames(() => {
        loader?.classList.add('hidden');
        setTimeout(() => loader && (loader.style.display = 'none'), 700);
        drawFrame(0);
        startIntro();
    });

    // Make the page-4 roulette seamless by duplicating the track content once.
    // The CSS animation scrolls by -50% (one copy width) for a perfect loop.
    document.addEventListener('DOMContentLoaded', () => {
        const track = document.querySelector('#page-4 .roulette-track');
        if (!track) return;
        if (track.dataset.duplicated === '1') return;
        track.dataset.duplicated = '1';
        const clones = Array.from(track.children).map((n) => n.cloneNode(true));
        for (const c of clones) track.appendChild(c);
    }, { passive: true });

    window.addEventListener('wheel', (e) => {
        if (e.deltaY >= 0) return;
        if (!page2) return;
        const y = window.scrollY;
        const page2Y = page2.offsetTop;
        if (Math.abs(y - page2Y) <= 3) snapForceOff = true;
    }, { passive: true });

})();