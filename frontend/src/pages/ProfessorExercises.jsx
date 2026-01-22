import { useEffect, useState } from 'react';
import AppShell from '../components/AppShell.jsx';
import SectionCard from '../components/SectionCard.jsx';
import { createExercise, deleteExercise, getExerciseExplanation, getExercises, updateExercise } from '../api/client.js';

const options = ['MUSCULACAO', 'CORRIDA', 'PEDAL', 'OUTRO'];
const typeLabels = {
  MUSCULACAO: 'Musculacao',
  CORRIDA: 'Corrida',
  PEDAL: 'Pedal',
  OUTRO: 'Outro',
};
const filterOptions = ['ALL', ...options];

export default function ProfessorExercises() {
  const [exercises, setExercises] = useState([]);
  const [form, setForm] = useState({
    name: '',
    type: 'MUSCULACAO',
    group: '',
    description: '',
    tips: '',
    video_url: '',
    endurance_params: {
      workout_type: '',
      duration_min: '',
      distance_km: '',
      intensity_zone: '',
      pace_target: '',
      terrain: '',
      notes: '',
    },
  });
  const [filter, setFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [detail, setDetail] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  async function loadExercises() {
    try {
      setError('');
      const data = await getExercises();
      setExercises(data);
    } catch (err) {
      setError('Erro ao carregar exercícios.');
    }
  }

  useEffect(() => {
    loadExercises();
  }, []);

  function resetForm() {
    setForm({
      name: '',
      type: 'MUSCULACAO',
      group: '',
      description: '',
      tips: '',
      video_url: '',
      endurance_params: {
        workout_type: '',
        duration_min: '',
        distance_km: '',
        intensity_zone: '',
        pace_target: '',
        terrain: '',
        notes: '',
      },
    });
    setEditingId(null);
  }

  function startEdit(ex) {
    setEditingId(ex.id);
    setForm({
      name: ex.name || '',
      type: ex.type || 'MUSCULACAO',
      group: ex.group || '',
      description: ex.description || '',
      tips: ex.tips || '',
      video_url: ex.video_url || '',
      endurance_params: {
        workout_type: ex.endurance_params?.workout_type || '',
        duration_min: ex.endurance_params?.duration_min || '',
        distance_km: ex.endurance_params?.distance_km || '',
        intensity_zone: ex.endurance_params?.intensity_zone || '',
        pace_target: ex.endurance_params?.pace_target || '',
        terrain: ex.endurance_params?.terrain || '',
        notes: ex.endurance_params?.notes || '',
      },
    });
    setMessage('');
    setError('');
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setMessage('');
    setError('');
    try {
      const payload = { ...form };
      if (payload.type !== 'CORRIDA' && payload.type !== 'PEDAL') {
        payload.endurance_params = null;
      } else {
        payload.endurance_params = {
          workout_type: form.endurance_params.workout_type || null,
          duration_min: form.endurance_params.duration_min || null,
          distance_km: form.endurance_params.distance_km || null,
          intensity_zone: form.endurance_params.intensity_zone || null,
          pace_target: form.endurance_params.pace_target || null,
          terrain: form.endurance_params.terrain || null,
          notes: form.endurance_params.notes || null,
        };
      }

      if (editingId) {
        const updated = await updateExercise(editingId, payload);
        setExercises((prev) => prev.map((ex) => (ex.id === editingId ? updated : ex)));
        setMessage('Exercício atualizado.');
      } else {
        const created = await createExercise(payload);
        setExercises((prev) => [created, ...prev]);
        setMessage('Exercício salvo.');
      }
      resetForm();
    } catch (err) {
      setError('Erro ao salvar exercício.');
    }
  }

  async function handleExplain(id) {
    try {
      const data = await getExerciseExplanation(id);
      setDetail(data);
    } catch (err) {
      setDetail({ name: 'Sem dados', description: 'Não encontramos explicação.' });
    }
  }

  async function handleDeleteExercise(ex) {
    if (!window.confirm(`Excluir exercicio "${ex.name}"?`)) return;
    setMessage('');
    setError('');
    try {
      await deleteExercise(ex.id);
      setExercises((prev) => prev.filter((item) => item.id !== ex.id));
      if (editingId === ex.id) {
        resetForm();
      }
      if (detail && detail.id === ex.id) {
        setDetail(null);
      }
      setMessage('Exercicio excluido.');
    } catch (err) {
      setError('Erro ao excluir exercicio.');
    }
  }

  const visibleExercises = exercises.filter((ex) => ex.active !== false);
  const normalizedFilter = filter.trim().toLowerCase();
  const filtered = visibleExercises.filter((ex) => {
    if (!normalizedFilter) return true;
    return (
      ex.name.toLowerCase().includes(normalizedFilter) ||
      (ex.group || '').toLowerCase().includes(normalizedFilter)
    );
  });
  const normalizeType = (type) => (options.includes(type) ? type : 'OUTRO');
  const counts = options.reduce((acc, type) => {
    acc[type] = 0;
    return acc;
  }, {});
  filtered.forEach((ex) => {
    const type = normalizeType(ex.type);
    counts[type] = (counts[type] || 0) + 1;
  });
  const filteredByType = typeFilter === 'ALL'
    ? filtered
    : filtered.filter((ex) => normalizeType(ex.type) === typeFilter);

  return (
    <AppShell>
      <div className="mb-4">
        <p className="text-xs text-slate-500 uppercase tracking-wide">Biblioteca de exercícios</p>
        <h1 className="text-2xl font-bold text-slate-900">Exercícios</h1>
        <p className="text-sm text-slate-600">Crie, edite, filtre e veja explicações para orientar os alunos.</p>
      </div>

      <SectionCard
        title={editingId ? 'Editar exercício' : 'Criar exercício'}
        description="Preencha os campos principais. Dica e vídeo são opcionais."
        actions={
          editingId && (
            <button
              type="button"
              className="text-sm text-blue-600 underline"
              onClick={() => {
                resetForm();
                setMessage('');
              }}
            >
              Cancelar edição
            </button>
          )
        }
      >
        {error && <p className="text-red-600 text-sm mb-2">{error}</p>}
        {message && <p className="text-emerald-600 text-sm mb-2">{message}</p>}
        <form onSubmit={handleSubmit} className="grid md:grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium mb-1">Nome</label>
            <input
              className="w-full border rounded-lg px-3 py-2 text-sm"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Modalidade</label>
            <select
              className="w-full border rounded-lg px-3 py-2 text-sm"
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value })}
            >
              {options.map((op) => (
                <option key={op} value={op}>{op}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Grupo muscular / capacidade</label>
            <input
              className="w-full border rounded-lg px-3 py-2 text-sm"
              value={form.group}
              onChange={(e) => setForm({ ...form, group: e.target.value })}
              placeholder="Peito, Resistência, etc."
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Vídeo (URL)</label>
            <input
              className="w-full border rounded-lg px-3 py-2 text-sm"
              value={form.video_url}
              onChange={(e) => setForm({ ...form, video_url: e.target.value })}
              placeholder="https://..."
            />
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-medium mb-1">Descrição</label>
            <textarea
              className="w-full border rounded-lg px-3 py-2 text-sm"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={2}
            />
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-medium mb-1">Dicas de execução</label>
            <textarea
              className="w-full border rounded-lg px-3 py-2 text-sm"
              value={form.tips}
              onChange={(e) => setForm({ ...form, tips: e.target.value })}
              rows={2}
            />
          </div>

          {(form.type === 'CORRIDA' || form.type === 'PEDAL') && (
            <div className="md:col-span-2 border rounded-lg p-3 bg-slate-50 space-y-3">
              <div className="flex flex-wrap gap-3">
                <div className="flex-1 min-w-[150px]">
                  <label className="block text-sm font-medium mb-1">Tipo de treino</label>
                  <select
                    className="w-full border rounded-lg px-3 py-2 text-sm"
                    value={form.endurance_params.workout_type}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        endurance_params: { ...form.endurance_params, workout_type: e.target.value },
                      })
                    }
                  >
                    <option value="">Selecione</option>
                    <option value="REGENERATIVO">Regenerativo</option>
                    <option value="INTERVALADO">Intervalado</option>
                    <option value="PROGRESSIVO">Progressivo</option>
                    <option value="LONGO">Longo</option>
                    <option value="TIRO">Tiro</option>
                    <option value="TEMPO_RUN">Tempo/Threshold</option>
                  </select>
                </div>
                <div className="flex-1 min-w-[120px]">
                  <label className="block text-sm font-medium mb-1">Duração (min)</label>
                  <input
                    type="number"
                    className="w-full border rounded-lg px-3 py-2 text-sm"
                    value={form.endurance_params.duration_min}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        endurance_params: { ...form.endurance_params, duration_min: e.target.value },
                      })
                    }
                  />
                </div>
                <div className="flex-1 min-w-[120px]">
                  <label className="block text-sm font-medium mb-1">Distância (km)</label>
                  <input
                    type="number"
                    className="w-full border rounded-lg px-3 py-2 text-sm"
                    value={form.endurance_params.distance_km}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        endurance_params: { ...form.endurance_params, distance_km: e.target.value },
                      })
                    }
                  />
                </div>
                <div className="flex-1 min-w-[120px]">
                  <label className="block text-sm font-medium mb-1">Zona (Z1-Z5)</label>
                  <input
                    className="w-full border rounded-lg px-3 py-2 text-sm"
                    value={form.endurance_params.intensity_zone}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        endurance_params: { ...form.endurance_params, intensity_zone: e.target.value },
                      })
                    }
                    placeholder="Z1, Z2, Z3..."
                  />
                </div>
                <div className="flex-1 min-w-[140px]">
                  <label className="block text-sm font-medium mb-1">Pace/ritmo alvo</label>
                  <input
                    className="w-full border rounded-lg px-3 py-2 text-sm"
                    value={form.endurance_params.pace_target}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        endurance_params: { ...form.endurance_params, pace_target: e.target.value },
                      })
                    }
                    placeholder="ex: 5:20/km"
                  />
                </div>
              </div>
              <div className="flex flex-wrap gap-3">
                <div className="flex-1 min-w-[140px]">
                  <label className="block text-sm font-medium mb-1">Terreno</label>
                  <input
                    className="w-full border rounded-lg px-3 py-2 text-sm"
                    value={form.endurance_params.terrain}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        endurance_params: { ...form.endurance_params, terrain: e.target.value },
                      })
                    }
                    placeholder="Rua, esteira, pista, subida..."
                  />
                </div>
                <div className="flex-1 min-w-[200px]">
                  <label className="block text-sm font-medium mb-1">Notas (intervalos, tiros, etc.)</label>
                  <textarea
                    className="w-full border rounded-lg px-3 py-2 text-sm"
                    rows={2}
                    value={form.endurance_params.notes}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        endurance_params: { ...form.endurance_params, notes: e.target.value },
                      })
                    }
                    placeholder="Ex: 8x400m Z4, pausa 1' trote."
                  />
                </div>
              </div>
            </div>
          )}

          <div className="md:col-span-2 flex justify-end">
            <button
              type="submit"
              className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-blue-700"
            >
              {editingId ? 'Salvar edição' : 'Salvar exercício'}
            </button>
          </div>
        </form>
      </SectionCard>

      <SectionCard
        title="Buscar na biblioteca"
        description="Filtre pelo nome ou grupo. Clique para ver explicação."
        actions={
          <div className="flex flex-col gap-2 sm:items-end">
            <div className="flex flex-wrap gap-2">
              {filterOptions.map((type) => {
                const active = typeFilter === type;
                const label = type === 'ALL' ? 'Todos' : typeLabels[type] || type;
                const count = type === 'ALL' ? filtered.length : counts[type] || 0;
                return (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setTypeFilter(type)}
                    className={`px-3 py-1 rounded-full text-xs font-semibold border transition ${
                      active
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-white text-slate-600 border-slate-200 hover:border-blue-300'
                    }`}
                    aria-pressed={active}
                  >
                    {label} ({count})
                  </button>
                );
              })}
            </div>
            <input
              className="border rounded-lg px-3 py-2 text-sm w-full sm:w-64"
              placeholder="Buscar"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            />
          </div>
        }
      >
        <div className="grid md:grid-cols-3 gap-3">
          {filteredByType.map((ex) => {
            const canManage = Boolean(ex.professor_id);
            return (
              <div
                key={ex.id}
                className="border rounded-lg p-3 text-left hover:border-blue-300 hover:shadow-sm transition space-y-2"
              >
              <div className="flex justify-between items-start gap-2">
                <div className="flex-1">
                  <p className="font-semibold text-slate-800">{ex.name}</p>
                  <p className="text-xs text-slate-500">{ex.group || 'Sem grupo'} • {ex.type}</p>
                </div>
                {canManage && (
                  <button
                    className="text-xs text-blue-600 underline"
                    onClick={() => startEdit(ex)}
                    type="button"
                  >
                    Editar
                  </button>
                )}
              </div>
              {ex.description && <p className="text-xs text-slate-600 line-clamp-2">{ex.description}</p>}
              {ex.endurance_params && (
                <div className="text-[11px] text-slate-600 space-y-1">
                  {ex.endurance_params.workout_type && <div>Tipo: {ex.endurance_params.workout_type}</div>}
                  {ex.endurance_params.duration_min && <div>Duração: {ex.endurance_params.duration_min} min</div>}
                  {ex.endurance_params.distance_km && <div>Distância: {ex.endurance_params.distance_km} km</div>}
                  {ex.endurance_params.pace_target && <div>Pace alvo: {ex.endurance_params.pace_target}</div>}
                  {ex.endurance_params.intensity_zone && <div>Zona: {ex.endurance_params.intensity_zone}</div>}
                </div>
              )}
              <div className="flex gap-2">
                <button
                  onClick={() => handleExplain(ex.id)}
                  className="text-xs text-slate-700 underline"
                  type="button"
                >
                  Ver detalhes
                </button>
                {canManage && (
                  <>
                    <button
                      onClick={() => startEdit(ex)}
                      className="text-xs text-blue-600 underline"
                      type="button"
                    >
                      Editar
                    </button>
                    <button
                      onClick={() => handleDeleteExercise(ex)}
                      className="text-xs text-red-600 underline"
                      type="button"
                    >
                      Excluir
                    </button>
                  </>
                )}
              </div>
              </div>
            );
          })}
          {filteredByType.length === 0 && (
            <p className="text-sm text-slate-500">Nenhum exercício encontrado.</p>
          )}
        </div>
      </SectionCard>

      {detail && (
        <SectionCard
          title={`Explicação: ${detail.name}`}
          description="Conteúdo preenchido pelo professor. Campos vazios retornam um aviso padrão."
        >
          <div className="space-y-2 text-sm text-slate-700">
            <div>
              <p className="font-semibold">Descrição</p>
              <p>{detail.description || 'Sem descrição detalhada cadastrada.'}</p>
            </div>
            <div>
              <p className="font-semibold">Dicas</p>
              <p>{detail.tips || 'Sem dicas cadastradas.'}</p>
            </div>
            {detail.endurance_params && (
              <div className="grid md:grid-cols-2 gap-2">
                <div>
                  <p className="font-semibold">Tipo de treino</p>
                  <p>{detail.endurance_params.workout_type || '-'}</p>
                </div>
                <div>
                  <p className="font-semibold">Duração</p>
                  <p>{detail.endurance_params.duration_min ? `${detail.endurance_params.duration_min} min` : '-'}</p>
                </div>
                <div>
                  <p className="font-semibold">Distância</p>
                  <p>{detail.endurance_params.distance_km ? `${detail.endurance_params.distance_km} km` : '-'}</p>
                </div>
                <div>
                  <p className="font-semibold">Zona</p>
                  <p>{detail.endurance_params.intensity_zone || '-'}</p>
                </div>
                <div>
                  <p className="font-semibold">Pace alvo</p>
                  <p>{detail.endurance_params.pace_target || '-'}</p>
                </div>
                <div>
                  <p className="font-semibold">Terreno</p>
                  <p>{detail.endurance_params.terrain || '-'}</p>
                </div>
                <div className="md:col-span-2">
                  <p className="font-semibold">Notas</p>
                  <p>{detail.endurance_params.notes || '-'}</p>
                </div>
              </div>
            )}
            {detail.video_url && (
              <div>
                <p className="font-semibold">Vídeo</p>
                <a className="text-blue-600 underline" href={detail.video_url} target="_blank" rel="noreferrer">
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
