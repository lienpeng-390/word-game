export interface Position {
  x: number;
  y: number;
}

export interface GameObject {
  position: Position;
  width: number;
  height: number;
}

export interface PlayerState {
  position: Position;
  width: number;
  height: number;
  lives: number;
  score: number;
}

export interface WordEnemy {
  word: string;
  typedChars: string; // 已经输入的字符
  hitChars: string; // 已经被子弹击中的字符
  position: Position;
  width: number;
  height: number;
  speed: number;
}

export interface BulletState {
  position: Position;
  targetPosition: Position;
  angle: number;
  width: number;
  height: number;
  speed: number;
}

export type GameStatus = "idle" | "playing" | "paused" | "gameOver";
