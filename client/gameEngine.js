/**
 * Игровой движок для FlappyCoins Web3
 * Реализует основную логику и отрисовку игры Flappy Bird с поддержкой мультиплеера
 */

import { logger } from './logger.js';

export class GameEngine {
    constructor(socketService, canvasId = 'game-canvas') {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');
        this.socketService = socketService;
        this.players = new Map();
        this.localPlayerId = null;
        this.obstacles = [];
        this.gameStarted = false;
        this.lastFrameTime = 0;
        this.initialized = false;
        this.gameOver = false;
        this.winner = null;
        
        // Игровые константы
        this.GRAVITY = 0.5;
        this.JUMP_FORCE = -10;
        this.OBSTACLE_SPEED = 2;
        this.OBSTACLE_GAP = 150;
        this.OBSTACLE_WIDTH = 80;
        this.OBSTACLE_SPACING = 300;
        this.PLAYER_WIDTH = 50;
        this.PLAYER_HEIGHT = 35;
        
        // Загрузка изображений
        this.images = {
            background: new Image(),
            bird: new Image(),
            obstacle: new Image(),
            ground: new Image()
        };
        
        this.images.background.src = 'assets/background.png';
        this.images.bird.src = 'assets/bird.png';
        this.images.obstacle.src = 'assets/pipe.png';
        this.images.ground.src = 'assets/ground.png';
        
        // Привязка методов к контексту
        this.handleJump = this.handleJump.bind(this);
        this.gameLoop = this.gameLoop.bind(this);
        this.resetGame = this.resetGame.bind(this);
    }
    
    /**
     * Инициализация игры
     * @param {string} playerId - ID локального игрока
     * @param {Array} initialPlayers - Начальный список игроков
     */
    init(playerId, initialPlayers) {
        if (this.initialized) return;
        
        this.localPlayerId = playerId;
        
        // Настройка размеров canvas
        this.resizeCanvas();
        window.addEventListener('resize', this.resizeCanvas.bind(this));
        
        // Инициализация игроков
        initialPlayers.forEach(player => {
            this.addPlayer(player.id, player.username, player.avatar);
        });
        
        // Настройка управления
        this.canvas.addEventListener('click', this.handleJump);
        document.addEventListener('keydown', (event) => {
            if (event.code === 'Space') this.handleJump();
        });
        
        // Настройка слушателей событий от сервера
        this.setupSocketListeners();
        
        this.initialized = true;
        logger.info('GameEngine initialized');
    }
    
    /**
     * Настройка слушателей событий от сервера
     */
    setupSocketListeners() {
        // Получение обновлений от других игроков
        this.socketService.on('playerUpdate', (data) => {
            if (data.id !== this.localPlayerId && this.players.has(data.id)) {
                const player = this.players.get(data.id);
                player.y = data.y;
                player.velocity = data.velocity;
            }
        });
        
        // Создание препятствий
        this.socketService.on('newObstacle', (data) => {
            this.obstacles.push({
                x: this.canvas.width,
                gapY: data.gapY,
                passed: false
            });
        });
        
        // Получение информации о столкновении
        this.socketService.on('playerCollision', (data) => {
            if (this.players.has(data.id)) {
                const player = this.players.get(data.id);
                player.alive = false;
            }
        });
        
        // Конец игры
        this.socketService.on('gameOver', (data) => {
            this.gameOver = true;
            this.winner = data.winner;
            this.stopGame();
            
            // Вызов обработчика окончания игры, если он был установлен
            if (typeof this.onGameOver === 'function') {
                this.onGameOver(data);
            }
        });
    }
    
    /**
     * Изменение размеров canvas в соответствии с размерами окна
     */
    resizeCanvas() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
    }
    
    /**
     * Добавление игрока
     * @param {string} id - ID игрока
     * @param {string} username - Имя игрока
     * @param {string} avatar - URL аватара игрока
     */
    addPlayer(id, username, avatar) {
        const avatarImg = new Image();
        avatarImg.src = avatar || 'assets/default-avatar.png';
        
        this.players.set(id, {
            id,
            username,
            avatar: avatarImg,
            x: 100 + (this.players.size * 20), // Смещение для каждого игрока
            y: this.canvas.height / 2,
            velocity: 0,
            alive: true
        });
    }
    
    /**
     * Обработка прыжка игрока
     */
    handleJump() {
        if (!this.gameStarted || this.gameOver) return;
        
        if (this.players.has(this.localPlayerId)) {
            const player = this.players.get(this.localPlayerId);
            if (player.alive) {
                player.velocity = this.JUMP_FORCE;
                
                // Отправка обновления на сервер
                this.socketService.emit('playerJump', {
                    id: this.localPlayerId,
                    y: player.y,
                    velocity: player.velocity
                });
            }
        }
    }
    
    /**
     * Создание нового препятствия
     */
    createObstacle() {
        const gapY = Math.floor(Math.random() * (this.canvas.height - 300)) + 100;
        
        // Отправка информации о новом препятствии на сервер
        this.socketService.emit('createObstacle', { gapY });
    }
    
    /**
     * Запуск игры
     */
    startGame() {
        if (this.gameStarted) return;
        
        this.gameStarted = true;
        this.gameOver = false;
        this.winner = null;
        this.obstacles = [];
        
        // Сброс позиций игроков
        this.players.forEach(player => {
            player.y = this.canvas.height / 2;
            player.velocity = 0;
            player.alive = true;
        });
        
        // Создание первого препятствия
        this.createObstacle();
        
        // Запуск игрового цикла
        requestAnimationFrame(this.gameLoop);
        
        logger.info('Game started');
    }
    
    /**
     * Остановка игры
     */
    stopGame() {
        this.gameStarted = false;
    }
    
    /**
     * Сброс игры
     */
    resetGame() {
        this.gameOver = false;
        this.winner = null;
        this.obstacles = [];
        
        // Сброс позиций игроков
        this.players.forEach(player => {
            player.y = this.canvas.height / 2;
            player.velocity = 0;
            player.alive = true;
        });
    }
    
    /**
     * Проверка столкновений
     * @param {Object} player - Объект игрока
     * @returns {boolean} - Произошло ли столкновение
     */
    checkCollision(player) {
        if (!player.alive) return false;
        
        // Проверка столкновения с землей и потолком
        if (player.y <= 0 || player.y + this.PLAYER_HEIGHT >= this.canvas.height) {
            return true;
        }
        
        // Проверка столкновения с препятствиями
        for (const obstacle of this.obstacles) {
            if (
                player.x + this.PLAYER_WIDTH > obstacle.x && 
                player.x < obstacle.x + this.OBSTACLE_WIDTH
            ) {
                // Если игрок находится в промежутке между препятствиями по X
                
                // Проверка верхней трубы
                if (player.y < obstacle.gapY - this.OBSTACLE_GAP / 2) {
                    return true;
                }
                
                // Проверка нижней трубы
                if (player.y + this.PLAYER_HEIGHT > obstacle.gapY + this.OBSTACLE_GAP / 2) {
                    return true;
                }
            }
        }
        
        return false;
    }
    
    /**
     * Обновление состояния игры
     * @param {number} deltaTime - Время, прошедшее с предыдущего кадра (в мс)
     */
    update(deltaTime) {
        if (!this.gameStarted) return;
        
        // Обновление препятствий
        this.obstacles.forEach(obstacle => {
            obstacle.x -= this.OBSTACLE_SPEED;
        });
        
        // Удаление препятствий, которые вышли за пределы экрана
        this.obstacles = this.obstacles.filter(obstacle => obstacle.x + this.OBSTACLE_WIDTH > 0);
        
        // Проверка необходимости создания нового препятствия
        if (this.obstacles.length > 0) {
            const lastObstacle = this.obstacles[this.obstacles.length - 1];
            if (this.canvas.width - lastObstacle.x > this.OBSTACLE_SPACING) {
                this.createObstacle();
            }
        }
        
        // Обновление позиций игроков
        let aliveCount = 0;
        let lastAliveId = null;
        
        this.players.forEach(player => {
            if (!player.alive) return;
            
            aliveCount++;
            lastAliveId = player.id;
            
            // Применение гравитации только для локального игрока
            if (player.id === this.localPlayerId) {
                player.velocity += this.GRAVITY;
                player.y += player.velocity;
                
                // Проверка столкновений для локального игрока
                if (this.checkCollision(player)) {
                    player.alive = false;
                    
                    // Отправка информации о столкновении на сервер
                    this.socketService.emit('playerCollision', { id: player.id });
                } else {
                    // Отправка обновления позиции на сервер
                    this.socketService.emit('playerUpdate', {
                        id: player.id,
                        y: player.y,
                        velocity: player.velocity
                    });
                }
            }
        });
        
        // Если остался только один игрок, объявить его победителем
        if (aliveCount === 1 && this.players.size > 1) {
            this.socketService.emit('gameOver', { winner: lastAliveId });
        } else if (aliveCount === 0) {
            this.socketService.emit('gameOver', { winner: null });
        }
    }
    
    /**
     * Отрисовка игры
     */
    render() {
        // Очистка canvas
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Отрисовка фона
        this.ctx.drawImage(this.images.background, 0, 0, this.canvas.width, this.canvas.height);
        
        // Отрисовка препятствий
        this.obstacles.forEach(obstacle => {
            // Верхняя труба (перевернутая)
            this.ctx.save();
            this.ctx.translate(obstacle.x + this.OBSTACLE_WIDTH / 2, obstacle.gapY - this.OBSTACLE_GAP / 2);
            this.ctx.rotate(Math.PI);
            this.ctx.drawImage(
                this.images.obstacle, 
                -this.OBSTACLE_WIDTH / 2, 
                0, 
                this.OBSTACLE_WIDTH, 
                obstacle.gapY - this.OBSTACLE_GAP / 2
            );
            this.ctx.restore();
            
            // Нижняя труба
            this.ctx.drawImage(
                this.images.obstacle, 
                obstacle.x, 
                obstacle.gapY + this.OBSTACLE_GAP / 2, 
                this.OBSTACLE_WIDTH, 
                this.canvas.height - (obstacle.gapY + this.OBSTACLE_GAP / 2)
            );
        });
        
        // Отрисовка игроков
        this.players.forEach(player => {
            if (player.alive) {
                // Отрисовка птицы
                this.ctx.save();
                
                // Наклон птицы в зависимости от скорости
                const rotation = Math.min(Math.max(player.velocity / 10, -0.5), 0.5);
                
                this.ctx.translate(player.x + this.PLAYER_WIDTH / 2, player.y + this.PLAYER_HEIGHT / 2);
                this.ctx.rotate(rotation);
                this.ctx.drawImage(
                    this.images.bird, 
                    -this.PLAYER_WIDTH / 2, 
                    -this.PLAYER_HEIGHT / 2, 
                    this.PLAYER_WIDTH, 
                    this.PLAYER_HEIGHT
                );
                
                // Отображение аватарки игрока над птицей
                this.ctx.drawImage(
                    player.avatar, 
                    -15, 
                    -40, 
                    30, 
                    30
                );
                
                this.ctx.restore();
                
                // Отображение имени игрока
                this.ctx.fillStyle = '#ffffff';
                this.ctx.font = '12px "Press Start 2P", monospace';
                this.ctx.textAlign = 'center';
                this.ctx.fillText(player.username, player.x + this.PLAYER_WIDTH / 2, player.y - 45);
            }
        });
        
        // Отрисовка земли
        this.ctx.drawImage(this.images.ground, 0, this.canvas.height - 50, this.canvas.width, 50);
        
        // Отображение игровой информации
        if (this.gameStarted) {
            this.ctx.fillStyle = '#ffffff';
            this.ctx.font = '20px "Press Start 2P", monospace';
            this.ctx.textAlign = 'left';
            this.ctx.fillText(`Игроков живо: ${this.getAliveCount()}/${this.players.size}`, 20, 30);
        }
    }
    
    /**
     * Получение количества живых игроков
     * @returns {number} - Количество живых игроков
     */
    getAliveCount() {
        let count = 0;
        this.players.forEach(player => {
            if (player.alive) count++;
        });
        return count;
    }
    
    /**
     * Игровой цикл
     * @param {number} timestamp - Текущее время
     */
    gameLoop(timestamp) {
        if (!this.gameStarted) return;
        
        // Вычисление времени, прошедшего с предыдущего кадра
        const deltaTime = timestamp - this.lastFrameTime;
        this.lastFrameTime = timestamp;
        
        // Обновление и отрисовка
        this.update(deltaTime);
        this.render();
        
        // Планирование следующего кадра
        requestAnimationFrame(this.gameLoop);
    }
    
    /**
     * Установка обработчика события окончания игры
     * @param {Function} callback - Функция-обработчик
     */
    setGameOverCallback(callback) {
        this.onGameOver = callback;
    }
}

export default GameEngine; 