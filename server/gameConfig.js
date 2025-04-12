/**
 * Константы и конфигурация игры FlappyCoin
 * Включает размеры, скорости, физические параметры
 * Адаптировано для вертикальной ориентации мобильных устройств
 */

const DEFAULT_WIDTH = 500;   // Стандартная ширина игрового поля
const DEFAULT_HEIGHT = 800;  // Стандартная высота игрового поля (вертикальная ориентация)

// Базовая конфигурация игры
const gameConfig = {
    // Размеры игрового поля (могут быть переопределены)
    SCREEN_WIDTH: DEFAULT_WIDTH,
    SCREEN_HEIGHT: DEFAULT_HEIGHT,
    
    // Размеры птицы
    BIRD_WIDTH: 40,
    BIRD_HEIGHT: 40,
    
    // Размеры труб
    PIPE_WIDTH: 80,
    
    // Диапазон высоты для верхней трубы
    MIN_PIPE_HEIGHT: 50,  
    MAX_PIPE_HEIGHT: 250,
    
    // Вертикальное расстояние между верхней и нижней трубами
    HEIGHT_BETWEEN_PIPES: 200,
    
    // Горизонтальное расстояние между парами труб
    DISTANCE_BETWEEN_PIPES: 300,
    
    // Позиция пола (земли)
    FLOOR_POS_Y: 750,
    
    // Скорость игры и физические параметры
    LEVEL_SPEED: 0.15,      // Скорость движения труб
    
    // Параметры многопользовательской игры
    MAX_PLAYERS_PER_ROOM: 6,
    TIME_BETWEEN_GAMES: 10000, // 10 секунд между играми
    
    // Адрес WebSocket сервера
    SOCKET_ADDR: process.env.SOCKET_ADDR || 'wss://flappycoins.com',
    
    // Флаг отладки
    DEBUG: process.env.NODE_ENV !== 'production'
};

/**
 * Обновляет размеры экрана в конфигурации
 * @param {number} width - Новая ширина экрана
 * @param {number} height - Новая высота экрана
 */
function updateScreenSize(width, height) {
    if (width && height) {
        // Проверяем, что значения положительные
        if (width > 0 && height > 0) {
            gameConfig.SCREEN_WIDTH = width;
            gameConfig.SCREEN_HEIGHT = height;
            
            // Обновляем позицию пола
            gameConfig.FLOOR_POS_Y = height - 50;
            
            console.log(`Размеры экрана обновлены: ${width}x${height}`);
            return true;
        }
    }
    
    console.warn('Неверные размеры экрана, используются значения по умолчанию');
    return false;
}

module.exports = {
    gameConfig,
    updateScreenSize
}; 