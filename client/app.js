/**
 * Основной модуль приложения FlappyCoin
 * Управляет инициализацией, переключением экранов и глобальным состоянием
 */

// Глобальные переменные приложения
let currentScreen = null;
let userData = null;
let appContainer = null;

// Состояние приложения
const appState = {
    isInitialized: false,
    userData: null,
    socket: null,
    screenHistory: []
};

// Доступные экраны приложения
const screens = {
    mainMenu: {
        id: 'mainMenu',
        component: window.mainMenuComponent,
        requiresAuth: true
    },
    room: {
        id: 'room',
        component: window.roomComponent,
        requiresAuth: true
    }
};

/**
 * Инициализирует приложение
 */
function initApp() {
    appLogger.info('Инициализация приложения FlappyCoin');
    
    try {
        // Проверяем, что приложение не инициализировано дважды
        if (appState.isInitialized) {
            appLogger.warn('Попытка повторной инициализации приложения');
            return;
        }
        
        // Инициализация полноэкранного режима для Telegram Mini App
        if (typeof initTelegramFullscreen === 'function') {
            initTelegramFullscreen();
        } else {
            appLogger.error('Функция инициализации полноэкранного режима не найдена');
        }
        
        // Получаем данные пользователя
        appState.userData = getUserData();
        if (!appState.userData) {
            appLogger.error('Не удалось получить данные пользователя');
            showError('Не удалось получить данные пользователя');
            return;
        }
        
        // Находим контейнер приложения
        appContainer = document.getElementById('app-container');
        if (!appContainer) {
            appLogger.error('Не найден контейнер приложения');
            return;
        }
        
        // Инициализируем WebSocket соединение
        try {
            appLogger.info('Инициализация WebSocket соединения');
            appState.socket = socketService.initialize(appState.userData);
            
            // Проверяем соединение через таймаут
            setTimeout(() => {
                if (!socketService.isConnected()) {
                    appLogger.warn('WebSocket соединение не установлено после инициализации, повторная попытка');
                    // Повторная попытка подключения
                    appState.socket = socketService.initialize(appState.userData);
                }
            }, 2000);
            
        } catch (socketError) {
            appLogger.error('Ошибка при инициализации WebSocket', { error: socketError.message });
            // Продолжаем инициализацию приложения даже при ошибке соединения
        }
        
        // Отмечаем приложение как инициализированное
        appState.isInitialized = true;
        
        // Получаем данные из URL для возможного прямого перехода
        const urlParams = new URLSearchParams(window.location.search);
        const screenFromUrl = urlParams.get('screen');
        const roomId = urlParams.get('roomId');
        
        // Показываем начальный экран
        if (screenFromUrl === 'room' && roomId) {
            showScreen('room', { roomId });
        } else {
            showScreen('mainMenu');
        }
        
        appLogger.info('Приложение успешно инициализировано');
    } catch (error) {
        appLogger.error('Ошибка при инициализации приложения', { error: error.message });
        showError('Ошибка при инициализации приложения: ' + error.message);
    }
}

/**
 * Показывает указанный экран
 * @param {string} screenId - Идентификатор экрана
 * @param {Object} params - Параметры для инициализации экрана
 */
function showScreen(screenId, params = {}) {
    try {
        // Проверяем, что приложение инициализировано
        if (!appState.isInitialized) {
            appLogger.error('Попытка показать экран до инициализации приложения');
            return;
        }
        
        // Проверяем, что экран существует
        if (!screens[screenId] || !screens[screenId].component) {
            appLogger.error('Экран не найден', { screenId });
            return;
        }
        
        // Скрываем все экраны
        const allScreens = document.querySelectorAll('.screen');
        allScreens.forEach(screen => {
            screen.style.display = 'none';
        });
        
        // Если текущий экран тот же самый, просто обновляем его
        if (currentScreen && currentScreen.id === screenId) {
            appLogger.debug('Обновление текущего экрана', { screenId });
            currentScreen.component.init(appContainer, { 
                ...params, 
                userData: appState.userData 
            });
            return;
        }
        
        // Очищаем текущий экран, если он есть
        if (currentScreen && currentScreen.component.cleanup) {
            currentScreen.component.cleanup();
        }
        
        // Сохраняем историю переходов
        if (currentScreen) {
            appState.screenHistory.push(currentScreen.id);
        }
        
        // Обновляем текущий экран
        currentScreen = screens[screenId];
        
        // Показываем выбранный экран
        const screenElement = document.getElementById(screenId);
        if (screenElement) {
            screenElement.style.display = 'block';
        }
        
        // Инициализируем новый экран
        currentScreen.component.init(appContainer, { 
            ...params, 
            userData: appState.userData 
        });
        
        // Обновляем URL без перезагрузки страницы
        updateUrl(screenId, params);
        
        appLogger.info('Показан экран', { screenId });
    } catch (error) {
        appLogger.error('Ошибка при показе экрана', { 
            screenId, 
            error: error.message 
        });
        showError('Ошибка при отображении экрана: ' + error.message);
    }
}

/**
 * Обновляет URL без перезагрузки страницы
 * @param {string} screenId - Идентификатор экрана
 * @param {Object} params - Параметры URL
 */
function updateUrl(screenId, params = {}) {
    // Создаем объект URL из текущего адреса
    const url = new URL(window.location.href);
    
    // Устанавливаем параметр экрана
    url.searchParams.set('screen', screenId);
    
    // Добавляем остальные параметры
    for (const [key, value] of Object.entries(params)) {
        url.searchParams.set(key, value);
    }
    
    // Обновляем URL без перезагрузки страницы
    window.history.replaceState({}, '', url.toString());
}

/**
 * Возвращается на предыдущий экран
 */
function goBack() {
    if (appState.screenHistory.length > 0) {
        const prevScreen = appState.screenHistory.pop();
        showScreen(prevScreen);
    } else {
        showScreen('mainMenu');
    }
}

/**
 * Показывает сообщение об ошибке
 * @param {string} message - Текст ошибки
 */
function showError(message) {
    appLogger.error('Отображение ошибки', { message });
    
    // Создаем элемент для отображения ошибки
    const errorContainer = document.createElement('div');
    errorContainer.className = 'error-container';
    errorContainer.innerHTML = `
        <div class="error-message">
            <h3>Ошибка</h3>
            <p>${message}</p>
            <button id="error-close">Закрыть</button>
        </div>
    `;
    
    // Добавляем стили
    const style = document.createElement('style');
    style.textContent = `
        .error-container {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background-color: rgba(0, 0, 0, 0.7);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 9999;
        }
        .error-message {
            background-color: #f44336;
            color: white;
            padding: 20px;
            border-radius: 5px;
            max-width: 80%;
            text-align: center;
        }
        .error-message h3 {
            margin-top: 0;
        }
        .error-message button {
            background-color: white;
            color: #f44336;
            border: none;
            padding: 10px 20px;
            margin-top: 10px;
            border-radius: 3px;
            cursor: pointer;
        }
    `;
    document.head.appendChild(style);
    
    // Добавляем контейнер в body
    document.body.appendChild(errorContainer);
    
    // Обработчик для кнопки закрытия
    const closeButton = document.getElementById('error-close');
    if (closeButton) {
        closeButton.addEventListener('click', () => {
            errorContainer.remove();
        });
    }
}

/**
 * Обрабатывает системные события приложения
 */
function setupAppEvents() {
    // Обработчик для кнопки "Назад" в Telegram
    if (window.tgApp && window.tgApp.BackButton) {
        window.tgApp.BackButton.onClick(goBack);
    }
    
    // Обработчик для закрытия приложения
    window.addEventListener('beforeunload', () => {
        appLogger.info('Приложение закрывается');
        
        // Отключаем сокет при закрытии приложения
        if (appState.socket) {
            appState.socket.disconnect();
        }
    });
    
    // Обработчик для кнопки "Назад" браузера
    window.addEventListener('popstate', (event) => {
        // Получаем ID экрана из URL
        const urlParams = new URLSearchParams(window.location.search);
        const screenId = urlParams.get('screen') || 'mainMenu';
        
        // Показываем экран
        showScreen(screenId);
        
        // Предотвращаем стандартное поведение
        event.preventDefault();
    });
}

// Экспортируем функции в глобальное пространство имен
window.app = {
    init: initApp,
    showScreen: showScreen,
    goBack: goBack,
    showError: showError,
    getState: () => ({ ...appState })
};

// Добавляем обработчик для инициализации после полной загрузки DOM
document.addEventListener('DOMContentLoaded', function() {
    appLogger.info('DOM загружен, инициализация FlappyCoin...');
    
    // Инициализировать приложение
    if (typeof app !== 'undefined' && typeof app.init === 'function') {
        app.init();
        appLogger.info('Приложение инициализировано');
    } else {
        appLogger.error('Объект app не найден или не содержит метод init');
        
        // Показываем сообщение об ошибке
        const container = document.getElementById('app-container');
        if (container) {
            container.innerHTML = `
                <div class="error-message" style="padding:20px;color:white;background-color:#f44336;margin:20px;border-radius:5px;text-align:center;">
                    <h3>Ошибка инициализации</h3>
                    <p>Не удалось инициализировать приложение. Попробуйте обновить страницу.</p>
                </div>
            `;
        }
    }
    
    // Скрываем загрузочный индикатор после инициализации
    setTimeout(() => {
        const loadingOverlay = document.getElementById('loading-overlay');
        if (loadingOverlay) {
            loadingOverlay.classList.add('loaded');
            setTimeout(() => {
                loadingOverlay.style.display = 'none';
            }, 500);
        }
    }, 1000);
}); 