/**
 * Основной модуль приложения FlappyCoin
 * Управляет инициализацией, переключением экранов и глобальным состоянием
 */

// Глобальное состояние приложения
const appState = {
    isInitialized: false,
    userData: null,
    socket: null,
    screenHistory: [],
    currentScreen: null,
    container: null
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
        initTelegramFeatures();
        
        // Получаем данные пользователя
        appState.userData = getUserData();
        if (!appState.userData) {
            appLogger.error('Не удалось получить данные пользователя');
            showError('Не удалось получить данные пользователя');
            return;
        }
        
        // Находим контейнер приложения
        appState.container = document.getElementById('app-container');
        if (!appState.container) {
            appLogger.error('Не найден контейнер приложения');
            return;
        }
        
        // Инициализируем WebSocket соединение
        initSocketConnection();
        
        // Настраиваем обработчики событий приложения
        setupAppEvents();
        
        // Отмечаем приложение как инициализированное
        appState.isInitialized = true;
        
        // Показываем начальный экран
        showInitialScreen();
        
        appLogger.info('Приложение успешно инициализировано');
    } catch (error) {
        appLogger.error('Ошибка при инициализации приложения', { error: error.message });
        showError('Ошибка при инициализации приложения: ' + error.message);
    }
}

/**
 * Инициализирует функции Telegram
 */
function initTelegramFeatures() {
    try {
        // Инициализируем полноэкранный режим
        if (typeof initTelegramFullscreen === 'function') {
            initTelegramFullscreen();
        } else {
            appLogger.error('Функция инициализации полноэкранного режима не найдена');
        }
        
        // Настраиваем обработчики событий Telegram
        if (typeof setupTelegramEvents === 'function') {
            setupTelegramEvents();
        } else {
            appLogger.warn('Функция настройки событий Telegram не найдена');
        }
        
        appLogger.info('Функции Telegram инициализированы');
    } catch (error) {
        appLogger.error('Ошибка при инициализации функций Telegram', { error: error.message });
    }
}

/**
 * Инициализирует соединение по WebSocket
 */
function initSocketConnection() {
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
}

/**
 * Определяет и показывает начальный экран на основе URL-параметров
 */
function showInitialScreen() {
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
        if (appState.currentScreen && appState.currentScreen.id === screenId) {
            appLogger.debug('Обновление текущего экрана', { screenId });
            appState.currentScreen.component.init(appState.container, { 
                ...params, 
                userData: appState.userData 
            });
            return;
        }
        
        // Очищаем текущий экран, если он есть
        cleanupCurrentScreen();
        
        // Сохраняем историю переходов
        if (appState.currentScreen) {
            appState.screenHistory.push(appState.currentScreen.id);
        }
        
        // Обновляем текущий экран
        appState.currentScreen = screens[screenId];
        
        // Показываем выбранный экран
        const screenElement = document.getElementById(screenId);
        if (screenElement) {
            screenElement.style.display = 'block';
        }
        
        // Инициализируем новый экран
        appState.currentScreen.component.init(appState.container, { 
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
 * Очищает ресурсы текущего экрана
 */
function cleanupCurrentScreen() {
    if (appState.currentScreen && appState.currentScreen.component.cleanup) {
        appState.currentScreen.component.cleanup();
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