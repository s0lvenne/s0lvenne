/* ============================================================================
   Solven Vandermirant — логика сайта
   Страница собирается из assets/content.js. Здесь: навигация, counters, модалки,
   копирование, появление при скролле, акценты и запуск чёрной дыры.
   ========================================================================== */

(function () {
    'use strict';

    const $  = (s, r = document) => r.querySelector(s);
    const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
    const reduceMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const store = {
        get(k, d = null) { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch { return d; } },
        set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* приватный режим — не страшно */ } }
    };

    const BIRTH = new Date(SITE.profile.birthDate);

    // достаёт значение по пути вида 'stats.hours'
    const T = (path, dflt) => {
        const v = path.split('.').reduce((o, k) => (o == null ? o : o[k]), SITE.texts);
        return (v === undefined || v === null || v === '') ? (dflt === undefined ? '' : dflt) : v;
    };

    // расставляет все подписи интерфейса из assets/content.js
    function applyTexts() {
        $$('[data-txt]').forEach((el) => { el.textContent = T(el.dataset.txt); });
        $$('[data-txt-aria]').forEach((el) => { el.setAttribute('aria-label', T(el.dataset.txtAria)); });
        $$('[data-txt-alt]').forEach((el) => { el.setAttribute('alt', T(el.dataset.txtAlt)); });
        const b = $('#burger');
        if (b) b.setAttribute('aria-label', T('menuOpen', 'Меню'));
    }
    const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

    /* ═══════════════  НАВИГАЦИЯ  ═══════════════ */

    function buildNav() {
        const ul = $('#navLinks ul');
        const sections = $$('main .section[data-nav]').filter((s) => !s.hidden);
        ul.innerHTML = sections.map((s) => {
            const label = s.dataset.nav;
            return `<li><a href="#${s.id}">${esc(label)}</a></li>`;
        }).join('');
    }

    /* ═══════════════  ГЛАВНЫЙ ЭКРАН  ═══════════════ */

    function buildHero() {
        const h = SITE.hero;
        const title = $('#heroTitle');
        title.textContent = h.title;
        title.dataset.text = h.title;
        $('#heroSubtitle').textContent = h.subtitle;
        $('#heroStatus').textContent = SITE.profile.status || 'Онлайн';
        document.title = `${h.title} ${h.subtitle}`.trim();

        $('#heroActions').innerHTML = (h.buttons || []).map((b) => {
            const external = /^https?:/.test(b.href) ? ' target="_blank" rel="noopener noreferrer"' : '';
            return `<a class="btn${b.primary ? ' btn--primary' : ''}" href="${esc(b.href)}"${external}>${esc(b.text)}</a>`;
        }).join('');

        // печатающиеся строки
        new TypeWriter($('#typewriter'), { speed: 70, delay: 350 }).start(SITE.profile.tagline || '');
        new TypeWriter($('#typingCode'), { speed: 26, delay: 900 }).start(h.terminal || '');
    }

    /* ═══════════════  СЕКЦИИ  ═══════════════ */

    function buildAbout() {
        const a = SITE.about;
        const sec = $('#about');
        if (!a.enabled) { sec.hidden = true; return; }
        $('#aboutTitle').textContent = a.title;
        $('#aboutText').innerHTML = (a.paragraphs || []).map((p) => `<p>${esc(p)}</p>`).join('');
    }

    function buildProfile() {
        const p = SITE.profile;
        $('#profileName').textContent = `${p.name} ${p.surname}`;
        $('#profileOrigin').textContent = (p.rows.find((r) => r.label === 'Происхождение') || {}).value || '';

        $('#profileRows').innerHTML = (p.rows || []).map((r) => `
            <div class="detail-item">
                <span class="detail-label">${esc(r.label)}</span>
                <span class="detail-value">${esc(r.value)}</span>
            </div>`).join('');

        $('#profileChips').innerHTML = (p.chips || []).map((c) => `<span class="chip">${esc(c)}</span>`).join('');

        // аватар: если файла нет — рисуем свою заглушку.
        // Ошибка могла произойти до подключения обработчика — проверяем и так.
        const img = $('#avatar');
        const useFallback = () => { img.src = avatarFallback(); };
        img.addEventListener('error', useFallback, { once: true });
        if (!p.avatar) useFallback();
        else if (img.complete && img.naturalWidth === 0) useFallback();

        $('#infoBtn').addEventListener('click', () => openModal(p.nameStory.title, p.nameStory.html));
    }

    function avatarFallback() {
        const accent = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#ff0040';
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">
            <defs><radialGradient id="g" cx="50%" cy="35%">
                <stop offset="0" stop-color="#1b1b20"/><stop offset="1" stop-color="#070709"/>
            </radialGradient></defs>
            <rect width="200" height="200" fill="url(#g)"/>
            <circle cx="100" cy="100" r="74" fill="none" stroke="${accent}" stroke-opacity=".35" stroke-width="1"/>
            <circle cx="100" cy="100" r="52" fill="none" stroke="${accent}" stroke-opacity=".18" stroke-width="1"/>
            <ellipse cx="100" cy="100" rx="96" ry="9" fill="none" stroke="${accent}" stroke-opacity=".22" stroke-width="2"/>
            <!-- dominant-baseline: буква стоит ровно по центру при любом шрифте -->
            <text x="100" y="100" text-anchor="middle" dominant-baseline="central"
                  font-family="Arial, Helvetica, sans-serif" font-size="94" font-weight="bold"
                  fill="${accent}">S</text>
        </svg>`;
        return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
    }

    // уровень навыка: число 0–100, либо null (не указан).
    // '50', '50%', 50~ (если в файле опечатка, но синтаксис жив) — не роняют страницу
    function skillLevel(v) {
        if (typeof v === 'number' && isFinite(v)) return Math.max(0, Math.min(100, v));
        if (typeof v === 'string') {
            const n = parseFloat(String(v).replace(',', '.').replace(/[^\d.,-]/g, ''));
            if (isFinite(n)) return Math.max(0, Math.min(100, n));
        }
        return null;
    }

    function buildSkills() {
        const s = SITE.skills;
        const sec = $('#skills');
        if (!s.enabled) { sec.hidden = true; return; }
        sec.hidden = false;
        $('#skillsTitle').textContent = s.title;
        $('#skillsGrid').innerHTML = (s.groups || []).map((g) => `
            <div class="skill-group reveal">
                <h3>${esc(g.name)}</h3>
                ${g.items.map((it) => {
                    const lv = skillLevel(it.level);
                    if (lv === null && it.level != null && it.level !== '') {
                        console.warn(`[content.js] Навык «${it.name}»: уровень должен быть числом 0–100 (или null), сейчас:`,
                                     JSON.stringify(it.level));
                    }
                    return `
                    <div class="skill">
                        <div class="skill-top"><b>${esc(it.name)}</b><span>${lv === null ? '—' : Math.round(lv) + '%'}</span></div>
                        <div class="bar"><i data-level="${lv === null ? 0 : lv}"></i></div>
                    </div>`;
                }).join('')}
            </div>`).join('');
    }

    function buildProjects() {
        const p = SITE.projects;
        const sec = $('#projects');
        if (!p.enabled) { sec.hidden = true; return; }
        sec.hidden = false;
        $('#projectsTitle').textContent = p.title;
        $('#statProjects').textContent = String((p.items || []).length);

        const box = $('#appsContainer');
        if (!p.items || !p.items.length) {
            box.innerHTML = `<p class="muted" style="grid-column:1/-1">${esc(T('noProjects'))}</p>`;
            return;
        }

        box.innerHTML = p.items.map((app) => {
            const icon = app.icon
                ? `<img src="${esc(app.icon)}" alt="" class="app-icon" style="object-fit:contain">`
                : `<div class="app-icon">${esc((app.name || '?').trim().charAt(0).toUpperCase())}</div>`;
            const links = [].concat(app.links || []);
            const multiple = links.length > 1;
            const btns = links.map((l) => `
                <a class="app-btn" href="${esc(l.url)}" target="_blank" rel="noopener noreferrer">${esc(l.btn || 'Открыть')}</a>`).join('');
            return `
            <article class="app-card reveal">
                ${icon}
                <h3>${esc(app.name)}</h3>
                <p>${esc(app.desc || '')}</p>
                ${app.status ? `<span class="app-status" data-status="${esc(app.status)}">${esc(app.status)}</span>` : ''}
                ${btns ? `<div class="app-btns${multiple ? ' multiple' : ''}">${btns}</div>` : ''}
            </article>`;
        }).join('');
    }

    function buildTimeline() {
        const t = SITE.timeline;
        const sec = $('#timeline');
        if (!t.enabled) { sec.hidden = true; return; }
        sec.hidden = false;
        $('#timelineTitle').textContent = t.title;
        $('#timelineList').innerHTML = (t.items || []).map((i) => `
            <li class="reveal">
                <div class="tl-year">${esc(i.year)}</div>
                <div class="tl-title">${esc(i.title)}</div>
                <div class="tl-text">${esc(i.text)}</div>
            </li>`).join('');
    }

    function buildContacts() {
        const c = SITE.contacts;
        const sec = $('#contacts');
        if (!c.enabled) { sec.hidden = true; return; }
        sec.hidden = false;
        $('#contactsTitle').textContent = c.title;

        $('#contactsGrid').innerHTML = (c.items || []).map((it) => {
            const external = /^https?:/.test(it.href);
            const attrs = external ? ' target="_blank" rel="noopener noreferrer"' : '';
            return `
            <a class="link-card reveal" href="${esc(it.href)}"${attrs}${it.copy ? ' data-copy="' + esc(it.handle) + '"' : ''}>
                <span class="link-icon">${esc(it.icon || it.name.slice(0, 2))}</span>
                <span class="link-content">
                    <h3>${esc(it.name)}</h3>
                    <p>${esc(it.handle)}</p>
                </span>
            </a>`;
        }).join('');

        // копирование по клику (почта)
        $$('#contactsGrid [data-copy]').forEach((el) => {
            el.addEventListener('click', async (e) => {
                e.preventDefault();
                const ok = await copyText(el.dataset.copy);
                toast(ok ? T('copyOk') + el.dataset.copy : T('copyFail'));
            });
        });
    }

    function buildFaq() {
        const f = SITE.faq;
        const sec = $('#faq');
        if (!f.enabled) { sec.hidden = true; return; }
        sec.hidden = false;
        $('#faqTitle').textContent = f.title;
        $('#faqList').innerHTML = (f.items || []).map((i) => `
            <details class="reveal">
                <summary>${esc(i.q)}</summary>
                <div class="answer">${esc(i.a)}</div>
            </details>`).join('');
    }

    function buildFooter() {
        const year = new Date().getFullYear();
        $('#footerText').textContent = (SITE.footer.text || '').replace('{year}', year);
        $('#footerNote').textContent = SITE.footer.note || '';
    }

    /* ═══════════════  СЧЁТЧИКИ  ═══════════════ */

    function hoursLived() {
        return Math.floor((Date.now() - BIRTH.getTime()) / 36e5);
    }

    function age() {
        const now = new Date();
        let a = now.getFullYear() - BIRTH.getFullYear();
        const m = now.getMonth() - BIRTH.getMonth();
        if (m < 0 || (m === 0 && now.getDate() < BIRTH.getDate())) a--;
        return a;
    }

    function updateHours() {
        const txt = hoursLived().toLocaleString('ru-RU');
        $('#statHours').textContent = txt;
        $('#statHours2').textContent = txt;
        $('#statAge').textContent = String(age());
        $('#profileAge').textContent = String(age());
    }

    function updateCountdown() {
        const now = new Date();
        let next = new Date(now.getFullYear(), BIRTH.getMonth(), BIRTH.getDate());
        if (next <= now) next = new Date(now.getFullYear() + 1, BIRTH.getMonth(), BIRTH.getDate());
        const diff = next - now;
        const d = Math.floor(diff / 864e5);
        const h = Math.floor((diff % 864e5) / 36e5);
        const m = Math.floor((diff % 36e5) / 6e4);
        const s = Math.floor((diff % 6e4) / 1000);
        $('#countdown').textContent = `${d}д ${h}ч ${m}м ${s}с`;
    }

    function updateVisitors() {
        const cfg = SITE.visitors || {};
        let value = null;

        if (cfg.local !== false) {
            const counted = sessionStorage.getItem('sv_counted');
            let n = store.get('sv_visits', 0);
            if (!counted) { n = Number(n) + 1; store.set('sv_visits', n); sessionStorage.setItem('sv_counted', '1'); }
            value = n;
        }

        const show = (v) => {
            $('#statVisitors').textContent = v;
            $('#statVisitors2').textContent = v;
        };
        if (value !== null) show(String(value));

        if (cfg.api) {
            fetch(cfg.api, { cache: 'no-store' })
                .then((r) => r.json())
                .then((d) => show(String(d.value ?? '—')))
                .catch(() => { if (value === null) show('—'); });
        }
    }

    /* ═══════════════  МЕЛОЧИ ИНТЕРФЕЙСА  ═══════════════ */

    let toastTimer = null;
    function toast(msg) {
        const el = $('#toast');
        el.textContent = msg;
        el.classList.add('show');
        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => el.classList.remove('show'), 2400);
    }

    async function copyText(text) {
        try {
            if (navigator.clipboard && window.isSecureContext) {
                await navigator.clipboard.writeText(text);
                return true;
            }
        } catch { /* fallthrough */ }
        try {
            const ta = document.createElement('textarea');
            ta.value = text;
            ta.style.cssText = 'position:fixed;opacity:0;pointer-events:none';
            document.body.appendChild(ta);
            ta.select();
            const ok = document.execCommand('copy');
            ta.remove();
            return ok;
        } catch { return false; }
    }

    /* ── модалка ── */
    let lastFocused = null;
    function openModal(title, html) {
        lastFocused = document.activeElement;
        $('#modalTitle').textContent = title;
        $('#modalBody').innerHTML = html;
        const m = $('#modal');
        m.hidden = false;
        document.body.style.overflow = 'hidden';
        $('#modalClose').focus();
    }
    function closeModal() {
        $('#modal').hidden = true;
        document.body.style.overflow = '';
        if (lastFocused) lastFocused.focus();
    }

    /* ── акценты ── */
    function buildAccents(bh) {
        const box = $('#accents');
        const saved = store.get('sv_accent', 'red');
        box.innerHTML = SITE.accents.map((a) => `
            <button type="button" data-id="${a.id}" style="--dot:${a.css}" title="${esc(a.label)}"
                    aria-label="Акцент: ${esc(a.label)}" aria-pressed="${a.id === saved}"></button>`).join('');

        const apply = (id) => {
            const a = SITE.accents.find((x) => x.id === id) || SITE.accents[0];
            document.documentElement.dataset.accent = a.id;
            $$('#accents button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.id === a.id)));
            const meta = document.querySelector('meta[name="theme-color"]');
            if (meta) meta.content = a.css;
            if (bh) bh.setAccent(a.hot, a.warm, a.cool);
            store.set('sv_accent', a.id);
            const img = $('#avatar');
            if (img && img.src.startsWith('data:')) img.src = avatarFallback();
        };

        box.addEventListener('click', (e) => {
            const b = e.target.closest('button');
            if (b) apply(b.dataset.id);
        });
        apply(saved);
    }

    /* ── шапка и скролл ── */
    function initScrollUI() {
        const nav = $('#nav');
        const progress = $('#progress i');
        const toTop = $('#toTop');
        let lastY = window.scrollY;
        let ticking = false;

        const onScroll = () => {
            const y = window.scrollY;
            const h = document.documentElement.scrollHeight - window.innerHeight;
            if (progress) progress.style.width = (h > 0 ? (y / h) * 100 : 0) + '%';

            nav.classList.toggle('is-stuck', y > 20);
            // прячем шапку при скролле вниз — только если включено в content.js
            if (SITE.ui.hideNavOnScroll && !$('#navLinks').classList.contains('open')) {
                nav.classList.toggle('is-hidden', y > 320 && y > lastY + 6);
            }
            if (SITE.ui.showBackToTop) toTop.classList.toggle('show', y > 600);
            lastY = y;
            ticking = false;
        };

        window.addEventListener('scroll', () => {
            if (!ticking) { ticking = true; requestAnimationFrame(onScroll); }
        }, { passive: true });
        onScroll();

        if (SITE.ui.showBackToTop) {
            toTop.hidden = false;
            toTop.addEventListener('click', () => window.scrollTo({ top: 0, behavior: reduceMotion() ? 'auto' : 'smooth' }));
        }
    }

    /* ── бургер ── */
    function initBurger() {
        const burger = $('#burger');
        const links = $('#navLinks');
        const setOpen = (open) => {
            links.classList.toggle('open', open);
            burger.setAttribute('aria-expanded', String(open));
            burger.setAttribute('aria-label', open ? T('menuClose') : T('menuOpen'));
            if (open) $('#nav').classList.remove('is-hidden');
        };
        burger.addEventListener('click', () => setOpen(!links.classList.contains('open')));
        links.addEventListener('click', (e) => { if (e.target.closest('a')) setOpen(false); });
        document.addEventListener('click', (e) => {
            if (!links.contains(e.target) && !burger.contains(e.target)) setOpen(false);
        });
        document.addEventListener('keydown', (e) => { if (e.key === 'Escape') setOpen(false); });
    }

    /* ── активный пункт меню ── */
    function initActiveLink() {
        const links = $$('#navLinks a');
        const map = new Map(links.map((a) => [a.getAttribute('href').slice(1), a]));
        const targets = Array.from(map.keys()).map((id) => document.getElementById(id)).filter(Boolean);
        if (!targets.length) return;

        const io = new IntersectionObserver((entries) => {
            entries.forEach((en) => {
                if (!en.isIntersecting) return;
                links.forEach((a) => a.classList.remove('active'));
                const a = map.get(en.target.id);
                if (a) a.classList.add('active');
            });
        }, { rootMargin: '-45% 0px -50% 0px' });
        targets.forEach((t) => io.observe(t));
    }

    /* ── появление при скролле ── */
    function initReveal() {
        const items = $$('.reveal');
        if (!items.length) return;

        const fillBars = (root) => {
            $$('.bar i', root).forEach((b, i) => {
                setTimeout(() => { b.style.width = b.dataset.level + '%'; }, 120 + i * 90);
            });
        };

        if (reduceMotion()) {
            items.forEach((el) => { el.classList.add('in'); fillBars(el); });
            return;
        }

        // Проверяем по позиции, а не только через IntersectionObserver:
        // при быстром скролле или переходе по якорю блок может «проскочить»
        // окно между кадрами и тогда наблюдатель вообще не сработает.
        const pending = new Set(items);
        let ticking = false;

        const sweep = () => {
            ticking = false;
            if (!pending.size) return;
            const limit = window.innerHeight * 0.92;
            pending.forEach((el) => {
                if (el.getBoundingClientRect().top < limit) {
                    el.classList.add('in');
                    fillBars(el);
                    pending.delete(el);
                }
            });
        };
        const onScroll = () => { if (!ticking) { ticking = true; requestAnimationFrame(sweep); } };

        window.addEventListener('scroll', onScroll, { passive: true });
        window.addEventListener('resize', onScroll, { passive: true });
        sweep();
    }

    /* ── время на сайте ── */
    function initSessionTimer() {
        if (!SITE.ui.showSessionTimer) return;
        const box = $('#sessionTimer');
        const out = $('#sessionClock', box);
        box.hidden = false;
        const t0 = Date.now();
        setInterval(() => {
            const s = Math.floor((Date.now() - t0) / 1000);
            const mm = String(Math.floor(s / 60)).padStart(2, '0');
            out.textContent = `${mm}:${String(s % 60).padStart(2, '0')}`;
        }, 1000);
    }

    /* ── пасхалка: дёрганый скролл ── */
    function initEasterEgg() {
        if (!SITE.ui.easterEgg || reduceMotion()) return;
        let start = null, lastY = window.scrollY, dir = 0, changes = 0, lastT = Date.now();
        window.addEventListener('scroll', () => {
            const now = Date.now();
            const y = window.scrollY;
            const diff = y - lastY;
            if (now - lastT > 1500) { start = null; changes = 0; }
            if (Math.abs(diff) > 10) {
                const d = diff > 0 ? 1 : -1;
                if (d !== dir) { dir = d; changes++; if (!start) start = now; }
            }
            if (start && now - start >= 45000 && changes > 30) {
                const el = $('#trip');
                el.classList.add('show');
                setTimeout(() => el.classList.remove('show'), 2200);
                start = null; changes = 0;
            }
            lastT = now; lastY = y;
        }, { passive: true });
    }

    /* ── модалка: закрытие ── */
    function initModal() {
        $('#modalClose').addEventListener('click', closeModal);
        $('.modal-backdrop').addEventListener('click', closeModal);
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && !$('#modal').hidden) closeModal();
            // ловушка фокуса
            if (e.key === 'Tab' && !$('#modal').hidden) {
                const f = $$('#modal button, #modal a');
                if (f.length) { e.preventDefault(); f[0].focus(); }
            }
        });
    }

    /* ── заголовок всегда влезает в экран ── */
    function fitTitle() {
        const h = $('#heroTitle');
        if (!h || !h.parentElement) return;
        h.style.fontSize = '';
        let size = parseFloat(getComputedStyle(h).fontSize);
        const limit = h.parentElement.clientWidth;
        let guard = 0;
        while (h.scrollWidth > limit + 1 && size > 16 && guard++ < 60) {
            size *= 0.94;
            h.style.fontSize = size + 'px';
        }
    }

    /* ═══════════════  СБОРКА  ═══════════════ */

    function init() {
        applyTexts();
        buildHero();
        buildAbout();
        buildProfile();
        buildSkills();
        buildProjects();
        buildTimeline();
        buildContacts();
        buildFaq();
        buildFooter();
        buildNav();

        // чёрная дыра
        let bh = null;
        const canvas = $('#bgCanvas');
        if (canvas && window.BlackHole) {
            bh = window.BlackHole.init(canvas, SITE.blackhole);
            const setLayout = () => bh && bh.setLayout(window.innerWidth <= 768);
            setLayout();
            window.addEventListener('resize', setLayout, { passive: true });
            // не тратим ресурсы, когда вкладка скрыта
            document.addEventListener('visibilitychange', () => bh && bh.setPaused(document.hidden));
        }

        buildAccents(bh);
        initScrollUI();
        initBurger();
        initActiveLink();
        initReveal();
        initSessionTimer();
        initEasterEgg();
        initModal();

        updateHours();
        setInterval(updateHours, 60000);
        updateCountdown();
        setInterval(updateCountdown, 1000);
        fitTitle();
        let fitTimer = null;
        window.addEventListener('resize', () => {
            clearTimeout(fitTimer);
            fitTimer = setTimeout(fitTitle, 120);
        }, { passive: true });
        if (document.fonts && document.fonts.ready) document.fonts.ready.then(fitTitle);

        updateVisitors();

        console.log('%cSolven • Пустота', `color:${getComputedStyle(document.documentElement).getPropertyValue('--accent')};font-family:'JetBrains Mono',monospace;font-size:14px;font-weight:700`);
    }

    function boot() {
        if (typeof SITE === 'undefined') {
            fail('Файл <b>assets/content.js</b> не читается — в нём синтаксическая ошибка.');
            return;
        }
        try {
            init();
        } catch (e) {
            console.error(e);
            fail('Страница не собралась. Скорее всего, опечатка в <b>assets/content.js</b>.', String(e && e.message || e));
        }
    }

    // показываем понятную плашку вместо пустого экрана
    function fail(title, detail) {
        const box = document.createElement('div');
        box.className = 'content-error';
        box.innerHTML = '<div class="ce-card"><h2>Сайт не запустился</h2><p class="ce-title"></p>' +
            '<pre class="ce-detail"></pre>' +
            '<p class="ce-tip">Открой <b>assets/content.js</b> — там опечатка. Часто это лишний символ ' +
            '(<code>50~</code>, <code>??</code>), пропущенная запятая или незакрытая кавычка. ' +
            'Точная строка ошибки — в консоли (F12 → Console).</p></div>';
        box.querySelector('.ce-title').innerHTML = title;
        box.querySelector('.ce-detail').textContent = detail || '';
        (document.body || document.documentElement).appendChild(box);
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
    else boot();
})();
