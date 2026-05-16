import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import API from "../../api/client";

export default function QueueDashboard() {
  const [tasks, setTasks] = useState([]);
  const [selected, setSelected] = useState(null);
  const [search, setSearch] = useState("");
  const [showInstructions, setShowInstructions] = useState(false);
  const username = localStorage.getItem("username");
  const navigate = useNavigate();

  useEffect(() => { fetchQueue(); }, [search]);

  const fetchQueue = async () => {
    try {
      const res = await API.get("/tasks/queue", { params: { search } });
      setTasks(res.data);
    } catch (err) { console.error(err); }
  };

  const handleStartWorking = async () => {
    if (!selected) return;
    try {
      await API.post(`/tasks/${selected}/claim`);
      navigate(`/annotate/${selected}`);
    } catch { alert("Could not claim task. Please try again."); }
  };

  const handleLogout = () => { localStorage.clear(); navigate("/login"); };

  return (
    <div style={{ minHeight: "100vh", background: "#F2F3F3", display: "flex", flexDirection: "column" }}>
      {/* Top Nav */}
      <div className="aws-topnav">
        <span style={{ fontWeight: 700 }}>🏷️ AnnotateHub</span>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <span style={{ fontSize: 13 }}>Hello, <strong>{username}</strong></span>
          <button onClick={handleLogout}
            style={{ background: "transparent", border: "1px solid #aab7b8", color: "white",
              padding: "4px 12px", borderRadius: 2, fontSize: 12, cursor: "pointer" }}>
            Log out
          </button>
        </div>
      </div>

      <div style={{ maxWidth: 1100, margin: "24px auto", width: "100%", padding: "0 24px" }}>

        {/* Info Banner */}
        {tasks.length === 0 && (
          <div className="aws-info-banner" style={{ marginBottom: 16, display: "flex", gap: 12 }}>
            <span style={{ fontSize: 18, color: "#0073BB" }}>ℹ</span>
            <div>
              <strong>You're finished with the available tasks.</strong>
              <div style={{ marginTop: 4 }}>
                Refresh the page to see if there are new jobs. Select a job and choose <strong>Start working</strong> to work on new tasks.
              </div>
            </div>
          </div>
        )}

        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: "#16191f" }}>
            Jobs ({tasks.length})
          </h2>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, cursor: "pointer" }}>
              <label className="aws-toggle">
                <input type="checkbox" checked={showInstructions}
                  onChange={e => setShowInstructions(e.target.checked)} />
                <span className="aws-toggle-slider"></span>
              </label>
              Show instructions
            </label>
            {selected ? (
              <button className="aws-btn-primary" onClick={handleStartWorking}>
                Start working
              </button>
            ) : (
              <button className="aws-btn-disabled" disabled>
                Start working
              </button>
            )}
          </div>
        </div>

        {/* Search */}
        <div style={{ marginBottom: 8 }}>
          <div style={{ position: "relative", width: 300 }}>
            <span style={{ position: "absolute", left: 10, top: 7, color: "#687078", fontSize: 14 }}>🔍</span>
            <input className="aws-input" style={{ paddingLeft: 32 }}
              placeholder="Search"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        </div>

        {/* Table */}
        <div style={{ background: "white", border: "1px solid #D5DBDB", borderRadius: 2 }}>
          <table className="aws-table" style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={{ width: 40 }}></th>
                <th>Task title ▼</th>
                <th>Customer ID ▼</th>
                <th>Status ▼</th>
                <th>Creation time ▼</th>
              </tr>
            </thead>
            <tbody>
              {tasks.length === 0 ? (
                <tr>
                  <td colSpan="5" style={{ textAlign: "center", padding: 40, color: "#687078" }}>
                    No tasks available
                  </td>
                </tr>
              ) : (
                tasks.map(task => (
                  <tr key={task.id}
                    style={{ cursor: "pointer", background: selected === task.id ? "#F0F8FF" : "white" }}
                    onClick={() => setSelected(task.id)}>
                    <td style={{ textAlign: "center" }}>
                      <input type="radio" name="task"
                        checked={selected === task.id}
                        onChange={() => setSelected(task.id)}
                        style={{ accentColor: "#0073BB" }}
                      />
                    </td>
                    <td>
                      <span className="aws-link">{task.title}</span>
                    </td>
                    <td style={{ color: "#687078" }}>{task.customer_id || "—"}</td>
                    <td>
                      <span className="aws-badge-available">Available</span>
                    </td>
                    <td style={{ color: "#687078" }}>
                      {new Date(task.created_at).toLocaleString("en-US", {
                        month: "short", day: "numeric", year: "numeric",
                        hour: "2-digit", minute: "2-digit"
                      })} UTC
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>

          {/* Pagination */}
          <div style={{ borderTop: "1px solid #eaeded", padding: "8px 16px",
            display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 8 }}>
            <button style={{ background: "none", border: "none", color: "#aab7b8", cursor: "pointer", fontSize: 16 }}>‹</button>
            <span style={{ fontSize: 13 }}>1</span>
            <button style={{ background: "none", border: "none", color: "#aab7b8", cursor: "pointer", fontSize: 16 }}>›</button>
          </div>
        </div>
      </div>
    </div>
  );
}