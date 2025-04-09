/**
 * Файл с общими функциями для работы с Telegram Mini App
 */

// Получаем доступ к Telegram WebApp API
let tgApp = window.Telegram.WebApp;

// В начале файла telegram.js после объявления tgApp
tgApp.expand();
if (typeof tgApp.enableClosingConfirmation === 'function') {
    tgApp.enableClosingConfirmation();
} else if (typeof tgApp.disableClosingConfirmation === 'function') {
    tgApp.disableClosingConfirmation();
}

// При возможности также проверить версию и вызвать новый метод
if (tgApp.isVersionAtLeast && tgApp.isVersionAtLeast('6.9') && tgApp.requestFullscreen) {
    tgApp.requestFullscreen();
}

/**
 * Инициализация полноэкранного режима для Telegram Mini App
 * Вызывает все необходимые функции для правильного отображения
 */
function initTelegramFullscreen() {
    if (!tgApp) {
        console.warn('Telegram WebApp API не доступен');
        return false;
    }
    
    try {
        // Полноэкранный режим
        tgApp.expand();
        
        // Отключаем кнопку "Назад"
        if (tgApp.BackButton) {
            tgApp.BackButton.hide();
        }
        
        // Отключаем жест для закрытия
        if (typeof tgApp.disableClosingConfirmation === 'function') {
            tgApp.disableClosingConfirmation();
        }
        
        // iOS-специфичная настройка полноэкранного режима
        if (tgApp.platform === 'ios') {
            // При запуске приложения
            setTimeout(() => {
                // Устанавливаем правильную высоту для полноэкранного режима
                const viewportHeight = window.innerHeight;
                if (typeof tgApp.setViewportHeight === 'function') {
                    tgApp.setViewportHeight(viewportHeight);
                }
                
                // Запрос на полноэкранный режим через requestViewport
                if (typeof tgApp.requestViewport === 'function') {
                    tgApp.requestViewport({
                        height: viewportHeight,
                        is_expanded: true,
                        is_state_stable: true
                    });
                }
                
                // Настройка CSS для iOS
                const viewport = document.querySelector('meta[name="viewport"]');
                if (viewport) {
                    viewport.setAttribute('content', 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover');
                }
                
                // Хак для принудительного обновления размеров
                document.body.style.height = `${viewportHeight}px`;
            }, 100);
        }
        
        // Обработчик изменения размера окна
        window.addEventListener('resize', () => {
            const height = window.innerHeight;
            
            // Обновляем высоту для полноэкранного режима
            if (typeof tgApp.setViewportHeight === 'function') {
                tgApp.setViewportHeight(height);
            }
            
            // Обновляем CSS высоту для правильного отображения
            document.body.style.height = `${height}px`;
            
            // Запрос на обновление полноэкранного режима
            if (tgApp.platform === 'ios' && typeof tgApp.requestViewport === 'function') {
                tgApp.requestViewport({
                    height: height,
                    is_expanded: true,
                    is_state_stable: true
                });
            }
        });
        
        console.log('Успешная инициализация полноэкранного режима');
        return true;
    } catch (error) {
        console.error('Ошибка при инициализации полноэкранного режима:', error);
        return false;
    }
}

/**
 * Получает данные пользователя из Telegram или localStorage
 * @returns {Object} Данные пользователя или null
 */
function getUserData() {
    let userData = null;
    
    try {
        // Пытаемся получить из Telegram
        if (tgApp && tgApp.initDataUnsafe && tgApp.initDataUnsafe.user) {
            userData = {
                id: tgApp.initDataUnsafe.user.id,
                username: tgApp.initDataUnsafe.user.username || tgApp.initDataUnsafe.user.first_name || `User${tgApp.initDataUnsafe.user.id}`,
                first_name: tgApp.initDataUnsafe.user.first_name,
                last_name: tgApp.initDataUnsafe.user.last_name,
                photo_url: tgApp.initDataUnsafe.user.photo_url
            };
            
            // Сохраняем в localStorage для будущего использования
            localStorage.setItem('userData', JSON.stringify(userData));
            
            if (window.appLogger) {
                window.appLogger.info('Получены данные пользователя из Telegram', {
                    userId: userData.id,
                    username: userData.username
                });
            }
        } else {
            // Пытаемся восстановить из localStorage
            const savedUserData = localStorage.getItem('userData');
            if (savedUserData) {
                try {
                    userData = JSON.parse(savedUserData);
                    console.log('Восстановлены данные пользователя из localStorage');
                } catch (e) {
                    console.error('Ошибка при чтении данных пользователя:', e);
                }
            }
            
            // Если данных нет ни в Telegram, ни в localStorage
            if (!userData) {
                userData = {
                    id: "12345",
                    username: "TestUser",
                    first_name: "Test",
                    last_name: "User",
                    photo_url: null
                };
                
                console.warn('Приложение запущено вне Telegram Mini App, используются тестовые данные');
            }
        }
        
        return userData;
    } catch (error) {
        console.error('Ошибка при получении данных пользователя:', error);
        return null;
    }
}

/**
 * Безопасный вызов метода Telegram WebApp API
 * @param {Object} tgApp - Объект Telegram WebApp или его компонент
 * @param {string} methodName - Имя метода для вызова
 * @param {any} args - Аргументы для метода
 * @returns {*} Результат вызова метода или null при ошибке
 */
function safeCallTgMethod(tgApp, methodName, args) {
    try {
        if (!tgApp) {
            console.warn(`Telegram WebApp API не доступен`);
            return null;
        }
        
        if (typeof tgApp[methodName] !== 'function') {
            console.warn(`Метод ${methodName} не существует в Telegram WebApp API`);
            return null;
        }
        
        if (args === undefined) {
            return tgApp[methodName]();
        }
        
        return tgApp[methodName](args);
    } catch (error) {
        console.error(`Ошибка при вызове метода ${methodName}:`, error);
        return null;
    }
}

/**
 * Настраивает обработчики событий Telegram WebApp
 */
function setupTelegramEvents() {
    if (!tgApp) {
        console.warn('Telegram WebApp API не доступен');
        return false;
    }
    
    try {
        // Обработчик события закрытия приложения
        if (typeof tgApp.onEvent === 'function') {
            tgApp.onEvent('viewportChanged', handleViewportChanged);
            tgApp.onEvent('close', handleTelegramClose);
        }
        
        console.log('Успешная регистрация обработчиков событий Telegram');
        return true;
    } catch (error) {
        console.error('Ошибка при регистрации обработчиков событий Telegram:', error);
        return false;
    }
}

/**
 * Обработчик события изменения вьюпорта
 * @param {Object} eventData - Данные события
 */
function handleViewportChanged(eventData) {
    console.log('Изменение вьюпорта Telegram:', eventData);
    
    // Обновляем высоту для полноэкранного режима
    if (eventData && eventData.height) {
        document.body.style.height = `${eventData.height}px`;
    }
}

/**
 * Обработчик события закрытия приложения Telegram
 */
function handleTelegramClose() {
    console.log('Событие закрытия приложения Telegram');
    
    try {
        // Если игрок находится в комнате, отправляем уведомление о выходе
        const appState = window.app ? window.app.getState() : null;
        if (appState && appState.currentScreen && appState.currentScreen.id === 'room' && window.roomComponent) {
            // Вызываем функцию leaveRoom из компонента комнаты
            if (typeof window.roomComponent.exitRoom === 'function') {
                window.roomComponent.exitRoom();
            } else {
                // Пытаемся найти и выполнить функцию leaveRoom через window
                if (window.leaveRoom && typeof window.leaveRoom === 'function') {
                    window.leaveRoom();
                }
            }
            
            // Отключаем сокет перед закрытием
            if (window.socketService && typeof window.socketService.disconnect === 'function') {
                window.socketService.disconnect();
            }
        }
    } catch (error) {
        console.error('Ошибка при обработке закрытия приложения Telegram:', error);
    }
}

// Экспортируем функции в глобальный объект window
window.tgApp = tgApp;
window.initTelegramFullscreen = initTelegramFullscreen;
window.getUserData = getUserData;
window.safeCallTgMethod = safeCallTgMethod;
window.setupTelegramEvents = setupTelegramEvents;

// Автоматически инициализируем полноэкранный режим при загрузке скрипта
document.addEventListener('DOMContentLoaded', () => {
    initTelegramFullscreen();
    
    // Дополнительно пытаемся развернуть окно несколько раз с задержкой
    // Это может помочь в случаях, когда первый вызов не срабатывает
    setTimeout(() => {
        if (tgApp && tgApp.expand) {
            if (window.appLogger) window.appLogger.info('Повторный вызов expand() через 300мс');
            tgApp.expand();
        }
    }, 300);
    
    setTimeout(() => {
        if (tgApp && tgApp.expand) {
            if (window.appLogger) window.appLogger.info('Повторный вызов expand() через 1000мс');
            tgApp.expand();
        }
    }, 1000);
    
    // Хак для iOS - принудительно устанавливаем высоту
    setTimeout(() => {
        const height = window.innerHeight;
        document.body.style.height = `${height}px`;
        document.documentElement.style.height = `${height}px`;
        
        if (window.appLogger) window.appLogger.info('Установлена явная высота документа', { height });
    }, 500);
}); 