import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { AuthProvider } from "@/context/AuthContext";
import { PushcareProvider } from "@/context/PushcareDataContext";
import App from "./App";
import "./styles/globals.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <PushcareProvider>
          <App />
        </PushcareProvider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);
