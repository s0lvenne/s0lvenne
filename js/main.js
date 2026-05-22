console.log("%cSolven • Пустота", "color: #ff0040; font-family: 'JetBrains Mono'; font-size: 14px;");

// === Скролл ровно 1 минуту (60 секунд) непрерывно вверх-вниз ===
let erraticStartTime = null;
let lastScrollTime = Date.now();
let lastScrollY = window.scrollY;
let lastDirection = 0;
let directionChanges = 0;

window.addEventListener('scroll', () => {
    const now = Date.now();
    const currentScrollY = window.scrollY;
    const diff = currentScrollY - lastScrollY;

    // Если пауза между скроллами больше 1.5 секунды — сбрасываем таймер
    if (now - lastScrollTime > 1500) {
        erraticStartTime = null;
        directionChanges = 0;
    }

    if (Math.abs(diff) > 10) {
        const currentDirection = diff > 0 ? 1 : -1;
        if (currentDirection !== lastDirection) {
            directionChanges++;
            lastDirection = currentDirection;

            if (!erraticStartTime) {
                erraticStartTime = now;
            }
        }
    }

    // Если скроллит непрерывно 60 секунд (60000 мс) и часто менял направление
    if (erraticStartTime && (now - erraticStartTime >= 60000) && directionChanges > 30) {
        const msg = document.getElementById('tripMessage');
        msg.classList.add('show');
        setTimeout(() => msg.classList.remove('show'), 3000);
        
        // Сброс
        erraticStartTime = null;
        directionChanges = 0;
    }

    lastScrollTime = now;
    lastScrollY = currentScrollY;
});

// === Модальные окна ===
function showTranslation() {
    document.getElementById('translateModal').classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closeTranslate() {
    document.getElementById('translateModal').classList.remove('active');
    document.body.style.overflow = '';
}

function showAppInfo(appId) {
    const modal = document.getElementById('appModal');
    const title = document.getElementById('appTitle');
    const info = document.getElementById('appInfo');
    
    // Ищем приложение в базе из apps.js
    const app = myApps.find(a => a.id === appId);
    if (app) {
        title.textContent = app.name;
        info.innerHTML = app.details || 'Нет информации.';
        modal.classList.add('active');
        document.body.style.overflow = 'hidden';
    }
}

function closeAppInfo() {
    document.getElementById('appModal').classList.remove('active');
    document.body.style.overflow = '';
}

// === Таймеры ===
function updateAgeInHours() {
    const birthDate = new Date('2008-09-03T00:00:00');
    const now = new Date();
    const diffMs = now - birthDate;
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const formatted = hours.toLocaleString();
    
    document.getElementById('ageHours').textContent = formatted;
    document.getElementById('ageHoursFooter').textContent = formatted;
}

function updateCountdown() {
    const now = new Date();
    let nextBirthday = new Date(now.getFullYear(), 8, 3);
    if (nextBirthday < now) nextBirthday.setFullYear(nextBirthday.getFullYear() + 1);
    
    const diffMs = nextBirthday - now;
    const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const mins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    
    document.getElementById('countdown').textContent = `${days}д ${hours}ч ${mins}м`;
}

// === Посетители ===
function loadRealVisitors() {
    fetch('https://api.shields.io/endpoint?url=https%3A%2F%2Fraw.githubusercontent.com%2Fsolven%2Fvisitor-counter%2Fmain%2Fdata.json')
        .then(r => r.json())
        .then(data => {
            const visitors = data.value || '?';
            document.getElementById('visitors').textContent = visitors;
            document.getElementById('visitorsFooter').textContent = visitors;
        })
        .catch(() => {
            document.getElementById('visitors').textContent = '?';
            document.getElementById('visitorsFooter').textContent = '?';
        });
}

// === Инициализация ===
document.addEventListener("DOMContentLoaded", () => {
    updateAgeInHours();
    updateCountdown();
    setInterval(updateCountdown, 60000);
    loadRealVisitors();
    
    // Запуск рендера приложений
    if (typeof renderApps === 'function') {
        renderApps();
    }

    const navToggle = document.getElementById('navToggle');
    const navLinks = document.getElementById('navLinks');

    if (navToggle) {
        navToggle.addEventListener('click', () => {
            navLinks.classList.toggle('active');
        });
    }
});