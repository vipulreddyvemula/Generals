// import Player from "@/lib/Player";
// 循环引用..
import { TileType, TileProp, Point } from './types';

class Block extends Point {
  constructor(
    public x: number,
    public y: number,
    public type: TileType,
    public unit: number = 0,
    public player: any = null,
    public isAlwaysRevealed: boolean = false,
    public priority: number = 0,
    public unitsCountRevealed: boolean = true,
    public fortifyUntilTurn: number = 0
  ) {
    super(x, y);
  }

  setUnit(unit: number): void {
    this.unit = unit;
  }

  setType(type: TileType): void {
    this.type = type;
  }

  kingBeDominated(): void {
    this.type = TileType.City;
  }

  beDominated(player: any, unit: number): void {
    if (this.player) {
      this.player.loseLand(this);
    }
    this.player = player;
    this.player.winLand(this);
  }

  initKing(player: any): void {
    this.type = TileType.King;
    this.unit = 1;
    this.player = player;
  }

  enterUnit(player: any, unit: number, currentTurn: number = 0): void {
    if (this.player && this.player.team === player.team) {
      this.unit += unit;
      if (this.type !== TileType.King) this.beDominated(player, unit);
    } else {
      let defenseUnit = this.unit;
      if (this.fortifyUntilTurn > currentTurn) {
        defenseUnit *= 2; // Fortify multiplies defense by 2
      }
      
      if (defenseUnit >= unit) {
        this.unit = defenseUnit - unit;
        if (this.fortifyUntilTurn > currentTurn) {
          this.unit = Math.ceil(this.unit / 2); // Restore actual unit count
        }
      } else {
        this.unit = unit - defenseUnit;
        this.fortifyUntilTurn = 0; // Fortify broken
        this.beDominated(player, unit);
      }
    }
  }

  leaveUnit(unit: number): void {
    this.unit -= unit;
  }

  getMovableUnit(): number {
    return Math.max(this.unit - 1, 0);
  }

  getView(): TileProp {
    let unit = this.isAlwaysRevealed || this.unitsCountRevealed ? this.unit : null;

    return [this.type, this.player ? this.player.color : null, unit];
  }

  beNeutralized(): void {
    this.player = null;
  }
}

export default Block;
