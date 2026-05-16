import { useState } from "react";
import { useNavigate } from "react-router-dom";
import API from "../../api/client";

export default function UserLogin() {
  const [page, setPage] = useState("login");
  const [form, setForm] = useState({ username: "", password: "" });
  const [forgotEmail, setForgotEmail] = useState("");
  const [resetForm, setResetForm] = useState({ token: "", new_password: "", confirm_password: "" });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
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
      localStorage.setItem("refresh_token", res.data.refresh_token);
      localStorage.setItem("role", res.data.role);
      localStorage.setItem("username", res.data.username);
      if (res.data.role === "admin") {
        navigate("/admin/dashboard");
      } else {
        navigate("/queue");
      }
    } catch (err) {
      const detail = err.response?.data?.detail;
      if (err.response?.status === 423) {
        setError("⛔ " + detail);
      } else {
        setError("⚠️ " + (detail || "Invalid username or password."));
      }
    }
    setLoading(false);
  };

  const handleForgotSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await API.post("/auth/forgot-password", { email: forgotEmail });
      setSuccess("Reset instructions sent! Check your email.");
      setPage("sent");
    } catch {
      setError("Something went wrong. Please try again.");
    }
    setLoading(false);
  };

  const handleResetSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (resetForm.new_password !== resetForm.confirm_password) {
      setError("Passwords do not match.");
      return;
    }
    if (resetForm.new_password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    setLoading(true);
    try {
      await API.post("/auth/reset-password", {
        token: resetForm.token,
        new_password: resetForm.new_password
      });
      setSuccess("Password reset successfully! Please login.");
      setPage("login");
    } catch (err) {
      setError(err.response?.data?.detail || "Invalid or expired reset token.");
    }
    setLoading(false);
  };

  const inputStyle = {
    width: "100%", border: "1px solid #aab7b8", borderRadius: 2,
    padding: "8px 10px", fontSize: 13, outline: "none", marginTop: 4
  };

  const btnPrimary = {
    width: "100%", background: "#FF9900", border: "1px solid #EC7211",
    color: "#000", padding: "10px 0", borderRadius: 2, fontSize: 14,
    fontWeight: 700, cursor: "pointer", marginTop: 8
  };

  const topNav = (
    <div style={{ background: "#232F3E", padding: "10px 24px", color: "white", fontSize: 14, fontWeight: 700 }}>
      🏷️ AnnotateHub
    </div>
  );

  const wrapper = (children) => (
    <div style={{ minHeight: "100vh", background: "#F2F3F3", display: "flex", flexDirection: "column" }}>
      {topNav}
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ width: 420 }}>
          <div style={{ background: "white", border: "1px solid #D5DBDB", borderRadius: 2, padding: 40 }}>
            {children}
          </div>
          <p style={{ textAlign: "center", fontSize: 12, color: "#687078", marginTop: 16 }}>
            © 2026 AnnotateHub. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  );

  if (page === "sent") return wrapper(
    <div style={{ textAlign: "center" }}>
      <div style={{ fontSize: 48, marginBottom: 16 }}>📧</div>
      <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>Check your email</h2>
      <p style={{ fontSize: 13, color: "#687078", marginBottom: 24 }}>{success}</p>
      <p style={{ fontSize: 12, color: "#687078", marginBottom: 16 }}>
        Didn't receive the email? Check spam or try again.
      </p>
      <button style={{ ...btnPrimary, marginBottom: 8 }}
        onClick={() => { setPage("forgot"); setSuccess(""); }}>
        Try Again
      </button>
      <button style={{ width: "100%", background: "none", border: "1px solid #0073BB",
        color: "#0073BB", padding: "8px 0", borderRadius: 2, fontSize: 13, cursor: "pointer" }}
        onClick={() => { setPage("login"); setError(""); setSuccess(""); }}>
        Back to Sign In
      </button>
    </div>
  );

  if (page === "reset") return wrapper(
    <>
      <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>Reset Password</h2>
      <p style={{ fontSize: 13, color: "#687078", marginBottom: 20 }}>
        Enter your reset token and new password.
      </p>
      {error && <div style={{ background: "#FDEDEC", border: "1px solid #D13212",
        borderLeft: "4px solid #D13212", padding: "10px 12px", borderRadius: 2,
        fontSize: 13, color: "#D13212", marginBottom: 12 }}>{error}</div>}
      <form onSubmit={handleResetSubmit}>
        <div style={{ marginBottom: 12 }}>
          <label style={{ fontSize: 12, fontWeight: 700 }}>Reset Token</label>
          <input style={inputStyle} type="text" placeholder="Paste token from email"
            value={resetForm.token}
            onChange={e => setResetForm({...resetForm, token: e.target.value})} />
        </div>
        <div style={{ marginBottom: 12 }}>
          <label style={{ fontSize: 12, fontWeight: 700 }}>New Password</label>
          <input style={inputStyle} type="password" placeholder="Min 8 characters"
            value={resetForm.new_password}
            onChange={e => setResetForm({...resetForm, new_password: e.target.value})} />
        </div>
        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 12, fontWeight: 700 }}>Confirm Password</label>
          <input style={inputStyle} type="password" placeholder="Confirm new password"
            value={resetForm.confirm_password}
            onChange={e => setResetForm({...resetForm, confirm_password: e.target.value})} />
        </div>
        <button type="submit" style={btnPrimary} disabled={loading}>
          {loading ? "Resetting..." : "Reset Password"}
        </button>
      </form>
      <div style={{ marginTop: 16, textAlign: "center" }}>
        <span style={{ color: "#0073BB", fontSize: 13, cursor: "pointer" }}
          onClick={() => { setPage("login"); setError(""); }}>
          ← Back to Sign In
        </span>
      </div>
    </>
  );

  if (page === "forgot") return wrapper(
    <>
      <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>Forgot Password</h2>
      <p style={{ fontSize: 13, color: "#687078", marginBottom: 20 }}>
        Enter your email to receive reset instructions.
      </p>
      {error && <div style={{ background: "#FDEDEC", border: "1px solid #D13212",
        borderLeft: "4px solid #D13212", padding: "10px 12px", borderRadius: 2,
        fontSize: 13, color: "#D13212", marginBottom: 12 }}>{error}</div>}
      <form onSubmit={handleForgotSubmit}>
        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 12, fontWeight: 700 }}>Email Address</label>
          <input style={inputStyle} type="email" placeholder="Enter your email"
            value={forgotEmail}
            onChange={e => { setForgotEmail(e.target.value); setError(""); }} />
        </div>
        <button type="submit" style={btnPrimary} disabled={loading}>
          {loading ? "Sending..." : "Send Reset Instructions"}
        </button>
      </form>
      <div style={{ marginTop: 16, textAlign: "center" }}>
        <span style={{ color: "#0073BB", fontSize: 13, cursor: "pointer" }}
          onClick={() => { setPage("login"); setError(""); }}>
          ← Back to Sign In
        </span>
      </div>
    </>
  );

  return wrapper(
    <>
      <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4, color: "#16191f" }}>Sign in</h2>
      <p style={{ fontSize: 13, color: "#687078", marginBottom: 24 }}>
        Use your AnnotateHub credentials
      </p>

      {error && (
        <div style={{ background: "#FDEDEC", border: "1px solid #D13212",
          borderLeft: "4px solid #D13212", padding: "10px 12px", borderRadius: 2,
          fontSize: 13, color: "#D13212", marginBottom: 16 }}>
          {error}
        </div>
      )}

      {success && (
        <div style={{ background: "#d5f5e3", border: "1px solid #1D8102",
          borderLeft: "4px solid #1D8102", padding: "10px 12px", borderRadius: 2,
          fontSize: 13, color: "#1D8102", marginBottom: 16 }}>
          {success}
        </div>
      )}

      <form onSubmit={handleLogin}>
        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 13, fontWeight: 700, display: "block" }}>Username</label>
          <input style={inputStyle} type="text" placeholder="Enter your username"
            value={form.username}
            onChange={e => { setForm({...form, username: e.target.value}); setError(""); }}
          />
        </div>
        <div style={{ marginBottom: 8 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <label style={{ fontSize: 13, fontWeight: 700 }}>Password</label>
            <span style={{ color: "#0073BB", fontSize: 12, cursor: "pointer" }}
              onClick={() => { setPage("forgot"); setError(""); }}>
              Forgot password?
            </span>
          </div>
          <input style={inputStyle} type="password" placeholder="Enter your password"
            value={form.password}
            onChange={e => { setForm({...form, password: e.target.value}); setError(""); }}
          />
        </div>
        <button type="submit" style={btnPrimary} disabled={loading}>
          {loading ? "Signing in..." : "Sign in"}
        </button>
      </form>

      <div style={{ marginTop: 24, paddingTop: 16, borderTop: "1px solid #eaeded", textAlign: "center" }}>
        <p style={{ fontSize: 12, color: "#687078" }}>
          Contact your administrator if you don't have an account.
        </p>
        <p style={{ fontSize: 12, color: "#687078", marginTop: 8 }}>
          Have a reset token?{" "}
          <span style={{ color: "#0073BB", cursor: "pointer" }}
            onClick={() => { setPage("reset"); setError(""); }}>
            Reset your password
          </span>
        </p>
      </div>
    </>
  );
}