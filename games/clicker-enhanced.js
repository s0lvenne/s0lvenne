let clicks = 0;
let upgrades = {
    autoClicker: { level: 0, cost: 10 },
    clickPower: { level: 0, cost: 15 }
};

function initClicker() {
    const container = document.getElementById('clicker-container');
    container.innerHTML = `
        <div class="clicker-game">
            <h3>Кликов: <span id="click-count">0</span></h3>
            <button id="main-click-btn" class="click-btn">⚡ Клик!</button>
            
            <div class="upgrades">
                <h4>Улучшения:</h4>
                <button id="buy-auto" class="upgrade-btn">
                    Автокликер Lvl ${upgrades.autoClicker.level} — ${upgrades.autoClicker.cost} кликов
                </button>
                <button id="buy-power" class="upgrade-btn">
                    Сила клика Lvl ${upgrades.clickPower.level} — ${upgrades.clickPower.cost} кликов
                </button>
            </div>
            
            <div class="clicker-stats">
                <p>Автокликер: <strong>${upgrades.autoClicker.level}</strong></p>
                <p>Сила клика: <strong>x${1 + upgrades.clickPower.level * 0.5}</strong></p>
            </div>
        </div>
    `;

    const countSpan = document.getElementById('click-count');
    const mainBtn = document.getElementById('main-click-btn');
    const buyAuto = document.getElementById('buy-auto');
    const buyPower = document.getElementById('buy-power');

    // Загрузка сохранений
    loadClickerProgress();

    function updateDisplay() {
        countSpan.textContent = clicks;
        buyAuto.textContent = `Автокликер Lvl ${upgrades.autoClicker.level} — ${upgrades.autoClicker.cost} кликов`;
        buyPower.textContent = `Сила клика Lvl ${upgrades.clickPower.level} — ${upgrades.clickPower.cost} кликов`;
        
        document.querySelector('.clicker-stats strong:nth-child(1)').textContent = upgrades.autoClicker.level;
        document.querySelector('.clicker-stats strong:nth-child(2)').textContent = (1 + upgrades.clickPower.level * 0.5).toFixed(1);
    }

    mainBtn.onclick = () => {
        const power = 1 + upgrades.clickPower.level * 0.5;
        clicks += power;
        updateDisplay();
        saveClickerProgress();
    };

    buyAuto.onclick = () => {
        if (clicks >= upgrades.autoClicker.cost) {
            clicks -= upgrades.autoClicker.cost;
            upgrades.autoClicker.level++;
            upgrades.autoClicker.cost = Math.floor(upgrades.autoClicker.cost * 1.8);
            startAutoClicker();
            updateDisplay();
            saveClickerProgress();
        }
    };

    buyPower.onclick = () => {
        if (clicks >= upgrades.clickPower.cost) {
            clicks -= upgrades.clickPower.cost;
            upgrades.clickPower.level++;
            upgrades.clickPower.cost = Math.floor(upgrades.clickPower.cost * 2.1);
            updateDisplay();
            saveClickerProgress();
        }
    };

    function startAutoClicker() {
        if (window.autoClickInterval) clearInterval(window.autoClickInterval);
        window.autoClickInterval = setInterval(() => {
            if (upgrades.autoClicker.level > 0) {
                const power = 1 + upgrades.clickPower.level * 0.5;
                clicks += power * upgrades.autoClicker.level;
                updateDisplay();
                saveClickerProgress();
            }
        }, 1000);
    }

    startAutoClicker();
    updateDisplay();
}

function saveClickerProgress() {
    const data = {
        clicks,
        upgrades,
        timestamp: Date.now()
    };
    localStorage.setItem('clickerSave', JSON.stringify(data));

    // Обновление рекорда
    if (clicks > (localStorage.getItem('clickerRecord') || 0)) {
        saveRecord('clicker', Math.floor(clicks));
    }
}

function loadClickerProgress() {
    const saved = localStorage.getItem('clickerSave');
    if (saved) {
        const data = JSON.parse(saved);
        clicks = data.clicks;
        upgrades = data.upgrades;
    } else {
        clicks = 0;
        upgrades = { autoClicker: { level: 0, cost: 10 }, clickPower: { level: 0, cost: 15 } };
    }
}