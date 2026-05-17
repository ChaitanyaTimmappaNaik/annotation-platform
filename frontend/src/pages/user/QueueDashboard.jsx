import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import API from "../../api/client";

export default function QueueDashboard() {
  const [tasks, setTasks] = useState([]);
  const [selected, setSelected] = useState(null);
  const [search, setSearch] = useState("");
  const [showInstructions, setShowInstructions] = useState(false);
  const [notification, setNotification] = useState(null);
  const wsRef = useRef(null);
  const username = localStorage.getItem("username");
  const userId = parseInt(localStorage.getItem("user_id") || "0");
  const navigate = useNavigate();

  useEffect(() => {
    fetchQueue();
    connectWebSocket();
    return () => { if (wsRef.current) wsRef.current.close(); };
  }, []);

  useEffect(() => { fetchQueue(); }, [search]);

  const connectWebSocket = () => {
    try {
      const ws = new WebSocket(`wss://annotation-platform-m7im.onrender.com/batches/ws/${userId}`);
      wsRef.current = ws;
      ws.onmessage = (event) => {
        const msg = JSON.parse(event.data);
        if (msg.type === "batch_assigned") {
          setNotification({ type: "info", message: msg.message });
          fetchQueue();
        }
        setTimeout(() => setNotification(null), 5000);
      };
      ws.onclose = () => setTimeout(connectWebSocket, 3000);
      ws.onerror = () => {};
    } catch {}
  };

  const fetchQueue = async () => {
    try {
      const res = await API.get("/tasks/queue", { params: { search } });
      setTasks(res.data);
    } catch {}
  };

  const handleStartWorking = async () => {
    if (!selected) return;
    const selectedTask = tasks.find(t => t.id === selected);
    try {
      if (selectedTask?.status === "in_progress") {
        // Task already in progress — resume it directly
        navigate(`/annotate/${selected}`);
        return;
      }
      await API.post(`/tasks/${selected}/claim`);
      navigate(`/annotate/${selected}`);
    } catch (err) {
      alert(err.response?.data?.detail || "Could not claim task.");
    }
  };

  const handleLogout = () => {
    if (wsRef.current) wsRef.current.close();
    localStorage.clear();
    navigate("/login");
  };

  const getStatusBadge = (status) => {
    if (status === "in_progress") return (
      <span style={{ background: "#E8F4FD", color: "#0073BB",
        padding: "2px 8px", borderRadius: 2, fontSize: 12, fontWeight: 600 }}>
        ▶ In Progress
      </span>
    );
    if (status === "paused") return (
      <span style={{ background: "#FEF9E7", color: "#996300",
        padding: "2px 8px", borderRadius: 2, fontSize: 12, fontWeight: 600 }}>
        ⏸ Paused
      </span>
    );
    return (
      <span style={{ background: "#d5f5e3", color: "#1D8102",
        padding: "2px 8px", borderRadius: 2, fontSize: 12, fontWeight: 600 }}>
        Available
      </span>
    );
  };

  const selectedTask = tasks.find(t => t.id === selected);
  const isResumeTask = selectedTask?.status === "in_progress" || selectedTask?.status === "paused";

  return (
    <div style={{ minHeight: "100vh", background: "#F2F3F3", display: "flex", flexDirection: "column" }}>

      {/* Top Nav */}
      <div style={{ background: "#232F3E", padding: "6px 20px", color: "white",
        display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 13 }}>
        <span style={{ fontWeight: 700 }}>🏷️ AnnotateHub</span>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <span>Hello, <strong>{username}</strong></span>
          <button onClick={handleLogout}
            style={{ background: "transparent", border: "1px solid #aab7b8",
              color: "white", padding: "4px 12px", borderRadius: 2,
              fontSize: 12, cursor: "pointer" }}>
            Log out
          </button>
        </div>
      </div>

      <div style={{ maxWidth: 1100, margin: "24px auto", width: "100%", padding: "0 24px" }}>

        {/* Notification */}
        {notification && (
          <div style={{ background: "#F0F8FF", border: "1px solid #0073BB",
            borderLeft: "4px solid #0073BB", borderRadius: 2,
            padding: "10px 16px", marginBottom: 16, fontSize: 13 }}>
            ℹ️ {notification.message}
          </div>
        )}

        {/* Empty State */}
        {tasks.length === 0 && (
          <div style={{ background: "#F0F8FF", border: "1px solid #0073BB",
            borderLeft: "4px solid #0073BB", borderRadius: 2,
            padding: "12px 16px", marginBottom: 16, fontSize: 13 }}>
            <strong>No tasks available right now.</strong> Refresh to check for new jobs.
          </div>
        )}

        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between",
          alignItems: "center", marginBottom: 12 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: "#16191f" }}>
            Jobs ({tasks.length})
          </h2>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <button className="aws-btn-normal" onClick={fetchQueue}>🔄 Refresh</button>
            {selected ? (
              <button className="aws-btn-primary" onClick={handleStartWorking}>
                {isResumeTask ? "▶ Resume Task" : "Start working"}
              </button>
            ) : (
              <button style={{ background: "#D5DBDB", border: "none",
                padding: "6px 16px", borderRadius: 2, fontSize: 13,
                cursor: "not-allowed", color: "#687078" }} disabled>
                Start working
              </button>
            )}
          </div>
        </div>

        {/* Search */}
        <div style={{ marginBottom: 8 }}>
          <div style={{ position: "relative", width: 300 }}>
            <span style={{ position: "absolute", left: 10, top: 7, color: "#687078" }}>🔍</span>
            <input className="aws-input" style={{ paddingLeft: 32 }}
              placeholder="Search tasks"
              value={search}
              onChange={e => setSearch(e.target.value)} />
          </div>
        </div>

        {/* Table */}
        <div style={{ background: "white", border: "1px solid #D5DBDB", borderRadius: 2 }}>
          <table className="aws-table" style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={{ width: 40 }}></th>
                <th>Task Title</th>
                <th>Customer ID</th>
                <th>Status</th>
                <th>Created</th>
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
                tasks.map(task => {
                  const isMyTask = task.status === "in_progress" || task.status === "paused";
                  return (
                    <tr key={task.id}
                      style={{ cursor: "pointer",
                        background: selected === task.id ? "#F0F8FF"
                          : isMyTask ? "#FFFBF5" : "white" }}
                      onClick={() => setSelected(task.id)}>
                      <td style={{ textAlign: "center" }}>
                        <input type="radio" name="task"
                          checked={selected === task.id}
                          onChange={() => setSelected(task.id)}
                          style={{ accentColor: "#0073BB" }} />
                      </td>
                      <td>
                        <span className="aws-link">{task.title}</span>
                        {task.batch_name && (
                          <span style={{ marginLeft: 8, fontSize: 11,
                            background: "#E8F4FD", color: "#0073BB",
                            padding: "1px 6px", borderRadius: 2 }}>
                            {task.batch_name}
                          </span>
                        )}
                      </td>
                      <td style={{ color: "#687078" }}>{task.customer_id || "—"}</td>
                      <td>{getStatusBadge(task.status)}</td>
                      <td style={{ color: "#687078" }}>
                        {new Date(task.created_at).toLocaleDateString("en-US", {
                          month: "short", day: "numeric", year: "numeric"
                        })}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>

          <div style={{ borderTop: "1px solid #eaeded", padding: "8px 16px",
            display: "flex", justifyContent: "flex-end", gap: 8 }}>
            <button style={{ background: "none", border: "none", color: "#aab7b8", cursor: "pointer" }}>‹</button>
            <span style={{ fontSize: 13 }}>1</span>
            <button style={{ background: "none", border: "none", color: "#aab7b8", cursor: "pointer" }}>›</button>
          </div>
        </div>
      </div>
    </div>
  );
}