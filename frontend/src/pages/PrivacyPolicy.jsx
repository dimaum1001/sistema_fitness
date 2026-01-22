import AppShell from '../components/AppShell.jsx';
import SectionCard from '../components/SectionCard.jsx';

export default function PrivacyPolicy() {
  return (
    <AppShell>
      <div className="mb-4">
        <p className="text-xs text-slate-500 uppercase tracking-wide">Politica</p>
        <h1 className="text-2xl font-bold text-slate-900">Politica de Privacidade</h1>
        <p className="text-sm text-slate-600">Versao 1.0</p>
      </div>

      <SectionCard title="Resumo">
        <div className="space-y-3 text-sm text-slate-700">
          <p>
            Este documento descreve como o Sistema Fitness Total coleta e trata dados pessoais,
            em conformidade com a LGPD. Ajuste este texto com os dados reais da empresa, contato
            do controlador e detalhes do tratamento.
          </p>
          <ul className="list-disc list-inside space-y-1">
            <li>Controlador: INFORME O NOME DA EMPRESA E CNPJ.</li>
            <li>Contato DPO/Encarregado: INFORME EMAIL E CANAL OFICIAL.</li>
            <li>Finalidade: gestao de treinos, evolucao, comunicacao e suporte.</li>
            <li>Base legal: execucao de contrato e consentimento para dados sensiveis.</li>
            <li>Compartilhamento: apenas com provedores essenciais e quando exigido por lei.</li>
            <li>Retencao: enquanto durar a relacao ou por obrigacao legal.</li>
          </ul>
        </div>
      </SectionCard>

      <SectionCard title="Direitos do titular">
        <div className="space-y-2 text-sm text-slate-700">
          <p>Voce pode solicitar acesso, correcao, portabilidade ou exclusao de dados.</p>
          <p>Use a pagina de Conta para exportar seus dados ou solicitar exclusao.</p>
        </div>
      </SectionCard>

      <SectionCard title="Seguranca">
        <div className="space-y-2 text-sm text-slate-700">
          <p>Adotamos medidas tecnicas e administrativas para proteger os dados.</p>
          <p>Em caso de incidente, os titulares serao comunicados conforme a lei.</p>
        </div>
      </SectionCard>
    </AppShell>
  );
}
