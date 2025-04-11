/**
 * Модуль управления игровыми счетами и рекордами игроков
 * @module ScoreSystem
 */
const db = require('../utils/db');
const createLogger = require('../utils/logger');
const logger = createLogger('ScoreSystem');
const mysql = require('mysql');

// Количество рекордов, возвращаемых в таблицу лидеров
const NUMBER_OF_HIGHSCORES_TO_RETRIEVE = 10;

// SQL-запросы
const SQL_QUERIES = {
  GET_HIGHSCORES: `SELECT * FROM highscores ORDER BY highscores.hs_score DESC LIMIT 0, ?`,
  GET_PLAYER_SCORE: `SELECT hs_score AS HS FROM highscores WHERE hs_player = ?`,
  INSERT_PLAYER: `INSERT INTO highscores (hs_id, hs_player, hs_score) VALUES (NULL, ?, '0')`,
  UPDATE_SCORE: `UPDATE highscores SET hs_score = ? WHERE highscores.hs_player = ?`
};

// Получаем настройки базы данных из окружения или используем значения по умолчанию
const DB_CONFIG = {
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'flappycoin'
};

/**
 * Класс для управления системой счета и рекордов
 * @class ScoreSystem
 */
class ScoreSystem {
  /**
   * Создает экземпляр системы счета
   * Пытается установить соединение с БД или использует массив для хранения рекордов
   */
  constructor() {
    // Закомментировали инициализацию SQL
    // this.connection = null;
    // this._testDbConnection();
    this.highScores = [];
    this.usersData = require('../data/telegramUsers.json');
  }

  // Закомментировали методы работы с SQL
  /*
  _testDbConnection() {
    // ... existing SQL code ...
  }

  _openConnection() {
    // ... existing SQL code ...
  }
  */

  /**
   * Устанавливает рекорд игрока при входе в игру
   * @param {Object} player - Объект игрока
   */
  setPlayerHighScore(player) {
    const user = this.usersData.find(u => u.telegramId === player.getID());
    if (user) {
      player.setBestScore(user.score || 0);
    }
  }

  /**
   * Сохраняет новый рекорд игрока, если текущий счет выше предыдущего
   * @param {Object} player - Объект игрока
   * @param {number} lastScore - Последний счет игрока
   */
  savePlayerScore(player, lastScore) {
    const user = this.usersData.find(u => u.telegramId === player.getID());
    if (user) {
      user.score = (user.score || 0) + lastScore;
      this._saveToFile();
    }
  }

  /**
   * Получает список лучших рекордов для отображения в таблице лидеров
   * @param {Function} callback - Функция обратного вызова, принимающая массив результатов
   */
  async getHighScores(callback) {
    // Сортируем пользователей по score и берем топ 10
    const sortedUsers = this.usersData
      .filter(u => u.score)
      .sort((a, b) => b.score - a.score)
      .slice(0, 10)
      .map(u => ({
        nick: u.nickname,
        score: u.score
      }));

    if (callback) {
      callback(sortedUsers);
    }
    return sortedUsers;
  }

  _getMemoryHighScores() {
    return this.highScores;
  }

  // Закомментировали метод работы с SQL
  /*
  async _getDbHighScores() {
    // ... existing SQL code ...
  }
  */

  _saveToFile() {
    const fs = require('fs');
    const path = require('path');
    const filePath = path.join(__dirname, '../data/telegramUsers.json');
    fs.writeFileSync(filePath, JSON.stringify(this.usersData, null, 2));
  }
}

module.exports = ScoreSystem;