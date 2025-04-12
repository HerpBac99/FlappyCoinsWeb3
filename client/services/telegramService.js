/**
 * Модуль для работы с Telegram WebApp API
 * Обеспечивает получение данных пользователя и взаимодействие с мини-приложением Telegram
 */

import { logger } from '../logger.js';
import { safeCallTgMethod } from '../utils.js';

// Экспортируем сервис для работы с Telegram WebApp
export const telegramService = {
    initialized: false,
    
    /**
     * Инициализация Telegram WebApp
     * @returns {Promise<boolean>} Успешность инициализации
     */
    async init() {
        try {
            // Проверяем, что у нас есть доступ к Telegram WebApp API
            if (!window.Telegram || !window.Telegram.WebApp) {
                logger.warn('Telegram WebApp API не найден');
                
                // Подключаем скрипт Telegram WebApp, если его нет
                await this.loadTelegramWebAppScript();
            }
            
            // Устанавливаем настройки WebApp
            if (window.Telegram?.WebApp) {
                logger.info('Инициализация Telegram WebApp');
                
                // Безопасно вызываем методы Telegram WebApp
                safeCallTgMethod(window.Telegram.WebApp, 'expand');
                safeCallTgMethod(window.Telegram.WebApp, 'enableClosingConfirmation');
                
                // Если платформа поддерживает BackButton, показываем её
                if (window.Telegram.WebApp.BackButton) {
                    safeCallTgMethod(window.Telegram.WebApp.BackButton, 'show');
                    safeCallTgMethod(window.Telegram.WebApp.BackButton, 'onClick', [() => {
                        // По умолчанию, кнопка назад вызывает историю браузера
                        window.history.back();
                    }]);
                }
                
                this.initialized = true;
                logger.info('Telegram WebApp успешно инициализирован');
                return true;
            } else {
                logger.error('Не удалось инициализировать Telegram WebApp');
                // Если не смогли подключиться к реальному Telegram WebApp, создаем мок для разработки
                this.createTelegramWebAppMock();
                return false;
            }
        } catch (error) {
            logger.error('Ошибка инициализации Telegram WebApp:', error);
            
            // Если не смогли подключиться к реальному Telegram WebApp, создаем мок для разработки
            this.createTelegramWebAppMock();
            return false;
        }
    },
    
    /**
     * Загружает скрипт Telegram WebApp, если он отсутствует
     * @returns {Promise<void>}
     */
    loadTelegramWebAppScript() {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'https://telegram.org/js/telegram-web-app.js';
            script.onload = resolve;
            script.onerror = () => reject(new Error('Не удалось загрузить Telegram WebApp скрипт'));
            document.head.appendChild(script);
        });
    },
    
    /**
     * Создает мок Telegram WebApp для разработки и тестирования
     */
    createTelegramWebAppMock() {
        logger.warn('Создание мока Telegram WebApp для разработки');
        
        window.Telegram = {
            WebApp: {
                initData: 'mock_init_data',
                initDataUnsafe: {
                    user: {
                        id: 123456789,
                        first_name: 'Test',
                        last_name: 'User',
                        username: 'testuser',
                        photo_url: 'https://placekitten.com/100/100'
                    }
                },
                expand: () => logger.debug('Mock: WebApp.expand()'),
                enableClosingConfirmation: () => logger.debug('Mock: WebApp.enableClosingConfirmation()'),
                ready: () => logger.debug('Mock: WebApp.ready()'),
                close: () => logger.debug('Mock: WebApp.close()'),
                BackButton: {
                    show: () => logger.debug('Mock: WebApp.BackButton.show()'),
                    hide: () => logger.debug('Mock: WebApp.BackButton.hide()'),
                    onClick: (callback) => {
                        window.addEventListener('popstate', callback);
                        logger.debug('Mock: WebApp.BackButton.onClick() установлен');
                    }
                },
                MainButton: {
                    show: () => logger.debug('Mock: WebApp.MainButton.show()'),
                    hide: () => logger.debug('Mock: WebApp.MainButton.hide()'),
                    setText: (text) => logger.debug(`Mock: WebApp.MainButton.setText(${text})`),
                    onClick: (callback) => logger.debug('Mock: WebApp.MainButton.onClick() установлен')
                },
                showPopup: (params) => logger.debug(`Mock: WebApp.showPopup(${JSON.stringify(params)})`),
                showAlert: (message) => alert(message)
            }
        };
        
        this.initialized = true;
    },
    
    /**
     * Получает данные пользователя из Telegram WebApp
     * @returns {Object|null} Данные пользователя или null, если данные недоступны
     */
    getUserData() {
        if (!this.initialized) {
            logger.warn('Попытка получить данные пользователя до инициализации Telegram WebApp');
            return null;
        }
        
        try {
            if (window.Telegram?.WebApp?.initDataUnsafe?.user) {
                const user = window.Telegram.WebApp.initDataUnsafe.user;
                
                return {
                    id: user.id,
                    first_name: user.first_name || '',
                    last_name: user.last_name || '',
                    username: user.username || '',
                    photo_url: user.photo_url || null
                };
            }
            
            logger.warn('Данные пользователя Telegram недоступны');
            return null;
        } catch (error) {
            logger.error('Ошибка при получении данных пользователя:', error);
            return null;
        }
    },
    
    /**
     * Закрывает мини-приложение Telegram
     */
    closeWebApp() {
        safeCallTgMethod(window.Telegram?.WebApp, 'close');
    },
    
    /**
     * Показывает всплывающее уведомление
     * @param {string} message - Текст сообщения
     */
    showAlert(message) {
        if (safeCallTgMethod(window.Telegram?.WebApp, 'showAlert', [message]) === null) {
            // Запасной вариант, если API недоступен
            alert(message);
        }
    },
    
    /**
     * Показывает всплывающее окно с кнопками
     * @param {Object} params - Параметры окна
     * @param {Function} callback - Коллбэк, вызываемый после закрытия окна
     */
    showPopup(params, callback) {
        if (safeCallTgMethod(window.Telegram?.WebApp, 'showPopup', [params, callback]) === null) {
            // Запасной вариант, если API недоступен
            const result = window.confirm(params.message || 'Подтвердите действие');
            if (callback) callback(result ? params.buttons[0].id : null);
        }
    },
    
    /**
     * Показывает или скрывает главную кнопку
     * @param {boolean} show - Показать или скрыть
     * @param {string} text - Текст кнопки
     * @param {Function} callback - Коллбэк при нажатии
     */
    toggleMainButton(show, text, callback) {
        const mainButton = window.Telegram?.WebApp?.MainButton;
        
        if (!mainButton) {
            logger.warn('MainButton недоступна в Telegram WebApp');
            return;
        }
        
        if (show) {
            if (text) safeCallTgMethod(mainButton, 'setText', [text]);
            if (callback) safeCallTgMethod(mainButton, 'onClick', [callback]);
            safeCallTgMethod(mainButton, 'show');
        } else {
            safeCallTgMethod(mainButton, 'hide');
        }
    },
    
    /**
     * Включает вибрацию устройства (haptic feedback)
     * @param {string} style - Стиль вибрации ('impact', 'notification', 'selection')
     */
    hapticFeedback(style = 'impact') {
        const haptic = window.Telegram?.WebApp?.HapticFeedback;
        
        if (!haptic) {
            logger.debug('HapticFeedback недоступен в Telegram WebApp');
            return;
        }
        
        safeCallTgMethod(haptic, 'impactOccurred', [style]);
    }
}; 