import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import API from "../../api/client";

export default function QueueDashboard() {
  const [batches, setBatches] = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notification, setNotification] = useState(null);
  const [showInstructions, setShowInstructions] = useState(false);
  const wsRef = useRef(null);
  const username = localStorage.getItem("username");
  const userId = parseInt(localStorage.getItem("user_id") || "0");
  const navigate = useNavigate();

  useEffect(() => {
    fetchBatches();
    connectWebSocket();
    return () => { if (wsRef.current) wsRef.current.close(); };
  }, []);

  const connectWebSocket = () => {
    try {
      const ws = new WebSocket(
        `wss://annotation-platform-m7im.onrender.com/batches/ws/${userId}`
      );
      wsRef.current = ws;
      ws.onmessage = (event) => {
        const msg = JSON.parse(event.data);
        if (msg.type === "batch_assigned") {
          setNotification(msg.message);
          fetchBatches();
        }
        setTimeout(() => setNotification(null), 5000);
      };
      ws.onclose = () => setTimeout(connectWebSocket, 3000);
      ws.onerror = () => {};
    } catch {}
  };

  const fetchBatches = async () => {
    setLoading(true);
    try {
      const res = await API.get("/batches/user-batches");
      setBatches(res.data);
    } catch {}
    setLoading(false);
  };

  const handleStartWorking = async () => {
    if (!selected) return;
    const batch = batches.find(b => b.id === selected);
    if (!batch) return;

    if (batch.completed >= batch.total && batch.total > 0) {
      alert("🎉 You have completed all tasks in this batch!");
      return;
    }

    try {
      const res = await API.get(`/batches/next-task/${batch.id}`);
      if (res.data.completed) {
        alert("🎉 All tasks in this batch are completed!");
        fetchBatches();
        return;
      }
      const { task_id, dataset_object_id } = res.data;
      localStorage.removeItem(`timer_${task_id}`);
      localStorage.removeItem(`timer_${task_id}_savedAt`);
      await API.post(`/tasks/${task_id}/claim`);
      navigate(
        `/annotate/${task_id}?batch_id=${batch.id}&dataset_object_id=${dataset_object_id || 0}`
      );
    } catch (err) {
      alert(err.response?.data?.detail || "Could not start batch.");
    }
  };

  const handleLogout = () => {
    if (wsRef.current) wsRef.current.close();
    localStorage.clear();
    navigate("/login");
  };

  const selectedBatch = batches.find(b => b.id === selected);
  const isComplete = selectedBatch &&
    selectedBatch.completed >= selectedBatch.total &&
    selectedBatch.total > 0;

  const getStatusBadge = (batch) => {
    const pct = batch.total > 0
      ? Math.round((batch.completed / batch.total) * 100) : 0;
    if (batch.completed >= batch.total && batch.total > 0) {
      return (
        <span style={{ background: "#d5f5e3", color: "#1D8102",
          padding: "2px 10px", borderRadius: 2,
          fontSize: 13, fontWeight: 600 }}>
          Completed
        </span>
      );
    }
    if (batch.in_progress > 0 || batch.completed > 0) {
      return (
        <span style={{ background: "#E8F4FD", color: "#0073BB",
          padding: "2px 10px", borderRadius: 2,
          fontSize: 13, fontWeight: 600 }}>
          In Progress ({pct}%)
        </span>
      );
    }
    return (
      <span style={{ background: "#eaeded", color: "#687078",
        padding: "2px 10px", borderRadius: 2,
        fontSize: 13, fontWeight: 600 }}>
        Available
      </span>
    );
  };

  return (
    <div style={{ minHeight: "100vh", background: "#f5f5f5",
      display: "flex", flexDirection: "column" }}>

      {/* Top Nav — matches production interface */}
      <div style={{ background: "white",
        borderBottom: "1px solid #e0e0e0",
        padding: "8px 24px", display: "flex",
        alignItems: "center", justifyContent: "space-between",
        fontSize: 13 }}>
        <span style={{ fontWeight: 600, color: "#16191f" }}>
          Hello, <strong>{username}</strong>
        </span>
        <button onClick={handleLogout}
          style={{ background: "white", border: "1px solid #aab7b8",
            color: "#16191f", padding: "5px 16px", borderRadius: 4,
            fontSize: 13, cursor: "pointer" }}>
          Log out
        </button>
      </div>

      <div style={{ maxWidth: 1100, margin: "0 auto",
        width: "100%", padding: "24px" }}>

        {/* Notification */}
        {notification && (
          <div style={{ background: "#e8f4fd",
            border: "1px solid #0073BB", borderRadius: 4,
            padding: "10px 16px", marginBottom: 16, fontSize: 13 }}>
            ℹ️ {notification}
          </div>
        )}

        {/* Main Queue Card */}
        <div style={{ background: "white", borderRadius: 8,
          border: "1px solid #e0e0e0",
          boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>

          {/* Card Header */}
          <div style={{ padding: "16px 24px",
            borderBottom: "1px solid #e0e0e0",
            display: "flex", justifyContent: "space-between",
            alignItems: "center" }}>
            <h2 style={{ fontSize: 18, fontWeight: 700,
              color: "#16191f", margin: 0 }}>
              Jobs ({batches.length})
            </h2>
            <div style={{ display: "flex",
              alignItems: "center", gap: 16 }}>
              {/* Show instructions toggle */}
              <label style={{ display: "flex", alignItems: "center",
                gap: 8, fontSize: 13, cursor: "pointer",
                color: "#16191f" }}>
                <div onClick={() => setShowInstructions(!showInstructions)}
                  style={{ width: 36, height: 20, borderRadius: 10,
                    background: showInstructions ? "#0073BB" : "#aab7b8",
                    position: "relative", cursor: "pointer",
                    transition: "background 0.2s" }}>
                  <div style={{ width: 16, height: 16, borderRadius: "50%",
                    background: "white", position: "absolute",
                    top: 2, transition: "left 0.2s",
                    left: showInstructions ? 18 : 2 }} />
                </div>
                Show instructions
              </label>

              {/* Start working button */}
              {selected && !isComplete ? (
                <button onClick={handleStartWorking}
                  style={{ background: "#FF9900",
                    border: "1px solid #EC7211",
                    color: "black", padding: "7px 20px",
                    borderRadius: 4, fontSize: 13,
                    fontWeight: 700, cursor: "pointer" }}>
                  Start working
                </button>
              ) : selected && isComplete ? (
                <button disabled
                  style={{ background: "#d5f5e3",
                    border: "1px solid #1D8102",
                    color: "#1D8102", padding: "7px 20px",
                    borderRadius: 4, fontSize: 13,
                    fontWeight: 700, cursor: "not-allowed" }}>
                  ✅ Completed
                </button>
              ) : (
                <button disabled
                  style={{ background: "#f5f5f5",
                    border: "1px solid #D5DBDB",
                    color: "#aab7b8", padding: "7px 20px",
                    borderRadius: 4, fontSize: 13,
                    cursor: "not-allowed" }}>
                  Start working
                </button>
              )}
            </div>
          </div>

          {/* Pagination row */}
          <div style={{ padding: "8px 24px",
            borderBottom: "1px solid #e0e0e0",
            display: "flex", justifyContent: "flex-end",
            alignItems: "center", gap: 8 }}>
            <button style={{ background: "none", border: "none",
              color: "#aab7b8", cursor: "pointer",
              fontSize: 16, padding: "0 4px" }}>‹</button>
            <span style={{ fontSize: 13, color: "#16191f" }}>1</span>
            <button style={{ background: "none", border: "none",
              color: "#aab7b8", cursor: "pointer",
              fontSize: 16, padding: "0 4px" }}>›</button>
          </div>

          {/* Table */}
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "2px solid #e0e0e0" }}>
                <th style={{ width: 50, padding: "10px 16px" }}></th>
                <th style={{ padding: "10px 16px", textAlign: "left",
                  fontSize: 13, fontWeight: 700, color: "#16191f" }}>
                  Task title ▽
                </th>
                <th style={{ padding: "10px 16px", textAlign: "left",
                  fontSize: 13, fontWeight: 700, color: "#16191f" }}>
                  Customer ID ▽
                </th>
                <th style={{ padding: "10px 16px", textAlign: "left",
                  fontSize: 13, fontWeight: 700, color: "#16191f" }}>
                  Status ▽
                </th>
                <th style={{ padding: "10px 16px", textAlign: "left",
                  fontSize: 13, fontWeight: 700, color: "#16191f" }}>
                  Creation time ▽
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="5" style={{ textAlign: "center",
                    padding: 48, color: "#687078" }}>
                    Loading...
                  </td>
                </tr>
              ) : batches.length === 0 ? (
                <tr>
                  <td colSpan="5" style={{ textAlign: "center",
                    padding: 48, color: "#687078" }}>
                    <div style={{ fontSize: 32, marginBottom: 12 }}>📭</div>
                    <p style={{ fontWeight: 600 }}>No batches assigned yet</p>
                    <p style={{ fontSize: 12 }}>
                      Your admin will assign annotation batches to you.
                    </p>
                  </td>
                </tr>
              ) : (
                batches.map(batch => {
                  const isSelected = selected === batch.id;
                  const pct = batch.total > 0
                    ? Math.round((batch.completed / batch.total) * 100)
                    : 0;

                  return (
                    <tr key={batch.id}
                      onClick={() => setSelected(batch.id)}
                      style={{ cursor: "pointer",
                        borderBottom: "1px solid #f0f0f0",
                        background: isSelected ? "#e8f4fd" : "white",
                        borderLeft: isSelected
                          ? "3px solid #0073BB"
                          : "3px solid transparent" }}>

                      {/* Radio */}
                      <td style={{ padding: "14px 16px",
                        textAlign: "center" }}>
                        <div style={{ width: 18, height: 18,
                          borderRadius: "50%",
                          border: isSelected
                            ? "5px solid #0073BB"
                            : "2px solid #aab7b8",
                          background: "white",
                          margin: "0 auto" }} />
                      </td>

                      {/* Batch name as task title */}
                      <td style={{ padding: "14px 16px" }}>
                        <div style={{ fontWeight: 600, fontSize: 14,
                          color: "#0073BB" }}>
                          {batch.name}
                        </div>
                        {showInstructions && (
                          <div style={{ fontSize: 11,
                            color: "#687078", marginTop: 4 }}>
                            {batch.total} tasks •{" "}
                            {batch.completed} completed •{" "}
                            {batch.remaining} remaining
                          </div>
                        )}
                        {/* Mini progress bar */}
                        {batch.total > 0 && (
                          <div style={{ marginTop: 6,
                            background: "#e0e0e0",
                            borderRadius: 2, height: 3,
                            width: 200 }}>
                            <div style={{
                              width: `${pct}%`,
                              background: pct === 100
                                ? "#1D8102" : "#FF9900",
                              borderRadius: 2, height: 3,
                              transition: "width 0.3s"
                            }} />
                          </div>
                        )}
                      </td>

                      {/* Customer ID */}
                      <td style={{ padding: "14px 16px",
                        fontSize: 13, color: "#16191f" }}>
                        977099032732
                      </td>

                      {/* Status */}
                      <td style={{ padding: "14px 16px" }}>
                        {getStatusBadge(batch)}
                      </td>

                      {/* Creation time */}
                      <td style={{ padding: "14px 16px",
                        fontSize: 13, color: "#687078" }}>
                        {new Date(batch.created_at ||
                          Date.now()).toLocaleDateString("en-US", {
                          month: "short", day: "numeric",
                          year: "numeric",
                          hour: "2-digit", minute: "2-digit"
                        })} UTC
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>

          {/* Bottom pagination */}
          <div style={{ padding: "10px 24px",
            borderTop: "1px solid #e0e0e0",
            display: "flex", justifyContent: "flex-end",
            alignItems: "center", gap: 8 }}>
            <button style={{ background: "none", border: "none",
              color: "#aab7b8", cursor: "pointer",
              fontSize: 16, padding: "0 4px" }}>‹</button>
            <span style={{ fontSize: 13 }}>1</span>
            <button style={{ background: "none", border: "none",
              color: "#aab7b8", cursor: "pointer",
              fontSize: 16, padding: "0 4px" }}>›</button>
          </div>
        </div>

        {/* Bottom hint */}
        <p style={{ fontSize: 12, color: "#aab7b8",
          textAlign: "center", marginTop: 16 }}>
          Select a batch and click "Start working" to begin annotating tasks
        </p>
      </div>
    </div>
  );
}