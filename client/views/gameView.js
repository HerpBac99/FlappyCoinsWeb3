/**
 * Модуль управления игровым экраном
 * Отвечает за отображение игровой сцены и коммуникацию с GameController
 */
(function() {
    // Приватные переменные модуля
    let container = null;
    let userData = null;
    let roomId = null;
    let playersData = null;

    /**
     * Инициализирует игровой экран
     * @param {HTMLElement} containerElement - Контейнер приложения
     * @param {Object} params - Параметры инициализации
     */
    function init(containerElement, params = {}) {
        if (window.appLogger) {
            window.appLogger.info('Инициализация игрового экрана', { params });
        }
        
        // Сохраняем ссылки на необходимые элементы и данные
        container = containerElement;
        userData = params.userData || {};
        roomId = params.roomId;
        playersData = params.players || [];
        
        try {
            // Показываем игровую сцену
            const gameScene = document.getElementById('game-scene');
            if (gameScene) {
                gameScene.style.display = 'block';
            }
            
            // Если игровой контроллер уже создан, используем его
            if (!window.gameController) {
                if (window.appLogger) {
                    window.appLogger.error('GameController не инициализирован');
                }
                return;
            }
            
            // Убедимся, что игра запущена
            if (!window.gameController.isInitialized()) {
                const roomData = {
                    roomId: roomId,
                    players: playersData
                };
                
                // Инициализируем контроллер
                const initialized = window.gameController.initialize(roomData);
                if (!initialized) {
                    if (window.appLogger) {
                        window.appLogger.error('Не удалось инициализировать игру');
                    }
                    return;
                }
            }
            
            // Запускаем игру, если она еще не запущена
            window.gameController.startGame();
            
            if (window.appLogger) {
                window.appLogger.info('Игровой экран инициализирован', { 
                    roomId: roomId,
                    playersCount: playersData.length
                });
            }
        } catch (error) {
            if (window.appLogger) {
                window.appLogger.error('Ошибка при инициализации игрового экрана', { 
                    error: error.message,
                    stack: error.stack
                });
            }
            console.error('Ошибка при инициализации игрового экрана:', error);
        }
    }

    /**
     * Очищает ресурсы игрового экрана
     */
    function cleanup() {
        try {
            // Если контроллер игры существует, останавливаем игру
            if (window.gameController) {
                window.gameController.stopGame();
            }
            
            // Скрываем игровую сцену
            const gameScene = document.getElementById('game-scene');
            if (gameScene) {
                gameScene.style.display = 'none';
            }
            
            if (window.appLogger) {
                window.appLogger.info('Игровой экран очищен');
            }
        } catch (error) {
            if (window.appLogger) {
                window.appLogger.error('Ошибка при очистке игрового экрана', { error: error.message });
            }
            console.error('Ошибка при очистке игрового экрана:', error);
        }
    }

    // Экспортируем публичные функции в глобальное пространство имен
    window.gameComponent = {
        init: init,
        cleanup: cleanup
    };
})(); 