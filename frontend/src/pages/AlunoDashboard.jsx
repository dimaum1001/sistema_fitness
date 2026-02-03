import { useEffect, useMemo, useRef, useState } from 'react';
import AppShell from '../components/AppShell.jsx';
import SectionCard from '../components/SectionCard.jsx';
import {
  createExecution,
  getMyLastExercises,
  getStudentAgenda,
  listMyExecutions,
} from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';

const HISTORY_FILTERS = [
  { value: '7d', label: 'Ultima semana' },
  { value: '30d', label: 'Ultimo mes' },
  { value: 'all', label: 'Tudo' },
];

const SESSION_TYPE_LABELS = {
  MUSCULACAO: 'Musculacao',
  CORRIDA: 'Corrida',
  PEDAL: 'Pedal',
  OUTRO: 'Outros',
};

const SESSION_TYPE_ORDER = ['MUSCULACAO', 'CORRIDA', 'PEDAL', 'OUTRO'];

const resolveSessionType = (value) => {
  const text = String(value || '').toUpperCase();
  if (text.includes('CORRIDA')) return 'CORRIDA';
  if (text.includes('PEDAL')) return 'PEDAL';
  if (text.includes('MUSC')) return 'MUSCULACAO';
  return 'OUTRO';
};

const hasMeaningfulValue = (value) => {
  if (value === null || value === undefined) return false;
  if (typeof value === 'string') return value.trim() !== '';
  return true;
};

const resolvePerformedValue = (primary, secondary, fallback) => {
  if (hasMeaningfulValue(primary)) return primary;
  if (hasMeaningfulValue(secondary)) return secondary;
  if (hasMeaningfulValue(fallback)) return fallback;
  return '';
};

const normalizeBisetGroup = (value) => String(value || '').trim().toUpperCase();

const getExerciseBisetGroup = (exercise) => normalizeBisetGroup(exercise?.params?.biset_group);

const shouldApplyRestForExercise = (session, exercise) => {
  const group = getExerciseBisetGroup(exercise);
  if (!group || !session?.exercises?.length) return true;
  const currentOrder = Number(exercise?.order) || 0;
  const currentId = Number(exercise?.id) || 0;
  return !session.exercises.some((item) => {
    if (!item) return false;
    if (Number(item.id) === currentId) return false;
    if (getExerciseBisetGroup(item) !== group) return false;
    const itemOrder = Number(item.order) || 0;
    if (itemOrder > currentOrder) return true;
    return itemOrder === currentOrder && Number(item.id) > currentId;
  });
};

const getOrderedSessionExercises = (session) => (
  [...(session?.exercises || [])].sort(
    (a, b) => (Number(a?.order) || 0) - (Number(b?.order) || 0) || (Number(a?.id) || 0) - (Number(b?.id) || 0),
  )
);

const getBisetMetaByExerciseId = (session) => {
  const grouped = {};
  getOrderedSessionExercises(session).forEach((exercise) => {
    const group = getExerciseBisetGroup(exercise);
    if (!group) return;
    if (!grouped[group]) grouped[group] = [];
    grouped[group].push(exercise);
  });
  const map = {};
  Object.entries(grouped).forEach(([group, items]) => {
    items.forEach((exercise, idx) => {
      map[exercise.id] = {
        group,
        position: idx + 1,
        total: items.length,
        isLast: idx === items.length - 1,
        nextExercise: items[idx + 1] || null,
      };
    });
  });
  return map;
};

export default function AlunoDashboard() {
  const { user } = useAuth();
  const [agenda, setAgenda] = useState([]);
  const [studentId, setStudentId] = useState(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [historyFilter, setHistoryFilter] = useState('7d');
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState('');
  const [historyExecutions, setHistoryExecutions] = useState([]);
  const [selectedSequence, setSelectedSequence] = useState('');
  const [savingExecution, setSavingExecution] = useState(false);
  const [setLines, setSetLines] = useState({});
  const [lastByExercise, setLastByExercise] = useState({});
  const setLinesRef = useRef({});
  const autoAdvanceRef = useRef('');
  const [activeSession, setActiveSession] = useState(null); // { sessionId, startedAt, elapsed, exerciseIndex, setStatus, completedExercises }
  const [restTimer, setRestTimer] = useState(null); // { exerciseId, setIdx, startedAt, targetMs, remainingMs, running }

  async function loadAgenda() {
    try {
      setError('');
      const [data, lastExercises] = await Promise.all([
        getStudentAgenda(null),
        getMyLastExercises().catch(() => []),
      ]);
      setAgenda(data);
      setLinesRef.current = {};
      setSetLines({});
      const map = {};
      (lastExercises || []).forEach((item) => {
        map[item.exercise_id] = item;
      });
      setLastByExercise(map);
      setActiveSession(null);
      setRestTimer(null);
      setMessage('');
      autoAdvanceRef.current = '';
      setSelectedSequence((prev) => {
        if (prev) return prev;
        const ordered = [...data].sort(
          (a, b) => (Number(a.sequence) || 0) - (Number(b.sequence) || 0) || a.id - b.id,
        );
        const firstSeq = ordered[0]?.sequence;
        return firstSeq ? String(firstSeq) : '';
      });
      setStudentId(data[0]?.student_id || null);
    } catch (err) {
      setError('Nao foi possivel carregar seu treino.');
    }
  }

  async function loadHistory() {
    setHistoryError('');
    setHistoryLoading(true);
    try {
      const data = await listMyExecutions();
      setHistoryExecutions(data);
    } catch {
      setHistoryError('Nao foi possivel carregar o historico.');
    } finally {
      setHistoryLoading(false);
    }
  }

  useEffect(() => {
    loadAgenda();
    loadHistory();
  }, []);

  const orderedAgenda = useMemo(
    () =>
      [...agenda].sort(
        (a, b) => (Number(a.sequence) || 0) - (Number(b.sequence) || 0) || a.id - b.id,
      ),
    [agenda],
  );

  const sessionsByType = useMemo(() => {
    const groups = {
      MUSCULACAO: [],
      CORRIDA: [],
      PEDAL: [],
      OUTRO: [],
    };
    orderedAgenda.forEach((session) => {
      const key = resolveSessionType(session.main_type);
      if (!groups[key]) groups[key] = [];
      groups[key].push(session);
    });
    return groups;
  }, [orderedAgenda]);

  const treinoDoDia = useMemo(() => {
    if (!orderedAgenda.length) return null;
    if (selectedSequence) {
      const found = orderedAgenda.find(
        (s) => String(s.sequence || '') === String(selectedSequence),
      );
      if (found) return found;
    }
    return orderedAgenda[0] || null;
  }, [orderedAgenda, selectedSequence]);

  const filteredHistory = useMemo(() => {
    const sorted = [...historyExecutions].sort((a, b) => {
      const at = a.executed_at ? Date.parse(a.executed_at) : 0;
      const bt = b.executed_at ? Date.parse(b.executed_at) : 0;
      return bt - at;
    });
    if (historyFilter === 'all') return sorted;
    const days = historyFilter === '7d' ? 7 : 30;
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
    return sorted.filter((exec) => {
      if (!exec.executed_at) return false;
      const ts = Date.parse(exec.executed_at);
      if (Number.isNaN(ts)) return false;
      return ts >= cutoff;
    });
  }, [historyExecutions, historyFilter]);

  const renderSessionCard = (s) => {
    const isActive = activeSession?.sessionId === s.id;
    const currentExercise = isActive ? s.exercises[activeSession.exerciseIndex] : null;
    const isChosen = treinoDoDia?.id === s.id;
    const bisetMetaByExerciseId = getBisetMetaByExerciseId(s);
    const currentBisetMeta = currentExercise ? bisetMetaByExerciseId[currentExercise.id] : null;
    const nextExerciseInSession = isActive ? s.exercises[activeSession.exerciseIndex + 1] : null;
    const nextBisetMeta = nextExerciseInSession ? bisetMetaByExerciseId[nextExerciseInSession.id] : null;

    return (
      <div key={s.id} className={`border rounded-lg p-3 bg-white space-y-3 ${isChosen ? 'ring-2 ring-blue-200' : ''}`}>
        <div className="flex justify-between items-start gap-2">
          <div>
            <p className="text-xs uppercase text-slate-500">Treino {s.sequence || '?'}</p>
            <p className="font-semibold text-slate-800">{s.name}</p>
            <p className="text-sm text-slate-600">{s.main_type || 'Modalidade nao informada'}</p>
            {s.notes && <p className="text-xs text-slate-500 mt-1 whitespace-pre-line">{s.notes}</p>}
          </div>
          <button
            className="bg-blue-600 text-white px-3 py-2 sm:py-1 rounded text-sm sm:text-xs"
            onClick={() => startSession(s)}
          >
            {isActive ? 'Reiniciar' : 'Iniciar sessao'}
          </button>
        </div>

        {isActive && (
          <div className="border rounded p-3 bg-slate-50 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="font-semibold">Tempo</span>
              <span className="font-mono">{formatElapsed(activeSession.elapsed)}</span>
            </div>
            {(() => {
              const currentRest = restTimer && restTimer.exerciseId === currentExercise?.id ? restTimer : null;
              const shouldApplyRest = currentExercise ? shouldApplyRestForExercise(s, currentExercise) : false;
              const plannedRestMs = currentExercise && shouldApplyRest ? parseRestSeconds(currentExercise.params?.rest) * 1000 : 0;
              const displayMs = currentRest ? currentRest.remainingMs : plannedRestMs;
              const bisetWithoutRest = currentBisetMeta && !shouldApplyRest;
              const statusLabel = currentRest?.running
                ? 'Contando'
                : currentRest
                  ? 'Descanso concluido'
                  : plannedRestMs > 0
                    ? 'Aguardando'
                    : bisetWithoutRest
                      ? 'No fim do biset'
                      : 'Sem descanso';
              return (
                <div className="flex items-center justify-between text-sm">
                  <span className="font-semibold">Descanso</span>
                  <div className="flex items-center gap-2">
                    <span className="font-mono">{formatCountdown(displayMs)}</span>
                    <span className="text-xs text-slate-500">{statusLabel}</span>
                  </div>
                </div>
              );
            })()}
            {currentExercise ? (
              <div className="space-y-2">
                <div className="flex justify-between items-start gap-2">
                  <div>
                    <p className="font-semibold text-slate-800">{currentExercise.order}. {currentExercise.exercise.name}</p>
                    <p className="text-[11px] text-slate-500">{currentExercise.exercise.type}</p>
                  </div>
                  <div className="text-xs text-slate-600">{activeSession.exerciseIndex + 1} / {s.exercises.length}</div>
                </div>
                {currentBisetMeta && (
                  <p className="text-[11px] text-slate-600">
                    Biset {currentBisetMeta.group} ({currentBisetMeta.position}/{currentBisetMeta.total})
                    {currentBisetMeta.nextExercise
                      ? ` -> proximo: ${currentBisetMeta.nextExercise.exercise?.name || 'exercicio'}`
                      : ''}
                    {!shouldApplyRestForExercise(s, currentExercise) ? ' | descanso no fim do biset' : ''}
                  </p>
                )}
                {currentExercise.params?.notes && <p className="text-[11px] text-slate-600">Notas: {currentExercise.params.notes}</p>}

                {(() => {
                  const isEndurance = currentExercise.exercise.type === 'CORRIDA' || currentExercise.exercise.type === 'PEDAL';
                  const lastPerformed = lastByExercise[currentExercise.exercise?.id];
                  const performed = lastPerformed?.performed;
                  const hasLastPerformed =
                    performed
                    && typeof performed === 'object'
                    && (
                      (Array.isArray(performed.set_details) && performed.set_details.length > 0)
                      || hasMeaningfulValue(performed.load)
                      || hasMeaningfulValue(performed.reps)
                    );
                  if (isEndurance) {
                    return (
                      <div className="space-y-2 text-[11px] text-slate-700">
                        {currentExercise.params?.duration_min && <div>Duracao: {currentExercise.params.duration_min} min</div>}
                        {currentExercise.params?.distance_km && <div>Distancia: {currentExercise.params.distance_km} km</div>}
                        {currentExercise.params?.pace_target && <div>Pace alvo: {currentExercise.params.pace_target}</div>}
                        {currentExercise.params?.intensity_zone && <div>Zona: {currentExercise.params.intensity_zone}</div>}
                        {currentExercise.params?.notes && <div>Notas: {currentExercise.params.notes}</div>}
                      </div>
                    );
                  }

                  return (
                    <div className="space-y-2 text-[11px] text-slate-700">
                      {hasLastPerformed && (
                        <div className="flex items-center justify-between gap-2 bg-slate-50 border rounded px-2 py-1">
                          <span>Ultimo treino disponivel para este exercicio.</span>
                          <button
                            type="button"
                            className="text-blue-600 underline text-sm sm:text-xs"
                            onClick={() => applyLastPerformed(currentExercise)}
                          >
                            Carregar ultimo treino
                          </button>
                        </div>
                      )}
                      {(setLines[currentExercise.id] || buildSets(currentExercise)).map((row, idx) => {
                        const statusArr = activeSession.setStatus[currentExercise.id] || [];
                        const status = statusArr[idx] || 'pending';
                        const checked = status !== 'pending';
                        return (
                          <div key={idx} className="grid grid-cols-4 gap-2 items-center">
                            <label className="col-span-1 flex items-center gap-2">
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => toggleSetDone(currentExercise, idx)}
                              />
                              <span>Serie {idx + 1}</span>
                            </label>
                            <input
                              className="col-span-1 border rounded px-2 py-1 text-sm"
                              value={row.reps || ''}
                              placeholder="Reps"
                              onChange={(e) => updateSetLine(currentExercise, idx, 'reps', e.target.value)}
                            />
                            <input
                              className="col-span-1 border rounded px-2 py-1 text-sm"
                              value={row.load || ''}
                              placeholder="Carga"
                              onChange={(e) => updateSetLine(currentExercise, idx, 'load', e.target.value)}
                            />
                            <span className="col-span-1 text-right text-slate-500">
                              {status === 'done' ? 'Concluida' : status === 'resting' ? 'Em descanso' : 'Em progresso'}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}

                <div className="flex justify-end gap-2 text-sm sm:text-xs">
                  {(() => {
                    const statusArr = activeSession.setStatus[currentExercise.id] || [];
                    const hasPending = statusArr.some((status) => status === 'pending');
                    const isEndurance = currentExercise.exercise?.type === 'CORRIDA' || currentExercise.exercise?.type === 'PEDAL';
                    const isLastInSession = activeSession.exerciseIndex + 1 >= s.exercises.length;
                    const sameBisetAsNext = Boolean(
                      currentBisetMeta
                      && nextBisetMeta
                      && currentBisetMeta.group === nextBisetMeta.group,
                    );
                    let finishLabel = 'Finalizar exercicio';
                    if (isLastInSession) finishLabel = 'Finalizar sessao';
                    else if (sameBisetAsNext) finishLabel = `Ir para ${nextBisetMeta.group}${nextBisetMeta.position}`;
                    else if (currentBisetMeta?.isLast) finishLabel = 'Finalizar biset';

                    return (
                      <>
                        {!isEndurance && hasPending && (
                          <button
                            type="button"
                            className="bg-slate-200 text-slate-700 px-3 py-2 sm:py-1 rounded"
                            onClick={() => completeAllSets(s, currentExercise)}
                          >
                            Concluir todas as series
                          </button>
                        )}
                        <button
                          className="bg-emerald-600 text-white px-3 py-2 sm:py-1 rounded"
                          onClick={() => finishExercise(s, currentExercise)}
                          disabled={savingExecution}
                        >
                          {finishLabel}
                        </button>
                      </>
                    );
                  })()}
                </div>
              </div>
            ) : (
              <p className="text-sm text-emerald-700">Sessao concluida! Tempo total: {formatElapsed(activeSession?.elapsed)}</p>
            )}
          </div>
        )}

        {isActive ? (
          <div className="mt-1 space-y-2">
            <p className="text-xs uppercase text-slate-500">Fila do treino</p>
            {s.exercises.map((ex, idx) => {
              const status =
                idx < activeSession.exerciseIndex
                  ? 'feito'
                  : idx === activeSession.exerciseIndex
                    ? 'agora'
                    : 'proximo';
              const isEndurance = ex.exercise.type === 'CORRIDA' || ex.exercise.type === 'PEDAL';
              const summaryParts = [];
              if (isEndurance) {
                if (ex.params?.duration_min) summaryParts.push(`${ex.params.duration_min} min`);
                if (ex.params?.distance_km) summaryParts.push(`${ex.params.distance_km} km`);
                if (ex.params?.pace_target) summaryParts.push(`pace ${ex.params.pace_target}`);
              } else {
                const bisetMeta = bisetMetaByExerciseId[ex.id];
                if (ex.params?.sets || ex.params?.reps) summaryParts.push(`${ex.params?.sets || '?'}x${ex.params?.reps || '?'}`);
                if (ex.params?.load) summaryParts.push(ex.params.load);
                if (bisetMeta) summaryParts.push(`biset ${bisetMeta.group}${bisetMeta.position}/${bisetMeta.total}`);
                if (ex.params?.rest && shouldApplyRestForExercise(s, ex)) summaryParts.push(`desc ${ex.params.rest}`);
              }
              return (
                <div key={ex.id} className="border rounded px-3 py-2 bg-white text-xs flex justify-between">
                  <div>
                    <p className="font-semibold text-slate-800">
                      {ex.order}. {ex.exercise.name}
                      {bisetMetaByExerciseId[ex.id] && (
                        <span className="ml-2 inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-semibold text-blue-700">
                          {bisetMetaByExerciseId[ex.id].group}{bisetMetaByExerciseId[ex.id].position}/{bisetMetaByExerciseId[ex.id].total}
                        </span>
                      )}
                    </p>
                    <p className="text-[11px] text-slate-600">{summaryParts.join(' - ') || ex.exercise.type}</p>
                  </div>
                  <span className="text-[11px] text-slate-500 uppercase">{status}</span>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="mt-1 space-y-2">
            {s.exercises.map((ex) => {
              const endurance = ex.exercise.type === 'CORRIDA' || ex.exercise.type === 'PEDAL';
              const setDetails = Array.isArray(ex.params?.set_details) ? ex.params.set_details : [];
              const bisetMeta = bisetMetaByExerciseId[ex.id];
              const summary = [];
              if (ex.params?.sets || ex.params?.reps) summary.push(`${ex.params?.sets || '?'}x${ex.params?.reps || '?'}`);
              if (ex.params?.load) summary.push(ex.params.load);
              if (bisetMeta) summary.push(`biset ${bisetMeta.group}${bisetMeta.position}/${bisetMeta.total}`);
              if (ex.params?.rest && shouldApplyRestForExercise(s, ex)) summary.push(`desc ${ex.params.rest}`);
              if (ex.params?.effort) summary.push(ex.params.effort);

              return (
                <div key={ex.id} className="border rounded px-3 py-2 bg-slate-50 text-xs text-slate-700">
                  <div className="flex justify-between gap-2 flex-wrap">
                    <span className="font-semibold">
                      {ex.order}. {ex.exercise.name}
                      {bisetMetaByExerciseId[ex.id] && (
                        <span className="ml-2 inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-semibold text-blue-700">
                          {bisetMetaByExerciseId[ex.id].group}{bisetMetaByExerciseId[ex.id].position}/{bisetMetaByExerciseId[ex.id].total}
                        </span>
                      )}
                    </span>
                    <span className="text-slate-500">{ex.exercise.type}</span>
                  </div>
                  {endurance ? (
                    <div className="mt-1 space-y-1">
                      {ex.params?.duration_min && <div>Duracao: {ex.params.duration_min} min</div>}
                      {ex.params?.distance_km && <div>Distancia: {ex.params.distance_km} km</div>}
                      {ex.params?.pace_target && <div>Pace: {ex.params.pace_target}</div>}
                      {ex.params?.intensity_zone && <div>Zona: {ex.params.intensity_zone}</div>}
                      {ex.params?.notes && <div>Notas: {ex.params.notes}</div>}
                    </div>
                  ) : (
                    <div className="mt-1 space-y-1">
                      <div className="text-[11px] text-slate-600">{summary.join(' - ') || 'Siga orientacoes do professor.'}</div>
                      {setDetails.length > 0 && (
                        <div className="text-[11px] text-slate-600">
                          Linhas de series:
                          {setDetails.map((row, idx) => (
                            <div key={idx}>#{idx + 1}: {row.reps || '-'} reps - {row.load || '-'} carga</div>
                          ))}
                        </div>
                      )}
                      {(ex.params?.load_progression_type || ex.params?.load_progression_step) && (
                        <div className="text-[11px] text-slate-600">
                          Ajuste de carga: {ex.params?.load_progression_type || 'sem tendencia'} {ex.params?.load_progression_step || ''}
                        </div>
                      )}
                      {(ex.params?.reps_progression_type || ex.params?.reps_progression_step) && (
                        <div className="text-[11px] text-slate-600">
                          Ajuste de reps: {ex.params?.reps_progression_type || 'sem tendencia'} {ex.params?.reps_progression_step || ''}
                        </div>
                      )}
                      {bisetMeta && <div className="text-[11px] text-slate-600">Biset: Grupo {bisetMeta.group} ({bisetMeta.position}/{bisetMeta.total})</div>}
                      {ex.params?.notes && <div className="text-[11px] text-slate-600">Notas: {ex.params.notes}</div>}
                    </div>
                  )}
                </div>
              );
            })}
            {s.exercises.length === 0 && <p className="text-xs text-slate-500">Nenhum exercicio nesta sessao.</p>}
          </div>
        )}
      </div>
    );
  };

  useEffect(() => {
    if (!activeSession) return;
    const id = setInterval(() => {
      setActiveSession((prev) => {
        if (!prev) return null;
        return { ...prev, elapsed: Date.now() - prev.startedAt };
      });
    }, 1000);
    return () => clearInterval(id);
  }, [activeSession]);

  useEffect(() => {
    if (!restTimer?.running) return;
    const id = setInterval(() => {
      setRestTimer((prev) => {
        if (!prev?.running) return prev;
        const remaining = prev.targetMs - (Date.now() - prev.startedAt);
        if (remaining <= 0) {
          // Marca set como concluido quando descanso termina
          setActiveSession((curr) => {
            if (!curr) return curr;
            const nextStatus = { ...curr.setStatus };
            const arr = nextStatus[prev.exerciseId] ? [...nextStatus[prev.exerciseId]] : [];
            if (arr[prev.setIdx] === 'resting') arr[prev.setIdx] = 'done';
            nextStatus[prev.exerciseId] = arr;
            return { ...curr, setStatus: nextStatus };
          });
          return { ...prev, remainingMs: 0, running: false };
        }
        return { ...prev, remainingMs: remaining };
      });
    }, 200);
    return () => clearInterval(id);
  }, [restTimer?.running]);

  useEffect(() => {
    if (!activeSession) {
      autoAdvanceRef.current = '';
      return;
    }
    const session = agenda.find((s) => s.id === activeSession.sessionId);
    if (!session) return;
    const exercise = session.exercises[activeSession.exerciseIndex];
    if (!exercise) return;
    const exerciseType = exercise.exercise?.type;
    if (exerciseType === 'CORRIDA' || exerciseType === 'PEDAL') return;

    const statusArr = activeSession.setStatus[exercise.id] || [];
    if (!statusArr.length) return;

    const hasPending = statusArr.some((st) => st === 'pending' || st === 'resting');
    const key = `${session.id}:${exercise.id}`;
    if (hasPending) {
      if (autoAdvanceRef.current === key) autoAdvanceRef.current = '';
      return;
    }

    if (autoAdvanceRef.current === key) return;
    autoAdvanceRef.current = key;
    finishExercise(session, exercise);
  }, [activeSession?.setStatus, activeSession?.exerciseIndex, activeSession?.sessionId, agenda]);

  function formatElapsed(ms = 0) {
    const totalSec = Math.floor(ms / 1000);
    const h = String(Math.floor(totalSec / 3600)).padStart(2, '0');
    const m = String(Math.floor((totalSec % 3600) / 60)).padStart(2, '0');
    const s = String(totalSec % 60).padStart(2, '0');
    return `${h}:${m}:${s}`;
  }

  function formatCountdown(ms = 0) {
    const totalSec = Math.max(0, Math.floor(ms / 1000));
    const m = String(Math.floor(totalSec / 60)).padStart(2, '0');
    const s = String(totalSec % 60).padStart(2, '0');
    return `${m}:${s}`;
  }

  function parseRestSeconds(rest) {
    if (!rest) return 0;
    if (typeof rest === 'number') return rest;
    const str = String(rest).trim();
    if (str.includes(':')) {
      const [m, s = '0'] = str.split(':');
      const min = parseInt(m, 10) || 0;
      const sec = parseInt(s, 10) || 0;
      return min * 60 + sec;
    }
    const match = str.match(/([\d.,]+)/);
    if (match) {
      const num = parseFloat(match[1].replace(',', '.'));
      return Number.isNaN(num) ? 0 : num;
    }
    return 0;
  }

  function buildSets(ex) {
    if (Array.isArray(ex.params?.set_details)) return ex.params.set_details;
    if (Number(ex.params?.sets) > 0) {
      return Array.from({ length: Number(ex.params.sets) }).map(() => ({
        reps: ex.params?.reps || '',
        load: ex.params?.load || '',
      }));
    }
    if (ex.params?.reps || ex.params?.load) {
      return [{ reps: ex.params?.reps || '', load: ex.params?.load || '' }];
    }
    return [];
  }

  function mergeSetDetails(planned, performed, fallback = {}) {
    const plannedArr = Array.isArray(planned) ? planned : [];
    const performedArr = Array.isArray(performed) ? performed : [];
    const targetLen = plannedArr.length || performedArr.length || 0;
    const merged = [];
    for (let i = 0; i < targetLen; i += 1) {
      const p = plannedArr[i] || {};
      const q = performedArr[i] || {};
      const next = { ...p, ...q };
      next.reps = resolvePerformedValue(q.reps, fallback.reps, p.reps);
      next.load = resolvePerformedValue(q.load, fallback.load, p.load);
      merged.push(next);
    }
    return merged;
  }

  function applyLastPerformed(exercise) {
    if (!exercise) return;
    const exerciseId = exercise.exercise?.id;
    if (!exerciseId) return;
    const lastPerformed = lastByExercise[exerciseId];
    const performed = lastPerformed?.performed && typeof lastPerformed.performed === 'object'
      ? lastPerformed.performed
      : {};
    const performedDetails = Array.isArray(performed?.set_details)
      ? performed.set_details
      : [];
    const planned = buildSets(exercise);
    const fallback = { reps: performed?.reps, load: performed?.load };
    let lines = [];
    if (performedDetails.length || planned.length) {
      lines = mergeSetDetails(planned, performedDetails, fallback);
    } else if (hasMeaningfulValue(fallback.reps) || hasMeaningfulValue(fallback.load)) {
      lines = [{
        reps: resolvePerformedValue(fallback.reps),
        load: resolvePerformedValue(fallback.load),
      }];
    } else {
      lines = planned;
    }
    if (!lines.length) lines = [{ reps: '', load: '' }];
    setSetLines((prev) => {
      const merged = { ...prev, [exercise.id]: lines };
      setLinesRef.current = merged;
      return merged;
    });
    setActiveSession((prev) => {
      if (!prev) return prev;
      const currentStatus = prev.setStatus[exercise.id] || [];
      const nextStatus = lines.map((_, idx) => currentStatus[idx] || 'pending');
      return {
        ...prev,
        setStatus: { ...prev.setStatus, [exercise.id]: nextStatus },
      };
    });
  }

  function updateSetLine(exercise, setIdx, field, value) {
    if (!exercise) return;
    const current = setLinesRef.current[exercise.id]
      || setLines[exercise.id]
      || buildSets(exercise);
    const next = (current || []).map((item, i) => (
      i === setIdx ? { ...item, [field]: value } : item
    ));
    setSetLines((prev) => {
      const merged = { ...prev, [exercise.id]: next };
      setLinesRef.current = merged;
      return merged;
    });
  }

  function startSession(session) {
    const setStatus = {};
    const newLines = {};
    session.exercises.forEach((ex) => {
      const exerciseType = ex.exercise?.type;
      const isEndurance = exerciseType === 'CORRIDA' || exerciseType === 'PEDAL';
      const planned = buildSets(ex);
      const lines = !isEndurance && planned.length ? planned : [{ reps: '', load: '' }];
      setStatus[ex.id] = lines.map(() => 'pending');
      newLines[ex.id] = lines;
    });
    setLinesRef.current = newLines;
    setSetLines(newLines);
    setMessage('');
    setRestTimer(null);
    autoAdvanceRef.current = '';
    setActiveSession({
      sessionId: session.id,
      startedAt: Date.now(),
      elapsed: 0,
      exerciseIndex: 0,
      setStatus,
      completedExercises: new Set(),
    });
  }

  function completeAllSets(session, exercise) {
    if (!activeSession || !exercise) return;
    const isEndurance = exercise.exercise?.type === 'CORRIDA' || exercise.exercise?.type === 'PEDAL';
    if (isEndurance) return;

    const plannedLines = setLinesRef.current[exercise.id] || setLines[exercise.id] || buildSets(exercise);
    const lineCount = Math.max(plannedLines.length, 1);
    const shouldApplyRest = shouldApplyRestForExercise(session, exercise);
    const restSec = shouldApplyRest ? parseRestSeconds(exercise.params?.rest) : 0;

    setActiveSession((prev) => {
      if (!prev) return prev;
      const currentStatus = prev.setStatus[exercise.id] || [];
      const targetCount = Math.max(lineCount, currentStatus.length || 0, 1);
      const arr = Array.from({ length: targetCount }, () => 'done');
      let nextRest = null;

      if (restSec > 0) {
        const lastIdx = targetCount - 1;
        arr[lastIdx] = 'resting';
        nextRest = {
          exerciseId: exercise.id,
          setIdx: lastIdx,
          startedAt: Date.now(),
          targetMs: restSec * 1000,
          remainingMs: restSec * 1000,
          running: true,
        };
      }

      setRestTimer(nextRest);
      return {
        ...prev,
        setStatus: {
          ...prev.setStatus,
          [exercise.id]: arr,
        },
      };
    });
  }

  function toggleSetDone(exercise, setIdx) {
    if (!activeSession) return;
    const session = agenda.find((item) => item.id === activeSession.sessionId);
    const shouldApplyRest = shouldApplyRestForExercise(session, exercise);
    const restSec = shouldApplyRest ? parseRestSeconds(exercise.params?.rest) : 0;

    setActiveSession((prev) => {
      if (!prev) return prev;
      const nextStatus = { ...prev.setStatus };
      const arr = nextStatus[exercise.id] ? [...nextStatus[exercise.id]] : [];
      const current = arr[setIdx] || 'pending';
      let nextRest = restTimer;

      if (current === 'pending') {
        if (restSec > 0) {
          arr[setIdx] = 'resting';
          nextRest = {
            exerciseId: exercise.id,
            setIdx,
            startedAt: Date.now(),
            targetMs: restSec * 1000,
            remainingMs: restSec * 1000,
            running: true,
          };
        } else {
          arr[setIdx] = 'done';
          if (nextRest?.exerciseId === exercise.id && nextRest.setIdx === setIdx) {
            nextRest = null;
          }
        }
      } else {
        arr[setIdx] = 'pending';
        if (nextRest?.exerciseId === exercise.id && nextRest.setIdx === setIdx) {
          nextRest = null;
        }
      }

      setRestTimer(nextRest);
      nextStatus[exercise.id] = arr;
      return { ...prev, setStatus: nextStatus };
    });
  }

  function goToNextExercise(session) {
    if (!activeSession) return;
    setActiveSession((prev) => {
      if (!prev) return prev;
      const done = new Set(prev.completedExercises);
      const currentExercise = session.exercises[prev.exerciseIndex];
      if (currentExercise) done.add(currentExercise.id);
      const nextIndex = prev.exerciseIndex + 1;
      if (nextIndex >= session.exercises.length) {
        setMessage(`Sessao "${session.name}" concluida em ${formatElapsed(prev.elapsed)}.`);
        return null;
      }
      setRestTimer(null);
      return { ...prev, exerciseIndex: nextIndex, completedExercises: done };
    });
  }

  // Garante que uma serie marcada como "resting" sempre dispara o cronometro de descanso.
  useEffect(() => {
    if (!activeSession) return;
    const session = agenda.find((s) => s.id === activeSession.sessionId);
    if (!session) return;
    const exercise = session.exercises[activeSession.exerciseIndex];
    if (!exercise) return;
    const statusArr = activeSession.setStatus[exercise.id] || [];
    const restingIdx = statusArr.findIndex((st) => st === 'resting');
    if (restingIdx < 0) return;

    const shouldApplyRest = shouldApplyRestForExercise(session, exercise);
    const restSec = shouldApplyRest ? parseRestSeconds(exercise.params?.rest) : 0;
    if (restSec <= 0) return;

    setRestTimer((prev) => {
      if (prev && prev.exerciseId === exercise.id && prev.setIdx === restingIdx && prev.running) {
        return prev;
      }
      return {
        exerciseId: exercise.id,
        setIdx: restingIdx,
        startedAt: Date.now(),
        targetMs: restSec * 1000,
        remainingMs: restSec * 1000,
        running: true,
      };
    });
  }, [activeSession?.setStatus, activeSession?.exerciseIndex, activeSession?.sessionId, agenda]);

  async function finishExercise(session, exercise) {
    const isLast = activeSession && activeSession.exerciseIndex + 1 >= session.exercises.length;
    goToNextExercise(session);
    if (isLast && studentId) {
      const latestLines = setLinesRef.current || {};
      const exercisesPayload = session.exercises.map((ex) => {
        const isEndurance = ex.exercise?.type === 'CORRIDA' || ex.exercise?.type === 'PEDAL';
        if (isEndurance) return { session_exercise_id: ex.id, performed: null };
        const details = latestLines[ex.id] || setLines[ex.id] || buildSets(ex);
        return { session_exercise_id: ex.id, performed: { set_details: details } };
      });
      try {
        setSavingExecution(true);
        await createExecution({
          student_id: studentId,
          session_id: session.id,
          status: 'CONCLUIDO',
          rpe: null,
          comment: null,
          exercises: exercisesPayload,
        });
        const lastExercises = await getMyLastExercises().catch(() => []);
        const map = {};
        (lastExercises || []).forEach((item) => {
          map[item.exercise_id] = item;
        });
        setLastByExercise(map);
        loadHistory();
      } catch (err) {
        // Se falhar, mantemos o fluxo, apenas exibimos mensagem.
        setError('Nao foi possivel registrar execucao para o professor.');
      } finally {
        setSavingExecution(false);
      }
    }
  }

  return (
    <AppShell>
      <div className="mb-4">
        <p className="text-xs text-slate-500 uppercase tracking-wide">Meus treinos</p>
        <h1 className="text-2xl font-bold text-slate-900">Dashboard do Aluno</h1>
        <p className="text-sm text-slate-600">Treinos atribuidos pelo seu professor. Ola, {user?.name || 'aluno'}.</p>
      </div>

      <SectionCard
        title="Treino do dia"
        description="Escolha qual treino vai fazer hoje. Mantemos a ordem inicial numerada como sugestao."
        actions={
          <select
            className="border rounded px-3 py-2 text-sm w-full sm:w-auto"
            value={selectedSequence}
            onChange={(e) => setSelectedSequence(e.target.value)}
            disabled={orderedAgenda.length === 0}
          >
            <option value="">{orderedAgenda.length ? 'Sugerir ordem inicial' : 'Sem treinos'}</option>
            {SESSION_TYPE_ORDER.map((type) => {
              const sessions = sessionsByType[type] || [];
              if (!sessions.length) return null;
              return (
                <optgroup key={type} label={SESSION_TYPE_LABELS[type]}>
                  {sessions.map((s) => (
                    <option key={s.id} value={s.sequence || s.id}>
                      Treino {s.sequence || '?'} - {s.name}
                    </option>
                  ))}
                </optgroup>
              );
            })}
          </select>
        }
      >
        {treinoDoDia ? (
          <div className="mt-4 space-y-2">
            <p className="text-xs uppercase text-slate-500">Treino selecionado</p>
            <div className="rounded-xl border border-blue-100 bg-blue-50 p-2">
              {renderSessionCard(treinoDoDia)}
            </div>
          </div>
        ) : (
          <p className="text-sm text-slate-500">Nenhuma sessao disponivel.</p>
        )}
      </SectionCard>

      <SectionCard
        title="Treinos disponiveis"
        description="Ordem sugerida pelo professor, mas voce pode executar qualquer treino numerado em qualquer dia."
      >
        {error && <p className="text-red-600 text-sm mb-2">{error}</p>}
        {message && <p className="text-emerald-600 text-sm mb-2">{message}</p>}
        <div className="space-y-6">
          {SESSION_TYPE_ORDER.map((type) => {
            const sessions = sessionsByType[type] || [];
            if (!sessions.length) return null;
            return (
              <div key={type}>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs uppercase text-slate-500">{SESSION_TYPE_LABELS[type]}</p>
                  <span className="text-xs text-slate-400">{sessions.length} treinos</span>
                </div>
                <div className="grid md:grid-cols-2 gap-3">
                  {sessions.map((s) => renderSessionCard(s))}
                </div>
              </div>
            );
          })}
          {orderedAgenda.length === 0 && <p className="text-sm text-slate-500">Nenhuma sessao para o filtro selecionado.</p>}
        </div>
      </SectionCard>

      <SectionCard
        title="Historico de treinos"
        description="Veja o que voce ja concluiu e filtre por periodo."
        actions={(
          <div className="flex flex-wrap items-center gap-2">
            <select
              className="border rounded px-3 py-2 text-sm"
              value={historyFilter}
              onChange={(e) => setHistoryFilter(e.target.value)}
            >
              {HISTORY_FILTERS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
            <button
              type="button"
              className="text-sm sm:text-xs text-blue-600 underline"
              onClick={loadHistory}
              disabled={historyLoading}
            >
              {historyLoading ? 'Carregando...' : 'Atualizar'}
            </button>
          </div>
        )}
      >
        {historyError && <p className="text-red-600 text-sm mb-2">{historyError}</p>}
        <div className="space-y-2">
          {filteredHistory.map((exec) => (
            <div key={exec.id} className="border rounded-lg p-3 bg-white">
              <div className="flex justify-between gap-3 flex-wrap">
                <div>
                  <p className="font-semibold text-slate-800">{exec.session_name || `Sessao ${exec.session_id}`}</p>
                  <p className="text-xs text-slate-500">{exec.status || 'Status nao informado'}</p>
                </div>
                <div className="text-xs text-slate-500">{exec.executed_at?.slice(0, 10) || '-'}</div>
              </div>
              <div className="text-xs text-slate-600 mt-1 flex flex-wrap gap-3">
                <span>RPE: {exec.rpe ?? '-'}</span>
                {exec.comment && <span>Obs: {exec.comment}</span>}
              </div>
            </div>
          ))}
          {filteredHistory.length === 0 && (
            <p className="text-sm text-slate-500">Nenhuma execucao no periodo selecionado.</p>
          )}
        </div>
      </SectionCard>

      
    </AppShell>
  );
}
