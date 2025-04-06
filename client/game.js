// Получаем доступ к Telegram Web App
const tgApp = window.Telegram?.WebApp;

// Игровые переменные
let userData = null; // Данные пользователя
let socket = null; // WebSocket соединение
let roomId = null; // ID игровой комнаты
let roomData = null; // Данные комнаты

// Игровые настройки
const GRAVITY = 0.5; // Гравитация
const JUMP_FORCE = -8; // Сила прыжка
const PIPE_SPEED = 3; // Скорость движения препятствий
const PIPE_SPACING = 200; // Расстояние между препятствиями
const PIPE_GAP = 150; // Высота промежутка между верхней и нижней трубой
const COIN_SIZE = 40; // Размер монеты игрока
const OPPONENT_COIN_SIZE = 30; // Размер монеты соперника
const OPPONENT_OPACITY = 0.5; // Прозрачность монет соперников

// Игровые объекты
let canvas; // HTML-элемент canvas
let ctx; // Контекст рисования
let coinSprite; // Спрайт монеты игрока
let coinFrames = []; // Кадры анимации монеты
let currentFrame = 0; // Текущий кадр анимации
let frameCounter = 0; // Счетчик для смены кадров
let player = { // Игрок
    x: 0,
    y: 0,
    width: COIN_SIZE,
    height: COIN_SIZE,
    velocity: 0,
    score: 0
};
let pipes = []; // Массив препятствий
let opponents = {}; // Соперники
let gameOver = false; // Флаг окончания игры
let gameStarted = false; // Флаг начала игры
let animationId = null; // ID анимации для остановки

// Инициализация игры
document.addEventListener('DOMContentLoaded', () => {
    // Получаем ID комнаты из URL
    const urlParams = new URLSearchParams(window.location.search);
    roomId = urlParams.get('room');
    
    if (!roomId) {
        showOverlay('Ошибка', 'ID комнаты не указан', 'Вернуться в меню');
        return;
    }
    
    // Инициализация Telegram Mini App
    if (tgApp) {
        // Разворачиваем приложение на весь экран
        tgApp.expand();
        
        // Получаем данные пользователя из Telegram
        if (tgApp.initDataUnsafe && tgApp.initDataUnsafe.user) {
            userData = {
                id: tgApp.initDataUnsafe.user.id,
                username: tgApp.initDataUnsafe.user.username || `User${tgApp.initDataUnsafe.user.id}`,
                first_name: tgApp.initDataUnsafe.user.first_name,
                last_name: tgApp.initDataUnsafe.user.last_name,
                photo_url: tgApp.initDataUnsafe.user.photo_url
            };
        }
    } else {
        // Для тестирования локально, создаем тестового пользователя
        userData = {
            id: "12345",
            username: "TestUser",
            first_name: "Test",
            last_name: "User",
            photo_url: null
        };
        
        console.warn('Приложение запущено вне Telegram Mini App');
    }
    
    // Инициализация WebSocket соединения
    initializeSocket();
    
    // Инициализация игрового интерфейса
    initGame();
});

/**
 * Инициализирует WebSocket соединение
 */
function initializeSocket() {
    // Подключаемся к серверу
    socket = io();
    
    // Обработка успешного подключения
    socket.on('connect', () => {
        console.log('Подключено к серверу');
        
        // Отправляем данные пользователя на сервер
        if (userData) {
            socket.emit('join', userData);
            
            // После авторизации присоединяемся к комнате
            socket.on('joined', () => {
                // Присоединяемся к комнате
                socket.emit('joinRoom', roomId);
            });
        }
    });
    
    // Обработка обновления информации о комнате
    socket.on('roomUpdated', (data) => {
        roomData = data;
        updatePlayersList(data.players);
    });
    
    // Обработка движения других игроков
    socket.on('playerMoved', (data) => {
        if (data.playerId !== userData.id) {
            // Обновляем положение соперника
            if (!opponents[data.playerId]) {
                // Создаем нового соперника, если его нет
                opponents[data.playerId] = {
                    x: 100, // Стартовая X-позиция для всех
                    y: data.position.y,
                    width: OPPONENT_COIN_SIZE,
                    height: OPPONENT_COIN_SIZE
                };
            } else {
                // Обновляем положение соперника
                opponents[data.playerId].y = data.position.y;
            }
        }
    });
    
    // Обработка обновления счета игроков
    socket.on('scoreUpdated', (data) => {
        if (roomData) {
            // Находим игрока в комнате и обновляем его счет
            const playerIndex = roomData.players.findIndex(p => p.id === data.playerId);
            if (playerIndex !== -1) {
                roomData.players[playerIndex].score = data.score;
                updatePlayersList(roomData.players);
            }
        }
    });
    
    // Обработка ошибок
    socket.on('error', (error) => {
        console.error('Ошибка:', error.message);
        showOverlay('Ошибка', error.message, 'Вернуться в меню');
    });
    
    // Обработка отключения
    socket.on('disconnect', () => {
        console.log('Отключено от сервера');
        if (!gameOver) {
            showOverlay('Потеряно соединение', 'Соединение с сервером потеряно', 'Вернуться в меню');
        }
    });
}

/**
 * Инициализирует игровой интерфейс и настройки
 */
function initGame() {
    // Инициализируем канвас
    canvas = document.getElementById('game-canvas');
    ctx = canvas.getContext('2d');
    
    // Устанавливаем размеры канваса
    resizeCanvas();
    
    // Загружаем изображения
    loadImages();
    
    // Инициализируем положение игрока
    resetPlayer();
    
    // Обработчики событий
    window.addEventListener('resize', resizeCanvas);
    window.addEventListener('keydown', handleKeyDown);
    canvas.addEventListener('click', handleClick);
    canvas.addEventListener('touchstart', handleClick);
    
    // Обработчик для кнопки в оверлее
    document.getElementById('overlay-button').addEventListener('click', () => {
        window.location.href = '/';
    });
    
    // Начинаем игровой цикл
    gameLoop();
}

/**
 * Адаптирует размер канваса под размер окна
 */
function resizeCanvas() {
    // Устанавливаем размеры канваса в зависимости от размера окна
    const maxWidth = window.innerWidth - 20;
    const maxHeight = window.innerHeight - 120;
    
    // Определяем оптимальный размер, сохраняя пропорции
    if (maxWidth / maxHeight > 1.5) {
        canvas.width = maxHeight * 1.5;
        canvas.height = maxHeight;
    } else {
        canvas.width = maxWidth;
        canvas.height = maxWidth / 1.5;
    }
    
    // Перезапускаем игровой цикл если изменились размеры
    if (gameStarted && !gameOver) {
        cancelAnimationFrame(animationId);
        gameLoop();
    }
}

/**
 * Загружает изображения для игры
 */
function loadImages() {
    // Загружаем спрайт монеты
    coinSprite = new Image();
    coinSprite.src = 'assets/bitcoin.png'; // Путь к спрайту монеты
    
    // Создаем кадры анимации (заглушка, на самом деле нужно загрузить spritesheet)
    coinSprite.onload = () => {
        // В этом простом примере используем одно изображение
        coinFrames.push(coinSprite);
        
        // Здесь можно добавить логику загрузки дополнительных спрайтов
    };
}

/**
 * Сбрасывает положение игрока
 */
function resetPlayer() {
    player.x = 100; // Фиксированная X-позиция
    player.y = canvas.height / 2 - COIN_SIZE / 2;
    player.velocity = 0;
    player.score = 0;
    
    // Очищаем препятствия
    pipes = [];
    
    // Добавляем первое препятствие
    addPipe();
    
    // Обновляем отображение счета
    document.getElementById('score-container').textContent = `Счет: 0`;
    
    // Сбрасываем флаги
    gameOver = false;
    gameStarted = false;
}

/**
 * Добавляет новое препятствие
 */
function addPipe() {
    const gapPosition = Math.random() * (canvas.height - PIPE_GAP - 200) + 100;
    
    pipes.push({
        x: canvas.width,
        gapTop: gapPosition,
        gapBottom: gapPosition + PIPE_GAP,
        counted: false
    });
}

/**
 * Обновляет список игроков в интерфейсе
 * @param {Array} players - Массив игроков
 */
function updatePlayersList(players) {
    const playersList = document.getElementById('players-list');
    playersList.innerHTML = '';
    
    // Сортируем игроков по счету (по убыванию)
    const sortedPlayers = [...players].sort((a, b) => b.score - a.score);
    
    // Добавляем каждого игрока в список
    sortedPlayers.forEach(player => {
        const playerItem = document.createElement('li');
        playerItem.className = 'player-item';
        
        // Добавляем класс для текущего игрока
        if (player.id === userData.id) {
            playerItem.classList.add('current-player');
        }
        
        // Добавляем HTML для игрока
        playerItem.innerHTML = `
            <img src="${player.photoUrl || 'assets/default-avatar.png'}" alt="" class="player-avatar">
            <span class="player-name">${player.username}</span>
            <span class="player-score">${player.score}</span>
        `;
        
        playersList.appendChild(playerItem);
    });
}

/**
 * Обрабатывает нажатие клавиш
 * @param {KeyboardEvent} event - Событие нажатия клавиши
 */
function handleKeyDown(event) {
    // Пробел - прыжок
    if (event.code === 'Space') {
        if (!gameStarted) {
            gameStarted = true;
            hideInstructions();
        }
        
        if (!gameOver) {
            jump();
        }
    }
}

/**
 * Обрабатывает клик/тап по экрану
 */
function handleClick() {
    if (!gameStarted) {
        gameStarted = true;
        hideInstructions();
    }
    
    if (!gameOver) {
        jump();
    }
}

/**
 * Скрывает инструкции после начала игры
 */
function hideInstructions() {
    const instructions = document.getElementById('instructions');
    instructions.style.opacity = '0';
    setTimeout(() => {
        instructions.style.display = 'none';
    }, 500);
}

/**
 * Выполняет прыжок монеты
 */
function jump() {
    player.velocity = JUMP_FORCE;
    
    // Отправляем обновление позиции на сервер
    if (socket && socket.connected && roomId) {
        socket.emit('updatePosition', {
            roomId: roomId,
            position: {
                y: player.y
            }
        });
    }
}

/**
 * Проверяет столкновение игрока с препятствиями
 * @returns {boolean} Произошло ли столкновение
 */
function checkCollision() {
    // Проверка столкновения с землей или потолком
    if (player.y < 0 || player.y + player.height > canvas.height) {
        return true;
    }
    
    // Проверка столкновения с трубами
    for (let i = 0; i < pipes.length; i++) {
        const pipe = pipes[i];
        
        // Если монета находится в пределах трубы по X
        if (
            player.x + player.width > pipe.x && 
            player.x < pipe.x + 80 // Ширина трубы
        ) {
            // Проверяем, попадает ли монета в промежуток между трубами
            if (
                player.y < pipe.gapTop || 
                player.y + player.height > pipe.gapBottom
            ) {
                return true;
            }
        }
    }
    
    return false;
}

/**
 * Основной игровой цикл
 */
function gameLoop() {
    // Очищаем канвас
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Обновляем состояние игры, если она запущена
    if (gameStarted && !gameOver) {
        // Применяем гравитацию
        player.velocity += GRAVITY;
        player.y += player.velocity;
        
        // Двигаем трубы
        for (let i = 0; i < pipes.length; i++) {
            pipes[i].x -= PIPE_SPEED;
            
            // Если труба прошла игрока и счет еще не засчитан
            if (pipes[i].x + 80 < player.x && !pipes[i].counted) {
                player.score++;
                pipes[i].counted = true;
                
                // Обновляем отображение счета
                document.getElementById('score-container').textContent = `Счет: ${player.score}`;
                
                // Отправляем обновление счета на сервер
                if (socket && socket.connected && roomId) {
                    socket.emit('updateScore', {
                        roomId: roomId,
                        score: player.score
                    });
                }
            }
            
            // Если труба ушла за пределы экрана, удаляем ее
            if (pipes[i].x < -80) {
                pipes.splice(i, 1);
                i--;
            }
        }
        
        // Добавляем новую трубу, если необходимо
        if (pipes.length > 0) {
            if (canvas.width - pipes[pipes.length - 1].x > PIPE_SPACING) {
                addPipe();
            }
        }
        
        // Проверяем столкновение
        if (checkCollision()) {
            gameOver = true;
            showOverlay('Игра окончена', `Ваш счет: ${player.score}`, 'Вернуться в меню');
        }
    }
    
    // Рисуем игровые объекты
    drawGame();
    
    // Запрашиваем следующий кадр анимации
    animationId = requestAnimationFrame(gameLoop);
}

/**
 * Рисует все игровые объекты
 */
function drawGame() {
    // Рисуем фон (можно добавить картинку фона)
    ctx.fillStyle = '#1e272e';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Рисуем трубы
    drawPipes();
    
    // Рисуем монеты соперников
    drawOpponents();
    
    // Рисуем монету игрока
    drawPlayer();
}

/**
 * Рисует трубы (препятствия)
 */
function drawPipes() {
    ctx.fillStyle = '#2ecc71';
    
    for (let i = 0; i < pipes.length; i++) {
        const pipe = pipes[i];
        
        // Верхняя труба
        ctx.fillRect(pipe.x, 0, 80, pipe.gapTop);
        
        // Нижняя труба
        ctx.fillRect(pipe.x, pipe.gapBottom, 80, canvas.height - pipe.gapBottom);
        
        // Края труб (декоративные)
        ctx.fillStyle = '#27ae60';
        // Верхний край
        ctx.fillRect(pipe.x - 5, pipe.gapTop - 15, 90, 15);
        // Нижний край
        ctx.fillRect(pipe.x - 5, pipe.gapBottom, 90, 15);
        
        // Возвращаем основной цвет
        ctx.fillStyle = '#2ecc71';
    }
}

/**
 * Рисует монеты соперников
 */
function drawOpponents() {
    // Устанавливаем прозрачность для соперников
    ctx.globalAlpha = OPPONENT_OPACITY;
    
    // Рисуем каждого соперника
    for (const id in opponents) {
        if (id !== userData.id) {
            const opponent = opponents[id];
            
            // Рисуем монету соперника (используем тот же спрайт)
            if (coinFrames.length > 0) {
                ctx.drawImage(
                    coinFrames[0], 
                    opponent.x, 
                    opponent.y, 
                    opponent.width, 
                    opponent.height
                );
            } else {
                // Запасной вариант, если спрайт не загружен
                ctx.fillStyle = '#f39c12';
                ctx.beginPath();
                ctx.arc(
                    opponent.x + opponent.width / 2, 
                    opponent.y + opponent.height / 2, 
                    opponent.width / 2, 
                    0, 
                    Math.PI * 2
                );
                ctx.fill();
            }
        }
    }
    
    // Восстанавливаем прозрачность
    ctx.globalAlpha = 1.0;
}

/**
 * Рисует монету игрока
 */
function drawPlayer() {
    // Обновляем кадр анимации
    frameCounter++;
    if (frameCounter > 5) { // меняем кадр каждые 5 кадров
        frameCounter = 0;
        currentFrame = (currentFrame + 1) % coinFrames.length;
    }
    
    // Рисуем текущий кадр анимации монеты
    if (coinFrames.length > 0) {
        ctx.drawImage(
            coinFrames[currentFrame] || coinFrames[0], 
            player.x, 
            player.y, 
            player.width, 
            player.height
        );
    } else {
        // Запасной вариант, если спрайты не загружены
        ctx.fillStyle = '#f1c40f';
        ctx.beginPath();
        ctx.arc(
            player.x + player.width / 2, 
            player.y + player.height / 2, 
            player.width / 2, 
            0, 
            Math.PI * 2
        );
        ctx.fill();
    }
}

/**
 * Показывает оверлей с сообщением
 * @param {string} title - Заголовок сообщения
 * @param {string} text - Текст сообщения
 * @param {string} buttonText - Текст кнопки
 */
function showOverlay(title, text, buttonText) {
    const overlay = document.getElementById('game-overlay');
    document.getElementById('overlay-title').textContent = title;
    document.getElementById('overlay-text').textContent = text;
    document.getElementById('overlay-button').textContent = buttonText;
    
    overlay.style.display = 'flex';
} 