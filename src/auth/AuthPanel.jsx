// src/auth/AuthPanel.jsx
import { useState } from "react";
import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup,
} from "firebase/auth";
import { auth } from "../firebase";
import { useAuth } from "./AuthProvider";
import {
  claimUsername,
  loginWithUsernameOrEmail,
} from "../firebase/usernameAuth";

export function AuthPanel() {
  const { user, authLoading, logout } = useAuth();

  const [mode, setMode] = useState("login");
  const [identifier, setIdentifier] = useState(""); // username OR email (login)
  const [email, setEmail] = useState(""); // register
  const [username, setUsername] = useState(""); // register
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    setErr("");

    try {
      if (mode === "register") {
        const cred = await createUserWithEmailAndPassword(
          auth,
          email.trim(),
          password,
        );

        // ✅ claimUsername now also sets users/{uid}.username
        await claimUsername(cred.user.uid, username, cred.user.email);
      } else {
        await loginWithUsernameOrEmail(identifier, password);
      }
    } catch (e2) {
      // You can map Firebase error codes here if you want nicer messages
      setErr(e2?.message ?? "Auth error");
    }
  }

  async function handleGoogle() {
    setErr("");
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);

      // NOTE: after Google login you must ask the user to choose a username
      // and then call claimUsername(user.uid, chosenUsername, user.email)
    } catch (e2) {
      setErr(e2?.message ?? "Google sign-in error");
    }
  }

  if (authLoading) return <div>Auth loading…</div>;

  if (user) {
    return (
      <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
        <div>Logged in as: {user.email}</div>
        <button onClick={logout}>Logout</button>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 360 }}>
      <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
        <button disabled={mode === "login"} onClick={() => setMode("login")}>
          Login
        </button>
        <button
          disabled={mode === "register"}
          onClick={() => setMode("register")}
        >
          Register
        </button>
      </div>

      <form onSubmit={handleSubmit} style={{ display: "grid", gap: 8 }}>
        {mode === "register" ? (
          <>
            <input
              placeholder="Username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
            />
            <input
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
            />
          </>
        ) : (
          <input
            placeholder="Username or Email"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            autoComplete="username"
          />
        )}

        <input
          placeholder="Password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete={
            mode === "register" ? "new-password" : "current-password"
          }
        />

        <button type="submit">
          {mode === "register" ? "Create account" : "Login"}
        </button>
      </form>

      <div style={{ marginTop: 10 }}>
        <button onClick={handleGoogle}>Continue with Google</button>
      </div>

      {err && <div style={{ marginTop: 10, color: "crimson" }}>{err}</div>}
    </div>
  );
}
