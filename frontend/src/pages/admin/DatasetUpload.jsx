import { useState, useEffect, useRef } from "react";
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

export default function DatasetUpload() {
  const [projects, setProjects] = useState([]);
  const [selectedProject, setSelectedProject] = useState("");
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef();
  const navigate = useNavigate();
  const username = localStorage.getItem("username");

 useEffect(() => { fetchProjects(); }, []);

  const fetchProjects = async () => {
    try {
      const res = await API.get("/projects/");
      setProjects(res.data);
    } catch {}
  };

  const handleFileChange = (selectedFile) => {
    if (!selectedFile) return;
    setFile(selectedFile);
    setResult(null);
    setError("");

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target.result;
      const lines = text.split("\n").filter(l => l.trim());
      const headers = lines[0].split(",").map(h => h.trim().replace(/"/g, ""));
      const rows = lines.slice(1, 6).map(line => {
        const values = line.split(",").map(v => v.trim().replace(/"/g, ""));
        const row = {};
        headers.forEach((h, i) => { row[h] = values[i] || ""; });
        return row;
      });
      setPreview({ headers, rows, total: lines.length - 1 });
    };
    reader.readAsText(selectedFile);
  };

  const handleUpload = async () => {
    if (!file || !selectedProject) {
      setError("Please select a project and upload a CSV file.");
      return;
    }
    setUploading(true);
    setError("");
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await API.post(
        `/tasks/upload?project_id=${selectedProject}`,
        formData,
        { headers: { "Content-Type": "multipart/form-data" } }
      );
      setResult(res.data);
      setFile(null);
      setPreview([]);
    } catch (err) {
      setError(err.response?.data?.detail || "Upload failed. Please try again.");
    }
    setUploading(false);
  };

  const handleLogout = () => { localStorage.clear(); navigate("/login"); };

  const downloadTemplate = () => {
    const csv = `title,content,customer_id,instructions
"Annotate Article 001","Apple CEO Tim Cook announced new products.","CUST-001","Label PER ORG LOC"
"Annotate Article 002","Google launched new AI tools in California.","CUST-002","Label PER ORG LOC"
"Annotate Article 003","Microsoft acquired a gaming company for billions.","CUST-003","Label PER ORG LOC"`;
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "tasks_template.csv";
    a.click();
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
      <AwsTopNav username={username} onLogout={handleLogout} />
      <div style={{ display: "flex", flex: 1 }}>
        <AwsSidebar active="Datasets" />
        <div style={{ flex: 1, background: "#F2F3F3", padding: 24, overflowY: "auto" }}>

          <div style={{ fontSize: 12, color: "#687078", marginBottom: 16 }}>
            AnnotateHub &gt; <strong>Dataset Upload</strong>
          </div>

          <div style={{ display: "flex", justifyContent: "space-between",
            alignItems: "center", marginBottom: 20 }}>
            <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>
              📂 Dataset Upload
            </h1>
            <button className="aws-btn-normal" onClick={downloadTemplate}>
              ⬇️ Download CSV Template
            </button>
          </div>

          {/* Info Banner */}
          <div style={{ background: "#F0F8FF", border: "1px solid #0073BB",
            borderLeft: "4px solid #0073BB", borderRadius: 2,
            padding: "12px 16px", marginBottom: 20, fontSize: 13 }}>
            <strong>How to upload:</strong> Download the CSV template, fill it with your tasks,
            then upload it here. Required columns: <code>title</code>, <code>content</code>.
            Optional: <code>customer_id</code>, <code>instructions</code>.
          </div>

          {error && (
            <div style={{ background: "#FDEDEC", border: "1px solid #D13212",
              borderLeft: "4px solid #D13212", padding: "10px 16px",
              borderRadius: 2, fontSize: 13, marginBottom: 16, color: "#D13212" }}>
              ⚠️ {error}
              <button onClick={() => setError("")}
                style={{ float: "right", background: "none", border: "none", cursor: "pointer" }}>×</button>
            </div>
          )}

          {result && (
            <div style={{ background: "#d5f5e3", border: "1px solid #1D8102",
              borderLeft: "4px solid #1D8102", padding: "16px 20px",
              borderRadius: 2, marginBottom: 16 }}>
              <h3 style={{ fontSize: 15, fontWeight: 700, color: "#1D8102", margin: "0 0 8px" }}>
                ✅ Upload Successful!
              </h3>
              <p style={{ fontSize: 13, margin: "0 0 4px" }}>
                <strong>{result.tasks_created}</strong> tasks created successfully.
              </p>
              {result.errors?.length > 0 && (
                <p style={{ fontSize: 12, color: "#D13212", margin: 0 }}>
                  {result.errors.length} errors: {result.errors.join(", ")}
                </p>
              )}
              <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
                <button className="aws-btn-primary"
                  onClick={() => navigate("/admin/tasks")}>
                  View Tasks
                </button>
                <button className="aws-btn-normal"
                  onClick={() => { setResult(null); setSelectedProject(""); }}>
                  Upload Another
                </button>
              </div>
            </div>
          )}

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>

            {/* Upload Form */}
            <div style={{ background: "white", border: "1px solid #D5DBDB",
              borderRadius: 2, padding: 20 }}>
              <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 16, marginTop: 0 }}>
                Upload Configuration
              </h2>

              {/* Project Selection */}
              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 12, fontWeight: 700,
                  display: "block", marginBottom: 4 }}>
                  Select Project *
                </label>
                <select className="aws-input"
                  value={selectedProject}
                  onChange={e => setSelectedProject(e.target.value)}>
                  <option value="">Select project...</option>
                  {projects.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>

              {/* File Upload */}
              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 12, fontWeight: 700,
                  display: "block", marginBottom: 4 }}>
                  CSV File *
                </label>
                <div
                  onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={e => {
                    e.preventDefault();
                    setDragOver(false);
                    handleFileChange(e.dataTransfer.files[0]);
                  }}
                  onClick={() => fileRef.current.click()}
                  style={{
                    border: `2px dashed ${dragOver ? "#FF9900" : "#D5DBDB"}`,
                    borderRadius: 2, padding: 32, textAlign: "center",
                    cursor: "pointer", background: dragOver ? "#FFFBF5" : "#FAFAFA",
                    transition: "all 0.2s"
                  }}>
                  <div style={{ fontSize: 32, marginBottom: 8 }}>📄</div>
                  <p style={{ fontSize: 13, color: "#16191f", margin: "0 0 4px", fontWeight: 600 }}>
                    {file ? file.name : "Drop CSV file here or click to browse"}
                  </p>
                  <p style={{ fontSize: 12, color: "#687078", margin: 0 }}>
                    Supports .csv files only
                  </p>
                  <input ref={fileRef} type="file" accept=".csv"
                    style={{ display: "none" }}
                    onChange={e => handleFileChange(e.target.files[0])} />
                </div>
              </div>

              <button
                onClick={handleUpload}
                disabled={!file || !selectedProject || uploading}
                className={file && selectedProject ? "aws-btn-primary" : "aws-btn-disabled"}
                style={{ width: "100%", padding: "10px 0", fontSize: 14,
                  cursor: file && selectedProject ? "pointer" : "not-allowed" }}>
                {uploading ? "⏳ Uploading..." : "⬆️ Upload & Create Tasks"}
              </button>
            </div>

            {/* Preview */}
            <div style={{ background: "white", border: "1px solid #D5DBDB",
              borderRadius: 2, padding: 20 }}>
              <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 16, marginTop: 0 }}>
                Preview
              </h2>

              {!preview.headers ? (
                <div style={{ textAlign: "center", padding: 32, color: "#687078" }}>
                  <div style={{ fontSize: 32, marginBottom: 8 }}>👀</div>
                  <p style={{ fontSize: 13 }}>Upload a CSV file to preview its contents</p>
                </div>
              ) : (
                <div>
                  <p style={{ fontSize: 13, color: "#687078", marginBottom: 12 }}>
                    Showing first 5 of <strong>{preview.total}</strong> rows
                  </p>
                  <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse",
                      fontSize: 12 }}>
                      <thead>
                        <tr style={{ background: "#FAFAFA" }}>
                          {preview.headers.map(h => (
                            <th key={h} style={{ padding: "6px 10px",
                              textAlign: "left", borderBottom: "1px solid #D5DBDB",
                              fontWeight: 700, color: "#16191f" }}>
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {preview.rows.map((row, i) => (
                          <tr key={i} style={{ borderBottom: "1px solid #eaeded" }}>
                            {preview.headers.map(h => (
                              <td key={h} style={{ padding: "6px 10px",
                                color: "#16191f", maxWidth: 150,
                                overflow: "hidden", textOverflow: "ellipsis",
                                whiteSpace: "nowrap" }}>
                                {row[h] || "—"}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Column mapping info */}
                  <div style={{ marginTop: 12, padding: 12,
                    background: "#F8F8F8", borderRadius: 2, fontSize: 12 }}>
                    <strong>Detected columns:</strong>
                    <div style={{ marginTop: 4, display: "flex", flexWrap: "wrap", gap: 4 }}>
                      {preview.headers.map(h => (
                        <span key={h} style={{ background: "#E8F4FD",
                          color: "#0073BB", padding: "2px 8px",
                          borderRadius: 2, fontWeight: 600 }}>
                          {h}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* CSV Format Guide */}
          <div style={{ background: "white", border: "1px solid #D5DBDB",
            borderRadius: 2, padding: 20, marginTop: 16 }}>
            <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 12, marginTop: 0 }}>
              📋 CSV Format Guide
            </h2>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ background: "#FAFAFA" }}>
                  <th style={{ padding: "8px 16px", textAlign: "left",
                    borderBottom: "1px solid #D5DBDB", fontWeight: 700 }}>Column</th>
                  <th style={{ padding: "8px 16px", textAlign: "left",
                    borderBottom: "1px solid #D5DBDB", fontWeight: 700 }}>Required</th>
                  <th style={{ padding: "8px 16px", textAlign: "left",
                    borderBottom: "1px solid #D5DBDB", fontWeight: 700 }}>Description</th>
                  <th style={{ padding: "8px 16px", textAlign: "left",
                    borderBottom: "1px solid #D5DBDB", fontWeight: 700 }}>Example</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { col: "title", req: "✅ Yes", desc: "Task title shown in queue", ex: "Annotate Article 001" },
                  { col: "content", req: "✅ Yes", desc: "Text content to annotate", ex: "Apple CEO Tim Cook announced..." },
                  { col: "customer_id", req: "❌ No", desc: "Customer reference ID", ex: "CUST-001" },
                  { col: "instructions", req: "❌ No", desc: "Annotation instructions", ex: "Label PER ORG LOC entities" },
                ].map(row => (
                  <tr key={row.col} style={{ borderBottom: "1px solid #eaeded" }}>
                    <td style={{ padding: "8px 16px" }}>
                      <code style={{ background: "#F8F8F8", padding: "2px 6px",
                        borderRadius: 2, fontSize: 12 }}>{row.col}</code>
                    </td>
                    <td style={{ padding: "8px 16px" }}>{row.req}</td>
                    <td style={{ padding: "8px 16px", color: "#687078" }}>{row.desc}</td>
                    <td style={{ padding: "8px 16px", color: "#687078",
                      fontStyle: "italic" }}>{row.ex}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}