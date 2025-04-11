/**
 * Класс GameEngine - основной класс игрового движка
 * Объединяет все компоненты игры и управляет игровым циклом
 * Адаптирован для работы на клиентской стороне
 */
class GameEngine {
    /**
     * Создает экземпляр игрового движка
     * @param {HTMLCanvasElement} canvas - Canvas элемент для отрисовки игры
     */
    constructor(canvas) {
        // Сохраняем canvas и получаем контекст
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        
        // Адаптируем размер canvas под размер окна
        this.resizeCanvas();
        
        // Создаем компоненты игры
        this.playerManager = new window.PlayerManager();
        this.pipeManager = new window.PipeManager();
        this.collisionEngine = new window.CollisionEngine();
        
        // Состояние игры
        this.gameState = window.GameConstants.GameState.WAITING;
        this.lastTime = null;
        this.gameStartTime = null;
        this.gameTimer = null;
        this.isPaused = false;
        
        // События клавиатуры и клика для прыжка
        this.setupEventListeners();
        
        // Кэш для изображений
        this.images = {
            background: null,
            pipe: null,
            coins: {}
        };
        
        // Инициализация игры
        this.loadAssets().then(() => {
            if (window.appLogger) {
                window.appLogger.info('GameEngine инициализирован, все ресурсы загружены');
            }
        });
    }
    
    /**
     * Загружает игровые ресурсы (изображения)
     * @returns {Promise} Промис, который разрешается, когда все ресурсы загружены
     */
    loadAssets() {
        return new Promise((resolve, reject) => {
            // Количество ресурсов для загрузки
            let totalResources = 3; // фон, труба, монеты
            let loadedResources = 0;
            
            // Функция для отслеживания загрузки ресурсов
            const resourceLoaded = () => {
                loadedResources++;
                
                if (window.appLogger) {
                    window.appLogger.debug(`Загружено ресурсов: ${loadedResources}/${totalResources}`);
                }
                
                if (loadedResources >= totalResources) {
                    resolve();
                }
            };
            
            // Загрузка фона
            this.images.background = new Image();
            this.images.background.onload = resourceLoaded;
            this.images.background.src = 'assets/background-blur.png';
            
            // Загрузка трубы
            this.images.pipe = new Image();
            this.images.pipe.onload = resourceLoaded;
            this.images.pipe.src = 'assets/pipe.png';
            
            // Загрузка скинов монет
            const skins = window.skinService.getAllSkins();
            const skinKeys = Object.keys(skins);
            
            // Обновляем общее количество ресурсов
            totalResources = 2 + skinKeys.length;
            
            // Загружаем все скины монет
            skinKeys.forEach(skin => {
                this.images.coins[skin] = new Image();
                this.images.coins[skin].onload = resourceLoaded;
                this.images.coins[skin].src = skins[skin];
            });
        });
    }
    
    /**
     * Адаптирует размер canvas под размер окна
     */
    resizeCanvas() {
        const { GameParams } = window.GameConstants;
        
        // Устанавливаем размеры canvas для соответствия размеру экрана
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
        
        // Обновляем размеры игрового поля
        GameParams.SCREEN_WIDTH = this.canvas.width;
        GameParams.SCREEN_HEIGHT = this.canvas.height;
        GameParams.FLOOR_POS_Y = this.canvas.height - 50;
        
        if (window.appLogger) {
            window.appLogger.debug('Canvas изменен под размер экрана', {
                width: this.canvas.width,
                height: this.canvas.height
            });
        }
    }
    
    /**
     * Устанавливает обработчики событий для управления в игре
     */
    setupEventListeners() {
        // Обработчик клика для прыжка
        this.handleClick = this.handleClick.bind(this);
        this.canvas.addEventListener('click', this.handleClick);
        
        // Обработчик нажатия клавиш
        this.handleKeyDown = this.handleKeyDown.bind(this);
        document.addEventListener('keydown', this.handleKeyDown);
        
        // Обработчик изменения размера окна
        this.handleResize = this.handleResize.bind(this);
        window.addEventListener('resize', this.handleResize);
        
        if (window.appLogger) {
            window.appLogger.debug('Установлены обработчики событий для игры');
        }
    }
    
    /**
     * Удаляет обработчики событий при завершении игры
     */
    removeEventListeners() {
        this.canvas.removeEventListener('click', this.handleClick);
        document.removeEventListener('keydown', this.handleKeyDown);
        window.removeEventListener('resize', this.handleResize);
        
        if (window.appLogger) {
            window.appLogger.debug('Удалены обработчики событий игры');
        }
    }
    
    /**
     * Обработчик клика для прыжка
     * @param {Event} event - Событие клика
     */
    handleClick(event) {
        if (this.gameState !== window.GameConstants.GameState.PLAYING || this.isPaused) {
            return;
        }
        
        // Заставляем прыгать только текущего игрока
        // (в последующих версиях можно добавить определение принадлежности клика)
        if (window.userData && window.userData.id) {
            const currentUserId = window.userData.id;
            const playerIndex = this.playerManager.findPlayerIndex(currentUserId);
            
            if (playerIndex !== -1) {
                const player = this.playerManager.playersList[playerIndex];
                player.jump();
            }
        }
    }
    
    /**
     * Обработчик нажатия клавиш
     * @param {KeyboardEvent} event - Событие нажатия клавиши
     */
    handleKeyDown(event) {
        if (this.gameState !== window.GameConstants.GameState.PLAYING || this.isPaused) {
            return;
        }
        
        // Пробел или стрелка вверх для прыжка
        if (event.code === 'Space' || event.code === 'ArrowUp') {
            if (window.userData && window.userData.id) {
                const currentUserId = window.userData.id;
                const playerIndex = this.playerManager.findPlayerIndex(currentUserId);
                
                if (playerIndex !== -1) {
                    const player = this.playerManager.playersList[playerIndex];
                    player.jump();
                }
            }
        }
        
        // Escape для паузы
        if (event.code === 'Escape') {
            this.togglePause();
        }
    }
    
    /**
     * Обработчик изменения размера окна
     */
    handleResize() {
        this.resizeCanvas();
    }
    
    /**
     * Переключает режим паузы
     */
    togglePause() {
        this.isPaused = !this.isPaused;
        
        if (window.appLogger) {
            window.appLogger.info(`Игра ${this.isPaused ? 'приостановлена' : 'возобновлена'}`);
        }
    }
    
    /**
     * Инициализация игры из данных комнаты
     * @param {Object} roomData - Данные комнаты с игроками
     */
    initFromRoomData(roomData) {
        if (!roomData || !roomData.players) {
            if (window.appLogger) {
                window.appLogger.error('Не удалось инициализировать игру: неверные данные комнаты');
            }
            return false;
        }
        
        // Инициализируем игроков
        this.playerManager.initPlayersFromRoomData(roomData.players);
        
        if (window.appLogger) {
            window.appLogger.info('Игра инициализирована из данных комнаты', {
                roomId: roomData.roomId,
                playersCount: roomData.players.length
            });
        }
        
        return true;
    }
    
    /**
     * Запускает игру
     */
    startGame() {
        // Сбрасываем состояние игры
        this.gameState = window.GameConstants.GameState.PLAYING;
        this.lastTime = null;
        this.gameStartTime = null;
        this.isPaused = false;
        
        // Подготавливаем игроков к игре
        this.playerManager.preparePlayersForGame();
        
        // Очищаем трубы и создаем стартовую
        this.pipeManager.flushPipeList();
        this.pipeManager.createNewPipe();
        
        // Запускаем игровой цикл
        this.startGameLoop();
        
        if (window.appLogger) {
            window.appLogger.info('Игра запущена', {
                playersCount: this.playerManager.playersList.length
            });
        }
    }
    
    /**
     * Запускает игровой цикл
     */
    startGameLoop() {
        // Останавливаем предыдущий таймер, если есть
        if (this.gameTimer) {
            cancelAnimationFrame(this.gameTimer);
        }
        
        // Функция обновления состояния игры
        const updateGame = (timestamp) => {
            // Если игра не активна, не обновляем
            if (this.gameState !== window.GameConstants.GameState.PLAYING) {
                return;
            }
            
            // Вычисляем дельту времени
            if (!this.lastTime) {
                this.lastTime = timestamp;
                this.gameStartTime = timestamp;
            }
            const delta = timestamp - this.lastTime;
            this.lastTime = timestamp;
            
            // Если игра на паузе, просто перерисовываем текущее состояние
            if (this.isPaused) {
                this.render();
                this.gameTimer = requestAnimationFrame(updateGame);
                return;
            }
            
            // Обновляем состояние игроков
            this.playerManager.updatePlayers(delta);
            
            // Обновляем состояние труб
            this.pipeManager.updatePipes(delta);
            
            // Проверяем столкновения
            const hasCollision = this.collisionEngine.checkCollisions(
                this.pipeManager.getPotentialPipeHit(),
                this.playerManager.playersList
            );
            
            // Если больше нет активных игроков, завершаем игру
            if (!this.playerManager.hasActivePlayers()) {
                this.gameOver();
                return;
            }
            
            // Отрисовываем игру
            this.render();
            
            // Запускаем следующий кадр
            this.gameTimer = requestAnimationFrame(updateGame);
        };
        
        // Запускаем первый кадр
        this.gameTimer = requestAnimationFrame(updateGame);
    }
    
    /**
     * Отрисовывает игру на canvas
     */
    render() {
        // Очищаем canvas
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Рисуем фон
        if (this.images.background) {
            this.ctx.drawImage(this.images.background, 0, 0, this.canvas.width, this.canvas.height);
        }
        
        // Рисуем трубы
        this.renderPipes();
        
        // Рисуем игроков (монеты)
        this.renderPlayers();
        
        // Рисуем землю
        this.renderGround();
        
        // Рисуем счет
        this.renderScore();
        
        // Если игра на паузе, рисуем сообщение о паузе
        if (this.isPaused) {
            this.renderPauseMessage();
        }
    }
    
    /**
     * Отрисовывает трубы
     */
    renderPipes() {
        const { GameParams } = window.GameConstants;
        const pipes = this.pipeManager.getPipeList();
        
        for (const pipe of pipes) {
            // Верхняя труба
            this.ctx.save();
            this.ctx.translate(pipe.posX, pipe.posY - GameParams.PIPE_WIDTH);
            this.ctx.rotate(Math.PI);
            if (this.images.pipe) {
                this.ctx.drawImage(this.images.pipe, -GameParams.PIPE_WIDTH, 0, GameParams.PIPE_WIDTH, GameParams.PIPE_WIDTH * 3);
            } else {
                this.ctx.fillStyle = 'green';
                this.ctx.fillRect(-GameParams.PIPE_WIDTH, 0, GameParams.PIPE_WIDTH, GameParams.PIPE_WIDTH * 3);
            }
            this.ctx.restore();
            
            // Нижняя труба
            if (this.images.pipe) {
                this.ctx.drawImage(
                    this.images.pipe, 
                    pipe.posX, 
                    pipe.posY + GameParams.HEIGHT_BETWEEN_PIPES, 
                    GameParams.PIPE_WIDTH, 
                    GameParams.PIPE_WIDTH * 3
                );
            } else {
                this.ctx.fillStyle = 'green';
                this.ctx.fillRect(
                    pipe.posX, 
                    pipe.posY + GameParams.HEIGHT_BETWEEN_PIPES, 
                    GameParams.PIPE_WIDTH, 
                    GameParams.PIPE_WIDTH * 3
                );
            }
        }
    }
    
    /**
     * Отрисовывает игроков (монеты)
     */
    renderPlayers() {
        const { GameParams } = window.GameConstants;
        const players = this.playerManager.getPlayersData();
        
        for (const player of players) {
            this.ctx.save();
            
            // Применяем поворот к монете
            this.ctx.translate(
                player.posX + GameParams.BIRD_WIDTH / 2,
                player.posY + GameParams.BIRD_HEIGHT / 2
            );
            this.ctx.rotate((player.rotation * Math.PI) / 180);
            
            // Определяем скин монеты
            const skinName = player.skin || 'bitcoin';
            const coinImage = this.images.coins[skinName] || this.images.coins.bitcoin;
            
            // Рисуем монету
            if (coinImage) {
                this.ctx.drawImage(
                    coinImage,
                    -GameParams.BIRD_WIDTH / 2,
                    -GameParams.BIRD_HEIGHT / 2,
                    GameParams.BIRD_WIDTH,
                    GameParams.BIRD_HEIGHT
                );
            } else {
                // Запасной вариант если изображение не загрузилось
                this.ctx.fillStyle = 'yellow';
                this.ctx.beginPath();
                this.ctx.arc(0, 0, GameParams.BIRD_WIDTH / 2, 0, Math.PI * 2);
                this.ctx.fill();
            }
            
            this.ctx.restore();
            
            // Добавляем имя игрока над монетой
            this.ctx.fillStyle = 'white';
            this.ctx.font = '14px Arial';
            this.ctx.textAlign = 'center';
            this.ctx.fillText(
                player.username,
                player.posX + GameParams.BIRD_WIDTH / 2,
                player.posY - 10
            );
        }
    }
    
    /**
     * Отрисовывает землю
     */
    renderGround() {
        const { GameParams } = window.GameConstants;
        
        this.ctx.fillStyle = '#5D4037';
        this.ctx.fillRect(0, GameParams.FLOOR_POS_Y, this.canvas.width, this.canvas.height - GameParams.FLOOR_POS_Y);
    }
    
    /**
     * Отрисовывает счет игроков
     */
    renderScore() {
        if (!window.userData || !window.userData.id) {
            return;
        }
        
        // Ищем текущего игрока
        const playerIndex = this.playerManager.findPlayerIndex(window.userData.id);
        
        if (playerIndex === -1) {
            return;
        }
        
        const player = this.playerManager.playersList[playerIndex].getPlayerObject();
        
        // Отображаем счет текущего игрока
        this.ctx.fillStyle = 'white';
        this.ctx.font = 'bold 24px Arial';
        this.ctx.textAlign = 'left';
        this.ctx.fillText(`Счет: ${player.score}`, 20, 40);
        
        // Отображаем лучший счет
        this.ctx.font = '16px Arial';
        this.ctx.fillText(`Лучший счет: ${player.bestScore}`, 20, 70);
    }
    
    /**
     * Отрисовывает сообщение о паузе
     */
    renderPauseMessage() {
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        this.ctx.fillStyle = 'white';
        this.ctx.font = 'bold 36px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.fillText('ПАУЗА', this.canvas.width / 2, this.canvas.height / 2);
        
        this.ctx.font = '18px Arial';
        this.ctx.fillText('Нажмите ESC для продолжения', this.canvas.width / 2, this.canvas.height / 2 + 40);
    }
    
    /**
     * Завершает игру и показывает результаты
     */
    gameOver() {
        // Останавливаем игровой цикл
        if (this.gameTimer) {
            cancelAnimationFrame(this.gameTimer);
            this.gameTimer = null;
        }
        
        // Переводим игру в состояние показа результатов
        this.gameState = window.GameConstants.GameState.RANKING;
        
        // Отрисовываем финальное состояние
        this.render();
        
        // Показываем результаты
        this.renderGameOver();
        
        if (window.appLogger) {
            window.appLogger.info('Игра завершена', {
                playersData: this.playerManager.getPlayersData()
            });
        }
        
        // Отправляем событие завершения игры
        const gameOverEvent = new CustomEvent('flappycoin:gameOver', {
            detail: {
                players: this.playerManager.getPlayersData()
            }
        });
        
        document.dispatchEvent(gameOverEvent);
    }
    
    /**
     * Отрисовывает экран завершения игры
     */
    renderGameOver() {
        // Затемняем фон
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Заголовок
        this.ctx.fillStyle = '#f9ca24';
        this.ctx.font = 'bold 36px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.fillText('ИГРА ОКОНЧЕНА', this.canvas.width / 2, 100);
        
        // Получаем отсортированный по счету список игроков
        const players = this.playerManager.getPlayersData()
            .sort((a, b) => b.score - a.score);
        
        // Отображаем таблицу результатов
        this.ctx.fillStyle = 'white';
        this.ctx.font = 'bold 24px Arial';
        this.ctx.fillText('РЕЗУЛЬТАТЫ', this.canvas.width / 2, 160);
        
        // Отображаем игроков
        this.ctx.textAlign = 'left';
        this.ctx.font = '18px Arial';
        
        const startY = 200;
        const lineHeight = 40;
        
        players.forEach((player, index) => {
            const y = startY + index * lineHeight;
            
            // Определяем цвет для текущего игрока
            if (window.userData && player.userId === window.userData.id) {
                this.ctx.fillStyle = '#4caf50';
            } else {
                this.ctx.fillStyle = 'white';
            }
            
            // Выводим место и имя
            this.ctx.fillText(`${index + 1}. ${player.username}`, this.canvas.width / 2 - 150, y);
            
            // Выводим счет
            this.ctx.textAlign = 'right';
            this.ctx.fillText(`${player.score}`, this.canvas.width / 2 + 150, y);
            this.ctx.textAlign = 'left';
        });
        
        // Инструкция по возврату
        this.ctx.fillStyle = '#ccc';
        this.ctx.font = '16px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.fillText('Нажмите в любом месте, чтобы вернуться в комнату', this.canvas.width / 2, this.canvas.height - 40);
    }
    
    /**
     * Очищает все ресурсы и останавливает игру
     */
    cleanup() {
        // Останавливаем игровой цикл
        if (this.gameTimer) {
            cancelAnimationFrame(this.gameTimer);
            this.gameTimer = null;
        }
        
        // Удаляем обработчики событий
        this.removeEventListeners();
        
        // Очищаем менеджеры
        this.playerManager.clearAllPlayers();
        this.pipeManager.flushPipeList();
        
        if (window.appLogger) {
            window.appLogger.info('Игровой движок очищен');
        }
    }
}

// Экспортируем класс в глобальное пространство имен
window.GameEngine = GameEngine; 