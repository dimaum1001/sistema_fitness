import { useEffect, useMemo, useState } from 'react';
import AppShell from '../components/AppShell.jsx';
import SectionCard from '../components/SectionCard.jsx';
import StatBadge from '../components/StatBadge.jsx';
import { getExercises } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';

const demoComments = [
  { student: 'Aluno Teste', comment: 'Treino pesado hoje, RPE 8, mas me senti bem.', date: 'Hoje' },
  { student: 'Maria', comment: 'Corrida leve, ritmo controlado.', date: 'Ontem' },
  { student: 'João', comment: 'Dores leves no ombro, reduzi carga no supino.', date: 'Ontem' },
];

export default function ProfessorDashboard() {
  const [exercises, setExercises] = useState([]);
  const [error, setError] = useState('');
  const { user } = useAuth();

  useEffect(() => {
    (async () => {
      try {
        const data = await getExercises();
        setExercises(data);
      } catch (err) {
        setError('Erro ao carregar exercícios');
      }
    })();
  }, []);

  const activeExercises = useMemo(
    () => exercises.filter((ex) => ex.active !== false),
    [exercises],
  );

  const stats = useMemo(
    () => ({
      students: 3, // placeholder até termos endpoint de alunos
      weeklySessions: 12,
      completedWeek: 18,
      exercises: activeExercises.length,
    }),
    [activeExercises.length],
  );

  return (
    <AppShell>
      <div className="flex justify-between items-center mb-4">
        <div>
          <p className="text-xs text-slate-500 uppercase tracking-wide">Visão geral</p>
          <h1 className="text-2xl font-bold text-slate-900">Dashboard do Professor</h1>
          <p className="text-sm text-slate-600">
            Gerencie alunos, treinos e acompanhe execuções. Bem-vindo, {user?.name || 'professor'}.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        <StatBadge label="Alunos ativos" value={stats.students} tone="blue" />
        <StatBadge label="Sessões na semana" value={stats.weeklySessions} tone="green" />
        <StatBadge label="Treinos concluídos" value={stats.completedWeek} tone="orange" />
        <StatBadge label="Exercícios na biblioteca" value={stats.exercises} tone="purple" />
      </div>

      <SectionCard
        title="Próximas ações"
        description="Passos rápidos para colocar um aluno em movimento."
      >
        <ol className="list-decimal list-inside text-sm text-slate-700 space-y-1">
          <li>Cadastre um aluno e vincule a você.</li>
          <li>Crie um plano de treino e adicione sessões (Treino A, Corrida terça...).</li>
          <li>Monte os exercícios da sessão e compartilhe com o aluno.</li>
          <li>Acompanhe execuções e feedbacks de esforço (RPE).</li>
        </ol>
      </SectionCard>

      <SectionCard title="Biblioteca rápida de exercícios" description="Suas entradas mais recentes.">
        {error && <p className="text-red-600 text-sm mb-2">{error}</p>}
        <div className="grid md:grid-cols-2 gap-3">
          {activeExercises.slice(0, 6).map((ex) => (
            <div key={ex.id} className="border rounded-lg p-3">
              <div className="flex justify-between items-start">
                <div>
                  <p className="font-semibold text-slate-800">{ex.name}</p>
                  <p className="text-xs uppercase tracking-wide text-slate-500">{ex.type}</p>
                </div>
                <span className="text-[10px] bg-slate-100 text-slate-700 px-2 py-1 rounded">
                  {ex.group || 'Sem grupo'}
                </span>
              </div>
              {ex.description && <p className="text-sm text-slate-600 mt-1 line-clamp-2">{ex.description}</p>}
            </div>
          ))}
          {activeExercises.length === 0 && (
            <p className="text-sm text-slate-600">Nenhum exercício cadastrado ainda.</p>
          )}
        </div>
      </SectionCard>

      <SectionCard title="Comentários recentes" description="Feedback dos alunos ajuda a ajustar o plano.">
        <div className="space-y-2">
          {demoComments.map((c, idx) => (
            <div key={idx} className="border border-slate-100 rounded-lg p-3 bg-slate-50">
              <div className="flex justify-between text-xs text-slate-500 mb-1">
                <span>{c.student}</span>
                <span>{c.date}</span>
              </div>
              <p className="text-sm text-slate-800">{c.comment}</p>
            </div>
          ))}
        </div>
      </SectionCard>
    </AppShell>
  );
}
