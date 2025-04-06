/**
 * Файл с общими функциями для работы с Telegram Mini App
 */

// Получаем доступ к Telegram WebApp API
const tgApp = window.Telegram?.WebApp;

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
        
        // Применяем цветовую тему Telegram
        applyTelegramTheme();
        
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
                username: tgApp.initDataUnsafe.user.username || `User${tgApp.initDataUnsafe.user.id}`,
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
 * Применяет цветовую тему Telegram к странице
 */
function applyTelegramTheme() {
    if (!tgApp) return;
    
    try {
        let bgColor, textColor, accentColor, secondaryColor;
        
        // Определяем основные цвета в зависимости от темы
        if (tgApp.colorScheme === 'dark') {
            // Темная тема
            bgColor = tgApp.themeParams?.bg_color || '#1E272E';
            textColor = tgApp.themeParams?.text_color || '#FFFFFF';
            accentColor = tgApp.themeParams?.button_color || '#3498DB';
            secondaryColor = tgApp.themeParams?.button_text_color || '#2ECC71';
            
            // Добавляем класс темной темы
            document.body.classList.add('dark-theme');
            document.body.classList.remove('light-theme');
        } else {
            // Светлая тема
            bgColor = tgApp.themeParams?.bg_color || '#FFFFFF';
            textColor = tgApp.themeParams?.text_color || '#222222';
            accentColor = tgApp.themeParams?.button_color || '#3498DB';
            secondaryColor = tgApp.themeParams?.button_text_color || '#2ECC71';
            
            // Добавляем класс светлой темы
            document.body.classList.add('light-theme');
            document.body.classList.remove('dark-theme');
        }
        
        // Применяем CSS переменные для использования в стилях
        document.documentElement.style.setProperty('--background-color', bgColor);
        document.documentElement.style.setProperty('--text-color', textColor);
        document.documentElement.style.setProperty('--primary-color', accentColor);
        document.documentElement.style.setProperty('--secondary-color', secondaryColor);
        
        // Применяем основные стили напрямую
        if (tgApp.themeParams) {
            document.body.style.backgroundColor = bgColor;
            document.body.style.color = textColor;
        }
        
        console.log(`Применена тема Telegram: ${tgApp.colorScheme}`);
    } catch (error) {
        console.error('Ошибка при применении темы Telegram:', error);
    }
}

// Экспортируем функции в глобальный объект window
window.tgApp = tgApp;
window.initTelegramFullscreen = initTelegramFullscreen;
window.getUserData = getUserData;
window.safeCallTgMethod = safeCallTgMethod;

// Автоматически инициализируем полноэкранный режим при загрузке скрипта
document.addEventListener('DOMContentLoaded', () => {
    initTelegramFullscreen();
}); 