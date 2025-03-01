import React from "react";
import { useNavigate } from "react-router-dom";
import styles from "./style.module.css";

const StartPage: React.FC = () => {
  const navigate = useNavigate();

  const handleStartGame = () => {
    navigate("/game");
  };

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>飞机大战</h1>
      <button className={styles.startButton} onClick={handleStartGame}>
        开始游戏
      </button>
    </div>
  );
};

export default StartPage;
