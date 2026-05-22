function typeWriter(text, element, speed = 70) {
    let i = 0;
    element.textContent = '';
    const timer = setInterval(() => {
        if (i < text.length) {
            element.textContent += text.charAt(i);
            i++;
        } else {
            clearInterval(timer);
            blinkCursor(element);
        }
    }, speed);
}

function blinkCursor(element) {
    const cursor = document.createElement('span');
    cursor.className = 'cursor';
    cursor.textContent = '_';
    element.appendChild(cursor);
    setInterval(() => {
        cursor.style.opacity = cursor.style.opacity === '0' ? '1' : '0';
    }, 500);
}

function typeCode() {
    const codeText = `> Загрузка профиля...
> Успешно: Solven Vandermirant
> Статус: Онлайн`;
    const el = document.getElementById('typingCode');
    if(el) typeWriter(codeText, el, 50);
}

document.addEventListener("DOMContentLoaded", () => {
    const tw = document.getElementById("typewriter");
    if(tw) typeWriter("Solven • Пустота", tw, 100);
    setTimeout(typeCode, 1000);
});