import { useNavigate } from "react-router-dom";
import { AwsTopNav } from "./AdminDashboard";

function AwsSidebar({ active }) {
  const navigate = useNavigate();
  const items = [
    { label: "Dashboard", icon: "⊞", path: "/admin/dashboard" },
    { label: "Projects", icon: "📁", path: "/admin/projects" },
    { label: "Users", icon: "👥", path: "/admin/users" },
    { label: "Export", icon: "📤", path: "/admin/export" },
    { label: "Datasets", icon: "📊", path: "/admin/datasets" },
    { label: "Ontology", icon: "🏷️", path: "/admin/ontology" },
    { label: "API Keys", icon: "🔑", path: "/admin/api-keys" },
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
            style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 20px",
              cursor: "pointer", fontSize: 13,
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

export default function PlaceholderPage({ title, description, icon, active }) {
  const navigate = useNavigate();
  const username = localStorage.getItem("username");
  const handleLogout = () => { localStorage.clear(); navigate("/login"); };

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
      <AwsTopNav username={username} onLogout={handleLogout} />
      <div style={{ display: "flex", flex: 1 }}>
        <AwsSidebar active={active || title} />
        <div style={{ flex: 1, background: "#F2F3F3", padding: 24,
          display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ background: "white", border: "1px solid #D5DBDB",
            borderRadius: 2, padding: 48, textAlign: "center", maxWidth: 400 }}>
            <div style={{ fontSize: 56, marginBottom: 16 }}>{icon}</div>
            <h2 style={{ fontSize: 20, fontWeight: 700, color: "#16191f", marginBottom: 8 }}>{title}</h2>
            <p style={{ fontSize: 13, color: "#687078", marginBottom: 24 }}>{description}</p>
            <span style={{ background: "#FEF9E7", border: "1px solid #FF9900",
              color: "#996300", padding: "6px 16px", borderRadius: 2, fontSize: 13, fontWeight: 600 }}>
              🚧 Coming Soon
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}