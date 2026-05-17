import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import API from "../../api/client";
import { AwsTopNav } from "./AdminDashboard";

function AwsSidebar({ active }) {
  const navigate = useNavigate();
  const items = [
    { label: "Dashboard", icon: "⊞", path: "/admin/dashboard" },
    { label: "Projects", icon: "📁", path: "/admin/projects" },
    { label: "Batches", icon: "📦", path: "/admin/batches" },
    { label: "Tasks", icon: "📋", path: "/admin/tasks" },
    { label: "Users", icon: "👥", path: "/admin/users" },
    { label: "Analytics", icon: "📊", path: "/admin/analytics" },
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

export default function Analytics() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState(null);
  const [userDetail, setUserDetail] = useState(null);
  const navigate = useNavigate();
  const username = localStorage.getItem("username");

  useEffect(() => { fetchAnalytics(); }, []);

  const fetchAnalytics = async () => {
    try {
      const res = await API.get("/analytics/dashboard");
      setData(res.data);
    } catch {}
    setLoading(false);
  };

  const fetchUserDetail = async (userId) => {
    try {
      const res = await API.get(`/analytics/user/${userId}`);
      setUserDetail(res.data);
      setSelectedUser(userId);
    } catch {}
  };

  const handleLogout = () => { localStorage.clear(); navigate("/login"); };

  const statCard = (label, value, icon, color) => (
    <div style={{ background: "white", border: "1px solid #D5DBDB",
      borderRadius: 2, padding: 20, display: "flex", alignItems: "center", gap: 16 }}>
      <div style={{ width: 48, height: 48, borderRadius: "50%",
        background: color + "20", display: "flex", alignItems: "center",
        justifyContent: "center", fontSize: 22 }}>
        {icon}
      </div>
      <div>
        <div style={{ fontSize: 28, fontWeight: 700, color: "#16191f" }}>{value}</div>
        <div style={{ fontSize: 12, color: "#687078" }}>{label}</div>
      </div>
    </div>
  );

  const getActionBadge = (action) => {
    const colors = {
      claimed: { bg: "#E8F4FD", color: "#0073BB" },
      released: { bg: "#FEF9E7", color: "#996300" },
      declined: { bg: "#FDEDEC", color: "#D13212" },
      paused: { bg: "#F3E8FF", color: "#6A1B9A" },
      resumed: { bg: "#E8F4FD", color: "#0073BB" },
      submitted: { bg: "#d5f5e3", color: "#1D8102" },
    };
    const c = colors[action] || { bg: "#eaeded", color: "#687078" };
    return (
      <span style={{ background: c.bg, color: c.color,
        padding: "2px 8px", borderRadius: 2, fontSize: 11, fontWeight: 600 }}>
        {action}
      </span>
    );
  };

  if (loading) return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
      <AwsTopNav username={username} onLogout={handleLogout} />
      <div style={{ display: "flex", flex: 1 }}>
        <AwsSidebar active="Analytics" />
        <div style={{ flex: 1, display: "flex", alignItems: "center",
          justifyContent: "center", background: "#F2F3F3" }}>
          <p style={{ color: "#687078" }}>Loading analytics...</p>
        </div>
      </div>
    </div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
      <AwsTopNav username={username} onLogout={handleLogout} />
      <div style={{ display: "flex", flex: 1 }}>
        <AwsSidebar active="Analytics" />
        <div style={{ flex: 1, background: "#F2F3F3", padding: 24, overflowY: "auto" }}>

          <div style={{ fontSize: 12, color: "#687078", marginBottom: 16 }}>
            AnnotateHub &gt; <strong>Analytics</strong>
          </div>

          <div style={{ display: "flex", justifyContent: "space-between",
            alignItems: "center", marginBottom: 20 }}>
            <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>
              Platform Analytics
            </h1>
            <button className="aws-btn-normal" onClick={fetchAnalytics}>
              🔄 Refresh
            </button>
          </div>

          {/* Stat Cards */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)",
            gap: 16, marginBottom: 24 }}>
            {statCard("Total Tasks", data?.totals.total_tasks || 0, "📋", "#0073BB")}
            {statCard("Completed", data?.totals.completed_tasks || 0, "✅", "#1D8102")}
            {statCard("In Progress", data?.totals.inprogress_tasks || 0, "⚡", "#FF9900")}
            {statCard("Available", data?.totals.available_tasks || 0, "📥", "#687078")}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)",
            gap: 16, marginBottom: 24 }}>
            {statCard("Total Annotations", data?.totals.total_annotations || 0, "🏷️", "#8E44AD")}
            {statCard("Annotators", data?.totals.total_annotators || 0, "👥", "#0073BB")}
            {statCard("Projects", data?.totals.total_projects || 0, "📁", "#FF9900")}
            {statCard("Active Batches", data?.totals.active_batches || 0, "📦", "#1D8102")}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 24 }}>

            {/* User Productivity */}
            <div style={{ background: "white", border: "1px solid #D5DBDB", borderRadius: 2 }}>
              <div style={{ padding: "16px 20px", borderBottom: "1px solid #D5DBDB" }}>
                <h2 style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>
                  👥 Annotator Productivity
                </h2>
              </div>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "#FAFAFA" }}>
                    <th style={{ padding: "8px 16px", textAlign: "left",
                      fontSize: 12, color: "#687078", fontWeight: 700 }}>Annotator</th>
                    <th style={{ padding: "8px 16px", textAlign: "left",
                      fontSize: 12, color: "#687078", fontWeight: 700 }}>Tasks Done</th>
                    <th style={{ padding: "8px 16px", textAlign: "left",
                      fontSize: 12, color: "#687078", fontWeight: 700 }}>Avg Time</th>
                    <th style={{ padding: "8px 16px", textAlign: "left",
                      fontSize: 12, color: "#687078", fontWeight: 700 }}>Details</th>
                  </tr>
                </thead>
                <tbody>
                  {data?.user_stats.length === 0 ? (
                    <tr>
                      <td colSpan="4" style={{ padding: 24, textAlign: "center",
                        color: "#687078", fontSize: 13 }}>
                        No annotation data yet
                      </td>
                    </tr>
                  ) : (
                    data?.user_stats.map(user => (
                      <tr key={user.id}
                        style={{ borderTop: "1px solid #eaeded" }}>
                        <td style={{ padding: "10px 16px", fontSize: 13, fontWeight: 600 }}>
                          {user.username}
                        </td>
                        <td style={{ padding: "10px 16px" }}>
                          <span style={{ background: "#d5f5e3", color: "#1D8102",
                            padding: "2px 8px", borderRadius: 2,
                            fontSize: 12, fontWeight: 600 }}>
                            {user.tasks_completed} tasks
                          </span>
                        </td>
                        <td style={{ padding: "10px 16px", fontSize: 13, color: "#687078" }}>
                          {user.avg_time_spent} min
                        </td>
                        <td style={{ padding: "10px 16px" }}>
                          <span className="aws-link"
                            onClick={() => fetchUserDetail(user.id)}>
                            View
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Recent Activity */}
            <div style={{ background: "white", border: "1px solid #D5DBDB", borderRadius: 2 }}>
              <div style={{ padding: "16px 20px", borderBottom: "1px solid #D5DBDB" }}>
                <h2 style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>
                  🕐 Recent Activity Log
                </h2>
              </div>
              <div style={{ maxHeight: 300, overflowY: "auto" }}>
                {data?.recent_activity.length === 0 ? (
                  <p style={{ padding: 24, textAlign: "center",
                    color: "#687078", fontSize: 13 }}>
                    No activity yet
                  </p>
                ) : (
                  data?.recent_activity.map((log, i) => (
                    <div key={i} style={{ padding: "10px 16px",
                      borderBottom: "1px solid #f5f5f5",
                      display: "flex", alignItems: "center",
                      gap: 10, fontSize: 12 }}>
                      {getActionBadge(log.action)}
                      <div style={{ flex: 1 }}>
                        <span style={{ fontWeight: 600 }}>{log.username}</span>
                        <span style={{ color: "#687078" }}> — {log.task_title}</span>
                      </div>
                      <span style={{ color: "#aab7b8", whiteSpace: "nowrap" }}>
                        {new Date(log.created_at).toLocaleString("en-US", {
                          month: "short", day: "numeric",
                          hour: "2-digit", minute: "2-digit"
                        })}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* User Detail Modal */}
          {selectedUser && userDetail && (
            <div style={{ background: "white", border: "1px solid #D5DBDB",
              borderRadius: 2, padding: 20 }}>
              <div style={{ display: "flex", justifyContent: "space-between",
                alignItems: "center", marginBottom: 16 }}>
                <h2 style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>
                  📋 {userDetail.user.username}'s Task History
                </h2>
                <button onClick={() => { setSelectedUser(null); setUserDetail(null); }}
                  style={{ background: "none", border: "1px solid #D5DBDB",
                    padding: "4px 12px", borderRadius: 2,
                    cursor: "pointer", fontSize: 13 }}>
                  Close
                </button>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                <div>
                  <h3 style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>
                    Completed Tasks
                  </h3>
                  {userDetail.task_history.length === 0 ? (
                    <p style={{ fontSize: 13, color: "#687078" }}>No tasks completed yet</p>
                  ) : (
                    userDetail.task_history.map((task, i) => (
                      <div key={i} style={{ padding: "8px 0",
                        borderBottom: "1px solid #f5f5f5", fontSize: 13 }}>
                        <div style={{ fontWeight: 600 }}>{task.title}</div>
                        <div style={{ color: "#687078", fontSize: 12, marginTop: 2 }}>
                          {task.project_name} •
                          {task.time_spent_minutes} min •
                          {task.submitted_at ? new Date(task.submitted_at).toLocaleDateString() : "—"}
                        </div>
                      </div>
                    ))
                  )}
                </div>
                <div>
                  <h3 style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>
                    Activity Logs
                  </h3>
                  {userDetail.activity_logs.map((log, i) => (
                    <div key={i} style={{ padding: "6px 0",
                      borderBottom: "1px solid #f5f5f5",
                      display: "flex", gap: 8, alignItems: "center", fontSize: 12 }}>
                      {getActionBadge(log.action)}
                      <span style={{ color: "#687078", flex: 1 }}>{log.task_title}</span>
                      <span style={{ color: "#aab7b8" }}>
                        {new Date(log.created_at).toLocaleString("en-US", {
                          month: "short", day: "numeric",
                          hour: "2-digit", minute: "2-digit"
                        })}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}