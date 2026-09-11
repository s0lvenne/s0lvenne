/* ============================================================================
   ЧЁРНАЯ ДЫРА  •  Solven Vandermirant
   ----------------------------------------------------------------------------
   Настоящий рендер, а не «нарисованный в paint»:
     • трассировка фотонных геодезик в метрике Шварцшильда — интегрируется
       ОДУ  u'' = -u + 3/2·u²  в плоскости полёта (u = 1/r, rs = 1).
       Отсюда честное гравитационное линзирование: звёзды обтекают дыру, диск
       загибается и над, и под тенью, само собой рождается фотонное кольцо;
     • аккреционный диск: кеплеровское вращение, турбулентность (fBm),
       профиль температуры T ∝ r^(-3/4), доплеровский биминг δ³ и
       гравитационное красное смещение;
     • процедурное звёздное небо (equirect-карта генерируется на CPU);
     • bloom, виньетка, плёночная тональная компрессия ACES, дизеринг;
     • адаптив под FPS, пауза в скрытой вкладке, prefers-reduced-motion,
       мягкий фолбэк на Canvas2D, если WebGL нет.
   ========================================================================== */

(function () {
    'use strict';

    /* ═══════════════════════  ШЕЙДЕРЫ  ═══════════════════════ */

    const VERT = `
        attribute vec2 aPos;
        void main() { gl_Position = vec4(aPos, 0.0, 1.0); }
    `;

    const FRAG = `
        precision highp float;

        uniform vec2  uRes;
        uniform float uTime;
        uniform vec2  uCenter;      // центр дыры в экранных координатах
        uniform vec2  uParallax;    // отклик на мышь
        uniform float uFov;         // tan(половины вертикального угла)
        uniform float uCamDist;     // расстояние камеры в rs
        uniform float uIncl;        // наклон камеры над плоскостью диска
        uniform float uDiskIn;      // внутренний радиус диска (ISCO = 3 rs)
        uniform float uDiskOut;     // внешний радиус диска
        uniform float uDiskBright;
        uniform float uStarBright;
        uniform float uHaze;
        uniform float uSpin;
        uniform float uQuality;     // 0.45 … 1.0 — множитель качества
        uniform float uHalo;
        uniform sampler2D uStars;
        uniform vec3  uHot;
        uniform vec3  uWarm;
        uniform vec3  uCool;

        #define MAX_STEPS 170
        #define PI 3.14159265359

        /* ── шум ─────────────────────────────────────────────── */
        float hash13(vec3 p3) {
            p3 = fract(p3 * 0.1031);
            p3 += dot(p3, p3.yzx + 33.33);
            return fract((p3.x + p3.y) * p3.z);
        }
        float noise3(vec3 x) {
            vec3 i = floor(x), f = fract(x);
            f = f * f * (3.0 - 2.0 * f);
            float n000 = hash13(i);
            float n100 = hash13(i + vec3(1.0, 0.0, 0.0));
            float n010 = hash13(i + vec3(0.0, 1.0, 0.0));
            float n110 = hash13(i + vec3(1.0, 1.0, 0.0));
            float n001 = hash13(i + vec3(0.0, 0.0, 1.0));
            float n101 = hash13(i + vec3(1.0, 0.0, 1.0));
            float n011 = hash13(i + vec3(0.0, 1.0, 1.0));
            float n111 = hash13(i + vec3(1.0, 1.0, 1.0));
            return mix(mix(mix(n000, n100, f.x), mix(n010, n110, f.x), f.y),
                       mix(mix(n001, n101, f.x), mix(n011, n111, f.x), f.y), f.z);
        }
        float fbm(vec3 p) {
            float a = 0.5, s = 0.0;
            for (int i = 0; i < 3; i++) { s += a * noise3(p); p *= 2.07; a *= 0.5; }
            return s * 1.14;
        }

        /* ── звёзды: процедурно, с аналитическим сглаживанием ──────
           Каждая звезда живёт в своей ячейке 3D-сетки на сфере направлений.
           Край звезды размыт ровно на размер пикселя, поэтому она всегда
           круглая: ни «лестниц», ни мерцания при сжатии текстуры.        */
        vec3 starField(vec3 dir, float pixAng) {
            vec3  col = vec3(0.0);
            float f = 80.0;          // ячеек на радиус сферы
            float w = 1.0;           // следующие слои тусклее
            for (int i = 0; i < 3; i++) {
                vec3  p    = dir * f;
                vec3  cell = floor(p);
                vec3  loc  = p - cell - 0.5;
                float seed = hash13(cell + float(i) * 31.7);
                if (seed > 0.930) {
                    vec3  off = vec3(hash13(cell + 1.7), hash13(cell + 3.1), hash13(cell + 5.9)) - 0.5;
                    off *= 0.62;
                    float dist = length(loc - off);
                    float mag  = hash13(cell + 11.3);
                    float size = 0.055 + 0.150 * mag * mag;    // радиус в долях ячейки (~0.6…2.4 px)
                    float aa   = pixAng * f * 0.55;            // край звезды = полпикселя
                    float core = 1.0 - smoothstep(size - aa, size + aa, dist);
                    float halo = exp(-dist * (20.0 + 34.0 * (1.0 - mag)));
                    float fade = size / (size + aa);           // слишком мелкие гаснут, а не мерцают
                    float bright = (0.18 + 0.82 * mag * mag) * fade * w;
                    float tint = hash13(cell + 19.7);
                    vec3  col2 = tint < 0.14 ? vec3(1.00, 0.84, 0.68)
                               : tint < 0.28 ? vec3(0.76, 0.85, 1.00)
                                             : vec3(1.00, 1.00, 1.00);
                    col += col2 * (core + halo * 0.70) * bright;
                }
                f *= 2.62;
                w *= 0.70;
            }
            return col;
        }

        /* ── небо: мягкая дымка из текстуры + резкие процедурные звёзды ── */
        vec3 skyColor(vec3 d, float pixAng) {
            vec2 uv;
            uv.x = atan(d.z, d.x) * 0.15915494 + 0.5;
            uv.y = acos(clamp(d.y, -1.0, 1.0)) * 0.31830989;
            vec3 haze = texture2D(uStars, uv).rgb;
            return haze * uHaze + starField(d, pixAng) * uStarBright;
        }

        /* ── излучение диска ─────────────────────────────────── */
        vec3 diskEmission(vec3 P, float r, vec3 nObs, out float alpha) {
            float v     = sqrt(0.5 / r);                             // v = sqrt(M/r), M = 0.5
            vec3  vdir  = normalize(cross(vec3(0.0, 1.0, 0.0), P));
            vec3  betaV = vdir * v;
            float gamma = 1.0 / sqrt(max(1.0 - v * v, 1e-3));

            float dopp = 1.0 / (gamma * (1.0 - dot(betaV, nObs)));   // доплер
            float grav = sqrt(max(1.0 - 1.0 / r, 0.02));             // красное смещение
            float g    = clamp(dopp * grav, 0.0, 1.9);

            // турбулентность: крутим точку против вращения диска
            float omega = 3.2 * pow(r, -1.5) * uSpin;
            float ang   = -omega * uTime;
            float ca = cos(ang), sa = sin(ang);
            vec3  Pr = vec3(P.x * ca - P.z * sa, P.y, P.x * sa + P.z * ca);
            float n  = fbm(Pr * 0.42 + vec3(0.0, 0.0, uTime * 0.015));

            float dens = 0.35 + 1.05 * n;
            dens *= smoothstep(uDiskOut, uDiskIn * 1.6, r);          // затухание к внешнему краю
            dens *= smoothstep(uDiskIn, uDiskIn * 1.22, r);          // мягкий внутренний срез
            float fil = 0.72 + 0.5 * sin(atan(P.z, P.x) * 13.0 + n * 9.0 - omega * uTime * 0.35);
            dens *= mix(1.0, fil, 0.45);
            alpha = clamp(dens, 0.0, 1.0);

            float t = pow(uDiskIn / r, 0.75);                        // T ∝ r^(-3/4)
            vec3  base = mix(uCool, uWarm, smoothstep(0.18, 0.60, t));
            base = mix(base, uHot, smoothstep(0.60, 0.98, t));

            float emis  = pow(uDiskIn / r, 1.05);                    // профиль излучения
            float boost = 0.44 + 1.32 * pow(g, 3.0);                 // доплеровский биминг
            return base * emis * boost * uDiskBright;
        }

        vec3 aces(vec3 x) {
            return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0);
        }

        void main() {
            vec2 uv = (gl_FragCoord.xy / uRes) * 2.0 - 1.0;
            uv.x *= uRes.x / uRes.y;
            vec2 q = uv - uCenter;

            /* ── камера ──────────────────────────────────────── */
            float inc = uIncl + uParallax.y * 0.10;
            float azi = uParallax.x * 0.12;
            vec3 camPos = vec3(cos(inc) * sin(azi), sin(inc), cos(inc) * cos(azi)) * uCamDist;
            vec3 fwd   = normalize(-camPos);
            vec3 right = normalize(cross(vec3(0.0, 1.0, 0.0), fwd));
            vec3 up    = cross(fwd, right);
            vec3 rd    = normalize(fwd + right * (q.x * uFov) + up * (q.y * uFov));

            /* ── базис плоскости полёта фотона ───────────────── */
            float r0 = length(camPos);
            vec3  e1 = camPos / r0;
            float vr = dot(rd, e1);
            vec3  tv = rd - e1 * vr;
            float vt = max(length(tv), 1e-5);
            vec3  e2 = (length(tv) > 1e-5) ? tv / vt : normalize(cross(e1, vec3(0.0, 1.0, 0.0)));

            float b = r0 * vt;                     // прицельный параметр
            float pixAng = 2.0 * uFov / uRes.y;    // угловой размер пикселя
            vec3  col = vec3(0.0);
            float transmit = 1.0;

            if (b > uDiskOut + 5.0) {
                // слабое поле: α = 2rs/b — дешёвый и точный путь
                float tca   = -dot(camPos, rd);
                float frac  = 0.5 + atan(tca / b) / PI;
                float alpha = (2.0 / b) * frac;
                vec3  Q     = camPos + rd * tca;
                vec3  push  = normalize(Q + vec3(1e-6));
                col = skyColor(normalize(rd + push * alpha), pixAng);
            } else {
                /* ── интегрирование геодезики ─────────────────── */
                float u    = 1.0 / r0;
                float du   = -u * (vr / vt);
                float phi  = 0.0;
                float prevY = camPos.y, prevR = r0, prevPhi = 0.0;
                bool  captured = false;
                vec3  outDir = rd;
                float stepScale = mix(2.4, 1.0, clamp(uQuality, 0.0, 1.0));

                for (int i = 0; i < MAX_STEPS; i++) {
                    float r = 1.0 / max(u, 1e-7);
                    float dphi = mix(0.011, 0.085, clamp((r - 1.3) / 20.0, 0.0, 1.0)) * stepScale;

                    du += (-u + 1.5 * u * u) * dphi;   // u'' = -u + 3/2 u²
                    u  += du * dphi;
                    phi += dphi;

                    if (u <= 1e-6) break;                        // улетел
                    float rn = 1.0 / u;
                    if (rn <= 1.02) { captured = true; break; }   // за горизонтом событий

                    float c = cos(phi), s = sin(phi);
                    vec3  radial = e1 * c + e2 * s;
                    vec3  P = rn * radial;

                    float drdphi = -du / (u * u);
                    outDir = normalize(drdphi * radial + rn * (-e1 * s + e2 * c));

                    if (prevY * P.y < 0.0) {                      // пересекли плоскость диска
                        float f    = prevY / (prevY - P.y);
                        float rc   = mix(prevR, rn, f);
                        float phic = mix(prevPhi, phi, f);
                        if (rc > uDiskIn && rc < uDiskOut) {
                            vec3  Pc = rc * (e1 * cos(phic) + e2 * sin(phic));
                            float a;
                            vec3  e = diskEmission(Pc, rc, -outDir, a);
                            col      += transmit * e * a;
                            transmit *= (1.0 - a);
                            if (transmit < 0.004) break;
                        }
                    }

                    prevY = P.y; prevR = rn; prevPhi = phi;
                    if (phi > 9.5) break;                          // больше витка
                    if (rn > 80.0 && du < 0.0) break;              // уходит прочь
                }

                if (!captured && transmit > 0.004) col += transmit * skyColor(outDir, pixAng);
            }

            /* ── мягкое гало: свет диска, рассеянный вокруг дыры ─ */
            float d = length(q);
            col += uHalo * 0.005 * uCool * exp(-d * 2.4);
            col += uHalo * 0.055 * uCool * exp(-abs(d - 0.30) * 4.2);
            col += uHalo * 0.045 * uWarm * exp(-abs(d - 0.26) * 6.5);

            gl_FragColor = vec4(aces(col), 1.0);
        }
    `;

    const BLOOM_FRAG = `
        precision highp float;
        uniform sampler2D uScene;
        uniform vec2  uRes;
        uniform float uBloom;
        uniform float uVignette;

        void main() {
            vec2 uv = gl_FragCoord.xy / uRes;
            vec3 c = texture2D(uScene, uv).rgb;

            // 18 тапов по золотому углу — ровное покрытие круга
            vec3  b = vec3(0.0);
            float aspect = uRes.x / uRes.y;
            for (int i = 0; i < 18; i++) {
                float fi = float(i);
                float a  = fi * 2.39996323;
                float r  = 0.035 * sqrt((fi + 0.5) / 18.0);
                b += texture2D(uScene, uv + vec2(cos(a) / aspect, sin(a)) * r).rgb;
            }
            b /= 18.0;

            vec3 col = c + b * uBloom;

            vec2 v = uv - 0.5;
            col *= 1.0 - uVignette * dot(v, v) * 1.6;                       // виньетка

            float dither = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453);
            col += (dither - 0.5) / 255.0;                                  // против бандинга

            gl_FragColor = vec4(col, 1.0);
        }
    `;

    /* ═══════════════  ГЕНЕРАЦИЯ ЗВЁЗДНОЙ КАРТЫ (CPU)  ═══════════════ */

    function makeNebulaCanvas(W, H) {
        const cv = document.createElement('canvas');
        cv.width = W; cv.height = H;
        const g = cv.getContext('2d');
        g.fillStyle = '#000000';
        g.fillRect(0, 0, W, H);
        g.globalCompositeOperation = 'lighter';

        // Только крупные мягкие пятна: низкая частота, поэтому сжатие текстуры
        // при отрисовке не даёт «лестниц». Сами звёзды рисуются в шейдере.
        for (let i = 0; i < 90; i++) {
            const cx = Math.random() * W;
            const band = 0.5 + 0.40 * Math.sin(cx / W * Math.PI * 2 + 0.7);
            const cy = band * H + (Math.random() - 0.5) * H * 0.30;
            const r = 12 + Math.random() * 46;
            const a = 0.012 + Math.random() * 0.034;
            for (const off of [-W, 0, W]) {
                const px = cx + off;
                if (px < -r || px > W + r) continue;
                const grd = g.createRadialGradient(px, cy, 0, px, cy, r);
                grd.addColorStop(0, `rgba(120,140,190,${a})`);
                grd.addColorStop(0.5, `rgba(70,80,130,${a * 0.35})`);
                grd.addColorStop(1, 'rgba(0,0,0,0)');
                g.fillStyle = grd;
                g.beginPath();
                g.arc(px, cy, r, 0, Math.PI * 2);
                g.fill();
            }
        }
        g.globalCompositeOperation = 'source-over';
        return cv;
    }

    function compile(gl, type, src) {
        const sh = gl.createShader(type);
        gl.shaderSource(sh, src);
        gl.compileShader(sh);
        if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
            console.error('[blackhole] shader error:', gl.getShaderInfoLog(sh));
            gl.deleteShader(sh);
            return null;
        }
        return sh;
    }

    function buildProgram(gl, fs, names) {
        const vs = compile(gl, gl.VERTEX_SHADER, VERT);
        const fsh = compile(gl, gl.FRAGMENT_SHADER, fs);
        if (!vs || !fsh) return null;
        const p = gl.createProgram();
        gl.attachShader(p, vs);
        gl.attachShader(p, fsh);
        gl.bindAttribLocation(p, 0, 'aPos');
        gl.linkProgram(p);
        if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
            console.error('[blackhole] link error:', gl.getProgramInfoLog(p));
            return null;
        }
        const u = {};
        for (const n of names) u[n] = gl.getUniformLocation(p, n);
        return { program: p, u };
    }

    const SCENE_UNIFORMS = ['uRes', 'uTime', 'uCenter', 'uParallax', 'uFov', 'uCamDist',
        'uIncl', 'uDiskIn', 'uDiskOut', 'uDiskBright', 'uStarBright', 'uSpin',
        'uQuality', 'uHalo', 'uHaze', 'uStars', 'uHot', 'uWarm', 'uCool'];

    function initGL(canvas, o, state) {
        const gl = canvas.getContext('webgl', {
            alpha: false, antialias: false, depth: false, stencil: false,
            powerPreference: 'high-performance'
        }) || canvas.getContext('experimental-webgl', { alpha: false, depth: false });
        if (!gl) return null;

        const scene = buildProgram(gl, FRAG, SCENE_UNIFORMS);
        if (!scene) return null;
        const bloom = buildProgram(gl, BLOOM_FRAG, ['uScene', 'uRes', 'uBloom', 'uVignette']);

        gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
        gl.enableVertexAttribArray(0);
        gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

        // текстура звёзд
        const starTex = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, starTex);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, makeNebulaCanvas(512, 256));
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

        // FBO сцены
        const fbo = gl.createFramebuffer();
        const sceneTex = gl.createTexture();
        let fw = 0, fh = 0, useFbo = false;

        function allocFbo(w, h) {
            fw = w; fh = h;
            gl.bindTexture(gl.TEXTURE_2D, sceneTex);
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
            gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
            gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, sceneTex, 0);
            useFbo = !!bloom && gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
            gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        }

        let raf = 0, t = 0, last = performance.now();
        let frames = 0, acc = 0, adapt = 0;

        function setSize() {
            const dpr = Math.min(window.devicePixelRatio || 1, 1.6);
            const cssW = canvas.clientWidth || window.innerWidth;
            const cssH = canvas.clientHeight || window.innerHeight;
            const w = Math.max(2, Math.round(cssW * dpr));
            const h = Math.max(2, Math.round(cssH * dpr));
            canvas.width = w; canvas.height = h;
            allocFbo(Math.max(2, Math.round(w * state.scale)), Math.max(2, Math.round(h * state.scale)));
        }

        function frame(now) {
            raf = requestAnimationFrame(frame);
            const dt = Math.min((now - last) / 1000, 0.05);
            last = now;
            if (state.paused) return;

            state.parallax[0] += (state.target[0] - state.parallax[0]) * 0.045;
            state.parallax[1] += (state.target[1] - state.parallax[1]) * 0.045;
            if (!state.reduce) t += dt;

            // ── пас 1: сцена ──
            gl.bindFramebuffer(gl.FRAMEBUFFER, useFbo ? fbo : null);
            gl.viewport(0, 0, useFbo ? fw : canvas.width, useFbo ? fh : canvas.height);
            gl.useProgram(scene.program);
            const u = scene.u;
            gl.uniform2f(u.uRes, useFbo ? fw : canvas.width, useFbo ? fh : canvas.height);
            gl.uniform1f(u.uTime, t);
            gl.uniform2f(u.uCenter, state.center[0], state.center[1]);
            gl.uniform2f(u.uParallax, state.parallax[0], state.parallax[1]);
            gl.uniform1f(u.uFov, o.fov);
            gl.uniform1f(u.uCamDist, o.camDist);
            gl.uniform1f(u.uIncl, o.incl);
            gl.uniform1f(u.uDiskIn, o.diskIn);
            gl.uniform1f(u.uDiskOut, o.diskOut);
            gl.uniform1f(u.uDiskBright, o.diskBright);
            gl.uniform1f(u.uStarBright, o.starBright);
            gl.uniform1f(u.uSpin, o.spin);
            gl.uniform1f(u.uQuality, state.quality);
            gl.uniform1f(u.uHalo, o.halo);
            gl.uniform1f(u.uHaze, o.haze);
            gl.uniform3fv(u.uHot, o.hot);
            gl.uniform3fv(u.uWarm, o.warm);
            gl.uniform3fv(u.uCool, o.cool);
            gl.activeTexture(gl.TEXTURE0);
            gl.bindTexture(gl.TEXTURE_2D, starTex);
            gl.uniform1i(u.uStars, 0);
            gl.drawArrays(gl.TRIANGLES, 0, 3);

            // ── пас 2: bloom + виньетка ──
            if (useFbo) {
                gl.bindFramebuffer(gl.FRAMEBUFFER, null);
                gl.viewport(0, 0, canvas.width, canvas.height);
                gl.useProgram(bloom.program);
                gl.activeTexture(gl.TEXTURE0);
                gl.bindTexture(gl.TEXTURE_2D, sceneTex);
                gl.uniform1i(bloom.u.uScene, 0);
                gl.uniform2f(bloom.u.uRes, canvas.width, canvas.height);
                gl.uniform1f(bloom.u.uBloom, o.bloom);
                gl.uniform1f(bloom.u.uVignette, o.vignette);
                gl.drawArrays(gl.TRIANGLES, 0, 3);
            }

            // ── адаптив под FPS ──
            frames++; acc += dt;
            if (acc >= 1.0) {
                const fps = frames / acc;
                frames = 0; acc = 0;
                if (fps < 42 && adapt < 3) {
                    adapt++;
                    state.scale = Math.max(0.42, state.scale * 0.78);
                    state.quality = Math.max(0.45, state.quality - 0.2);
                    setSize();
                } else if (fps > 57 && adapt > 0) {
                    adapt--;
                    state.scale = Math.min(o.baseScale, state.scale * 1.2);
                    state.quality = Math.min(o.baseQuality, state.quality + 0.2);
                    setSize();
                }
            }
        }

        window.addEventListener('resize', setSize, { passive: true });
        setSize();
        raf = requestAnimationFrame(frame);

        return {
            engine: 'webgl',
            destroy() { cancelAnimationFrame(raf); }
        };
    }

    /* ═══════════════  ФОЛБЭК: CANVAS 2D (если нет WebGL)  ═══════════════ */

    function init2D(canvas, o, state) {
        const ctx = canvas.getContext('2d');
        if (!ctx) return null;

        let stars = [], raf = 0, t = 0, last = performance.now();

        function build() {
            const w = canvas.width, h = canvas.height;
            stars = [];
            const n = Math.round(w * h / 5200);
            for (let i = 0; i < n; i++) {
                stars.push({
                    x: Math.random() * w, y: Math.random() * h,
                    r: Math.random() * 1.3 + 0.25,
                    a: Math.random() * 0.7 + 0.25,
                    p: Math.random() * Math.PI * 2,
                    warm: Math.random() < 0.12
                });
            }
        }

        function setSize() {
            const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
            canvas.width = Math.max(2, Math.round((canvas.clientWidth || window.innerWidth) * dpr));
            canvas.height = Math.max(2, Math.round((canvas.clientHeight || window.innerHeight) * dpr));
            build();
        }

        function disk(cx, cy, R, halfH, alpha, scale, front) {
            ctx.save();
            ctx.beginPath();
            if (front) ctx.rect(0, cy, canvas.width, canvas.height);
            else ctx.rect(0, 0, canvas.width, cy);
            ctx.clip();
            ctx.beginPath();
            ctx.rect(0, 0, canvas.width, canvas.height);
            ctx.arc(cx, cy, R * 0.99, 0, Math.PI * 2, true);
            ctx.clip('evenodd');

            const g = ctx.createLinearGradient(cx - R * scale, cy, cx + R * scale, cy);
            const boost = 0.85 + 0.15 * Math.sin(t * 0.6);
            g.addColorStop(0.00, 'rgba(0,0,0,0)');
            g.addColorStop(0.16, `rgba(120,60,30,${alpha * 0.5 * boost})`);
            g.addColorStop(0.34, `rgba(255,170,80,${alpha * 0.85 * boost})`);
            g.addColorStop(0.46, `rgba(255,244,225,${alpha * boost})`);
            g.addColorStop(0.50, 'rgba(0,0,0,0)');
            g.addColorStop(0.54, `rgba(255,244,225,${alpha * boost})`);
            g.addColorStop(0.66, `rgba(255,170,80,${alpha * 0.85})`);
            g.addColorStop(0.84, `rgba(120,60,30,${alpha * 0.5})`);
            g.addColorStop(1.00, 'rgba(0,0,0,0)');
            ctx.fillStyle = g;
            ctx.beginPath();
            ctx.ellipse(cx, cy, R * scale, halfH * scale * 0.55, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }

        function frame(now) {
            raf = requestAnimationFrame(frame);
            const dt = Math.min((now - last) / 1000, 0.05);
            last = now;
            if (state.paused) return;
            if (!state.reduce) t += dt;

            const w = canvas.width, h = canvas.height;
            ctx.fillStyle = '#000000';
            ctx.fillRect(0, 0, w, h);

            const R = Math.min(w, h) * 0.155;
            const cx = w * (0.5 + state.center[0] * 0.5);
            const cy = h * (0.5 - state.center[1] * 0.5);

            // звёзды со слабополевым линзированием: α = 2rs/b
            for (const s of stars) {
                let dx = s.x - cx, dy = s.y - cy;
                let d = Math.hypot(dx, dy) || 1;
                const alpha = 2 * R / Math.max(d, R * 1.05);      // слабое поле
                const k = 1 - Math.min(alpha * 0.9, 0.55) * (R / d);
                const x = cx + dx * k, y = cy + dy * k;
                const tw = Math.sin(t * 0.9 + s.p) * 0.25;
                let a = Math.max(0, s.a + tw) * Math.min(1, (d - R * 0.9) / 40);
                if (a <= 0.01) continue;
                ctx.globalAlpha = a;
                ctx.fillStyle = s.warm ? '#ffd8a0' : '#ffffff';
                ctx.beginPath();
                ctx.arc(x, y, s.r, 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.globalAlpha = 1;

            // диск: гало → задняя половина → дуги → тень → передняя половина
            ctx.globalCompositeOperation = 'lighter';
            const glow = ctx.createRadialGradient(cx, cy, R * 0.5, cx, cy, R * 6);
            glow.addColorStop(0, 'rgba(90,45,25,0.30)');
            glow.addColorStop(0.5, 'rgba(50,25,15,0.10)');
            glow.addColorStop(1, 'rgba(0,0,0,0)');
            ctx.fillStyle = glow;
            ctx.beginPath();
            ctx.ellipse(cx, cy, R * 6, R * 1.1, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalCompositeOperation = 'source-over';

            disk(cx, cy, R, R * 0.16, 0.55, 4.2, false);
            disk(cx, cy, R, R * 0.16, 0.95, 3.1, false);
            disk(cx, cy, R, R * 0.16, 1.00, 2.4, false);

            // линзированные дуги над и под тенью
            ctx.globalCompositeOperation = 'lighter';
            for (const pass of [{ ro: 0.02, lw: 0.05, a: 0.85 }, { ro: 0.08, lw: 0.16, a: 0.3 }, { ro: 0.2, lw: 0.3, a: 0.1 }]) {
                ctx.beginPath();
                ctx.arc(cx, cy, R * (1.06 + pass.ro), Math.PI + 0.2, Math.PI * 2 - 0.2);
                ctx.strokeStyle = `rgba(255,246,230,${pass.a})`;
                ctx.lineWidth = R * pass.lw;
                ctx.lineCap = 'round';
                ctx.stroke();
                ctx.beginPath();
                ctx.arc(cx, cy, R * (1.06 + pass.ro), 0.22, Math.PI - 0.22);
                ctx.strokeStyle = `rgba(255,200,140,${pass.a * 0.5})`;
                ctx.stroke();
            }
            ctx.globalCompositeOperation = 'source-over';

            // тень
            const sg = ctx.createRadialGradient(cx, cy, R * 0.5, cx, cy, R);
            sg.addColorStop(0, '#050505');
            sg.addColorStop(1, '#000000');
            ctx.fillStyle = sg;
            ctx.beginPath();
            ctx.arc(cx, cy, R, 0, Math.PI * 2);
            ctx.fill();

            disk(cx, cy, R, R * 0.16, 1.00, 2.4, true);
            disk(cx, cy, R, R * 0.16, 0.95, 3.1, true);

            // фотонное кольцо
            ctx.globalCompositeOperation = 'lighter';
            const pr = ctx.createRadialGradient(cx, cy, R * 0.9, cx, cy, R * 1.2);
            pr.addColorStop(0, 'rgba(0,0,0,0)');
            pr.addColorStop(0.55, `rgba(255,240,220,${0.35 + 0.12 * Math.sin(t)})`);
            pr.addColorStop(1, 'rgba(0,0,0,0)');
            ctx.fillStyle = pr;
            ctx.beginPath();
            ctx.arc(cx, cy, R * 1.2, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalCompositeOperation = 'source-over';
        }

        window.addEventListener('resize', setSize, { passive: true });
        setSize();
        raf = requestAnimationFrame(frame);

        return { engine: 'canvas2d', destroy() { cancelAnimationFrame(raf); } };
    }

    /* ═══════════════════════  ПУБЛИЧНЫЙ API  ═══════════════════════ */

    function init(canvas, userOpts) {
        if (!canvas) return null;

        const mq = window.matchMedia('(prefers-reduced-motion: reduce)');

        const o = Object.assign({
            centerX: 0.34,       // центр дыры: доля экрана вправо от середины
            centerY: 0.02,
            fov: 0.62,           // tan(половины вертикального угла) ≈ 34°
            camDist: 18,
            incl: 0.17,          // ~10° над плоскостью диска
            diskIn: 3.0,         // ISCO для Шварцшильда = 3 rs
            diskOut: 11.5,
            diskBright: 0.34,
            starBright: 1.80,
            haze: 0.55,
            spin: 1.0,
            bloom: 0.85,
            halo: 1.0,
            vignette: 0.55,
            baseScale: 1.0,
            baseQuality: 1.0,
            hot: [1.0, 0.97, 0.93],
            warm: [1.0, 0.60, 0.26],
            cool: [0.90, 0.16, 0.28]
        }, userOpts || {});

        const state = {
            paused: false,
            reduce: mq.matches,
            scale: o.baseScale,
            quality: o.baseQuality,
            parallax: [0, 0],
            target: [0, 0],
            center: [o.centerX, o.centerY]
        };

        let engine = null;
        try {
            engine = initGL(canvas, o, state);
        } catch (err) {
            console.warn('[blackhole] WebGL недоступен:', err);
        }
        if (!engine) engine = init2D(canvas, o, state);
        if (!engine) return null;

        const api = {
            engine: engine.engine,
            setCenter(x, y) { state.center[0] = x; state.center[1] = y; },
            setAccent(hot, warm, cool) { o.hot = hot; o.warm = warm; o.cool = cool; },
            setPaused(v) { state.paused = !!v; },
            setLayout(mobile) {
                o.fov = mobile ? 0.78 : 0.62;
                state.center[0] = mobile ? 0.02 : o.centerX;
                state.center[1] = mobile ? -0.22 : o.centerY;
            },
            get options() { return o; },
            destroy() { engine.destroy(); }
        };

        document.addEventListener('visibilitychange', () => {
            state.paused = document.hidden;
        });

        const onMotion = () => { state.reduce = mq.matches; };
        if (mq.addEventListener) mq.addEventListener('change', onMotion);

        if (!state.reduce) {
            window.addEventListener('pointermove', (e) => {
                if (e.pointerType === 'touch') return;
                state.target[0] = (e.clientX / window.innerWidth - 0.5) * 2;
                state.target[1] = -(e.clientY / window.innerHeight - 0.5) * 2;
            }, { passive: true });
        }

        return api;
    }

    window.BlackHole = { init };
})();
