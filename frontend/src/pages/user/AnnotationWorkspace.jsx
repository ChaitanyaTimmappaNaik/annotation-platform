import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import API from "../../api/client";

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

const HARM_CATEGORIES = [
  { key: "misconduct", label: "Misconduct" },
  { key: "violence", label: "Violence" },
  { key: "hate", label: "Hate" },
  { key: "stereotype", label: "Stereotype" },
  { key: "insults", label: "Insults" },
  { key: "sexual", label: "Sexual" },
];

const INTENSITY_OPTIONS = ["None", "Low", "Medium", "High", "Hard-to-decide"];
const INTENT_OPTIONS = ["Harmless", "Harmful", "Unspecified"];
const CONFIDENCE_OPTIONS = [
  "Completely Unconfident",
  "Somewhat Unconfident",
  "Neither Confident nor Unconfident",
  "Somewhat Confident",
  "Completely Confident"
];
const SEVERITY_OPTIONS = ["0", "1", "2", "3", "4", "5"];

export default function AnnotationWorkspace() {
  const { taskId } = useParams();
  const [searchParams] = useSearchParams();
  const batchId = searchParams.get("batch_id");
  const datasetObjectId = searchParams.get("dataset_object_id") || 0;

  const [task, setTask] = useState(null);
  const [progress, setProgress] = useState(null);
  const [timeLeft, setTimeLeft] = useState(() => getSavedTime(taskId));
  const [activeTab, setActiveTab] = useState("annotation");
  const [showInstructions, setShowInstructions] = useState(false);

  // Annotation state — matches Amazon SageMaker GT fields
  const [hasHarm, setHasHarm] = useState(null); // true/false
  const [intent, setIntent] = useState("");
  const [intentRationale, setIntentRationale] = useState("");
  const [intentConfidenceLevel, setIntentConfidenceLevel] = useState("");
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [categoryData, setCategoryData] = useState({});
  const [overallComments, setOverallComments] = useState("");

  const timerRef = useRef(null);
  const navigate = useNavigate();
  const username = localStorage.getItem("username");
  const userId = localStorage.getItem("user_id");

  useEffect(() => {
    loadTask();
    if (batchId) loadProgress();
    startTimer();
    return () => clearInterval(timerRef.current);
  }, [taskId]);

  const startTimer = () => {
    const initial = getSavedTime(taskId);
    setTimeLeft(initial);
    clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        const next = prev - 1;
        localStorage.setItem(`timer_${taskId}`, next);
        localStorage.setItem(`timer_${taskId}_savedAt`, Date.now().toString());
        if (next <= 0) { clearInterval(timerRef.current); return 0; }
        return next;
      });
    }, 1000);
  };

  const formatTime = (s) => `${Math.floor(s/60)}:${String(s%60).padStart(2,"0")}`;

  const loadTask = async () => {
    try {
      const res = await API.get(`/tasks/${taskId}`);
      setTask(res.data);
    } catch {
      alert("Could not load task");
      navigate("/queue");
    }
  };

  const loadProgress = async () => {
    try {
      const res = await API.get(`/batches/progress/${batchId}`);
      setProgress(res.data);
    } catch {}
  };

  const toggleCategory = (key) => {
    setSelectedCategories(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    );
    if (!categoryData[key]) {
      setCategoryData(prev => ({
        ...prev,
        [key]: { intensity: "None", severity: "0", confidence: "Completely Confident" }
      }));
    }
  };

  const updateCategoryData = (catKey, field, value) => {
    setCategoryData(prev => ({
      ...prev,
      [catKey]: { ...prev[catKey], [field]: value }
    }));
  };

  const buildLabelData = () => {
    const categories = {};
    selectedCategories.forEach(cat => {
      categories[cat] = categoryData[cat] || { intensity: "None", severity: "0", confidence: "Completely Confident" };
    });
    return {
      has_harm: hasHarm,
      intent: intent,
      intent_rationale: intentRationale,
      intent_confidence_level: intentConfidenceLevel,
      harm_categories: categories,
      overall_comments: overallComments,
      annotator_id: userId,
      submitted_at: new Date().toISOString()
    };
  };

  const handleSubmit = async () => {
    if (hasHarm === null) { alert("Please answer: Is there any harm in this text?"); return; }
    if (hasHarm && !intent) { alert("Please select the intent."); return; }
    if (hasHarm && selectedCategories.length === 0) { alert("Please select at least one harm category."); return; }

    const timeSpent = (29 * 60 + 59) - timeLeft;
    const labelData = buildLabelData();

    try {
      if (batchId) {
        // Consensus workflow
        const res = await API.post("/consensus/submit", {
          task_id: parseInt(taskId),
          batch_id: parseInt(batchId),
          dataset_object_id: parseInt(datasetObjectId),
          label_data: labelData,
          notes: overallComments,
          time_spent: timeSpent
        });

        localStorage.removeItem(`timer_${taskId}`);
        localStorage.removeItem(`timer_${taskId}_savedAt`);
        clearInterval(timerRef.current);

        if (res.data.batch_complete) {
          alert("🎉 Batch complete! All tasks annotated.");
          navigate("/queue");
        } else if (res.data.next_task_id) {
          // Auto-load next task
          navigate(`/annotate/${res.data.next_task_id}?batch_id=${batchId}&dataset_object_id=${parseInt(datasetObjectId)+1}`);
        } else {
          navigate("/queue");
        }
      } else {
        // Standard workflow
        await API.post(`/annotations/tasks/${taskId}`, {
          label_data: labelData,
          notes: overallComments,
          time_spent: timeSpent
        });
        localStorage.removeItem(`timer_${taskId}`);
        localStorage.removeItem(`timer_${taskId}_savedAt`);
        clearInterval(timerRef.current);
        alert("Task submitted!");
        navigate("/queue");
      }
    } catch (err) {
      alert(err.response?.data?.detail || "Could not submit.");
    }
  };

  const handleStopResume = () => {
    localStorage.setItem(`timer_${taskId}`, timeLeft.toString());
    localStorage.setItem(`timer_${taskId}_savedAt`, Date.now().toString());
    clearInterval(timerRef.current);
    navigate("/queue");
  };

  const handleDecline = async () => {
    if (!confirm("Decline this task?")) return;
    localStorage.removeItem(`timer_${taskId}`);
    localStorage.removeItem(`timer_${taskId}_savedAt`);
    try { await API.put(`/tasks/${taskId}/release`); } catch {}
    clearInterval(timerRef.current);
    navigate("/queue");
  };

  if (!task) return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <p style={{ color: "#687078" }}>Loading task...</p>
    </div>
  );

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
          {batchId && progress && (
            <>
              <span style={{ color: "#aab7b8" }}>|</span>
              <span style={{ color: "#FF9900", fontWeight: 700 }}>
                Task {progress.completed + 1} of {progress.total}
              </span>
            </>
          )}
          <span style={{ color: "#aab7b8" }}>|</span>
          <span style={{ fontWeight: 700, color: isUrgent ? "#ff6b6b" : "#FF9900" }}>
            ⏱ {formatTime(timeLeft)}
          </span>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={handleDecline}
            style={{ background: "transparent", border: "1px solid #aab7b8",
              color: "white", padding: "4px 10px", borderRadius: 2, fontSize: 11, cursor: "pointer" }}>
            Decline task
          </button>
          <button onClick={handleStopResume}
            style={{ background: "transparent", border: "1px solid #aab7b8",
              color: "white", padding: "4px 10px", borderRadius: 2, fontSize: 11, cursor: "pointer" }}>
            Stop and resume later
          </button>
        </div>
      </div>

      {/* Progress Bar */}
      {batchId && progress && (
        <div style={{ background: "#F2F3F3", padding: "8px 20px",
          borderBottom: "1px solid #D5DBDB", display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 12, color: "#687078", whiteSpace: "nowrap" }}>
            Batch Progress: {progress.completed}/{progress.total}
          </span>
          <div style={{ flex: 1, background: "#D5DBDB", borderRadius: 4, height: 8 }}>
            <div style={{ width: `${progress.percentage}%`, background: "#FF9900",
              borderRadius: 4, height: 8, transition: "width 0.3s" }} />
          </div>
          <span style={{ fontSize: 12, fontWeight: 700, color: "#FF9900" }}>
            {progress.percentage}%
          </span>
        </div>
      )}

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
            {task.instructions || "Label the content according to the harm categories."}
          </span>
        )}
        <span style={{ marginLeft: "auto", fontSize: 11, color: "#687078",
          background: "#E8F4FD", padding: "2px 8px", borderRadius: 2 }}>
          datasetObjectId: {datasetObjectId}
        </span>
      </div>

      {/* Main Body */}
      <div style={{ display: "flex", flex: 1 }}>

        {/* Left - Document */}
        <div style={{ flex: 1, padding: 24, overflowY: "auto", borderRight: "1px solid #D5DBDB" }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
            <div>
              <h2 style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>
                Turn 1
              </h2>
              <span style={{ fontSize: 11, color: "#687078" }}>role: COMPLETION</span>
            </div>
          </div>

          {/* Content Box */}
          <div style={{ background: "#FAFAFA", border: "1px solid #D5DBDB",
            borderRadius: 4, padding: 16, fontSize: 14, lineHeight: 1.8,
            color: "#16191f", minHeight: 180 }}>
            {task.data_content || "No content available."}
          </div>

          <p style={{ fontSize: 11, color: "#687078", marginTop: 8, fontStyle: "italic" }}>
            Treat the data in this task as confidential.
          </p>
        </div>

        {/* Right - Annotation Panel */}
        <div style={{ width: 380, overflowY: "auto", display: "flex", flexDirection: "column" }}>

          {/* Tabs */}
          <div style={{ display: "flex", borderBottom: "1px solid #D5DBDB", background: "#FAFAFA" }}>
            {["annotation", "reference"].map(tab => (
              <button key={tab} onClick={() => setActiveTab(tab)}
                style={{ flex: 1, padding: "10px 0", fontSize: 13,
                  fontWeight: activeTab === tab ? 700 : 400,
                  background: "none", border: "none", cursor: "pointer",
                  borderBottom: activeTab === tab ? "2px solid #FF9900" : "2px solid transparent",
                  color: activeTab === tab ? "#16191f" : "#687078",
                  textTransform: "capitalize" }}>
                {tab === "annotation" ? "Annotation Panel" : "Reference"}
              </button>
            ))}
          </div>

          <div style={{ flex: 1, padding: 16, overflowY: "auto" }}>

            {activeTab === "reference" ? (
              <div style={{ fontSize: 13, color: "#687078" }}>
                <h3 style={{ fontSize: 14, fontWeight: 700, color: "#16191f" }}>Harm Categories Reference</h3>
                {HARM_CATEGORIES.map(cat => (
                  <div key={cat.key} style={{ marginBottom: 8, padding: 8,
                    background: "#F8F8F8", borderRadius: 2 }}>
                    <strong>{cat.label}</strong>
                  </div>
                ))}
              </div>
            ) : (
              <div>

                {/* Step 1: Is there harm? */}
                <div style={{ marginBottom: 16, padding: 12, background: "#F8F8F8",
                  borderRadius: 4, border: "1px solid #D5DBDB" }}>
                  <label style={{ fontSize: 13, fontWeight: 700, display: "block", marginBottom: 8 }}>
                    Step 1: Is there any harm in this text? *
                  </label>
                  <div style={{ display: "flex", gap: 12 }}>
                    {[
                      { label: "Yes — Harm detected", value: true },
                      { label: "No harm", value: false }
                    ].map(opt => (
                      <label key={String(opt.value)} style={{ display: "flex",
                        alignItems: "center", gap: 6, cursor: "pointer", fontSize: 13 }}>
                        <input type="radio" name="hasHarm"
                          checked={hasHarm === opt.value}
                          onChange={() => setHasHarm(opt.value)} />
                        {opt.label}
                      </label>
                    ))}
                  </div>
                </div>

                {hasHarm === false && (
                  <div style={{ background: "#d5f5e3", border: "1px solid #1D8102",
                    borderRadius: 4, padding: 12, marginBottom: 16, fontSize: 13, color: "#1D8102" }}>
                    ✅ No harm detected — you can submit directly.
                  </div>
                )}

                {hasHarm === true && (
                  <>
                    {/* Step 2: Intent */}
                    <div style={{ marginBottom: 16, padding: 12, background: "#F8F8F8",
                      borderRadius: 4, border: "1px solid #D5DBDB" }}>
                      <label style={{ fontSize: 13, fontWeight: 700, display: "block", marginBottom: 8 }}>
                        Step 2: Intent Evaluation *
                      </label>
                      <select
                        style={{ width: "100%", border: "1px solid #aab7b8", borderRadius: 2,
                          padding: "6px 8px", fontSize: 13, marginBottom: 8 }}
                        value={intent}
                        onChange={e => setIntent(e.target.value)}>
                        <option value="">Select intent...</option>
                        {INTENT_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                      </select>
                      {intent && (
                        <>
                          <label style={{ fontSize: 12, fontWeight: 700, display: "block", marginBottom: 4 }}>
                            Provide rationale *
                          </label>
                          <textarea
                            style={{ width: "100%", border: "1px solid #aab7b8", borderRadius: 2,
                              padding: "6px 8px", fontSize: 12, resize: "vertical", height: 60 }}
                            placeholder="Explain why you chose this intent..."
                            value={intentRationale}
                            onChange={e => setIntentRationale(e.target.value)} />
                          <label style={{ fontSize: 12, fontWeight: 700, display: "block",
                            marginBottom: 4, marginTop: 8 }}>
                            Intent Confidence Level *
                          </label>
                          {CONFIDENCE_OPTIONS.map(opt => (
                            <label key={opt} style={{ display: "flex", alignItems: "center",
                              gap: 6, cursor: "pointer", fontSize: 12, marginBottom: 4 }}>
                              <input type="radio" name="intentConfidence"
                                checked={intentConfidenceLevel === opt}
                                onChange={() => setIntentConfidenceLevel(opt)} />
                              {opt}
                            </label>
                          ))}
                        </>
                      )}
                    </div>

                    {/* Step 3: Harm Categories */}
                    <div style={{ marginBottom: 16, padding: 12, background: "#F8F8F8",
                      borderRadius: 4, border: "1px solid #D5DBDB" }}>
                      <label style={{ fontSize: 13, fontWeight: 700, display: "block", marginBottom: 8 }}>
                        Step 3: Select Harm Categories *
                      </label>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
                        {HARM_CATEGORIES.map(cat => (
                          <button key={cat.key}
                            onClick={() => toggleCategory(cat.key)}
                            style={{ padding: "4px 10px", borderRadius: 2, fontSize: 12,
                              cursor: "pointer", fontWeight: 600,
                              background: selectedCategories.includes(cat.key) ? "#FF9900" : "white",
                              border: selectedCategories.includes(cat.key)
                                ? "1px solid #EC7211" : "1px solid #D5DBDB",
                              color: selectedCategories.includes(cat.key) ? "black" : "#687078" }}>
                            {cat.label}
                          </button>
                        ))}
                      </div>

                      {/* Per-category annotations */}
                      {selectedCategories.map(catKey => {
                        const cat = HARM_CATEGORIES.find(c => c.key === catKey);
                        const data = categoryData[catKey] || {};
                        return (
                          <div key={catKey} style={{ marginBottom: 12, padding: 10,
                            background: "white", borderRadius: 2,
                            border: "1px solid #FF9900" }}>
                            <div style={{ fontWeight: 700, fontSize: 13,
                              color: "#FF9900", marginBottom: 8 }}>
                              {cat?.label}
                            </div>

                            <label style={{ fontSize: 11, fontWeight: 700,
                              display: "block", marginBottom: 4 }}>
                              Intensity *
                            </label>
                            <select
                              style={{ width: "100%", border: "1px solid #aab7b8",
                                borderRadius: 2, padding: "4px 6px", fontSize: 12, marginBottom: 8 }}
                              value={data.intensity || "None"}
                              onChange={e => updateCategoryData(catKey, "intensity", e.target.value)}>
                              {INTENSITY_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                            </select>

                            <label style={{ fontSize: 11, fontWeight: 700,
                              display: "block", marginBottom: 4 }}>
                              Severity (0-5) *
                            </label>
                            <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
                              {SEVERITY_OPTIONS.map(s => (
                                <label key={s} style={{ display: "flex", alignItems: "center",
                                  gap: 3, cursor: "pointer", fontSize: 12 }}>
                                  <input type="radio"
                                    name={`severity_${catKey}`}
                                    checked={data.severity === s}
                                    onChange={() => updateCategoryData(catKey, "severity", s)} />
                                  {s}
                                </label>
                              ))}
                            </div>

                            <label style={{ fontSize: 11, fontWeight: 700,
                              display: "block", marginBottom: 4 }}>
                              Confidence Level *
                            </label>
                            {CONFIDENCE_OPTIONS.map(opt => (
                              <label key={opt} style={{ display: "flex", alignItems: "center",
                                gap: 6, cursor: "pointer", fontSize: 11, marginBottom: 3 }}>
                                <input type="radio"
                                  name={`conf_${catKey}`}
                                  checked={data.confidence === opt}
                                  onChange={() => updateCategoryData(catKey, "confidence", opt)} />
                                {opt}
                              </label>
                            ))}
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}

                {/* Overall Comments */}
                <div style={{ marginBottom: 16 }}>
                  <label style={{ fontSize: 12, fontWeight: 700, display: "block", marginBottom: 4 }}>
                    Overall Comments (optional)
                  </label>
                  <textarea
                    style={{ width: "100%", border: "1px solid #aab7b8", borderRadius: 2,
                      padding: "8px 10px", fontSize: 12, resize: "vertical", height: 60 }}
                    placeholder="Add any additional notes..."
                    value={overallComments}
                    onChange={e => setOverallComments(e.target.value)} />
                </div>

                {/* Submit Button */}
                <button onClick={handleSubmit}
                  style={{ width: "100%", background: "#FF9900", border: "1px solid #EC7211",
                    color: "black", padding: "10px 0", borderRadius: 2,
                    fontSize: 14, fontWeight: 700, cursor: "pointer" }}>
                  {batchId ? "Submit & Load Next Task →" : "Submit Task"}
                </button>

                {batchId && progress && (
                  <p style={{ fontSize: 11, color: "#687078", textAlign: "center", marginTop: 8 }}>
                    {progress.remaining} tasks remaining in this batch
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}