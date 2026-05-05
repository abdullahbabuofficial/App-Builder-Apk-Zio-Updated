import { Navigate, Route, Routes } from "react-router-dom";
import { Landing } from "./pages/Landing";
import { Preferences } from "./pages/Preferences";
import { PausedConfirmation } from "./pages/PausedConfirmation";
import { DeletedConfirmation } from "./pages/DeletedConfirmation";
import { ErrorPage } from "./pages/ErrorPage";

// Single-column page frame. We cap at ~480px so the experience feels native
// on phones and stays focused on desktop. Padding shifts up on bigger screens
// to vertically center the card a touch.
export function App() {
  return (
    <div className="min-h-full px-4 pb-12 pt-8 sm:px-6 sm:pt-16">
      <main className="mx-auto w-full max-w-[480px]">
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/preferences" element={<Preferences />} />
          <Route path="/preferences/paused" element={<PausedConfirmation />} />
          <Route path="/preferences/deleted" element={<DeletedConfirmation />} />
          <Route path="/preferences/error" element={<ErrorPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}
