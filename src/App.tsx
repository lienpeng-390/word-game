import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import Game from "./components/Game";
import StartPage from "./components/StartPage";
import "./App.css";

function App() {
  // 获取基础路径，使用类型断言避免 TypeScript 错误
  const basePath = (import.meta as any).env.BASE_URL || "/";

  return (
    <Router basename={basePath}>
      <Routes>
        <Route path="/" element={<StartPage />} />
        <Route path="/game" element={<Game />} />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </Router>
  );
}

export default App;
