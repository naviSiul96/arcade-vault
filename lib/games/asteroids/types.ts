export type GameStatus = 'playing' | 'dead' | 'gameover';

export interface AsteroidsCallbacks {
  onScore: (score: number) => void;
  onLives: (lives: number) => void;
  onLevel: (level: number) => void;
  onGameOver: (finalScore: number) => void;
}

export interface AsteroidsHandle {
  pause: () => void;
  resume: () => void;
  restart: () => void;
  end: () => void; // fuerza game over (botón FIN)
}
