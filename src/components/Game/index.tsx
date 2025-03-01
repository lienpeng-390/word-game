import React, { useEffect, useRef, useState } from "react";
import { GAME_CONFIG } from "@/constants/game";
import styles from "./style.module.css";

interface Position {
  x: number;
  y: number;
}

interface WordEnemy {
  word: string;
  typedChars: string;
  hitChars: string;
  position: Position;
  width: number;
  height: number;
  speed: number;
}

interface BulletState {
  position: Position;
  targetPosition: Position;
  angle: number;
  radius: number;
  speed: number;
}

interface PlayerState {
  position: Position;
  width: number;
  height: number;
  lives: number;
  score: number;
  rotation: number;
}

type GameStatus = "idle" | "playing" | "gameOver";

const CanvasGame: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [gameStatus, setGameStatus] = useState<GameStatus>("idle");
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [gameOver, setGameOver] = useState(false);

  // 游戏状态
  const gameState = useRef({
    player: {
      position: { x: 0, y: 0 },
      width: GAME_CONFIG.PLAYER_WIDTH,
      height: GAME_CONFIG.PLAYER_HEIGHT,
      rotation: 0,
    },
    bullets: [] as BulletState[],
    enemies: [] as WordEnemy[],
    lastEnemyTime: 0,
    activeEnemyIndex: -1,
    canvasWidth: 0,
    canvasHeight: 0,
    safetyLineY: 0,
  });

  // 初始化Canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const updateCanvasSize = () => {
      const container = canvas.parentElement;
      if (!container) return;

      const width = container.clientWidth;
      const height = container.clientHeight;

      canvas.width = width;
      canvas.height = height;

      gameState.current.canvasWidth = width;
      gameState.current.canvasHeight = height;
      gameState.current.safetyLineY = height * 0.8;
      gameState.current.player.position = {
        x: width / 2,
        y: height - 50,
      };
    };

    updateCanvasSize();
    window.addEventListener("resize", updateCanvasSize);

    return () => {
      window.removeEventListener("resize", updateCanvasSize);
    };
  }, []);

  // 在组件挂载时自动开始游戏
  useEffect(() => {
    startGame();
  }, []);

  // 游戏循环
  useEffect(() => {
    if (gameStatus !== "playing") return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationFrameId: number;
    let lastTime = performance.now();

    // 生成敌人
    const spawnEnemy = () => {
      const word =
        GAME_CONFIG.WORDS[Math.floor(Math.random() * GAME_CONFIG.WORDS.length)];
      const fontSize = 16;
      ctx.font = `${fontSize}px monospace`;
      const wordWidth = ctx.measureText(word).width + 20; // 添加一些内边距

      const x =
        Math.random() * (gameState.current.canvasWidth - wordWidth) +
        wordWidth / 2;

      gameState.current.enemies.push({
        word,
        typedChars: "",
        hitChars: "",
        position: { x, y: 0 },
        width: wordWidth,
        height: 30,
        speed: GAME_CONFIG.ENEMY_SPEED,
      });

      if (gameState.current.activeEnemyIndex === -1) {
        gameState.current.activeEnemyIndex = 0;
      }
    };

    // 计算两点之间的角度
    const calculateAngle = (from: Position, to: Position) => {
      return Math.atan2(to.y - from.y, to.x - from.x);
    };

    // 检查子弹碰撞
    const checkBulletCollision = (bullet: BulletState, enemy: WordEnemy) => {
      const bulletX = bullet.position.x;
      const bulletY = bullet.position.y;

      const charWidth = enemy.width / enemy.word.length;
      const nextCharIndex = enemy.hitChars.length;

      if (nextCharIndex >= enemy.word.length) {
        return false;
      }

      const targetCharX =
        enemy.position.x - enemy.width / 2 + charWidth * (nextCharIndex + 0.5);
      const targetCharY = enemy.position.y;

      // 大幅增加碰撞范围
      const collisionRadius = charWidth * 3; // 增加到3倍字符宽度
      const distance = Math.sqrt(
        Math.pow(bulletX - targetCharX, 2) + Math.pow(bulletY - targetCharY, 2)
      );

      console.log("碰撞检测:", {
        子弹位置: { x: bulletX, y: bulletY },
        目标位置: { x: targetCharX, y: targetCharY },
        距离: distance,
        碰撞半径: collisionRadius,
        是否碰撞: distance < collisionRadius,
      });

      return distance < collisionRadius;
    };

    // 绘制游戏
    const drawGame = () => {
      // 清空画布
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // 绘制安全线
      ctx.beginPath();
      ctx.moveTo(0, gameState.current.safetyLineY);
      ctx.lineTo(canvas.width, gameState.current.safetyLineY);
      ctx.strokeStyle = "#f44336";
      ctx.lineWidth = 2;
      ctx.stroke();

      // 绘制玩家 - 圆柱形
      const player = gameState.current.player;

      // 保存当前绘图状态
      ctx.save();

      // 移动到玩家位置并旋转
      ctx.translate(player.position.x, player.position.y);
      ctx.rotate(player.rotation);

      // 绘制圆柱体
      const cylinderWidth = player.width;
      const cylinderHeight = player.height;

      // 绘制圆柱体主体（矩形）
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(
        -cylinderWidth / 2,
        -cylinderHeight / 2,
        cylinderWidth,
        cylinderHeight
      );

      // 绘制圆柱体顶部（半圆）
      ctx.beginPath();
      ctx.arc(0, -cylinderHeight / 2, cylinderWidth / 2, 0, Math.PI, true);
      ctx.fill();

      // 绘制圆柱体底部（半圆）
      ctx.beginPath();
      ctx.arc(0, cylinderHeight / 2, cylinderWidth / 2, 0, Math.PI, false);
      ctx.fill();

      // 恢复绘图状态
      ctx.restore();

      // 绘制子弹
      ctx.fillStyle = "#ffeb3b";
      gameState.current.bullets.forEach((bullet) => {
        ctx.beginPath();
        ctx.arc(
          bullet.position.x,
          bullet.position.y,
          bullet.radius,
          0,
          Math.PI * 2
        );
        ctx.fill();
        ctx.shadowBlur = 5;
        ctx.shadowColor = "#ffeb3b";
        ctx.fill();
        ctx.shadowBlur = 0;
      });

      // 绘制敌人
      gameState.current.enemies.forEach((enemy, index) => {
        const isActive = index === gameState.current.activeEnemyIndex;

        // 绘制敌人背景
        ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
        ctx.strokeStyle = isActive ? "#ffeb3b" : "#ffffff";
        ctx.lineWidth = 1;

        const x = enemy.position.x - enemy.width / 2;
        const y = enemy.position.y - enemy.height / 2;

        ctx.beginPath();
        ctx.roundRect(x, y, enemy.width, enemy.height, 4);
        ctx.fill();
        ctx.stroke();

        // 绘制文字
        ctx.font = "16px monospace";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";

        const charWidth = enemy.width / enemy.word.length;

        // 绘制已输入的字符
        for (let i = 0; i < enemy.typedChars.length; i++) {
          const charX = x + charWidth * (i + 0.5);
          ctx.fillStyle = i < enemy.hitChars.length ? "#4caf50" : "#aaaaaa";
          ctx.fillText(enemy.word[i], charX, enemy.position.y);
        }

        // 绘制未输入的字符
        for (let i = enemy.typedChars.length; i < enemy.word.length; i++) {
          const charX = x + charWidth * (i + 0.5);
          ctx.fillStyle = "#ffffff";
          ctx.fillText(enemy.word[i], charX, enemy.position.y);
        }
      });

      // 绘制分数和生命值
      ctx.fillStyle = "#ffffff";
      ctx.font = "16px Arial";
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      ctx.fillText(`生命值: ${lives}`, 10, 10);
      ctx.fillText(`分数: ${score}`, 10, 30);
    };

    // 游戏主循环
    const gameLoop = () => {
      const currentTime = performance.now();
      const deltaTime = currentTime - lastTime;

      if (deltaTime >= 16) {
        // 约60fps
        // 生成敌人
        if (
          currentTime - gameState.current.lastEnemyTime >=
          GAME_CONFIG.ENEMY_SPAWN_INTERVAL
        ) {
          spawnEnemy();
          gameState.current.lastEnemyTime = currentTime;
        }

        // 更新子弹位置
        const newBullets: BulletState[] = [];

        for (const bullet of gameState.current.bullets) {
          // 计算新位置
          const newPosition = {
            x: bullet.position.x + Math.cos(bullet.angle) * bullet.speed,
            y: bullet.position.y + Math.sin(bullet.angle) * bullet.speed,
          };

          // 检查是否超出屏幕
          if (
            newPosition.y < -bullet.radius ||
            newPosition.y > gameState.current.canvasHeight + bullet.radius ||
            newPosition.x < -bullet.radius ||
            newPosition.x > gameState.current.canvasWidth + bullet.radius
          ) {
            continue; // 跳过这个子弹
          }

          // 检查碰撞
          let bulletHit = false;

          for (let i = 0; i < gameState.current.enemies.length; i++) {
            const enemy = gameState.current.enemies[i];

            if (
              checkBulletCollision({ ...bullet, position: newPosition }, enemy)
            ) {
              bulletHit = true;
              console.log("【日志】子弹击中:", {
                敌人索引: i,
                单词: enemy.word,
                已输入字符: enemy.typedChars,
                已击中字符: enemy.hitChars,
              });

              // 只有当下一个字符已经输入但还未击中时才记录击中
              if (
                enemy.hitChars.length < enemy.typedChars.length &&
                enemy.hitChars.length < enemy.word.length
              ) {
                // 更新敌人状态
                enemy.hitChars += enemy.word[enemy.hitChars.length];

                console.log("【日志】更新击中后:", {
                  敌人索引: i,
                  单词: enemy.word,
                  已输入字符: enemy.typedChars,
                  已击中字符: enemy.hitChars,
                  是否完成:
                    enemy.typedChars.length === enemy.word.length &&
                    enemy.hitChars.length === enemy.word.length,
                });

                // 更新分数
                setScore((prev) => prev + 10);

                // 检查是否完全击中
                if (
                  enemy.typedChars.length === enemy.word.length &&
                  enemy.hitChars.length === enemy.word.length
                ) {
                  console.log("【日志】单词完全击中，准备移除:", {
                    敌人索引: i,
                    单词: enemy.word,
                  });

                  // 增加完成奖励
                  setScore((prev) => prev + enemy.word.length * 50);

                  // 移除敌人
                  gameState.current.enemies.splice(i, 1);
                  console.log(
                    "【日志】敌人已移除，剩余敌人:",
                    gameState.current.enemies.length
                  );

                  // 如果移除的是当前活跃敌人，更新活跃敌人索引
                  if (i === gameState.current.activeEnemyIndex) {
                    // 找到第一个未完成的敌人
                    const newActiveIndex = gameState.current.enemies.findIndex(
                      (e) => e.typedChars.length < e.word.length
                    );
                    gameState.current.activeEnemyIndex = newActiveIndex;
                    console.log("【日志】更新活跃敌人索引:", newActiveIndex);
                  } else if (i < gameState.current.activeEnemyIndex) {
                    // 如果移除的敌人在活跃敌人之前，需要调整索引
                    gameState.current.activeEnemyIndex--;
                    console.log(
                      "【日志】调整活跃敌人索引:",
                      gameState.current.activeEnemyIndex
                    );
                  }

                  i--; // 调整循环索引
                }
              }

              break; // 子弹已击中，不再检查其他敌人
            }
          }

          // 如果子弹没有击中任何敌人，保留它
          if (!bulletHit) {
            newBullets.push({
              ...bullet,
              position: newPosition,
            });
          }
        }

        gameState.current.bullets = newBullets;

        // 更新敌人位置
        for (let i = 0; i < gameState.current.enemies.length; i++) {
          const enemy = gameState.current.enemies[i];
          const newY = enemy.position.y + enemy.speed;

          // 检查是否超过安全线
          if (
            newY >= gameState.current.safetyLineY &&
            enemy.position.y < gameState.current.safetyLineY
          ) {
            // 扣减生命值
            setLives((prev) => {
              const newLives = prev - 1;
              if (newLives <= 0) {
                setGameStatus("gameOver");
                handleGameOver(); // 调用游戏结束处理函数
              }
              return newLives;
            });

            // 如果当前活跃敌人超过安全线，切换到下一个未超过安全线的敌人
            if (i === gameState.current.activeEnemyIndex) {
              const newActiveIndex = gameState.current.enemies.findIndex(
                (e, idx) =>
                  idx !== i &&
                  e.position.y < gameState.current.safetyLineY &&
                  e.typedChars.length < e.word.length
              );
              gameState.current.activeEnemyIndex = newActiveIndex;
              console.log(
                "【日志】敌人超过安全线，切换活跃敌人:",
                newActiveIndex
              );
            }
          }

          // 如果敌人超出屏幕底部，移除它
          if (newY >= gameState.current.canvasHeight) {
            gameState.current.enemies.splice(i, 1);

            // 调整活跃敌人索引
            if (i === gameState.current.activeEnemyIndex) {
              const newActiveIndex = gameState.current.enemies.findIndex(
                (e) => e.typedChars.length < e.word.length
              );
              gameState.current.activeEnemyIndex = newActiveIndex;
            } else if (i < gameState.current.activeEnemyIndex) {
              gameState.current.activeEnemyIndex--;
            }

            i--; // 调整循环索引
          } else {
            // 更新位置
            enemy.position.y = newY;
          }
        }

        // 如果没有活跃敌人但有敌人存在，设置第一个未完成的敌人为活跃
        if (
          gameState.current.activeEnemyIndex === -1 &&
          gameState.current.enemies.length > 0
        ) {
          const newActiveIndex = gameState.current.enemies.findIndex(
            (e) => e.typedChars.length < e.word.length
          );
          gameState.current.activeEnemyIndex = newActiveIndex;
        }

        // 绘制游戏
        drawGame();

        lastTime = currentTime;
      }

      animationFrameId = requestAnimationFrame(gameLoop);
    };

    // 处理键盘输入
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.key.length === 1 && /[a-z]/i.test(e.key)) {
        const char = e.key.toLowerCase();

        const activeIndex = gameState.current.activeEnemyIndex;
        if (
          activeIndex === -1 ||
          activeIndex >= gameState.current.enemies.length
        ) {
          return;
        }

        const activeEnemy = gameState.current.enemies[activeIndex];

        // 检查活跃敌人是否已超过安全线
        if (activeEnemy.position.y >= gameState.current.safetyLineY) {
          // 查找下一个未超过安全线的敌人
          const newActiveIndex = gameState.current.enemies.findIndex(
            (e, idx) =>
              idx !== activeIndex &&
              e.position.y < gameState.current.safetyLineY &&
              e.typedChars.length < e.word.length
          );

          if (newActiveIndex !== -1) {
            gameState.current.activeEnemyIndex = newActiveIndex;
            console.log("【日志】切换到未超过安全线的敌人:", newActiveIndex);

            // 递归调用以处理当前按键
            handleKeyPress(e);
            return;
          }
        }

        if (activeEnemy.word[activeEnemy.typedChars.length] === char) {
          // 更新已输入的字符
          activeEnemy.typedChars += char;
          console.log("【日志】输入字符:", {
            字符: char,
            单词: activeEnemy.word,
            已输入: activeEnemy.typedChars,
          });

          // 发射子弹
          const bulletStartPos = {
            x: gameState.current.player.position.x,
            y:
              gameState.current.player.position.y -
              gameState.current.player.height / 2,
          };

          const charWidth = activeEnemy.width / activeEnemy.word.length;
          const targetCharIndex = activeEnemy.hitChars.length;
          const targetCharX =
            activeEnemy.position.x -
            activeEnemy.width / 2 +
            charWidth * (targetCharIndex + 0.5);

          const targetPos = {
            x: targetCharX,
            y: activeEnemy.position.y,
          };

          // 计算角度并更新玩家旋转
          const angle = calculateAngle(bulletStartPos, targetPos);
          gameState.current.player.rotation = angle - Math.PI / 2; // 减去90度，使圆柱体垂直于射击方向

          // 创建子弹
          gameState.current.bullets.push({
            position: bulletStartPos,
            targetPosition: targetPos,
            angle: angle,
            radius: 6,
            speed: GAME_CONFIG.BULLET_SPEED * 2,
          });

          // 3. 添加自动击中功能 - 如果打字速度快，直接更新hitChars
          // 这样即使子弹没有物理上击中，单词也会被正确处理
          if (activeEnemy.hitChars.length < activeEnemy.typedChars.length - 2) {
            // 如果已击中字符落后已输入字符2个以上，直接更新
            activeEnemy.hitChars +=
              activeEnemy.word[activeEnemy.hitChars.length];
            console.log("【日志】自动击中:", {
              单词: activeEnemy.word,
              已输入: activeEnemy.typedChars,
              已击中: activeEnemy.hitChars,
            });

            // 检查是否完全击中
            if (
              activeEnemy.typedChars.length === activeEnemy.word.length &&
              activeEnemy.hitChars.length === activeEnemy.word.length
            ) {
              console.log("【日志】单词自动完全击中，准备移除");

              // 增加完成奖励
              setScore((prev) => prev + activeEnemy.word.length * 50);

              // 移除敌人
              const enemyIndex = activeIndex;
              gameState.current.enemies.splice(enemyIndex, 1);

              // 更新活跃敌人索引
              const newActiveIndex = gameState.current.enemies.findIndex(
                (e, idx) =>
                  idx !== activeIndex && e.typedChars.length < e.word.length
              );
              gameState.current.activeEnemyIndex = newActiveIndex;
            }
          }

          // 如果单词已经完全输入，查找下一个未完成的敌人
          if (activeEnemy.typedChars.length === activeEnemy.word.length) {
            const newActiveIndex = gameState.current.enemies.findIndex(
              (e, idx) =>
                idx !== activeIndex && e.typedChars.length < e.word.length
            );
            gameState.current.activeEnemyIndex = newActiveIndex;
            console.log(
              "【日志】单词输入完成，新活跃敌人索引:",
              newActiveIndex
            );
          }
        }
      }
    };

    window.addEventListener("keydown", handleKeyPress);
    gameLoop();

    return () => {
      window.removeEventListener("keydown", handleKeyPress);
      cancelAnimationFrame(animationFrameId);
    };
  }, [gameStatus, lives, score]);

  // 开始游戏
  const startGame = () => {
    gameState.current = {
      ...gameState.current,
      bullets: [],
      enemies: [],
      lastEnemyTime: performance.now(),
      activeEnemyIndex: -1,
    };

    setScore(0);
    setLives(3);
    setGameStatus("playing");
  };

  // 修改游戏结束处理
  const handleGameOver = () => {
    setGameOver(true);
    setGameStatus("gameOver");
  };

  // 重新开始游戏
  const restartGame = () => {
    setGameOver(false);
    gameState.current = {
      ...gameState.current,
      bullets: [],
      enemies: [],
      lastEnemyTime: performance.now(),
      activeEnemyIndex: -1,
    };
    setScore(0);
    setLives(3);
    setGameStatus("playing");
  };

  return (
    <div className={styles.gameContainer}>
      <canvas ref={canvasRef} className={styles.gameCanvas} />

      {gameStatus === "idle" || gameStatus === "gameOver" ? (
        <div className={styles.gameOverlay}>
          <h2>游戏结束</h2>
          {gameStatus === "gameOver" && <p>最终得分: {score}</p>}
        </div>
      ) : null}

      {gameOver && (
        <div className={styles.gameOverOverlay}>
          <div className={styles.gameOverContent}>
            <h2>游戏结束</h2>
            <p>得分: {score}</p>
            <button className={styles.restartButton} onClick={restartGame}>
              重新开始
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default CanvasGame;
