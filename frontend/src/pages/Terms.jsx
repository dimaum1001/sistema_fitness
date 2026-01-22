import AppShell from '../components/AppShell.jsx';
import SectionCard from '../components/SectionCard.jsx';

export default function Terms() {
  return (
    <AppShell>
      <div className="mb-4">
        <p className="text-xs text-slate-500 uppercase tracking-wide">Termos</p>
        <h1 className="text-2xl font-bold text-slate-900">Termos de Uso</h1>
        <p className="text-sm text-slate-600">Versao 1.0</p>
      </div>

      <SectionCard title="Condicoes gerais">
        <div className="space-y-3 text-sm text-slate-700">
          <p>
            Ao usar o Sistema Fitness Total, voce concorda com estes termos.
            Ajuste este texto com as regras oficiais do seu negocio.
          </p>
          <ul className="list-disc list-inside space-y-1">
            <li>Uso licenciado do sistema para gestao de treinos.</li>
            <li>Responsabilidade do usuario por manter a senha segura.</li>
            <li>Proibido compartilhar credenciais ou dados de terceiros sem autorizacao.</li>
            <li>O sistema pode evoluir e atualizar estes termos.</li>
          </ul>
        </div>
      </SectionCard>

      <SectionCard title="Limitacoes">
        <div className="space-y-2 text-sm text-slate-700">
          <p>O sistema oferece suporte a prescricao de treinos, nao substitui orientacao medica.</p>
          <p>O usuario deve seguir as orientacoes do profissional responsavel.</p>
        </div>
      </SectionCard>
    </AppShell>
  );
}
