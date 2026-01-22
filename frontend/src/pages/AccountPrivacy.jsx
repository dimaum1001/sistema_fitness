import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import AppShell from '../components/AppShell.jsx';
import SectionCard from '../components/SectionCard.jsx';
import {
  acceptConsent,
  deleteMyAccount,
  exportMyData,
  revokeConsent,
  updateMyAccount,
} from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';

export default function AccountPrivacy() {
  const { user, consent, refreshConsent, refreshUser, logout } = useAuth();
  const navigate = useNavigate();
  const [consentForm, setConsentForm] = useState({
    terms: false,
    privacy: false,
    sensitive: false,
  });
  const [consentError, setConsentError] = useState('');
  const [consentMessage, setConsentMessage] = useState('');
  const [exportMessage, setExportMessage] = useState('');
  const [accountForm, setAccountForm] = useState({
    name: '',
    email: '',
    password: '',
    password_confirm: '',
  });
  const [accountMessage, setAccountMessage] = useState('');
  const [accountError, setAccountError] = useState('');
  const [deleteError, setDeleteError] = useState('');
  const [loading, setLoading] = useState(false);

  const consentAccepted = !!consent?.accepted;
  const termsVersion = consent?.terms_version || '1.0';
  const privacyVersion = consent?.privacy_version || '1.0';
  const sensitiveVersion = consent?.sensitive_version || '1.0';

  useEffect(() => {
    if (consentAccepted) {
      setConsentForm({ terms: true, privacy: true, sensitive: true });
    }
  }, [consentAccepted]);

  useEffect(() => {
    if (user) {
      setAccountForm((prev) => ({
        ...prev,
        name: user.name || '',
        email: user.email || '',
      }));
    }
  }, [user]);

  const isFormValid = useMemo(() => (
    consentForm.terms && consentForm.privacy && consentForm.sensitive
  ), [consentForm]);

  async function handleAcceptConsent() {
    setConsentError('');
    setConsentMessage('');
    if (!isFormValid) {
      setConsentError('Confirme todos os termos antes de continuar.');
      return;
    }
    setLoading(true);
    try {
      await acceptConsent({
        accept_terms: consentForm.terms,
        accept_privacy: consentForm.privacy,
        accept_sensitive: consentForm.sensitive,
      });
      await refreshConsent();
      setConsentMessage('Consentimento registrado.');
    } catch (err) {
      setConsentError('Nao foi possivel registrar o consentimento.');
    } finally {
      setLoading(false);
    }
  }

  async function handleRevokeConsent() {
    setConsentError('');
    setConsentMessage('');
    if (!window.confirm('Deseja revogar o consentimento? O acesso sera bloqueado.')) return;
    setLoading(true);
    try {
      await revokeConsent();
      await refreshConsent();
      setConsentForm({ terms: false, privacy: false, sensitive: false });
      setConsentMessage('Consentimento revogado.');
    } catch (err) {
      setConsentError('Nao foi possivel revogar o consentimento.');
    } finally {
      setLoading(false);
    }
  }

  async function handleExport() {
    setExportMessage('');
    setLoading(true);
    try {
      const data = await exportMyData();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      const stamp = new Date().toISOString().slice(0, 10);
      link.href = url;
      link.download = `meus_dados_${stamp}.json`;
      link.click();
      window.URL.revokeObjectURL(url);
      setExportMessage('Arquivo gerado com sucesso.');
    } catch (err) {
      setExportMessage('Falha ao exportar dados.');
    } finally {
      setLoading(false);
    }
  }

  async function handleUpdateAccount(e) {
    e.preventDefault();
    setAccountError('');
    setAccountMessage('');
    if (accountForm.password && accountForm.password !== accountForm.password_confirm) {
      setAccountError('As senhas nao conferem.');
      return;
    }
    const payload = {
      name: accountForm.name,
      email: accountForm.email,
    };
    if (accountForm.password) payload.password = accountForm.password;
    setLoading(true);
    try {
      await updateMyAccount(payload);
      await refreshUser();
      setAccountForm((prev) => ({ ...prev, password: '', password_confirm: '' }));
      setAccountMessage('Dados atualizados.');
    } catch (err) {
      setAccountError('Nao foi possivel atualizar a conta.');
    } finally {
      setLoading(false);
    }
  }

  async function handleDeleteAccount() {
    setDeleteError('');
    if (!window.confirm('Tem certeza? Esta acao desativa sua conta.')) return;
    setLoading(true);
    try {
      await deleteMyAccount();
      logout();
      navigate('/login');
    } catch (err) {
      setDeleteError('Nao foi possivel excluir a conta.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <AppShell>
      <div className="mb-4">
        <p className="text-xs text-slate-500 uppercase tracking-wide">Conta e privacidade</p>
        <h1 className="text-2xl font-bold text-slate-900">LGPD</h1>
        <p className="text-sm text-slate-600">
          Gerencie consentimento, dados pessoais e seus direitos.
        </p>
      </div>

      <SectionCard
        title="Consentimento"
        description="Para continuar usando o sistema, aceite os termos e a politica de privacidade."
      >
        <div className="space-y-3 text-sm text-slate-700">
          <div className="text-xs text-slate-500">
            Status: {consentAccepted ? 'consentimento ativo' : 'consentimento pendente'}
          </div>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={consentForm.terms}
              disabled={consentAccepted}
              onChange={(e) => setConsentForm({ ...consentForm, terms: e.target.checked })}
            />
            <span>
              Li e aceito os <Link className="text-blue-600 underline" to="/termos">Termos de Uso</Link>{' '}
              (versao {termsVersion})
            </span>
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={consentForm.privacy}
              disabled={consentAccepted}
              onChange={(e) => setConsentForm({ ...consentForm, privacy: e.target.checked })}
            />
            <span>
              Li e aceito a <Link className="text-blue-600 underline" to="/privacidade">Politica de Privacidade</Link>{' '}
              (versao {privacyVersion})
            </span>
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={consentForm.sensitive}
              disabled={consentAccepted}
              onChange={(e) => setConsentForm({ ...consentForm, sensitive: e.target.checked })}
            />
            <span>
              Autorizo o tratamento de dados sensiveis para treino e evolucao (versao {sensitiveVersion})
            </span>
          </label>
          {consentError && <p className="text-red-600 text-sm">{consentError}</p>}
          {consentMessage && <p className="text-emerald-600 text-sm">{consentMessage}</p>}
          <div className="flex flex-wrap gap-2">
            {!consentAccepted && (
              <button
                type="button"
                className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-semibold"
                onClick={handleAcceptConsent}
                disabled={loading}
              >
                {loading ? 'Salvando...' : 'Aceitar e continuar'}
              </button>
            )}
            {consentAccepted && (
              <button
                type="button"
                className="bg-slate-200 text-slate-800 px-4 py-2 rounded-lg text-sm font-semibold"
                onClick={handleRevokeConsent}
                disabled={loading}
              >
                Revogar consentimento
              </button>
            )}
          </div>
        </div>
      </SectionCard>

      <SectionCard
        title="Atualizar dados da conta"
        description="Corrija seus dados pessoais quando necessario."
      >
        {accountError && <p className="text-red-600 text-sm mb-2">{accountError}</p>}
        {accountMessage && <p className="text-emerald-600 text-sm mb-2">{accountMessage}</p>}
        <form onSubmit={handleUpdateAccount} className="grid md:grid-cols-4 gap-3 items-end">
          <div className="md:col-span-1">
            <label className="block text-sm font-medium mb-1">Nome</label>
            <input
              className="w-full border rounded-lg px-3 py-2 text-sm"
              value={accountForm.name}
              onChange={(e) => setAccountForm({ ...accountForm, name: e.target.value })}
              required
            />
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-medium mb-1">Email</label>
            <input
              type="email"
              className="w-full border rounded-lg px-3 py-2 text-sm"
              value={accountForm.email}
              onChange={(e) => setAccountForm({ ...accountForm, email: e.target.value })}
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Nova senha (opcional)</label>
            <input
              type="password"
              className="w-full border rounded-lg px-3 py-2 text-sm"
              value={accountForm.password}
              onChange={(e) => setAccountForm({ ...accountForm, password: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Confirmar senha</label>
            <input
              type="password"
              className="w-full border rounded-lg px-3 py-2 text-sm"
              value={accountForm.password_confirm}
              onChange={(e) => setAccountForm({ ...accountForm, password_confirm: e.target.value })}
            />
          </div>
          <div className="md:col-span-4 flex justify-end">
            <button
              type="submit"
              className="bg-slate-900 text-white px-4 py-2 rounded-lg text-sm font-semibold"
              disabled={loading}
            >
              {loading ? 'Salvando...' : 'Atualizar conta'}
            </button>
          </div>
        </form>
      </SectionCard>

      <SectionCard
        title="Direitos do titular"
        description="Baixe seus dados ou solicite a exclusao da conta."
      >
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-semibold"
            onClick={handleExport}
            disabled={loading}
          >
            Baixar meus dados (JSON)
          </button>
          <button
            type="button"
            className="bg-rose-600 text-white px-4 py-2 rounded-lg text-sm font-semibold"
            onClick={handleDeleteAccount}
            disabled={loading}
          >
            Excluir minha conta
          </button>
          {exportMessage && <span className="text-sm text-slate-600">{exportMessage}</span>}
          {deleteError && <span className="text-sm text-red-600">{deleteError}</span>}
        </div>
      </SectionCard>
    </AppShell>
  );
}
