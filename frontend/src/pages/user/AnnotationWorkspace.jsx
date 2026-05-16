import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import API from "../../api/client";

export default function AnnotationWorkspace() {
  const { taskId } = useParams();
  const [task, setTask] = useState(null);
  const [labels, setLabels] = useState([]);
  const [selectedText, setSelectedText] = useState(null);
  const [notes, setNotes] = useState("");
  const [showInstructions, setShowInstructions] = useState(false);
  const [timeLeft, setTimeLeft] = useState(29 * 60 + 59);
  const [activeTab, setActiveTab] = useState("annotations");
  const [submitted, setSubmitted] = useState(false);
  const timerRef = useRef(null);
  const navigate = useNavigate();
  const username = localStorage.getItem("username");

  useEffect(() => {
    loadTask();
    startTimer();
    const releaseOnLeave = () => {
      if (!submitted) {
        navigator.sendBeacon(`http://127.0.0.1:8000/tasks/${taskId}/release`);
      }
    };
    window.addEventListener("beforeunload", releaseOnLeave);
    return () => {
      clearInterval(timerRef.current);
      window.removeEventListener("beforeunload", releaseOnLeave);
    };
  }, [taskId]);

  const startTimer = () => {
    clearInterval(timerRef.current);
    setTimeLeft(29 * 60 + 59);
    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 0) { clearInterval(timerRef.current); handleTimeExpired(); return 0; }
        return prev - 1;
      });
    }, 1000);
  };

  const handleTimeExpired = async () => {
    alert("Time expired! Task will be released back to the queue.");
    try { await API.put(`/tasks/${taskId}/release`); } catch {}
    navigate("/queue");
  };

  const formatTime = (seconds) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
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

  const releaseAndGo = async () => {
    try { await API.put(`/tasks/${taskId}/release`); } catch {}
    clearInterval(timerRef.current);
    navigate("/queue");
  };

  const handleDeclineTask = async () => {
    if (!confirm("Decline this task? It will be returned to the queue.")) return;
    releaseAndGo();
  };

  const handleReleaseTask = async () => {
    if (!confirm("Release this task? It will be available for others.")) return;
    releaseAndGo();
  };

  const handleSkipTask = () => releaseAndGo();

  const handleStopResume = async () => {
    if (!confirm("Stop and resume later?")) return;
    releaseAndGo();
  };

  const handleSaveAnnotation = async () => {
    if (labels.length === 0) { alert("Please add at least one label."); return; }
    try {
      await API.post(`/annotations/tasks/${taskId}`, { label_data: { spans: labels }, notes });
      alert("Annotations saved!");
    } catch { alert("Could not save."); }
  };

  const handleSubmitTask = async () => {
    if (labels.length === 0) { alert("Please add at least one label."); return; }
    try {
      await API.post(`/annotations/tasks/${taskId}`, { label_data: { spans: labels }, notes });
      setSubmitted(true);
      clearInterval(timerRef.current);
      alert("Task submitted successfully!");
      navigate("/queue");
    } catch { alert("Could not submit."); }
  };

  if (!task) return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <p style={{ color: "#687078", fontSize: 13 }}>Loading task...</p>
    </div>
  );

  const ontologyLabels = task.ontology?.labels || ["PER", "ORG", "LOC", "DATE", "MISC"];
  const customerID = task.customer_id || "977099032732";
  const isUrgent = timeLeft < 5 * 60;

  return (
    <div style={{ minHeight: "100vh", background: "white", display: "flex", flexDirection: "column" }}>

      {/* Top Header */}
      <div style={{ background: "#232F3E", color: "white", padding: "6px 20px",
        display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16, fontSize: 12, flexWrap: "wrap" }}>
          <span>Hello, <strong>{username}</strong></span>
          <span style={{ color: "#aab7b8" }}>|</span>
          <span>Customer ID: <strong>{customerID}</strong></span>
          <span style={{ color: "#aab7b8" }}>|</span>
          <span>Task description: <strong>{task.title}</strong></span>
          <span style={{ color: "#aab7b8" }}>|</span>
          <span className={isUrgent ? "timer-urgent" : ""} style={{ fontWeight: 700, color: isUrgent ? "#ff6b6b" : "#FF9900" }}>
            Task time: {formatTime(timeLeft)} of 29 Min 59 Sec
          </span>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {["Decline task", "Release task", "Skip task", "Stop and resume later"].map((btn, i) => (
            <button key={btn}
              onClick={[handleDeclineTask, handleReleaseTask, handleSkipTask, handleStopResume][i]}
              style={{ background: "transparent", border: "1px solid #aab7b8", color: "white",
                padding: "4px 10px", borderRadius: 2, fontSize: 11, cursor: "pointer", whiteSpace: "nowrap" }}>
              {btn}
            </button>
          ))}
        </div>
      </div>

      {/* Instructions Bar */}
      <div style={{ background: "#F2F3F3", borderBottom: "1px solid #D5DBDB",
        padding: "6px 20px", display: "flex", alignItems: "center", gap: 12 }}>
        <button className="aws-link" style={{ fontSize: 13, fontWeight: 700, background: "none", border: "none" }}
          onClick={() => setShowInstructions(!showInstructions)}>
          {showInstructions ? "Hide instructions" : "View instructions"}
        </button>
        {showInstructions && (
          <span style={{ fontSize: 13, color: "#16191f", borderLeft: "1px solid #D5DBDB", paddingLeft: 12 }}>
            {task.instructions || "No instructions provided."}
          </span>
        )}
      </div>

      {/* Main Body */}
      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>

        {/* Left - Document */}
        <div style={{ flex: 1, padding: 24, overflowY: "auto", borderRight: "1px solid #D5DBDB" }}>

          {/* Title + Buttons */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
            <div>
              <h2 style={{ fontSize: 16, fontWeight: 700, color: "#16191f", margin: 0 }}>
                Document Annotation Task{" "}
                <span className="aws-link" style={{ fontSize: 13, fontWeight: 400 }}>Task Details</span>
              </h2>
              <p style={{ fontSize: 12, color: "#687078", marginTop: 4 }}>
                Label entities in the provided document
              </p>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button className="aws-btn-normal" onClick={handleSaveAnnotation}>
                Save Annotations
              </button>
              <button className="aws-btn-primary" onClick={handleSubmitTask}>
                Submit Task
              </button>
            </div>
          </div>

          {/* Document Text */}
          <div
            style={{ padding: 16, background: "#FAFAFA", border: "1px solid #D5DBDB",
              borderRadius: 2, fontSize: 13, lineHeight: 1.8, color: "#16191f",
              userSelect: "text", cursor: "text", minHeight: 200 }}
            onMouseUp={handleTextSelection}>
            {task.data_content || "No content available."}
          </div>

          {/* Label Picker */}
          {selectedText && (
            <div className="aws-warning-banner" style={{ marginTop: 12 }}>
              <p style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>
                Selected: "<em style={{ color: "#0073BB" }}>{selectedText.text}</em>" — Choose a label:
              </p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {ontologyLabels.map(label => (
                  <button key={label} onClick={() => addLabel(label)}
                    className="aws-btn-primary" style={{ padding: "4px 12px", fontSize: 12 }}>
                    {label}
                  </button>
                ))}
                <button onClick={() => setSelectedText(null)}
                  className="aws-btn-normal" style={{ padding: "4px 12px", fontSize: 12 }}>
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
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 8,
                  padding: "8px 16px", borderBottom: "1px solid #eaeded", fontSize: 13 }}>
                  <span style={{ background: "#FF9900", color: "black", padding: "2px 8px",
                    borderRadius: 2, fontSize: 11, fontWeight: 700 }}>
                    {l.label}
                  </span>
                  <span style={{ color: "#16191f", flex: 1 }}>"{l.text}"</span>
                  <button onClick={() => removeLabel(i)}
                    style={{ background: "none", border: "none", color: "#D13212",
                      cursor: "pointer", fontSize: 16, fontWeight: 700 }}>×</button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right - Annotations Panel */}
        <div style={{ width: 300, background: "#FAFAFA", display: "flex", flexDirection: "column", borderLeft: "1px solid #D5DBDB" }}>

          {/* Count */}
          <div style={{ padding: "12px 16px", borderBottom: "1px solid #D5DBDB", background: "white" }}>
            <p style={{ fontSize: 13, fontWeight: 700, margin: 0 }}>
              Total Annotations: <span style={{ color: "#0073BB" }}>{labels.length}</span>
            </p>
          </div>

          {/* Tabs */}
          <div style={{ display: "flex", borderBottom: "1px solid #D5DBDB", background: "white" }}>
            {["annotations", "labelform"].map(tab => (
              <button key={tab} onClick={() => setActiveTab(tab)}
                style={{ flex: 1, padding: "10px 0", fontSize: 13, fontWeight: activeTab === tab ? 700 : 400,
                  background: "none", border: "none", cursor: "pointer",
                  borderBottom: activeTab === tab ? "2px solid #FF9900" : "2px solid transparent",
                  color: activeTab === tab ? "#16191f" : "#687078" }}>
                {tab === "annotations" ? "Annotations" : "Label Form"}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          <div style={{ flex: 1, overflowY: "auto", padding: 12 }}>
            {activeTab === "annotations" ? (
              <div>
                {labels.length === 0 ? (
                  <p style={{ fontSize: 12, color: "#687078", textAlign: "center", padding: "24px 0" }}>
                    Select text in the document to add annotations
                  </p>
                ) : (
                  labels.map((l, i) => (
                    <div key={i} style={{ background: "white", border: "1px solid #D5DBDB",
                      borderRadius: 2, padding: 12, marginBottom: 8, fontSize: 12 }}>
                      <p style={{ fontWeight: 700, color: "#16191f", marginBottom: 6, wordBreak: "break-word" }}>
                        "{l.text}"
                      </p>
                      <div style={{ color: "#687078", lineHeight: 1.8 }}>
                        <div>type: <span style={{ color: "#16191f" }}>text</span></div>
                        <div>parentElement: <span style={{ color: "#16191f" }}>#text</span></div>
                        <div>label: <span style={{ color: "#0073BB", fontWeight: 700 }}>{l.label}</span></div>
                        <div>notes: <span style={{ fontStyle: "italic" }}>NA</span></div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            ) : (
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, display: "block", marginBottom: 4 }}>
                  Notes (optional)
                </label>
                <textarea className="aws-input"
                  style={{ height: 100, resize: "vertical", marginBottom: 12 }}
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="Add annotation notes..."
                />
                <button className="aws-btn-primary" style={{ width: "100%", padding: "8px 0" }}
                  onClick={handleSubmitTask}>
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