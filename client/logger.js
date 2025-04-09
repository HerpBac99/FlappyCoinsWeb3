// Константы для логирования
const LOG_STORAGE_KEY = 'flappyCoin_logs'; // Ключ для хранения логов в localStorage
const MAX_STORED_LOGS = 1000; // Максимальное количество хранимых логов

/**
 * Система логирования для клиентской части
 * Сохраняет логи в localStorage и предоставляет интерфейс для их просмотра
 */
const Logger = {
    logs: [],
    
    /**
     * Инициализация системы логирования
     * @returns {Object} Объект логгера для цепочки вызовов
     */
    init() {
        // Загружаем логи из localStorage, если они существуют
        try {
            const storedLogs = localStorage.getItem(LOG_STORAGE_KEY);
            if (storedLogs) {
                this.logs = JSON.parse(storedLogs);
                console.log(`Загружено ${this.logs.length} ранее сохраненных логов`);
            }
        } catch (error) {
            console.error('Ошибка при загрузке логов из localStorage:', error);
        }
        
        // Создаем UI для просмотра логов
        this.createLogUI();
        
        // Устанавливаем перехватчик для необработанных ошибок
        window.addEventListener('error', (event) => {
            this.log('Необработанная ошибка: ' + event.message, 'error', {
                filename: event.filename,
                lineno: event.lineno,
                colno: event.colno,
                stack: event.error ? event.error.stack : null
            });
            this.saveLogs();
        });
        
        // Перехватываем события WebSocket для логирования
        this.interceptSocketEvents();
        
        console.log('Система логирования инициализирована');
        return this;
    },
    
    /**
     * Перехватывает события WebSocket для логирования
     */
    interceptSocketEvents() {
        if (window.io) {
            const originalIO = window.io;
            window.io = function() {
                const socket = originalIO.apply(this, arguments);
                
                // Сохраняем оригинальные методы
                const originalOn = socket.on;
                const originalEmit = socket.emit;
                
                // Перехватываем метод on для логирования входящих событий
                socket.on = function(event, callback) {
                    return originalOn.call(this, event, function() {
                        // Логируем входящее событие
                        const args = Array.from(arguments);
                        Logger.log(`Получено событие Socket.IO: ${event}`, 'debug', 
                            args.length > 0 ? args[0] : null);
                        
                        // Вызываем оригинальный обработчик
                        callback.apply(this, arguments);
                    });
                };
                
                // Перехватываем метод emit для логирования исходящих событий
                socket.emit = function(event) {
                    // Логируем исходящее событие (кроме системных событий)
                    if (!event.startsWith('ping') && event !== 'pong') {
                        const args = Array.from(arguments).slice(1);
                        Logger.log(`Отправлено событие Socket.IO: ${event}`, 'debug', 
                            args.length > 0 ? args[0] : null);
                    }
                    
                    // Вызываем оригинальный метод
                    return originalEmit.apply(this, arguments);
                };
                
                return socket;
            };
        }
    },
    
    /**
     * Создание интерфейса для просмотра логов
     */
    createLogUI() {
        // Создаем кнопку просмотра логов
        const viewLogsBtn = document.createElement('button');
        viewLogsBtn.id = 'view-logs-btn';
        viewLogsBtn.textContent = '🔍 Логи';
        viewLogsBtn.style.cssText = `
            position: fixed;
            bottom: 10px;
            right: 10px;
            padding: 8px 12px;
            background-color: rgba(0, 0, 0, 0.6);
            color: white;
            border: none;
            border-radius: 4px;
            font-size: 12px;
            z-index: 9999;
            cursor: pointer;
        `;
        
        // Создаем модальное окно для просмотра логов
        const logModal = document.createElement('div');
        logModal.id = 'log-modal';
        logModal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background-color: rgba(0, 0, 0, 0.9);
            z-index: 10000;
            display: none;
            flex-direction: column;
            color: white;
            font-family: monospace;
            padding: 10px;
        `;
        
        // Создаем заголовок и кнопки управления
        const modalHeader = document.createElement('div');
        modalHeader.style.cssText = `
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 10px;
        `;
        
        const modalTitle = document.createElement('h3');
        modalTitle.textContent = 'Журнал логов FlappyCoin';
        modalTitle.style.margin = '0';
        
        // Создаем контейнер для содержимого логов
        const logContent = document.createElement('div');
        logContent.id = 'log-content';
        logContent.style.cssText = `
            flex: 1;
            overflow-y: auto;
            background-color: rgba(0, 0, 0, 0.5);
            padding: 10px;
            border-radius: 4px;
            font-size: 11px;
            white-space: pre-wrap;
        `;
        
        // Создаем панель инструментов для работы с логами
        const logToolbar = document.createElement('div');
        logToolbar.style.cssText = `
            display: flex;
            justify-content: space-between;
            flex-wrap: wrap;
            gap: 10px;
            margin-top: 10px;
            width: 100%;
        `;
        
        const copyLogsBtn = document.createElement('button');
        copyLogsBtn.textContent = 'Копировать';
        copyLogsBtn.className = 'log-btn';
        
        const sendLogsBtn = document.createElement('button');
        sendLogsBtn.textContent = 'Отправить';
        sendLogsBtn.className = 'log-btn';
        
        const clearLogsBtn = document.createElement('button');
        clearLogsBtn.textContent = 'Очистить';
        clearLogsBtn.className = 'log-btn';
        
        const exitLogsBtn = document.createElement('button');
        exitLogsBtn.textContent = 'Выход';
        exitLogsBtn.className = 'log-btn';
        
        // Добавляем стиль для кнопок
        const style = document.createElement('style');
        style.textContent = `
            .log-btn {
                background-color: #40a7e3;
                color: white;
                border: none;
                border-radius: 4px;
                cursor: pointer;
                font-size: 12px;
                flex: 1;
                padding: 10px;
                min-width: 70px;
                text-align: center;
                margin-bottom: 30px;
            }
            .log-btn:hover {
                background-color: #2c7db2;
            }
            .log-entry {
                margin-bottom: 4px;
                padding-bottom: 4px;
                border-bottom: 1px solid rgba(255,255,255,0.1);
            }
            .log-info { color: #90caf9; }
            .log-debug { color: #80deea; }
            .log-warn { color: #ffcc80; }
            .log-error { color: #ef9a9a; }
            
            @media (max-width: 480px) {
                .log-btn {
                    padding: 8px 4px;
                    font-size: 11px;
                    min-width: 60px;
                }
                
                .log-toolbar {
                    justify-content: center;
                }
            }
        `;
        
        // Собираем структуру UI
        modalHeader.appendChild(modalTitle);
        
        logToolbar.appendChild(copyLogsBtn);
        logToolbar.appendChild(sendLogsBtn);
        logToolbar.appendChild(clearLogsBtn);
        logToolbar.appendChild(exitLogsBtn);
        
        logModal.appendChild(modalHeader);
        logModal.appendChild(logContent);
        logModal.appendChild(logToolbar);
        
        document.head.appendChild(style);
        
        // Добавляем элементы в DOM после загрузки страницы
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                document.body.appendChild(viewLogsBtn);
                document.body.appendChild(logModal);
            });
        } else {
            document.body.appendChild(viewLogsBtn);
            document.body.appendChild(logModal);
        }
        
        // События для кнопок
        viewLogsBtn.addEventListener('click', () => {
            this.updateLogDisplay();
            logModal.style.display = 'flex';
        });
        
        copyLogsBtn.addEventListener('click', () => {
            this.copyLogs();
        });
        
        sendLogsBtn.addEventListener('click', () => {
            this.sendLogsToServer();
        });
        
        clearLogsBtn.addEventListener('click', () => {
            if (confirm('Очистить все логи?')) {
                this.clearLogs();
                this.updateLogDisplay();
            }
        });
        
        exitLogsBtn.addEventListener('click', () => {
            logModal.style.display = 'none';
        });
    },
    
    /**
     * Вывод логов в модальное окно
     */
    updateLogDisplay() {
        const logContent = document.getElementById('log-content');
        if (!logContent) return;
        
        logContent.innerHTML = '';
        
        if (this.logs.length === 0) {
            logContent.innerHTML = '<em>Нет записей в журнале</em>';
            return;
        }
        
        const logsToShow = this.logs.slice(-500); // Показываем до 500 последних логов для производительности
        
        logsToShow.forEach(log => {
            const logEntry = document.createElement('div');
            logEntry.className = `log-entry log-${log.level}`;
            
            // Форматируем лог
            logEntry.innerHTML = `
                <strong>[${log.timestamp}]</strong> 
                <span class="log-level">[${log.level.toUpperCase()}]</span> 
                <span class="log-message">${log.message}</span>
                <br><small class="log-caller">${log.caller}</small>
                ${log.data ? `<br><small class="log-data">${JSON.stringify(log.data)}</small>` : ''}
            `;
            
            logContent.appendChild(logEntry);
        });
        
        // Прокручиваем к последнему логу
        logContent.scrollTop = logContent.scrollHeight;
    },
    
    /**
     * Форматирование логов для экспорта
     * @returns {string} Форматированная строка с логами
     */
    formatLogsForExport() {
        return this.logs.map(log => {
            return `[${log.timestamp}] [${log.level.toUpperCase()}] ${log.message} (${log.caller})${log.data ? '\n  Данные: ' + JSON.stringify(log.data) : ''}`;
        }).join('\n');
    },
    
    /**
     * Сохранение логов в localStorage
     */
    saveLogs() {
        try {
            // Обрезаем логи, если их слишком много
            if (this.logs.length > MAX_STORED_LOGS) {
                this.logs = this.logs.slice(-MAX_STORED_LOGS);
            }
            
            localStorage.setItem(LOG_STORAGE_KEY, JSON.stringify(this.logs));
        } catch (error) {
            console.error('Ошибка при сохранении логов в localStorage:', error);
        }
    },
    
    /**
     * Очистка логов
     */
    clearLogs() {
        this.logs = [];
        this.saveLogs();
    },
    
    /**
     * Получение информации о вызывающей функции
     * @returns {string} Строка с информацией о вызывающей функции
     */
    getCallerInfo() {
        try {
            const stackTrace = new Error().stack;
            const lines = stackTrace.split('\n');
            
            // Первая строка - это сам Error()
            // Вторая строка - это вызов текущего метода (log)
            // Третья строка - это вызов Logger.log или appLogger
            // Четвертая строка - это то, что нам нужно - вызывающая функция
            if (lines.length >= 4) {
                const callerLine = lines[3].trim();
                
                // Извлекаем имя функции и номер строки
                const functionMatch = callerLine.match(/at\s+([^\s]+)\s+\((.+):(\d+):(\d+)\)/);
                if (functionMatch) {
                    const [_, functionName, file, line, col] = functionMatch;
                    // Получаем только имя файла без пути
                    const fileName = file.split('/').pop();
                    return `${functionName} в ${fileName}:${line}`;
                }
                
                // Если не удалось извлечь по первому паттерну, пробуем другой паттерн
                const anonymousMatch = callerLine.match(/at\s+(.+):(\d+):(\d+)/);
                if (anonymousMatch) {
                    const [_, file, line, col] = anonymousMatch;
                    const fileName = file.split('/').pop();
                    return `${fileName}:${line}`;
                }
                
                // Возвращаем всю строку, если не удалось распарсить
                return callerLine.replace(/^\s*at\s+/, '');
            }
            
            return 'неизвестно';
        } catch (e) {
            return 'ошибка определения';
        }
    },
    
    /**
     * Основной метод логирования
     * @param {string} message - Сообщение для логирования
     * @param {string} level - Уровень логирования (info, debug, warn, error)
     * @param {Object} data - Дополнительные данные для логирования
     * @param {string} caller - Информация о вызывающей функции (если null, определяется автоматически)
     * @returns {Object} Объект записи лога
     */
    log(message, level = 'info', data = null, caller = null) {
        // Получаем информацию о вызывающей функции
        const callerInfo = caller || this.getCallerInfo();
        
        // Создаем метку времени
        const timestamp = new Date().toISOString();
        
        // Создаем объект лога
        const logEntry = {
            timestamp,
            level,
            message,
            caller: callerInfo,
            data: data
        };
        
        // Добавляем в массив логов
        this.logs.push(logEntry);
        
        // Логируем в консоль браузера
        const consoleMsg = `[${timestamp}] [${level.toUpperCase()}] ${message} (${callerInfo})`;
        switch (level) {
            case 'error':
                console.error(consoleMsg, data || '');
                break;
            case 'warn':
                console.warn(consoleMsg, data || '');
                break;
            case 'debug':
                console.debug(consoleMsg, data || '');
                break;
            default:
                console.log(consoleMsg, data || '');
        }
        
        // Сохраняем логи в localStorage
        this.saveLogs();
        
        return logEntry;
    },
    
    /**
     * Отправка логов на сервер
     */
    sendLogsToServer() {
        const logContent = document.getElementById('log-content');
        if (!logContent) return;
        
        // Показываем статус отправки
        const previousContent = logContent.innerHTML;
        logContent.innerHTML = '<div style="text-align: center; padding: 20px;">Отправка логов на сервер...</div>';
        
        // Получаем данные пользователя из приложения
        let userData = null;
        if (window.app && window.app.getState) {
            userData = window.app.getState().userData;
        }
        
        // Собираем данные для отправки
        const logsData = {
            logs: this.logs,
            userAgent: navigator.userAgent,
            appVersion: '1.0.0', // Версия приложения
            timestamp: new Date().toISOString(),
            userData: userData || {}
        };
        
        // Логируем события отправки
        console.log('Отправка логов на сервер', {
            logsCount: this.logs.length,
            timestamp: logsData.timestamp,
            userData: userData ? userData.username : 'Нет данных пользователя'
        });
        
        // Отправляем на сервер
        fetch(`/api/log`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(logsData)
        })
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP ошибка: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            if (data.success) {
                logContent.innerHTML = '<div style="text-align: center; padding: 20px; color: #81c784;">Логи успешно отправлены на сервер!</div>';
                setTimeout(() => {
                    logContent.innerHTML = previousContent;
                }, 2000);
            } else {
                throw new Error(data.error || 'Неизвестная ошибка');
            }
        })
        .catch(error => {
            logContent.innerHTML = `<div style="text-align: center; padding: 20px; color: #e57373;">Ошибка при отправке логов: ${error.message}</div>`;
            setTimeout(() => {
                logContent.innerHTML = previousContent;
            }, 3000);
        });
    },
    
    /**
     * Копирует логи в буфер обмена
     */
    copyLogs() {
        try {
            // Преобразуем логи в текстовый формат
            const logsText = this.formatLogsForCopy();
            
            // Проверяем, в фокусе ли документ
            if (!document.hasFocus()) {
                console.warn('Не удалось скопировать логи: документ не в фокусе');
                alert('Не удалось скопировать логи: документ не в фокусе. Пожалуйста, кликните на странице и попробуйте снова.');
                return false;
            }
            
            // Пробуем использовать современный асинхронный API буфера обмена
            if (navigator.clipboard && navigator.clipboard.writeText) {
                navigator.clipboard.writeText(logsText)
                    .then(() => {
                        console.log('Логи успешно скопированы в буфер обмена');
                        alert('Логи скопированы в буфер обмена');
                    })
                    .catch(err => {
                        console.error('Ошибка при копировании логов:', err);
                        this.fallbackCopyToClipboard(logsText);
                    });
                return true;
            } else {
                // Запасной вариант для старых браузеров
                return this.fallbackCopyToClipboard(logsText);
            }
        } catch (error) {
            console.error('Ошибка при копировании логов:', error);
            alert('Не удалось скопировать логи: ' + error.message);
            return false;
        }
    },

    /**
     * Запасной метод копирования в буфер обмена через создание временного элемента
     * @param {string} text - Текст для копирования
     * @returns {boolean} - Успешность операции
     */
    fallbackCopyToClipboard(text) {
        try {
            // Создаем временный textarea элемент
            const textarea = document.createElement('textarea');
            textarea.value = text;
            
            // Скрываем элемент, но оставляем его в DOM
            textarea.style.position = 'fixed';
            textarea.style.opacity = '0';
            textarea.style.pointerEvents = 'none';
            
            document.body.appendChild(textarea);
            textarea.focus();
            textarea.select();
            
            // Пытаемся скопировать
            const successful = document.execCommand('copy');
            document.body.removeChild(textarea);
            
            if (successful) {
                console.log('Логи успешно скопированы (запасной метод)');
                alert('Логи скопированы в буфер обмена');
                return true;
            } else {
                console.error('Не удалось скопировать логи (запасной метод)');
                alert('Не удалось скопировать логи. Пожалуйста, сделайте это вручную.');
                return false;
            }
        } catch (error) {
            console.error('Ошибка при запасном методе копирования:', error);
            alert('Не удалось скопировать логи: ' + error.message);
            return false;
        }
    },

    /**
     * Форматирует логи для копирования в буфер обмена
     * @returns {string} - Отформатированные логи в виде текста
     */
    formatLogsForCopy() {
        try {
            let logsText = 'ЛОГИ ПРИЛОЖЕНИЯ\n';
            logsText += `Время экспорта: ${new Date().toISOString()}\n`;
            logsText += `Версия приложения: ${window.appVersion || 'Неизвестно'}\n`;
            logsText += `User Agent: ${navigator.userAgent}\n`;
            logsText += '----------------------------------------------------\n\n';
            
            // Добавляем каждый лог
            this.logs.forEach(log => {
                logsText += `[${log.timestamp}] [${log.level.toUpperCase()}] ${log.message}\n`;
                
                // Добавляем информацию о вызывающем коде
                if (log.caller) {
                    logsText += `Вызов из: ${log.caller}\n`;
                }
                
                // Добавляем дополнительные данные, если они есть
                if (log.data) {
                    try {
                        const dataStr = typeof log.data === 'object' 
                            ? JSON.stringify(log.data, null, 2) 
                            : log.data.toString();
                        logsText += `Данные: ${dataStr}\n`;
                    } catch (e) {
                        logsText += `Данные: [Не удалось преобразовать данные в строку: ${e.message}]\n`;
                    }
                }
                
                logsText += '\n';
            });
            
            return logsText;
        } catch (error) {
            console.error('Ошибка при форматировании логов для копирования:', error);
            return `Ошибка при форматировании логов: ${error.message}`;
        }
    }
};

// Создаем удобные методы для логирования разных уровней
const appLogger = {
    info: (message, data = null) => Logger.log(message, 'info', data),
    debug: (message, data = null) => Logger.log(message, 'debug', data),
    warn: (message, data = null) => Logger.log(message, 'warn', data),
    error: (message, data = null) => Logger.log(message, 'error', data)
};

// Инициализируем логгер при загрузке скрипта
Logger.init();

// Экспортируем для использования в других файлах
window.appLogger = appLogger;

/**
 * Безопасно вызывает метод Telegram WebApp API с проверкой его существования
 * @param {Object} tgApp - Объект Telegram WebApp
 * @param {string} methodName - Имя метода для вызова
 * @param {Array} args - Аргументы для метода
 * @returns {*} Результат вызова метода или null при ошибке
 */
function safeCallTgMethod(tgApp, methodName, args = []) {
    try {
        if (!tgApp) {
            appLogger.warn(`Telegram WebApp API не доступен`);
            return null;
        }
        
        if (typeof tgApp[methodName] !== 'function') {
            appLogger.warn(`Метод ${methodName} не существует в Telegram WebApp API`);
            return null;
        }
        
        return tgApp[methodName](...args);
    } catch (error) {
        appLogger.error(`Ошибка при вызове метода ${methodName}`, { error: error.message });
        return null;
    }
}

// Экспортируем для использования в других файлах
window.safeCallTgMethod = safeCallTgMethod; 