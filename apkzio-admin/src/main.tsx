import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { AuthProvider } from "@/context/AuthContext";
import { ApkzioProvider } from "@/context/ApkzioDataContext";
import { ToastProvider } from "@/components/ui/Toast";
import App from "./App";
import "./styles/globals.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <ApkzioProvider>
          <ToastProvider>
            <App />
          </ToastProvider>
        </ApkzioProvider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);
