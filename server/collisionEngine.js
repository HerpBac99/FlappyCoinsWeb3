/**
 * Модуль определения столкновений в игре
 * Отвечает за проверку столкновений птицы с трубами и землей
 */

/**
 * Проверяет столкновение конкретной птицы с конкретной трубой
 * @param {Object} pipe - Объект трубы с координатами и размерами
 * @param {Object} player - Экземпляр игрока (птицы)
 * @param {Object} gameConfig - Конфигурация игры с константами
 * @returns {boolean} true если произошло столкновение, false если нет
 */
const checkBirdCollision = (pipe, player, gameConfig) => {
    const playerData = player.getPlayerData();
    
    // Вычисляем центры объектов для более точной проверки столкновений
    const birdCenterX = playerData.posX + (gameConfig.BIRD_WIDTH / 2);
    const birdCenterY = playerData.posY + (gameConfig.BIRD_HEIGHT / 2);
    const pipeCenterX = pipe.posX + (gameConfig.PIPE_WIDTH / 2);

    // Проверяем горизонтальное пересечение (птица и труба находятся на одной X-координате)
    const horizontalCollision = (
        (playerData.posX + gameConfig.BIRD_WIDTH) > pipe.posX && 
        playerData.posX < (pipe.posX + gameConfig.PIPE_WIDTH)
    );

    if (horizontalCollision) {
        // Если птица пересекла центр трубы и труба еще не отмечена, увеличиваем счет
        if (birdCenterX >= pipeCenterX && !pipe.scored) {
            player.updateScore(pipe.id);
            // Помечаем трубу как пройденную
            pipe.scored = true;
        }

        // Проверяем столкновение только если труба не отмечена как пройденная
        // Это предотвращает ложные столкновения после начисления очков
        if (!pipe.scored) {
            // Проверяем, не столкнулась ли птица с верхней или нижней частью трубы
            const upperCollision = playerData.posY < pipe.posY;
            const lowerCollision = (playerData.posY + gameConfig.BIRD_HEIGHT) > (pipe.posY + gameConfig.HEIGHT_BETWEEN_PIPES);

            if (upperCollision || lowerCollision) {
                console.log(`Обнаружено столкновение для игрока ${playerData.username}`);
                return true;
            }
        }
    }

    // Проверка столкновения с землей (нижней границей экрана)
    const groundCollision = playerData.posY + gameConfig.BIRD_HEIGHT > gameConfig.FLOOR_POS_Y;
    if (groundCollision) {
        console.log(`Столкновение с землей для игрока ${playerData.username}`);
        return true;
    }

    return false;
};

/**
 * Проверяет столкновения всех активных птиц со всеми активными трубами
 * @param {Array} pipes - Массив труб
 * @param {Array} players - Массив игроков
 * @param {Object} gameConfig - Конфигурация игры с константами
 * @returns {boolean} true если было хотя бы одно столкновение
 */
const checkCollisions = (pipes, players, gameConfig) => {
    let thereIsCollision = false;

    for (const pipe of pipes) {
        for (const player of players) {
            // Проверяем только играющих (не умерших) игроков
            if (player.isPlaying() && checkBirdCollision(pipe, player, gameConfig)) {
                // Регистрируем смерть игрока, передавая количество оставшихся игроков
                player.die(players.filter(p => p.isPlaying()).length);
                thereIsCollision = true;
            }
        }
    }

    return thereIsCollision;
};

module.exports = {
    checkCollisions,
    checkBirdCollision
}; 