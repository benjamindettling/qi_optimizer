import { useAuth } from "./AuthProvider";

export function AuthDebug() {
  const { user, authLoading, logout } = useAuth();

  if (authLoading) return <div>Auth loading…</div>;
  if (!user) return <div>Not logged in</div>;

  return (
    <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
      <div>Logged in as: {user.email}</div>
      <button onClick={logout}>Logout</button>
    </div>
  );
}
