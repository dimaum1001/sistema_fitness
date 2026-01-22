import { useEffect, useState } from 'react';
import AppShell from '../components/AppShell.jsx';
import SectionCard from '../components/SectionCard.jsx';
import { listProfessors, registerProfessor } from '../api/client.js';

export default function AdminProfessors() {
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [professors, setProfessors] = useState([]);
  const [formError, setFormError] = useState('');
  const [listError, setListError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  async function loadProfessors() {
    setRefreshing(true);
    setListError('');
    try {
      const data = await listProfessors();
      setProfessors(data);
    } catch (err) {
      setListError('Erro ao carregar professores.');
    } finally {
      setRefreshing(false);
    }
  }

  useEffect(() => {
    loadProfessors();
  }, []);

  async function handleRegister(e) {
    e.preventDefault();
    setMessage('');
    setFormError('');
    setLoading(true);
    try {
      await registerProfessor(form);
      setForm({ name: '', email: '', password: '' });
      setMessage('Professor cadastrado com sucesso.');
      await loadProfessors();
    } catch (err) {
      setFormError('Falha ao cadastrar professor.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <AppShell>
      <div className="mb-4">
        <p className="text-xs text-slate-500 uppercase tracking-wide">Administracao</p>
        <h1 className="text-2xl font-bold text-slate-900">Professores</h1>
        <p className="text-sm text-slate-600">Crie contas e acompanhe os professores ativos.</p>
      </div>

      <SectionCard
        title="Cadastrar novo professor"
        description="Defina email e senha provisoria para o acesso inicial."
      >
        {formError && <p className="text-red-600 text-sm mb-2">{formError}</p>}
        {message && <p className="text-emerald-600 text-sm mb-2">{message}</p>}
        <form onSubmit={handleRegister} className="grid md:grid-cols-4 gap-3 items-end">
          <div className="md:col-span-1">
            <label className="block text-sm font-medium mb-1">Nome</label>
            <input
              className="w-full border rounded-lg px-3 py-2 text-sm"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
            />
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-medium mb-1">Email</label>
            <input
              type="email"
              className="w-full border rounded-lg px-3 py-2 text-sm"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Senha provisoria</label>
            <input
              type="password"
              className="w-full border rounded-lg px-3 py-2 text-sm"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              required
            />
          </div>
          <div className="md:col-span-4 flex justify-end">
            <button
              type="submit"
              className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-blue-700"
              disabled={loading}
            >
              {loading ? 'Cadastrando...' : 'Cadastrar professor'}
            </button>
          </div>
        </form>
      </SectionCard>

      <SectionCard
        title="Professores cadastrados"
        description={`Total cadastrado: ${professors.length}`}
        actions={(
          <button
            type="button"
            onClick={loadProfessors}
            className="bg-slate-900 text-white px-3 py-2 rounded-lg text-sm font-semibold"
            disabled={refreshing}
          >
            {refreshing ? 'Atualizando...' : 'Atualizar lista'}
          </button>
        )}
      >
        {listError && <p className="text-red-600 text-sm mb-2">{listError}</p>}
        <div className="overflow-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-500 uppercase text-xs">
                <th className="py-2">ID</th>
                <th className="py-2">Nome</th>
                <th>Email</th>
                <th>Tipo</th>
              </tr>
            </thead>
            <tbody>
              {professors.map((p) => (
                <tr key={p.id} className="border-b">
                  <td className="py-2 font-mono text-xs text-slate-600">{p.id}</td>
                  <td className="py-2">{p.name}</td>
                  <td>{p.email}</td>
                  <td className="text-xs font-semibold text-blue-700">{p.type}</td>
                </tr>
              ))}
              {professors.length === 0 && (
                <tr>
                  <td colSpan={4} className="text-sm text-slate-500 py-3">
                    Nenhum professor cadastrado ainda.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </AppShell>
  );
}
