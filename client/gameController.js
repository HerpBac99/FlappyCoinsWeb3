/**
 * Контроллер игрового процесса
 * Управляет взаимодействием между игровым движком и пользовательским интерфейсом
 */

import { logger } from './logger.js';
import { socketService } from './services/socketService.js';
import GameEngine from './gameEngine.js';
import { telegramService } from './services/telegramService.js';

export class GameController {
    constructor() {
        this.engine = null;
        this.roomId = null;
        this.gameState = 'loading'; // loading, menu, room, game, gameover
        this.players = [];
        this.isReady = false;
        
        // Привязка методов к контексту
        this.handleRoomCreated = this.handleRoomCreated.bind(this);
        this.handlePlayerJoined = this.handlePlayerJoined.bind(this);
        this.handlePlayerLeft = this.handlePlayerLeft.bind(this);
        this.handlePlayerReady = this.handlePlayerReady.bind(this);
        this.handleGameStart = this.handleGameStart.bind(this);
        this.handleGameOver = this.handleGameOver.bind(this);
        
        // Кэширование элементов DOM
        this.views = {
            loading: document.getElementById('loading-view'),
            mainMenu: document.getElementById('main-menu'),
            room: document.getElementById('room-view'),
            game: document.getElementById('game-view'),
            gameOver: document.getElementById('game-over-dialog')
        };
        
        // Кнопки и элементы управления
        this.controls = {
            createRoom: document.getElementById('create-room-btn'),
            joinRoom: document.getElementById('join-room-btn'),
            readyBtn: document.getElementById('ready-btn'),
            leaveRoomBtn: document.getElementById('leave-room-btn'),
            playAgainBtn: document.getElementById('play-again-btn'),
            backToMenuBtn: document.getElementById('back-to-menu-btn'),
            roomIdInput: document.getElementById('room-id-input'),
            roomIdDisplay: document.getElementById('room-id-display'),
            playersList: document.getElementById('players-list'),
            playerName: document.getElementById('player-name'),
            playerAvatar: document.getElementById('player-avatar'),
            winnerName: document.getElementById('winner-name')
        };
    }
    
    /**
     * Инициализация контроллера
     */
    async init() {
        logger.info('Инициализация GameController');
        
        // Инициализация Telegram WebApp
        await telegramService.init();
        const userData = telegramService.getUserData();
        
        if (!userData) {
            logger.error('Не удалось получить данные пользователя Telegram');
            return;
        }
        
        // Отображение данных пользователя в интерфейсе
        this.displayUserData(userData);
        
        // Инициализация игрового движка
        this.engine = new GameEngine(socketService);
        
        // Установка обработчика окончания игры
        this.engine.setGameOverCallback(this.handleGameOver);
        
        // Настройка обработчиков событий от сервера
        this.setupSocketListeners();
        
        // Настройка обработчиков UI событий
        this.setupUIEventListeners();
        
        // Проверка URL для восстановления сессии
        this.checkSessionFromURL();
        
        // Переход к главному меню
        this.showMainMenu();
    }
    
    /**
     * Отображение данных пользователя в интерфейсе
     * @param {Object} userData - Данные пользователя из Telegram
     */
    displayUserData(userData) {
        if (this.controls.playerName) {
            this.controls.playerName.textContent = userData.username || userData.first_name || 'Игрок';
        }
        
        if (this.controls.playerAvatar && userData.photo_url) {
            this.controls.playerAvatar.src = userData.photo_url;
            this.controls.playerAvatar.style.display = 'block';
        }
    }
    
    /**
     * Настройка обработчиков событий от сервера
     */
    setupSocketListeners() {
        // Создание комнаты
        socketService.on('roomCreated', this.handleRoomCreated);
        
        // Присоединение к комнате
        socketService.on('roomJoined', this.handleRoomCreated);
        
        // Присоединение игрока
        socketService.on('playerJoined', this.handlePlayerJoined);
        
        // Уход игрока
        socketService.on('playerLeft', this.handlePlayerLeft);
        
        // Готовность игрока
        socketService.on('playerReady', this.handlePlayerReady);
        
        // Начало игры
        socketService.on('gameStart', this.handleGameStart);
        
        // Ошибка
        socketService.on('error', (data) => {
            logger.error('Ошибка от сервера:', data.message);
            alert(data.message);
        });
    }
    
    /**
     * Настройка обработчиков UI событий
     */
    setupUIEventListeners() {
        // Создание комнаты
        if (this.controls.createRoom) {
            this.controls.createRoom.addEventListener('click', () => this.createRoom());
        }
        
        // Присоединение к комнате
        if (this.controls.joinRoom) {
            this.controls.joinRoom.addEventListener('click', () => {
                const roomId = this.controls.roomIdInput.value.trim();
                if (roomId) {
                    this.joinRoom(roomId);
                } else {
                    alert('Введите ID комнаты');
                }
            });
        }
        
        // Готовность игрока
        if (this.controls.readyBtn) {
            this.controls.readyBtn.addEventListener('click', () => {
                this.isReady = !this.isReady;
                this.controls.readyBtn.textContent = this.isReady ? 'Не готов' : 'Готов';
                this.controls.readyBtn.classList.toggle('ready', this.isReady);
                
                socketService.emit('playerReady', { roomId: this.roomId, isReady: this.isReady });
            });
        }
        
        // Уход из комнаты
        if (this.controls.leaveRoomBtn) {
            this.controls.leaveRoomBtn.addEventListener('click', () => this.leaveRoom());
        }
        
        // Повторная игра
        if (this.controls.playAgainBtn) {
            this.controls.playAgainBtn.addEventListener('click', () => {
                this.views.gameOver.classList.add('hidden');
                this.showRoomView();
                
                // Сброс состояния готовности
                this.isReady = false;
                if (this.controls.readyBtn) {
                    this.controls.readyBtn.textContent = 'Готов';
                    this.controls.readyBtn.classList.remove('ready');
                }
            });
        }
        
        // Возврат в меню
        if (this.controls.backToMenuBtn) {
            this.controls.backToMenuBtn.addEventListener('click', () => {
                this.views.gameOver.classList.add('hidden');
                this.leaveRoom();
                this.showMainMenu();
            });
        }
        
        // Обработка ориентации экрана
        window.addEventListener('resize', () => this.checkOrientation());
        this.checkOrientation();
    }
    
    /**
     * Проверка ориентации экрана (игра работает только в вертикальной ориентации)
     */
    checkOrientation() {
        const isPortrait = window.innerHeight > window.innerWidth;
        const orientationWarning = document.getElementById('orientation-warning');
        
        if (orientationWarning) {
            orientationWarning.classList.toggle('hidden', isPortrait);
        }
        
        if (this.engine && this.engine.canvas) {
            this.engine.canvas.classList.toggle('hidden', !isPortrait);
        }
    }
    
    /**
     * Проверка наличия сессии в URL для восстановления состояния
     */
    checkSessionFromURL() {
        const urlParams = new URLSearchParams(window.location.search);
        const roomId = urlParams.get('roomId');
        
        if (roomId) {
            logger.info('Восстановление сессии из URL, комната:', roomId);
            this.joinRoom(roomId);
        }
    }
    
    /**
     * Обновление URL с информацией о текущей комнате
     */
    updateURL() {
        if (this.roomId) {
            const url = new URL(window.location.href);
            url.searchParams.set('roomId', this.roomId);
            window.history.replaceState({}, '', url.toString());
        } else {
            const url = new URL(window.location.href);
            url.searchParams.delete('roomId');
            window.history.replaceState({}, '', url.toString());
        }
    }
    
    /**
     * Отображение главного меню
     */
    showMainMenu() {
        this.gameState = 'menu';
        
        // Скрываем все view
        Object.values(this.views).forEach(view => {
            if (view) view.classList.add('hidden');
        });
        
        // Показываем меню
        if (this.views.mainMenu) {
            this.views.mainMenu.classList.remove('hidden');
        }
    }
    
    /**
     * Отображение комнаты ожидания
     */
    showRoomView() {
        this.gameState = 'room';
        
        // Скрываем все view
        Object.values(this.views).forEach(view => {
            if (view) view.classList.add('hidden');
        });
        
        // Показываем комнату
        if (this.views.room) {
            this.views.room.classList.remove('hidden');
        }
        
        // Обновляем отображение ID комнаты
        if (this.controls.roomIdDisplay) {
            this.controls.roomIdDisplay.textContent = this.roomId;
        }
        
        // Обновляем список игроков
        this.updatePlayersList();
    }
    
    /**
     * Отображение игрового экрана
     */
    showGameView() {
        this.gameState = 'game';
        
        // Скрываем все view
        Object.values(this.views).forEach(view => {
            if (view) view.classList.add('hidden');
        });
        
        // Показываем игру
        if (this.views.game) {
            this.views.game.classList.remove('hidden');
        }
    }
    
    /**
     * Создание новой комнаты
     */
    createRoom() {
        const userData = telegramService.getUserData();
        
        if (!userData) {
            logger.error('Не удалось получить данные пользователя Telegram');
            return;
        }
        
        socketService.emit('createRoom', {
            userId: userData.id,
            username: userData.username || userData.first_name || 'Игрок',
            avatar: userData.photo_url
        });
    }
    
    /**
     * Присоединение к существующей комнате
     * @param {string} roomId - ID комнаты
     */
    joinRoom(roomId) {
        const userData = telegramService.getUserData();
        
        if (!userData) {
            logger.error('Не удалось получить данные пользователя Telegram');
            return;
        }
        
        socketService.emit('joinRoom', {
            roomId,
            userId: userData.id,
            username: userData.username || userData.first_name || 'Игрок',
            avatar: userData.photo_url
        });
    }
    
    /**
     * Уход из комнаты
     */
    leaveRoom() {
        if (this.roomId) {
            socketService.emit('leaveRoom', { roomId: this.roomId });
            this.roomId = null;
            this.players = [];
            this.isReady = false;
            this.updateURL();
            this.showMainMenu();
        }
    }
    
    /**
     * Обновление списка игроков в комнате
     */
    updatePlayersList() {
        if (!this.controls.playersList) return;
        
        // Очищаем список
        this.controls.playersList.innerHTML = '';
        
        // Добавляем игроков
        this.players.forEach(player => {
            const playerElement = document.createElement('div');
            playerElement.className = 'player-item';
            
            // Аватар
            const avatar = document.createElement('img');
            avatar.className = 'player-avatar';
            avatar.src = player.avatar || 'assets/default-avatar.png';
            playerElement.appendChild(avatar);
            
            // Имя
            const name = document.createElement('span');
            name.className = 'player-name';
            name.textContent = player.username;
            playerElement.appendChild(name);
            
            // Статус готовности
            const status = document.createElement('span');
            status.className = 'player-status';
            status.textContent = player.isReady ? 'Готов' : 'Не готов';
            status.classList.toggle('ready', player.isReady);
            playerElement.appendChild(status);
            
            this.controls.playersList.appendChild(playerElement);
        });
    }
    
    /**
     * Обработчик создания/присоединения к комнате
     * @param {Object} data - Данные о комнате
     */
    handleRoomCreated(data) {
        this.roomId = data.roomId;
        this.players = data.players || [];
        
        // Обновляем URL для возможности восстановления сессии
        this.updateURL();
        
        // Показываем view комнаты
        this.showRoomView();
        
        logger.info('Присоединение к комнате:', this.roomId);
    }
    
    /**
     * Обработчик присоединения нового игрока
     * @param {Object} data - Данные о новом игроке
     */
    handlePlayerJoined(data) {
        // Добавляем нового игрока в список
        const existingPlayerIndex = this.players.findIndex(p => p.id === data.player.id);
        
        if (existingPlayerIndex === -1) {
            this.players.push(data.player);
        } else {
            this.players[existingPlayerIndex] = data.player;
        }
        
        // Обновляем список игроков в интерфейсе
        this.updatePlayersList();
        
        logger.info('Игрок присоединился:', data.player.username);
    }
    
    /**
     * Обработчик ухода игрока
     * @param {Object} data - Данные об ушедшем игроке
     */
    handlePlayerLeft(data) {
        // Удаляем игрока из списка
        this.players = this.players.filter(p => p.id !== data.playerId);
        
        // Обновляем список игроков в интерфейсе
        this.updatePlayersList();
        
        logger.info('Игрок покинул комнату:', data.playerId);
    }
    
    /**
     * Обработчик изменения готовности игрока
     * @param {Object} data - Данные о готовности игрока
     */
    handlePlayerReady(data) {
        // Обновляем статус готовности игрока
        const playerIndex = this.players.findIndex(p => p.id === data.playerId);
        
        if (playerIndex !== -1) {
            this.players[playerIndex].isReady = data.isReady;
        }
        
        // Обновляем список игроков в интерфейсе
        this.updatePlayersList();
        
        logger.info('Статус готовности игрока изменен:', data.playerId, data.isReady);
    }
    
    /**
     * Обработчик начала игры
     * @param {Object} data - Данные о начале игры
     */
    handleGameStart(data) {
        logger.info('Начало игры');
        
        // Показываем игровой экран
        this.showGameView();
        
        // Начинаем обратный отсчет
        let countdown = 3;
        const countdownElement = document.createElement('div');
        countdownElement.className = 'countdown';
        countdownElement.textContent = countdown;
        document.body.appendChild(countdownElement);
        
        const countdownInterval = setInterval(() => {
            countdown--;
            countdownElement.textContent = countdown;
            
            if (countdown <= 0) {
                clearInterval(countdownInterval);
                countdownElement.remove();
                
                // Инициализируем и запускаем игровой движок
                const userData = telegramService.getUserData();
                this.engine.init(userData.id, this.players);
                this.engine.startGame();
            }
        }, 1000);
    }
    
    /**
     * Обработчик окончания игры
     * @param {Object} data - Данные об окончании игры
     */
    handleGameOver(data) {
        logger.info('Игра окончена, победитель:', data.winner);
        
        // Находим победителя в списке игроков
        let winnerName = 'Ничья';
        
        if (data.winner) {
            const winner = this.players.find(p => p.id === data.winner);
            if (winner) {
                winnerName = winner.username;
            }
        }
        
        // Отображаем имя победителя
        if (this.controls.winnerName) {
            this.controls.winnerName.textContent = winnerName;
        }
        
        // Показываем диалог окончания игры
        if (this.views.gameOver) {
            this.views.gameOver.classList.remove('hidden');
        }
    }
}

export default GameController; 