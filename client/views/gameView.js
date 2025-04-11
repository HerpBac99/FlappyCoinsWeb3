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
            // Скрываем все экраны кроме игрового
            document.querySelectorAll('.screen').forEach(screen => {
                if (screen.id !== 'game-scene') {
                    screen.style.display = 'none';
                }
            });
            
            // Показываем игровую сцену
            const gameScene = document.getElementById('game-scene');
            if (gameScene) {
                gameScene.style.display = 'block';
                
                if (window.appLogger) {
                    window.appLogger.debug('Игровая сцена отображена');
                }
            } else {
                if (window.appLogger) {
                    window.appLogger.error('Элемент game-scene не найден');
                }
                return;
            }
            
            // Проверяем наличие canvas
            const gameCanvas = document.getElementById('game-canvas');
            if (!gameCanvas) {
                if (window.appLogger) {
                    window.appLogger.error('Элемент game-canvas не найден');
                }
                return;
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
                if (window.appLogger) {
                    window.appLogger.info('GameController не инициализирован, выполняем инициализацию', {
                        roomId: roomId,
                        playersCount: playersData.length
                    });
                }
                
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
                
                if (window.appLogger) {
                    window.appLogger.info('GameController успешно инициализирован');
                }
            } else {
                if (window.appLogger) {
                    window.appLogger.info('GameController уже инициализирован');
                }
            }
            
            // Проверяем загрузку ресурсов через инспекцию canvas
            const canvas = document.getElementById('game-canvas');
            if (canvas) {
                const ctx = canvas.getContext('2d');
                if (ctx) {
                    // Рисуем тестовый текст для проверки canvas
                    ctx.fillStyle = 'white';
                    ctx.font = '24px Arial';
                    ctx.textAlign = 'center';
                    ctx.fillText('Инициализация игры...', canvas.width / 2, canvas.height / 2);
                    
                    if (window.appLogger) {
                        window.appLogger.debug('Canvas проверен, контекст получен');
                    }
                }
            }
            
            // Запускаем игру, если она еще не запущена
            window.gameController.startGame();
            
            if (window.appLogger) {
                window.appLogger.info('Игровой экран инициализирован и игра запущена', { 
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