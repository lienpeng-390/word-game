import React, { useEffect, useRef, useState } from "react";
import { GAME_CONFIG } from "@/constants/game";
import styles from "./style.module.css";
import VirtualKeyboard from "../VirtualKeyboard";

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

// interface PlayerState {
//   position: Position;
//   width: number;
//   height: number;
//   lives: number;
//   score: number;
//   rotation: number;
// }

type GameStatus = "idle" | "playing" | "gameOver";

const CanvasGame: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [gameStatus, setGameStatus] = useState<GameStatus>("idle");
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [gameOver, setGameOver] = useState(false);
  const [displayScore, setDisplayScore] = useState(0);
  const [difficultyLevel, setDifficultyLevel] = useState(1);

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
    explosions: [] as {
      position: Position;
      radius: number;
      color: string;
      alpha: number;
      maxRadius: number;
      particles: {
        x: number;
        y: number;
        vx: number;
        vy: number;
        radius: number;
        color: string;
        alpha: number;
      }[];
    }[],
    stars: [] as {
      x: number;
      y: number;
      radius: number;
      brightness: number;
      twinkleSpeed: number;
      speed: number;
    }[],
  });

  // 在组件顶部添加图片资源状态
  const [resources, setResources] = useState<{
    bulletImage: HTMLImageElement | null;
    loaded: boolean;
  }>({
    bulletImage: null,
    loaded: false,
  });

  // 在组件顶部添加音频资源状态
  const [sounds, setSounds] = useState<{
    shootSound: HTMLAudioElement | null;
    explosionSound: HTMLAudioElement | null;
    loaded: boolean;
  }>({
    shootSound: null,
    explosionSound: null,
    loaded: false,
  });

  // 在组件挂载时加载图片资源
  useEffect(() => {
    // 创建图片对象
    const bulletImage = new Image();
    // 使用类型断言避免 TypeScript 错误
    bulletImage.src = `${
      (import.meta as any).env.BASE_URL
    }assets/energy-ball.png`;

    // 图片加载完成后更新状态
    bulletImage.onload = () => {
      setResources({
        bulletImage,
        loaded: true,
      });
    };

    return () => {
      // 清理资源
      bulletImage.onload = null;
    };
  }, []);

  // 在组件挂载时加载音频资源
  useEffect(() => {
    try {
      // 创建音频对象
      const shootSound = new Audio(
        `${(import.meta as any).env.BASE_URL}biu.mp3`
      );
      const explosionSound = new Audio(
        `${(import.meta as any).env.BASE_URL}remove.mp3`
      );

      // 设置音频属性
      shootSound.preload = "auto";
      shootSound.volume = 0.5;

      explosionSound.preload = "auto";
      explosionSound.volume = 0.6;

      // 预加载音频
      shootSound.load();
      explosionSound.load();

      // 音频加载完成后更新状态
      let loadedCount = 0;
      const totalSounds = 2;

      const checkAllLoaded = () => {
        loadedCount++;
        if (loadedCount >= totalSounds) {
          console.log("所有音频加载完成");
          setSounds({
            shootSound,
            explosionSound,
            loaded: true,
          });
        }
      };

      shootSound.oncanplaythrough = checkAllLoaded;
      explosionSound.oncanplaythrough = checkAllLoaded;

      // 处理加载错误
      const handleError = (e: Event, name: string) => {
        console.error(`${name}音频加载失败:`, e);
      };

      shootSound.onerror = (e) => handleError(e, "射击");
      explosionSound.onerror = (e) => handleError(e, "爆炸");

      // 立即设置音频对象，不等待加载完成
      setSounds({
        shootSound,
        explosionSound,
        loaded: false,
      });

      return () => {
        // 清理资源
        if (shootSound) {
          shootSound.oncanplaythrough = null;
          shootSound.onerror = null;
        }
        if (explosionSound) {
          explosionSound.oncanplaythrough = null;
          explosionSound.onerror = null;
        }
      };
    } catch (error) {
      console.error("音频初始化失败:", error);
    }
  }, []);

  // 初始化Canvas - 进一步调整安全线和炮台位置
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

      // 计算虚拟键盘上方的位置
      // 假设虚拟键盘高度约为165px（根据padding-bottom设置）
      const keyboardHeight = 165;

      // 设置安全线位置 - 距离键盘20px
      gameState.current.safetyLineY = height - keyboardHeight - 20;

      // 设置炮台位置 - 底部在安全线以下
      // 炮台高度约为GAME_CONFIG.PLAYER_HEIGHT
      const playerHeight = GAME_CONFIG.PLAYER_HEIGHT;
      gameState.current.player.position = {
        x: width / 2,
        y: gameState.current.safetyLineY - playerHeight * 0.3, // 让炮台底部在安全线以下
      };

      // 生成星星
      const stars = [];
      const starCount = Math.floor((width * height) / 2000);

      for (let i = 0; i < starCount; i++) {
        stars.push({
          x: Math.random() * width,
          y: Math.random() * (height - 200),
          radius: 0.5 + Math.random() * 1.5,
          brightness: 0.5 + Math.random() * 0.5,
          twinkleSpeed: 0.001 + Math.random() * 0.005,
          speed: 0.05 + Math.random() * 0.15,
        });
      }

      gameState.current.stars = stars;
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

  // 计算两点之间的角度 - 将函数移到组件级别
  const calculateAngle = (from: Position, to: Position) => {
    return Math.atan2(to.y - from.y, to.x - from.x);
  };

  // 将 handleKeyPress 函数移到 useEffect 外部，使其可以在整个组件中访问
  const handleKeyPress = (e: KeyboardEvent) => {
    if (gameStatus !== "playing") return;

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

        // 现在可以使用 calculateAngle 函数
        const angle = calculateAngle(bulletStartPos, targetPos);
        // 修正炮台旋转方向 - 使炮管指向目标
        gameState.current.player.rotation = angle - Math.PI / 2; // 减去90度，使炮管指向目标

        // 创建子弹
        gameState.current.bullets.push({
          position: bulletStartPos,
          targetPosition: targetPos,
          angle: angle,
          radius: 6,
          speed: GAME_CONFIG.BULLET_SPEED * 2,
        });

        // 播放发射音效
        playShootSound();

        // 3. 添加自动击中功能 - 如果打字速度快，直接更新hitChars
        if (activeEnemy.hitChars.length < activeEnemy.typedChars.length - 2) {
          // 如果已击中字符落后已输入字符2个以上，直接更新
          const charIndex = activeEnemy.hitChars.length;
          activeEnemy.hitChars += activeEnemy.word[charIndex];

          // 创建小爆炸效果 - 在自动击中的字符位置
          const charWidth = activeEnemy.width / activeEnemy.word.length;
          const charX =
            activeEnemy.position.x -
            activeEnemy.width / 2 +
            (activeEnemy.width / activeEnemy.word.length) * (charIndex + 0.5);
          const charY = activeEnemy.position.y;

          // 使用较小的爆炸效果
          createExplosion(
            { x: charX, y: charY },
            0.25, // 尺寸更小
            true // 使用黄色系
          );

          // 播放发射音效
          playShootSound();

          // 检查单词是否完成
          if (activeEnemy.hitChars.length === activeEnemy.word.length) {
            // 单词完成，增加分数
            setScore((prev) => prev + 1);

            // 创建黄色爆炸效果
            createExplosion(activeEnemy.position, 1, true);

            // 播放爆炸音效
            playExplosionSound();

            // 移除完成的敌人
            const index = gameState.current.activeEnemyIndex;

            if (index !== -1) {
              // 立即从数组中移除敌人
              gameState.current.enemies.splice(index, 1);

              // 查找下一个未完成的敌人
              const newActiveIndex = gameState.current.enemies.findIndex(
                (e) => e.typedChars.length < e.word.length
              );

              gameState.current.activeEnemyIndex = newActiveIndex;
              console.log("【日志】自动完成后切换活跃敌人:", newActiveIndex);
            }
          }
        }

        // 如果单词已经完全输入，查找下一个未完成的敌人
        if (activeEnemy.typedChars.length === activeEnemy.word.length) {
          const newActiveIndex = gameState.current.enemies.findIndex(
            (e, idx) =>
              idx !== activeIndex && e.typedChars.length < e.word.length
          );
          gameState.current.activeEnemyIndex = newActiveIndex;
          console.log("【日志】单词输入完成，新活跃敌人索引:", newActiveIndex);
        }
      }
    }
  };

  // 计算难度系数的函数 - 添加在组件内部
  const calculateDifficultyFactor = (currentScore: number) => {
    // 基础难度系数为1.0
    // 每得10分，难度增加10%，最高增加到3倍初始难度
    const difficultyIncrease = Math.min(currentScore / 10, 20) * 0.1;
    return 1.0 + difficultyIncrease;
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

  // 游戏循环
  useEffect(() => {
    if (gameStatus !== "playing") return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationFrameId: number;
    let lastTime = performance.now();

    // 绘制游戏
    const drawGame = () => {
      // 清空画布
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // 绘制星空背景 - 更高清的效果
      ctx.fillStyle = "#000010"; // 更深的蓝黑色背景，提高对比度
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // 绘制远处的星云 - 更清晰的效果
      // 星云1 - 紫色
      const nebula1 = ctx.createRadialGradient(
        canvas.width * 0.3,
        canvas.height * 0.4,
        0,
        canvas.width * 0.3,
        canvas.height * 0.4,
        canvas.width * 0.5
      );
      nebula1.addColorStop(0, "rgba(120, 70, 170, 0.15)"); // 增加不透明度
      nebula1.addColorStop(0.5, "rgba(100, 50, 150, 0.1)");
      nebula1.addColorStop(1, "rgba(0, 0, 30, 0)");

      ctx.fillStyle = nebula1;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // 星云2 - 蓝色
      const nebula2 = ctx.createRadialGradient(
        canvas.width * 0.7,
        canvas.height * 0.6,
        0,
        canvas.width * 0.7,
        canvas.height * 0.6,
        canvas.width * 0.6
      );
      nebula2.addColorStop(0, "rgba(70, 120, 170, 0.15)"); // 增加不透明度
      nebula2.addColorStop(0.5, "rgba(50, 100, 150, 0.1)");
      nebula2.addColorStop(1, "rgba(0, 0, 30, 0)");

      ctx.fillStyle = nebula2;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // 绘制并更新星星位置 - 更清晰的星星
      const currentTime = performance.now();
      gameState.current.stars.forEach((star) => {
        // 更新星星位置 - 让星星向下移动得更快，增强飞行感
        star.y += star.speed * 3; // 保持较快的速度

        // 如果星星移出屏幕底部，将其重置到顶部
        if (star.y > canvas.height) {
          star.y = 0;
          star.x = Math.random() * canvas.width;
          // 随机更新速度，使流动更自然
          star.speed = 0.1 + Math.random() * 0.3;
        }

        // 星星闪烁效果
        const brightness =
          star.brightness *
          (0.7 + 0.3 * Math.sin(currentTime * star.twinkleSpeed));

        // 根据速度调整星星颜色 - 更快的星星更亮/更蓝
        const hue = 210 + ((star.speed * 100) % 50);
        const saturation = 70 + ((star.speed * 100) % 30);

        // 绘制更清晰的星星
        const starRadius = star.radius * (1 + star.speed); // 速度快的星星更大

        // 使用更清晰的星星绘制方法
        ctx.fillStyle = `hsla(${hue}, ${saturation}%, 95%, ${brightness})`; // 增加亮度到95%

        // 对于大星星，使用更清晰的绘制方法
        if (starRadius > 1.5) {
          // 先绘制一个锐利的点
          ctx.beginPath();
          ctx.arc(star.x, star.y, starRadius, 0, Math.PI * 2);
          ctx.fill();

          // 添加十字光芒效果，使星星更锐利
          ctx.beginPath();
          ctx.moveTo(star.x - starRadius * 2, star.y);
          ctx.lineTo(star.x + starRadius * 2, star.y);
          ctx.strokeStyle = `hsla(${hue}, ${saturation}%, 95%, ${
            brightness * 0.7
          })`;
          ctx.lineWidth = starRadius * 0.5;
          ctx.stroke();

          ctx.beginPath();
          ctx.moveTo(star.x, star.y - starRadius * 2);
          ctx.lineTo(star.x, star.y + starRadius * 2);
          ctx.strokeStyle = `hsla(${hue}, ${saturation}%, 95%, ${
            brightness * 0.7
          })`;
          ctx.lineWidth = starRadius * 0.5;
          ctx.stroke();
        } else {
          // 小星星使用简单的圆形，但增加亮度
          ctx.beginPath();
          ctx.arc(star.x, star.y, starRadius, 0, Math.PI * 2);
          ctx.fill();
        }

        // 为较大的星星添加光晕效果和拖尾效果
        if (starRadius > 1.8) {
          // 光晕 - 更清晰的光晕
          const glow = ctx.createRadialGradient(
            star.x,
            star.y,
            0,
            star.x,
            star.y,
            starRadius * 4
          );
          glow.addColorStop(0, `rgba(255, 255, 255, ${brightness * 0.8})`); // 增加中心亮度
          glow.addColorStop(0.5, `rgba(180, 220, 255, ${brightness * 0.4})`);
          glow.addColorStop(1, "rgba(100, 180, 255, 0)");

          ctx.fillStyle = glow;
          ctx.beginPath();
          ctx.arc(star.x, star.y, starRadius * 4, 0, Math.PI * 2);
          ctx.fill();

          // 拖尾效果 - 更清晰的拖尾
          ctx.beginPath();
          ctx.moveTo(star.x, star.y);
          ctx.lineTo(star.x, star.y - star.speed * 20);
          ctx.strokeStyle = `rgba(255, 255, 255, ${brightness * 0.6})`; // 增加拖尾亮度
          ctx.lineWidth = starRadius * 0.8;
          ctx.stroke();
        }
      });

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

      // 添加一些装饰
      ctx.strokeStyle = "#4fa8c7";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, cylinderWidth * 0.3, 0, Math.PI * 2);
      ctx.stroke();

      // 恢复绘图状态
      ctx.restore();

      // 绘制子弹 - 使用图片素材
      if (resources.loaded && resources.bulletImage) {
        gameState.current.bullets.forEach((bullet) => {
          // 保存当前绘图状态
          ctx.save();

          // 移动到子弹位置
          ctx.translate(bullet.position.x, bullet.position.y);

          // 旋转图片以匹配子弹方向
          ctx.rotate(bullet.angle);

          // 计算图片大小 (基于子弹半径)
          const size = bullet.radius * 4; // 调整大小以适应图片

          // // 绘制图片 (居中)
          // ctx.drawImage(
          //   resources.bulletImage,
          //   -size / 2,
          //   -size / 2,
          //   size,
          //   size
          // );

          // 添加发光效果
          ctx.globalCompositeOperation = "lighter";

          // 创建径向渐变
          const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, size / 2);

          // 设置渐变颜色
          gradient.addColorStop(0, "rgba(100, 200, 255, 0.5)");
          gradient.addColorStop(1, "rgba(0, 50, 255, 0)");

          // 绘制发光效果
          ctx.beginPath();
          ctx.arc(0, 0, size / 2, 0, Math.PI * 2);
          ctx.fillStyle = gradient;
          ctx.fill();

          // 添加脉动效果
          const pulseSize = Math.sin(performance.now() * 0.01) * 0.2 + 1;
          ctx.beginPath();
          ctx.arc(0, 0, (size / 2) * pulseSize, 0, Math.PI * 2);
          ctx.strokeStyle = "rgba(150, 220, 255, 0.4)";
          ctx.lineWidth = 2;
          ctx.stroke();

          // 恢复绘图状态
          ctx.restore();
        });
      } else {
        // 如果图片未加载完成，使用之前的绘制方法作为后备
        gameState.current.bullets.forEach((bullet) => {
          // 绘制子弹 - 能量球效果
          ctx.fillStyle = "#ffeb3b";
          ctx.beginPath();
          ctx.arc(
            bullet.position.x,
            bullet.position.y,
            bullet.radius * 1.5,
            0,
            Math.PI * 2
          );
          ctx.fill();

          // 绘制核心
          ctx.beginPath();
          ctx.arc(
            bullet.position.x,
            bullet.position.y,
            bullet.radius * 0.7,
            0,
            Math.PI * 2
          );
          ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
          ctx.fill();

          // 添加脉动效果
          const pulseSize = Math.sin(performance.now() * 0.01) * 0.2 + 1;
          ctx.beginPath();
          ctx.arc(
            bullet.position.x,
            bullet.position.y,
            bullet.radius * pulseSize,
            0,
            Math.PI * 2
          );
          ctx.strokeStyle = "rgba(150, 220, 255, 0.6)";
          ctx.lineWidth = 2;
          ctx.stroke();
        });
      }

      // 绘制敌人
      gameState.current.enemies.forEach((enemy, index) => {
        const isActive = index === gameState.current.activeEnemyIndex;

        // 计算敌人背景位置和尺寸
        const padding = 10; // 文字与边框的间距
        const fontSize = 16;

        // 测量整个单词的宽度
        ctx.font = `bold ${fontSize}px monospace`;
        const wordWidth = ctx.measureText(enemy.word).width;

        // 确保敌人宽度足够容纳单词
        enemy.width = Math.max(enemy.width, wordWidth + padding * 2);

        // 绘制敌人背景
        ctx.fillStyle = isActive
          ? "rgba(255, 235, 59, 0.3)" // 活跃敌人使用黄色背景
          : "rgba(0, 0, 0, 0.6)"; // 非活跃敌人使用深色背景

        // 绘制圆角矩形背景
        const bgHeight = 30;
        ctx.beginPath();
        ctx.roundRect(
          enemy.position.x - enemy.width / 2,
          enemy.position.y - bgHeight / 2,
          enemy.width,
          bgHeight,
          5
        );
        ctx.fill();

        // 绘制边框
        ctx.strokeStyle = isActive ? "#ffeb3b" : "#ffffff";
        ctx.lineWidth = isActive ? 2 : 1;
        ctx.stroke();

        // 设置文字样式
        ctx.font = `bold ${fontSize}px monospace`; // 使用粗体增加清晰度
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";

        // 为文字添加阴影，增加清晰度
        ctx.shadowColor = "rgba(0, 0, 0, 0.7)";
        ctx.shadowBlur = 3;
        ctx.shadowOffsetX = 1;
        ctx.shadowOffsetY = 1;

        // 计算每个字符的位置
        const charWidth = enemy.width / enemy.word.length;
        const startX = enemy.position.x - enemy.width / 2 + charWidth / 2;

        // 逐个字符绘制，确保水平居中
        for (let i = 0; i < enemy.word.length; i++) {
          const charX = startX + i * charWidth;

          // 根据字符状态设置颜色
          if (i < enemy.hitChars.length) {
            // 已击中的字符 - 不显示（透明）
            continue;
          } else if (i < enemy.typedChars.length) {
            // 已输入但未击中的字符 - 黄色
            ctx.fillStyle = "#ffeb3b";
          } else {
            // 未输入的字符 - 白色
            ctx.fillStyle = "#ffffff";
          }

          // 绘制字符
          ctx.fillText(enemy.word[i], charX, enemy.position.y);
        }

        // 重置阴影
        ctx.shadowColor = "transparent";
        ctx.shadowBlur = 0;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;
      });

      // 绘制爆炸效果
      gameState.current.explosions.forEach((explosion, index) => {
        // 绘制爆炸光环
        const gradient = ctx.createRadialGradient(
          explosion.position.x,
          explosion.position.y,
          0,
          explosion.position.x,
          explosion.position.y,
          explosion.radius
        );

        // 使用爆炸对象中存储的颜色
        const baseColor = explosion.color; // 这里使用存储的颜色

        // 根据颜色确定是黄色系还是红色系
        const isYellow = baseColor === "#ffeb3b";

        // 创建适合颜色的渐变
        if (isYellow) {
          // 黄色系渐变
          gradient.addColorStop(0, `rgba(255, 255, 255, ${explosion.alpha})`);
          gradient.addColorStop(
            0.3,
            `rgba(255, 235, 100, ${explosion.alpha * 0.8})`
          );
          gradient.addColorStop(
            0.7,
            `rgba(255, 180, 50, ${explosion.alpha * 0.5})`
          );
          gradient.addColorStop(1, `rgba(255, 100, 0, 0)`);
        } else {
          // 红色系渐变
          gradient.addColorStop(0, `rgba(255, 255, 255, ${explosion.alpha})`);
          gradient.addColorStop(
            0.3,
            `rgba(255, 100, 100, ${explosion.alpha * 0.8})`
          );
          gradient.addColorStop(
            0.7,
            `rgba(255, 50, 50, ${explosion.alpha * 0.5})`
          );
          gradient.addColorStop(1, `rgba(200, 0, 0, 0)`);
        }

        ctx.beginPath();
        ctx.arc(
          explosion.position.x,
          explosion.position.y,
          explosion.radius,
          0,
          Math.PI * 2
        );
        ctx.fillStyle = gradient;
        ctx.fill();

        // 绘制爆炸粒子
        explosion.particles.forEach((particle) => {
          ctx.beginPath();
          ctx.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2);
          ctx.fillStyle = particle.color; // 使用粒子自己的颜色
          ctx.fill();
        });

        // 更新爆炸状态
        explosion.radius += 2;
        explosion.alpha -= 0.02;

        // 更新粒子位置
        explosion.particles.forEach((particle) => {
          particle.x += particle.vx;
          particle.y += particle.vy;
          particle.alpha -= 0.02;
          particle.radius *= 0.98;
        });

        // 移除已完成的爆炸效果
        if (explosion.alpha <= 0) {
          gameState.current.explosions.splice(index, 1);
        }
      });

      // 绘制UI - 分数和生命值
      // 设置UI区域 - 确保水平居中
      // const uiHeight = 50;
      const uiY = 25; // 调整垂直位置

      // 计算UI元素的位置
      const heartSize = 25;
      const heartSpacing = 10;
      // const totalHeartsWidth = 3 * heartSize + 2 * heartSpacing;

      // 绘制生命值 - 红心
      const heartsY = uiY;

      // 绘制红心函数
      const drawHeart = (
        x: number,
        y: number,
        size: number,
        filled: boolean
      ) => {
        const halfSize = size / 2;

        ctx.save();
        ctx.beginPath();

        // 绘制心形路径
        ctx.moveTo(x, y + halfSize / 4);

        // 左半部分
        ctx.bezierCurveTo(
          x - halfSize / 2,
          y - halfSize / 2,
          x - size,
          y,
          x,
          y + size * 0.7
        );

        // 右半部分
        ctx.bezierCurveTo(
          x + size,
          y,
          x + halfSize / 2,
          y - halfSize / 2,
          x,
          y + halfSize / 4
        );

        // 填充或描边
        if (filled) {
          ctx.fillStyle = "#ff3366";
          ctx.fill();
        } else {
          ctx.strokeStyle = "#ff3366";
          ctx.lineWidth = 2;
          ctx.stroke();
          ctx.fillStyle = "rgba(255, 100, 100, 0.2)";
          ctx.fill();
        }

        ctx.restore();
      };

      // 绘制所有红心
      for (let i = 0; i < 3; i++) {
        const heartX = 20 + i * (heartSize + heartSpacing);
        const filled = i < lives;
        drawHeart(heartX, heartsY, heartSize, filled);
      }
    };

    // 游戏主循环
    const gameLoop = (timestamp: number) => {
      const currentTime = timestamp;
      const deltaTime = currentTime - lastTime;

      if (deltaTime >= 16) {
        // 约60fps
        // 计算当前难度系数
        const difficultyFactor = calculateDifficultyFactor(score);

        // 生成敌人
        if (
          currentTime - gameState.current.lastEnemyTime >
          GAME_CONFIG.ENEMY_SPAWN_INTERVAL / Math.sqrt(difficultyFactor) // 随着难度增加，敌人生成间隔减少
        ) {
          // 随机选择一个单词
          const wordIndex = Math.floor(
            Math.random() * GAME_CONFIG.WORDS.length
          );
          const word = GAME_CONFIG.WORDS[wordIndex];
          const fontSize = 16;
          ctx.font = `${fontSize}px monospace`;
          const wordWidth = ctx.measureText(word).width + 20; // 添加一些内边距

          // 随机生成敌人的水平位置
          const x =
            Math.random() * (gameState.current.canvasWidth - wordWidth) +
            wordWidth / 2;

          // 创建新敌人 - 使用难度系数调整速度
          gameState.current.enemies.push({
            word,
            typedChars: "",
            hitChars: "",
            position: { x, y: 0 },
            width: wordWidth,
            height: 30,
            // 基础速度 * 难度系数 * 随机变化(0.9-1.1)
            speed:
              GAME_CONFIG.ENEMY_SPEED *
              difficultyFactor *
              (0.9 + Math.random() * 0.2),
          });

          // 更新最后一次生成敌人的时间
          gameState.current.lastEnemyTime = currentTime;
        }

        // 更新子弹位置
        const newBullets: BulletState[] = [];

        for (let i = 0; i < gameState.current.bullets.length; i++) {
          const bullet = gameState.current.bullets[i];

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

          // 检查子弹是否击中敌人
          let bulletHit = false;

          for (let j = 0; j < gameState.current.enemies.length; j++) {
            const enemy = gameState.current.enemies[j];

            if (
              checkBulletCollision({ ...bullet, position: newPosition }, enemy)
            ) {
              bulletHit = true;

              // 只有当下一个字符已经输入但还未击中时才记录击中
              if (
                enemy.hitChars.length < enemy.typedChars.length &&
                enemy.hitChars.length < enemy.word.length
              ) {
                // 更新敌人状态
                const charIndex = enemy.hitChars.length;
                enemy.hitChars += enemy.word[charIndex];

                // 创建小爆炸效果 - 在击中的字符位置
                const charWidth = enemy.width / enemy.word.length;
                const charX =
                  enemy.position.x -
                  enemy.width / 2 +
                  charWidth * (charIndex + 0.5);
                const charY = enemy.position.y;

                // 使用较小的爆炸效果
                createExplosion(
                  { x: charX, y: charY },
                  0.25, // 尺寸更小
                  true // 使用黄色系
                );

                console.log("【日志】更新击中后:", {
                  敌人索引: j,
                  单词: enemy.word,
                  已输入字符: enemy.typedChars,
                  已击中字符: enemy.hitChars,
                  是否完成:
                    enemy.typedChars.length === enemy.word.length &&
                    enemy.hitChars.length === enemy.word.length,
                });

                // 检查单词是否完成
                if (enemy.hitChars.length === enemy.word.length) {
                  console.log("【日志】单词完全击中，准备移除:", {
                    敌人索引: j,
                    单词: enemy.word,
                  });

                  // 增加分数
                  setScore((prev) => prev + 1);

                  // 创建黄色爆炸效果 - 整个单词消失的大爆炸
                  createExplosion(enemy.position, 1, true);

                  // 播放爆炸音效
                  playExplosionSound();

                  // 移除敌人
                  gameState.current.enemies.splice(j, 1);

                  // 调整活跃敌人索引
                  if (j === gameState.current.activeEnemyIndex) {
                    // 查找下一个未完成的敌人
                    const newActiveIndex = gameState.current.enemies.findIndex(
                      (e) => e.typedChars.length < e.word.length
                    );

                    gameState.current.activeEnemyIndex = newActiveIndex;
                  } else if (j < gameState.current.activeEnemyIndex) {
                    // 如果移除的敌人在活跃敌人之前，需要调整索引
                    gameState.current.activeEnemyIndex--;
                  }

                  j--; // 调整循环索引
                }
              }
            }

            break;
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
            // 在安全线处创建红色爆炸效果
            createExplosion(
              {
                x: enemy.position.x,
                y: gameState.current.safetyLineY,
              },
              1.5,
              false // 使用红色爆炸效果
            );

            // 扣减生命值
            setLives((prev) => {
              const newLives = prev - 1;
              if (newLives <= 0) {
                setGameStatus("gameOver");
                handleGameOver(); // 调用游戏结束处理函数
              }
              return newLives;
            });

            // 播放爆炸音效
            playExplosionSound();

            // 移除敌人
            gameState.current.enemies.splice(i, 1);

            // 如果当前活跃敌人超过安全线，切换到下一个未超过安全线的敌人
            if (i === gameState.current.activeEnemyIndex) {
              const newActiveIndex = gameState.current.enemies.findIndex(
                (e) =>
                  e.position.y < gameState.current.safetyLineY &&
                  e.typedChars.length < e.word.length
              );
              gameState.current.activeEnemyIndex = newActiveIndex;
              console.log(
                "【日志】敌人超过安全线，切换活跃敌人:",
                newActiveIndex
              );
            } else if (i < gameState.current.activeEnemyIndex) {
              // 如果移除的敌人在活跃敌人之前，需要调整索引
              gameState.current.activeEnemyIndex--;
            }

            i--; // 调整循环索引
            continue; // 跳过后续处理
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

        // 在 gameLoop 函数中更新难度级别
        const newDifficultyLevel = Math.floor(difficultyFactor);
        if (newDifficultyLevel !== difficultyLevel) {
          setDifficultyLevel(newDifficultyLevel);
        }

        lastTime = currentTime;
      }

      animationFrameId = requestAnimationFrame(gameLoop);
    };

    // 使用外部定义的 handleKeyPress 函数
    window.addEventListener("keydown", handleKeyPress);
    gameLoop(performance.now());

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
      explosions: [],
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
      explosions: [],
    };
    setScore(0);
    setLives(3);
    setGameStatus("playing");
  };

  // 修改创建爆炸效果的函数，调整颜色参数
  const createExplosion = (
    position: Position,
    size: number = 1,
    isHit: boolean = false
  ) => {
    const particles = [];
    const particleCount = 20 + Math.floor(Math.random() * 10 * size);

    // 根据是否是击中效果选择不同的颜色
    // 击中效果使用黄色系(50)，安全线碰撞使用红色系(0)
    const baseHue = isHit ? 50 : 0;
    const baseColor = isHit ? "#ffeb3b" : "#ff3333"; // 黄色 vs 红色

    // 创建爆炸粒子
    for (let i = 0; i < particleCount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = (1 + Math.random() * 3) * size;

      particles.push({
        x: position.x,
        y: position.y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        radius: (2 + Math.random() * 3) * size,
        color: `hsl(${baseHue + Math.random() * 30}, 100%, ${
          isHit ? 70 : 60
        }%)`,
        alpha: 1,
      });
    }

    // 添加爆炸效果到数组
    gameState.current.explosions.push({
      position: { ...position },
      radius: 10 * size,
      color: baseColor,
      alpha: 1,
      maxRadius: (40 + Math.random() * 20) * size,
      particles,
    });
  };

  // 在分数变化时更新显示分数
  useEffect(() => {
    setDisplayScore(score);
  }, [score]);

  // 播放射击音效的函数
  const playShootSound = () => {
    try {
      if (sounds.shootSound) {
        const soundClone = sounds.shootSound.cloneNode(
          true
        ) as HTMLAudioElement;
        soundClone.volume = 0.5;
        soundClone.play().catch((err) => {
          console.error("射击音效播放失败:", err);
        });
      }
    } catch (error) {
      console.error("播放射击音效时出错:", error);
    }
  };

  // 播放爆炸音效的函数
  const playExplosionSound = () => {
    try {
      if (sounds.explosionSound) {
        const soundClone = sounds.explosionSound.cloneNode(
          true
        ) as HTMLAudioElement;
        soundClone.volume = 0.6;
        soundClone.play().catch((err) => {
          console.error("爆炸音效播放失败:", err);
        });
      }
    } catch (error) {
      console.error("播放爆炸音效时出错:", error);
    }
  };

  return (
    <div className={styles.gameContainer}>
      <canvas ref={canvasRef} className={styles.gameCanvas} />

      {/* 分数显示 */}
      {gameStatus === "playing" && (
        <div className={styles.scoreDisplay}>
          <span className={styles.scoreValue}>{displayScore}</span>
        </div>
      )}

      {/* 难度级别显示 */}
      {gameStatus === "playing" && difficultyLevel > 1 && (
        <div className={styles.difficultyDisplay}>
          <span className={styles.difficultyValue}>
            难度: {difficultyLevel}
          </span>
        </div>
      )}

      {gameStatus === "playing" && (
        <VirtualKeyboard
          onKeyPress={(key) => {
            // 创建一个模拟的键盘事件
            const event = {
              key,
              preventDefault: () => {},
            } as KeyboardEvent;
            handleKeyPress(event);
          }}
        />
      )}

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
