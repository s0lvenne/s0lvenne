const symbols = ['', '', '', '○', '●', '', '', '■'];
let cards = [];
let flippedCards = [];
let matchedPairs = 0;
let startTime = null;
let gameTimer = null;
function initMemoryGame() {
    const container = document.getElementById('memory-container');
    container.innerHTML = `
        <div class="memory-game">
            <div class="memory-header">
                <div>Пар найдено: <span id="pairs">0/4</span></div>
                <div>Время: <span id="timer">00:00</span></div>
            </div>
            <div class="memory-grid" id="memory-grid"></div>
            <button id="restart-memory" class="restart-btn"> Перезапустить</button>
        </div>
    `;
    resetMemoryGame();
    document.getElementById('restart-memory').onclick = resetMemoryGame;
}
function resetMemoryGame() {
    const grid = document.getElementById('memory-grid');
    grid.innerHTML = '';
    cards = [...symbols.slice(0, 4), ...symbols.slice(0, 4)];
    cards = shuffle(cards);
    flippedCards = [];
    matchedPairs = 0;
    document.getElementById('pairs').textContent = '0/4';
    if (gameTimer) clearInterval(gameTimer);
    startTime = Date.now();
    updateTimer();
    gameTimer = setInterval(updateTimer, 1000);
    for (let i = 0; i < 8; i++) {
        const card = document.createElement('div');
        card.className = 'memory-card';
        card.dataset.index = i;
        card.innerHTML = '<div class="card-inner"><div class="card-front">?</div><div class="card-back">' + cards[i] + '</div></div>';
        card.onclick = () => flipCard(card);
        grid.appendChild(card);
    }
}
function flipCard(card) {
    if (flippedCards.length === 2 || card.classList.contains('flipped') || card.classList.contains('matched')) {
        return;
    }
    card.classList.add('flipped');
    flippedCards.push(card);
    if (flippedCards.length === 2) {
        checkMatch();
    }
}
function checkMatch() {
    const [card1, card2] = flippedCards;
    const symbol1 = card1.querySelector('.card-back').textContent;
    const symbol2 = card2.querySelector('.card-back').textContent;
    if (symbol1 === symbol2) {
        card1.classList.add('matched');
        card2.classList.add('matched');
        matchedPairs++;
        document.getElementById('pairs').textContent = `${matchedPairs}/4`;
        if (matchedPairs === 4) {
            clearInterval(gameTimer);
            const finalTime = document.getElementById('timer').textContent;
            alert(` Победа! Время: ${finalTime}`);
            saveRecord('memory', finalTime);
        }
    } else {
        setTimeout(() => {
            card1.classList.remove('flipped');
            card2.classList.remove('flipped');
        }, 1000);
    }
    flippedCards = [];
}
function updateTimer() {
    const elapsed = Math.floor((Date.now() - startTime) / 1000);
    document.getElementById('timer').textContent = formatTime(elapsed);
}
function shuffle(array) {
    return array.sort(() => Math.random() - 0.5);
}