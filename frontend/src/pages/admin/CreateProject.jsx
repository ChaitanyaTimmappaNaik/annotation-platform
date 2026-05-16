import { useState } from "react";
import { useNavigate } from "react-router-dom";
import API from "../../api/client";

export default function CreateProject() {
  const [form, setForm] = useState({
    name: "",
    description: "",
    data_type: "text",
    tags: [],
    ontology: {},
    lock_ontology: false,
    customer_id: ""
  });
  const [tagInput, setTagInput] = useState("");
  const [labels, setLabels] = useState([]);
  const [labelInput, setLabelInput] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const taskTypes = [
    { id: "text",  label: "Text",  icon: "📝", desc: "NER, classification" },
    { id: "image", label: "Image", icon: "🖼️", desc: "Object detection" },
    { id: "video", label: "Video", icon: "🎬", desc: "Frame annotation" },
    { id: "audio", label: "Audio", icon: "🎵", desc: "Transcription" },
  ];

  const addTag = () => {
    if (tagInput.trim() && !form.tags.includes(tagInput.trim())) {
      setForm({ ...form, tags: [...form.tags, tagInput.trim()] });
      setTagInput("");
    }
  };

  const removeTag = (tag) => {
    setForm({ ...form, tags: form.tags.filter(t => t !== tag) });
  };

  const addLabel = () => {
    if (labelInput.trim() && !labels.includes(labelInput.trim())) {
      setLabels([...labels, labelInput.trim()]);
      setLabelInput("");
    }
  };

  const removeLabel = (label) => {
    setLabels(labels.filter(l => l !== label));
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      setError("Project name is required");
      return;
    }
    try {
      await API.post("/projects/", {
        ...form,
        ontology: { labels }
      });
      navigate("/admin/projects");
    } catch (err) {
      setError("Could not create project. Please try again.");
    }
  };

  return (
    <div className="min-h-screen flex bg-gray-50">
      {/* Sidebar */}
      <div className="w-56 bg-white shadow-md flex flex-col">
        <div className="p-6 border-b">
          <h1 className="font-bold text-lg text-blue-600">🏷️ AnnotateHub</h1>
          <p className="text-xs text-gray-500 mt-1">Admin Panel</p>
        </div>
        <nav className="flex-1 p-4 space-y-1">
          {[
            { label: "Home",     icon: "🏠", path: "/admin/dashboard" },
            { label: "Projects", icon: "📁", path: "/admin/projects" },
            { label: "Users",    icon: "👥", path: "/admin/users" },
            { label: "Settings", icon: "⚙️", path: "/admin/settings" },
            { label: "Help",     icon: "❓", path: "/admin/help" },
          ].map(item => (
            <button key={item.label}
              onClick={() => navigate(item.path)}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-gray-600 hover:bg-blue-50 hover:text-blue-600 text-sm">
              <span>{item.icon}</span>
              <span>{item.label}</span>
            </button>
          ))}
        </nav>
      </div>

      {/* Main Content */}
      <div className="flex-1 p-8 max-w-3xl">
        <div className="flex items-center gap-4 mb-6">
          <button onClick={() => navigate("/admin/projects")}
            className="text-blue-500 hover:underline text-sm">
            ← Back
          </button>
          <h2 className="text-2xl font-bold text-gray-800">
            Create New Project
          </h2>
        </div>

        {error && (
          <p className="text-red-500 text-sm mb-4 bg-red-50 p-3 rounded">
            {error}
          </p>
        )}

        <div className="bg-white rounded-xl shadow p-6 space-y-6">
          {/* Task Type Selection */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-3">
              Project Type *
            </label>
            <div className="grid grid-cols-4 gap-3">
              {taskTypes.map(type => (
                <button
                  key={type.id}
                  onClick={() => setForm({ ...form, data_type: type.id })}
                  className={`p-3 rounded-lg border-2 flex flex-col items-center gap-1 transition-all ${
                    form.data_type === type.id
                      ? "border-blue-500 bg-blue-50"
                      : "border-gray-200 hover:border-blue-300"
                  }`}>
                  <span className="text-2xl">{type.icon}</span>
                  <span className="text-sm font-medium">{type.label}</span>
                  <span className="text-xs text-gray-400">{type.desc}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Project Name */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              Project Name *
            </label>
            <input
              type="text"
              placeholder="Enter project name"
              className="w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={form.name}
              onChange={e => setForm({ ...form, name: e.target.value })}
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              Description (optional)
            </label>
            <textarea
              placeholder="Describe the project..."
              className="w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows={3}
              value={form.description}
              onChange={e => setForm({ ...form, description: e.target.value })}
            />
          </div>

          {/* Customer ID */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              Customer ID (optional)
            </label>
            <input
              type="text"
              placeholder="Enter customer ID"
              className="w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={form.customer_id}
              onChange={e => setForm({ ...form, customer_id: e.target.value })}
            />
          </div>

          {/* Tags */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              Tags
            </label>
            <div className="flex gap-2 mb-2">
              <input
                type="text"
                placeholder="Add tag..."
                className="flex-1 border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={tagInput}
                onChange={e => setTagInput(e.target.value)}
                onKeyDown={e => e.key === "Enter" && addTag()}
              />
              <button onClick={addTag}
                className="bg-gray-100 px-3 py-2 rounded text-sm hover:bg-gray-200">
                Add
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {form.tags.map(tag => (
                <span key={tag}
                  className="bg-blue-100 text-blue-700 text-xs px-2 py-1 rounded-full flex items-center gap-1">
                  {tag}
                  <button onClick={() => removeTag(tag)}
                    className="hover:text-blue-900">×</button>
                </span>
              ))}
            </div>
          </div>

          {/* Ontology Labels */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              Annotation Labels (Ontology)
            </label>
            <div className="flex gap-2 mb-2">
              <input
                type="text"
                placeholder="Add label (e.g. PER, ORG, LOC)..."
                className="flex-1 border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={labelInput}
                onChange={e => setLabelInput(e.target.value)}
                onKeyDown={e => e.key === "Enter" && addLabel()}
              />
              <button onClick={addLabel}
                className="bg-gray-100 px-3 py-2 rounded text-sm hover:bg-gray-200">
                Add
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {labels.map(label => (
                <span key={label}
                  className="bg-green-100 text-green-700 text-xs px-2 py-1 rounded-full flex items-center gap-1">
                  {label}
                  <button onClick={() => removeLabel(label)}
                    className="hover:text-green-900">×</button>
                </span>
              ))}
            </div>
          </div>

          {/* Lock Ontology */}
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="lockOntology"
              checked={form.lock_ontology}
              onChange={e => setForm({ ...form, lock_ontology: e.target.checked })}
              className="rounded"
            />
            <label htmlFor="lockOntology"
              className="text-sm text-gray-700 cursor-pointer">
              Lock Ontology (prevent changes after tasks are created)
            </label>
          </div>

          {/* Save Button */}
          <div className="flex gap-3 pt-2">
            <button onClick={handleSave}
              className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700 font-medium">
              Save Project
            </button>
            <button onClick={() => navigate("/admin/projects")}
              className="border text-gray-600 px-6 py-2 rounded hover:bg-gray-50">
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}