import React from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { ChatProvider } from "./context/ChatContext";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import ChatPage from "./pages/ChatPage";

function AppRoutes() {
  const { user, token } = useAuth();
  const isAuthenticated = user && token;

  return (
    <Routes>
      <Route path="/login" element={isAuthenticated ? <Navigate to="/" /> : <Login />} />
      <Route path="/signup" element={isAuthenticated ? <Navigate to="/" /> : <Signup />} />
      <Route path="/" element={isAuthenticated ? <ChatPage /> : <Navigate to="/login" />} />
    </Routes>
  );
}

function App() {
  return (
    <AuthProvider>
      <ChatProvider>
        <Router>
          <AppRoutes />
        </Router>
      </ChatProvider>
    </AuthProvider>
  );
}

export default App;
