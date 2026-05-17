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
    { label: "Datasets", icon: "📂", path: "/admin/datasets" },
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

export default function UserManagement() {
  const [users, setUsers] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editUser, setEditUser] = useState(null);
  const [form, setForm] = useState({ username: "", email: "", password: "" });
  const [editForm, setEditForm] = useState({ username: "", email: "", password: "" });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const navigate = useNavigate();
  const username = localStorage.getItem("username");

  useEffect(() => { fetchUsers(); }, []);

  const fetchUsers = async () => {
    try {
      const res = await API.get("/users/");
      setUsers(res.data);
    } catch {}
  };

  const handleCreateUser = async () => {
    if (!form.username || !form.email || !form.password) {
      setError("All fields are required"); return;
    }
    try {
      await API.post("/users/", form);
      setSuccess(`User "${form.username}" created successfully!`);
      setForm({ username: "", email: "", password: "" });
      setShowForm(false);
      fetchUsers();
    } catch (err) {
      setError(err.response?.data?.detail || "Could not create user");
    }
  };

  const handleEditUser = async () => {
    try {
      const updateData = {};
      if (editForm.username) updateData.username = editForm.username;
      if (editForm.email) updateData.email = editForm.email;
      if (editForm.password) updateData.password = editForm.password;

      await API.put(`/users/${editUser.id}`, updateData);
      setSuccess(`User "${editUser.username}" updated successfully!`);
      setEditUser(null);
      setEditForm({ username: "", email: "", password: "" });
      fetchUsers();
    } catch (err) {
      setError(err.response?.data?.detail || "Could not update user");
    }
  };

  const handleDeactivate = async (id, uname) => {
    if (!confirm(`Deactivate user "${uname}"?`)) return;
    try {
      await API.put(`/users/${id}/deactivate`);
      setSuccess(`User "${uname}" deactivated.`);
      fetchUsers();
    } catch { setError("Could not deactivate user"); }
  };

  const handleLogout = () => { localStorage.clear(); navigate("/login"); };

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
      <AwsTopNav username={username} onLogout={handleLogout} />
      <div style={{ display: "flex", flex: 1 }}>
        <AwsSidebar active="Users" />
        <div style={{ flex: 1, background: "#F2F3F3", padding: 24 }}>

          <div style={{ fontSize: 12, color: "#687078", marginBottom: 16 }}>
            AnnotateHub &gt; <strong>Users</strong>
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

          {/* Create User Form */}
          {showForm && (
            <div style={{ background: "white", border: "1px solid #D5DBDB",
              borderRadius: 2, padding: 20, marginBottom: 16 }}>
              <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 16, marginTop: 0 }}>
                Create New Annotator
              </h3>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 16 }}>
                {[
                  { label: "Username *", key: "username", type: "text", placeholder: "Enter username" },
                  { label: "Email *", key: "email", type: "email", placeholder: "Enter email" },
                  { label: "Password *", key: "password", type: "password", placeholder: "Enter password" },
                ].map(field => (
                  <div key={field.key}>
                    <label style={{ fontSize: 12, fontWeight: 700, display: "block", marginBottom: 4 }}>
                      {field.label}
                    </label>
                    <input className="aws-input" type={field.type} placeholder={field.placeholder}
                      value={form[field.key]}
                      onChange={e => { setForm({...form, [field.key]: e.target.value}); setError(""); }}
                    />
                  </div>
                ))}
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button className="aws-btn-primary" onClick={handleCreateUser}>Create user</button>
                <button className="aws-btn-normal" onClick={() => { setShowForm(false); setError(""); }}>
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Edit User Form */}
          {editUser && (
            <div style={{ background: "white", border: "1px solid #FF9900",
              borderRadius: 2, padding: 20, marginBottom: 16 }}>
              <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 4, marginTop: 0 }}>
                Edit User — {editUser.username}
              </h3>
              <p style={{ fontSize: 12, color: "#687078", marginBottom: 16 }}>
                Leave fields blank to keep current values.
              </p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 16 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 700, display: "block", marginBottom: 4 }}>
                    New Username
                  </label>
                  <input className="aws-input" type="text"
                    placeholder={`Current: ${editUser.username}`}
                    value={editForm.username}
                    onChange={e => setEditForm({...editForm, username: e.target.value})}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 700, display: "block", marginBottom: 4 }}>
                    New Email
                  </label>
                  <input className="aws-input" type="email"
                    placeholder={`Current: ${editUser.email}`}
                    value={editForm.email}
                    onChange={e => setEditForm({...editForm, email: e.target.value})}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 700, display: "block", marginBottom: 4 }}>
                    New Password
                  </label>
                  <input className="aws-input" type="password"
                    placeholder="Enter new password"
                    value={editForm.password}
                    onChange={e => setEditForm({...editForm, password: e.target.value})}
                  />
                </div>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button className="aws-btn-primary" onClick={handleEditUser}>
                  Save Changes
                </button>
                <button className="aws-btn-normal"
                  onClick={() => { setEditUser(null); setEditForm({ username: "", email: "", password: "" }); setError(""); }}>
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Users Table */}
          <div style={{ background: "white", border: "1px solid #D5DBDB", borderRadius: 2 }}>
            <div style={{ padding: "16px 20px", borderBottom: "1px solid #D5DBDB",
              display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>Users ({users.length})</h2>
              <button className="aws-btn-primary"
                onClick={() => { setShowForm(!showForm); setEditUser(null); setError(""); setSuccess(""); }}>
                + Invite member
              </button>
            </div>
            <table className="aws-table" style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th>Username</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map(user => (
                  <tr key={user.id}>
                    <td style={{ fontWeight: 600 }}>{user.username}</td>
                    <td style={{ color: "#687078" }}>{user.email}</td>
                    <td>
                      <span style={{
                        background: user.role === "admin" ? "#EDE7F6" : "#E8F4FD",
                        color: user.role === "admin" ? "#6A1B9A" : "#0073BB",
                        padding: "2px 8px", borderRadius: 2, fontSize: 12, fontWeight: 600
                      }}>
                        {user.role}
                      </span>
                    </td>
                    <td>
                      <span style={{
                        background: user.is_active ? "#d5f5e3" : "#FDEDEC",
                        color: user.is_active ? "#1D8102" : "#D13212",
                        padding: "2px 8px", borderRadius: 2, fontSize: 12, fontWeight: 600
                      }}>
                        {user.is_active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: "flex", gap: 12 }}>
                        <span className="aws-link"
                          onClick={() => {
                            setEditUser(user);
                            setEditForm({ username: "", email: "", password: "" });
                            setShowForm(false);
                            setError("");
                          }}>
                          Edit
                        </span>
                        {user.is_active && user.role !== "admin" && (
                          <span style={{ color: "#D13212", cursor: "pointer", fontSize: 13 }}
                            onClick={() => handleDeactivate(user.id, user.username)}>
                            Deactivate
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}