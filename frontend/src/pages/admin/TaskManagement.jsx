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

export default function TaskManagement() {
  const [tasks, setTasks] = useState([]);
  const [projects, setProjects] = useState([]);
  const [selectedProject, setSelectedProject] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editTask, setEditTask] = useState(null);
  const [sortField, setSortField] = useState(null);
  const [sortDir, setSortDir] = useState("asc");
  const [form, setForm] = useState({
    title: "", project_id: "", customer_id: "",
    data_content: "", instructions: ""
  });
  const [editForm, setEditForm] = useState({
    title: "", customer_id: "", data_content: "", instructions: ""
  });
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();
  const username = localStorage.getItem("username");

  useEffect(() => { fetchAll(); }, [selectedProject, selectedStatus]);

  const fetchAll = async () => {
    try {
      const [t, p] = await Promise.all([
        API.get("/tasks/", { params: {
          project_id: selectedProject || undefined,
          status: selectedStatus || undefined
        }}),
        API.get("/projects/")
      ]);
      setTasks(t.data);
      setProjects(p.data);
    } catch {}
  };

  const handleCreateTask = async () => {
    if (!form.title || !form.project_id) {
      setError("Title and Project are required."); return;
    }
    try {
      await API.post("/tasks/", {
        ...form, project_id: parseInt(form.project_id)
      });
      setSuccess("Task created successfully!");
      setShowForm(false);
      setForm({ title: "", project_id: "", customer_id: "", data_content: "", instructions: "" });
      fetchAll();
    } catch (err) {
      setError(err.response?.data?.detail || "Could not create task.");
    }
  };

  const handleEditTask = async () => {
    try {
      await API.put(`/tasks/update/${editTask.id}`, editForm);
      setSuccess("Task updated successfully!");
      setEditTask(null);
      fetchAll();
    } catch (err) {
      setError(err.response?.data?.detail || "Could not update task.");
    }
  };

  const handleResetTask = async (taskId) => {
    try {
      await API.put(`/tasks/${taskId}/reset`);
      setSuccess("Task reset to available!");
      fetchAll();
    } catch { setError("Could not reset task."); }
  };

  const handleLogout = () => { localStorage.clear(); navigate("/login"); };

  // Double-click to sort — toggle asc/desc on same field
  const handleDoubleClick = (field) => {
    if (sortField === field) {
      setSortDir(prev => prev === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDir("asc");
    }
  };

  const getSortedTasks = () => {
    if (!sortField) return tasks;
    return [...tasks].sort((a, b) => {
      let valA = a[sortField] ?? "";
      let valB = b[sortField] ?? "";
      if (typeof valA === "string") valA = valA.toLowerCase();
      if (typeof valB === "string") valB = valB.toLowerCase();
      if (valA < valB) return sortDir === "asc" ? -1 : 1;
      if (valA > valB) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
  };

  const columns = [
    { label: "Task Title", field: "title" },
    { label: "Customer ID", field: "customer_id" },
    { label: "Project", field: "project_id" },
    { label: "Status", field: "status" },
    { label: "Assigned To", field: "assigned_to" },
    { label: "Created", field: "created_at" },
  ];

  const sortedTasks = getSortedTasks();

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

          {/* Create Task Form */}
          {showForm && (
            <div style={{ background: "white", border: "1px solid #D5DBDB",
              borderRadius: 2, padding: 20, marginBottom: 16 }}>
              <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 16, marginTop: 0 }}>
                Create New Task
              </h3>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 700, display: "block", marginBottom: 4 }}>
                    Task Title *
                  </label>
                  <input className="aws-input" placeholder="e.g. Annotate Article 001"
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
                <div>
                  <label style={{ fontSize: 12, fontWeight: 700, display: "block", marginBottom: 4 }}>
                    Instructions
                  </label>
                  <input className="aws-input" placeholder="Annotation instructions"
                    value={form.instructions}
                    onChange={e => setForm({...form, instructions: e.target.value})} />
                </div>
                <div style={{ gridColumn: "1 / -1" }}>
                  <label style={{ fontSize: 12, fontWeight: 700, display: "block", marginBottom: 4 }}>
                    Content
                  </label>
                  <textarea className="aws-input" rows={4}
                    placeholder="Paste the text content to annotate..."
                    value={form.data_content}
                    onChange={e => setForm({...form, data_content: e.target.value})}
                    style={{ resize: "vertical" }} />
                </div>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button className="aws-btn-primary" onClick={handleCreateTask}>Create Task</button>
                <button className="aws-btn-normal"
                  onClick={() => { setShowForm(false); setError(""); }}>Cancel</button>
              </div>
            </div>
          )}

          {/* Edit Task Form */}
          {editTask && (
            <div style={{ background: "white", border: "1px solid #FF9900",
              borderRadius: 2, padding: 20, marginBottom: 16 }}>
              <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 16, marginTop: 0 }}>
                Edit Task — {editTask.title}
              </h3>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 700, display: "block", marginBottom: 4 }}>Title</label>
                  <input className="aws-input"
                    value={editForm.title}
                    onChange={e => setEditForm({...editForm, title: e.target.value})} />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 700, display: "block", marginBottom: 4 }}>Customer ID</label>
                  <input className="aws-input"
                    value={editForm.customer_id}
                    onChange={e => setEditForm({...editForm, customer_id: e.target.value})} />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 700, display: "block", marginBottom: 4 }}>Instructions</label>
                  <input className="aws-input"
                    value={editForm.instructions}
                    onChange={e => setEditForm({...editForm, instructions: e.target.value})} />
                </div>
                <div style={{ gridColumn: "1 / -1" }}>
                  <label style={{ fontSize: 12, fontWeight: 700, display: "block", marginBottom: 4 }}>Content</label>
                  <textarea className="aws-input" rows={3}
                    value={editForm.data_content}
                    onChange={e => setEditForm({...editForm, data_content: e.target.value})}
                    style={{ resize: "vertical" }} />
                </div>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button className="aws-btn-primary" onClick={handleEditTask}>Save Changes</button>
                <button className="aws-btn-normal"
                  onClick={() => { setEditTask(null); setError(""); }}>Cancel</button>
              </div>
            </div>
          )}

          {/* Tasks Table */}
          <div style={{ background: "white", border: "1px solid #D5DBDB", borderRadius: 2 }}>
            <div style={{ padding: "16px 20px", borderBottom: "1px solid #D5DBDB",
              display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>
                Tasks ({sortedTasks.length})
              </h2>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <select className="aws-input" style={{ width: 160 }}
                  value={selectedProject}
                  onChange={e => setSelectedProject(e.target.value)}>
                  <option value="">All Projects</option>
                  {projects.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
                <select className="aws-input" style={{ width: 140 }}
                  value={selectedStatus}
                  onChange={e => setSelectedStatus(e.target.value)}>
                  <option value="">All Statuses</option>
                  <option value="available">Available</option>
                  <option value="in_progress">In Progress</option>
                  <option value="under_review">Under Review</option>
                  <option value="completed">Completed</option>
                  <option value="paused">Paused</option>
                </select>
                <button className="aws-btn-normal" onClick={fetchAll}>Refresh</button>
                <button className="aws-btn-primary"
                  onClick={() => { setShowForm(!showForm); setEditTask(null); setError(""); }}>
                  + Create Task
                </button>
              </div>
            </div>

            <p style={{ fontSize: 11, color: "#aab7b8", margin: "6px 16px 4px" }}>
              💡 Double-click any column header to sort ▲▼
            </p>

            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#FAFAFA", borderBottom: "1px solid #D5DBDB" }}>
                  {columns.map(col => (
                    <th key={col.field}
                      onDoubleClick={() => handleDoubleClick(col.field)}
                      title="Double-click to sort"
                      style={{ padding: "10px 16px", textAlign: "left",
                        fontSize: 12, fontWeight: 700, color: "#16191f",
                        cursor: "pointer", userSelect: "none",
                        whiteSpace: "nowrap" }}>
                      {col.label}{" "}
                      {sortField === col.field ? (
                        <span style={{ color: "#FF9900" }}>
                          {sortDir === "asc" ? "▲" : "▼"}
                        </span>
                      ) : (
                        <span style={{ color: "#aab7b8", fontSize: 10 }}>⇅</span>
                      )}
                    </th>
                  ))}
                  <th style={{ padding: "10px 16px", textAlign: "left",
                    fontSize: 12, fontWeight: 700, color: "#16191f" }}>
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {sortedTasks.length === 0 ? (
                  <tr>
                    <td colSpan="7" style={{ textAlign: "center", padding: 40, color: "#687078" }}>
                      No tasks found.
                    </td>
                  </tr>
                ) : (
                  sortedTasks.map(task => (
                    <tr key={task.id} style={{ borderBottom: "1px solid #eaeded" }}>
                      <td style={{ padding: "10px 16px", fontWeight: 600, fontSize: 13 }}>
                        {task.title}
                      </td>
                      <td style={{ padding: "10px 16px", color: "#687078", fontSize: 13 }}>
                        {task.customer_id || "—"}
                      </td>
                      <td style={{ padding: "10px 16px", fontSize: 13 }}>
                        {projects.find(p => p.id === task.project_id)?.name || `Project ${task.project_id}`}
                      </td>
                      <td style={{ padding: "10px 16px" }}>
                        <span style={{
                          background:
                            task.status === "completed" ? "#d5f5e3" :
                            task.status === "in_progress" ? "#E8F4FD" :
                            task.status === "under_review" ? "#F3E8FF" :
                            task.status === "paused" ? "#FEF9E7" : "#eaeded",
                          color:
                            task.status === "completed" ? "#1D8102" :
                            task.status === "in_progress" ? "#0073BB" :
                            task.status === "under_review" ? "#6A1B9A" :
                            task.status === "paused" ? "#996300" : "#687078",
                          padding: "2px 8px", borderRadius: 2,
                          fontSize: 12, fontWeight: 600
                        }}>
                          {task.status}
                        </span>
                      </td>
                      <td style={{ padding: "10px 16px", color: "#687078", fontSize: 13 }}>
                        {task.assigned_to || "—"}
                      </td>
                      <td style={{ padding: "10px 16px", color: "#687078", fontSize: 13 }}>
                        {task.created_at ? new Date(task.created_at).toLocaleDateString("en-US", {
                          month: "short", day: "numeric", year: "numeric"
                        }) : "—"}
                      </td>
                      <td style={{ padding: "10px 16px" }}>
                        <div style={{ display: "flex", gap: 12 }}>
                          <span style={{ color: "#0073BB", cursor: "pointer", fontSize: 13 }}
                            onClick={() => {
                              setEditTask(task);
                              setEditForm({
                                title: task.title || "",
                                customer_id: task.customer_id || "",
                                data_content: task.data_content || "",
                                instructions: task.instructions || ""
                              });
                              setShowForm(false);
                            }}>
                            Edit
                          </span>
                          {task.status !== "available" && (
                            <span style={{ color: "#D13212", cursor: "pointer", fontSize: 13 }}
                              onClick={() => handleResetTask(task.id)}>
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