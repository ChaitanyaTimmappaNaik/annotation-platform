import { useState } from "react";
import { useNavigate } from "react-router-dom";
import API from "../../api/client";

export default function UserLogin() {
  const [page, setPage] = useState("login");
  const [form, setForm] = useState({ username: "", password: "" });
  const [forgotEmail, setForgotEmail] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await API.post("/auth/login",
        new URLSearchParams(form),
        { headers: { "Content-Type": "application/x-www-form-urlencoded" }}
      );
      localStorage.setItem("token", res.data.access_token);
      localStorage.setItem("role", res.data.role);
      localStorage.setItem("username", res.data.username);
      if (res.data.role === "admin") {
        navigate("/admin/dashboard");
      } else {
        navigate("/queue");
      }
    } catch {
      setError("Invalid username or password. Please try again.");
    }
    setLoading(false);
  };

  const handleForgotSubmit = (e) => {
    e.preventDefault();
    if (!forgotEmail.trim()) { setError("Please enter your email."); return; }
    setPage("sent");
  };

  if (page === "sent") return (
    <div style={{ minHeight: "100vh", background: "#F2F3F3", display: "flex", flexDirection: "column" }}>
      <div style={{ background: "#232F3E", padding: "10px 24px", color: "white", fontSize: 13 }}>
        AnnotateHub
      </div>
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ background: "white", border: "1px solid #D5DBDB", borderRadius: 2, padding: 40, width: 400, textAlign: "center" }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>📧</div>
          <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>Check your email</h2>
          <p style={{ fontSize: 13, color: "#687078", marginBottom: 24 }}>
            If an account exists for <strong>{forgotEmail}</strong>, password reset instructions have been sent.
          </p>
          <button className="aws-btn-normal" onClick={() => { setPage("login"); setForgotEmail(""); setError(""); }}>
            ← Back to Sign In
          </button>
        </div>
      </div>
    </div>
  );

  if (page === "forgot") return (
    <div style={{ minHeight: "100vh", background: "#F2F3F3", display: "flex", flexDirection: "column" }}>
      <div style={{ background: "#232F3E", padding: "10px 24px", color: "white", fontSize: 13 }}>
        AnnotateHub
      </div>
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ background: "white", border: "1px solid #D5DBDB", borderRadius: 2, padding: 40, width: 400 }}>
          <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>Reset password</h2>
          <p style={{ fontSize: 13, color: "#687078", marginBottom: 20 }}>
            Enter your email to receive reset instructions.
          </p>
          {error && <div className="aws-error-banner" style={{ marginBottom: 16 }}>{error}</div>}
          <form onSubmit={handleForgotSubmit}>
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 13, fontWeight: 700, display: "block", marginBottom: 4 }}>Email address</label>
              <input className="aws-input" type="email" placeholder="Enter your email"
                value={forgotEmail} onChange={e => { setForgotEmail(e.target.value); setError(""); }} />
            </div>
            <button type="submit" className="aws-btn-primary" style={{ width: "100%", padding: "8px 0" }}>
              Send Reset Instructions
            </button>
          </form>
          <div style={{ marginTop: 16, textAlign: "center" }}>
            <span className="aws-link" onClick={() => { setPage("login"); setError(""); }}>← Back to Sign In</span>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: "#F2F3F3", display: "flex", flexDirection: "column" }}>
      {/* Top Nav */}
      <div className="aws-topnav">
        <span style={{ fontWeight: 700, fontSize: 15 }}>🏷️ AnnotateHub</span>
      </div>

      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ width: 400 }}>
          <div style={{ background: "white", border: "1px solid #D5DBDB", borderRadius: 2, padding: 40 }}>
            <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4, color: "#16191f" }}>Sign in</h2>
            <p style={{ fontSize: 13, color: "#687078", marginBottom: 24 }}>
              Use your AnnotateHub credentials
            </p>

            {error && (
              <div className="aws-error-banner" style={{ marginBottom: 16 }}>
                ⚠️ {error}
              </div>
            )}

            <form onSubmit={handleLogin}>
              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 13, fontWeight: 700, display: "block", marginBottom: 4 }}>
                  Username
                </label>
                <input className="aws-input" type="text" placeholder="Enter username"
                  value={form.username}
                  onChange={e => { setForm({...form, username: e.target.value}); setError(""); }}
                />
              </div>

              <div style={{ marginBottom: 8 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <label style={{ fontSize: 13, fontWeight: 700 }}>Password</label>
                  <span className="aws-link" style={{ fontSize: 13 }}
                    onClick={() => { setPage("forgot"); setError(""); }}>
                    Forgot password?
                  </span>
                </div>
                <input className="aws-input" type="password" placeholder="Enter password"
                  value={form.password}
                  onChange={e => { setForm({...form, password: e.target.value}); setError(""); }}
                />
              </div>

              <div style={{ marginTop: 24 }}>
                <button type="submit" className="aws-btn-primary"
                  style={{ width: "100%", padding: "10px 0", fontSize: 14 }}
                  disabled={loading}>
                  {loading ? "Signing in..." : "Sign in"}
                </button>
              </div>
            </form>

            <div style={{ marginTop: 24, paddingTop: 16, borderTop: "1px solid #eaeded", textAlign: "center" }}>
              <p style={{ fontSize: 12, color: "#687078" }}>
                Contact your administrator if you don't have an account.
              </p>
            </div>
          </div>
          <p style={{ textAlign: "center", fontSize: 12, color: "#687078", marginTop: 16 }}>
            © 2026 AnnotateHub. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  );
}