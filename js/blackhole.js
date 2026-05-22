(() => {
    const canvas = document.getElementById('bgCanvas');
    const ctx    = canvas.getContext('2d');

    function resize() {
        canvas.width  = window.innerWidth;
        canvas.height = window.innerHeight;
    }
    resize();
    window.addEventListener('resize', resize);

    // ─────────────────────────────────────────────────────────
    // ПАРАМЕТРЫ
    // ─────────────────────────────────────────────────────────
    function BH() {
        const r = Math.min(canvas.width, canvas.height) * 0.155;
        return {
            x: canvas.width  * 0.64,
            y: canvas.height * 0.50,
            r,
            diskW:  r * 6.0,    // полуширина диска
            diskH:  r * 0.14,   // полувысота диска (почти ребром)
        };
    }

    // ─────────────────────────────────────────────────────────
    // ЗВЁЗДЫ
    // ─────────────────────────────────────────────────────────
    const STAR_N = 420;
    let stars = [];

    function initStars() {
        const bh = BH();
        stars = [];
        for (let i = 0; i < STAR_N; i++) {
            let x, y, tries = 0;
            do {
                x = Math.random() * canvas.width;
                y = Math.random() * canvas.height;
                tries++;
            } while (Math.hypot(x - bh.x, y - bh.y) < bh.r * 1.3 && tries < 30);
            stars.push({
                x, y,
                r:     Math.random() * 1.4 + 0.2,
                a:     Math.random() * 0.75 + 0.25,
                spd:   Math.random() * 0.018 + 0.004,
                phase: Math.random() * Math.PI * 2,
                warm:  Math.random() < 0.07,  // тёплая звезда
                cool:  Math.random() < 0.05,  // холодная звезда
            });
        }
    }
    initStars();
    window.addEventListener('resize', initStars);

    function drawStars(bh, t) {
        for (const s of stars) {
            const d  = Math.hypot(s.x - bh.x, s.y - bh.y);
            const tw = Math.sin(t * s.spd + s.phase) * 0.3;
            const a  = Math.max(0, s.a + tw) * Math.min(1, (d - bh.r) / 60);
            if (a <= 0) continue;

            ctx.globalAlpha = a;
            ctx.fillStyle   = s.warm ? '#ffd8a0' : s.cool ? '#b0c8ff' : '#ffffff';
            ctx.beginPath();
            ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.globalAlpha = 1;
    }

    // ─────────────────────────────────────────────────────────
    // ОСНОВНАЯ ОТРИСОВКА ЧЁРНОЙ ДЫРЫ
    // ─────────────────────────────────────────────────────────

    // Рисует горизонтальную полосу диска
    // front=true → рисуем только «перед» тенью (нижняя половина эллипса)
    function drawDiskBand(bh, t, front) {
        const { x, y, r, diskW, diskH } = bh;

        // Доплеровское мерцание: левая сторона (движется к нам) ярче
        const doppler = 0.88 + 0.12 * Math.sin(t * 0.005);

        // Слои: основной + мягкое свечение вокруг
        const layers = [
            { hScale: 1.0, op: 1.0 },
            { hScale: 2.2, op: 0.40 },
            { hScale: 4.0, op: 0.15 },
            { hScale: 7.0, op: 0.06 },
        ];

        for (const lyr of layers) {
            const h   = diskH * lyr.hScale;
            const op  = lyr.op;

            // Горизонтальный градиент от краёв к центру
            const g = ctx.createLinearGradient(x - diskW, y, x + diskW, y);

            // Левая (доплеровски яркая) / правая (тусклее) стороны
            const leftBoost  = doppler;
            const rightBoost = 2 - doppler;

            g.addColorStop(0,    'rgba(0,0,0,0)');
            g.addColorStop(0.06, `rgba(30,22,14,${op * 0.5 * leftBoost})`);
            g.addColorStop(0.18, `rgba(110,82,45,${op * 0.75 * leftBoost})`);
            g.addColorStop(0.33, `rgba(210,168,100,${op * 0.95 * leftBoost})`);
            g.addColorStop(0.43, `rgba(248,235,200,${op * leftBoost})`);
            g.addColorStop(0.47, `rgba(255,252,245,${op * 0.55})`);  // ближняя кромка, очень яркая
            g.addColorStop(0.50, `rgba(8,6,4,${op * 0.15})`);        // центр (за тенью — пусто)
            g.addColorStop(0.53, `rgba(255,252,245,${op * 0.55})`);
            g.addColorStop(0.57, `rgba(248,235,200,${op * rightBoost})`);
            g.addColorStop(0.67, `rgba(210,168,100,${op * 0.95 * rightBoost})`);
            g.addColorStop(0.82, `rgba(110,82,45,${op * 0.75 * rightBoost})`);
            g.addColorStop(0.94, `rgba(30,22,14,${op * 0.5 * rightBoost})`);
            g.addColorStop(1,    'rgba(0,0,0,0)');

            ctx.save();

            if (front) {
                // Рисуем только нижнюю половину — «перед» тенью
                ctx.beginPath();
                ctx.rect(0, y, canvas.width, canvas.height);
                ctx.clip();
            } else {
                // Рисуем только верхнюю половину — «позади» тени
                ctx.beginPath();
                ctx.rect(0, 0, canvas.width, y);
                ctx.clip();
            }

            // Вырезаем тень из диска
            ctx.beginPath();
            ctx.rect(0, 0, canvas.width, canvas.height);
            ctx.arc(x, y, r * 0.98, 0, Math.PI * 2, true);
            ctx.clip('evenodd');

            ctx.fillStyle = g;
            ctx.beginPath();
            ctx.ellipse(x, y, diskW, h, 0, 0, Math.PI * 2);
            ctx.fill();

            ctx.restore();
        }
    }

    // Гравитационно-линзированные дуги (свет от диска, изогнутый вокруг дыры)
    function drawLensingArcs(bh, t) {
        const { x, y, r } = bh;
        const doppler = 0.88 + 0.12 * Math.sin(t * 0.005);

        // ── Верхняя дуга (линзированный нижний диск) ─────────
        // Рисуем несколько слоёв для мягкого свечения
        const topPasses = [
            { rOff: 0,       lw: r * 0.055, a: 0.90 },
            { rOff: r * 0.06, lw: r * 0.18, a: 0.35 },
            { rOff: r * 0.16, lw: r * 0.30, a: 0.14 },
            { rOff: r * 0.30, lw: r * 0.45, a: 0.055 },
        ];

        for (const p of topPasses) {
            const arcR = r * 1.04 + p.rOff;
            // Верхняя дуга — с 190° по 350° (180° + 10° запас)
            const aStart = Math.PI + 0.17;
            const aEnd   = Math.PI * 2 - 0.17;

            // Градиент вдоль дуги: ярче в середине (верхняя точка)
            const gTop = ctx.createLinearGradient(x - arcR, y, x + arcR, y);
            const brightness = doppler;
            gTop.addColorStop(0,    `rgba(180,190,220,0)`);
            gTop.addColorStop(0.18, `rgba(200,210,240,${p.a * 0.6 * brightness})`);
            gTop.addColorStop(0.50, `rgba(240,245,255,${p.a * brightness})`);   // верхняя точка — ярчайшая
            gTop.addColorStop(0.82, `rgba(200,210,240,${p.a * 0.6})`);
            gTop.addColorStop(1,    `rgba(180,190,220,0)`);

            ctx.save();
            ctx.beginPath();
            ctx.arc(x, y, arcR, aStart, aEnd);
            ctx.strokeStyle = gTop;
            ctx.lineWidth   = p.lw;
            ctx.lineCap     = 'round';
            ctx.stroke();
            ctx.restore();
        }

        // ── Нижняя дуга (тусклее, линзированный верхний диск) ─
        const botPasses = [
            { rOff: 0,        lw: r * 0.040, a: 0.55 },
            { rOff: r * 0.07, lw: r * 0.14,  a: 0.22 },
            { rOff: r * 0.18, lw: r * 0.28,  a: 0.08 },
        ];

        for (const p of botPasses) {
            const arcR   = r * 1.04 + p.rOff;
            const aStart = 0.20;
            const aEnd   = Math.PI - 0.20;

            const gBot = ctx.createLinearGradient(x - arcR, y, x + arcR, y);
            gBot.addColorStop(0,    'rgba(180,160,120,0)');
            gBot.addColorStop(0.20, `rgba(200,175,130,${p.a * 0.5})`);
            gBot.addColorStop(0.50, `rgba(230,210,170,${p.a})`);
            gBot.addColorStop(0.80, `rgba(200,175,130,${p.a * 0.5})`);
            gBot.addColorStop(1,    'rgba(180,160,120,0)');

            ctx.save();
            ctx.beginPath();
            ctx.arc(x, y, arcR, aStart, aEnd);
            ctx.strokeStyle = gBot;
            ctx.lineWidth   = p.lw;
            ctx.lineCap     = 'round';
            ctx.stroke();
            ctx.restore();
        }
    }

    // Фотонное кольцо (тонкое свечение прямо у горизонта)
    function drawPhotonRing(bh, t) {
        const { x, y, r } = bh;
        const pulse = 0.80 + 0.20 * Math.sin(t * 0.013);

        const rg = ctx.createRadialGradient(x, y, r * 0.88, x, y, r * 1.18);
        rg.addColorStop(0,    'rgba(0,0,0,0)');
        rg.addColorStop(0.42, `rgba(180,195,225,${0.22 * pulse})`);
        rg.addColorStop(0.62, `rgba(230,240,255,${0.55 * pulse})`);
        rg.addColorStop(0.78, `rgba(180,195,225,${0.20 * pulse})`);
        rg.addColorStop(1,    'rgba(0,0,0,0)');

        ctx.beginPath();
        ctx.arc(x, y, r * 1.18, 0, Math.PI * 2);
        ctx.fillStyle = rg;
        ctx.fill();
    }

    // Яркое доплеровское пятно на левой стороне диска
    function drawHotspot(bh, t) {
        const { x, y, r, diskH } = bh;
        const pulse = 0.85 + 0.15 * Math.sin(t * 0.007);

        // Левая сторона (приближается к наблюдателю → ярче)
        const hx = x - r * 1.75;
        const hy = y + diskH * 0.4;

        const hg = ctx.createRadialGradient(hx, hy, 0, hx, hy, r * 2.2);
        hg.addColorStop(0,    `rgba(255,248,225,${0.55 * pulse})`);
        hg.addColorStop(0.20, `rgba(240,220,160,${0.28 * pulse})`);
        hg.addColorStop(0.50, `rgba(200,170,100,${0.10 * pulse})`);
        hg.addColorStop(1,    'rgba(0,0,0,0)');

        ctx.save();
        ctx.globalCompositeOperation = 'screen';
        ctx.beginPath();
        ctx.ellipse(hx, hy, r * 2.2, r * 0.55, 0, 0, Math.PI * 2);
        ctx.fillStyle = hg;
        ctx.fill();
        ctx.restore();
    }

    // Лёгкое рассеянное свечение от всего диска
    function drawAmbientGlow(bh) {
        const { x, y, r, diskW } = bh;

        const ag = ctx.createRadialGradient(x, y, r, x, y, diskW * 1.4);
        ag.addColorStop(0,    'rgba(60,50,35,0.12)');
        ag.addColorStop(0.35, 'rgba(35,28,18,0.06)');
        ag.addColorStop(1,    'rgba(0,0,0,0)');

        ctx.beginPath();
        ctx.ellipse(x, y, diskW * 1.4, diskW * 0.25, 0, 0, Math.PI * 2);
        ctx.fillStyle = ag;
        ctx.fill();
    }

    // Тень (горизонт событий)
    function drawShadow(bh, punch) {
        const { x, y, r } = bh;
        if (punch) {
            // Абсолютная чернота поверх всего
            ctx.beginPath();
            ctx.arc(x, y, r, 0, Math.PI * 2);
            ctx.fillStyle = '#000000';
            ctx.fill();
        } else {
            // Первый слой с очень тёмным градиентом (не чистый чёрный — линзирование фоновых звёзд)
            const sg = ctx.createRadialGradient(x, y - r * 0.08, 0, x, y, r);
            sg.addColorStop(0,   '#060606');
            sg.addColorStop(0.8, '#030303');
            sg.addColorStop(1,   '#000000');
            ctx.beginPath();
            ctx.arc(x, y, r, 0, Math.PI * 2);
            ctx.fillStyle = sg;
            ctx.fill();
        }
    }

    // ─────────────────────────────────────────────────────────
    // ГЛАВНЫЙ ЦИКЛ
    // ─────────────────────────────────────────────────────────
    let t = 0;

    function draw() {
        t++;
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        const bh = BH();

        // 1. Звёзды
        drawStars(bh, t);

        // 2. Рассеянное свечение диска (фоновый слой)
        drawAmbientGlow(bh);

        // 3. Дальняя (задняя) половина диска
        drawDiskBand(bh, t, false);

        // 4. Гравитационно-линзированные дуги (изогнутый свет диска)
        drawLensingArcs(bh, t);

        // 5. Тень — первый проход
        drawShadow(bh, false);

        // 6. Ближняя (передняя) половина диска — поверх тени
        drawDiskBand(bh, t, true);

        // 7. Фотонное кольцо
        drawPhotonRing(bh, t);

        // 8. Тень — финальный проход (выбиваем чернотой)
        drawShadow(bh, true);

        // 9. Доплеровский горячий spot
        drawHotspot(bh, t);

        requestAnimationFrame(draw);
    }

    draw();
})();
