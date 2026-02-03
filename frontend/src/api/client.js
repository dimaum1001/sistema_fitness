const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

async function request(path, options = {}) {
  const token = localStorage.getItem('token');
  const headers = options.headers || {};
  if (!(options.body instanceof FormData) && !(options.body instanceof URLSearchParams)) {
    headers['Content-Type'] = headers['Content-Type'] || 'application/json';
  }
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${API_URL}${path}`, { ...options, headers });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || 'Erro na requisição');
  }
  if (res.status === 204) return null;
  return res.json();
}

// --- Auth ---
export async function login(email, password) {
  const data = new URLSearchParams();
  data.append('username', email);
  data.append('password', password);
  const res = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    body: data,
  });
  if (!res.ok) throw new Error('Login inválido');
  return res.json();
}

export const getMe = () => request('/auth/me');
export const registerProfessor = (payload) =>
  request('/auth/register_professor', {
    method: 'POST',
    body: JSON.stringify({ ...payload, type: 'PROFESSOR' }),
  });
export const registerStudent = (payload) =>
  request('/auth/register_aluno', {
    method: 'POST',
    body: JSON.stringify({ ...payload, type: 'ALUNO' }),
  });
export const listProfessors = () => request('/admin/professores');

// --- LGPD / Privacy ---
export const getConsentStatus = () => request('/privacidade/consent');
export const acceptConsent = (payload) =>
  request('/privacidade/consent', { method: 'POST', body: JSON.stringify(payload) });
export const revokeConsent = () => request('/privacidade/consent', { method: 'DELETE' });
export const exportMyData = () => request('/privacidade/export');
export const updateMyAccount = (payload) =>
  request('/privacidade/me', { method: 'PATCH', body: JSON.stringify(payload) });
export const deleteMyAccount = () => request('/privacidade/me', { method: 'DELETE' });

// --- Exercises ---
export const getExercises = () => request('/exercicios');
export const createExercise = (payload) =>
  request('/exercicios', { method: 'POST', body: JSON.stringify(payload) });
export const getExerciseExplanation = (id) => request(`/exercicios/${id}/explicacao`);
export const updateExercise = (id, payload) =>
  request(`/exercicios/${id}`, { method: 'PATCH', body: JSON.stringify(payload) });
export const deleteExercise = (id) =>
  request(`/exercicios/${id}`, { method: 'DELETE' });

// --- Training plans & sessions ---
export const createPlan = (payload) =>
  request('/planos', { method: 'POST', body: JSON.stringify(payload) });
export const listPlans = (studentId, options = {}) => {
  const params = new URLSearchParams();
  if (options.includeInactive) params.append('include_inactive', 'true');
  const qs = params.toString() ? `?${params.toString()}` : '';
  return request(`/planos/aluno/${studentId}/planos${qs}`);
};
export const listMyPlans = (options = {}) => {
  const params = new URLSearchParams();
  if (options.includeInactive !== false) params.append('include_inactive', 'true');
  const qs = params.toString() ? `?${params.toString()}` : '';
  return request(`/planos/aluno/me/planos${qs}`);
};
export const createSession = (payload) =>
  request('/planos/sessao', { method: 'POST', body: JSON.stringify(payload) });
export const listSessions = (planId) => request(`/planos/sessao/${planId}`);
export const listSessionExercises = (sessionId) => request(`/planos/sessao/${sessionId}/exercicios`);
export const addSessionExercise = (sessionId, payload) =>
  request(`/planos/sessao/${sessionId}/exercicios`, { method: 'POST', body: JSON.stringify(payload) });
export const addSessionExercisesBulk = (sessionId, items) =>
  request(`/planos/sessao/${sessionId}/exercicios/lote`, { method: 'POST', body: JSON.stringify(items) });
export const copySessionExercises = (sessionId, sourceSessionId) =>
  request(`/planos/sessao/${sessionId}/exercicios/copiar?source_session_id=${sourceSessionId}`, { method: 'POST' });
export const getStudentAgenda = (sessionNumber, planId) => {
  const params = new URLSearchParams();
  if (sessionNumber) params.append('session_number', sessionNumber);
  if (planId) params.append('plan_id', planId);
  const qs = params.toString() ? `?${params.toString()}` : '';
  return request(`/planos/aluno/agenda${qs}`);
};
export const updateSessionExercise = (itemId, payload) =>
  request(`/planos/sessao/exercicios/${itemId}`, { method: 'PATCH', body: JSON.stringify(payload) });
export const deleteSessionExercise = (itemId) =>
  request(`/planos/sessao/exercicios/${itemId}`, { method: 'DELETE' });
export const deleteSession = (sessionId) =>
  request(`/planos/sessao/${sessionId}`, { method: 'DELETE' });
export const deactivatePlan = (planId) =>
  request(`/planos/${planId}/desativar`, { method: 'PATCH' });
export const deletePlan = (planId) =>
  request(`/planos/${planId}`, { method: 'DELETE' });

// --- Executions ---
export const createExecution = (payload) =>
  request('/execucoes', { method: 'POST', body: JSON.stringify(payload) });
export const listExecutionsByStudent = (studentId) => request(`/execucoes/aluno/${studentId}`);
export const getStudentEvolution = (studentId) => request(`/execucoes/aluno/${studentId}/evolucao`);
export const listMyExecutions = () => request('/execucoes/minhas');
export const getMyEvolution = () => request('/execucoes/minhas/evolucao');
export const getMyLastExercises = () => request('/execucoes/minhas/ultimos_exercicios');

export { API_URL };

// --- Students ---
export const listStudents = () => request('/alunos');

// --- Assessments ---
export const createStudentAssessment = (payload) =>
  request('/avaliacoes', { method: 'POST', body: JSON.stringify(payload) });
export const listStudentAssessments = (studentId) =>
  request(`/avaliacoes/aluno/${studentId}`);
export const updateStudentAssessment = (assessmentId, payload) =>
  request(`/avaliacoes/${assessmentId}`, { method: 'PATCH', body: JSON.stringify(payload) });
export const deleteStudentAssessment = (assessmentId) =>
  request(`/avaliacoes/${assessmentId}`, { method: 'DELETE' });
