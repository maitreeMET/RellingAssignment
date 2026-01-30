import { BrowserRouter, Routes, Route } from "react-router-dom";
import Dashboard from "./pages/Dashboard";
import QaView from "./pages/QaView";
import ClipsView from "./pages/ClipsView";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/qa/:video_id" element={<QaView />} />
        <Route path="/videos/:video_id/clips" element={<ClipsView />} />
      </Routes>
    </BrowserRouter>
  );
}
