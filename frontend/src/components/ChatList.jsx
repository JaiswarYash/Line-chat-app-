import React, { useState, useEffect, useRef } from "react";
import { useChat } from "../context/ChatContext";
import { useAuth } from "../context/AuthContext";
import { FaCircle, FaCommentAlt, FaEllipsisV, FaSearch, FaArchive, FaUsers, FaStar, FaBell, FaCog, FaUser, FaLock, FaComments, FaKeyboard, FaQuestionCircle, FaSignOutAlt, FaThumbtack, FaPlus, FaCheckSquare } from "react-icons/fa";
import Settings from "./Settings";

const sidebarStyle = {
  width: 340,
  background: "#222e35",
  color: "#fff",
  height: "100vh",
  display: "flex",
  flexDirection: "column",
  borderRight: "1px solid #222",
};
const chatItemStyle = (active) => ({
  display: "flex",
  alignItems: "center",
  padding: "12px 16px",
  cursor: "pointer",
  background: active ? "#2a3942" : "#222e35",
  borderBottom: "1px solid #222",
});
const avatarStyle = {
  width: 48,
  height: 48,
  borderRadius: "50%",
  objectFit: "cover",
  marginRight: 16,
  background: "#444",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontWeight: "bold",
  fontSize: 22,
  color: "#fff",
};
const searchStyle = {
  width: "100%",
  padding: 10,
  background: "#111b21",
  color: "#fff",
  border: "none",
  borderRadius: 8,
  margin: "12px 0",
};

const tabButtonStyle = (active) => ({
  background: active ? "#202c33" : "transparent",
  color: active ? "#53bdeb" : "#aebac1",
  border: "none",
  borderRadius: 20,
  padding: "6px 18px",
  marginRight: 8,
  fontWeight: "bold",
  cursor: "pointer",
  fontSize: 15,
});

const menuItemStyle = {
    display: 'flex',
    alignItems: 'center',
    width: '100%',
    padding: '12px 20px',
    background: 'none',
    border: 'none',
    color: '#e9edef',
    fontSize: '16px',
    textAlign: 'left',
    cursor: 'pointer',
    gap: 15
};

const DropdownMenu = ({ onNewGroup, onLogout, position, onClose, onShowStarred, onSelectChats }) => {
  const handleAction = (action) => {
    if (typeof action === 'function') action();
    if (typeof onClose === 'function') onClose();
  };
  return (
    <div style={{
      position: 'absolute',
      top: position?.top || 55,
      left: position?.left || 'auto',
      right: position?.right,
      background: '#202c33',
      borderRadius: 8,
      boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
      zIndex: 1001,
      width: 260,
      padding: '8px 0',
      color: '#e9edef',
    }}>
      <button onClick={() => handleAction(onNewGroup)} style={menuItemStyle}>
        <FaUsers style={{fontSize: 18, color: '#aebac1'}}/>
        <span>New group</span>
      </button>
      <button onClick={() => handleAction(onShowStarred)} style={menuItemStyle}>
        <FaStar style={{fontSize: 18, color: '#aebac1'}}/>
        <span>Starred messages</span>
      </button>
      <button onClick={() => handleAction(onSelectChats)} style={menuItemStyle}>
        <FaCheckSquare style={{fontSize: 18, color: '#aebac1'}}/>
        <span>Select chats</span>
      </button>
      <div style={{height: 1, background: '#2a3942', margin: '8px 0'}} />
      <button onClick={() => handleAction(onLogout)} style={menuItemStyle}>
        <FaSignOutAlt style={{fontSize: 18, color: '#aebac1'}}/>
        <span>Log out</span>
      </button>
    </div>
  );
};

function ProfileModal({ user, token, onClose, onUpdate }) {
  const [avatar, setAvatar] = useState(user.avatar || "");
  const [about, setAbout] = useState(user.about || "");
  const [username, setUsername] = useState(user.username || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState("");

  const handleAvatarChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setAvatarFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => setAvatarPreview(ev.target.result);
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    setSaving(true);
    setError("");
    let avatarUrl = avatar;
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
          "Content-Type": "application/json",
          Authorization: "Bearer " + token,
        },
        body: JSON.stringify({ 
          avatar: avatarUrl, 
          about: about || "", 
          username: username || user.username 
        }),
      });
      const data = await res.json();
      if (res.ok) {
        onUpdate(data.user);
        onClose();
      } else {
        setError(data.error || "Failed to update profile");
      }
    } catch (err) {
      setError("Network error");
    }
    setSaving(false);
  };

  return (
    <div style={{ 
      position: "fixed", 
      top: 0, 
      left: 0, 
      width: "100vw", 
      height: "100vh", 
      background: "rgba(0,0,0,0.5)", 
      zIndex: 1000, 
      display: "flex", 
      alignItems: "center", 
      justifyContent: "center" 
    }}>
      <div style={{ 
        background: "#222e35", 
        color: "#fff", 
        padding: 32, 
        borderRadius: 12, 
        minWidth: 340, 
        boxShadow: "0 2px 16px #0008", 
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        maxWidth: 400,
        width: '100%',
      }}>
        <h2 style={{ marginBottom: 24, fontSize: 32, fontWeight: 700, letterSpacing: 1 }}>Profile</h2>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: '100%' }}>
          <div style={{ width: 120, height: 120, borderRadius: '50%', marginBottom: 24, position: 'relative', overflow: 'hidden', background: '#333', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '3px solid #53bdeb' }}>
            {(avatarPreview || (avatar && `http://localhost:8080${avatar}`)) ? (
              <img 
                src={avatarPreview || `http://localhost:8080${avatar}`}
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
              <span style={{ color: '#fff', fontSize: '48px', fontWeight: 'bold' }}>
                {username?.[0]?.toUpperCase() || "U"}
              </span>
            )}
            <input
              type="file"
              accept="image/*"
              style={{
                position: 'absolute',
                left: 0,
                top: 0,
                width: '100%',
                height: '100%',
                opacity: 0,
                cursor: 'pointer',
                zIndex: 2
              }}
              onChange={handleAvatarChange}
              title="Upload avatar"
            />
          </div>
          <input
            type="text"
            value={username}
            onChange={e => setUsername(e.target.value)}
            placeholder="Username"
            style={{ width: "100%", marginBottom: 16, padding: 10, borderRadius: 8, border: "none", background: "#111b21", color: "#fff", fontSize: 16 }}
          />
          <textarea
            value={about}
            onChange={e => setAbout(e.target.value)}
            placeholder="About"
            style={{ width: "100%", marginBottom: 24, padding: 10, borderRadius: 8, border: "none", background: "#111b21", color: "#fff", minHeight: 60, fontSize: 16, resize: 'vertical' }}
          />
          <button onClick={handleSave} disabled={saving} style={{ background: "#2a3942", color: "#fff", border: "none", borderRadius: 8, padding: 12, width: "100%", marginBottom: 12, fontSize: 17, fontWeight: 500, cursor: saving ? 'not-allowed' : 'pointer' }}>
            {saving ? "Saving..." : "Save"}
          </button>
          <button onClick={() => setShowProfile(false)} style={{ background: "#444", color: "#fff", border: "none", borderRadius: 8, padding: 12, width: "100%", fontSize: 17, fontWeight: 500, cursor: 'pointer' }}>Cancel</button>
          {error && <div style={{ color: "#ff6b6b", marginTop: 12 }}>{error}</div>}
        </div>
      </div>
    </div>
  );
}

// Helper to format time (e.g., 12:34)
function formatTime(ts) {
  if (!ts) return "";
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export default function ChatList({ onLogout }) {
  const { rooms, setCurrentRoom, currentRoom, setRooms } = useChat();
  const { user, token, login } = useAuth();
  if (!user) {
    return <div style={{ color: "#fff", padding: 32 }}>Please log in to view your chats.</div>;
  }
  const [roomName, setRoomName] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const [showUserModal, setShowUserModal] = useState(false);
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [selectedGroupUsers, setSelectedGroupUsers] = useState([]);
  const [groupName, setGroupName] = useState("");
  const [search, setSearch] = useState("");
  const [showProfile, setShowProfile] = useState(false);
  const [activeTab, setActiveTab] = useState("All");
  const [showSettings, setShowSettings] = useState(false);
  const [archivedIds, setArchivedIds] = useState(() => {
    const saved = localStorage.getItem('archivedRooms');
    return saved ? JSON.parse(saved) : [];
  });
  const [viewingArchived, setViewingArchived] = useState(false);
  const [pinnedIds, setPinnedIds] = useState(() => {
    const saved = localStorage.getItem('pinnedRooms');
    return saved ? JSON.parse(saved) : [];
  });
  const [pinTimes, setPinTimes] = useState(() => {
    const saved = localStorage.getItem('pinTimes');
    return saved ? JSON.parse(saved) : {};
  });
  const [showAddModal, setShowAddModal] = useState(false);
  const [addEmail, setAddEmail] = useState("");
  const [addError, setAddError] = useState("");
  const [adding, setAdding] = useState(false);
  const [showAddContact, setShowAddContact] = useState(false);
  const [contactEmail, setContactEmail] = useState("");
  const [contactError, setContactError] = useState("");
  const [contactSuccess, setContactSuccess] = useState("");
  const [showMenu, setShowMenu] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ top: 55, right: 16 });
  const menuButtonRef = useRef(null);
  const [groupAvatarFile, setGroupAvatarFile] = useState(null);
  const [groupAvatarPreview, setGroupAvatarPreview] = useState("");
  const [groupDescription, setGroupDescription] = useState("");
  const [showStarredModal, setShowStarredModal] = useState(false);
  const [starredMessages, setStarredMessages] = useState([]);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedChats, setSelectedChats] = useState([]);

  useEffect(() => {
    if ((showUserModal || showGroupModal) && token && user) {
      fetch(`http://localhost:8080/users?exclude=${user.id}`, {
        headers: { Authorization: "Bearer " + token },
      })
        .then((res) => res.json())
        .then((data) => setUsers(Array.isArray(data) ? data : []));
    }
  }, [showUserModal, showGroupModal, token, user]);

  useEffect(() => {
    localStorage.setItem('archivedRooms', JSON.stringify(archivedIds));
    localStorage.setItem('pinnedRooms', JSON.stringify(pinnedIds));
    localStorage.setItem('pinTimes', JSON.stringify(pinTimes));
  }, [archivedIds, pinnedIds, pinTimes]);

  useEffect(() => {
    const handleClickOutside = (event) => {
        if (menuButtonRef.current && !menuButtonRef.current.contains(event.target)) {
            setShowMenu(false);
        }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
        document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [menuButtonRef]);

  const handleNewGroupClick = () => {
    console.log('New group clicked');
    setShowMenu(false);
    setShowGroupModal(true);
  };
  
  useEffect(() => {
    const fetchRooms = async () => {
      // ... existing code ...
    };
  }, [rooms]);

  const filteredRooms = rooms.filter((room) =>
    room.name.toLowerCase().includes(search.toLowerCase())
  );

  const handleCreateRoom = async (e) => {
    e.preventDefault();
    setCreating(true);
    setError("");
    try {
      const res = await fetch("http://localhost:8080/rooms", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + token,
        },
        body: JSON.stringify({
          name: roomName,
          members: [user.id],
          isGroup: false,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setRooms((prev) => [...prev, data]);
        setRoomName("");
      } else {
        setError(data.error || "Failed to create room");
      }
    } catch (err) {
      setError("Network error");
    }
    setCreating(false);
  };

  const handleStartPrivateChat = async () => {
    if (!selectedUser) return;
    setCreating(true);
    setError("");
    try {
      // Check if a private chat already exists
      const existing = rooms.find(
        (room) =>
          !room.isGroup &&
          room.members &&
          room.members.includes(user.id) &&
          room.members.includes(selectedUser.id)
      );
      if (existing) {
        setCurrentRoom(existing);
        setShowUserModal(false);
        setCreating(false);
        return;
      }
      const res = await fetch("http://localhost:8080/rooms", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + token,
        },
        body: JSON.stringify({
          name: `Chat with ${selectedUser.username}`,
          members: [user.id, selectedUser.id],
          isGroup: false,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setRooms((prev) => [...prev, data]);
        setCurrentRoom(data);
        setShowUserModal(false);
      } else {
        setError(data.error || "Failed to create chat");
      }
    } catch (err) {
      setError("Network error");
    }
    setCreating(false);
  };

  const handleStartGroupChat = async () => {
    if (!groupName || selectedGroupUsers.length < 2) return;
    setCreating(true);
    setError("");
    try {
      let avatarUrl = "";
      if (groupAvatarFile) {
        // Upload avatar first
        const fd = new FormData();
        fd.append("avatar", groupAvatarFile);
        const res = await fetch(`http://localhost:8080/rooms/avatar`, {
          method: "POST",
          headers: { Authorization: "Bearer " + token },
          body: fd,
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Avatar upload failed");
        avatarUrl = data.url;
      }
      const memberIds = [user.id, ...selectedGroupUsers.map(u => u.id)];
      const res = await fetch("http://localhost:8080/rooms", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + token,
        },
        body: JSON.stringify({
          name: groupName,
          members: memberIds,
          isGroup: true,
          avatar: avatarUrl,
          description: groupDescription,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setRooms(prev => [...prev, data]);
        setCurrentRoom(data);
        setShowGroupModal(false);
        setGroupName("");
        setGroupDescription("");
        setGroupAvatarFile(null);
        setGroupAvatarPreview("");
        setSelectedGroupUsers([]);
        setError("");
      } else {
        setError(data.error || "Failed to create group chat");
      }
    } catch (err) {
      setError("Network error");
    }
    setCreating(false);
  };

  const handleProfileUpdate = (updatedUser) => {
    login(updatedUser, token);
  };

  // Archive/unarchive handlers
  const archiveRoom = (roomId) => setArchivedIds((prev) => [...new Set([...prev, roomId])]);
  const unarchiveRoom = (roomId) => setArchivedIds((prev) => prev.filter((id) => id !== roomId));

  // Filter rooms based on search and archive status
  const searchedRooms = rooms.filter(room => room.name.toLowerCase().includes(search.toLowerCase()));
  const nonArchivedRooms = searchedRooms.filter(room => !archivedIds.includes(room.id));
  const archivedRooms = searchedRooms.filter(room => archivedIds.includes(room.id));

  // Filter non-archived rooms by tab
  let displayedRooms;
  if (activeTab === 'Unread') {
    displayedRooms = nonArchivedRooms.filter(room => room.unreadCount > 0);
  } else if (activeTab === 'Groups') {
    displayedRooms = nonArchivedRooms.filter(room => room.isGroup);
  } else {
    displayedRooms = nonArchivedRooms;
  }

  // Sort: pinned at top (by pin time desc), then unpinned by last message timestamp desc
  const pinnedRooms = displayedRooms.filter(r => pinnedIds.includes(r.id)).sort((a, b) => (pinTimes[b.id] || 0) - (pinTimes[a.id] || 0));
  const unpinnedRooms = displayedRooms.filter(r => !pinnedIds.includes(r.id)).sort((a, b) => {
    const aTime = a.lastMessage && a.lastMessage.timestamp ? new Date(a.lastMessage.timestamp).getTime() : 0;
    const bTime = b.lastMessage && b.lastMessage.timestamp ? new Date(b.lastMessage.timestamp).getTime() : 0;
    return bTime - aTime;
  });
  displayedRooms = [...pinnedRooms, ...unpinnedRooms];

  const pinRoom = (roomId) => {
    setPinnedIds((prev) => [roomId, ...prev.filter(id => id !== roomId)]);
    setPinTimes((prev) => ({ ...prev, [roomId]: Date.now() }));
  };
  const unpinRoom = (roomId) => {
    setPinnedIds((prev) => prev.filter(id => id !== roomId));
    setPinTimes((prev) => {
      const copy = { ...prev };
      delete copy[roomId];
      return copy;
    });
  };

  const handleAddContact = async (e) => {
    e.preventDefault();
    setContactError("");
    setContactSuccess("");
    if (!contactEmail) return;

    try {
      const res = await fetch(`http://localhost:8080/contacts/add`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
        body: JSON.stringify({ email: contactEmail }),
      });
      const data = await res.json();
      if (res.ok) {
        setContactSuccess("Contact added successfully!");
        setContactEmail("");
        
        const roomRes = await fetch("http://localhost:8080/rooms", { headers: { Authorization: "Bearer " + token } });
        const roomData = await roomRes.json();
        setRooms(Array.isArray(roomData) ? roomData : []);
        
        setTimeout(() => {
          setShowAddContact(false);
          setContactSuccess("");
        }, 2000);
      } else {
        setContactError(data.error || "Failed to add contact.");
      }
    } catch (err) {
      setContactError("Network error. Please try again.");
    }
  };

  const handleMenuButtonClick = () => {
    setShowMenu(prev => !prev);
    if (menuButtonRef.current) {
      const rect = menuButtonRef.current.getBoundingClientRect();
      setMenuPosition({
        top: rect.bottom + window.scrollY + 4,
        left: rect.left + window.scrollX,
      });
    }
  };

  // Handler to fetch starred messages
  const handleShowStarred = async () => {
    console.log('Starred messages clicked');
    setShowMenu(false);
    setShowStarredModal(true);
    try {
      const res = await fetch('http://localhost:8080/messages/starred', {
        headers: { Authorization: 'Bearer ' + token },
      });
      const data = await res.json();
      if (res.ok) setStarredMessages(data);
      else setStarredMessages([]);
    } catch {
      setStarredMessages([]);
    }
  };

  // Handler for select chats
  const handleSelectChats = () => {
    console.log('Select chats clicked');
    setShowMenu(false);
    setSelectMode((prev) => !prev);
    setSelectedChats([]);
  };

  // Handler for selecting a chat
  const toggleChatSelect = (roomId) => {
    setSelectedChats((prev) =>
      prev.includes(roomId) ? prev.filter((id) => id !== roomId) : [...prev, roomId]
    );
  };

  // Handler for batch archive (example)
  const handleBatchArchive = () => {
    setArchivedIds((prev) => [...new Set([...prev, ...selectedChats])]);
    setSelectedChats([]);
    setSelectMode(false);
  };

  // Handler for batch delete (example, just removes from UI)
  const handleBatchDelete = () => {
    setRooms((prev) => prev.filter((room) => !selectedChats.includes(room.id)));
    setSelectedChats([]);
    setSelectMode(false);
  };

  const handleLogout = () => {
    console.log('Log out clicked');
    if (typeof onLogout === 'function') onLogout();
    setShowMenu(false);
  };

  return (
    <div style={{ ...sidebarStyle, display: 'flex', flexDirection: 'column', height: '100vh', background: '#222e35' }}>
      {/* Top bar */}
      <div style={{ display: "flex", alignItems: "center", padding: 16, borderBottom: "1px solid #222", background: "#202c33" }}>
        <div style={{ width: 40, height: 40, marginRight: 12, cursor: "pointer", border: "2px solid #53bdeb", borderRadius: '50%', overflow: 'hidden', position: 'relative', background: '#333', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {user.avatar ? (
            <img 
              src={`http://localhost:8080${user.avatar}`} 
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
            <span style={{ color: '#fff', fontSize: '20px', fontWeight: 'bold' }}>
              {user.username?.[0]?.toUpperCase() || "U"}
            </span>
          )}
        </div>
        <FaCircle style={{ color: "#53bdeb", fontSize: 18, marginRight: 18 }} title="Status" />
        <FaCommentAlt style={{ color: "#aebac1", fontSize: 20, marginRight: 18, cursor: "pointer" }} onClick={() => setShowUserModal(true)} title="New chat" />
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <FaPlus title="Add Contact" style={{ cursor: "pointer", fontSize: 20, color: '#aebac1' }} onClick={() => setShowAddContact(true)} />
          <FaEllipsisV
            title="More"
            style={{ cursor: "pointer", fontSize: 20, color: '#aebac1' }}
            onClick={handleMenuButtonClick}
            ref={menuButtonRef}
          />
        </div>
        {showMenu && (
          <DropdownMenu
            onNewGroup={handleNewGroupClick}
            onLogout={handleLogout}
            position={menuPosition}
            onClose={() => setShowMenu(false)}
            onShowStarred={handleShowStarred}
            onSelectChats={handleSelectChats}
          />
        )}
      </div>
      {/* Search bar */}
      <div style={{ padding: "8px 16px", position: 'relative', display: 'flex', alignItems: 'center' }}>
        <FaSearch style={{ position: 'absolute', left: 32, top: '50%', transform: 'translateY(-50%)', color: '#aebac1' }} />
        <input
          type="text"
          placeholder="Search or start new chat"
          style={{
              width: '100%', 
              padding: '10px 16px 10px 52px', 
              background: '#202c33', 
              color: '#fff', 
              border: 'none', 
              borderRadius: 8,
              fontSize: '15px'
          }}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>
      {/* Tabs */}
      <div style={{ display: 'flex', gap: 8, margin: '12px 18px 0 18px' }}>
        <button style={tabButtonStyle(activeTab === 'All')} onClick={() => setActiveTab('All')}>All</button>
        <button style={tabButtonStyle(activeTab === 'Unread')} onClick={() => setActiveTab('Unread')}>Unread</button>
        <button style={tabButtonStyle(activeTab === 'Groups')} onClick={() => setActiveTab('Groups')}>Groups</button>
      </div>
      {/* Chat list */}
      {viewingArchived ? (
        <>
          <div style={{ display: 'flex', alignItems: 'center', padding: 16, borderBottom: '1px solid #222' }}>
            <button onClick={() => setViewingArchived(false)} style={{ background: 'none', border: 'none', color: '#fff', fontSize: 20, cursor: 'pointer', marginRight: 12 }}>←</button>
            <h2 style={{ margin: 0, fontSize: 18 }}>Archived</h2>
          </div>
          <div style={{ flex: 1, overflowY: 'auto', marginTop: 6, minHeight: 0 }}>
            {archivedRooms.map((room) => (
              <div
                key={room.id}
                style={{
                  ...chatItemStyle(currentRoom && currentRoom.id === room.id),
                  transition: 'background 0.2s',
                  cursor: 'pointer',
                  position: 'relative',
                  fontWeight: currentRoom && currentRoom.id === room.id ? 'bold' : 'normal',
                }}
                onClick={() => setCurrentRoom(room)}
                onContextMenu={e => {
                  e.preventDefault();
                  if (archivedIds.includes(room.id)) {
                    unarchiveRoom(room.id);
                  } else {
                    archiveRoom(room.id);
                  }
                }}
              >
                <div style={avatarStyle}>
                  {room.avatar ? (
                    <img src={room.avatar} alt="avatar" style={{ width: 48, height: 48, borderRadius: "50%" }} />
                  ) : (
                    room.name?.[0]?.toUpperCase() || "C"
                  )}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: "bold", fontSize: 17 }}>{room.name}</div>
                  <div style={{ fontSize: 13, color: "#aebac1", marginTop: 2, display: "flex", alignItems: "center", overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                    {room.lastMessage?.content ? room.lastMessage.content.slice(0, 32) : 'Last message...'}
                    <span style={{ marginLeft: 8, fontSize: 11, color: "#53bdeb", background: "#222e35", borderRadius: 8, padding: "2px 8px", display: "inline-block" }}>{formatTime(room.lastMessage?.timestamp)}</span>
                  </div>
                </div>
                {/* Unread badge */}
                {room.unreadCount > 0 && (
                  <div style={{ marginLeft: 8, minWidth: 24, textAlign: "right" }}>
                    <span style={{ background: "#25d366", color: "#111b21", borderRadius: 12, padding: "2px 8px", fontSize: 13, fontWeight: "bold", display: "inline-block" }}>{room.unreadCount}</span>
                  </div>
                )}
                {archivedIds.includes(room.id) && <div style={{ color: '#ffb300', fontSize: 12, marginTop: 4 }}>Archived</div>}
                {/* Pin/unpin button */}
                <span
                  onClick={e => { e.stopPropagation(); pinnedIds.includes(room.id) ? unpinRoom(room.id) : pinRoom(room.id); }}
                  style={{ position: 'absolute', right: 16, top: 16, color: pinnedIds.includes(room.id) ? '#53bdeb' : '#aebac1', fontSize: 18, cursor: 'pointer', zIndex: 2 }}
                  title={pinnedIds.includes(room.id) ? 'Unpin chat' : 'Pin chat'}
                >
                  <FaThumbtack />
                </span>
              </div>
            ))}
            {archivedRooms.length === 0 && <div style={{ color: '#aebac1', textAlign: 'center', marginTop: 40 }}>No archived chats.</div>}
          </div>
        </>
      ) : (
        <>
          <div style={{ flex: 1, overflowY: 'auto', marginTop: 6, minHeight: 0 }}>
            {archivedRooms.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', padding: '12px 18px', cursor: 'pointer', color: '#aebac1' }} onClick={() => setViewingArchived(true)}>
                <FaArchive style={{ marginRight: 16 }} /> Archived ({archivedRooms.length})
              </div>
            )}
            {displayedRooms.map((room) => (
              <div
                key={room.id}
                style={{
                  ...chatItemStyle(currentRoom && currentRoom.id === room.id),
                  transition: 'background 0.2s',
                  cursor: selectMode ? 'pointer' : 'pointer',
                  position: 'relative',
                  fontWeight: currentRoom && currentRoom.id === room.id ? 'bold' : 'normal',
                  background: selectMode && selectedChats.includes(room.id) ? '#2a3942' : undefined,
                  border: selectMode && selectedChats.includes(room.id) ? '2px solid #53bdeb' : undefined,
                }}
                onClick={() => {
                  if (selectMode) toggleChatSelect(room.id);
                  else setCurrentRoom(room);
                }}
              >
                <div style={avatarStyle}>
                  {room.avatar ? (
                    <img src={room.avatar} alt="avatar" style={{ width: 48, height: 48, borderRadius: "50%" }} />
                  ) : (
                    room.name?.[0]?.toUpperCase() || "C"
                  )}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: "bold", fontSize: 17 }}>{room.name}</div>
                  <div style={{ fontSize: 13, color: "#aebac1", marginTop: 2, display: "flex", alignItems: "center", overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                    {room.lastMessage?.content ? room.lastMessage.content.slice(0, 32) : 'Last message...'}
                    <span style={{ marginLeft: 8, fontSize: 11, color: "#53bdeb", background: "#222e35", borderRadius: 8, padding: "2px 8px", display: "inline-block" }}>{formatTime(room.lastMessage?.timestamp)}</span>
                  </div>
                </div>
                {/* Unread badge */}
                {room.unreadCount > 0 && (
                  <div style={{ marginLeft: 8, minWidth: 24, textAlign: "right" }}>
                    <span style={{ background: "#25d366", color: "#111b21", borderRadius: 12, padding: "2px 8px", fontSize: 13, fontWeight: "bold", display: "inline-block" }}>{room.unreadCount}</span>
                  </div>
                )}
                {archivedIds.includes(room.id) && <div style={{ color: '#ffb300', fontSize: 12, marginTop: 4 }}>Archived</div>}
                {/* Select mode checkbox */}
                {selectMode && (
                  <input
                    type="checkbox"
                    checked={selectedChats.includes(room.id)}
                    onChange={() => toggleChatSelect(room.id)}
                    style={{ position: 'absolute', left: 8, top: 8, zIndex: 2 }}
                    onClick={e => e.stopPropagation()}
                  />
                )}
              </div>
            ))}
            {displayedRooms.length === 0 && (
              <div style={{ color: '#aebac1', textAlign: 'center', marginTop: 40, fontSize: 17, opacity: 0.7 }}>
                {activeTab === 'Archived' ? 'No archived chats.' : 'No chats found.'}
              </div>
            )}
          </div>
        </>
      )}
      {/* Settings button fixed at bottom */}
      <div style={{ borderTop: '1px solid #222', padding: '16px 18px', background: '#222e35' }}>
        <button style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'none', border: 'none', color: '#aebac1', fontSize: 17, cursor: 'pointer', width: '100%' }} onClick={() => setShowSettings(true)}>
          <FaCog style={{ fontSize: 20 }} /> Settings
        </button>
      </div>
      {showSettings && <Settings onClose={() => setShowSettings(false)} onLogout={onLogout} />}
      {/* Profile Modal, Modals for private/group chat creation, etc. */}
      {showProfile && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.8)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div style={{ background: "#222e35", padding: 32, borderRadius: 16, minWidth: 320, maxWidth: "90%", position: "relative" }}>
            <button onClick={() => setShowProfile(false)} style={{ position: "absolute", right: 16, top: 16, background: "none", border: "none", color: "#aaa", fontSize: 24, cursor: "pointer" }}>&times;</button>
            <h2 style={{ marginBottom: 24, fontSize: 32, fontWeight: 700, letterSpacing: 1 }}>Profile</h2>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: '100%' }}>
              <div style={{ width: 120, height: 120, borderRadius: '50%', marginBottom: 24, position: 'relative', overflow: 'hidden', background: '#333', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '3px solid #53bdeb' }}>
                {(avatarPreview || (avatar && `http://localhost:8080${avatar}`)) ? (
                  <img 
                    src={avatarPreview || `http://localhost:8080${avatar}`}
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
                  <span style={{ color: '#fff', fontSize: '48px', fontWeight: 'bold' }}>
                    {username?.[0]?.toUpperCase() || "U"}
                  </span>
                )}
                <input
                  type="file"
                  accept="image/*"
                  style={{
                    position: 'absolute',
                    left: 0,
                    top: 0,
                    width: '100%',
                    height: '100%',
                    opacity: 0,
                    cursor: 'pointer',
                    zIndex: 2
                  }}
                  onChange={handleAvatarChange}
                  title="Upload avatar"
                />
              </div>
              <input
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                placeholder="Username"
                style={{ width: "100%", marginBottom: 16, padding: 10, borderRadius: 8, border: "none", background: "#111b21", color: "#fff", fontSize: 16 }}
              />
              <textarea
                value={about}
                onChange={e => setAbout(e.target.value)}
                placeholder="About"
                style={{ width: "100%", marginBottom: 24, padding: 10, borderRadius: 8, border: "none", background: "#111b21", color: "#fff", minHeight: 60, fontSize: 16, resize: 'vertical' }}
              />
              <button onClick={handleSave} disabled={saving} style={{ background: "#2a3942", color: "#fff", border: "none", borderRadius: 8, padding: 12, width: "100%", marginBottom: 12, fontSize: 17, fontWeight: 500, cursor: saving ? 'not-allowed' : 'pointer' }}>
                {saving ? "Saving..." : "Save"}
              </button>
              <button onClick={() => setShowProfile(false)} style={{ background: "#444", color: "#fff", border: "none", borderRadius: 8, padding: 12, width: "100%", fontSize: 17, fontWeight: 500, cursor: 'pointer' }}>Cancel</button>
              {error && <div style={{ color: "#ff6b6b", marginTop: 12 }}>{error}</div>}
            </div>
          </div>
        </div>
      )}
      {/* Add Contact Modal */}
      {showAddContact && (
        <div style={{ position: "fixed", top: 0, left: 0, width: "100vw", height: "100vh", background: "rgba(0,0,0,0.5)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ background: "#222e35", color: "#fff", padding: 32, borderRadius: 12, minWidth: 340, boxShadow: "0 2px 16px #0008" }}>
            <h2 style={{ marginBottom: 24 }}>Add Contact by Email</h2>
            <form onSubmit={handleAddContact}>
              <p style={{color: '#aebac1', marginBottom: 16, fontSize: 15}}>Enter the email address to start a chat.</p>
              <input
                type="email"
                placeholder="user@example.com"
                value={contactEmail}
                onChange={e => setContactEmail(e.target.value)}
                required
                style={{ width: "100%", marginBottom: 16, padding: 10, borderRadius: 8, border: "none", background: "#111b21", color: "#fff" }}
              />
              {contactError && <div style={{ color: "#ff6b6b", marginBottom: 12 }}>{contactError}</div>}
              {contactSuccess && <div style={{ color: "#45D952", marginBottom: 12 }}>{contactSuccess}</div>}
              <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 24 }}>
                <button type="button" onClick={() => setShowAddContact(false)} style={{ background: "#444", color: "#fff", border: "none", borderRadius: 8, padding: "10px 18px", cursor: 'pointer' }}>Cancel</button>
                <button type="submit" style={{ background: "#53bdeb", color: "#fff", border: "none", borderRadius: 8, padding: "10px 18px", cursor: 'pointer' }}>Add Contact</button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Group Modal */}
      {showGroupModal && (
        <div style={{ position: "fixed", top: 0, left: 0, width: "100vw", height: "100vh", background: "rgba(0,0,0,0.5)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ background: "#222e35", color: "#fff", padding: 32, borderRadius: 12, minWidth: 340, boxShadow: "0 2px 16px #0008", width: 400 }}>
            <h2 style={{ marginBottom: 24 }}>Create New Group</h2>
            <form onSubmit={async e => {
              e.preventDefault();
              setError("");
              if (!groupName.trim()) {
                setError("Group name is required.");
                return;
              }
              if (selectedGroupUsers.length < 2) {
                setError("Select at least 2 members.");
                return;
              }
              setCreating(true);
              try {
                let avatarUrl = "";
                if (groupAvatarFile) {
                  // Upload avatar first
                  const fd = new FormData();
                  fd.append("avatar", groupAvatarFile);
                  const res = await fetch(`http://localhost:8080/rooms/avatar`, {
                    method: "POST",
                    headers: { Authorization: "Bearer " + token },
                    body: fd,
                  });
                  const data = await res.json();
                  if (!res.ok) throw new Error(data.error || "Avatar upload failed");
                  avatarUrl = data.url;
                }
                const memberIds = [user.id, ...selectedGroupUsers.map(u => u.id)];
                const res = await fetch("http://localhost:8080/rooms", {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                    Authorization: "Bearer " + token,
                  },
                  body: JSON.stringify({
                    name: groupName,
                    members: memberIds,
                    isGroup: true,
                    avatar: avatarUrl,
                    description: groupDescription,
                  }),
                });
                const data = await res.json();
                if (res.ok) {
                  setRooms(prev => [...prev, data]);
                  setCurrentRoom(data);
                  setShowGroupModal(false);
                  setGroupName("");
                  setGroupDescription("");
                  setGroupAvatarFile(null);
                  setGroupAvatarPreview("");
                  setSelectedGroupUsers([]);
                  setError("");
                } else {
                  setError(data.error || "Failed to create group chat");
                }
              } catch (err) {
                setError("Network error");
              }
              setCreating(false);
            }}>
              {/* Avatar upload */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16 }}>
                <div style={{ width: 56, height: 56, borderRadius: '50%', background: '#333', position: 'relative', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid #53bdeb' }}>
                  {groupAvatarPreview ? (
                    <img src={groupAvatarPreview} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <span style={{ color: '#fff', fontSize: 28 }}>G</span>
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    style={{ position: 'absolute', left: 0, top: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer', zIndex: 2 }}
                    onChange={e => {
                      const file = e.target.files[0];
                      if (!file) return;
                      setGroupAvatarFile(file);
                      const reader = new FileReader();
                      reader.onload = ev => setGroupAvatarPreview(ev.target.result);
                      reader.readAsDataURL(file);
                    }}
                    title="Upload group avatar"
                  />
                </div>
                <input
                  type="text"
                  placeholder="Group name"
                  value={groupName}
                  onChange={e => setGroupName(e.target.value)}
                  required
                  style={{ flex: 1, padding: 10, borderRadius: 8, border: "none", background: "#111b21", color: "#fff" }}
                />
              </div>
              <textarea
                placeholder="Group description (optional)"
                value={groupDescription}
                onChange={e => setGroupDescription(e.target.value)}
                style={{ width: "100%", marginBottom: 16, padding: 10, borderRadius: 8, border: "none", background: "#181f23", color: "#fff", minHeight: 40, fontSize: 15, resize: 'vertical' }}
              />
              <div style={{ marginBottom: 16 }}>
                <div style={{ color: '#aebac1', marginBottom: 8 }}>Add members:</div>
                <div style={{ maxHeight: 120, overflowY: 'auto', background: '#181f23', borderRadius: 8, padding: 8 }}>
                  {users.filter(u => u.id !== user.id).map(u => (
                    <label key={u.id} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, color: '#e9edef', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={selectedGroupUsers.some(sel => sel.id === u.id)}
                        onChange={e => {
                          if (e.target.checked) {
                            setSelectedGroupUsers(prev => [...prev, u]);
                          } else {
                            setSelectedGroupUsers(prev => prev.filter(sel => sel.id !== u.id));
                          }
                        }}
                      />
                      {u.username}
                    </label>
                  ))}
                </div>
              </div>
              {/* Show selected members */}
              {selectedGroupUsers.length > 0 && (
                <div style={{ marginBottom: 12, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {selectedGroupUsers.map(u => (
                    <span key={u.id} style={{ background: '#53bdeb', color: '#fff', borderRadius: 12, padding: '2px 10px', display: 'flex', alignItems: 'center', gap: 6 }}>
                      {u.username}
                      <button type="button" style={{ background: 'none', border: 'none', color: '#fff', marginLeft: 4, cursor: 'pointer', fontSize: 14 }} onClick={() => setSelectedGroupUsers(prev => prev.filter(sel => sel.id !== u.id))}>&times;</button>
                    </span>
                  ))}
                </div>
              )}
              {error && <div style={{ color: "#ff6b6b", marginBottom: 12 }}>{error}</div>}
              <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 24 }}>
                <button type="button" onClick={() => { setShowGroupModal(false); setError(""); }} style={{ background: "#444", color: "#fff", border: "none", borderRadius: 8, padding: "10px 18px", cursor: 'pointer' }}>Cancel</button>
                <button type="submit" disabled={creating || !groupName.trim() || selectedGroupUsers.length < 2} style={{ background: creating || !groupName.trim() || selectedGroupUsers.length < 2 ? '#444' : "#53bdeb", color: "#fff", border: "none", borderRadius: 8, padding: "10px 18px", cursor: creating || !groupName.trim() || selectedGroupUsers.length < 2 ? 'not-allowed' : 'pointer' }}>Create Group</button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Starred Messages Modal */}
      {showStarredModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.5)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#222e35', padding: 32, borderRadius: 16, minWidth: 320, maxWidth: 500, color: '#fff' }}>
            <h2 style={{ marginBottom: 16 }}>Starred Messages</h2>
            <button onClick={() => setShowStarredModal(false)} style={{ position: 'absolute', right: 24, top: 24, background: 'none', border: 'none', color: '#fff', fontSize: 24, cursor: 'pointer' }}>&times;</button>
            <div style={{ maxHeight: 400, overflowY: 'auto' }}>
              {starredMessages.length === 0 ? (
                <div style={{ color: '#aaa', textAlign: 'center', marginTop: 32 }}>No starred messages.</div>
              ) : (
                starredMessages.map((msg) => (
                  <div key={msg.id} style={{ background: '#181f23', borderRadius: 8, padding: 12, marginBottom: 10 }}>
                    <div style={{ fontWeight: 600 }}>{msg.senderName || 'User'}</div>
                    <div style={{ color: '#aebac1', margin: '6px 0' }}>{msg.content}</div>
                    <div style={{ fontSize: 12, color: '#53bdeb' }}>{new Date(msg.timestamp).toLocaleString()}</div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
      {/* Batch actions UI for select mode */}
      {selectMode && (
        <div style={{ display: 'flex', gap: 12, padding: 12, background: '#181f23', borderTop: '1px solid #222', justifyContent: 'flex-end' }}>
          <button onClick={handleBatchArchive} style={{ background: '#53bdeb', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 18px', fontSize: 15, cursor: 'pointer' }}>Archive</button>
          <button onClick={handleBatchDelete} style={{ background: '#ff6b6b', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 18px', fontSize: 15, cursor: 'pointer' }}>Delete</button>
          <button onClick={() => { setSelectMode(false); setSelectedChats([]); }} style={{ background: '#444', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 18px', fontSize: 15, cursor: 'pointer' }}>Cancel</button>
        </div>
      )}
    </div>
  );
}