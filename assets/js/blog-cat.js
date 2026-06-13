// ═══════════════════════════════════════════════════════════════════════════
// FELIS MONASTICA — Blog Edition
// Odlehčená verze kočky pro statický blog. Bez herní logiky, jen čistá radost.
// ═══════════════════════════════════════════════════════════════════════════

const BlogCat = {
    FRAME_SIZE: 50,
    SCALE: 2, // 100x100 px
    // Změň na lokální cestu (např. '/assets/cat/'), pokud si obrázky stáhneš do blogu
    BASE_PATH: 'https://myscriptorium.cz/cat/', 

    SPRITES: {
        idle:      { file: 'Cat-2-Idle.png',       frames: 10, fps: 8 },
        walk:      { file: 'Cat-2-Walk.png',       frames: 8,  fps: 10 },
        sitting:   { file: 'Cat-2-Sitting.png',    frames: 1,  fps: 1 },
        sleeping:  { file: 'Cat-2-Sleeping1.png',  frames: 1,  fps: 1 },
        laying:    { file: 'Cat-2-Laying.png',     frames: 8,  fps: 6 },
        meow:      { file: 'Cat-2-Meow.png',       frames: 4,  fps: 8 },
        stretching:{ file: 'Cat-2-Stretching.png', frames: 13, fps: 8 },
    },

    el: null,
    state: 'idle',
    currentFrame: 0,
    posX: 100,
    posY: 100,
    facingLeft: false,

    init: function() {
        if (document.getElementById('blog-cat')) return;

        // Vytvoření elementu kočky
        this.el = document.createElement('div');
        this.el.id = 'blog-cat';
        this.el.style.cssText = `
            position: absolute;
            width: ${this.FRAME_SIZE * this.SCALE}px;
            height: ${this.FRAME_SIZE * this.SCALE}px;
            background-repeat: no-repeat;
            background-size: auto ${this.FRAME_SIZE * this.SCALE}px;
            image-rendering: pixelated;
            cursor: pointer;
            z-index: 9999;
            transition: left 2.5s ease-in-out, top 2.5s ease-in-out;
            pointer-events: auto;
        `;
        
        // Kliknutí na kočku
        this.el.addEventListener('click', () => this.onClick());

        // Přidání do stránky (ideálně do kontejneru s obsahem, aby se dobře scrollovala)
        document.body.appendChild(this.el);

        // Počáteční umístění (někde v aktuálním výhledu čtenáře)
        this.teleportToView();
        
        this.startFrameLoop();
        this.scheduleMove();
    },

    updateSprite: function() {
        if (!this.el) return;
        const s = this.SPRITES[this.state] || this.SPRITES.idle;
        const frameX = this.currentFrame * this.FRAME_SIZE * this.SCALE;
        this.el.style.backgroundImage = `url('${this.BASE_PATH}${s.file}')`;
        this.el.style.backgroundPosition = `-${frameX}px 0px`;
        this.el.style.transform = this.facingLeft ? 'scaleX(-1)' : 'scaleX(1)';
    },

    startFrameLoop: function() {
        const tick = () => {
            const s = this.SPRITES[this.state] || this.SPRITES.idle;
            const delay = 1000 / s.fps;

            this.currentFrame = (this.currentFrame + 1) % s.frames;
            this.updateSprite();

            setTimeout(tick, delay);
        };
        tick();
    },

    teleportToView: function() {
        // Nastaví kočku někam do aktuálně viditelné části stránky
        const viewTop = window.scrollY;
        const viewHeight = window.innerHeight;
        const viewWidth = window.innerWidth;

        this.posX = 20 + Math.random() * (viewWidth - 120);
        this.posY = viewTop + 50 + Math.random() * (viewHeight - 150);
        
        this.el.style.transition = 'none'; // Bez animace
        this.el.style.left = `${this.posX}px`;
        this.el.style.top = `${this.posY}px`;
        
        // Force reflow
        void this.el.offsetWidth;
        this.el.style.transition = 'left 2.5s ease-in-out, top 2.5s ease-in-out';
    },

    scheduleMove: function() {
        // Pohyb každých 15 až 40 vteřin
        const delay = 15000 + Math.random() * 25000;
        setTimeout(() => {
            this.moveToNewPosition();
            this.scheduleMove();
        }, delay);
    },

    moveToNewPosition: function() {
        // Kočka by se měla zdržovat poblíž toho, co hráč čte
        const viewTop = window.scrollY;
        const viewHeight = window.innerHeight;
        const viewWidth = document.body.clientWidth;

        const newX = 20 + Math.random() * (viewWidth - 120);
        // Pohybuje se lehce nad nebo pod aktuální obrazovku, aby to působilo živě
        const newY = Math.max(0, viewTop - 100 + Math.random() * (viewHeight + 200));

        this.facingLeft = newX < this.posX;
        this.posX = newX;
        this.posY = newY;

        this.setState('walk');
        this.el.style.left = `${this.posX}px`;
        this.el.style.top = `${this.posY}px`;

        // Po dokončení přesunu si lehne nebo sedne
        setTimeout(() => {
            this.setState('idle');
            setTimeout(() => {
                const r = Math.random();
                if (r < 0.4)      this.setState('sitting');
                else if (r < 0.7) this.setState('laying');
            }, 3000);
        }, 2500); // odpovídá CSS transition délce
    },

    onClick: function() {
        // Mňouknutí při kliknutí
        this.setState('meow');
        setTimeout(() => {
            this.setState('idle');
        }, 2000);
    },

    setState: function(state) {
        if (!this.SPRITES[state]) return;
        this.state = state;
        this.currentFrame = 0;
        this.updateSprite();
    }
};

// Spustit kočku jakmile je stránka načtená
window.addEventListener('DOMContentLoaded', () => {
    BlogCat.init();
});
