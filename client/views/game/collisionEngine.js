/**
 * Модуль определения столкновений в игре
 * Отвечает за проверку столкновений монеты (птицы) с трубами и землей
 * Адаптирован для работы на клиентской стороне
 */
class CollisionEngine {
    /**
     * Создает экземпляр движка столкновений
     */
    constructor() {
        if (window.appLogger) {
            window.appLogger.info('CollisionEngine инициализирован');
        }
    }
    
    /**
     * Проверяет столкновение конкретной птицы с конкретной трубой
     * @param {Object} pipe - Объект трубы с координатами и размерами
     * @param {Player} playerInstance - Экземпляр игрока (птицы)
     * @returns {boolean} true если произошло столкновение, false если нет
     */
    checkPlayerCollision(pipe, playerInstance) {
        const { GameParams } = window.GameConstants;
        const player = playerInstance.getPlayerObject();
        
        // Не проверяем столкновения для мертвых игроков
        if (playerInstance.isDead()) {
            return false;
        }
        
        const birdCenterX = player.posX + (GameParams.BIRD_WIDTH / 2);
        const birdCenterY = player.posY + (GameParams.BIRD_HEIGHT / 2);
        const pipeCenterX = pipe.posX + (GameParams.PIPE_WIDTH / 2);

        // Проверяем горизонтальное столкновение
        const horizontalCollision = (
            (player.posX + GameParams.BIRD_WIDTH) > pipe.posX && 
            player.posX < (pipe.posX + GameParams.PIPE_WIDTH)
        );

        if (horizontalCollision) {
            // Если центр птицы прошел центр трубы и еще не засчитан очек
            if (birdCenterX >= pipeCenterX && !pipe.scored) {
                playerInstance.updateScore(pipe.id);
                pipe.scored = true;
                
                if (window.appLogger) {
                    window.appLogger.debug('Обновлен счет игрока при прохождении трубы', {
                        userId: player.userId,
                        username: player.username,
                        pipeId: pipe.id
                    });
                }
            }

            // Проверяем вертикальное столкновение только если очки еще не засчитаны
            // (это позволяет избежать ложных столкновений после прохождения трубы)
            if (!pipe.scored) {
                const upperCollision = player.posY < pipe.posY;
                const lowerCollision = (player.posY + GameParams.BIRD_HEIGHT) > (pipe.posY + GameParams.HEIGHT_BETWEEN_PIPES);

                if (upperCollision || lowerCollision) {
                    if (window.appLogger) {
                        window.appLogger.info('Обнаружено столкновение с трубой', {
                            userId: player.userId,
                            username: player.username,
                            pipeId: pipe.id,
                            collisionType: upperCollision ? 'верхняя труба' : 'нижняя труба'
                        });
                    }
                    return true;
                }
            }
        }

        // Проверяем столкновение с землей
        const groundCollision = player.posY + GameParams.BIRD_HEIGHT > GameParams.FLOOR_POS_Y;
        if (groundCollision) {
            if (window.appLogger) {
                window.appLogger.info('Обнаружено столкновение с землей', {
                    userId: player.userId,
                    username: player.username
                });
            }
            return true;
        }

        return false;
    }

    /**
     * Проверяет столкновения всех активных птиц со всеми активными трубами
     * @param {Array} pipes - Массив труб
     * @param {Array} players - Массив игроков
     * @returns {boolean} true если было хотя бы одно столкновение
     */
    checkCollisions(pipes, players) {
        let hasCollision = false;

        // Для каждой трубы проверяем столкновение со всеми игроками
        for (const pipe of pipes) {
            for (const player of players) {
                if (this.checkPlayerCollision(pipe, player)) {
                    // Если произошло столкновение, убиваем игрока
                    // (передаем количество оставшихся игроков для расчета ранга)
                    player.die(players.filter(p => p.isActive()).length);
                    hasCollision = true;
                }
            }
        }

        return hasCollision;
    }
}

// Экспортируем класс в глобальное пространство имен
window.CollisionEngine = CollisionEngine; 