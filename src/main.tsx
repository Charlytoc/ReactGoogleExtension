import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Route, Routes } from "react-router";
import "./index.css";
import App from "./routes/index/App.tsx";
import { NotesManager } from "./components/NotesManager/NotesManager.tsx";
import { TaskManager } from "./components/TaskManager/TaskManager.tsx";
import NoteDetail from "./routes/notes/detail/page.tsx";
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/index.html" element={<App />} />
        <Route path="/notes" element={<NotesManager />} />
        <Route path="/notes/:id" element={<NoteDetail />} />
        <Route path="/tasks" element={<TaskManager />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>
);
