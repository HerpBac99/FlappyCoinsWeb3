/**
 * Модуль управления скинами монет в игре
 * Предоставляет доступ к различным типам монет и их изображениям
 */

// Объект с доступными скинами монет
const availableSkins = {
    bitcoin: 'assets/bitcoin.png', 
    ethereum: 'assets/ethereum.png',
    dogecoin: 'assets/dogecoin.png'
};

// Скин по умолчанию
const defaultSkin = 'bitcoin';

/**
 * Получает путь к изображению для указанного скина
 * @param {string} skinName - Название скина монеты
 * @returns {string} - Путь к изображению скина
 */
function getSkinImagePath(skinName) {
    // Если скин не существует, возвращаем скин по умолчанию
    if (!skinName || !availableSkins[skinName]) {
        if (window.appLogger) {
            window.appLogger.warn(`Скин "${skinName}" не найден, используется скин по умолчанию`);
        } else {
            console.warn(`Скин "${skinName}" не найден, используется скин по умолчанию`);
        }
        skinName = defaultSkin;
    }
    
    return availableSkins[skinName];
}

/**
 * Проверяет существует ли указанный скин
 * @param {string} skinName - Название скина для проверки
 * @returns {boolean} - true если скин существует, иначе false
 */
function isSkinAvailable(skinName) {
    return !!availableSkins[skinName];
}

/**
 * Получает список всех доступных скинов
 * @returns {Object} - Объект с доступными скинами
 */
function getAllSkins() {
    return { ...availableSkins };
}

/**
 * Возвращает скин по умолчанию
 * @returns {string} - Название скина по умолчанию
 */
function getDefaultSkin() {
    return defaultSkin;
}

// Экспортируем функции в глобальное пространство имен
window.skinService = {
    getSkinImagePath,
    isSkinAvailable,
    getAllSkins,
    getDefaultSkin
}; 