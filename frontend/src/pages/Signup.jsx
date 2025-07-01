import React, { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { Link, useNavigate } from "react-router-dom";

export default function Signup() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");

  const validatePassword = (password) => {
    if (password.length < 8) {
      return "Password must be at least 8 characters long.";
    }
    if (!/[A-Za-z]/.test(password)) {
      return "Password must contain at least one letter.";
    }
    if (!/\d/.test(password)) {
      return "Password must contain at least one number.";
    }
    if (!/[^A-Za-z0-9]/.test(password)) {
      return "Password must contain at least one special character.";
    }
    return "";
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setErr("");

    const passwordError = validatePassword(password);
    if (passwordError) {
      setErr(passwordError);
      return;
    }

    fetch("http://localhost:8080/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, email, password }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.message) {
          // Auto-login after signup
          fetch("http://localhost:8080/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username, password }),
          })
            .then((res) => res.json())
            .then((data) => {
              if (data.token) {
                login(data.user, data.token);
                navigate("/");
              }
            });
        } else {
          setErr(data.error || "Signup failed");
        }
      });
  };

  return (
    <div style={{ minHeight: '100vh', width: '100%', background: '#111b21', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <form style={{ background: '#202c33', padding: 40, borderRadius: 16, boxShadow: '0 2px 16px #0008', width: '100%', maxWidth: 420, display: 'flex', flexDirection: 'column', gap: 22 }} onSubmit={handleSubmit}>
        <h2 style={{ color: '#e9edef', fontSize: 32, fontWeight: 700, textAlign: 'center', marginBottom: 8 }}>Sign Up</h2>
        {err && <div style={{ color: '#ff6b6b', padding: '10px 12px', background: 'rgba(255, 107, 107, 0.1)', borderRadius: 8, textAlign: 'center' }}>{err}</div>}
        <input
          placeholder="Username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          required
          style={{ padding: 12, borderRadius: 8, border: '1px solid #333', background: '#111b21', color: '#fff', fontSize: 16 }}
        />
        <input
          placeholder="Email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          style={{ padding: 12, borderRadius: 8, border: '1px solid #333', background: '#111b21', color: '#fff', fontSize: 16 }}
        />
        <input
          placeholder="Password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          style={{ padding: 12, borderRadius: 8, border: '1px solid #333', background: '#111b21', color: '#fff', fontSize: 16 }}
        />
        <p style={{ color: '#8696a0', fontSize: '12px', marginTop: -15, padding: '0 5px' }}>
            Password must be 8+ characters and include a letter, a number, and a special character.
        </p>
        <button type="submit" style={{ background: '#53bdeb', color: '#fff', border: 'none', borderRadius: 8, padding: '12px 0', fontSize: 18, fontWeight: 600, cursor: 'pointer', marginTop: 8 }}>Sign Up</button>
        <div style={{ color: '#aebac1', fontSize: 15, marginTop: 8, textAlign: 'center' }}>
          Already have an account?{' '}
          <Link to="/login" style={{ color: '#53bdeb', cursor: 'pointer', fontWeight: 500, textDecoration: 'none' }}>Login</Link>
        </div>
      </form>
    </div>
  );
}
