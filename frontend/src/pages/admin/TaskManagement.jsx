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

export default function TaskManagement() {
  const [tasks, setTasks] = useState([]);
  const [projects, setProjects] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editTask, setEditTask] = useState(null);
  const [form, setForm] = useState({
    title: "", project_id: "", customer_id: "",
    data_content: "", instructions: ""
  });
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");
  const [filterProject, setFilterProject] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const navigate = useNavigate();
  const username = localStorage.getItem("username");

  useEffect(() => { fetchAll(); }, [filterProject, filterStatus]);

  const fetchAll = async () => {
    try {
      const [t, p] = await Promise.all([
        API.get("/tasks/", { params: {
          project_id: filterProject || undefined,
          status: filterStatus || undefined
        }}),
        API.get("/projects/")
      ]);
      setTasks(t.data);
      setProjects(p.data);
    } catch {}
  };

  const handleSave = async () => {
    if (!form.title || !form.project_id) {
      setError("Title and Project are required.");
      return;
    }
    try {
      if (editTask) {
        await API.put(`/tasks/update/${editTask.id}`, form);
        setSuccess("Task updated successfully!");
      } else {
        await API.post("/tasks/", {
          ...form,
          project_id: parseInt(form.project_id)
        });
        setSuccess("Task created successfully!");
      }
      setShowForm(false);
      setEditTask(null);
      setForm({ title: "", project_id: "", customer_id: "", data_content: "", instructions: "" });
      fetchAll();
    } catch (err) {
      setError(err.response?.data?.detail || "Could not save task.");
    }
  };

  const handleEdit = (task) => {
    setEditTask(task);
    setForm({
      title: task.title || "",
      project_id: task.project_id || "",
      customer_id: task.customer_id || "",
      data_content: task.data_content || "",
      instructions: task.instructions || ""
    });
    setShowForm(true);
  };

  const handleReset = async (taskId) => {
    if (!confirm("Reset task to available?")) return;
    try {
      await API.put(`/tasks/${taskId}/reset`);
      setSuccess("Task reset to available!");
      fetchAll();
    } catch { setError("Could not reset task."); }
  };

  const handleLogout = () => { localStorage.clear(); navigate("/login"); };

  const getStatusBadge = (status) => {
    const colors = {
      available: { bg: "#d5f5e3", color: "#1D8102" },
      in_progress: { bg: "#E8F4FD", color: "#0073BB" },
      paused: { bg: "#FEF9E7", color: "#996300" },
      completed: { bg: "#eaeded", color: "#687078" },
      under_review: { bg: "#EDE7F6", color: "#6A1B9A" },
      approved: { bg: "#d5f5e3", color: "#1D8102" },
      rejected: { bg: "#FDEDEC", color: "#D13212" },
    };
    const c = colors[status] || { bg: "#eaeded", color: "#687078" };
    return (
      <span style={{ background: c.bg, color: c.color,
        padding: "2px 8px", borderRadius: 2, fontSize: 12, fontWeight: 600 }}>
        {status?.replace("_", " ")}
      </span>
    );
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
      <AwsTopNav username={username} onLogout={handleLogout} />
      <div style={{ display: "flex", flex: 1 }}>
        <AwsSidebar active="Tasks" />
        <div style={{ flex: 1, background: "#F2F3F3", padding: 24, overflowY: "auto" }}>

          <div style={{ fontSize: 12, color: "#687078", marginBottom: 16 }}>
            AnnotateHub &gt; <strong>Task Management</strong>
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

          {/* Create/Edit Form */}
          {showForm && (
            <div style={{ background: "white", border: "1px solid #D5DBDB",
              borderRadius: 2, padding: 20, marginBottom: 16 }}>
              <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 16, marginTop: 0 }}>
                {editTask ? "Edit Task" : "Create New Task"}
              </h3>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 700, display: "block", marginBottom: 4 }}>
                    Task Title *
                  </label>
                  <input className="aws-input" placeholder="Enter task title"
                    value={form.title}
                    onChange={e => setForm({...form, title: e.target.value})} />
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
                    Customer ID
                  </label>
                  <input className="aws-input" placeholder="e.g. CUST-001"
                    value={form.customer_id}
                    onChange={e => setForm({...form, customer_id: e.target.value})} />
                </div>
              </div>
              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 12, fontWeight: 700, display: "block", marginBottom: 4 }}>
                  Task Content (text to annotate)
                </label>
                <textarea className="aws-input" rows={4}
                  placeholder="Enter the text content for annotation..."
                  value={form.data_content}
                  onChange={e => setForm({...form, data_content: e.target.value})} />
              </div>
              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 12, fontWeight: 700, display: "block", marginBottom: 4 }}>
                  Instructions for Annotators
                </label>
                <textarea className="aws-input" rows={3}
                  placeholder="Enter annotation instructions..."
                  value={form.instructions}
                  onChange={e => setForm({...form, instructions: e.target.value})} />
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button className="aws-btn-primary" onClick={handleSave}>
                  {editTask ? "Update Task" : "Create Task"}
                </button>
                <button className="aws-btn-normal"
                  onClick={() => { setShowForm(false); setEditTask(null); setError(""); }}>
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Filters + Table */}
          <div style={{ background: "white", border: "1px solid #D5DBDB", borderRadius: 2 }}>
            <div style={{ padding: "16px 20px", borderBottom: "1px solid #D5DBDB",
              display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
              <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>
                Tasks ({tasks.length})
              </h2>
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <select className="aws-input" style={{ width: 160 }}
                  value={filterProject}
                  onChange={e => setFilterProject(e.target.value)}>
                  <option value="">All Projects</option>
                  {projects.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
                <select className="aws-input" style={{ width: 140 }}
                  value={filterStatus}
                  onChange={e => setFilterStatus(e.target.value)}>
                  <option value="">All Statuses</option>
                  <option value="available">Available</option>
                  <option value="in_progress">In Progress</option>
                  <option value="paused">Paused</option>
                  <option value="completed">Completed</option>
                </select>
                <button className="aws-btn-normal" onClick={fetchAll}>Refresh</button>
                <button className="aws-btn-primary"
                  onClick={() => { setShowForm(!showForm); setEditTask(null);
                    setForm({ title: "", project_id: "", customer_id: "", data_content: "", instructions: "" });
                    setError(""); setSuccess(""); }}>
                  + Create Task
                </button>
              </div>
            </div>

            <table className="aws-table" style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th>Task Title</th>
                  <th>Customer ID</th>
                  <th>Project</th>
                  <th>Status</th>
                  <th>Assigned To</th>
                  <th>Created</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {tasks.length === 0 ? (
                  <tr>
                    <td colSpan="7" style={{ textAlign: "center", padding: 40, color: "#687078" }}>
                      No tasks found. Click "+ Create Task" to add one.
                    </td>
                  </tr>
                ) : (
                  tasks.map(task => (
                    <tr key={task.id}>
                      <td style={{ fontWeight: 600, maxWidth: 200 }}>
                        <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {task.title}
                        </div>
                      </td>
                      <td style={{ color: "#687078" }}>{task.customer_id || "—"}</td>
                      <td style={{ color: "#687078" }}>
                        {projects.find(p => p.id === task.project_id)?.name || `Project ${task.project_id}`}
                      </td>
                      <td>{getStatusBadge(task.status)}</td>
                      <td style={{ color: "#687078" }}>{task.assigned_to || "—"}</td>
                      <td style={{ color: "#687078", fontSize: 12 }}>
                        {new Date(task.created_at).toLocaleDateString()}
                      </td>
                      <td>
                        <div style={{ display: "flex", gap: 8 }}>
                          <span className="aws-link" onClick={() => handleEdit(task)}>
                            Edit
                          </span>
                          {task.status !== "available" && (
                            <span style={{ color: "#D13212", cursor: "pointer", fontSize: 13 }}
                              onClick={() => handleReset(task.id)}>
                              Reset
                            </span>
                          )}
                        </div>
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