import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { useAuth } from "./AuthContext";

const ChatContext = createContext();

export function ChatProvider({ children }) {
  const { user, token } = useAuth();
  const [rooms, setRooms] = useState([]); // Always an array
  const [currentRoom, setCurrentRoom] = useState(null);
  const [messages, setMessages] = useState([]);
  const [socket, setSocket] = useState(null);
  const [typing, setTyping] = useState({});
  const [presence, setPresence] = useState({});

  const sendOptimisticMessage = useCallback((messagePayload) => {
    if (!socket || socket.readyState !== WebSocket.OPEN || !currentRoom || !user) {
      console.error("Cannot send message, socket not ready or missing context");
      return;
    }

    const clientSideId = `temp_${Date.now()}_${Math.random()}`;
    const tempMessage = {
      _id: clientSideId,
      id: clientSideId,
      clientSideId,
      roomId: currentRoom.id,
      senderId: user.id,
      senderName: user.username,
      content: messagePayload.content,
      mediaUrl: messagePayload.mediaUrl || "",
      timestamp: new Date().toISOString(),
      status: "sending",
      reactions: {},
      ...(messagePayload.replyTo && {
        repliedMessage: {
          senderId: messagePayload.replyTo.senderId,
          senderName: messagePayload.replyTo.senderName || (messagePayload.replyTo.senderId === user.id ? 'You' : 'User'),
          content: messagePayload.replyTo.content,
          mediaUrl: messagePayload.replyTo.mediaUrl,
        }
      })
    };

    setMessages(prev => [...prev, tempMessage].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp)));

    socket.send(JSON.stringify({
      type: "message",
      roomId: currentRoom.id,
      clientSideId,
      content: messagePayload.content,
      ...(messagePayload.mediaUrl && { mediaUrl: messagePayload.mediaUrl }),
      ...(messagePayload.replyTo && { replyTo: messagePayload.replyTo.id || messagePayload.replyTo._id }),
    }));
  }, [socket, currentRoom, user]);

  // Fetch rooms on login
  useEffect(() => {
    if (user && token) {
      fetch(`http://localhost:8080/users/${user.id}/rooms`, {
        headers: { Authorization: "Bearer " + token },
      })
        .then((res) => res.json())
        .then((data) => setRooms(Array.isArray(data) ? data : []));
    }
  }, [user, token]);

  // Fetch messages when room changes
  useEffect(() => {
    if (currentRoom && token) {
      fetch(`http://localhost:8080/rooms/${currentRoom.id}/messages?limit=50`, {
        headers: { Authorization: "Bearer " + token },
      })
        .then((res) => res.json())
        .then((data) => setMessages(Array.isArray(data) ? data.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp)) : []));
      // Mark all as read
      fetch(`http://localhost:8080/rooms/${currentRoom.id}/messages/mark-read`, {
        method: "POST",
        headers: { Authorization: "Bearer " + token },
      }).then(() => {
        setRooms((prev) => prev.map((room) =>
          room.id === currentRoom.id ? { ...room, unreadCount: 0 } : room
        ));
      });
    }
  }, [currentRoom, token]);

  // WebSocket connection
  useEffect(() => {
    if (!token || token === "null" || token === "undefined") return;
    const ws = new WebSocket(`ws://localhost:8080/ws?token=${token}`);
    setSocket(ws);
    
    ws.onopen = () => {};

    ws.onmessage = (e) => {
      const data = JSON.parse(e.data);
      if (data.type === "message") {
        setMessages((msgs) => {
          const newMsgs = [...msgs];
          const existingIndex = data.clientSideId ? newMsgs.findIndex(m => m.clientSideId === data.clientSideId) : -1;

          if (existingIndex !== -1) {
            newMsgs[existingIndex] = { ...data, status: 'sent' };
          } else if (!newMsgs.some(m => m.id === data.id)) {
            newMsgs.push({ ...data, status: 'sent' });
          }
          return newMsgs.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
        });

        // Update rooms list with last message, using a functional update
        setRooms((prevRooms) => {
          const newRooms = prevRooms.map((room) => {
            if (room.id === data.roomId) {
              // Get currentRoom from state inside the updater to ensure it's fresh
              setCurrentRoom(current => {
                const unreadCount = room.id === current?.id ? 0 : (room.unreadCount || 0) + 1;
                const updatedRoom = {
                  ...room,
                  lastMessage: { content: data.content, timestamp: data.timestamp },
                  unreadCount: unreadCount
                };
                
                // Update the single room in the list
                setRooms(r => r.map(r_ => r_.id === updatedRoom.id ? updatedRoom : r_));

                return current;
              });
            }
            return room;
          });
          return newRooms;
        });

      } else if (data.type === "typing") {
        setTyping((t) => ({ ...t, [data.userId]: true }));
        setTimeout(() => setTyping((t) => ({ ...t, [data.userId]: false })), 2000);
      } else if (data.type === "presence") {
        setPresence((p) => ({ ...p, [data.userId]: data.status }));
      } else if (data.type === "reaction") {
        setMessages((msgs) =>
          msgs.map((msg) => {
            if (msg.id !== data.messageId) return msg;
            // Remove user from all emoji arrays for this message
            const newReactions = {};
            Object.entries(msg.reactions || {}).forEach(([emoji, usersArr]) => {
              newReactions[emoji] = usersArr.filter((uid) => uid !== data.userId);
            });
            // Toggle: if user already reacted with this emoji, don't add again (removes)
            if (!(
              msg.reactions &&
              msg.reactions[data.emoji] &&
              msg.reactions[data.emoji].includes(data.userId)
            )) {
              // Add user to the new emoji
              newReactions[data.emoji] = [
                ...(newReactions[data.emoji] || []),
                data.userId,
              ];
            }
            // Remove empty arrays
            Object.keys(newReactions).forEach(
              (emoji) =>
                newReactions[emoji].length === 0 && delete newReactions[emoji]
            );
            return { ...msg, reactions: newReactions };
          })
        );
      } else if (data.type === "pin" || data.type === "unpin" || data.type === "star" || data.type === "unstar") {
        setMessages((msgs) =>
          msgs.map((msg) =>
            msg.id === data.messageId || msg.id === data.message._id || msg.id === data.message.id
              ? { ...msg, ...data.message }
              : msg
          ).sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))
        );
      } else if (data.type === "delete") {
        setMessages((msgs) => msgs.filter((msg) => msg.id !== data.messageId && msg._id !== data.messageId));
      } else if (data.type === "forward") {
        // Only add if in the correct room
        if (currentRoom && currentRoom.id === data.roomId) {
          setMessages((msgs) => [...msgs, data.message].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp)));
        }
      }
    };
    
    return () => ws.close();
  }, [token]);

  // Join room on socket
  useEffect(() => {
    if (socket && currentRoom) {
      if (socket.readyState === 1) { // 1 = OPEN
        socket.send(JSON.stringify({ type: "join", roomId: currentRoom.id }));
      } else {
        const handleOpen = () => {
          socket.send(JSON.stringify({ type: "join", roomId: currentRoom.id }));
        };
        socket.addEventListener("open", handleOpen, { once: true });
        // Clean up event listener if effect re-runs or component unmounts
        return () => {
          socket.removeEventListener("open", handleOpen);
        };
      }
    }
  }, [socket, currentRoom]);

  // Send reaction
  const sendReaction = (roomId, messageId, emoji) => {
    if (socket && socket.readyState === 1) {
      socket.send(
        JSON.stringify({
          type: "reaction",
          roomId,
          messageId,
          emoji,
        })
      );
    }
  };

  const deleteMessage = (roomId, messageId) => {
    if (socket && socket.readyState === 1) {
      socket.send(JSON.stringify({ type: 'delete', roomId, messageId }));
    }
  };

  const forwardMessage = (toRoomId, message) => {
    if (socket && socket.readyState === 1) {
      socket.send(JSON.stringify({ type: 'forward', toRoomId, messageId: message.id || message._id }));
    }
  }

  return (
    <ChatContext.Provider
      value={{
        rooms,
        setRooms,
        currentRoom,
        setCurrentRoom,
        messages,
        setMessages,
        socket,
        typing,
        presence,
        sendReaction,
        sendOptimisticMessage,
        deleteMessage,
        forwardMessage,
      }}
    >
      {children}
    </ChatContext.Provider>
  );
}

export function useChat() {
  return useContext(ChatContext);
} 