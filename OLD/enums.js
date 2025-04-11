/**
 * Состояния сервера
 * @enum {number}
 */
const ServerState = {
  WaitingForPlayers: 1,
  OnGame: 2,
  Ranking: 3
};

/**
 * Состояния игрока
 * @enum {number}
 */
const PlayerState = {
  OnLoginScreen: 1,
  WaitingInLobby: 2,
  Playing: 3,
  Died: 4
};

module.exports = {
  ServerState,
  PlayerState
};