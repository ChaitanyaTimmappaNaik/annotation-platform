import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import API from "../../api/client";

// Get saved time BEFORE component renders
function getSavedTime(taskId) {
  const savedTime = localStorage.getItem(`timer_${taskId}`);
  const savedAt = localStorage.getItem(`timer_${taskId}_savedAt`);
  if (savedTime && savedAt) {
    const elapsed = Math.floor((Date.now() - parseInt(savedAt)) / 1000);
    const remaining = parseInt(savedTime) - elapsed;
    return remaining > 0 ? remaining : 0;
  }
  return 29 * 60 + 59;
}

export default function AnnotationWorkspace() {
  const { taskId } = useParams();
  const [task, setTask] = useState(null);
  const [labels, setLabels] = useState([]);
  const [selectedText, setSelectedText] = useState(null);
  const [notes, setNotes] = useState("");
  const [showInstructions, setShowInstructions] = useState(false);
  const [timeLeft, setTimeLeft] = useState(() => getSavedTime(taskId));
  const [activeTab, setActiveTab] = useState("annotations");
  const timerRef = useRef(null);
  const navigate = useNavigate();
  const username = localStorage.getItem("username");

  useEffect(() => {
    loadTask();

    // Start timer from saved time
    const initialTime = getSavedTime(taskId);
    setTimeLeft(initialTime);

    clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        const next = prev - 1;
        // Save every second with current timestamp
        localStorage.setItem(`timer_${taskId}`, next);
        localStorage.setItem(`timer_${taskId}_savedAt`, Date.now().toString());
        if (next <= 0) {
          clearInterval(timerRef.current);
          return 0;
        }
        return next;
      });
    }, 1000);

    return () => clearInterval(timerRef.current);
  }, [taskId]);

  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${String(s).padStart(2, "0")}`;
  };

  const loadTask = async () => {
    try {
      const res = await API.get(`/tasks/${taskId}`);
      setTask(res.data);
    } catch {
      alert("Could not load task");
      navigate("/queue");
    }
  };

  const handleTextSelection = () => {
    const selection = window.getSelection();
    if (!selection.toString().trim()) return;
    setSelectedText({ text: selection.toString().trim() });
  };

  const addLabel = (labelName) => {
    if (!selectedText) return;
    setLabels(prev => [...prev, { ...selectedText, label: labelName }]);
    setSelectedText(null);
    window.getSelection().removeAllRanges();
  };

  const removeLabel = (index) => setLabels(prev => prev.filter((_, i) => i !== index));

  const handleDeclineTask = async () => {
    if (!confirm("Decline this task? It will be returned to the queue.")) return;
    localStorage.removeItem(`timer_${taskId}`);
    localStorage.removeItem(`timer_${taskId}_savedAt`);
    try { await API.put(`/tasks/${taskId}/release`); } catch {}
    clearInterval(timerRef.current);
    navigate("/queue");
  };

  const handleReleaseTask = async () => {
    if (!confirm("Release this task? It will be available for others.")) return;
    localStorage.removeItem(`timer_${taskId}`);
    localStorage.removeItem(`timer_${taskId}_savedAt`);
    try { await API.put(`/tasks/${taskId}/release`); } catch {}
    clearInterval(timerRef.current);
    navigate("/queue");
  };

  const handleStopResume = () => {
    // Save EXACT current time + when we saved it
    localStorage.setItem(`timer_${taskId}`, timeLeft.toString());
    localStorage.setItem(`timer_${taskId}_savedAt`, Date.now().toString());
    clearInterval(timerRef.current);
    navigate("/queue");
  };

  const handleSaveAnnotation = async () => {
    if (labels.length === 0) { alert("Please add at least one label."); return; }
    try {
      const timeSpent = (29 * 60 + 59) - timeLeft;
      await API.post(`/annotations/tasks/${taskId}`, {
        label_data: { spans: labels }, notes, time_spent: timeSpent
      });
      alert("Annotations saved!");
    } catch { alert("Could not save."); }
  };

  const handleSubmitTask = async () => {
    if (labels.length === 0) { alert("Please add at least one label."); return; }
    try {
      const timeSpent = (29 * 60 + 59) - timeLeft;
      await API.post(`/annotations/tasks/${taskId}`, {
        label_data: { spans: labels }, notes, time_spent: timeSpent
      });
      localStorage.removeItem(`timer_${taskId}`);
      localStorage.removeItem(`timer_${taskId}_savedAt`);
      clearInterval(timerRef.current);
      alert("Task submitted successfully!");
      navigate("/queue");
    } catch { alert("Could not submit."); }
  };

  if (!task) return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <p style={{ color: "#687078" }}>Loading task...</p>
    </div>
  );

  const ontologyLabels = task.ontology?.labels || ["PER", "ORG", "LOC", "DATE", "MISC"];
  const isUrgent = timeLeft < 5 * 60;

  return (
    <div style={{ minHeight: "100vh", background: "white", display: "flex", flexDirection: "column" }}>

      {/* Top Header */}
      <div style={{ background: "#232F3E", color: "white", padding: "6px 20px",
        display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16, fontSize: 12, flexWrap: "wrap" }}>
          <span>Hello, <strong>{username}</strong></span>
          <span style={{ color: "#aab7b8" }}>|</span>
          <span>Customer ID: <strong>{task.customer_id || "—"}</strong></span>
          <span style={{ color: "#aab7b8" }}>|</span>
          <span>Task: <strong>{task.title}</strong></span>
          <span style={{ color: "#aab7b8" }}>|</span>
          <span style={{ fontWeight: 700, color: isUrgent ? "#ff6b6b" : "#FF9900" }}>
            ⏱ {formatTime(timeLeft)}
          </span>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {[
            { label: "Decline task", action: handleDeclineTask },
            { label: "Release task", action: handleReleaseTask },
            { label: "Stop and resume later", action: handleStopResume },
          ].map(btn => (
            <button key={btn.label} onClick={btn.action}
              style={{ background: "transparent", border: "1px solid #aab7b8",
                color: "white", padding: "4px 10px", borderRadius: 2,
                fontSize: 11, cursor: "pointer", whiteSpace: "nowrap" }}>
              {btn.label}
            </button>
          ))}
        </div>
      </div>

      {/* Instructions Bar */}
      <div style={{ background: "#F2F3F3", borderBottom: "1px solid #D5DBDB",
        padding: "6px 20px", display: "flex", alignItems: "center", gap: 12 }}>
        <button style={{ color: "#0073BB", fontSize: 13, fontWeight: 700,
          background: "none", border: "none", cursor: "pointer" }}
          onClick={() => setShowInstructions(!showInstructions)}>
          {showInstructions ? "Hide instructions" : "View instructions"}
        </button>
        {showInstructions && (
          <span style={{ fontSize: 13, color: "#16191f",
            borderLeft: "1px solid #D5DBDB", paddingLeft: 12 }}>
            {task.instructions || "No instructions provided."}
          </span>
        )}
      </div>

      {/* Main Body */}
      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>

        {/* Left - Document */}
        <div style={{ flex: 1, padding: 24, overflowY: "auto", borderRight: "1px solid #D5DBDB" }}>
          <div style={{ display: "flex", justifyContent: "space-between",
            alignItems: "flex-start", marginBottom: 16 }}>
            <div>
              <h2 style={{ fontSize: 16, fontWeight: 700, color: "#16191f", margin: 0 }}>
                Document Annotation Task
              </h2>
              <p style={{ fontSize: 12, color: "#687078", marginTop: 4 }}>
                Select text in the document below to add labels
              </p>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={handleSaveAnnotation}
                style={{ background: "white", border: "1px solid #0073BB",
                  color: "#0073BB", padding: "6px 16px", borderRadius: 2,
                  fontSize: 13, cursor: "pointer" }}>
                Save Annotations
              </button>
              <button onClick={handleSubmitTask}
                style={{ background: "#FF9900", border: "1px solid #EC7211",
                  color: "black", padding: "6px 16px", borderRadius: 2,
                  fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                Submit Task
              </button>
            </div>
          </div>

          {/* Document Text */}
          <div onMouseUp={handleTextSelection}
            style={{ padding: 16, background: "#FAFAFA", border: "1px solid #D5DBDB",
              borderRadius: 2, fontSize: 14, lineHeight: 2, color: "#16191f",
              userSelect: "text", cursor: "text", minHeight: 200 }}>
            {task.data_content || "No content available."}
          </div>

          {/* Label Picker */}
          {selectedText && (
            <div style={{ marginTop: 12, background: "#FEF9E7",
              border: "1px solid #FF9900", borderRadius: 2, padding: 12 }}>
              <p style={{ fontSize: 13, fontWeight: 700, margin: "0 0 8px" }}>
                Selected: "<em style={{ color: "#0073BB" }}>{selectedText.text}</em>" — Choose a label:
              </p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
                {ontologyLabels.map(label => (
                  <button key={label} onClick={() => addLabel(label)}
                    style={{ background: "#FF9900", border: "1px solid #EC7211",
                      color: "black", padding: "4px 12px", borderRadius: 2,
                      fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                    {label}
                  </button>
                ))}
                <button onClick={() => setSelectedText(null)}
                  style={{ background: "white", border: "1px solid #D5DBDB",
                    color: "#687078", padding: "4px 12px", borderRadius: 2,
                    fontSize: 12, cursor: "pointer" }}>
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Labeled Spans */}
          {labels.length > 0 && (
            <div style={{ marginTop: 12, border: "1px solid #D5DBDB", borderRadius: 2, background: "white" }}>
              <div style={{ padding: "8px 16px", background: "#FAFAFA", borderBottom: "1px solid #D5DBDB" }}>
                <strong style={{ fontSize: 13 }}>Labeled Spans ({labels.length})</strong>
              </div>
              {labels.map((l, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center",
                  gap: 8, padding: "8px 16px", borderBottom: "1px solid #eaeded", fontSize: 13 }}>
                  <span style={{ background: "#FF9900", color: "black",
                    padding: "2px 8px", borderRadius: 2, fontSize: 11, fontWeight: 700 }}>
                    {l.label}
                  </span>
                  <span style={{ color: "#16191f", flex: 1 }}>"{l.text}"</span>
                  <button onClick={() => removeLabel(i)}
                    style={{ background: "none", border: "none",
                      color: "#D13212", cursor: "pointer", fontSize: 16, fontWeight: 700 }}>×</button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right Panel */}
        <div style={{ width: 300, background: "#FAFAFA", display: "flex", flexDirection: "column" }}>
          <div style={{ padding: "12px 16px", borderBottom: "1px solid #D5DBDB", background: "white" }}>
            <p style={{ fontSize: 13, fontWeight: 700, margin: 0 }}>
              Total Annotations: <span style={{ color: "#0073BB" }}>{labels.length}</span>
            </p>
          </div>

          <div style={{ display: "flex", borderBottom: "1px solid #D5DBDB", background: "white" }}>
            {["annotations", "labelform"].map(tab => (
              <button key={tab} onClick={() => setActiveTab(tab)}
                style={{ flex: 1, padding: "10px 0", fontSize: 13,
                  fontWeight: activeTab === tab ? 700 : 400,
                  background: "none", border: "none", cursor: "pointer",
                  borderBottom: activeTab === tab ? "2px solid #FF9900" : "2px solid transparent",
                  color: activeTab === tab ? "#16191f" : "#687078" }}>
                {tab === "annotations" ? "Annotations" : "Label Form"}
              </button>
            ))}
          </div>

          <div style={{ flex: 1, overflowY: "auto", padding: 12 }}>
            {activeTab === "annotations" ? (
              labels.length === 0 ? (
                <p style={{ fontSize: 12, color: "#687078", textAlign: "center", padding: "24px 0" }}>
                  Select text to add annotations
                </p>
              ) : (
                labels.map((l, i) => (
                  <div key={i} style={{ background: "white", border: "1px solid #D5DBDB",
                    borderRadius: 2, padding: 12, marginBottom: 8, fontSize: 12 }}>
                    <p style={{ fontWeight: 700, color: "#16191f", margin: "0 0 6px", wordBreak: "break-word" }}>
                      "{l.text}"
                    </p>
                    <div style={{ color: "#687078" }}>
                      label: <span style={{ color: "#FF9900", fontWeight: 700 }}>{l.label}</span>
                    </div>
                  </div>
                ))
              )
            ) : (
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, display: "block", marginBottom: 4 }}>
                  Notes (optional)
                </label>
                <textarea
                  style={{ width: "100%", border: "1px solid #aab7b8", borderRadius: 2,
                    padding: "8px 10px", fontSize: 12, marginBottom: 12, resize: "vertical", height: 100 }}
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="Add annotation notes..."
                />
                <button onClick={handleSubmitTask}
                  style={{ width: "100%", background: "#FF9900", border: "1px solid #EC7211",
                    color: "black", padding: "8px 0", borderRadius: 2,
                    fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                  Submit Task
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}