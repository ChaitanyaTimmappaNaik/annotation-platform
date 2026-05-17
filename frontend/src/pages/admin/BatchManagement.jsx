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

export default function BatchManagement() {
  const [batches, setBatches] = useState([]);
  const [projects, setProjects] = useState([]);
  const [users, setUsers] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    name: "", project_id: "", user_ids: [],
    tasks_per_user: 10, time_limit: 1800
  });
  const [editBatch, setEditBatch] = useState(null);
  const [editTimeLimit, setEditTimeLimit] = useState("");
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();
  const username = localStorage.getItem("username");

  useEffect(() => { fetchAll(); }, []);

  const fetchAll = async () => {
    try {
      const [b, p, u] = await Promise.all([
        API.get("/batches/"),
        API.get("/projects/"),
        API.get("/users/")
      ]);
      setBatches(b.data);
      setProjects(p.data);
      setUsers(u.data.filter(u => u.role === "annotator" && u.is_active));
    } catch {}
  };

  const handleCreateBatch = async () => {
    if (!form.name || !form.project_id || form.user_ids.length === 0) {
      setError("Please fill all fields and select at least one user.");
      return;
    }
    try {
      await API.post("/batches/", {
        ...form,
        project_id: parseInt(form.project_id),
        user_ids: form.user_ids.map(Number),
        tasks_per_user: parseInt(form.tasks_per_user),
        time_limit: parseInt(form.time_limit)
      });
      setSuccess("Batch created and users notified!");
      setShowForm(false);
      setForm({ name: "", project_id: "", user_ids: [], tasks_per_user: 10, time_limit: 1800 });
      fetchAll();
    } catch (err) {
      setError(err.response?.data?.detail || "Could not create batch.");
    }
  };

  const handleUpdateTimeLimit = async (batchId) => {
    try {
      await API.put(`/batches/${batchId}`, { time_limit: parseInt(editTimeLimit) });
      setSuccess("Time limit updated! All users notified instantly.");
      setEditBatch(null);
      fetchAll();
    } catch {
      setError("Could not update batch.");
    }
  };

  const handlePauseBatch = async (batchId, currentStatus) => {
    const newStatus = currentStatus === "active" ? "paused" : "active";
    try {
      await API.put(`/batches/${batchId}`, { status: newStatus });
      setSuccess(`Batch ${newStatus === "paused" ? "paused" : "resumed"}!`);
      fetchAll();
    } catch {
      setError("Could not update batch status.");
    }
  };

  const handleLogout = () => { localStorage.clear(); navigate("/login"); };

  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60);
    return `${m} min`;
  };

  const toggleUser = (userId) => {
    setForm(prev => ({
      ...prev,
      user_ids: prev.user_ids.includes(userId)
        ? prev.user_ids.filter(id => id !== userId)
        : [...prev.user_ids, userId]
    }));
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
      <AwsTopNav username={username} onLogout={handleLogout} />
      <div style={{ display: "flex", flex: 1 }}>
        <AwsSidebar active="Batches" />
        <div style={{ flex: 1, background: "#F2F3F3", padding: 24, overflowY: "auto" }}>

          <div style={{ fontSize: 12, color: "#687078", marginBottom: 16 }}>
            AnnotateHub &gt; <strong>Queue Batches</strong>
          </div>

          {success && (
            <div style={{ background: "#d5f5e3", border: "1px solid #1D8102",
              borderLeft: "4px solid #1D8102", padding: "10px 16px",
              borderRadius: 2, fontSize: 13, marginBottom: 16, color: "#1D8102" }}>
              ✅ {success}
              <button onClick={() => setSuccess("")}
                style={{ float: "right", background: "none", border: "none", cursor: "pointer" }}>×</button>
            </div>
          )}

          {error && (
            <div style={{ background: "#FDEDEC", border: "1px solid #D13212",
              borderLeft: "4px solid #D13212", padding: "10px 16px",
              borderRadius: 2, fontSize: 13, marginBottom: 16, color: "#D13212" }}>
              ⚠️ {error}
              <button onClick={() => setError("")}
                style={{ float: "right", background: "none", border: "none", cursor: "pointer" }}>×</button>
            </div>
          )}

          {/* Create Batch Form */}
          {showForm && (
            <div style={{ background: "white", border: "1px solid #D5DBDB",
              borderRadius: 2, padding: 20, marginBottom: 16 }}>
              <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 16, marginTop: 0 }}>
                Create New Queue Batch
              </h3>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 700, display: "block", marginBottom: 4 }}>
                    Batch Name *
                  </label>
                  <input className="aws-input" placeholder="e.g. NER Batch 001"
                    value={form.name}
                    onChange={e => setForm({...form, name: e.target.value})} />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 700, display: "block", marginBottom: 4 }}>
                    Project *
                  </label>
                  <select className="aws-input"
                    value={form.project_id}
                    onChange={e => setForm({...form, project_id: e.target.value})}>
                    <option value="">Select project...</option>
                    {projects.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 700, display: "block", marginBottom: 4 }}>
                    Tasks Per Batch
                  </label>
                  <input className="aws-input" type="number" min="1" max="500"
                    value={form.tasks_per_user}
                    onChange={e => setForm({...form, tasks_per_user: e.target.value})} />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 700, display: "block", marginBottom: 4 }}>
                    Time Limit Per Task
                  </label>
                  <select className="aws-input"
                    value={form.time_limit}
                    onChange={e => setForm({...form, time_limit: e.target.value})}>
                    <option value="900">15 minutes</option>
                    <option value="1800">30 minutes</option>
                    <option value="2700">45 minutes</option>
                    <option value="3600">60 minutes</option>
                  </select>
                </div>
              </div>

              {/* User Selection */}
              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 12, fontWeight: 700, display: "block", marginBottom: 8 }}>
                  Assign Annotators * ({form.user_ids.length} selected)
                </label>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {users.length === 0 ? (
                    <p style={{ fontSize: 12, color: "#687078" }}>
                      No active annotators found. Create users first.
                    </p>
                  ) : (
                    users.map(u => (
                      <div key={u.id} onClick={() => toggleUser(u.id)}
                        style={{ padding: "6px 12px", borderRadius: 2, cursor: "pointer",
                          border: form.user_ids.includes(u.id)
                            ? "2px solid #FF9900" : "1px solid #D5DBDB",
                          background: form.user_ids.includes(u.id) ? "#FFFBF5" : "white",
                          fontSize: 13 }}>
                        {form.user_ids.includes(u.id) ? "✅" : "○"} {u.username}
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div style={{ display: "flex", gap: 8 }}>
                <button className="aws-btn-primary" onClick={handleCreateBatch}>
                  Create Batch
                </button>
                <button className="aws-btn-normal"
                  onClick={() => { setShowForm(false); setError(""); }}>
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Batches Table */}
          <div style={{ background: "white", border: "1px solid #D5DBDB", borderRadius: 2 }}>
            <div style={{ padding: "16px 20px", borderBottom: "1px solid #D5DBDB",
              display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>
                Queue Batches ({batches.length})
              </h2>
              <div style={{ display: "flex", gap: 8 }}>
                <button className="aws-btn-normal" onClick={fetchAll}>Refresh</button>
                <button className="aws-btn-primary"
                  onClick={() => { setShowForm(!showForm); setError(""); setSuccess(""); }}>
                  + Create Batch
                </button>
              </div>
            </div>

            <table className="aws-table" style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th>Batch Name</th>
                  <th>Project</th>
                  <th>Annotators</th>
                  <th>Tasks/Batch</th>
                  <th>Time Limit</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {batches.length === 0 ? (
                  <tr>
                    <td colSpan="7" style={{ textAlign: "center", padding: 40, color: "#687078" }}>
                      No batches yet. Click "+ Create Batch" to get started.
                    </td>
                  </tr>
                ) : (
                  batches.map(batch => (
                    <tr key={batch.id}>
                      <td style={{ fontWeight: 600 }}>{batch.name}</td>
                      <td style={{ color: "#687078" }}>
                        {projects.find(p => p.id === batch.project_id)?.name || `Project ${batch.project_id}`}
                      </td>
                      <td>
                        <span style={{ background: "#E8F4FD", color: "#0073BB",
                          padding: "2px 8px", borderRadius: 2, fontSize: 12, fontWeight: 600 }}>
                          {batch.assigned_users} annotators
                        </span>
                      </td>
                      <td style={{ color: "#16191f" }}>{batch.tasks_per_user} tasks</td>
                      <td>
                        {editBatch === batch.id ? (
                          <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                            <select style={{ border: "1px solid #aab7b8", borderRadius: 2,
                              padding: "4px 6px", fontSize: 12 }}
                              value={editTimeLimit}
                              onChange={e => setEditTimeLimit(e.target.value)}>
                              <option value="900">15 min</option>
                              <option value="1800">30 min</option>
                              <option value="2700">45 min</option>
                              <option value="3600">60 min</option>
                            </select>
                            <button onClick={() => handleUpdateTimeLimit(batch.id)}
                              style={{ background: "#FF9900", border: "none", color: "black",
                                padding: "4px 8px", borderRadius: 2, fontSize: 11,
                                cursor: "pointer", fontWeight: 700 }}>
                              Save
                            </button>
                            <button onClick={() => setEditBatch(null)}
                              style={{ background: "none", border: "1px solid #aab7b8",
                                padding: "4px 8px", borderRadius: 2, fontSize: 11,
                                cursor: "pointer" }}>
                              ×
                            </button>
                          </div>
                        ) : (
                          <span style={{ color: "#16191f" }}>
                            {formatTime(batch.time_limit)}
                            <span className="aws-link" style={{ marginLeft: 8, fontSize: 11 }}
                              onClick={() => {
                                setEditBatch(batch.id);
                                setEditTimeLimit(String(batch.time_limit));
                              }}>
                              Edit
                            </span>
                          </span>
                        )}
                      </td>
                      <td>
                        <span style={{
                          background: batch.status === "active" ? "#d5f5e3" : "#FEF9E7",
                          color: batch.status === "active" ? "#1D8102" : "#996300",
                          padding: "2px 8px", borderRadius: 2, fontSize: 12, fontWeight: 600
                        }}>
                          {batch.status}
                        </span>
                      </td>
                      <td>
                        <span className="aws-link"
                          onClick={() => handlePauseBatch(batch.id, batch.status)}>
                          {batch.status === "active" ? "Pause" : "Resume"}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}