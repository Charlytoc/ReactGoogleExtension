import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Route, Routes } from "react-router";
import "./index.css";
import App from "./routes/index/App.tsx";
import { NotesManager } from "./components/NotesManager/NotesManager.tsx";
import { TaskManager } from "./components/TaskManager/TaskManager.tsx";
import NoteDetail from "./routes/notes/detail/page.tsx";
import "./internationalization.ts";
import Config from "./routes/config/page.tsx";
import Chat from "./routes/chat/page.tsx";
import Snapties from "./routes/snapties/page.tsx";
import SnaptieDetail from "./routes/snapties/detail/page.tsx";
import { Toaster } from "react-hot-toast";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Toaster />
    <BrowserRouter>
      <Routes>
        <Route path="/index.html" element={<App />} />
        <Route path="/notes" element={<NotesManager />} />
        <Route path="/notes/:id" element={<NoteDetail />} />
        <Route path="/tasks" element={<TaskManager />} />
        <Route path="/chat" element={<Chat />} />
        <Route path="/config" element={<Config />} />
        <Route path="/snapties" element={<Snapties />} />
        <Route path="/snapties/:id" element={<SnaptieDetail />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>
);
