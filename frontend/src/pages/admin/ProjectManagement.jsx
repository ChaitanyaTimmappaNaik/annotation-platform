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

export default function ProjectManagement() {
  const [projects, setProjects] = useState([]);
  const [search, setSearch] = useState("");
  const [editProject, setEditProject] = useState(null);
  const [editForm, setEditForm] = useState({ name: "", description: "", customer_id: "" });
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();
  const username = localStorage.getItem("username");

  useEffect(() => { fetchProjects(); }, [search]);

  const fetchProjects = async () => {
    try {
      const res = await API.get("/projects/", { params: { search } });
      setProjects(res.data);
    } catch {}
  };

  const handleEdit = (project) => {
    setEditProject(project);
    setEditForm({
      name: project.name || "",
      description: project.description || "",
      customer_id: project.customer_id || ""
    });
  };

  const handleSaveEdit = async () => {
    try {
      await API.put(`/projects/${editProject.id}`, editForm);
      setSuccess(`Project "${editForm.name}" updated successfully!`);
      setEditProject(null);
      fetchProjects();
    } catch (err) {
      setError(err.response?.data?.detail || "Could not update project.");
    }
  };

  const handleDelete = async (id, name) => {
    if (!confirm(`Delete project "${name}"? This cannot be undone.`)) return;
    try {
      await API.delete(`/projects/${id}`);
      setSuccess(`Project "${name}" deleted.`);
      fetchProjects();
    } catch {
      setError("Could not delete project.");
    }
  };

  const handleLogout = () => { localStorage.clear(); navigate("/login"); };

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
      <AwsTopNav username={username} onLogout={handleLogout} />
      <div style={{ display: "flex", flex: 1 }}>
        <AwsSidebar active="Projects" />
        <div style={{ flex: 1, background: "#F2F3F3", padding: 24 }}>

          <div style={{ fontSize: 12, color: "#687078", marginBottom: 16 }}>
            AnnotateHub &gt; <strong>Projects</strong>
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

          {/* Edit Project Form */}
          {editProject && (
            <div style={{ background: "white", border: "1px solid #FF9900",
              borderRadius: 2, padding: 20, marginBottom: 16 }}>
              <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 16, marginTop: 0 }}>
                Edit Project — {editProject.name}
              </h3>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 16 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 700, display: "block", marginBottom: 4 }}>
                    Project Name *
                  </label>
                  <input className="aws-input" type="text"
                    value={editForm.name}
                    onChange={e => setEditForm({...editForm, name: e.target.value})}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 700, display: "block", marginBottom: 4 }}>
                    Customer ID
                  </label>
                  <input className="aws-input" type="text"
                    placeholder="e.g. CUST-001"
                    value={editForm.customer_id}
                    onChange={e => setEditForm({...editForm, customer_id: e.target.value})}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 700, display: "block", marginBottom: 4 }}>
                    Description
                  </label>
                  <input className="aws-input" type="text"
                    placeholder="Project description"
                    value={editForm.description}
                    onChange={e => setEditForm({...editForm, description: e.target.value})}
                  />
                </div>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button className="aws-btn-primary" onClick={handleSaveEdit}>
                  Save Changes
                </button>
                <button className="aws-btn-normal"
                  onClick={() => { setEditProject(null); setError(""); }}>
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Projects Table */}
          <div style={{ background: "white", border: "1px solid #D5DBDB", borderRadius: 2 }}>
            <div style={{ padding: "16px 20px", borderBottom: "1px solid #D5DBDB",
              display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>
                Projects ({projects.length})
              </h2>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <div style={{ position: "relative" }}>
                  <span style={{ position: "absolute", left: 8, top: 7, color: "#687078", fontSize: 13 }}>🔍</span>
                  <input className="aws-input" style={{ paddingLeft: 28, width: 240 }}
                    placeholder="Search projects"
                    value={search} onChange={e => setSearch(e.target.value)} />
                </div>
                <button className="aws-btn-normal" onClick={fetchProjects}>Refresh</button>
                <button className="aws-btn-primary" onClick={() => navigate("/admin/projects/new")}>
                  Create project
                </button>
              </div>
            </div>

            <table className="aws-table" style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th>Project name</th>
                  <th>Data type</th>
                  <th>Customer ID</th>
                  <th>Description</th>
                  <th>Created</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {projects.length === 0 ? (
                  <tr>
                    <td colSpan="6" style={{ textAlign: "center", padding: 40, color: "#687078" }}>
                      No projects found. Click "Create project" to get started.
                    </td>
                  </tr>
                ) : (
                  projects.map(project => (
                    <tr key={project.id}>
                      <td>
                        <span className="aws-link" style={{ fontWeight: 600 }}>
                          {project.name}
                        </span>
                      </td>
                      <td>
                        <span style={{ background: "#E8F4FD", color: "#0073BB",
                          padding: "2px 8px", borderRadius: 2, fontSize: 12, fontWeight: 600 }}>
                          {project.data_type}
                        </span>
                      </td>
                      <td style={{ color: "#687078" }}>{project.customer_id || "—"}</td>
                      <td style={{ color: "#687078", maxWidth: 200,
                        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {project.description || "—"}
                      </td>
                      <td style={{ color: "#687078" }}>
                        {new Date(project.created_at).toLocaleDateString("en-US", {
                          month: "short", day: "numeric", year: "numeric"
                        })}
                      </td>
                      <td>
                        <div style={{ display: "flex", gap: 12 }}>
                          <span className="aws-link"
                            onClick={() => handleEdit(project)}>
                            Edit
                          </span>
                          <span className="aws-link"
                            onClick={() => navigate(`/admin/projects/${project.id}/tasks`)}>
                            Tasks
                          </span>
                          <span style={{ color: "#D13212", cursor: "pointer", fontSize: 13 }}
                            onClick={() => handleDelete(project.id, project.name)}>
                            Delete
                          </span>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>

            <div style={{ padding: "8px 16px", borderTop: "1px solid #eaeded",
              display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button style={{ background: "none", border: "none", color: "#aab7b8", cursor: "pointer" }}>‹</button>
              <span style={{ fontSize: 13 }}>1</span>
              <button style={{ background: "none", border: "none", color: "#aab7b8", cursor: "pointer" }}>›</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}