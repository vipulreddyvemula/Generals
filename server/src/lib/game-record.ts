import { LeaderBoardTable, MapDiffData, Message, Player, GameRecordPerTurn } from './types';
import { promises as fsPromises, existsSync, mkdirSync } from 'fs';
import path from 'path';

/** Maximum turns stored in a replay file. Longer games are truncated. */
const MAX_REPLAY_TURNS = 3600;

class GameRecord {
  public gameRecordTurns: Array<GameRecordPerTurn> = [];
  public messagesRecord: Array<Message> = [];

  constructor(
    public players: Player[],
    public mapWidth: number,
    public mapHeight: number,
  ) { }

  addGameUpdate(
    data: MapDiffData,
    turn: number,
    lead: LeaderBoardTable
  ): void {
    this.gameRecordTurns.push({ data, turn, lead });
  }

  addMessage(message: Message): void {
    this.messagesRecord.push(message);
  }

  async outPutToJSON(dirname: string): Promise<string> {
    const filename = Math.random().toString(36).slice(-8);
    const recordsDir = path.join(dirname, 'records');

    if (!existsSync(recordsDir)) {
      mkdirSync(recordsDir, { recursive: true });
    }

    // Bound replay size to prevent unbounded memory/disk usage.
    const truncated = this.gameRecordTurns.length > MAX_REPLAY_TURNS;
    const payload = {
      players: this.players,
      mapWidth: this.mapWidth,
      mapHeight: this.mapHeight,
      messagesRecord: this.messagesRecord,
      gameRecordTurns: truncated
        ? this.gameRecordTurns.slice(0, MAX_REPLAY_TURNS)
        : this.gameRecordTurns,
      truncated,
    };

    // Non-blocking write — does NOT hold the event loop.
    await fsPromises.writeFile(
      path.join(recordsDir, `${filename}.json`),
      JSON.stringify(payload)
    );
    return filename;
  }
}

export default GameRecord;

