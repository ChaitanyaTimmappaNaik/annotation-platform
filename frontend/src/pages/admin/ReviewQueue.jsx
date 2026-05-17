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

export default function ReviewQueue() {
  const [tasks, setTasks] = useState([]);
  const [selected, setSelected] = useState(null);
  const [feedback, setFeedback] = useState("");
  const [loading, setLoading] = useState(true);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();
  const username = localStorage.getItem("username");

  useEffect(() => { fetchReviewQueue(); }, []);

  const fetchReviewQueue = async () => {
    setLoading(true);
    try {
      const res = await API.get("/annotations/review/queue");
      setTasks(res.data);
    } catch {}
    setLoading(false);
  };

  const handleReview = async (annotationId, decision) => {
    if (decision === "rejected" && !feedback.trim()) {
      setError("Please provide feedback when rejecting an annotation.");
      return;
    }
    try {
      await API.post(`/annotations/review/${annotationId}`, {
        decision,
        feedback: feedback.trim()
      });
      setSuccess(`Annotation ${decision} successfully!`);
      setSelected(null);
      setFeedback("");
      fetchReviewQueue();
    } catch (err) {
      setError(err.response?.data?.detail || "Could not submit review.");
    }
  };

  const handleLogout = () => { localStorage.clear(); navigate("/login"); };

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
      <AwsTopNav username={username} onLogout={handleLogout} />
      <div style={{ display: "flex", flex: 1 }}>
        <AwsSidebar active="Review Queue" />
        <div style={{ flex: 1, background: "#F2F3F3", padding: 24, overflowY: "auto" }}>

          <div style={{ fontSize: 12, color: "#687078", marginBottom: 16 }}>
            AnnotateHub &gt; <strong>Review Queue</strong>
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

          <div style={{ display: "flex", justifyContent: "space-between",
            alignItems: "center", marginBottom: 16 }}>
            <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>
              🔍 Review Queue ({tasks.length})
            </h1>
            <button className="aws-btn-normal" onClick={fetchReviewQueue}>
              🔄 Refresh
            </button>
          </div>

          {loading ? (
            <p style={{ color: "#687078" }}>Loading review queue...</p>
          ) : tasks.length === 0 ? (
            <div style={{ background: "white", border: "1px solid #D5DBDB",
              borderRadius: 2, padding: 48, textAlign: "center" }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
              <h2 style={{ fontSize: 18, fontWeight: 700, color: "#16191f" }}>
                All caught up!
              </h2>
              <p style={{ fontSize: 13, color: "#687078" }}>
                No annotations pending review.
              </p>
            </div>
          ) : (
            <div style={{ display: "grid", gap: 16 }}>
              {tasks.map(task => (
                <div key={task.annotation_id}
                  style={{ background: "white", border: "1px solid #D5DBDB",
                    borderRadius: 2, overflow: "hidden" }}>

                  {/* Task Header */}
                  <div style={{ padding: "12px 20px", background: "#FAFAFA",
                    borderBottom: "1px solid #D5DBDB",
                    display: "flex", justifyContent: "space-between",
                    alignItems: "center" }}>
                    <div>
                      <span style={{ fontWeight: 700, fontSize: 14 }}>{task.title}</span>
                      <span style={{ marginLeft: 12, background: "#E8F4FD",
                        color: "#0073BB", padding: "2px 8px",
                        borderRadius: 2, fontSize: 12 }}>
                        {task.project_name}
                      </span>
                      {task.customer_id && (
                        <span style={{ marginLeft: 8, color: "#687078", fontSize: 12 }}>
                          Customer: {task.customer_id}
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 12, color: "#687078" }}>
                      Submitted by <strong>{task.annotator_name}</strong> •{" "}
                      {new Date(task.submitted_at).toLocaleString()}
                    </div>
                  </div>

                  <div style={{ display: "grid",
                    gridTemplateColumns: "1fr 1fr", gap: 0 }}>

                    {/* Left - Document */}
                    <div style={{ padding: 20,
                      borderRight: "1px solid #D5DBDB" }}>
                      <h3 style={{ fontSize: 13, fontWeight: 700,
                        marginBottom: 8, marginTop: 0 }}>
                        Document Content
                      </h3>
                      <div style={{ background: "#F8F8F8",
                        border: "1px solid #eaeded", borderRadius: 2,
                        padding: 12, fontSize: 13, lineHeight: 1.8,
                        marginBottom: 12 }}>
                        {task.data_content || "No content"}
                      </div>
                      {task.instructions && (
                        <div style={{ fontSize: 12, color: "#687078" }}>
                          <strong>Instructions:</strong> {task.instructions}
                        </div>
                      )}
                    </div>

                    {/* Right - Annotations */}
                    <div style={{ padding: 20 }}>
                      <h3 style={{ fontSize: 13, fontWeight: 700,
                        marginBottom: 8, marginTop: 0 }}>
                        Submitted Annotations ({task.label_data?.spans?.length || 0} spans)
                      </h3>

                      {task.label_data?.spans?.length > 0 ? (
                        <div style={{ marginBottom: 12 }}>
                          {task.label_data.spans.map((span, i) => (
                            <div key={i} style={{ display: "flex",
                              alignItems: "center", gap: 8,
                              padding: "6px 0",
                              borderBottom: "1px solid #f5f5f5",
                              fontSize: 13 }}>
                              <span style={{ background: "#FF9900",
                                color: "black", padding: "2px 8px",
                                borderRadius: 2, fontSize: 11,
                                fontWeight: 700 }}>
                                {span.label}
                              </span>
                              <span style={{ color: "#16191f" }}>
                                "{span.text}"
                              </span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p style={{ fontSize: 13, color: "#687078" }}>
                          No spans labeled
                        </p>
                      )}

                      {task.notes && (
                        <div style={{ fontSize: 12, color: "#687078",
                          marginBottom: 12 }}>
                          <strong>Notes:</strong> {task.notes}
                        </div>
                      )}

                      {/* Review Actions */}
                      {selected === task.annotation_id ? (
                        <div>
                          <label style={{ fontSize: 12, fontWeight: 700,
                            display: "block", marginBottom: 4 }}>
                            Feedback (required for rejection)
                          </label>
                          <textarea
                            style={{ width: "100%", border: "1px solid #aab7b8",
                              borderRadius: 2, padding: "8px 10px",
                              fontSize: 13, marginBottom: 8,
                              resize: "vertical" }}
                            rows={3}
                            placeholder="Add feedback for the annotator..."
                            value={feedback}
                            onChange={e => setFeedback(e.target.value)}
                          />
                          <div style={{ display: "flex", gap: 8 }}>
                            <button onClick={() => handleReview(task.annotation_id, "approved")}
                              style={{ background: "#1D8102", color: "white",
                                border: "none", padding: "8px 16px",
                                borderRadius: 2, cursor: "pointer",
                                fontSize: 13, fontWeight: 700 }}>
                              ✅ Approve
                            </button>
                            <button onClick={() => handleReview(task.annotation_id, "rejected")}
                              style={{ background: "#D13212", color: "white",
                                border: "none", padding: "8px 16px",
                                borderRadius: 2, cursor: "pointer",
                                fontSize: 13, fontWeight: 700 }}>
                              ❌ Reject
                            </button>
                            <button onClick={() => { setSelected(null); setFeedback(""); }}
                              className="aws-btn-normal">
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          onClick={() => { setSelected(task.annotation_id); setFeedback(""); setError(""); }}
                          className="aws-btn-primary"
                          style={{ marginTop: 8 }}>
                          Start Review
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}