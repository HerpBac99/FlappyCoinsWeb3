/**
 * Главный файл приложения
 * Инициализирует контроллер игры и подключается к серверу
 */

import { logger } from './logger.js';
import { socketService } from './services/socketService.js';
import { telegramService } from './services/telegramService.js';
import GameController from './gameController.js';

// Отключаем перетаскивание изображений для предотвращения непреднамеренных действий
document.addEventListener('dragstart', (e) => e.preventDefault());

// Инициализация приложения при загрузке DOM
document.addEventListener('DOMContentLoaded', async () => {
    logger.info('Инициализация приложения');
    
    try {
        // Инициализация сокет-сервиса
        await socketService.init();
        
        // Создание и инициализация игрового контроллера
        const gameController = new GameController();
        await gameController.init();
        
        // Сохранение контроллера в глобальной области для отладки
        window.gameController = gameController;
        
        // Скрытие загрузочного экрана
        const loadingView = document.getElementById('loading-view');
        if (loadingView) {
            loadingView.classList.add('hidden');
        }
        
        logger.info('Приложение успешно инициализировано');
    } catch (error) {
        logger.error('Ошибка инициализации приложения:', error);
        
        // Отображение ошибки пользователю
        const errorView = document.getElementById('error-view');
        const errorMessage = document.getElementById('error-message');
        
        if (errorView && errorMessage) {
            errorMessage.textContent = `Произошла ошибка: ${error.message}`;
            errorView.classList.remove('hidden');
        }
    }
}); 