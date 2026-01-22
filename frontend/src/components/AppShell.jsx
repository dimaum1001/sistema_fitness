import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

function NavLink({ to, label }) {
  const location = useLocation();
  const active = location.pathname.startsWith(to);
  return (
    <Link
      to={to}
      className={`px-3 py-1 rounded text-sm font-medium ${active ? 'bg-white text-blue-700 shadow' : 'text-white/90 hover:bg-white/10'}`}
    >
      {label}
    </Link>
  );
}

export default function AppShell({ children }) {
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-gradient-to-r from-blue-700 to-cyan-600 text-white shadow">
        <div className="max-w-6xl mx-auto px-4 py-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-3">
            <div className="font-semibold text-lg">Sistema Fitness Total</div>
            {user && (
              <div className="text-xs bg-white/15 px-2 py-1 rounded-full">
                {user.type === 'ADMIN' ? 'Admin' : user.type === 'PROFESSOR' ? 'Professor' : 'Aluno'}
              </div>
            )}
          </div>
          {user && (
            <nav className="flex flex-wrap items-center gap-2">
              {user.type === 'ADMIN' ? (
                <>
                  <NavLink to="/admin/professores" label="Professores" />
                  <NavLink to="/conta" label="Conta" />
                </>
              ) : user.type === 'PROFESSOR' ? (
                <>
                  <NavLink to="/professor/dashboard" label="Dashboard" />
                  <NavLink to="/professor/alunos" label="Alunos" />
                  <NavLink to="/professor/exercicios" label="Exercicios" />
                  <NavLink to="/professor/planos" label="Planos" />
                  <NavLink to="/professor/relatorios" label="Relatorios" />
                  <NavLink to="/conta" label="Conta" />
                </>
              ) : (
                <>
                  <NavLink to="/aluno/dashboard" label="Meu Treino" />
                  <NavLink to="/aluno/historico" label="Historico" />
                  <NavLink to="/aluno/biblioteca" label="Biblioteca" />
                  <NavLink to="/conta" label="Conta" />
                </>
              )}
              <button
                onClick={() => {
                  logout();
                  navigate('/login');
                }}
                className="px-3 py-1 rounded bg-white text-blue-700 text-sm font-semibold shadow"
              >
                Sair
              </button>
            </nav>
          )}
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-4 py-6">{children}</main>
    </div>
  );
}
