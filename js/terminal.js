/* ============================================================================
   ПЕЧАТАЮЩИЙСЯ ТЕКСТ — аккуратный тайпрайтер с отменой и поддержкой
   prefers-reduced-motion (тогда текст появляется сразу).
   ========================================================================== */

(function () {
    'use strict';

    const reduce = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    class TypeWriter {
        constructor(el, opts = {}) {
            this.el = el;
            this.speed = opts.speed || 55;
            this.delay = opts.delay || 0;
            this.onChar = opts.onChar || null;
            this._timer = null;
            this._i = 0;
            this._text = '';
        }

        cancel() {
            if (this._timer) { clearTimeout(this._timer); this._timer = null; }
        }

        start(text) {
            this.cancel();
            this._text = text;
            this._i = 0;
            if (!this.el) return this;
            this.el.textContent = '';

            if (reduce()) { this.el.textContent = text; if (this.onChar) this.onChar(text); return this; }

            const step = () => {
                if (this._i >= this._text.length) return;
                // паузы на знаках препинания — читается живее
                const ch = this._text[this._i++];
                this.el.textContent += ch;
                if (this.onChar) this.onChar(this.el.textContent);
                let d = this.speed;
                if (ch === '.' || ch === ':') d = this.speed * 6;
                else if (ch === '\n') d = this.speed * 12;
                else if (ch === ' ') d = this.speed * 0.6;
                else d = this.speed * (0.6 + Math.random() * 0.8);
                this._timer = setTimeout(step, d);
            };
            this._timer = setTimeout(step, this.delay);
            return this;
        }
    }

    window.TypeWriter = TypeWriter;
})();
