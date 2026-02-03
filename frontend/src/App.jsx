import { Navigate, Route, Routes } from 'react-router-dom';
import Login from './pages/Login.jsx';
import AdminProfessors from './pages/AdminProfessors.jsx';
import AccountPrivacy from './pages/AccountPrivacy.jsx';
import PrivacyPolicy from './pages/PrivacyPolicy.jsx';
import Terms from './pages/Terms.jsx';
import ProfessorDashboard from './pages/ProfessorDashboard.jsx';
import AlunoDashboard from './pages/AlunoDashboard.jsx';
import ProfessorExercises from './pages/ProfessorExercises.jsx';
import ProfessorPlans from './pages/ProfessorPlans.jsx';
import ProfessorStudents from './pages/ProfessorStudents.jsx';
import ProfessorReports from './pages/ProfessorReports.jsx';
import ProfessorAssessments from './pages/ProfessorAssessments.jsx';
import AlunoHistory from './pages/AlunoHistory.jsx';
import AlunoLibrary from './pages/AlunoLibrary.jsx';
import { RequireAuth, useAuth } from './context/AuthContext.jsx';

function HomeRedirect() {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (user.type === 'ADMIN') return <Navigate to="/admin/professores" replace />;
  if (user.type === 'ALUNO') return <Navigate to="/aluno/dashboard" replace />;
  return <Navigate to="/professor/dashboard" replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/termos" element={<Terms />} />
      <Route path="/privacidade" element={<PrivacyPolicy />} />
      <Route
        path="/conta"
        element={
          <RequireAuth requireConsent={false}>
            <AccountPrivacy />
          </RequireAuth>
        }
      />
      <Route
        path="/admin/professores"
        element={
          <RequireAuth role="ADMIN">
            <AdminProfessors />
          </RequireAuth>
        }
      />
      <Route
        path="/"
        element={
          <RequireAuth>
            <HomeRedirect />
          </RequireAuth>
        }
      />

      <Route
        path="/professor/dashboard"
        element={
          <RequireAuth role="PROFESSOR">
            <ProfessorDashboard />
          </RequireAuth>
        }
      />
      <Route
        path="/professor/exercicios"
        element={
          <RequireAuth role="PROFESSOR">
            <ProfessorExercises />
          </RequireAuth>
        }
      />
      <Route
        path="/professor/planos"
        element={
          <RequireAuth role="PROFESSOR">
            <ProfessorPlans />
          </RequireAuth>
        }
      />
      <Route
        path="/professor/alunos"
        element={
          <RequireAuth role="PROFESSOR">
            <ProfessorStudents />
          </RequireAuth>
        }
      />
      <Route
        path="/professor/relatorios"
        element={
          <RequireAuth role="PROFESSOR">
            <ProfessorReports />
          </RequireAuth>
        }
      />
      <Route
        path="/professor/avaliacoes"
        element={
          <RequireAuth role="PROFESSOR">
            <ProfessorAssessments />
          </RequireAuth>
        }
      />

      <Route
        path="/aluno/dashboard"
        element={
          <RequireAuth role="ALUNO">
            <AlunoDashboard />
          </RequireAuth>
        }
      />
      <Route
        path="/aluno/historico"
        element={
          <RequireAuth role="ALUNO">
            <AlunoHistory />
          </RequireAuth>
        }
      />
      <Route
        path="/aluno/biblioteca"
        element={
          <RequireAuth role="ALUNO">
            <AlunoLibrary />
          </RequireAuth>
        }
      />

      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}
