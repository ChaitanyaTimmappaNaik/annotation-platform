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

export default function ExportAnnotations() {
  const [projects, setProjects] = useState([]);
  const [selectedProject, setSelectedProject] = useState(null);
  const [format, setFormat] = useState("json");
  const [annotations, setAnnotations] = useState([]);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const username = localStorage.getItem("username");

  useEffect(() => { fetchProjects(); }, []);

  const fetchProjects = async () => {
    try {
      const res = await API.get("/projects/");
      setProjects(res.data);
    } catch {}
  };

  const fetchAnnotations = async (projectId) => {
    try {
      const res = await API.get(`/annotations/projects/${projectId}`);
      setAnnotations(res.data);
    } catch {}
  };

  const handleProjectSelect = (project) => {
    setSelectedProject(project);
    fetchAnnotations(project.id);
  };

  const handleExport = async () => {
    if (!selectedProject) return;
    setLoading(true);
    try {
      const res = await API.get(`/annotations/projects/${selectedProject.id}/export`,
        { params: { format }, responseType: "blob" });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `project_${selectedProject.id}_annotations.${format}`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch { alert("Export failed."); }
    setLoading(false);
  };

  const handleLogout = () => { localStorage.clear(); navigate("/login"); };

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
      <AwsTopNav username={username} onLogout={handleLogout} />
      <div style={{ display: "flex", flex: 1 }}>
        <AwsSidebar active="Export" />
        <div style={{ flex: 1, background: "#F2F3F3", padding: 24 }}>

          <div style={{ fontSize: 12, color: "#687078", marginBottom: 16 }}>
            AnnotateHub &gt; <strong>Export Annotations</strong>
          </div>

          <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 20, color: "#16191f" }}>
            Export Annotations
          </h1>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>

            {/* Step 1 */}
            <div style={{ background: "white", border: "1px solid #D5DBDB", borderRadius: 2, padding: 20 }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 16, marginTop: 0,
                paddingBottom: 8, borderBottom: "1px solid #eaeded" }}>
                Step 1 — Select project
              </h3>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {projects.map(project => (
                  <div key={project.id} onClick={() => handleProjectSelect(project)}
                    style={{ border: selectedProject?.id === project.id ? "2px solid #FF9900" : "1px solid #D5DBDB",
                      borderRadius: 2, padding: 12, cursor: "pointer",
                      background: selectedProject?.id === project.id ? "#FFFBF5" : "white" }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "#0073BB" }}>{project.name}</div>
                    <div style={{ fontSize: 11, color: "#687078", marginTop: 2 }}>Type: {project.data_type}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Step 2 */}
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div style={{ background: "white", border: "1px solid #D5DBDB", borderRadius: 2, padding: 20 }}>
                <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 16, marginTop: 0,
                  paddingBottom: 8, borderBottom: "1px solid #eaeded" }}>
                  Step 2 — Choose format
                </h3>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {[
                    { id: "json", label: "JSON", desc: "Standard JSON format, best for APIs" },
                    { id: "csv", label: "CSV", desc: "Spreadsheet compatible format" },
                  ].map(f => (
                    <div key={f.id} onClick={() => setFormat(f.id)}
                      style={{ border: format === f.id ? "2px solid #FF9900" : "1px solid #D5DBDB",
                        borderRadius: 2, padding: 12, cursor: "pointer",
                        background: format === f.id ? "#FFFBF5" : "white" }}>
                      <div style={{ fontSize: 13, fontWeight: 700 }}>{f.label}</div>
                      <div style={{ fontSize: 11, color: "#687078", marginTop: 2 }}>{f.desc}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Preview */}
              {selectedProject && (
                <div style={{ background: "white", border: "1px solid #D5DBDB", borderRadius: 2, padding: 20 }}>
                  <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 12, marginTop: 0 }}>
                    Preview — {annotations.length} annotation(s)
                  </h3>
                  <div style={{ maxHeight: 120, overflowY: "auto" }}>
                    {annotations.map(a => (
                      <div key={a.id} style={{ fontSize: 12, padding: "6px 0",
                        borderBottom: "1px solid #eaeded", color: "#16191f" }}>
                        <span style={{ fontWeight: 700 }}>Annotation #{a.id}</span>
                        <span style={{ color: "#687078", marginLeft: 8 }}>Task #{a.task_id}</span>
                        <span style={{ color: "#1D8102", marginLeft: 8 }}>
                          {a.label_data?.spans?.length || 0} spans
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Export Button */}
              <button onClick={handleExport}
                disabled={!selectedProject || loading}
                className={selectedProject ? "aws-btn-primary" : "aws-btn-disabled"}
                style={{ padding: "12px 0", fontSize: 14, width: "100%",
                  cursor: selectedProject ? "pointer" : "not-allowed" }}>
                {loading ? "Exporting..." : `📤 Export as ${format.toUpperCase()}`}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}