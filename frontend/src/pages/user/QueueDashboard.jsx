import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import API from "../../api/client";

export default function QueueDashboard() {
  const [batches, setBatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notification, setNotification] = useState(null);
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
      // Get batches assigned to this user with their progress
      const res = await API.get(`/batches/user-batches`);
      setBatches(res.data);
    } catch {}
    setLoading(false);
  };

  const handleStartBatch = async (batch) => {
    try {
      // Get first pending task for this user in this batch
      const res = await API.get(`/batches/next-task/${batch.id}`);
      if (res.data.completed) {
        alert("🎉 You have completed all tasks in this batch!");
        return;
      }
      const { task_id, dataset_object_id } = res.data;
      // Clear old timer
      localStorage.removeItem(`timer_${task_id}`);
      localStorage.removeItem(`timer_${task_id}_savedAt`);
      // Claim the task
      await API.post(`/tasks/${task_id}/claim`);
      // Navigate to annotation workspace
      navigate(
        `/annotate/${task_id}?batch_id=${batch.id}&dataset_object_id=${dataset_object_id}`
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

  const getStatusColor = (status) => {
    if (status === "completed") return { bg: "#d5f5e3", color: "#1D8102" };
    if (status === "in_progress") return { bg: "#E8F4FD", color: "#0073BB" };
    if (status === "paused") return { bg: "#FEF9E7", color: "#996300" };
    return { bg: "#eaeded", color: "#687078" };
  };

  return (
    <div style={{ minHeight: "100vh", background: "#F2F3F3",
      display: "flex", flexDirection: "column" }}>

      {/* Top Nav */}
      <div style={{ background: "#232F3E", padding: "6px 20px",
        color: "white", display: "flex", alignItems: "center",
        justifyContent: "space-between", fontSize: 13 }}>
        <span style={{ fontWeight: 700 }}>🏷️ AnnotateHub</span>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <span>Hello, <strong>{username}</strong></span>
          <button onClick={handleLogout}
            style={{ background: "transparent",
              border: "1px solid #aab7b8", color: "white",
              padding: "4px 12px", borderRadius: 2,
              fontSize: 12, cursor: "pointer" }}>
            Log out
          </button>
        </div>
      </div>

      <div style={{ maxWidth: 900, margin: "32px auto",
        width: "100%", padding: "0 24px" }}>

        {/* Notification */}
        {notification && (
          <div style={{ background: "#F0F8FF",
            border: "1px solid #0073BB",
            borderLeft: "4px solid #0073BB", borderRadius: 2,
            padding: "10px 16px", marginBottom: 16, fontSize: 13 }}>
            ℹ️ {notification}
          </div>
        )}

        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between",
          alignItems: "center", marginBottom: 24 }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700,
              color: "#16191f", margin: 0 }}>
              My Annotation Queue
            </h1>
            <p style={{ fontSize: 13, color: "#687078", margin: "4px 0 0" }}>
              Select a batch to start annotating tasks
            </p>
          </div>
          <button onClick={fetchBatches}
            style={{ background: "white", border: "1px solid #D5DBDB",
              padding: "8px 16px", borderRadius: 2,
              fontSize: 13, cursor: "pointer" }}>
            🔄 Refresh
          </button>
        </div>

        {loading ? (
          <div style={{ textAlign: "center", padding: 60,
            color: "#687078" }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>⏳</div>
            <p>Loading your batches...</p>
          </div>
        ) : batches.length === 0 ? (
          <div style={{ background: "white",
            border: "1px solid #D5DBDB", borderRadius: 4,
            padding: 60, textAlign: "center" }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>📭</div>
            <h2 style={{ fontSize: 18, fontWeight: 700,
              color: "#16191f", margin: "0 0 8px" }}>
              No batches assigned yet
            </h2>
            <p style={{ fontSize: 13, color: "#687078" }}>
              Your admin will assign annotation batches to you.
              Check back later or click Refresh.
            </p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {batches.map(batch => {
              const pct = batch.total > 0
                ? Math.round((batch.completed / batch.total) * 100)
                : 0;
              const isComplete = batch.completed >= batch.total && batch.total > 0;
              const hasInProgress = batch.in_progress > 0;

              return (
                <div key={batch.id}
                  style={{ background: "white",
                    border: "1px solid #D5DBDB",
                    borderRadius: 4, overflow: "hidden",
                    boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>

                  {/* Batch Header */}
                  <div style={{ padding: "16px 20px",
                    borderBottom: "1px solid #eaeded",
                    display: "flex", justifyContent: "space-between",
                    alignItems: "center",
                    background: isComplete ? "#FAFFF9" : "white" }}>
                    <div style={{ display: "flex",
                      alignItems: "center", gap: 12 }}>
                      <div style={{ width: 40, height: 40,
                        borderRadius: "50%",
                        background: isComplete ? "#d5f5e3" : "#E8F4FD",
                        display: "flex", alignItems: "center",
                        justifyContent: "center", fontSize: 18 }}>
                        {isComplete ? "✅" : hasInProgress ? "▶️" : "📋"}
                      </div>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 15,
                          color: "#16191f" }}>
                          {batch.name}
                        </div>
                        <div style={{ fontSize: 12, color: "#687078",
                          marginTop: 2 }}>
                          {batch.project_name} •{" "}
                          {batch.total} tasks •{" "}
                          {batch.required_annotators || 3} annotators per task
                        </div>
                      </div>
                    </div>

                    <div style={{ display: "flex",
                      alignItems: "center", gap: 16 }}>
                      {/* Stats */}
                      <div style={{ textAlign: "right", fontSize: 12 }}>
                        <div style={{ fontWeight: 700, fontSize: 16,
                          color: isComplete ? "#1D8102" : "#0073BB" }}>
                          {batch.completed}/{batch.total}
                        </div>
                        <div style={{ color: "#687078" }}>completed</div>
                      </div>

                      {/* Action Button */}
                      {isComplete ? (
                        <div style={{ background: "#d5f5e3",
                          color: "#1D8102", padding: "8px 20px",
                          borderRadius: 2, fontSize: 13,
                          fontWeight: 700 }}>
                          ✅ Complete
                        </div>
                      ) : (
                        <button onClick={() => handleStartBatch(batch)}
                          style={{ background: "#FF9900",
                            border: "1px solid #EC7211",
                            color: "black", padding: "8px 20px",
                            borderRadius: 2, fontSize: 13,
                            fontWeight: 700, cursor: "pointer",
                            whiteSpace: "nowrap" }}>
                          {hasInProgress ? "▶ Continue" : "▶ Start working"}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div style={{ padding: "12px 20px",
                    background: "#FAFAFA" }}>
                    <div style={{ display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center", marginBottom: 6 }}>
                      <span style={{ fontSize: 12, color: "#687078" }}>
                        Progress
                      </span>
                      <span style={{ fontSize: 12, fontWeight: 700,
                        color: isComplete ? "#1D8102" : "#0073BB" }}>
                        {pct}%
                      </span>
                    </div>
                    <div style={{ background: "#D5DBDB",
                      borderRadius: 4, height: 8 }}>
                      <div style={{
                        width: `${pct}%`,
                        background: isComplete ? "#1D8102" : "#FF9900",
                        borderRadius: 4, height: 8,
                        transition: "width 0.3s"
                      }} />
                    </div>

                    {/* Task pills */}
                    <div style={{ display: "flex", gap: 6,
                      marginTop: 10, flexWrap: "wrap" }}>
                      {batch.task_statuses?.map((t, i) => (
                        <div key={i} title={t.title}
                          style={{ width: 28, height: 28,
                            borderRadius: "50%", fontSize: 11,
                            display: "flex", alignItems: "center",
                            justifyContent: "center", fontWeight: 700,
                            cursor: "default",
                            background:
                              t.status === "completed" ? "#1D8102" :
                              t.status === "in_progress" ? "#0073BB" :
                              "#D5DBDB",
                            color:
                              t.status === "completed" ||
                              t.status === "in_progress"
                                ? "white" : "#687078" }}>
                          {i + 1}
                        </div>
                      ))}
                    </div>

                    {/* Bottom info row */}
                    <div style={{ display: "flex", gap: 16,
                      marginTop: 10, fontSize: 11 }}>
                      <span style={{ color: "#687078" }}>
                        ⏱ {Math.floor((batch.time_limit || 1800) / 60)} min/task
                      </span>
                      {batch.remaining > 0 && (
                        <span style={{ color: "#687078" }}>
                          📝 {batch.remaining} task{batch.remaining !== 1 ? "s" : ""} remaining
                        </span>
                      )}
                      {hasInProgress && (
                        <span style={{ color: "#0073BB", fontWeight: 600 }}>
                          ▶ 1 task in progress
                        </span>
                      )}
                      {isComplete && (
                        <span style={{ color: "#1D8102", fontWeight: 600 }}>
                          🎉 All tasks completed!
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}