import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import API from "../../api/client";

function AwsSidebar({ active }) {
  const navigate = useNavigate();
  const items = [
    { label: "Analytics", icon: "📊", path: "/admin/analytics" },
  { label: "Dashboard", icon: "⊞", path: "/admin/dashboard" },
  { label: "Projects", icon: "📁", path: "/admin/projects" },
  { label: "Batches", icon: "📦", path: "/admin/batches" },
  { label: "Tasks", icon: "📋", path: "/admin/tasks" },
  { label: "Users", icon: "👥", path: "/admin/users" },
  { label: "Export", icon: "📤", path: "/admin/export" },
  { label: "Datasets", icon: "📊", path: "/admin/datasets" },
  { label: "Ontology", icon: "🏷️", path: "/admin/ontology" },
  { label: "API Keys", icon: "🔑", path: "/admin/api-keys" },
  { label: "Settings", icon: "⚙️", path: "/admin/settings" },
  { label: "Help", icon: "❓", path: "/admin/help" },
];
  return (
    <div style={{ width: 220, background: "#232F3E", minHeight: "100vh",
      display: "flex", flexDirection: "column" }}>
      <div style={{ padding: "16px 20px", borderBottom: "1px solid #37475A" }}>
        <div style={{ color: "#FF9900", fontWeight: 700, fontSize: 16 }}>🏷️ AnnotateHub</div>
        <div style={{ color: "#aab7b8", fontSize: 11, marginTop: 2 }}>Admin Console</div>
      </div>
      <nav style={{ flex: 1, paddingTop: 8 }}>
        {items.map(item => (
          <div key={item.label}
            onClick={() => navigate(item.path)}
            style={{
              display: "flex", alignItems: "center", gap: 10,
              padding: "10px 20px", cursor: "pointer", fontSize: 13,
              color: active === item.label ? "#FF9900" : "#d5dbdb",
              background: active === item.label ? "#37475A" : "transparent",
              borderLeft: active === item.label ? "3px solid #FF9900" : "3px solid transparent",
              transition: "all 0.15s"
            }}
            onMouseEnter={e => { if (active !== item.label) e.currentTarget.style.background = "#37475A"; }}
            onMouseLeave={e => { if (active !== item.label) e.currentTarget.style.background = "transparent"; }}>
            <span>{item.icon}</span>
            <span>{item.label}</span>
          </div>
        ))}
      </nav>
    </div>
  );
}

export function AwsTopNav({ username, onLogout }) {
  return (
    <div style={{ background: "#232F3E", color: "white", padding: "0 20px",
      height: 40, display: "flex", alignItems: "center", justifyContent: "space-between",
      fontSize: 13, borderBottom: "1px solid #37475A", flexShrink: 0 }}>
      <span style={{ fontWeight: 700, color: "#FF9900" }}>🏷️ AnnotateHub</span>
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        <span>👤 {username}</span>
        <button onClick={onLogout}
          style={{ background: "transparent", border: "1px solid #aab7b8",
            color: "white", padding: "3px 10px", borderRadius: 2, fontSize: 12, cursor: "pointer" }}>
          Sign out
        </button>
      </div>
    </div>
  );
}

export default function AdminDashboard() {
  const navigate = useNavigate();
  const username = localStorage.getItem("username");
  const [stats, setStats] = useState({ projects: 0, tasks: 0, completed: 0, annotators: 0 });

  useEffect(() => { fetchStats(); }, []);

  const fetchStats = async () => {
    try {
      const [p, t, u] = await Promise.all([
        API.get("/projects/"), API.get("/tasks/"), API.get("/users/")
      ]);
      setStats({
        projects: p.data.length,
        tasks: t.data.length,
        completed: t.data.filter(x => x.status === "completed").length,
        annotators: u.data.filter(x => x.role === "annotator").length
      });
    } catch {}
  };

  const handleLogout = () => { localStorage.clear(); navigate("/login"); };

  const quickActions = [
    { label: "Create Project", icon: "📁", path: "/admin/projects/new", desc: "Start a new annotation project" },
    { label: "Add Dataset", icon: "📊", path: "/admin/datasets", desc: "Upload annotation data" },
    { label: "Invite Members", icon: "👥", path: "/admin/users", desc: "Add new annotators" },
    { label: "View Usage", icon: "📈", path: "/admin/usage", desc: "Check platform statistics" },
    { label: "Create Ontology", icon: "🏷️", path: "/admin/ontology", desc: "Define annotation labels" },
    { label: "Create API Key", icon: "🔑", path: "/admin/api-keys", desc: "Generate API access keys" },
  ];

  const statCards = [
    { label: "Total Projects", value: stats.projects, icon: "📁", color: "#0073BB" },
    { label: "Total Tasks", value: stats.tasks, icon: "📋", color: "#FF9900" },
    { label: "Completed", value: stats.completed, icon: "✅", color: "#1D8102" },
    { label: "Annotators", value: stats.annotators, icon: "👥", color: "#8E44AD" },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
      <AwsTopNav username={username} onLogout={handleLogout} />
      <div style={{ display: "flex", flex: 1 }}>
        <AwsSidebar active="Dashboard" />
        <div style={{ flex: 1, background: "#F2F3F3", padding: 24, overflowY: "auto" }}>

          {/* Breadcrumb */}
          <div style={{ fontSize: 12, color: "#687078", marginBottom: 16 }}>
            AnnotateHub &gt; <strong>Dashboard</strong>
          </div>

          {/* Welcome */}
          <div style={{ marginBottom: 24 }}>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: "#16191f", margin: 0 }}>
              Welcome back, {username}!
            </h1>
            <p style={{ fontSize: 13, color: "#687078", marginTop: 4 }}>
              Manage your annotation projects and teams from here.
            </p>
          </div>

          {/* Stat Cards */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 24 }}>
            {statCards.map(stat => (
              <div key={stat.label}
                style={{ background: "white", border: "1px solid #D5DBDB", borderRadius: 2,
                  padding: 20, display: "flex", alignItems: "center", gap: 16 }}>
                <div style={{ width: 48, height: 48, borderRadius: "50%",
                  background: stat.color + "20", display: "flex", alignItems: "center",
                  justifyContent: "center", fontSize: 22 }}>
                  {stat.icon}
                </div>
                <div>
                  <div style={{ fontSize: 28, fontWeight: 700, color: "#16191f", lineHeight: 1 }}>
                    {stat.value}
                  </div>
                  <div style={{ fontSize: 12, color: "#687078", marginTop: 4 }}>{stat.label}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Quick Actions */}
          <div style={{ background: "white", border: "1px solid #D5DBDB", borderRadius: 2, padding: 20 }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: "#16191f", marginBottom: 16, marginTop: 0 }}>
              Quick Actions
            </h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
              {quickActions.map(action => (
                <div key={action.label} onClick={() => navigate(action.path)}
                  style={{ border: "1px solid #D5DBDB", borderRadius: 2, padding: 16,
                    cursor: "pointer", display: "flex", alignItems: "center", gap: 12,
                    transition: "all 0.15s", background: "white" }}
                  onMouseEnter={e => {
                    e.currentTarget.style.borderColor = "#FF9900";
                    e.currentTarget.style.background = "#FFFBF5";
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.borderColor = "#D5DBDB";
                    e.currentTarget.style.background = "white";
                  }}>
                  <span style={{ fontSize: 28 }}>{action.icon}</span>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "#0073BB" }}>{action.label}</div>
                    <div style={{ fontSize: 11, color: "#687078", marginTop: 2 }}>{action.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}