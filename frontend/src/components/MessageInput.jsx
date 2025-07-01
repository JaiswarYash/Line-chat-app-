import React, { useState, useRef, useEffect } from "react";
import { useChat } from "../context/ChatContext";
import { useAuth } from "../context/AuthContext";
import { FaRegSmile, FaPaperclip, FaPaperPlane, FaTimes } from "react-icons/fa";

const emojiList = ["😀", "😂", "😍", "👍", "❤️", "😮", "😢", "🙏", "🔥", "🎉"];

export default function MessageInput({ replyTo, onCancelReply }) {
  const { currentRoom, sendOptimisticMessage, socket } = useChat();
  const { user, token } = useAuth();
  const [text, setText] = useState("");
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [preview, setPreview] = useState(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  const fileInputRef = useRef(null);
  const emojiPickerRef = useRef(null);

  // Close emoji picker on outside click
  useEffect(() => {
    const handler = (e) => {
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(e.target)) {
        setShowEmojiPicker(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleFileChange = (e) => {
    const f = e.target.files[0];
    if (!f) return;
    setFile(f);
    if (f.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onload = (ev) => setPreview(ev.target.result);
      reader.readAsDataURL(f);
    } else {
      setPreview(null);
    }
  };

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!text.trim() && !file) return;
    setError("");

    let mediaUrl = "";
    if (file) {
      setUploading(true);
      const fd = new FormData();
      fd.append("file", file);
      try {
        const res = await fetch(
          `http://localhost:8080/rooms/${currentRoom.id}/media`,
          {
            method: "POST",
            headers: { Authorization: "Bearer " + token },
            body: fd,
          }
        );
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Upload failed");
        mediaUrl = data.url;
      } catch (err) {
        setError(err.message || "Network error");
        setUploading(false);
        return;
      }
      setUploading(false);
    }

    sendOptimisticMessage({
      content: text,
      ...(mediaUrl && { mediaUrl }),
      ...(replyTo && { replyTo: replyTo }),
    });

    setText("");
    setFile(null);
    setPreview(null);
    if (onCancelReply) onCancelReply();
  };

  const handleTyping = () => {
    if(socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ type: "typing", roomId: currentRoom.id }));
    }
  }

  const handleEmojiClick = (emoji) => {
    setText((prev) => prev + emoji);
    setShowEmojiPicker(false);
  };

  return (
    <form
      onSubmit={sendMessage}
      style={{
        bottom: 0,
        display: "flex",
        alignItems: "center",
        width: "100%",
        background: "#202c33",
        padding: "8px 16px",
        zIndex: 10,
      }}
    >
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        background: '#2a3942',
        borderRadius: replyTo ? 12 : 24,
        flex: 1,
        position: 'relative',
      }}>

        {/* NEW Reply Preview */}
        {replyTo && (
          <div style={{
            padding: '8px 12px 6px 12px',
            borderBottom: '1px solid rgba(255,255,255,0.05)',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
          }}>
            <div style={{
              flex: 1,
              minWidth: 0, // for ellipsis to work
              borderLeft: '3px solid #66ff66',
              paddingLeft: 10,
            }}>
              <div style={{ color: '#66ff66', fontWeight: '600', fontSize: 15 }}>
                {replyTo.senderName || (replyTo.senderId === user.id ? 'You' : 'User')}
              </div>
              <div style={{ color: '#aebac1', fontSize: 14, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginTop: 1 }}>
                {replyTo.content ? replyTo.content.slice(0, 100) : '📷 Media'}
              </div>
            </div>
            <button type="button" onClick={onCancelReply} style={{ background: 'none', border: 'none', color: '#aebac1', cursor: 'pointer', fontSize: 20, padding: 4 }}>
              <FaTimes />
            </button>
          </div>
        )}

        {/* Main input bar */}
        <div style={{ display: 'flex', alignItems: 'center', background: 'transparent', flex: 1, padding: '0 12px', minHeight: 48 }}>
          {/* Emoji button */}
          <div style={{ position: 'relative' }}>
            <button type="button" onClick={() => setShowEmojiPicker(v => !v)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 8, display: 'flex', alignItems: 'center' }} disabled={uploading}>
              <FaRegSmile style={{ color: "#aebac1", fontSize: 22 }} />
            </button>
            {showEmojiPicker && (
              <div ref={emojiPickerRef} style={{ position: 'absolute', bottom: '110%', left: 0, background: '#222e35', borderRadius: 12, boxShadow: '0 2px 12px #000a', padding: 8, zIndex: 100, display: 'flex', gap: 6 }}>
                {emojiList.map((emoji) => (
                  <span key={emoji} style={{ fontSize: 22, cursor: 'pointer' }} onClick={() => handleEmojiClick(emoji)}>{emoji}</span>
                ))}
              </div>
            )}
          </div>
          {/* Attachment button */}
          <button type="button" onClick={() => fileInputRef.current?.click()} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 8, display: 'flex', alignItems: 'center' }} disabled={uploading}>
            <FaPaperclip style={{ color: "#aebac1", fontSize: 22 }} />
          </button>
          <input type="file" ref={fileInputRef} onChange={handleFileChange} style={{ display: "none" }} disabled={uploading} />
          {/* Text input */}
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleTyping}
            placeholder="Type a message"
            style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', color: '#fff', fontSize: 16, margin: '0 8px' }}
            disabled={uploading}
          />
          {/* Send button */}
          <button type="submit" style={{ background: 'none', border: 'none', cursor: text.trim() || file ? 'pointer' : 'not-allowed', padding: 8, display: 'flex', alignItems: 'center' }} disabled={uploading || (!text.trim() && !file)}>
            <FaPaperPlane style={{ color: (text.trim() || file) ? "#53bdeb" : "#aebac1", fontSize: 22 }} />
          </button>
          {/* File preview */}
          {preview && (
            <div style={{ position: 'absolute', left: 0, bottom: '110%', background: '#222e35', borderRadius: 8, padding: 4, boxShadow: '0 2px 8px #000a', display: 'flex', alignItems: 'center', gap: 4 }}>
              <img src={preview} alt="preview" style={{ maxHeight: 60, borderRadius: 6 }} />
              <button onClick={() => { setFile(null); setPreview(null); }} style={{ background: '#ff6b6b', color: '#fff', border: 'none', borderRadius: '50%', width: 20, height: 20, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
            </div>
          )}
        </div>
      </div>
      {error && (
        <div style={{ color: "#ff6b6b", fontSize: 13, marginLeft: 12 }}>{error}</div>
      )}
    </form>
  );
}
