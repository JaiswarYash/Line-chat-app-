import React, { useRef, useEffect, useState } from "react";
import { useChat } from "../context/ChatContext";
import { useAuth } from "../context/AuthContext";
import MessageInput from "./MessageInput";
import { FaReply, FaRegCopy, FaEllipsisV, FaInfoCircle, FaStar, FaTrash, FaForward, FaThumbtack, FaRegSmile, FaDownload, FaFileAlt, FaStar as FaStarSolid, FaThumbtack as FaThumbtackSolid, FaSearch, FaPlay } from "react-icons/fa";

const bgPattern = {
  backgroundColor: "#111b21",
  backgroundImage:
    "radial-gradient(rgba(255,255,255,0.04) 1px, transparent 1px), radial-gradient(rgba(255,255,255,0.03) 1px, transparent 1px)",
  backgroundSize: "32px 32px",
  backgroundPosition: "0 0, 16px 16px",
};

const bubbleStyle = (isMe) => ({
  background: isMe ? "#005C4B" : "#202C33",
  color: "#fff",
  borderRadius: isMe ? "12px 2px 12px 12px" : "2px 12px 12px 12px",
  padding: "8px 12px 18px 12px",
  maxWidth: 460,
  wordBreak: "break-word",
  fontSize: 16.2,
  position: "relative",
  marginBottom: 2,
  boxShadow: "0 1px 1px rgba(0,0,0,0.08)",
  border: "none",
  minWidth: 60,
});

const contextMenuStyle = {
  position: "absolute",
  zIndex: 100,
  background: "#222e35",
  color: "#fff",
  borderRadius: 12,
  boxShadow: "0 2px 12px #0008",
  padding: 8,
  minWidth: 180,
  fontSize: 15,
  right: 0,
  top: 28,
};

const menuItemStyle = {
  display: "flex",
  alignItems: "center",
  padding: "8px 12px",
  cursor: "pointer",
  borderRadius: 8,
  gap: 10,
};

const emojiList = ["😀", "😂", "😍", "👍", "❤️", "😮", "😢", "🙏", "🔥", "🎉"];

function formatFileSize(bytes) {
  if (!bytes) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function formatDateSeparator(date) {
  const now = new Date();
  const msgDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diff = (today - msgDate) / (1000 * 60 * 60 * 24);
  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  return date.toLocaleDateString();
}

export default function ChatWindow() {
  const { currentRoom, messages, setMessages, typing, presence, sendReaction, rooms } = useChat();
  const { user, token } = useAuth();
  const bottomRef = useRef(null);
  const [menuMsgId, setMenuMsgId] = useState(null);
  const [menuPos, setMenuPos] = useState({});
  const [showEmojiPicker, setShowEmojiPicker] = useState({ msgId: null });
  const [downloadingIdx, setDownloadingIdx] = useState(null);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [downloadError, setDownloadError] = useState("");
  const [replyTo, setReplyTo] = useState(null);
  const [showInfo, setShowInfo] = useState({ open: false, msg: null });
  const [showForward, setShowForward] = useState({ open: false, msg: null });
  const [forwardRoomId, setForwardRoomId] = useState("");
  const [pinnedIds, setPinnedIds] = useState([]);
  const [starredIds, setStarredIds] = useState([]);
  const messageRefs = useRef([]);
  const [userMap, setUserMap] = useState({});
  const [reactionPopup, setReactionPopup] = useState({ open: false, msgId: null, emoji: null, pos: {} });
  const [reactionTab, setReactionTab] = useState('all');

  // New effect for initial scroll
  useEffect(() => {
    if (messages.length) {
      // Use a timeout to ensure the DOM has updated
      const timer = setTimeout(() => {
        bottomRef.current?.scrollIntoView({ behavior: "auto" }); // Use 'auto' for initial load
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [currentRoom]); // Re-run only when the room changes

  // Effect for scrolling on new messages
  useEffect(() => {
    if (messages.length) {
        const lastMessage = messages[messages.length - 1];
        // Only scroll if the last message is from me or very recent
        const isMyMessage = lastMessage.senderId === user.id;
        const isRecent = (new Date() - new Date(lastMessage.timestamp)) < 3000; // 3 seconds
        
        if (isMyMessage || isRecent) {
          const timer = setTimeout(() => {
            bottomRef.current?.scrollIntoView({ behavior: "smooth" });
          }, 0);
          return () => clearTimeout(timer);
        }
    }
  }, [messages, user.id]);

  // Close emoji picker when clicking outside
  useEffect(() => {
    if (showEmojiPicker.msgId === null) return;
    const handleClick = (e) => {
      if (e.target.closest('.emoji-picker-popup')) return;
      setShowEmojiPicker({ msgId: null });
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showEmojiPicker]);

  // Fetch all users in the current room for tooltips
  useEffect(() => {
    if (!currentRoom || !token) return;
    fetch(`http://localhost:8080/users?exclude=`, {
      headers: { Authorization: "Bearer " + token },
    })
      .then(res => res.json())
      .then(users => {
        if (Array.isArray(users)) {
          const map = {};
          users.forEach(u => { 
            map[u.id] = { 
              username: u.username, 
              avatar: u.avatar,
              about: u.about
            }; 
          });
          setUserMap(map);
        }
      });
  }, [currentRoom, token]);

  if (!currentRoom) {
    return (
      <div style={{
        flex: 1,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "#888",
        background: "#111b21"
      }}>
        Select a chat to start messaging.
      </div>
    );
  }

  const isGroup = currentRoom.isGroup;

  const handleMenu = (e, msgId, idx) => {
    e.preventDefault();
    setMenuMsgId(msgId);
    const rect = messageRefs.current[idx]?.getBoundingClientRect();
    // Default position: below and to the right of the bubble
    let top = rect ? rect.top + rect.height + window.scrollY : e.clientY;
    let left = rect ? rect.left + window.scrollX : e.clientX;
    const menuWidth = 240; // Approximate width of the menu
    const menuHeight = 320; // Approximate height of the menu (adjust as needed)
    // Adjust if menu would overflow right edge
    if (left + menuWidth > window.innerWidth) {
      left = Math.max(window.innerWidth - menuWidth - 16, 8); // 16px margin
    }
    // Adjust if menu would overflow bottom edge
    if (top + menuHeight > window.innerHeight + window.scrollY) {
      top = rect ? rect.top + window.scrollY - menuHeight : top - menuHeight;
      if (top < 0) top = 8; // Prevent going off the top
    }
    setMenuPos({ top, left });
  };
  const closeMenu = () => setMenuMsgId(null);

  const handleReact = (msgId) => {
    setShowEmojiPicker({ msgId });
    closeMenu();
  };

  const addReaction = (msg, emoji) => {
    let alreadyReactedWith = null;
    if (msg.reactions) {
      for (const [em, usersArr] of Object.entries(msg.reactions)) {
        if (usersArr.includes(user.id)) {
          alreadyReactedWith = em;
        }
      }
    }
    if (alreadyReactedWith === emoji) {
      // Remove reaction if clicking same emoji
      sendReaction(currentRoom.id, msg.id, emoji);
    } else {
      // Remove previous, add new
      if (alreadyReactedWith) {
        sendReaction(currentRoom.id, msg.id, alreadyReactedWith);
      }
      sendReaction(currentRoom.id, msg.id, emoji);
    }
    setShowEmojiPicker({ msgId: null });
  };

  const getFilteredReactions = (msg) => {
    if (!msg.reactions) return {};
    const userToEmoji = {};
    // Find the latest emoji for each user
    Object.entries(msg.reactions).forEach(([emoji, usersArr]) => {
      usersArr.forEach(uid => {
        userToEmoji[uid] = emoji;
      });
    });
    // Build emoji to usersArr map, only if that emoji is the user's latest
    const filtered = {};
    Object.entries(msg.reactions).forEach(([emoji, usersArr]) => {
      const filteredUsers = usersArr.filter(uid => userToEmoji[uid] === emoji);
      if (filteredUsers.length > 0) filtered[emoji] = filteredUsers;
    });
    return filtered;
  };

  const handleCopy = (msg) => {
    navigator.clipboard.writeText(msg.content);
    closeMenu();
  };

  const handleReply = (msg) => {
    setReplyTo(msg);
    closeMenu();
  };

  const handleInfo = (msg) => {
    setShowInfo({ open: true, msg });
    closeMenu();
  };

  const handlePin = async (msg) => {
    await fetch(`http://localhost:8080/messages/${msg.id}/pin`, {
      method: "POST",
      headers: { Authorization: "Bearer " + token },
    });
    await refetchMessages();
    closeMenu();
  };

  const handleUnpin = async (msg) => {
    await fetch(`http://localhost:8080/messages/${msg.id}/unpin`, {
      method: "POST",
      headers: { Authorization: "Bearer " + token },
    });
    await refetchMessages();
    closeMenu();
  };

  const handleStar = async (msg) => {
    await fetch(`http://localhost:8080/messages/${msg.id}/star`, {
      method: "POST",
      headers: { Authorization: "Bearer " + token },
    });
    await refetchMessages();
    closeMenu();
  };

  const handleUnstar = async (msg) => {
    await fetch(`http://localhost:8080/messages/${msg.id}/unstar`, {
      method: "POST",
      headers: { Authorization: "Bearer " + token },
    });
    await refetchMessages();
    closeMenu();
  };

  const handleForward = (msg) => {
    setShowForward({ open: true, msg });
    setForwardRoomId("");
    closeMenu();
  };

  const handleForwardSend = async () => {
    if (!showForward.msg || !forwardRoomId) return;
    await fetch(`http://localhost:8080/messages/${showForward.msg.id}/forward`, {
      method: "POST",
      headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
      body: JSON.stringify({ toRoomId: forwardRoomId }),
    });
    setShowForward({ open: false, msg: null });
    setForwardRoomId("");
  };

  const handleDelete = async (msg) => {
    const msgId = msg.id || msg._id;
    if (!msgId) return;
    await fetch(`http://localhost:8080/messages/${msgId}`, {
      method: "DELETE",
      headers: { Authorization: "Bearer " + token },
    });
    await refetchMessages();
    closeMenu();
  };

  const handleDownload = async (msg, idx) => {
    if (!msg.mediaUrl) return;
    setDownloadError("");
    setDownloadingIdx(idx);
    setDownloadProgress(0);
    try {
      const url = `http://localhost:8080${msg.mediaUrl}`;
      const response = await fetch(url);
      if (!response.ok) throw new Error("Download failed");
      const contentLength = response.headers.get('content-length');
      const total = contentLength ? parseInt(contentLength, 10) : 0;
      let loaded = 0;
      const reader = response.body.getReader();
      const chunks = [];
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
        loaded += value.length;
        if (total) setDownloadProgress(Math.round((loaded / total) * 100));
      }
      const blob = new Blob(chunks);
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = msg.mediaUrl.split('/').pop();
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(link.href), 1000);
    } catch (err) {
      setDownloadError("Download failed. Please try again.");
    }
    setDownloadingIdx(null);
    setDownloadProgress(0);
    closeMenu();
  };

  const handleToggleReaction = (msg, emoji) => {
    const userHasReacted = msg.reactions && msg.reactions[emoji] && msg.reactions[emoji].includes(user.id);
    sendReaction(currentRoom.id, msg.id, emoji);
    // UI will update via socket event
  };

  // Helper to refetch messages after an action
  const refetchMessages = async () => {
    if (!currentRoom || !token) return;
    const res = await fetch(`http://localhost:8080/rooms/${currentRoom.id}/messages?limit=50`, {
      headers: { Authorization: "Bearer " + token },
    });
    const data = await res.json();
    setMessages(Array.isArray(data) ? data : []);
  };

  // Helper to get participant IDs (excluding self)
  function getOtherParticipantIds() {
    if (!currentRoom || !currentRoom.members) return [];
    return currentRoom.members.filter(id => id !== user.id);
  }

  // Helper to open reaction popup
  const openReactionPopup = (msgId, emoji, e) => {
    const rect = e.target.getBoundingClientRect();
    setReactionTab('all');
    setReactionPopup({
      open: true,
      msgId,
      emoji,
      pos: { top: rect.bottom + window.scrollY + 8, left: rect.left + window.scrollX }
    });
  };
  const closeReactionPopup = () => setReactionPopup({ open: false, msgId: null, emoji: null, pos: {} });

  // Helper to handle clicking emoji below message
  const handleReactionClick = (msgId, emoji, usersArr, e) => {
    openReactionPopup(msgId, emoji, e);
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        background: '#111b21',
        minHeight: 0,
      }}
      onClick={closeMenu}
    >
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          gap: 2,
          minHeight: 0,
          overflowY: "auto",
          background: '#111b21',
          backgroundImage: `url('data:image/svg+xml;utf8,<svg width=\"400\" height=\"400\" viewBox=\"0 0 400 400\" fill=\"none\" xmlns=\"http://www.w3.org/2000/svg\"><rect width=\"400\" height=\"400\" fill=\"%23111b21\"/><path d=\"M40 40h40v40H40zM120 120h40v40h-40zM200 40h40v40h-40zM280 120h40v40h-40z\" fill=\"%23222e35\" fill-opacity=\"0.12\"/></svg>')`,
        }}
      >
        {messages.length === 0
          ? <div style={{ color: '#aebac1', textAlign: 'center', marginTop: 80, fontSize: 20, opacity: 0.7 }}>No messages yet. Say hello!</div>
          : (() => {
              let lastDate = null;
              const otherParticipantIds = getOtherParticipantIds();
              const lastSentIdx = [...messages].map((msg, i) => msg.senderId === user.id ? i : null).filter(i => i !== null).pop();
              return [...messages]
                .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
                .map((msg, i, arr) => {
                  const isMe = msg.senderId === user.id;
                  const msgDate = new Date(msg.timestamp);
                  let showDate = false;
                  if (!lastDate || msgDate.toDateString() !== lastDate.toDateString()) {
                    showDate = true;
                    lastDate = msgDate;
                  }
                  
                  // Use the repliedMessage from the backend if it exists
                  const repliedMsg = msg.repliedMessage 
                    ? {
                        senderId: msg.repliedMessage.senderId,
                        senderName: msg.repliedMessage.senderName,
                        content: msg.repliedMessage.content,
                        mediaUrl: msg.repliedMessage.mediaUrl,
                      } 
                    : null;
                  
                  let showSeen = false;
                  if (isMe && i === lastSentIdx && msg.readBy && otherParticipantIds.length > 0) {
                    showSeen = otherParticipantIds.every(pid => msg.readBy.includes(pid));
                  }
                  return (
                    <React.Fragment key={msg.id || i}>
                      {showDate && (
                        <div style={{ display: 'flex', justifyContent: 'center', margin: '18px 0 10px 0' }}>
                          <span style={{ background: '#222e35', color: '#aebac1', borderRadius: 16, padding: '6px 18px', fontWeight: 600, fontSize: 15, letterSpacing: 1, boxShadow: '0 1px 4px #0002' }}>
                            {formatDateSeparator(msgDate)}
                          </span>
                        </div>
                      )}
                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          alignItems: isMe ? "flex-end" : "flex-start",
                          marginBottom: 8,
                          position: "relative",
                          paddingLeft: isMe ? 80 : 0,
                          paddingRight: isMe ? 0 : 80,
                        }}
                      >
                        {/* Message bubble */}
                        <div
                          ref={el => messageRefs.current[i] = el}
                          style={{
                            ...bubbleStyle(isMe),
                            marginRight: isMe ? 16 : 0,
                            marginLeft: isMe ? 0 : 16,
                          }}
                          onContextMenu={(e) => handleMenu(e, msg.id, i)}
                        >
                          {msg.pinned && <FaThumbtackSolid style={{ color: '#53bdeb', position: 'absolute', left: -24, top: 8 }} />}
                          {msg.starredBy && msg.starredBy.includes(user.id) && <FaStarSolid style={{ color: 'gold', position: 'absolute', left: -24, top: 36 }} />}
                          {isGroup && !isMe && <div style={{ fontWeight: "bold", fontSize: 13, color: "#53bdeb", marginBottom: 2 }}>{msg.senderName || "User"}</div>}
                          {/* Reply preview inside bubble - WhatsApp style */}
                          {repliedMsg && (
                            <div style={{
                              display: 'flex',
                              flexDirection: 'column',
                              alignItems: 'flex-start',
                              background: 'rgba(0,0,0,0.2)',
                              borderLeft: `3px solid ${isMe ? '#45D952' : '#53bdeb'}`,
                              padding: '6px 10px',
                              borderRadius: 8,
                              marginBottom: 5,
                              color: '#aebac1',
                              fontSize: 14.5,
                              maxWidth: '100%',
                              overflow: 'hidden',
                              gap: 10,
                            }}>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontWeight: '600', color: isMe ? '#45D952' : '#53bdeb' }}>
                                  {repliedMsg.senderName || (repliedMsg.senderId === user.id ? 'You' : 'User')}
                                </div>
                                <div style={{
                                  color: '#e9edef',
                                  marginTop: 2,
                                  whiteSpace: 'nowrap',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                }}>
                                  {repliedMsg.content ? repliedMsg.content.slice(0, 100) : (repliedMsg.mediaUrl ? '📷 Media' : '[empty message]')}
                                </div>
                              </div>

                              {repliedMsg.mediaUrl && (
                                <div style={{position: 'relative'}}>
                                  <img
                                    src={`http://localhost:8080${repliedMsg.mediaUrl}`}
                                    alt="reply-thumb"
                                    style={{ width: 44, height: 44, borderRadius: 8, objectFit: 'cover', background: '#111' }}
                                  />
                                  {repliedMsg.mediaUrl.match(/\.(mp4|mov|avi|mkv)$/i) && (
                                    <div style={{
                                        position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        background: 'rgba(0,0,0,0.4)', borderRadius: 8,
                                    }}>
                                        <FaPlay color="white" size={18} />
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          )}
                          {msg.mediaUrl && msg.mediaUrl.match(/\.(pdf)$/i) ? (
                            <div style={{ display: 'flex', alignItems: 'center', background: '#181f23', borderRadius: 10, padding: '12px 16px', marginBottom: 6, gap: 12 }}>
                              <FaFileAlt style={{ fontSize: 36, color: '#ea4335', marginRight: 8 }} />
                              <div style={{ flex: 1 }}>
                                <div style={{ fontWeight: 600, fontSize: 16, color: '#fff' }}>{msg.mediaUrl.split('/').pop()}</div>
                                <div style={{ fontSize: 13, color: '#aebac1', marginTop: 2 }}>{formatFileSize(msg.fileSize)}</div>
                              </div>
                              <a href={`http://localhost:8080${msg.mediaUrl}`} target="_blank" rel="noopener noreferrer" style={{ color: '#53bdeb', fontWeight: 500, fontSize: 15, textDecoration: 'underline', marginLeft: 8 }}>Open</a>
                            </div>
                          ) : msg.mediaUrl && msg.mediaUrl.match(/\.(jpg|jpeg|png|gif|bmp|webp)$/i) ? (
                            <div style={{ maxWidth: 220, marginTop: 4, borderRadius: 12, overflow: 'hidden', boxShadow: '0 2px 8px #0006' }}>
                              <img 
                                src={`http://localhost:8080${msg.mediaUrl}`} 
                                alt="media" 
                                style={{ 
                                  width: '100%',
                                  height: '100%',
                                  objectFit: 'cover',
                                  objectPosition: 'center',
                                  display: 'block'
                                }} 
                              />
                            </div>
                          ) : null}
                          {msg.content && <div style={{ whiteSpace: 'pre-line', wordBreak: 'break-word', marginTop: repliedMsg ? 4 : 0 }}>{msg.content}</div>}
                          {/* Reactions display */}
                          {(() => {
                            const filteredReactions = getFilteredReactions(msg);
                            return Object.keys(filteredReactions).length > 0 && (
                              <div style={{ display: 'flex', gap: 4, marginTop: 6, flexWrap: 'wrap' }}>
                                {Object.entries(filteredReactions).map(([emoji, usersArr]) => (
                                  <span
                                    key={emoji}
                                    style={{
                                      background: usersArr.includes(user.id) ? '#53bdeb' : '#181f23',
                                      color: usersArr.includes(user.id) ? '#fff' : '#aebac1',
                                      borderRadius: 8,
                                      padding: '2px 8px',
                                      fontSize: 16,
                                      cursor: 'pointer',
                                      userSelect: 'none',
                                      border: usersArr.includes(user.id) ? '1px solid #53bdeb' : '1px solid #333',
                                    }}
                                    onClick={(e) => handleReactionClick(msg.id, emoji, usersArr, e)}
                                  >
                                    {emoji} {usersArr.length > 1 ? usersArr.length : ''}
                                  </span>
                                ))}
                              </div>
                            );
                          })()}
                          <div style={{ position: 'absolute', right: 12, bottom: 6, fontSize: 11, color: '#d1d7db', opacity: 0.85, textAlign: 'right' }}>{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                          <FaEllipsisV style={{ position: "absolute", right: 8, top: 8, color: "#aebac1", fontSize: 18, cursor: "pointer", opacity: 0.9, zIndex: 10 }} onClick={(e) => handleMenu(e, msg.id, i)} />
                        </div>
                        {/* Instagram-style Seen indicator */}
                        {showSeen && (
                          <div style={{ fontSize: 12, color: '#53bdeb', marginTop: 2, marginRight: 18, fontWeight: 500 }}>Seen</div>
                        )}
                      </div>
                    </React.Fragment>
                  );
                });
            })()}
        <div ref={bottomRef} />

        {Object.values(typing).some(Boolean) && (
          <div style={{ color: "#53bdeb", fontSize: 15, margin: "8px 0", fontStyle: 'italic', paddingLeft: 12 }}>User is typing...</div>
        )}
      </div>

      {/* Reply preview above input bar */}
      {/* This is now handled inside MessageInput component */}

      {/* Input bar: only MessageInput */}
      <MessageInput replyTo={replyTo} onCancelReply={() => setReplyTo(null)} />

      {/* Download progress modal */}
      {downloadingIdx !== null && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.25)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#222e35', padding: 32, borderRadius: 16, boxShadow: '0 2px 16px #000a', minWidth: 320, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div style={{ color: '#fff', fontSize: 18, marginBottom: 16 }}>Downloading...</div>
            <div style={{ width: '100%', background: '#111b21', borderRadius: 8, height: 16, marginBottom: 12 }}>
              <div style={{ width: `${downloadProgress}%`, background: '#53bdeb', height: '100%', borderRadius: 8, transition: 'width 0.2s' }} />
            </div>
            <div style={{ color: '#aebac1', fontSize: 15 }}>{downloadProgress}%</div>
            {downloadError && <div style={{ color: '#ff6b6b', marginTop: 12 }}>{downloadError}</div>}
            <button onClick={() => setDownloadingIdx(null)} style={{ marginTop: 18, background: '#444', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 18px', fontSize: 16, cursor: 'pointer' }}>Close</button>
          </div>
        </div>
      )}

      {/* Message info modal */}
      {showInfo.open && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.25)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#222e35', padding: 32, borderRadius: 16, boxShadow: '0 2px 16px #000a', minWidth: 320, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div style={{ color: '#fff', fontSize: 18, marginBottom: 16 }}>Message Info</div>
            <div style={{ color: '#aebac1', fontSize: 15, marginBottom: 8 }}>Sender: {showInfo.msg?.senderName || 'You'}</div>
            <div style={{ color: '#aebac1', fontSize: 15, marginBottom: 8 }}>Time: {showInfo.msg && new Date(showInfo.msg.timestamp).toLocaleString()}</div>
            <div style={{ color: '#aebac1', fontSize: 15, marginBottom: 8 }}>Content: {showInfo.msg?.content}</div>
            <button onClick={() => setShowInfo({ open: false, msg: null })} style={{ marginTop: 18, background: '#444', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 18px', fontSize: 16, cursor: 'pointer' }}>Close</button>
          </div>
        </div>
      )}

      {/* Forward modal */}
      {showForward.open && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.25)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#222e35', padding: 32, borderRadius: 16, boxShadow: '0 2px 16px #000a', minWidth: 320, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div style={{ color: '#fff', fontSize: 18, marginBottom: 16 }}>Forward Message</div>
            <select value={forwardRoomId} onChange={e => setForwardRoomId(e.target.value)} style={{ width: '100%', marginBottom: 16, padding: 8, borderRadius: 8, background: '#111b21', color: '#fff', border: 'none' }}>
              <option value="">Select chat...</option>
              {rooms.filter(r => r.id !== currentRoom.id).map(r => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </select>
            <button onClick={handleForwardSend} disabled={!forwardRoomId} style={{ background: '#53bdeb', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 24px', fontSize: 16, cursor: forwardRoomId ? 'pointer' : 'not-allowed', marginBottom: 8 }}>Forward</button>
            <button onClick={() => setShowForward({ open: false, msg: null })} style={{ background: '#444', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 18px', fontSize: 16, cursor: 'pointer' }}>Cancel</button>
          </div>
        </div>
      )}

      {/* Context Menu */}
      {menuMsgId !== null && (() => {
        const msg = messages.find(m => m.id === menuMsgId);
        if (!msg) return null;
        return (
          <div
            style={{
              position: 'fixed',
              top: menuPos.top,
              left: menuPos.left,
              zIndex: 1000,
              background: '#222e35',
              color: '#fff',
              borderRadius: 12,
              boxShadow: '0 2px 12px #0008',
              padding: 8,
              minWidth: 180,
              fontSize: 15,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={menuItemStyle} onClick={() => handleReact(msg.id)}>
              <FaRegSmile style={{ fontSize: 16 }} />
              React
            </div>
            <div style={menuItemStyle} onClick={() => handleReply(msg)}>
              <FaReply style={{ fontSize: 16 }} />
              Reply
            </div>
            <div style={menuItemStyle} onClick={() => handleForward(msg)}>
              <FaForward style={{ fontSize: 16 }} />
              Forward
            </div>
            <div style={menuItemStyle} onClick={() => handleCopy(msg)}>
              <FaRegCopy style={{ fontSize: 16 }} />
              Copy
            </div>
            {msg.pinned ? (
              <div style={menuItemStyle} onClick={() => handleUnpin(msg)}>
                <FaThumbtack style={{ fontSize: 16 }} />
                Unpin
              </div>
            ) : (
              <div style={menuItemStyle} onClick={() => handlePin(msg)}>
                <FaThumbtack style={{ fontSize: 16 }} />
                Pin
              </div>
            )}
            {msg.starredBy?.includes(user.id) ? (
              <div style={menuItemStyle} onClick={() => handleUnstar(msg)}>
                <FaStar style={{ fontSize: 16 }} />
                Unstar
              </div>
            ) : (
              <div style={menuItemStyle} onClick={() => handleStar(msg)}>
                <FaStar style={{ fontSize: 16 }} />
                Star
              </div>
            )}
            <div style={menuItemStyle} onClick={() => handleInfo(msg)}>
              <FaInfoCircle style={{ fontSize: 16 }} />
              Info
            </div>
            {msg.mediaUrl && (
              <div style={menuItemStyle} onClick={() => handleDownload(msg)}>
                <FaDownload style={{ fontSize: 16 }} />
                Download
              </div>
            )}
            <div style={{ ...menuItemStyle, color: '#ff6b6b' }} onClick={() => handleDelete(msg)}>
              <FaTrash style={{ fontSize: 16 }} />
              Delete
            </div>
          </div>
        );
      })()}

      {/* Emoji Picker */}
      {showEmojiPicker.msgId !== null && (
        <div
          className="emoji-picker-popup"
          style={{
            position: 'fixed',
            top: menuPos.top,
            left: menuPos.left,
            zIndex: 1001,
            background: '#222e35',
            color: '#fff',
            borderRadius: 12,
            boxShadow: '0 2px 12px #0008',
            padding: 12,
            fontSize: 20,
            display: 'grid',
            gridTemplateColumns: 'repeat(5, 1fr)',
            gap: 8,
            minWidth: 200,
          }}
          onClick={e => e.stopPropagation()}
        >
          {emojiList.map((emoji, idx) => (
            <div
              key={idx}
              style={{
                cursor: 'pointer',
                padding: 8,
                borderRadius: 8,
                textAlign: 'center',
                transition: 'background 0.2s',
              }}
              onMouseEnter={(e) => e.target.style.background = '#333'}
              onMouseLeave={(e) => e.target.style.background = 'transparent'}
              onClick={() => {
                const msg = messages.find(m => m.id === showEmojiPicker.msgId);
                if (!msg) return null;
                addReaction(msg, emoji);
                setShowEmojiPicker({ msgId: null });
              }}
            >
              {emoji}
            </div>
          ))}
        </div>
      )}

      {/* Reaction popup/modal */}
      {reactionPopup.open && (
        <div
          style={{
            position: 'fixed',
            top: reactionPopup.pos.top,
            left: reactionPopup.pos.left,
            zIndex: 3000,
            background: '#222e35',
            color: '#fff',
            borderRadius: 16,
            boxShadow: '0 2px 16px #000a',
            minWidth: 320,
            minHeight: 120,
            padding: 0,
            overflow: 'hidden',
          }}
          onClick={e => e.stopPropagation()}
        >
          {/* Tabs */}
          {(() => {
            const msg = messages.find(m => m.id === reactionPopup.msgId);
            if (!msg) return null;
            const reactions = msg.reactions || {};
            // Build emoji to users map
            const emojiToUsers = Object.entries(reactions).reduce((acc, [emoji, usersArr]) => {
              acc[emoji] = usersArr;
              return acc;
            }, {});
            // All users with their emoji
            const allUsers = [];
            Object.entries(emojiToUsers).forEach(([emoji, usersArr]) => {
              usersArr.forEach(uid => {
                allUsers.push({ uid, emoji });
              });
            });
            // Unique emojis used
            const emojiTabs = Object.keys(emojiToUsers);
            // Count for each tab
            const allCount = allUsers.length;
            const emojiCounts = emojiTabs.map(e => ({ emoji: e, count: emojiToUsers[e].length }));
            // Filtered users for current tab
            let usersToShow = [];
            if (reactionTab === 'all') {
              usersToShow = allUsers;
            } else {
              usersToShow = (emojiToUsers[reactionTab] || []).map(uid => ({ uid, emoji: reactionTab }));
            }
            return (
              <div style={{ minWidth: 320 }}>
                {/* Tab bar */}
                <div style={{ display: 'flex', alignItems: 'center', borderBottom: '1px solid #333', background: '#181f23' }}>
                  <div
                    onClick={() => setReactionTab('all')}
                    style={{
                      padding: '12px 18px 10px 18px',
                      cursor: 'pointer',
                      fontWeight: reactionTab === 'all' ? 700 : 500,
                      borderBottom: reactionTab === 'all' ? '3px solid #53bdeb' : 'none',
                      color: reactionTab === 'all' ? '#53bdeb' : '#fff',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                    }}
                  >
                    All <span style={{ fontWeight: 600, fontSize: 15, marginLeft: 2 }}>{allCount}</span>
                  </div>
                  {emojiTabs.map(e => (
                    <div
                      key={e}
                      onClick={() => setReactionTab(e)}
                      style={{
                        padding: '12px 18px 10px 18px',
                        cursor: 'pointer',
                        fontWeight: reactionTab === e ? 700 : 500,
                        borderBottom: reactionTab === e ? '3px solid #53bdeb' : 'none',
                        color: reactionTab === e ? '#53bdeb' : '#fff',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                      }}
                    >
                      <span style={{ fontSize: 20 }}>{e}</span> <span style={{ fontWeight: 600, fontSize: 15, marginLeft: 2 }}>{emojiToUsers[e].length}</span>
                    </div>
                  ))}
                  <button onClick={closeReactionPopup} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: '#fff', fontSize: 18, cursor: 'pointer', padding: '0 16px' }}>&times;</button>
                </div>
                {/* User list */}
                <div style={{ maxHeight: 260, overflowY: 'auto', background: '#222e35', padding: 8 }}>
                  {usersToShow.length === 0 && <div style={{ color: '#aebac1', padding: 16 }}>No reactions yet.</div>}
                  {usersToShow.map(({ uid, emoji }) => (
                    <div
                      key={uid + emoji}
                      style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 8px', borderRadius: 10, cursor: uid === user.id ? 'pointer' : 'default', transition: 'background 0.2s' }}
                      onClick={() => {
                        if (uid === user.id) {
                          sendReaction(currentRoom.id, msg.id, emoji); // Remove reaction
                          setTimeout(() => closeReactionPopup(), 100);
                        }
                      }}
                    >
                      {/* Avatar placeholder (replace with real avatar if available) */}
                      <div style={{ width: 38, height: 38, borderRadius: '50%', background: '#333', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 600, fontSize: 18, overflow: 'hidden', position: 'relative' }}>
                        {userMap[uid]?.avatar ? (
                          <img 
                            src={`http://localhost:8080${userMap[uid].avatar}`} 
                            alt="avatar" 
                            style={{ 
                              position: 'absolute',
                              top: '50%',
                              left: '50%',
                              transform: 'translate(-50%, -50%)',
                              width: '100%',
                              height: '100%',
                              objectFit: 'cover'
                            }} 
                          />
                        ) : (
                          userMap[uid]?.username?.[0]?.toUpperCase() || '?'
                        )}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 600, color: uid === user.id ? '#53bdeb' : '#fff', fontSize: 16, textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>{uid === user.id ? 'You' : userMap[uid]?.username || 'User'}</div>
                        {/* Optionally show phone number if available in userMap[uid].phone */}
                        {userMap[uid]?.phone && <div style={{ color: '#aebac1', fontSize: 13 }}>{userMap[uid].phone}</div>}
                      </div>
                      <span style={{ fontSize: 22 }}>{emoji}</span>
                      {uid === user.id && <span style={{ color: '#53bdeb', fontSize: 13, marginLeft: 8 }}>Click to remove</span>}
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
}
