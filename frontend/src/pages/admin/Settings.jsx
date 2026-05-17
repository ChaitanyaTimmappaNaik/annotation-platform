import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { AwsTopNav } from "./AdminDashboard";

function AwsSidebar({ active }) {
  const navigate = useNavigate();
  const items = [
    { label: "Dashboard", icon: "⊞", path: "/admin/dashboard" },
    { label: "Projects", icon: "📁", path: "/admin/projects" },
    { label: "Batches", icon: "📦", path: "/admin/batches" },
    { label: "Tasks", icon: "📋", path: "/admin/tasks" },
    { label: "Datasets", icon: "📂", path: "/admin/datasets" },
    { label: "Users", icon: "👥", path: "/admin/users" },
    { label: "Analytics", icon: "📊", path: "/admin/analytics" },
    { label: "Review Queue", icon: "🔍", path: "/admin/review" },
    { label: "Export", icon: "📤", path: "/admin/export" },
    { label: "Settings", icon: "⚙️", path: "/admin/settings" },
    { label: "Help", icon: "❓", path: "/admin/help" },
  ];
  return (
    <div style={{ width: 220, background: "#232F3E", minHeight: "100vh" }}>
      <div style={{ padding: "16px 20px", borderBottom: "1px solid #37475A" }}>
        <div style={{ color: "#FF9900", fontWeight: 700, fontSize: 16 }}>🏷️ AnnotateHub</div>
        <div style={{ color: "#aab7b8", fontSize: 11, marginTop: 2 }}>Admin Console</div>
      </div>
      <nav style={{ paddingTop: 8 }}>
        {items.map(item => (
          <div key={item.label} onClick={() => navigate(item.path)}
            style={{ display: "flex", alignItems: "center", gap: 10,
              padding: "10px 20px", cursor: "pointer", fontSize: 13,
              color: active === item.label ? "#FF9900" : "#d5dbdb",
              background: active === item.label ? "#37475A" : "transparent",
              borderLeft: active === item.label ? "3px solid #FF9900" : "3px solid transparent" }}>
            <span>{item.icon}</span><span>{item.label}</span>
          </div>
        ))}
      </nav>
    </div>
  );
}

export default function Settings() {
  const navigate = useNavigate();
  const username = localStorage.getItem("username");
  const handleLogout = () => { localStorage.clear(); navigate("/login"); };

  const [platformName, setPlatformName] = useState("AnnotateHub");
  const [defaultTimeLimit, setDefaultTimeLimit] = useState("1800");
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
      <AwsTopNav username={username} onLogout={handleLogout} />
      <div style={{ display: "flex", flex: 1 }}>
        <AwsSidebar active="Settings" />
        <div style={{ flex: 1, background: "#F2F3F3", padding: 24 }}>

          <div style={{ fontSize: 12, color: "#687078", marginBottom: 16 }}>
            AnnotateHub &gt; <strong>Settings</strong>
          </div>

          <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 24 }}>
            ⚙️ Platform Settings
          </h1>

          {saved && (
            <div style={{ background: "#d5f5e3", border: "1px solid #1D8102",
              borderLeft: "4px solid #1D8102", padding: "10px 16px",
              borderRadius: 2, fontSize: 13, marginBottom: 16, color: "#1D8102" }}>
              ✅ Settings saved successfully!
            </div>
          )}

          <div style={{ display: "grid", gap: 16 }}>

            {/* General Settings */}
            <div style={{ background: "white", border: "1px solid #D5DBDB",
              borderRadius: 2, padding: 20 }}>
              <h2 style={{ fontSize: 15, fontWeight: 700,
                marginBottom: 16, marginTop: 0 }}>
                General Settings
              </h2>
              <div style={{ display: "grid",
                gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 700,
                    display: "block", marginBottom: 4 }}>
                    Platform Name
                  </label>
                  <input className="aws-input"
                    value={platformName}
                    onChange={e => setPlatformName(e.target.value)} />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 700,
                    display: "block", marginBottom: 4 }}>
                    Default Task Time Limit
                  </label>
                  <select className="aws-input"
                    value={defaultTimeLimit}
                    onChange={e => setDefaultTimeLimit(e.target.value)}>
                    <option value="900">15 minutes</option>
                    <option value="1800">30 minutes</option>
                    <option value="2700">45 minutes</option>
                    <option value="3600">60 minutes</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Platform Info */}
            <div style={{ background: "white", border: "1px solid #D5DBDB",
              borderRadius: 2, padding: 20 }}>
              <h2 style={{ fontSize: 15, fontWeight: 700,
                marginBottom: 16, marginTop: 0 }}>
                Platform Information
              </h2>
              <div style={{ display: "grid", gap: 12, fontSize: 13 }}>
                {[
                  { label: "Version", value: "3.0.0" },
                  { label: "Frontend", value: "React + Vite (Vercel)" },
                  { label: "Backend", value: "FastAPI (Render)" },
                  { label: "Database", value: "PostgreSQL (Render)" },
                  { label: "Live URL", value: "annotation-platform-frontend.vercel.app" },
                ].map(item => (
                  <div key={item.label} style={{ display: "flex",
                    gap: 16, padding: "8px 0",
                    borderBottom: "1px solid #f5f5f5" }}>
                    <span style={{ fontWeight: 700, width: 120,
                      color: "#687078" }}>{item.label}</span>
                    <span style={{ color: "#16191f" }}>{item.value}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Danger Zone */}
            <div style={{ background: "white", border: "1px solid #D13212",
              borderRadius: 2, padding: 20 }}>
              <h2 style={{ fontSize: 15, fontWeight: 700,
                marginBottom: 8, marginTop: 0, color: "#D13212" }}>
                ⚠️ Danger Zone
              </h2>
              <p style={{ fontSize: 13, color: "#687078", marginBottom: 16 }}>
                These actions are irreversible. Please be careful.
              </p>
              <div style={{ display: "flex", gap: 8 }}>
                <button style={{ background: "none",
                  border: "1px solid #D13212", color: "#D13212",
                  padding: "8px 16px", borderRadius: 2,
                  cursor: "pointer", fontSize: 13 }}
                  onClick={() => alert("Contact support to reset platform data.")}>
                  Reset All Tasks
                </button>
              </div>
            </div>

            <div style={{ display: "flex", gap: 8 }}>
              <button className="aws-btn-primary"
                onClick={handleSave}>
                Save Settings
              </button>
              <button className="aws-btn-normal"
                onClick={() => navigate("/admin/dashboard")}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}