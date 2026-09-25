import { Room } from './types';
import Player from './player';
import { ColorArr, MaxTeamNum } from './constants';
import crypto from 'crypto';

export const DUMMY_BOT_ID_PREFIX = 'dummy_bot_';

export function isDummyBot(player: Pick<Player, 'id'>): boolean {
  return player.id.startsWith(DUMMY_BOT_ID_PREFIX);
}

export function addDummyBotToRoom(room: Room): Player | null {
  const allColor = Array.from({ length: ColorArr.length }, (_, i) => i);
  const occupiedColor = room.players.map((player) => player.color);
  occupiedColor.push(0); // 0 is reserved for neutral block
  const availableColor = allColor.filter((color) => {
    return !occupiedColor.includes(color);
  });
  const playerColor = availableColor[0];

  const allTeam = Array.from({ length: MaxTeamNum }, (_, i) => i + 1);
  const occupiedTeam = room.players.map((player) => player.team);
  const availableTeam = allTeam.filter((team) => {
    return !occupiedTeam.includes(team);
  });
  const playerTeam = availableTeam[0];

  if (playerColor === undefined || playerTeam === undefined) {
    return null; // The room has reached the supported player limit.
  }

  const botId = DUMMY_BOT_ID_PREFIX + crypto.randomUUID();
  const botSocketId = 'socket_' + botId; // doesn't need an actual socket

  const dummyBot = new Player(botId, botSocketId, 'Practice Opponent', playerColor, playerTeam);

  // Set codeforces properties so start validation doesn't fail
  dummyBot.codeforcesHandle = 'dummy_bot';
  dummyBot.codeforcesSolvedSetReady = true;

  // Since dummy bot doesn't emit any 'attack' events, it will just sit there.
  room.players.push(dummyBot);
  return dummyBot;
}
