import { useEffect, useState } from 'react';
import AppShell from '../components/AppShell.jsx';
import SectionCard from '../components/SectionCard.jsx';
import { registerStudent, listStudents } from '../api/client.js';

export default function ProfessorStudents() {
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [students, setStudents] = useState([]);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function loadStudents() {
    try {
      const data = await listStudents();
      setStudents(data);
    } catch (err) {
      setError('Erro ao carregar alunos.');
    }
  }

  useEffect(() => {
    loadStudents();
  }, []);

  async function handleRegister(e) {
    e.preventDefault();
    setMessage('');
    setError('');
    try {
      await registerStudent(form);
      setForm({ name: '', email: '', password: '' });
      setMessage('Aluno cadastrado e vinculado.');
      await loadStudents();
    } catch (err) {
      setError('Falha ao cadastrar aluno.');
    }
  }

  return (
    <AppShell>
      <div className="mb-4">
        <p className="text-xs text-slate-500 uppercase tracking-wide">Gestão de alunos</p>
        <h1 className="text-2xl font-bold text-slate-900">Alunos</h1>
        <p className="text-sm text-slate-600">Cadastre e acompanhe quem treina com você.</p>
      </div>

      <SectionCard
        title="Cadastrar novo aluno"
        description="Fluxo seguro: email + senha. O aluno receberá um token JWT no login."
      >
        {error && <p className="text-red-600 text-sm mb-2">{error}</p>}
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
            <label className="block text-sm font-medium mb-1">Senha provisória</label>
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
            >
              Cadastrar aluno
            </button>
          </div>
        </form>
      </SectionCard>

      <SectionCard
        title="Alunos cadastrados"
        description="Lista filtrada pelo professor logado."
      >
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
              {students.map((s) => (
                <tr key={s.id} className="border-b">
                  <td className="py-2 font-mono text-xs text-slate-600">{s.id}</td>
                  <td className="py-2">{s.name}</td>
                  <td>{s.email}</td>
                  <td className="text-xs font-semibold text-blue-700">{s.type}</td>
                </tr>
              ))}
              {students.length === 0 && (
                <tr>
                  <td colSpan={3} className="text-sm text-slate-500 py-3">
                    Nenhum aluno cadastrado para você.
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
