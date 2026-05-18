import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
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

export default function ConsensusResults() {
  const { batchId } = useParams();
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const navigate = useNavigate();
  const username = localStorage.getItem("username");

  useEffect(() => { fetchResults(); }, [batchId]);

  const fetchResults = async () => {
    setLoading(true);
    try {
      const res = await API.get(`/consensus/results/${batchId}`);
      setResults(res.data);
    } catch {}
    setLoading(false);
  };

  const handleExport = async () => {
    try {
      const res = await API.get(`/consensus/export/${batchId}`);
      const blob = new Blob([JSON.stringify(res.data, null, 2)],
        { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `consensus_batch_${batchId}.json`;
      a.click();
    } catch { alert("Could not export."); }
  };

  const handleLogout = () => { localStorage.clear(); navigate("/login"); };

  const getStatusColor = (status) => {
    if (status === "agreed") return { bg: "#d5f5e3", color: "#1D8102" };
    if (status === "needs_review") return { bg: "#FDEDEC", color: "#D13212" };
    return { bg: "#FEF9E7", color: "#996300" };
  };

  const agreed = results.filter(r => r.status === "agreed").length;
  const needsReview = results.filter(r => r.status === "needs_review").length;
  const pending = results.filter(r => !r.status || r.status === "pending").length;

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
      <AwsTopNav username={username} onLogout={handleLogout} />
      <div style={{ display: "flex", flex: 1 }}>
        <AwsSidebar active="Batches" />
        <div style={{ flex: 1, background: "#F2F3F3", padding: 24, overflowY: "auto" }}>

          <div style={{ fontSize: 12, color: "#687078", marginBottom: 16 }}>
            AnnotateHub &gt; Batches &gt; <strong>Consensus Results — Batch {batchId}</strong>
          </div>

          {/* Summary Cards */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 24 }}>
            {[
              { label: "Total Tasks", value: results.length, color: "#0073BB", bg: "#E8F4FD" },
              { label: "Agreed ✅", value: agreed, color: "#1D8102", bg: "#d5f5e3" },
              { label: "Needs Review ⚠️", value: needsReview, color: "#D13212", bg: "#FDEDEC" },
              { label: "Pending ⏳", value: pending, color: "#996300", bg: "#FEF9E7" },
            ].map(card => (
              <div key={card.label} style={{ background: "white", border: "1px solid #D5DBDB",
                borderRadius: 2, padding: 16 }}>
                <div style={{ fontSize: 28, fontWeight: 700, color: card.color }}>{card.value}</div>
                <div style={{ fontSize: 12, color: "#687078" }}>{card.label}</div>
              </div>
            ))}
          </div>

          {/* Actions */}
          <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
            <button className="aws-btn-normal" onClick={fetchResults}>🔄 Refresh</button>
            <button className="aws-btn-primary" onClick={handleExport}>⬇️ Export JSON</button>
            <button className="aws-btn-normal" onClick={() => navigate("/admin/batches")}>
              ← Back to Batches
            </button>
          </div>

          {/* Results Table */}
          <div style={{ background: "white", border: "1px solid #D5DBDB", borderRadius: 2, marginBottom: 16 }}>
            <div style={{ padding: "16px 20px", borderBottom: "1px solid #D5DBDB" }}>
              <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>
                Consensus Results ({results.length} tasks)
              </h2>
            </div>
            {loading ? (
              <p style={{ padding: 24, color: "#687078" }}>Loading...</p>
            ) : results.length === 0 ? (
              <p style={{ padding: 24, textAlign: "center", color: "#687078" }}>
                No consensus results yet. Annotators need to complete tasks first.
              </p>
            ) : (
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "#FAFAFA", borderBottom: "1px solid #D5DBDB" }}>
                    {["Dataset ID", "Task", "Annotator 1", "Annotator 2", "Annotator 3",
                      "Agreement", "Status", "Actions"].map(h => (
                      <th key={h} style={{ padding: "10px 16px", textAlign: "left",
                        fontSize: 12, fontWeight: 700, color: "#16191f" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {results.map(r => {
                    const sc = getStatusColor(r.status);
                    return (
                      <tr key={r.task_id} style={{ borderBottom: "1px solid #eaeded" }}>
                        <td style={{ padding: "10px 16px", fontSize: 13, color: "#687078" }}>
                          {r.dataset_object_id}
                        </td>
                        <td style={{ padding: "10px 16px", fontSize: 13, fontWeight: 600 }}>
                          {r.title}
                        </td>
                        <td style={{ padding: "10px 16px", fontSize: 12, color: "#687078" }}>
                          {r.annotator_1 || "—"}
                        </td>
                        <td style={{ padding: "10px 16px", fontSize: 12, color: "#687078" }}>
                          {r.annotator_2 || "—"}
                        </td>
                        <td style={{ padding: "10px 16px", fontSize: 12, color: "#687078" }}>
                          {r.annotator_3 || "—"}
                        </td>
                        <td style={{ padding: "10px 16px" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <div style={{ width: 60, background: "#D5DBDB", borderRadius: 4, height: 6 }}>
                              <div style={{ width: `${(r.agreement_score || 0) * 100}%`,
                                background: r.agreement_score >= 0.7 ? "#1D8102" : "#D13212",
                                borderRadius: 4, height: 6 }} />
                            </div>
                            <span style={{ fontSize: 12, fontWeight: 700 }}>
                              {Math.round((r.agreement_score || 0) * 100)}%
                            </span>
                          </div>
                        </td>
                        <td style={{ padding: "10px 16px" }}>
                          <span style={{ background: sc.bg, color: sc.color,
                            padding: "2px 8px", borderRadius: 2, fontSize: 12, fontWeight: 600 }}>
                            {r.status || "pending"}
                          </span>
                        </td>
                        <td style={{ padding: "10px 16px" }}>
                          <span style={{ color: "#0073BB", cursor: "pointer", fontSize: 13 }}
                            onClick={() => setSelected(selected === r.task_id ? null : r.task_id)}>
                            {selected === r.task_id ? "Hide" : "View"}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          {/* Detail View */}
          {selected && (() => {
            const r = results.find(x => x.task_id === selected);
            if (!r) return null;
            return (
              <div style={{ background: "white", border: "1px solid #D5DBDB",
                borderRadius: 2, padding: 20 }}>
                <h3 style={{ fontSize: 15, fontWeight: 700, marginTop: 0 }}>
                  Task Detail — {r.title}
                  <span style={{ fontSize: 12, color: "#687078", fontWeight: 400, marginLeft: 8 }}>
                    datasetObjectId: {r.dataset_object_id}
                  </span>
                </h3>
                <div style={{ background: "#F8F8F8", border: "1px solid #D5DBDB",
                  borderRadius: 2, padding: 12, marginBottom: 16, fontSize: 13 }}>
                  {r.data_content}
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 12 }}>
                  {[
                    { label: `Annotator 1 (${r.annotator_1 || "—"})`, data: r.annotation_1, color: "#0073BB" },
                    { label: `Annotator 2 (${r.annotator_2 || "—"})`, data: r.annotation_2, color: "#8E44AD" },
                    { label: `Annotator 3 (${r.annotator_3 || "—"})`, data: r.annotation_3, color: "#D13212" },
                    { label: "✅ Consensus", data: r.consensus_result, color: "#1D8102" },
                  ].map(col => (
                    <div key={col.label} style={{ border: `1px solid ${col.color}20`,
                      borderTop: `3px solid ${col.color}`, borderRadius: 2, padding: 12 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: col.color, marginBottom: 8 }}>
                        {col.label}
                      </div>
                      {col.data ? (
                        <pre style={{ fontSize: 11, color: "#16191f", margin: 0,
                          whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                          {JSON.stringify(col.data, null, 2)}
                        </pre>
                      ) : (
                        <p style={{ fontSize: 12, color: "#687078" }}>No data yet</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}
        </div>
      </div>
    </div>
  );
}