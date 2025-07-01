import React from "react";
import { useAuth } from "../context/AuthContext";
import { useChat } from "../context/ChatContext";
import ChatList from "../components/ChatList";
import ChatWindow from "../components/ChatWindow";

export default function ChatPage() {
  const { logout } = useAuth();
  
  return (
    <div style={{ display: "flex", height: "100vh" }}>
      <ChatList onLogout={logout} />
      <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
        <ChatWindow />
      </div>
    </div>
  );
}
