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

const INTENSITY_OPTIONS = [
  "None", "Low", "Medium", "High", "Hard-to-decide"
];
const INTENT_OPTIONS = ["Harmless", "Harmful", "Unspecified"];
const CONFIDENCE_OPTIONS = [
  "Completely Unconfident",
  "Somewhat Unconfident",
  "Neither Confident nor Unconfident",
  "Somewhat Confident",
  "Completely Confident"
];
const SEVERITY_OPTIONS = ["0", "1", "2", "3", "4", "5"];

const INITIAL_STATE = {
  hasHarm: null,
  intent: "",
  intentRationale: "",
  intentConfidenceLevel: "",
  selectedCategories: [],
  categoryData: {},
  overallComments: "",
};

export default function AnnotationWorkspace() {
  const { taskId } = useParams();
  const [searchParams] = useSearchParams();
  const batchId = searchParams.get("batch_id");
  const datasetObjectId = searchParams.get("dataset_object_id") || 0;

  const [task, setTask] = useState(null);
  const [timeLeft, setTimeLeft] = useState(29 * 60 + 59);
  const [activeTab, setActiveTab] = useState("annotation");
  const [showInstructions, setShowInstructions] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [annotation, setAnnotation] = useState(INITIAL_STATE);

  const timerRef = useRef(null);
  const navigate = useNavigate();
  const username = localStorage.getItem("username");

  useEffect(() => {
    // Reset all state on task change
    setAnnotation(INITIAL_STATE);
    setActiveTab("annotation");
    setShowInstructions(false);
    setSubmitting(false);

    // Reset timer
    clearInterval(timerRef.current);
    const initial = getSavedTime(taskId);
    setTimeLeft(initial);
    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        const next = prev - 1;
        localStorage.setItem(`timer_${taskId}`, next);
        localStorage.setItem(
          `timer_${taskId}_savedAt`,
          Date.now().toString()
        );
        if (next <= 0) {
          clearInterval(timerRef.current);
          return 0;
        }
        return next;
      });
    }, 1000);

    loadTask();
    return () => clearInterval(timerRef.current);
  }, [taskId]);

  const formatTime = (s) =>
    `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

  const loadTask = async () => {
    try {
      const res = await API.get(`/tasks/${taskId}`);
      setTask(res.data);
    } catch {
      alert("Could not load task");
      navigate("/queue");
    }
  };

  const setField = (field, value) =>
    setAnnotation(prev => ({ ...prev, [field]: value }));

  const toggleCategory = (key) => {
    setAnnotation(prev => {
      const already = prev.selectedCategories.includes(key);
      return {
        ...prev,
        selectedCategories: already
          ? prev.selectedCategories.filter(k => k !== key)
          : [...prev.selectedCategories, key],
        categoryData: already
          ? prev.categoryData
          : {
              ...prev.categoryData,
              [key]: prev.categoryData[key] || {
                intensity: "None",
                severity: "0",
                confidence: "Completely Confident"
              }
            }
      };
    });
  };

  const updateCategoryData = (catKey, field, value) => {
    setAnnotation(prev => ({
      ...prev,
      categoryData: {
        ...prev.categoryData,
        [catKey]: { ...prev.categoryData[catKey], [field]: value }
      }
    }));
  };

  // Only clean annotation fields — no internal IDs
  const buildLabelData = () => {
    const categories = {};
    annotation.selectedCategories.forEach(cat => {
      categories[cat] = annotation.categoryData[cat] || {
        intensity: "None",
        severity: "0",
        confidence: "Completely Confident"
      };
    });
    return {
      has_harm: annotation.hasHarm,
      intent: annotation.intent,
      intent_rationale: annotation.intentRationale,
      intent_confidence_level: annotation.intentConfidenceLevel,
      harm_categories: categories,
      overall_comments: annotation.overallComments
    };
  };

  const handleSubmit = async () => {
    if (annotation.hasHarm === null) {
      alert("Please answer: Is there any harm in this text?");
      return;
    }
    if (annotation.hasHarm && !annotation.intent) {
      alert("Please select the intent.");
      return;
    }
    if (annotation.hasHarm &&
        annotation.selectedCategories.length === 0) {
      alert("Please select at least one harm category.");
      return;
    }

    setSubmitting(true);
    const timeSpent = (29 * 60 + 59) - timeLeft;
    const labelData = buildLabelData();

    try {
      if (batchId) {
        const res = await API.post("/consensus/submit", {
          task_id: parseInt(taskId),
          batch_id: parseInt(batchId),
          dataset_object_id: parseInt(datasetObjectId),
          label_data: labelData,
          notes: annotation.overallComments,
          time_spent: timeSpent
        });

        localStorage.removeItem(`timer_${taskId}`);
        localStorage.removeItem(`timer_${taskId}_savedAt`);
        clearInterval(timerRef.current);

        if (res.data.batch_complete) {
          alert("🎉 Batch complete! All tasks annotated.");
          navigate("/queue");
        } else if (res.data.next_task_id) {
          navigate(
            `/annotate/${res.data.next_task_id}`
            + `?batch_id=${batchId}`
            + `&dataset_object_id=${parseInt(datasetObjectId) + 1}`,
            { replace: true }
          );
        } else {
          navigate("/queue");
        }
      } else {
        await API.post(`/annotations/tasks/${taskId}`, {
          label_data: labelData,
          notes: annotation.overallComments,
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
    setSubmitting(false);
  };

  const handleStopResume = () => {
    localStorage.setItem(`timer_${taskId}`, timeLeft.toString());
    localStorage.setItem(
      `timer_${taskId}_savedAt`,
      Date.now().toString()
    );
    clearInterval(timerRef.current);
    navigate("/queue");
  };

  const handleDecline = async () => {
    if (!confirm("Decline this task?")) return;
    localStorage.removeItem(`timer_${taskId}`);
    localStorage.removeItem(`timer_${taskId}_savedAt`);
    clearInterval(timerRef.current);
    try { await API.put(`/tasks/${taskId}/release`); } catch {}
    navigate("/queue");
  };

  const handleRelease = async () => {
    if (!confirm("Release this task?")) return;
    localStorage.removeItem(`timer_${taskId}`);
    localStorage.removeItem(`timer_${taskId}_savedAt`);
    clearInterval(timerRef.current);
    try { await API.put(`/tasks/${taskId}/release`); } catch {}
    navigate("/queue");
  };

  if (!task) return (
    <div style={{ minHeight: "100vh", display: "flex",
      alignItems: "center", justifyContent: "center" }}>
      <p style={{ color: "#687078" }}>Loading task...</p>
    </div>
  );

  const isUrgent = timeLeft < 5 * 60;

  return (
    <div style={{ minHeight: "100vh", background: "white",
      display: "flex", flexDirection: "column" }}>

      {/* ── Top Header ── */}
      <div style={{ background: "#232F3E", color: "white",
        padding: "6px 20px", display: "flex",
        alignItems: "center", justifyContent: "space-between",
        flexWrap: "wrap", gap: 8 }}>
        <div style={{ display: "flex", alignItems: "center",
          gap: 16, fontSize: 12, flexWrap: "wrap" }}>
          <span>Hello, <strong>{username}</strong></span>
          <span style={{ color: "#aab7b8" }}>|</span>
          <span>Customer ID:{" "}
            <strong>{task.customer_id || "977099032732"}</strong>
          </span>
          <span style={{ color: "#aab7b8" }}>|</span>
          <span>Task description: <strong>{task.title}</strong></span>
          <span style={{ color: "#aab7b8" }}>|</span>
          <span style={{ fontWeight: 700,
            color: isUrgent ? "#ff6b6b" : "#FF9900" }}>
            Task time: ⏱ {formatTime(timeLeft)}
          </span>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {[
            { label: "Decline task", action: handleDecline },
            { label: "Release task", action: handleRelease },
            { label: "Stop and resume later", action: handleStopResume },
          ].map(btn => (
            <button key={btn.label} onClick={btn.action}
              style={{ background: "transparent",
                border: "1px solid #aab7b8", color: "white",
                padding: "4px 10px", borderRadius: 2,
                fontSize: 11, cursor: "pointer",
                whiteSpace: "nowrap" }}>
              {btn.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Instructions + Task ID Bar ── */}
      <div style={{ background: "#F2F3F3",
        borderBottom: "1px solid #D5DBDB",
        padding: "6px 20px", display: "flex",
        alignItems: "center", gap: 12 }}>
        <button style={{ color: "#0073BB", fontSize: 13,
          fontWeight: 700, background: "none",
          border: "none", cursor: "pointer" }}
          onClick={() => setShowInstructions(!showInstructions)}>
          {showInstructions
            ? "Hide instructions"
            : "View instructions"}
        </button>
        {showInstructions && (
          <span style={{ fontSize: 13, color: "#16191f",
            borderLeft: "1px solid #D5DBDB", paddingLeft: 12 }}>
            {task.instructions ||
              "Label the content according to the harm categories."}
          </span>
        )}

        {/* Task ID + Batch — right side */}
        <div style={{ marginLeft: "auto", display: "flex",
          alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 12, fontWeight: 700,
            background: "#FEF9E7",
            border: "1px solid #FF9900",
            color: "#16191f",
            padding: "3px 10px", borderRadius: 2 }}>
            Task ID: <strong style={{ color: "#FF9900" }}>
              {taskId}
            </strong>
          </span>
          {batchId && task.title && (
            <span style={{ fontSize: 11, color: "#6A1B9A",
              background: "#F3E8FF",
              border: "1px solid #6A1B9A30",
              padding: "3px 8px", borderRadius: 2 }}>
              Batch: <strong>{task.title}</strong>
            </span>
          )}
        </div>
      </div>

      {/* ── Main Body ── */}
      <div style={{ display: "flex", flex: 1 }}>

        {/* Left - Content */}
        <div style={{ flex: 1, padding: 24, overflowY: "auto",
          borderRight: "1px solid #D5DBDB" }}>
          <div style={{ marginBottom: 12 }}>
            <h2 style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>
              Turn 1
            </h2>
            <span style={{ fontSize: 11, color: "#687078" }}>
              role: COMPLETION
            </span>
          </div>
          <div style={{ background: "#FAFAFA",
            border: "1px solid #D5DBDB", borderRadius: 4,
            padding: 16, fontSize: 14, lineHeight: 1.8,
            color: "#16191f", minHeight: 180 }}>
            {task.data_content || "No content available."}
          </div>
          <p style={{ fontSize: 11, color: "#687078",
            marginTop: 8, fontStyle: "italic" }}>
            Treat the data in this task as confidential.
          </p>
        </div>

        {/* Right - Annotation Panel */}
        <div style={{ width: 400, overflowY: "auto",
          display: "flex", flexDirection: "column" }}>

          {/* Tabs */}
          <div style={{ display: "flex",
            borderBottom: "1px solid #D5DBDB",
            background: "#FAFAFA" }}>
            {["annotation", "reference"].map(tab => (
              <button key={tab} onClick={() => setActiveTab(tab)}
                style={{ flex: 1, padding: "10px 0", fontSize: 13,
                  fontWeight: activeTab === tab ? 700 : 400,
                  background: "none", border: "none",
                  cursor: "pointer",
                  borderBottom: activeTab === tab
                    ? "2px solid #FF9900"
                    : "2px solid transparent",
                  color: activeTab === tab
                    ? "#16191f" : "#687078" }}>
                {tab === "annotation"
                  ? "Annotation Panel" : "Reference"}
              </button>
            ))}
          </div>

          <div style={{ flex: 1, padding: 16, overflowY: "auto" }}>

            {activeTab === "reference" ? (
              <div style={{ fontSize: 12 }}>
                <h3 style={{ fontSize: 14, fontWeight: 700 }}>
                  Harm Categories
                </h3>
                {HARM_CATEGORIES.map(cat => (
                  <div key={cat.key} style={{ marginBottom: 6,
                    padding: 8, background: "#F8F8F8",
                    borderRadius: 2 }}>
                    <strong>{cat.label}</strong>
                  </div>
                ))}
                <h3 style={{ fontSize: 14, fontWeight: 700,
                  marginTop: 16 }}>
                  Intensity Scale
                </h3>
                {[
                  { level: "Low", desc: "Borderline harmful (~50%)" },
                  { level: "Medium", desc: "Clearly harmful, moderate" },
                  { level: "High", desc: "Clearly harmful, high impact" },
                ].map(item => (
                  <div key={item.level} style={{ marginBottom: 6,
                    padding: 8, background: "#F8F8F8",
                    borderRadius: 2, fontSize: 12 }}>
                    <strong>{item.level}:</strong> {item.desc}
                  </div>
                ))}
                <h3 style={{ fontSize: 14, fontWeight: 700,
                  marginTop: 16 }}>
                  Severity Scale
                </h3>
                {[
                  "0 — Not harmful",
                  "1 — Mildly concerning",
                  "2 — Moderately harmful",
                  "3 — Significantly harmful",
                  "4 — Severely harmful",
                  "5 — Extremely dangerous",
                ].map(s => (
                  <div key={s} style={{ fontSize: 12,
                    padding: "4px 0",
                    borderBottom: "1px solid #f5f5f5" }}>
                    {s}
                  </div>
                ))}
                <h3 style={{ fontSize: 14, fontWeight: 700,
                  marginTop: 16 }}>
                  Consensus Rule
                </h3>
                <div style={{ background: "#F0F8FF",
                  border: "1px solid #0073BB",
                  borderRadius: 2, padding: 10,
                  fontSize: 11, lineHeight: 1.6 }}>
                  <strong>≥ 70% agreement</strong> → ✅ PASSED<br/>
                  <strong>&lt; 70% agreement</strong> → ⚠️ Needs Review<br/>
                  <strong>2 of 3 annotators</strong> must agree
                </div>
              </div>
            ) : (
              <div>

                {/* Step 1 */}
                <div style={{ marginBottom: 16, padding: 12,
                  background: "#F8F8F8", borderRadius: 4,
                  border: "1px solid #D5DBDB" }}>
                  <label style={{ fontSize: 13, fontWeight: 700,
                    display: "block", marginBottom: 8 }}>
                    Step 1: Is there any harm in this text? *
                  </label>
                  <div style={{ display: "flex", gap: 16 }}>
                    {[
                      { label: "Yes — Harm detected", value: true },
                      { label: "No harm", value: false }
                    ].map(opt => (
                      <label key={String(opt.value)}
                        style={{ display: "flex",
                          alignItems: "center", gap: 6,
                          cursor: "pointer", fontSize: 13 }}>
                        <input type="radio" name="hasHarm"
                          checked={annotation.hasHarm === opt.value}
                          onChange={() =>
                            setField("hasHarm", opt.value)} />
                        {opt.label}
                      </label>
                    ))}
                  </div>
                </div>

                {annotation.hasHarm === false && (
                  <div style={{ background: "#d5f5e3",
                    border: "1px solid #1D8102", borderRadius: 4,
                    padding: 12, marginBottom: 16,
                    fontSize: 13, color: "#1D8102" }}>
                    ✅ No harm detected — submit directly.
                  </div>
                )}

                {annotation.hasHarm === true && (
                  <>
                    {/* Step 2 */}
                    <div style={{ marginBottom: 16, padding: 12,
                      background: "#F8F8F8", borderRadius: 4,
                      border: "1px solid #D5DBDB" }}>
                      <label style={{ fontSize: 13, fontWeight: 700,
                        display: "block", marginBottom: 8 }}>
                        Step 2: Intent Evaluation *
                      </label>
                      <select style={{ width: "100%",
                        border: "1px solid #aab7b8",
                        borderRadius: 2, padding: "6px 8px",
                        fontSize: 13, marginBottom: 8 }}
                        value={annotation.intent}
                        onChange={e =>
                          setField("intent", e.target.value)}>
                        <option value="">Select intent...</option>
                        {INTENT_OPTIONS.map(o => (
                          <option key={o} value={o}>{o}</option>
                        ))}
                      </select>
                      {annotation.intent && (
                        <>
                          <label style={{ fontSize: 12,
                            fontWeight: 700, display: "block",
                            marginBottom: 4 }}>
                            Provide rationale *
                          </label>
                          <textarea style={{ width: "100%",
                            border: "1px solid #aab7b8",
                            borderRadius: 2,
                            padding: "6px 8px", fontSize: 12,
                            resize: "vertical", height: 60 }}
                            placeholder="Explain your choice..."
                            value={annotation.intentRationale}
                            onChange={e =>
                              setField("intentRationale",
                                e.target.value)} />
                          <label style={{ fontSize: 12,
                            fontWeight: 700, display: "block",
                            marginBottom: 4, marginTop: 8 }}>
                            Intent Confidence Level *
                          </label>
                          {CONFIDENCE_OPTIONS.map(opt => (
                            <label key={opt}
                              style={{ display: "flex",
                                alignItems: "center", gap: 6,
                                cursor: "pointer", fontSize: 12,
                                marginBottom: 4 }}>
                              <input type="radio"
                                name="intentConfidence"
                                checked={
                                  annotation.intentConfidenceLevel
                                  === opt
                                }
                                onChange={() =>
                                  setField(
                                    "intentConfidenceLevel", opt
                                  )} />
                              {opt}
                            </label>
                          ))}
                        </>
                      )}
                    </div>

                    {/* Step 3 */}
                    <div style={{ marginBottom: 16, padding: 12,
                      background: "#F8F8F8", borderRadius: 4,
                      border: "1px solid #D5DBDB" }}>
                      <label style={{ fontSize: 13, fontWeight: 700,
                        display: "block", marginBottom: 8 }}>
                        Step 3: Select Harm Categories *
                      </label>
                      <div style={{ display: "flex",
                        flexWrap: "wrap", gap: 6,
                        marginBottom: 12 }}>
                        {HARM_CATEGORIES.map(cat => (
                          <button key={cat.key}
                            onClick={() => toggleCategory(cat.key)}
                            style={{ padding: "4px 10px",
                              borderRadius: 2, fontSize: 12,
                              cursor: "pointer", fontWeight: 600,
                              background: annotation.selectedCategories
                                .includes(cat.key)
                                ? "#FF9900" : "white",
                              border: annotation.selectedCategories
                                .includes(cat.key)
                                ? "1px solid #EC7211"
                                : "1px solid #D5DBDB",
                              color: annotation.selectedCategories
                                .includes(cat.key)
                                ? "black" : "#687078" }}>
                            {cat.label}
                          </button>
                        ))}
                      </div>

                      {annotation.selectedCategories.map(catKey => {
                        const cat = HARM_CATEGORIES.find(
                          c => c.key === catKey
                        );
                        const data =
                          annotation.categoryData[catKey] || {};
                        return (
                          <div key={catKey}
                            style={{ marginBottom: 12, padding: 10,
                              background: "white", borderRadius: 2,
                              border: "1px solid #FF9900" }}>
                            <div style={{ fontWeight: 700,
                              fontSize: 13, color: "#FF9900",
                              marginBottom: 8 }}>
                              {cat?.label}
                            </div>

                            <label style={{ fontSize: 11,
                              fontWeight: 700, display: "block",
                              marginBottom: 4 }}>
                              Intensity *
                            </label>
                            <select style={{ width: "100%",
                              border: "1px solid #aab7b8",
                              borderRadius: 2, padding: "4px 6px",
                              fontSize: 12, marginBottom: 8 }}
                              value={data.intensity || "None"}
                              onChange={e => updateCategoryData(
                                catKey, "intensity", e.target.value
                              )}>
                              {INTENSITY_OPTIONS.map(o => (
                                <option key={o} value={o}>{o}</option>
                              ))}
                            </select>

                            <label style={{ fontSize: 11,
                              fontWeight: 700, display: "block",
                              marginBottom: 4 }}>
                              Severity (0-5) *
                            </label>
                            <div style={{ display: "flex", gap: 8,
                              marginBottom: 8, flexWrap: "wrap" }}>
                              {SEVERITY_OPTIONS.map(s => (
                                <label key={s}
                                  style={{ display: "flex",
                                    alignItems: "center", gap: 3,
                                    cursor: "pointer",
                                    fontSize: 12 }}>
                                  <input type="radio"
                                    name={`severity_${catKey}`}
                                    checked={data.severity === s}
                                    onChange={() =>
                                      updateCategoryData(
                                        catKey, "severity", s
                                      )} />
                                  {s}
                                </label>
                              ))}
                            </div>

                            <label style={{ fontSize: 11,
                              fontWeight: 700, display: "block",
                              marginBottom: 4 }}>
                              Confidence Level *
                            </label>
                            {CONFIDENCE_OPTIONS.map(opt => (
                              <label key={opt}
                                style={{ display: "flex",
                                  alignItems: "center", gap: 6,
                                  cursor: "pointer", fontSize: 11,
                                  marginBottom: 3 }}>
                                <input type="radio"
                                  name={`conf_${catKey}`}
                                  checked={data.confidence === opt}
                                  onChange={() =>
                                    updateCategoryData(
                                      catKey, "confidence", opt
                                    )} />
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
                {annotation.hasHarm !== null && (
                  <div style={{ marginBottom: 16 }}>
                    <label style={{ fontSize: 12, fontWeight: 700,
                      display: "block", marginBottom: 4 }}>
                      Overall Comments (optional)
                    </label>
                    <textarea style={{ width: "100%",
                      border: "1px solid #aab7b8", borderRadius: 2,
                      padding: "8px 10px", fontSize: 12,
                      resize: "vertical", height: 60 }}
                      placeholder="Add any additional notes..."
                      value={annotation.overallComments}
                      onChange={e =>
                        setField("overallComments", e.target.value)} />
                  </div>
                )}

                {/* Submit */}
                {annotation.hasHarm !== null && (
                  <button onClick={handleSubmit}
                    disabled={submitting}
                    style={{ width: "100%",
                      background: submitting ? "#aab7b8" : "#FF9900",
                      border: "1px solid #EC7211", color: "black",
                      padding: "10px 0", borderRadius: 2,
                      fontSize: 14, fontWeight: 700,
                      cursor: submitting
                        ? "not-allowed" : "pointer" }}>
                    {submitting
                      ? "⏳ Submitting..."
                      : batchId
                        ? "Submit & Load Next Task →"
                        : "Submit Task"}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}