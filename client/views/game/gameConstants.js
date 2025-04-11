/**
 * Константы и перечисления для игры FlappyCoin
 * Содержит все необходимые параметры для игровой механики, физики и отображения
 */

// Состояния игры
const GameState = {
    WAITING: 1,   // Ожидание игроков
    PLAYING: 2,   // Активная игра
    RANKING: 3    // Показ результатов
};

// Состояния игрока
const PlayerState = {
    MENU: 1,         // Игрок в меню
    WAITING: 2,      // Игрок в комнате ожидания
    PLAYING: 3,      // Игрок активно играет
    DIED: 4          // Игрок проиграл
};

// Размеры и параметры игровых объектов
const GameParams = {
    // Размеры экрана
    SCREEN_WIDTH: 800,
    SCREEN_HEIGHT: 600,
    
    // Параметры птицы (монеты)
    BIRD_WIDTH: 40,
    BIRD_HEIGHT: 40,
    START_BIRD_POS_X: 50,
    START_BIRD_POS_Y: 150,
    SPACE_BETWEEN_BIRDS_X: 120,
    SPACE_BETWEEN_BIRDS_Y: 50,
    
    // Физика игры
    GRAVITY_SPEED: 0.05,
    JUMP_SPEED: -0.6,
    MAX_ROTATION: -10,
    MIN_ROTATION: 60,
    ROTATION_SPEED: 8,
    
    // Параметры труб
    PIPE_WIDTH: 80,
    MIN_PIPE_HEIGHT: 100,
    MAX_PIPE_HEIGHT: 300,
    HEIGHT_BETWEEN_PIPES: 200,
    DISTANCE_BETWEEN_PIPES: 300,
    LEVEL_SPEED: 0.15,
    
    // Позиция земли
    FLOOR_POS_Y: 550,
    
    // Таймеры
    TIME_BETWEEN_GAMES: 5000,
    COUNTDOWN_SECONDS: 5
};

// Эффекты и анимации
const Effects = {
    COIN_ROTATE_SPEED: 5,
    COIN_FLOAT_AMPLITUDE: 10,
    COIN_FLOAT_SPEED: 2
};

// Экспортируем все константы
window.GameConstants = {
    GameState,
    PlayerState,
    GameParams,
    Effects
}; 