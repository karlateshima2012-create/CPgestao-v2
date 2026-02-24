import React from 'react';
import { Card, Button, Badge } from '../../components/ui';
import {
  Users,
  Star,
  Gift,
  TrendingUp,
  UserPlus,
  LayoutGrid,
  Activity,
  Percent,
  RefreshCw,
  Crown,
  Smartphone,
  MousePointerClick
} from 'lucide-react';
import { Contact, PlanType } from '../../types';

interface DashboardTabProps {
  tenantPlan?: PlanType;
  contacts: Contact[];
  metrics: any;
  unexportedCount: number;
  onChangeTab: (tab: any) => void;
  onCopyLink: () => void;
  copiedLink: boolean;
  onTerminalMode?: () => void;
  onRefresh?: () => void;
  tenantSlug?: string | null;
}

export const DashboardTab: React.FC<DashboardTabProps> = ({
  metrics,
  onChangeTab,
  onCopyLink,
  copiedLink,
  tenantSlug,
}) => {
  const suggestions = metrics?.suggestions || [];

  const SectionHeader = ({ title, subtitle, icon: Icon, colorClass }: any) => (
    <div className="flex flex-col mb-8 pt-4">
      <div className="flex items-center gap-3">
        <div className={`p-2.5 rounded-2xl ${colorClass} bg-opacity-10 dark:bg-opacity-20 shadow-sm ring-1 ring-inset ${colorClass.replace('bg-', 'ring-').replace('-500', '-500/20')}`}>
          <Icon className={`w-5 h-5 ${colorClass.replace('bg-', 'text-')}`} />
        </div>
        <div>
          <h2 className="text-xl font-extrabold tracking-tight text-gray-900 dark:text-white">{title}</h2>
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{subtitle}</p>
        </div>
      </div>
    </div>
  );

  const KpiCard = ({ label, value, description, icon: Icon, colorClass, trend, prefix }: any) => (
    <Card className="p-5 border border-gray-100 dark:border-gray-800 bg-white/50 dark:bg-gray-900/50 backdrop-blur-xl shadow-sm hover:shadow-lg transition-all duration-300 group relative overflow-hidden">
      <div className="relative z-10">
        <div className="flex justify-between items-start mb-4">
          <div className={`p-3 rounded-2xl ${colorClass} bg-opacity-10 dark:bg-opacity-20 ring-1 ring-inset ${colorClass.replace('bg-', 'ring-').replace('-500', '-200/40')}`}>
            <Icon className={`w-5 h-5 ${colorClass.replace('bg-', 'text-')}`} />
          </div>
          {trend !== undefined && (
            <div className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black ${trend >= 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
              <TrendingUp className={`w-3 h-3 ${trend < 0 ? 'rotate-180' : ''}`} />
              {trend > 0 ? `+${trend}%` : `${trend}%`}
            </div>
          )}
        </div>

        <div className="space-y-0.5">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{label}</p>
          <div className="flex items-baseline gap-1">
            {prefix && <span className="text-sm font-bold text-gray-300 dark:text-gray-600">{prefix}</span>}
            <h3 className="text-3xl font-black text-gray-900 dark:text-white tracking-tighter">
              {value}
            </h3>
          </div>
        </div>

        <div className="mt-4 pt-4 border-t border-gray-50 dark:border-gray-800">
          <p className="text-[10px] text-gray-400 font-bold leading-tight">{description}</p>
        </div>
      </div>
      <div className={`absolute -right-8 -bottom-8 w-32 h-32 rounded-full ${colorClass} opacity-[0.02] blur-2xl group-hover:opacity-[0.05] transition-opacity duration-500`} />
    </Card>
  );

  return (
    <div className="space-y-8 animate-fade-in py-4 pb-20 max-w-[1400px] mx-auto">
      {/* Header Premium */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 pb-2">
        <div>
          <h1 className="text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight">Visão Geral</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1 text-lg">Dados convertidos em estratégia.</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={onCopyLink}
            className={`group px-5 h-10 rounded-xl font-black text-[9px] uppercase tracking-widest transition-all duration-300 flex items-center gap-2 ${copiedLink
              ? 'bg-emerald-500 text-white shadow-lg'
              : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 shadow-sm ring-1 ring-gray-200 dark:ring-gray-700 hover:shadow-md'
              }`}
          >
            <Smartphone className="w-3.5 h-3.5" />
            {copiedLink ? 'Link Copiado' : 'Link Terminal'}
          </button>

          <button
            onClick={() => onChangeTab('new')}
            className="px-5 h-10 rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 font-black text-[9px] uppercase tracking-widest shadow-sm ring-1 ring-gray-200 dark:ring-gray-700 hover:bg-gray-200 dark:hover:bg-gray-700 transition-all flex items-center gap-2"
          >
            <UserPlus className="w-3.5 h-3.5" />
            Novo Cadastro
          </button>

          <button
            onClick={() => window.open(`${window.location.origin}/p/${tenantSlug}`, '_blank')}
            className="px-5 h-10 rounded-xl bg-primary-500 text-white font-black text-[9px] uppercase tracking-widest shadow-lg hover:bg-primary-600 transition-all flex items-center gap-2"
          >
            <LayoutGrid className="w-3.5 h-3.5" />
            Abrir Terminal
          </button>
        </div>
      </div>

      {/* Sugestões Inteligentes */}
      {suggestions.length > 0 && (
        <section className="bg-gray-900 dark:bg-black/40 rounded-[32px] p-8 text-white overflow-hidden relative shadow-2xl">
          <div className="absolute top-0 right-0 w-1/3 h-full bg-gradient-to-l from-primary-500/10 to-transparent pointer-events-none" />
          <SectionHeader title="Insights Estratégicos" subtitle="Sugestões baseadas em dados reais" icon={Activity} colorClass="bg-white" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {suggestions.map((s: any, i: number) => (
              <div key={i} className="group p-6 bg-white/5 backdrop-blur-md rounded-[24px] ring-1 ring-white/10 hover:bg-white/10 transition-all duration-300">
                <div className="flex items-center gap-4 mb-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center bg-${s.color}-500/20 text-${s.color}-400`}>
                    <Star className="w-5 h-5 fill-current" />
                  </div>
                  <p className="text-[10px] font-black uppercase text-gray-400 tracking-widest">{s.title}</p>
                </div>
                <p className="text-sm font-bold text-gray-200 leading-relaxed">{s.text}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Seção 1: Crescimento */}
      <section>
        <SectionHeader title="Métricas de Crescimento" subtitle="Evolução da base de clientes" icon={Users} colorClass="bg-blue-500" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <KpiCard
            label="Total de Clientes"
            value={metrics?.total_customers || 0}
            description="Tamanho da sua base acumulada."
            icon={Users}
            colorClass="bg-blue-500"
          />
          <KpiCard
            label="Clientes Ativos"
            value={metrics?.active_customers || 0}
            description="Atividade nos últimos 30 dias."
            icon={Activity}
            colorClass="bg-emerald-500"
          />
          <KpiCard
            label="Novos Clientes"
            value={metrics?.new_customers_30d || 0}
            description="Entradas no último mês."
            icon={UserPlus}
            colorClass="bg-violet-500"
            trend={metrics?.customer_growth_30d}
          />
        </div>
      </section>

      {/* Seção 2: Engajamento & Fidelidade */}
      <section>
        <SectionHeader title="Engajamento & Fidelidade" subtitle="Retenção e saúde do programa" icon={Gift} colorClass="bg-rose-500" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <KpiCard
            label="Pontos Circulantes"
            value={metrics?.points_in_circulation || 0}
            description="Pontos aguardando resgate."
            icon={Star}
            colorClass="bg-yellow-500"
          />
          <KpiCard
            label="Taxa de Trocas"
            value={metrics?.redemption_rate || 0}
            prefix="%"
            description="Eficiência das premiações."
            icon={Percent}
            colorClass="bg-orange-500"
          />
          <KpiCard
            label="Visitas na Página"
            value={metrics?.public_page_visits || 0}
            description="Acessos via NFC ou Link."
            icon={MousePointerClick}
            colorClass="bg-indigo-500"
          />
        </div>
      </section>

      {/* Seção 3: Performance Financeira */}
      <section>
        <SectionHeader title="Performance Financeira" subtitle="Volume transacionado no CRM" icon={TrendingUp} colorClass="bg-emerald-500" />
        <div className="grid grid-cols-1">
          <KpiCard
            label="Receita Registrada"
            value={Number(metrics?.total_revenue || 0).toLocaleString('ja-JP')}
            prefix="¥"
            description="Valor total em vendas processadas através do sistema."
            icon={TrendingUp}
            colorClass="bg-emerald-500"
          />
        </div>
      </section>
    </div>
  );
};