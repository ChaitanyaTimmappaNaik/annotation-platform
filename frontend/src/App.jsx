import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import UserLogin from "./pages/user/Login";
import QueueDashboard from "./pages/user/QueueDashboard";
import AnnotationWorkspace from "./pages/user/AnnotationWorkspace";
import AdminDashboard from "./pages/admin/AdminDashboard";
import ProjectManagement from "./pages/admin/ProjectManagement";
import CreateProject from "./pages/admin/CreateProject";
import UserManagement from "./pages/admin/UserManagement";
import ExportAnnotations from "./pages/admin/ExportAnnotations";
import PlaceholderPage from "./pages/admin/PlaceholderPage";
import BatchManagement from "./pages/admin/BatchManagement";
import TaskManagement from "./pages/admin/TaskManagement";
import Analytics from "./pages/admin/Analytics";
import ReviewQueue from "./pages/admin/ReviewQueue";
import DatasetUpload from "./pages/admin/DatasetUpload";

function ProtectedRoute({ children, requireAdmin = false }) {
  const token = localStorage.getItem("token");
  const role = localStorage.getItem("role");
  if (!token) return <Navigate to="/login" />;
  if (requireAdmin && role !== "admin") return <Navigate to="/queue" />;
  return children;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/login" />} />
        <Route path="/login" element={<UserLogin />} />
        <Route path="/reset-password" element={<UserLogin />} />

        <Route path="/queue" element={
          <ProtectedRoute><QueueDashboard /></ProtectedRoute>
        } />
        <Route path="/annotate/:taskId" element={
          <ProtectedRoute><AnnotationWorkspace /></ProtectedRoute>
        } />

        <Route path="/admin/dashboard" element={
          <ProtectedRoute requireAdmin><AdminDashboard /></ProtectedRoute>
        } />
        <Route path="/admin/projects" element={
          <ProtectedRoute requireAdmin><ProjectManagement /></ProtectedRoute>
        } />
        <Route path="/admin/projects/new" element={
          <ProtectedRoute requireAdmin><CreateProject /></ProtectedRoute>
        } />
        <Route path="/admin/users" element={
          <ProtectedRoute requireAdmin><UserManagement /></ProtectedRoute>
        } />
        <Route path="/admin/export" element={
          <ProtectedRoute requireAdmin><ExportAnnotations /></ProtectedRoute>
        } />
        <Route path="/admin/batches" element={
          <ProtectedRoute requireAdmin><BatchManagement /></ProtectedRoute>
        } />
        <Route path="/admin/tasks" element={
          <ProtectedRoute requireAdmin><TaskManagement /></ProtectedRoute>
        } />
        <Route path="/admin/analytics" element={
          <ProtectedRoute requireAdmin><Analytics /></ProtectedRoute>
        } />
        <Route path="/admin/review" element={
          <ProtectedRoute requireAdmin><ReviewQueue /></ProtectedRoute>
        } />
        <Route path="/admin/datasets" element={
          <ProtectedRoute requireAdmin><DatasetUpload /></ProtectedRoute>
        } />

        <Route path="/admin/settings" element={
          <ProtectedRoute requireAdmin>
            <PlaceholderPage title="Settings" description="Platform configuration." icon="⚙️" active="Settings" />
          </ProtectedRoute>
        } />
        <Route path="/admin/help" element={
          <ProtectedRoute requireAdmin>
            <PlaceholderPage title="Help" description="Documentation and support." icon="❓" active="Help" />
          </ProtectedRoute>
        } />
        <Route path="/admin/usage" element={
          <ProtectedRoute requireAdmin>
            <PlaceholderPage title="Usage Analytics" description="Platform statistics." icon="📈" active="Usage" />
          </ProtectedRoute>
        } />
        <Route path="/admin/ontology" element={
          <ProtectedRoute requireAdmin>
            <PlaceholderPage title="Ontology Manager" description="Manage label ontologies." icon="🏷️" active="Ontology" />
          </ProtectedRoute>
        } />
        <Route path="/admin/api-keys" element={
          <ProtectedRoute requireAdmin>
            <PlaceholderPage title="API Keys" description="Manage API access." icon="🔑" active="API Keys" />
          </ProtectedRoute>
        } />
      </Routes>
    </BrowserRouter>
  );
}