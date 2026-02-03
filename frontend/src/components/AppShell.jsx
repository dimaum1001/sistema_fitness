import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

function NavLink({ to, label }) {
  const location = useLocation();
  const active = location.pathname.startsWith(to);
  return (
    <Link
      to={to}
      className={`w-full sm:w-auto px-3 py-2 sm:py-1 rounded text-base sm:text-sm font-medium text-left ${active ? 'bg-white text-blue-700 shadow' : 'text-white/90 hover:bg-white/10'}`}
    >
      {label}
    </Link>
  );
}

export default function AppShell({ children }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-gradient-to-r from-blue-700 to-cyan-600 text-white shadow">
        <div className="max-w-6xl mx-auto px-3 sm:px-4 py-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-3">
            <div className="font-semibold text-lg">Sistema Fitness Total</div>
            {user && (
              <div className="text-xs bg-white/15 px-2 py-1 rounded-full">
                {user.type === 'ADMIN' ? 'Admin' : user.type === 'PROFESSOR' ? 'Professor' : 'Aluno'}
              </div>
            )}
          </div>
          {user && (
            <button
              type="button"
              className="sm:hidden px-3 py-2 rounded bg-white/15 text-white text-sm font-semibold"
              onClick={() => setMenuOpen((prev) => !prev)}
              aria-controls="primary-navigation"
              aria-expanded={menuOpen}
            >
              {menuOpen ? 'Fechar' : 'Menu'}
            </button>
          )}
          {user && (
            <nav
              id="primary-navigation"
              className={`w-full sm:w-auto ${menuOpen ? 'flex' : 'hidden'} sm:flex flex-col sm:flex-row items-stretch sm:items-center gap-2`}
            >
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
                  <NavLink to="/professor/avaliacoes" label="Avaliacoes" />
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
                className="w-full sm:w-auto px-3 py-2 sm:py-1 rounded bg-white text-blue-700 text-base sm:text-sm font-semibold shadow text-left"
              >
                Sair
              </button>
            </nav>
          )}
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-3 sm:px-4 py-4 sm:py-6">{children}</main>
    </div>
  );
}
