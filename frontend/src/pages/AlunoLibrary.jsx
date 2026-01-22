import { useEffect, useState } from 'react';
import AppShell from '../components/AppShell.jsx';
import SectionCard from '../components/SectionCard.jsx';
import { getExerciseExplanation, getExercises } from '../api/client.js';

export default function AlunoLibrary() {
  const [exercises, setExercises] = useState([]);
  const [selected, setSelected] = useState(null);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('');

  useEffect(() => {
    getExercises()
      .then(setExercises)
      .catch(() => setError('Erro ao carregar exercícios.'));
  }, []);

  async function handleExplain(id) {
    try {
      const data = await getExerciseExplanation(id);
      setSelected(data);
    } catch (err) {
      setSelected({ name: 'Sem dados', description: 'Não encontramos explicação.' });
    }
  }

  const visibleExercises = exercises.filter((ex) => ex.active !== false);
  const filtered = visibleExercises.filter((ex) =>
    ex.name.toLowerCase().includes(filter.toLowerCase()) ||
    (ex.group || '').toLowerCase().includes(filter.toLowerCase()),
  );

  return (
    <AppShell>
      <div className="mb-4">
        <p className="text-xs text-slate-500 uppercase tracking-wide">Biblioteca</p>
        <h1 className="text-2xl font-bold text-slate-900">O que é esse exercício?</h1>
        <p className="text-sm text-slate-600">Clique em um exercício para ver descrição, dicas e variações.</p>
      </div>

      <SectionCard
        title="Buscar"
        actions={
          <input
            className="border rounded-lg px-3 py-2 text-sm"
            placeholder="Busque por nome ou grupo"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
        }
      >
        {error && <p className="text-red-600 text-sm mb-2">{error}</p>}
        <div className="grid md:grid-cols-3 gap-3">
          {filtered.map((ex) => (
            <button
              key={ex.id}
              onClick={() => handleExplain(ex.id)}
              className="border rounded-lg p-3 text-left hover:border-blue-400 hover:shadow-sm"
            >
              <p className="font-semibold text-slate-800">{ex.name}</p>
              <p className="text-xs text-slate-500">{ex.group || 'Grupo não definido'} • {ex.type}</p>
              {ex.description && <p className="text-xs text-slate-600 mt-1 line-clamp-2">{ex.description}</p>}
              {ex.endurance_params && (
                <div className="text-[11px] text-slate-600 mt-2 space-y-1">
                  {ex.endurance_params.workout_type && <div>Tipo: {ex.endurance_params.workout_type}</div>}
                  {ex.endurance_params.duration_min && <div>Duração: {ex.endurance_params.duration_min} min</div>}
                  {ex.endurance_params.pace_target && <div>Pace alvo: {ex.endurance_params.pace_target}</div>}
                </div>
              )}
            </button>
          ))}
          {filtered.length === 0 && <p className="text-sm text-slate-500">Nenhum exercício encontrado.</p>}
        </div>
      </SectionCard>

      {selected && (
        <SectionCard title={selected.name} description="Detalhes cadastrados pelo professor.">
          <div className="space-y-2 text-sm text-slate-700">
            <div>
              <p className="font-semibold">Descrição</p>
              <p>{selected.description || 'Sem descrição.'}</p>
            </div>
            <div>
              <p className="font-semibold">Dicas</p>
              <p>{selected.tips || 'Sem dicas cadastradas.'}</p>
            </div>
            {selected.endurance_params && (
              <div className="grid md:grid-cols-2 gap-2">
                <div>
                  <p className="font-semibold">Tipo de treino</p>
                  <p>{selected.endurance_params.workout_type || '-'}</p>
                </div>
                <div>
                  <p className="font-semibold">Duração</p>
                  <p>{selected.endurance_params.duration_min ? `${selected.endurance_params.duration_min} min` : '-'}</p>
                </div>
                <div>
                  <p className="font-semibold">Distância</p>
                  <p>{selected.endurance_params.distance_km ? `${selected.endurance_params.distance_km} km` : '-'}</p>
                </div>
                <div>
                  <p className="font-semibold">Zona</p>
                  <p>{selected.endurance_params.intensity_zone || '-'}</p>
                </div>
                <div>
                  <p className="font-semibold">Pace alvo</p>
                  <p>{selected.endurance_params.pace_target || '-'}</p>
                </div>
                <div className="md:col-span-2">
                  <p className="font-semibold">Notas</p>
                  <p>{selected.endurance_params.notes || '-'}</p>
                </div>
              </div>
            )}
            {selected.video_url && (
              <div>
                <p className="font-semibold">Vídeo</p>
                <a className="text-blue-600 underline" href={selected.video_url} target="_blank" rel="noreferrer">
                  Abrir vídeo
                </a>
              </div>
            )}
          </div>
        </SectionCard>
      )}
    </AppShell>
  );
}
