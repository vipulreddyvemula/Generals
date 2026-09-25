import { LeaderBoardTable, MapDiffData, Message, Player, GameRecordPerTurn } from './types';
import { LocalReplayStorage } from './replay-storage';

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
    await new LocalReplayStorage(dirname).saveReplay(filename, this.serialize());
    return filename;
  }

  serialize(): string {
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
    return JSON.stringify(payload);
  }
}

export default GameRecord;
