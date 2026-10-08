"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import { AsteroidsGame } from "@/lib/games/asteroids/AsteroidsGame";
import { H, W } from "@/lib/games/asteroids/constants";
import type {
  AsteroidsCallbacks,
  AsteroidsHandle,
} from "@/lib/games/asteroids/types";

type AsteroidsCanvasProps = Partial<AsteroidsCallbacks>;

const AsteroidsCanvas = forwardRef<AsteroidsHandle, AsteroidsCanvasProps>(
  function AsteroidsCanvas(props, ref) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const gameRef = useRef<AsteroidsGame | null>(null);

    // Siempre apunta a los callbacks más recientes sin recrear el motor
    const callbacksRef = useRef(props);
    useEffect(() => {
      callbacksRef.current = props;
    });

    useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const game = new AsteroidsGame(canvas, {
        onScore: (v) => callbacksRef.current.onScore?.(v),
        onLives: (v) => callbacksRef.current.onLives?.(v),
        onLevel: (v) => callbacksRef.current.onLevel?.(v),
        onGameOver: (v) => callbacksRef.current.onGameOver?.(v),
      });
      gameRef.current = game;

      return () => {
        game.destroy();
        gameRef.current = null;
      };
    }, []);

    useImperativeHandle(
      ref,
      () => ({
        pause: () => gameRef.current?.pause(),
        resume: () => gameRef.current?.resume(),
        restart: () => gameRef.current?.restart(),
        end: () => gameRef.current?.end(),
      }),
      [],
    );

    return (
      <canvas
        ref={canvasRef}
        width={W}
        height={H}
        style={{ width: "100%", height: "auto", display: "block" }}
      />
    );
  },
);

export default AsteroidsCanvas;
