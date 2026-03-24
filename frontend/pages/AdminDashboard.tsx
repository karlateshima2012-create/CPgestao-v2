import React, { useState, useEffect } from 'react';
import { Card, Button, Input, Badge, StatusModal } from '../components/ui';
import { Users, AlertTriangle, Plus, Search, Edit2, Lock, Trash2, X, CheckCircle, CheckCircle2, Check, Copy, Calendar, RefreshCw, Save, ArrowUpCircle, Tag as TagIcon, Shield, Download, Crown, Smartphone, Monitor, HelpCircle, ExternalLink } from 'lucide-react';
import { Tenant, PlanType } from '../types';
import { tenantsService } from '../services/api';
import { copyToClipboard } from '../utils/clipboard';

const PLAN_LIMITS: Record<PlanType, number> = {
  [PlanType.PRO]: 4000,
  [PlanType.UNLIMITED]: 6000,
};

export const AdminDashboard: React.FC = () => {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'near_limit' | 'expired'>('all');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newTenantData, setNewTenantData] = useState({
    name: '',
    email: '',
    owner_name: '',
    phone: '',
    plan: PlanType.PRO,
    extra_contacts_quota: 0,
    totems_count: 2,
    plan_expires_at: ''
  });
  const [tenantForDevices, setTenantForDevices] = useState<Tenant | null>(null);
  const [storeDevices, setStoreDevices] = useState<any[]>([]);
  const [newDeviceData, setNewDeviceData] = useState({ name: '', mode: 'approval' });
  const [createdCredentials, setCreatedCredentials] = useState<{ email: string; password: string; name: string; url: string } | null>(null);
  const [editingTenant, setEditingTenant] = useState<Tenant | null>(null);
  const [statusModal, setStatusModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    type: 'success' | 'error' | 'info';
  }>({
    isOpen: false,
    title: '',
    message: '',
    type: 'info'
  });

  const [isLoading, setIsLoading] = useState(false);
  const [manualPin, setManualPin] = useState('');
  const [tempPin, setTempPin] = useState<string | null>(null);
  const [globalMetrics, setGlobalMetrics] = useState<{ total_tenants: number; expiring_soon: number } | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);


  const handleCopyPublicLink = async (slug: string) => {
    const url = `${window.location.origin}/p/${slug}`;
    const success = await copyToClipboard(url);
    if (success) {
      setStatusModal({
        isOpen: true,
        title: 'Link Copiado!',
        message: `O link público da loja foi copiado: ${url}`,
        type: 'success'
      });
    } else {
      setStatusModal({
        isOpen: true,
        title: 'Erro ao Copiar',
        message: 'Não foi possível copiar o link automatically. Por favor, copie manualmente.',
        type: 'error'
      });
    }
  };


  useEffect(() => {
    fetchTenants();
    fetchGlobalMetrics();
  }, []);

  const fetchTenants = async () => {
    try {
      const res = await tenantsService.getAll();
      setTenants(res.data);
    } catch (error) {
      console.error('Error fetching tenants:', error);
    }
  };

  const fetchGlobalMetrics = async () => {
    try {
      const res = await tenantsService.getGlobalMetrics();
      setGlobalMetrics(res.data);
    } catch (error) {
      console.error('Error fetching global metrics:', error);
    }
  };

  useEffect(() => {
    if (editingTenant) {
      setTenantForDevices(editingTenant);
      fetchStoreDevices(editingTenant.id);
    } else {
      setManualPin('');
    }
  }, [editingTenant]);

  const formatJapanesePhone = (val: string) => {
    const digits = val.replace(/\D/g, '').slice(0, 11);
    if (digits.length <= 3) return digits;
    if (digits.length <= 7) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
    return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
  };

  const getWhatsAppLink = (phone: string) => {
    const digits = phone.replace(/\D/g, '');
    let formatted = digits;
    if (digits.startsWith('0')) {
      formatted = `81${digits.substring(1)}`;
    }
    return `https://api.whatsapp.com/send?phone=${formatted}`;
  };

  const addMonths = (dateStr: string, months: number) => {
    let date: Date;

    if (dateStr) {
      // Safely parse YYYY-MM-DD to avoid timezone shifts
      const parts = dateStr.split(/[T ]/)[0].split('-');
      if (parts.length === 3) {
        const year = parseInt(parts[0]);
        const month = parseInt(parts[1]) - 1; // 0-indexed
        const day = parseInt(parts[2]);
        date = new Date(year, month, day);
      } else {
        date = new Date();
      }
    } else {
      date = new Date();
    }

    if (isNaN(date.getTime())) {
      date = new Date();
    }

    date.setMonth(date.getMonth() + months);

    const y = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    return `${y}-${mm}-${dd}`;
  };

  const formatDateDisplay = (dateStr: string | null | undefined) => {
    if (!dateStr) return '--';
    const parts = dateStr.split(/[T ]/)[0].split('-');
    if (parts.length !== 3) return dateStr;
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  };

  const filteredTenants = tenants.filter(t => {
    const matchesSearch = t.name.toLowerCase().includes(search.toLowerCase()) ||
      t.email.toLowerCase().includes(search.toLowerCase());

    if (filterType === 'near_limit') {
      const limit = t.total_contact_limit || PLAN_LIMITS[t.plan] || 2000;
      return matchesSearch && (t.customers_count || 0) / limit > 0.8;
    }

    if (filterType === 'expired') {
      return matchesSearch && t.plan_expires_at && new Date(t.plan_expires_at) < new Date();
    }

    return matchesSearch;
  });

  const capitalizeWords = (str: string) => {
    return str.split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
  };

  const handleCreateTenant = async () => {
    if (!newTenantData.name || !newTenantData.email) return;
    setIsLoading(true);
    try {
      const res = await tenantsService.create(newTenantData);
      setCreatedCredentials({
        email: res.data.credentials.email,
        password: res.data.credentials.password,
        name: newTenantData.owner_name || newTenantData.name,
        url: window.location.origin
      });
      fetchTenants();
      setNewTenantData({
        name: '',
        email: '',
        owner_name: '',
        phone: '',
        plan: PlanType.PRO,
        extra_contacts_quota: 0,
        totems_count: 2,
        plan_expires_at: ''
      });
    } catch (error) {
      setStatusModal({
        isOpen: true,
        title: 'Erro',
        message: 'Não foi possível criar a loja. Verifique os dados e tente novamente.',
        type: 'error'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const copyWhatsAppMessage = async () => {
    if (!createdCredentials) return;
    const msg = `Olá *${createdCredentials.name}*! 👋\n\nSeu acesso ao sistema CPgestão Fidelidade foi configurado com sucesso.\n\n📍 *Dados de Acesso:*\n📧 Login: ${createdCredentials.email}\n🔑 Senha: ${createdCredentials.password}\n\n🔗 *Painel de Gestão:*\n${createdCredentials.url}\n\n⚠️ *OBS:* Por segurança, sua senha deve ser redefinida no primeiro acesso. (A nova senha deve ter exatamente 8 dígitos, uma letra maiúscula e um número).\n\nSeja bem-vindo(a)!`;
    const success = await copyToClipboard(msg);
    if (success) {
      setStatusModal({
        isOpen: true,
        title: 'Copiado!',
        message: 'A mensagem de boas-vindas foi copiada para sua área de transferência.',
        type: 'success'
      });
    } else {
      setStatusModal({
        isOpen: true,
        title: 'Erro ao Copiar',
        message: 'Não foi possível copiar a mensagem. Por favor, copie manualmente.',
        type: 'error'
      });
    }
  };


  const handleResetPin = async (tenantId: string) => {
    try {
      const res = await tenantsService.resetPin(tenantId, manualPin ? { pin: manualPin } : undefined);
      setTempPin(res.data.temp_pin);
      setManualPin('');
    } catch (error) {
      setStatusModal({
        isOpen: true,
        title: 'Erro',
        message: 'Erro ao resetar PIN.',
        type: 'error'
      });
    }
  };

  const fetchStoreDevices = async (tenantId: string) => {
    try {
      const res = await tenantsService.getDevices(tenantId);
      setStoreDevices(res.data);
    } catch (error) {
      console.error('Error fetching devices', error);
    }
  };

  const handleCreateDevice = async () => {
    if (!tenantForDevices || !newDeviceData.name) return;
    setIsLoading(true);
    try {
      await tenantsService.createDevice(tenantForDevices.id, newDeviceData);
      fetchStoreDevices(tenantForDevices.id);
      setNewDeviceData({
        name: '',
        mode: tenantForDevices.plan === PlanType.UNLIMITED ? 'auto_checkin' : 'approval'
      });
    } catch (error) {
      setStatusModal({
        isOpen: true,
        title: 'Erro',
        message: 'Não foi possível registrar o terminal. Verifique o limite do plano.',
        type: 'error'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteDevice = async (deviceId: string) => {
    if (!tenantForDevices) return;
    if (!window.confirm('Deseja realmente excluir este totem? O QR deixará de funcionar.')) return;
    try {
      await tenantsService.deleteDevice(tenantForDevices.id, deviceId);
      fetchStoreDevices(tenantForDevices.id);
    } catch (error) {
      console.error('Error deleting totem', error);
    }
  };

  const handleUpdateDeviceLocal = (deviceId: string, field: string, value: string) => {
    setStoreDevices(prev => prev.map(d => d.id === deviceId ? { ...d, [field]: value } : d));
  };

  const handleSaveDevice = async (deviceId: string) => {
    if (!tenantForDevices) return;
    const device = storeDevices.find(d => d.id === deviceId);
    if (!device) return;

    try {
      await tenantsService.updateDevice(tenantForDevices.id, deviceId, {
        name: device.name,
        nfc_uid: device.nfc_uid,
      });
    } catch (error) {
      console.error('Error updating totem', error);
      setStatusModal({
        isOpen: true,
        title: 'Erro',
        message: 'Não foi possível atualizar o totem.',
        type: 'error'
      });
    }
  };

  const handleOpenEditModal = (tenant: Tenant) => {
    setEditingTenant(tenant);
    setTempPin(null);
    if (tenant) {
      setTenantForDevices(tenant);
      fetchStoreDevices(tenant.id);
    }
    setTenantForDevices(tenant);
    fetchStoreDevices(tenant.id);
  };

  const handleCloseEditModal = () => {
    setEditingTenant(null);
    setTempPin(null);
    setTenantForDevices(null);
    setStoreDevices([]);
  };

  const handleUpdateTenant = async () => {
    if (!editingTenant) return;
    setIsLoading(true);
    try {
      // Send only the fields that the backend expects and can update
      const updateData = {
        name: editingTenant.name,
        email: editingTenant.email,
        owner_name: editingTenant.owner_name,
        phone: editingTenant.phone,
        plan: editingTenant.plan,
        plan_expires_at: editingTenant.plan_expires_at,
        status: editingTenant.status,
        extra_contacts_quota: editingTenant.extra_contacts_quota,
      };

      await tenantsService.update(editingTenant.id, updateData);
      handleCloseEditModal();
      fetchTenants();
      setStatusModal({
        isOpen: true,
        title: 'Sucesso',
        message: 'Loja atualizada com sucesso!',
        type: 'success'
      });
    } catch (error) {
      setStatusModal({
        isOpen: true,
        title: 'Erro',
        message: 'Erro ao atualizar loja.',
        type: 'error'
      });
    } finally {
      setIsLoading(false);
    }
  };


  const handleDeleteTenant = async (tenant: Tenant) => {
    const confirmDelete = window.confirm(
      `ATENÇÃO: Você tem certeza que deseja excluir a loja "${tenant.name}"?\n\nEsta ação é PERMANENTE e excluirá todos os dados, clientes, dispositivos e acessos vinculados a esta loja.`
    );

    if (!confirmDelete) return;

    setIsLoading(true);
    try {
      await tenantsService.delete(tenant.id);
      fetchTenants();
      setStatusModal({
        isOpen: true,
        title: 'Excluído',
        message: 'Loja e todos os dados associados foram removidos com sucesso.',
        type: 'success'
      });
    } catch (error) {
      console.error('Error deleting tenant:', error);
      setStatusModal({
        isOpen: true,
        title: 'Erro',
        message: 'Erro ao excluir loja do sistema.',
        type: 'error'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleBlock = async (tenant: Tenant) => {
    const isBlocked = tenant.status === 'blocked';
    const newStatus = isBlocked ? 'active' : 'blocked';

    setIsLoading(true);
    try {
      await tenantsService.update(tenant.id, { status: newStatus as any });
      fetchTenants();
      setStatusModal({
        isOpen: true,
        title: isBlocked ? 'Loja Desbloqueada' : 'Loja Bloqueada',
        message: `O acesso da loja ${tenant.name} foi ${isBlocked ? 'restaurado' : 'suspenso'} com sucesso.`,
        type: 'success'
      });
    } catch (error) {
      console.error('Error toggling block:', error);
      setStatusModal({
        isOpen: true,
        title: 'Erro',
        message: 'Erro ao alterar status da loja.',
        type: 'error'
      });
    } finally {
      setIsLoading(false);
    }
  };


  return (
    <>
      <div className="space-y-8 animate-fade-in relative">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white tracking-tight">Visão Geral Admin</h1>
            <p className="text-gray-500 dark:text-gray-400 mt-1">Gestão de lojas e métricas globais da plataforma.</p>
          </div>
          <Button size="lg" className="shadow-md bg-gray-700 text-white" onClick={() => setIsCreateModalOpen(true)}>
            <Plus className="w-5 h-5 mr-2 text-white" /> Criar Novo CRM
          </Button>
        </div>

        {/* Global Metrics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="p-6 border-none shadow-sm bg-white dark:bg-gray-900 overflow-visible relative group">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-blue-50 text-blue-600 rounded-[15px] group-hover:scale-110 transition-transform">
                <Users className="w-6 h-6" />
              </div>
              <Badge color="blue">Ativos</Badge>
            </div>
            <h3 className="text-3xl font-black text-gray-900 dark:text-white tracking-tight">{globalMetrics?.total_tenants ?? '...'}</h3>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mt-1">Total de Empresas</p>
            <div className="absolute -bottom-1 left-0 w-full h-1 bg-blue-500 rounded-b-full"></div>
          </Card>

          <Card className="p-6 border-none shadow-sm bg-white dark:bg-gray-900 overflow-visible relative group">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-orange-50 text-orange-600 rounded-[15px] group-hover:scale-110 transition-transform">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <Badge color="orange">Atenção</Badge>
            </div>
            <h3 className="text-3xl font-black text-gray-900 dark:text-white tracking-tight">{globalMetrics?.expiring_soon ?? '...'}</h3>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mt-1">Vencimentos (10 dias)</p>
            <div className="absolute -bottom-1 left-0 w-full h-1 bg-orange-500 rounded-b-full"></div>
          </Card>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[
            {
              label: 'Próximas do Limite',
              value: tenants.filter(t => {
                const limit = t.total_contact_limit || PLAN_LIMITS[t.plan] || 2000;
                return (t.customers_count || 0) / limit > 0.8;
              }).length.toString(),
              icon: AlertTriangle,
              sub: 'Uso > 80%',
              type: 'near_limit' as const,
              color: 'orange'
            },
            {
              label: 'Planos Expirados',
              value: tenants.filter(t => t.plan_expires_at && new Date(t.plan_expires_at) < new Date()).length.toString(),
              icon: Shield,
              sub: 'Ação requerida',
              type: 'expired' as const,
              color: 'red'
            },
          ].map((stat, i) => (
            <Card
              key={i}
              className={`p-6 cursor-pointer transition-all hover:shadow-md ${filterType === stat.type
                ? stat.color === 'orange'
                  ? 'ring-2 ring-orange-500 ring-offset-2 shadow-lg'
                  : 'ring-2 ring-red-500 ring-offset-2 shadow-lg'
                : 'hover:border-gray-300'
                }`}
              onClick={() => setFilterType(filterType === stat.type ? 'all' : stat.type)}
            >
              <div className="flex justify-between items-start mb-4">
                <div className={`p-3 rounded-[15px] ${stat.type === 'expired' ? 'bg-red-50' : 'bg-orange-50'}`}>
                  <stat.icon className={`w-6 h-6 ${stat.type === 'expired' ? 'text-red-600' : 'text-orange-600'}`} />
                </div>
                <div className="flex flex-col items-end">
                  <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-full ${stat.type === 'expired' ? 'bg-red-100 text-red-700' : 'bg-orange-100 text-orange-700'}`}>
                    {stat.sub}
                  </span>
                  {filterType === stat.type && (
                    <span className="text-[10px] text-gray-400 font-bold mt-1 uppercase flex items-center gap-1">
                      <Check className="w-3 h-3" /> Filtro Ativo
                    </span>
                  )}
                </div>
              </div>
              <h3 className="text-3xl font-black text-gray-900 dark:text-white tracking-tight">{stat.value}</h3>
              <p className="text-sm font-bold text-gray-500 dark:text-gray-400 mt-1 uppercase tracking-widest">{stat.label}</p>
            </Card>
          ))}
        </div>

        <Card className="overflow-hidden">
          <div className="p-6 border-b border-gray-100 dark:border-gray-800 flex flex-col sm:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-4">
              <h3 className="text-lg font-semibold">Clientes e CRM</h3>
              {filterType !== 'all' && (
                <Badge color="orange" className="cursor-pointer hover:bg-orange-200 py-1" onClick={() => setFilterType('all')}>
                  {filterType === 'near_limit' ? 'Filtro: Próximas do Limite' : 'Filtro: Expirados'} <X className="w-3 h-3 ml-1" />
                </Badge>
              )}
            </div>
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-3.5 w-4 h-4 text-gray-700" />
              <Input placeholder="Buscar lojas..." className="pl-10 h-11" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-gray-500 uppercase bg-gray-50 dark:bg-gray-800/50">
                <tr>
                  <th className="px-6 py-4">Negócio</th>
                  <th className="px-6 py-4">Contato</th>
                  <th className="px-6 py-4">USO DO PLANO</th>
                  <th className="px-6 py-4">Vencimento</th>
                  <th className="px-6 py-4">Terminais</th>
                  <th className="px-6 py-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {filteredTenants.map((tenant) => {
                  const limit = tenant.total_contact_limit || PLAN_LIMITS[tenant.plan] || 2000;
                  const usage = (tenant.customers_count || 0) / limit;
                  const isExpired = tenant.plan_expires_at && new Date(tenant.plan_expires_at) < new Date();

                  return (
                    <tr key={tenant.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className={`w-2 h-2 rounded-full ${isExpired ? 'bg-red-500 animate-pulse' : usage > 0.9 ? 'bg-amber-500' : 'bg-green-500'}`} />
                          <div className="font-bold text-gray-900">{tenant.name}</div>
                        </div>
                      </td>

                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <span className="text-gray-900 font-medium text-xs">{tenant.email}</span>
                          {tenant.phone && (
                            <a
                              href={getWhatsAppLink(tenant.phone)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-green-600 hover:text-green-700 text-[10px] font-black uppercase tracking-tight flex items-center gap-1 mt-1"
                            >
                              WhatsApp <ExternalLink className="w-2.5 h-2.5" />
                            </a>
                          )}
                        </div>
                      </td>

                      <td className="px-6 py-4">
                        <div className="space-y-1">
                          <div className="flex justify-between text-[10px] font-bold uppercase tracking-wider text-gray-400">
                            <span className="flex items-center gap-1">
                              {tenant.plan === PlanType.UNLIMITED ? 'ELITE' : 'PRO'}
                              {tenant.extra_contacts_quota ? <Badge color="orange" className="text-[8px] px-1 py-0">+{(tenant.extra_contacts_quota / 1000).toFixed(0)}K</Badge> : null}
                            </span>
                            <span className={tenant.extra_contacts_quota ? 'text-primary-600 font-black' : usage > 0.9 ? 'text-amber-500' : ''}>
                              {(tenant.customers_count || 0).toLocaleString()} / {(tenant.total_contact_limit || limit).toLocaleString()}
                            </span>
                          </div>
                          <div className="w-32 h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden border border-gray-200/50">
                            <div
                              className={`h-full transition-all ${usage > 0.9 ? 'bg-red-500' : usage > 0.8 ? 'bg-orange-500' : 'bg-blue-500'}`}
                              style={{ width: `${Math.min(100, usage * 100)}%` }}
                            />
                          </div>
                          {isExpired && <p className="text-[10px] text-red-500 font-black tracking-widest uppercase">Plano Expirado</p>}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {tenant.plan_expires_at ? (
                          <div className="flex items-center gap-2">
                            <Calendar className="w-3.5 h-3.5 text-gray-400" />
                            <span className={`text-xs font-bold ${isExpired ? 'text-red-600' : 'text-gray-600'}`}>
                              {formatDateDisplay(tenant.plan_expires_at)}
                            </span>
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400">--</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col gap-2">
                          <Button
                            variant="secondary"
                            size="sm"
                            className="bg-gray-100 text-gray-700 hover:bg-gray-200 text-[10px] font-black uppercase tracking-widest py-1 h-auto"
                            onClick={() => handleOpenEditModal(tenant)}
                          >
                            Configurar
                          </Button>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button onClick={() => handleCopyPublicLink(tenant.slug)} className="p-2 text-gray-700 hover:bg-gray-100 rounded-lg" title="Copiar Link Público"><Copy className="w-4 h-4 text-primary-500" /></button>
                          <button onClick={() => handleOpenEditModal(tenant)} className="p-2 text-gray-700 hover:bg-gray-100 rounded-lg" title="Editar Loja"><Edit2 className="w-4 h-4 text-gray-700" /></button>
                          <button
                            onClick={() => handleToggleBlock(tenant)}
                            className={`p-2 rounded-lg transition-colors ${tenant.status === 'blocked' ? 'bg-red-50 text-red-600 hover:bg-red-100' : 'text-gray-700 hover:bg-gray-100'}`}
                            title={tenant.status === 'blocked' ? 'Desbloquear Loja' : 'Bloquear Loja'}
                          >
                            <Lock className={`w-4 h-4 ${tenant.status === 'blocked' ? 'text-red-600' : 'text-gray-400'}`} />
                          </button>
                          <button
                            onClick={() => handleDeleteTenant(tenant)}
                            className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                            title="Excluir Loja"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>

        {/* Modal Edit */}
        {editingTenant && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in">
            <Card className="w-full max-w-2xl p-0 shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
              <div className="p-6 border-b flex justify-between items-center bg-gray-50 flex-none">
                <h3 className="font-bold text-lg text-gray-700 flex items-center gap-2"><Shield className="w-5 h-5 text-gray-700" /> Configurar Loja</h3>
                <button onClick={handleCloseEditModal}><X className="w-5 h-5 text-gray-700" /></button>
              </div>
              <div className="p-6 space-y-8 overflow-y-auto flex-1">
                {/* SESSÃO TOP: INFORMAÇÕES E PLANO (DESTAQUE) */}
                <div className="space-y-6">
                  <div className="bg-primary-50 dark:bg-primary-950/30 p-6 rounded-[2rem] border border-primary-100 dark:border-primary-900/50 shadow-sm relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-8 opacity-5">
                      <Shield className="w-24 h-24 text-primary-500" />
                    </div>
                    <h4 className="text-xs font-black text-primary-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                      <Crown className="w-4 h-4" /> Plano e Validade
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 relative z-10">
                      <div className="space-y-4">
                        <div>
                          <label className="block text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-2">Plano Atual</label>
                          <select
                            className="w-full bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl px-5 py-3.5 text-sm font-bold text-gray-700 dark:text-gray-200 focus:ring-2 focus:ring-primary-500 transition-all outline-none shadow-sm"
                            value={editingTenant.plan}
                            onChange={(e) => {
                              const newPlan = e.target.value as PlanType;
                              setEditingTenant({
                                ...editingTenant,
                                plan: newPlan
                              });
                            }}
                          >
                            <option value={PlanType.PRO}>🔵 Pro: Limite de 4.000 contatos.</option>
                            <option value={PlanType.UNLIMITED}>🟣 Elite: Limite de 6.000 contatos.</option>
                          </select>
                        </div>
                        <Input
                          label="Limite de Contatos"
                          type="text"
                          value={editingTenant.extra_contacts_quota === -1 ? 'ILIMITADO' : (PLAN_LIMITS[editingTenant.plan] + (editingTenant.extra_contacts_quota || 0)).toLocaleString()}
                          readOnly
                          className="bg-gray-100 font-black text-gray-700"
                        />
                      </div>
                      <div className="space-y-4">
                        <div>
                          <label className="block text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-2">Renovação / Validade</label>
                          <div className="flex flex-col gap-3">
                            <div className="relative">
                              <Calendar className="absolute left-4 top-4 w-5 h-5 text-primary-500" />
                              <input
                                type="date"
                                className="w-full bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl pl-12 pr-5 py-3.5 text-lg font-black text-primary-600 focus:ring-2 focus:ring-primary-500 transition-all outline-none shadow-sm"
                                value={editingTenant.plan_expires_at ? editingTenant.plan_expires_at.split(/[T ]/)[0] : ''}
                                onChange={(e) => setEditingTenant({ ...editingTenant, plan_expires_at: e.target.value })}
                              />
                            </div>
                            <div className="flex gap-2">
                              <button
                                onClick={() => setEditingTenant({ ...editingTenant, plan_expires_at: addMonths(editingTenant.plan_expires_at!, 6) })}
                                className="flex-1 py-2.5 bg-primary-100 hover:bg-primary-200 dark:bg-primary-900/50 dark:hover:bg-primary-900 rounded-xl text-[10px] font-black text-primary-700 dark:text-primary-300 transition-all uppercase tracking-widest border border-primary-200/50"
                              >
                                +6 MESES
                              </button>
                              <button
                                onClick={() => setEditingTenant({ ...editingTenant, plan_expires_at: addMonths(editingTenant.plan_expires_at!, 12) })}
                                className="flex-1 py-2.5 bg-primary-500 hover:bg-primary-700 rounded-xl text-[10px] font-black text-white transition-all uppercase tracking-widest shadow-md shadow-slate-400/20"
                              >
                                +12 MESES
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* PACCOTES DE EXPANSÃO */}
                  <div className="bg-white dark:bg-gray-900/50 p-6 rounded-[2rem] border border-gray-100 dark:border-gray-800 shadow-sm">
                    <h4 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                      <ArrowUpCircle className="w-4 h-4 text-orange-500" /> Pacotes de Expansão (Pagamento Único)
                    </h4>
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                      {[
                        { label: 'Nenhum', value: 0 },
                        { label: 'Bronze (+1k)', value: 1000 },
                        { label: 'Prata (+2k)', value: 2000 },
                        { label: 'Ouro (+4k)', value: 4000 },
                        { label: 'Infinity', value: -1 },
                      ].map((pack) => (
                        <button
                          key={pack.label}
                          onClick={() => setEditingTenant({ ...editingTenant, extra_contacts_quota: pack.value })}
                          className={`px-4 py-3 rounded-xl border text-[10px] font-black uppercase tracking-tight transition-all
                            ${editingTenant.extra_contacts_quota === pack.value
                              ? 'bg-orange-500 text-white border-orange-500 shadow-lg shadow-orange-500/20'
                              : 'bg-gray-50 dark:bg-gray-800 text-gray-500 border-gray-100 dark:border-gray-700 hover:border-orange-300'
                            }`}
                        >
                          {pack.label}
                        </button>
                      ))}
                    </div>
                    <p className="text-[9px] text-gray-400 font-bold uppercase mt-3 text-center">
                      Limite Total: {(editingTenant.extra_contacts_quota === -1) ? 'ILIMITADO' : (editingTenant.custom_contact_limit || PLAN_LIMITS[editingTenant.plan] || 0) + (editingTenant.extra_contacts_quota || 0)}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <Input label="Nome da Loja" value={editingTenant.name} onChange={(e) => setEditingTenant({ ...editingTenant, name: e.target.value })} />
                    <Input label="E-mail Administrativo" value={editingTenant.email} onChange={(e) => setEditingTenant({ ...editingTenant, email: e.target.value })} />
                    <Input label="Nome do Proprietário" value={editingTenant.owner_name || ''} onChange={(e) => setEditingTenant({ ...editingTenant, owner_name: e.target.value })} />
                    <Input label="Telefone (Japão)" placeholder="090-0000-0000" value={editingTenant.phone || ''} onChange={(e) => setEditingTenant({ ...editingTenant, phone: formatJapanesePhone(e.target.value) })} />
                  </div>
                </div>

                <hr className="border-gray-100 dark:border-gray-800" />


                {/* SESSÃO: GERENCIAR TOTENS (TODOS OS PLANOS) */}
                {editingTenant && (
                  <div className="space-y-8">
                    <div className="space-y-6">
                      <div className="flex items-center justify-between">
                        <h4 className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-[0.2em] flex items-center gap-2">
                          <Smartphone className="w-5 h-5 text-primary-500" /> Gerenciar Totens
                        </h4>
                      </div>
                      <div className="space-y-4">
                        <div className="grid grid-cols-1 gap-4">
                          <Input
                            label="Nome do Totem (Controle Interno/Lojista)"
                            placeholder="Ex: Totem Principal - Entrada"
                            value={newDeviceData.name}
                            onChange={(e) => setNewDeviceData({ ...newDeviceData, name: e.target.value })}
                          />
                        </div>
                        <Button
                          className="w-full bg-primary-500 hover:bg-primary-700 text-white py-3.5 font-black uppercase tracking-widest shadow-lg shadow-slate-400/20"
                          onClick={() => {
                            const data = { ...newDeviceData, mode: 'approval' };
                            tenantsService.createDevice(tenantForDevices!.id, { ...data, responsible_name: data.name })
                              .then(() => {
                                fetchStoreDevices(tenantForDevices!.id);
                                setNewDeviceData({ name: '', mode: 'approval' });
                              })
                              .catch((err) => {
                                setStatusModal({
                                  isOpen: true,
                                  title: 'Erro',
                                  message: err.response?.data?.message || 'Não foi possível registrar o terminal.',
                                  type: 'error'
                                });
                              });
                          }}
                          disabled={isLoading || !newDeviceData.name}
                        >
                          {isLoading ? 'Registrando...' : '[+ REGISTRAR NOVO TOTEM]'}
                        </Button>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <h4 className="text-sm font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                        <Monitor className="w-4 h-4" /> Totens Ativos
                      </h4>
                      {storeDevices.length === 0 ? (
                        <div className="text-center py-8 text-gray-400 italic bg-gray-50 rounded-2xl border border-dashed border-gray-200">
                          Nenhum totem registrado para esta loja.
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 gap-3">
                          {storeDevices.map((device) => {
                            const publicUrl = `${window.location.origin}/p/${editingTenant.slug}`;
                            return (
                              <div key={device.id} className="bg-white dark:bg-gray-900/40 p-5 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm flex flex-col gap-4 group">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-3">
                                    <div className="p-2 rounded-xl bg-primary-100 dark:bg-primary-900/30 text-primary-600">
                                      <Monitor className="w-5 h-5" />
                                    </div>
                                    <div>
                                      <input
                                        className="font-black text-gray-900 dark:text-white uppercase tracking-tight bg-transparent border-none p-0 focus:ring-0 w-full"
                                        value={device.name}
                                        onChange={(e) => handleUpdateDeviceLocal(device.id, 'name', e.target.value)}
                                        onBlur={() => handleSaveDevice(device.id)}
                                      />
                                      <div className="flex items-center gap-1">
                                        <span className="text-[10px] text-gray-400 font-mono uppercase">Lote/UID:</span>
                                        <input
                                          className="text-[10px] text-primary-600 font-mono uppercase bg-transparent border-none p-0 focus:ring-0 w-32"
                                          value={device.nfc_uid}
                                          onChange={(e) => handleUpdateDeviceLocal(device.id, 'nfc_uid', e.target.value)}
                                          onBlur={() => handleSaveDevice(device.id)}
                                        />
                                      </div>
                                    </div>
                                  </div>
                                  <button
                                    onClick={() => handleDeleteDevice(device.id)}
                                    className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                                    title="Remover Totem"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>

                                <div className="space-y-2">
                                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1 text-primary-600">Link do Totem (Físico - Gravar no NFC)</label>
                                  <div className="flex gap-2">
                                    <div className="flex-1 bg-primary-50 dark:bg-primary-900/10 px-4 py-2.5 rounded-xl border border-primary-100 dark:border-primary-800 text-[11px] font-mono text-primary-700 dark:text-primary-400 truncate select-all">
                                      {window.location.origin}/terminal/{editingTenant.slug}/{device.nfc_uid}
                                    </div>
                                    <button
                                      onClick={() => {
                                        const text = `${window.location.origin}/terminal/${editingTenant.slug}/${device.nfc_uid}`;
                                        copyToClipboard(text);
                                        setCopiedId(device.id);
                                        setTimeout(() => setCopiedId(null), 2000);
                                      }}
                                      className={`px-4 py-2 ${copiedId === device.id ? 'bg-green-500 hover:bg-green-600' : 'bg-primary-500 hover:bg-primary-600'} text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-md flex items-center gap-2`}
                                    >
                                      {copiedId === device.id ? (
                                        <>
                                          <Check className="w-3.5 h-3.5" /> Copiado
                                        </>
                                      ) : (
                                        <>
                                          <Copy className="w-3.5 h-3.5" /> Copiar Link
                                        </>
                                      )}
                                    </button>
                                  </div>
                                  <p className="text-[9px] text-gray-400 font-bold uppercase ml-1 italic">* Use este link exclusivamente nos totens físicos para liberar a função "Registrar Visita".</p>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                )}

              </div>
              <div className="p-6 border-t flex justify-end gap-2 bg-gray-50 flex-none">
                <Button variant="secondary" onClick={handleCloseEditModal}>Cancelar</Button>
                <Button className="bg-[#25aae1] text-white" onClick={handleUpdateTenant} disabled={isLoading}>
                  {isLoading ? 'Salvando...' : 'Salvar Alterações'}
                </Button>
              </div>
            </Card>
          </div>
        )}

        {/* Modal Criar Novo CRM */}
        {
          isCreateModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in">
              <Card className="w-full max-w-md p-6 shadow-2xl">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="font-bold text-lg">Novo CRM SaaS</h3>
                  <button onClick={() => { setIsCreateModalOpen(false); setCreatedCredentials(null); }}><X className="w-5 h-5" /></button>
                </div>

                {createdCredentials ? (
                  <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
                    <div className="flex flex-col items-center text-center space-y-2">
                      <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-2">
                        <CheckCircle className="w-10 h-10 text-green-500" />
                      </div>
                      <h4 className="text-xl font-bold text-gray-900">Configuração Concluída!</h4>
                      <p className="text-sm text-gray-500">O acesso para {createdCredentials.name} foi gerado.</p>
                    </div>

                    <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100 space-y-3">
                      <div className="flex justify-between items-center text-xs font-bold text-gray-400 uppercase tracking-widest">
                        <span>Mensagem de Boas-vindas</span>
                        <Badge color="green">Pronta para envio</Badge>
                      </div>
                      <div className="bg-white p-4 rounded-xl border border-gray-200 text-sm font-mono whitespace-pre-wrap leading-relaxed">
                        {`Olá *${createdCredentials.name}*! 👋\n\nSeu acesso ao sistema CPgestão Fidelidade foi configurado com sucesso.\n\n📍 *Dados de Acesso:*\n📧 Login: ${createdCredentials.email}\n🔑 Senha: ${createdCredentials.password}\n\n🔗 *Painel de Gestão:*\n${createdCredentials.url}\n\n⚠️ *OBS:* Por segurança, sua senha deve ser redefinida no primeiro acesso. (Regra: Mínimo de 8 dígitos, maiúscula e número).`}
                      </div>
                    </div>

                    <div className="space-y-3">
                      <Button
                        className="w-full bg-[#25D366] hover:bg-[#128C7E] text-white py-4 font-bold shadow-lg shadow-green-500/20 flex items-center justify-center gap-2"
                        onClick={copyWhatsAppMessage}
                      >
                        <Copy className="w-5 h-5" /> Copiar para WhatsApp
                      </Button>
                      <Button
                        variant="secondary"
                        className="w-full py-3"
                        onClick={() => { setIsCreateModalOpen(false); setCreatedCredentials(null); }}
                      >
                        Fechar e Continuar
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <Input label="Nome da Loja" placeholder="Ex: Barber Shop" value={newTenantData.name} onChange={(e) => setNewTenantData({ ...newTenantData, name: capitalizeWords(e.target.value) })} />
                    <div className="grid grid-cols-2 gap-4">
                      <Input label="Proprietário" placeholder="Nome completo" value={newTenantData.owner_name} onChange={(e) => setNewTenantData({ ...newTenantData, owner_name: capitalizeWords(e.target.value) })} />
                      <Input label="Telefone (Japão)" placeholder="090-0000-0000" value={newTenantData.phone} onChange={(e) => setNewTenantData({ ...newTenantData, phone: formatJapanesePhone(e.target.value) })} />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <Input label="E-mail Administrativo" placeholder="dono@loja.com" value={newTenantData.email} onChange={(e) => setNewTenantData({ ...newTenantData, email: e.target.value })} />
                      <Input
                        label="Limite de Contatos"
                        type="text"
                        value={newTenantData.extra_contacts_quota === -1 ? 'ILIMITADO' : (PLAN_LIMITS[newTenantData.plan] + (newTenantData.extra_contacts_quota || 0)).toLocaleString()}
                        readOnly
                        className="bg-gray-100 font-bold"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Plano</label>
                        <select
                          className="w-full bg-gray-50 border border-gray-200 rounded-[15px] px-4 py-3 text-sm focus:ring-2 focus:ring-primary-500 transition-all outline-none"
                          value={newTenantData.plan}
                          onChange={(e) => {
                            const p = e.target.value as PlanType;
                            setNewTenantData({ ...newTenantData, plan: p });
                          }}
                        >
                          <option value={PlanType.PRO}>🔵 Pro: Limite de 4.000 contatos.</option>
                          <option value={PlanType.UNLIMITED}>🟣 Elite: Limite de 6.000 contatos.</option>
                        </select>
                      </div>
                      <div className="space-y-2">
                        <Input label="Validade" type="date" value={newTenantData.plan_expires_at} onChange={(e) => setNewTenantData({ ...newTenantData, plan_expires_at: e.target.value })} />
                        <div className="flex gap-2">
                          <button
                            onClick={() => setNewTenantData({ ...newTenantData, plan_expires_at: addMonths(newTenantData.plan_expires_at, 6) })}
                            className="flex-1 py-1.5 bg-gray-50 hover:bg-gray-100 border border-gray-100 rounded text-[10px] font-bold text-gray-500 transition-colors"
                          >
                            6 MESES
                          </button>
                          <button
                            onClick={() => setNewTenantData({ ...newTenantData, plan_expires_at: addMonths(newTenantData.plan_expires_at, 12) })}
                            className="flex-1 py-1.5 bg-gray-50 hover:bg-gray-100 border border-gray-100 rounded text-[10px] font-bold text-gray-500 transition-colors"
                          >
                            12 MESES
                          </button>
                        </div>
                      </div>

                      <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100">
                        <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">Pacote de Expansão</label>
                        <div className="grid grid-cols-3 gap-2">
                          {[
                            { label: 'Off', value: 0 },
                            { label: 'Bronze', value: 1000 },
                            { label: 'Prata', value: 2000 },
                            { label: 'Ouro', value: 4000 },
                            { label: 'Infinity', value: -1 },
                          ].map((pack) => (
                            <button
                              key={pack.label}
                              type="button"
                              onClick={() => setNewTenantData({ ...newTenantData, extra_contacts_quota: pack.value })}
                              className={`py-2 rounded-lg border text-[9px] font-bold uppercase transition-all
                                ${newTenantData.extra_contacts_quota === pack.value
                                  ? 'bg-orange-500 text-white border-orange-500'
                                  : 'bg-white text-gray-500 border-gray-200 hover:border-orange-200'
                                }`}
                            >
                              {pack.label}
                            </button>
                          ))}
                        </div>
                      </div>
                      <Input
                        label="Qtd de Totens"
                        type="number"
                        min={0}
                        max={10}
                        value={newTenantData.totems_count}
                        onChange={(e) => setNewTenantData({ ...newTenantData, totems_count: parseInt(e.target.value) })}
                      />
                    </div>
                    <Button className="w-full bg-[#25aae1] text-white py-4 mt-2 font-bold shadow-lg shadow-cyan-500/20" onClick={handleCreateTenant} disabled={isLoading}>
                      {isLoading ? 'Criando...' : 'Finalizar Setup'}
                    </Button>
                  </div>
                )}
              </Card>
            </div>
          )
        }

        {
          statusModal.isOpen && (
            <StatusModal
              isOpen={statusModal.isOpen}
              title={statusModal.title}
              message={statusModal.message}
              type={statusModal.type}
              theme="accent"
              onClose={() => setStatusModal(prev => ({ ...prev, isOpen: false }))}
            />
          )
        }

      </div>
    </>
  );
};
