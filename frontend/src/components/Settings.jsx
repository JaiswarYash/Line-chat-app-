import React, { useState } from "react";
import { useAuth } from "../context/AuthContext";

const sections = [
  { key: "account", label: "Account" },
  { key: "privacy", label: "Privacy" },
  { key: "chats", label: "Chats" },
  { key: "notifications", label: "Notifications" },
  { key: "shortcuts", label: "Keyboard shortcuts" },
  { key: "help", label: "Help" },
];

const menuItemStyle = {
  display: 'block',
  width: '100%',
  padding: '12px 30px',
  background: 'none',
  border: 'none',
  color: '#e9edef',
  fontSize: '16px',
  textAlign: 'left',
  cursor: 'pointer',
  transition: 'background 0.2s',
  ':hover': {
    background: '#2a3942'
  }
};

export default function Settings({ onClose, onLogout }) {
  const [selected, setSelected] = useState("account");
  const { user, token, updateUser } = useAuth();
  const [editing, setEditing] = useState(false);
  const [username, setUsername] = useState(user?.username || "");
  const [about, setAbout] = useState(user?.about || "");
  const [avatar, setAvatar] = useState(user?.avatar || "");
  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleLogout = () => {
    logout();
    if (onLogout) onLogout();
  };

  const handleAvatarChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setAvatarFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setAvatarPreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setError("");
    let avatarUrl = user?.avatar;

    if (avatarFile) {
      const fd = new FormData();
      fd.append("avatar", avatarFile);
      try {
        const res = await fetch(`http://localhost:8080/users/${user.id}/avatar`, {
          method: "POST",
          headers: { Authorization: "Bearer " + token },
          body: fd,
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Upload failed");
        avatarUrl = data.url;
      } catch (err) {
        setError(err.message || "Avatar upload failed");
        setSaving(false);
        return;
      }
    }

    try {
      const res = await fetch(`http://localhost:8080/users/${user.id}`, {
        method: "PATCH",
        headers: {
          Authorization: "Bearer " + token,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username,
          about,
          avatar: avatarUrl,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Update failed");
      updateUser({ ...user, username, about, avatar: avatarUrl });
      onClose();
    } catch (err) {
      setError(err.message || "Update failed");
    }
    setSaving(false);
  };

  return (
    <div style={{ 
      position: "fixed", 
      top: 0, 
      left: 0, 
      right: 0, 
      bottom: 0, 
      background: "#111b21", 
      zIndex: 1000,
      display: "flex",
    }}>
      {/* Left sidebar */}
      <div style={{ 
        width: 300, 
        background: "#202c33",
        borderRight: "1px solid #333",
        padding: "20px 0",
        display: "flex",
        flexDirection: "column"
      }}>
        <div style={{ padding: "20px 30px" }}>
          <div style={{ 
            display: "flex", 
            alignItems: "center", 
            gap: 15,
            marginBottom: 30 
          }}>
             <div style={{ 
              width: 50, 
              height: 50, 
              borderRadius: '50%', 
              position: 'relative', 
              overflow: 'hidden',
              background: '#333',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              {(avatarPreview || (user?.avatar && `http://localhost:8080${user.avatar}`)) ? (
                <img 
                  src={avatarPreview || `http://localhost:8080${user.avatar}`} 
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
                <span style={{ color: '#fff', fontSize: '24px', fontWeight: 'bold' }}>
                  {user?.username?.[0]?.toUpperCase() || "U"}
                </span>
              )}
            </div>
            <div>
              <h3 style={{ color: '#e9edef', fontSize: '18px', marginBottom: 4 }}>{user?.username}</h3>
              <p style={{ color: '#8696a0', fontSize: '14px' }}>{user?.about || "Hi there! I'm using Line"}</p>
            </div>
          </div>
        </div>

        <div style={{ flex: 1 }}>
          {sections.map(section => (
             <button 
                key={section.key}
                onClick={() => setSelected(section.key)}
                style={{
                    ...menuItemStyle,
                    background: selected === section.key ? '#2a3942' : 'transparent',
                    color: selected === section.key ? '#53bdeb' : '#e9edef',
                    fontWeight: selected === section.key ? '700' : 'normal',
                }}
             >
                {section.label}
             </button>
          ))}
          <button style={{ ...menuItemStyle, color: '#ff6b6b' }} onClick={onLogout}>Log out</button>
        </div>
      </div>

      {/* Main content */}
      <div style={{ 
        flex: 1, 
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 40,
        overflowY: 'auto',
        position: 'relative'
      }}>
        <button 
            onClick={onClose}
            style={{
                position: 'absolute',
                top: 20,
                right: 30,
                background: 'transparent',
                border: 'none',
                color: '#8696a0',
                fontSize: '28px',
                cursor: 'pointer',
                lineHeight: 1,
                padding: 10,
            }}
            title="Close"
        >
            &times;
        </button>
        <div style={{width: '100%', maxWidth: 500}}>
            <h2 style={{ color: '#e9edef', fontSize: '24px', marginBottom: 30, textAlign: 'center' }}>Profile</h2>
            <div style={{ 
                background: '#202c33', 
                borderRadius: 12, 
                padding: 40,
                display: 'flex',
                flexDirection: 'column',
                gap: 25
            }}>
                {/* Profile Image */}
                <div style={{ 
                    width: 150,
                    height: 150,
                    borderRadius: '50%',
                    position: 'relative',
                    overflow: 'hidden',
                    background: '#333',
                    margin: '0 auto',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: '3px solid #53bdeb'
                }}>
                    {(avatarPreview || (user?.avatar && `http://localhost:8080${user.avatar}`)) ? (
                        <img 
                            src={avatarPreview || `http://localhost:8080${user.avatar}`} 
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
                        <span style={{ color: '#fff', fontSize: '60px', fontWeight: 'bold' }}>
                            {user?.username?.[0]?.toUpperCase() || "U"}
                        </span>
                    )}
                    <input 
                        type="file" 
                        accept="image/*" 
                        onChange={handleAvatarChange} 
                        style={{ 
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            width: '100%',
                            height: '100%',
                            opacity: 0,
                            cursor: 'pointer'
                        }} 
                    />
                </div>

                {/* Name Field */}
                <div>
                    <label style={{ color: '#8696a0', fontSize: '14px', display: 'block', marginBottom: 8 }}>Your name</label>
                    <input
                        type="text"
                        value={username}
                        onChange={e => setUsername(e.target.value)}
                        style={{
                            width: '100%',
                            padding: '12px 15px',
                            background: '#111b21',
                            border: '1px solid #333',
                            borderRadius: 8,
                            color: '#e9edef',
                            fontSize: '16px',
                            boxSizing: 'border-box'
                        }}
                    />
                    <p style={{ color: '#8696a0', fontSize: '12px', marginTop: 8 }}>This is not your username or PIN. This name will be visible to your Line contacts.</p>
                </div>

                {/* About Field */}
                <div>
                    <label style={{ color: '#8696a0', fontSize: '14px', display: 'block', marginBottom: 8 }}>About</label>
                    <textarea
                        value={about}
                        onChange={e => setAbout(e.target.value)}
                        style={{
                            width: '100%',
                            padding: '12px 15px',
                            background: '#111b21',
                            border: '1px solid #333',
                            borderRadius: 8,
                            color: '#e9edef',
                            fontSize: '16px',
                            minHeight: 100,
                            resize: 'vertical',
                            boxSizing: 'border-box'
                        }}
                    />
                </div>
                
                <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 20 }}>
                    {error && <p style={{ color: '#ff6b6b', fontSize: '14px' }}>{error}</p>}
                    <button 
                        onClick={handleSave} 
                        disabled={saving}
                        style={{
                            padding: '10px 25px',
                            background: '#53bdeb',
                            color: '#fff',
                            border: 'none',
                            borderRadius: 8,
                            fontSize: '16px',
                            fontWeight: '500',
                            cursor: saving ? 'not-allowed' : 'pointer'
                        }}
                    >
                        {saving ? 'Saving...' : 'Save'}
                    </button>
                </div>
            </div>
        </div>
      </div>
    </div>
  );
} 