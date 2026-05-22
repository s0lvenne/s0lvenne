// ================================================================
// ПРИЛОЖЕНИЯ — добавляй сколько угодно записей!
//
// ОДНА ССЫЛКА:
//   links: { url: 'https://...', btn: 'Скачать' }
//
// НЕСКОЛЬКО ССЫЛОК (кнопка разделится автоматически):
//   links: [
//       { url: 'https://github.com/...', btn: 'GitHub' },
//       { url: 'https://drive.google.com/...', btn: 'Google Drive' }
//   ]
// ================================================================

const myApps = [
    {
        name: 'Nova Browser',
        desc: 'Минималистичный браузер. Быстрый запуск, без лишнего мусора.',
        links: { url: 'https://www.youtube.com/watch?v=w8EknKI96vQ&time_continue=3&source_ve_path=MjM4NTE&embeds_referring_euri=https%3A%2F%2Fwww.bing.com%2F&embeds_referring_origin=https%3A%2F%2Fwww.bing.com&themeRefresh=1', btn: 'Временно не допустно' }
    },
    {
        name: 'MicMaster',
        desc: 'Утилита для настройки микрофона',
        links: [
            { url: 'https://www.youtube.com/watch?v=w8EknKI96vQ&time_continue=3&source_ve_path=MjM4NTE&embeds_referring_euri=https%3A%2F%2Fwww.bing.com%2F&embeds_referring_origin=https%3A%2F%2Fwww.bing.com&themeRefresh=1', btn: 'Временно не допустно' },
        ]
    },

    // ——— ДОБАВЛЯЙ НОВЫЕ ПРИЛОЖЕНИЯ СЮДА ———
    // Одна кнопка:
    // {
    //     name: 'Название',
    //     desc: 'Описание',
    //     links: { url: 'https://...', btn: 'Открыть' }
    // },
    //
    // Несколько кнопок:
    // {
    //     name: 'Название',
    //     desc: 'Описание',
    //     links: [
    //         { url: 'https://github.com/...', btn: 'GitHub' },
    //         { url: 'https://drive.google.com/...', btn: 'Google Drive' }
    //     ]
    // },

];

// ================================================================
// Рендер карточек — НЕ ТРОГАЙ этот код
// ================================================================
function renderApps() {
    const container = document.getElementById('appsContainer');
    if (!container) return;

    if (myApps.length === 0) {
        container.innerHTML = `
            <p style="color: var(--gray); text-align: center; grid-column: 1/-1; padding: 40px 0;">
                Приложений пока нет.
            </p>`;
        return;
    }

    container.innerHTML = myApps.map((app, i) => {
        // Иконка — только если передан путь к картинке
        const iconHtml = app.icon
            ? `<img src="${app.icon}" class="app-img-icon" alt="${app.name}">`
            : '';

        // Кнопки: один объект → одна кнопка, массив → несколько
        const linksArr = Array.isArray(app.links) ? app.links : [app.links];
        const multiple = linksArr.length > 1;

        const btnsHtml = linksArr.map(link => `
            <a href="${link.url}" target="_blank" rel="noopener noreferrer"
               class="app-btn${multiple ? ' app-btn--split' : ''}">
                ${link.btn || 'Открыть'}
            </a>`).join('');

        return `
        <div class="app-card" style="animation-delay: ${i * 0.08}s">
            ${iconHtml}
            <h3>${app.name}</h3>
            <p>${app.desc || ''}</p>
            <div class="app-btns${multiple ? ' app-btns--multiple' : ''}">
                ${btnsHtml}
            </div>
        </div>`;
    }).join('');
}
