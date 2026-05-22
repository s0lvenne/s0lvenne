// Функция для форматирования времени
function formatTime(seconds) {
    const mins = Math.floor(seconds / 60).toString().padStart(2, '0');
    const secs = (seconds % 60).toString().padStart(2, '0');
    return `${mins}:${secs}`;
}

// Сохранение рекорда
function saveRecord(game, value) {
    localStorage.setItem(`${game}Record`, value);
    restoreRecords(); // обновляем отображение
}