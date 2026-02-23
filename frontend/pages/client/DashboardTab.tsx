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
  contacts,
  metrics,
  onChangeTab,
  onTerminalMode,
  onCopyLink,
  copiedLink,
  tenantSlug,
  tenantPlan
}) => {
  const totalCustomers = metrics?.total_customers ?? 0;
  const pointsGenerated = metrics?.total_points_generated ?? 0;
  const totalRedemptions = metrics?.total_redemptions ?? 0;
  const premiumCustomers = metrics?.total_premium_customers ?? 0;
  const linkedCards = metrics?.total_linked_cards ?? 0;
  const publicVisits = metrics?.public_page_visits ?? 0;

  const stats = [
    {
      label: 'Clientes cadastrados',
      value: totalCustomers,
      icon: Users,
      color: 'text-blue-600',
      bg: 'bg-blue-50',
      description: 'Total na base CRM'
    },
    {
      label: 'Pontos gerados',
      value: pointsGenerated,
      icon: Star,
      color: 'text-yellow-600',
      bg: 'bg-yellow-50',
      description: 'Acúmulo total do sistema'
    },
    {
      label: 'Resgates realizados',
      value: totalRedemptions,
      icon: Gift,
      color: 'text-rose-600',
      bg: 'bg-rose-50',
      description: 'Total de prêmios entregues'
    },
    {
      label: 'Clientes Premium / VIP',
      value: premiumCustomers,
      icon: Crown,
      color: 'text-amber-600',
      bg: 'bg-amber-50',
      description: 'Total de clientes fidelizados'
    },
    {
      label: 'Cartões Vinculados',
      value: linkedCards,
      icon: Smartphone,
      color: 'text-emerald-600',
      bg: 'bg-emerald-50',
      description: 'Tags NFC em uso'
    },
    {
      label: 'Acessos ao Link',
      value: publicVisits,
      icon: MousePointerClick,
      color: 'text-indigo-600',
      bg: 'bg-indigo-50',
      description: 'Visitas na página pública'
    },
  ];

  return (
    <div className="space-y-8 animate-fade-in pb-12">
      {/* Header com Boas-vindas e Ações Rápidas */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-black text-gray-900 dark:text-white tracking-tight">Visão Geral</h1>
          <p className="text-gray-500 dark:text-gray-400 font-medium">Gestão de clientes e inteligência de fidelidade.</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button
            onClick={onCopyLink}
            variant="outline"
            className={`font-bold transition-all ${copiedLink ? 'bg-green-50 border-green-200 text-green-600' : 'bg-white'}`}
          >
            <Smartphone className={`w-4 h-4 mr-2 ${copiedLink ? 'text-green-500' : ''}`} />
            {copiedLink ? 'Link Copiado!' : 'Copiar Link Público'}
          </Button>
          <Button onClick={() => onChangeTab('new')} className="font-bold shadow-lg shadow-primary-500/20">
            <UserPlus className="w-4 h-4 mr-2" /> Novo Cadastro
          </Button>
          <Button
            onClick={() => window.open(`${window.location.origin}/p/${tenantSlug}`, '_blank')}
            className="bg-primary-500 text-white font-bold shadow-lg shadow-primary-500/20"
          >
            <LayoutGrid className="w-4 h-4 mr-2" /> Abrir Terminal
          </Button>
        </div>
      </div>

      {/* Grid de KPIs Principais (5 Métricas Essenciais) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {stats.filter(s => tenantPlan === PlanType.CLASSIC || s.label !== 'Cartões Vinculados').map((stat, i) => (
          <Card key={i} className="p-6 border-none shadow-sm hover:shadow-md transition-all group">
            <div className="flex items-center justify-between mb-4">
              <div className={`p-3 rounded-[15px] ${stat.bg} ${stat.color} transition-transform group-hover:scale-110`}>
                <stat.icon className="w-6 h-6" />
              </div>
              <Badge color="gray">Total</Badge>
            </div>
            <h3 className="text-3xl font-black text-gray-900 dark:text-white tracking-tight">{stat.value}</h3>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mt-1">{stat.label}</p>
            <p className="text-[10px] text-gray-400 mt-2 italic">{stat.description}</p>
          </Card>
        ))}
      </div>
    </div>
  );
};