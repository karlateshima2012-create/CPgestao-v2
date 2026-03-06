
import React, { useState } from 'react';
import api from '../services/api';
import { Contact, PlanType } from '../types';
import { DashboardTab } from './client/DashboardTab';
import { ClientsTab } from './client/ClientsTab';
import { EditorTab } from './client/EditorTab';
import { ExportTab } from './client/ExportTab';
import { AccountTab } from './client/AccountTab';
import { LoyaltyTab } from './client/LoyaltyTab';
import { DevicesTab } from './client/DevicesTab';
import { VisitRecordsTab } from './client/VisitRecordsTab';
import { StatusModal } from '../components/ui';
import { copyToClipboard } from '../utils/clipboard';

type ClientTab = 'dashboard' | 'clients' | 'loyalty' | 'devices' | 'visits' | 'new' | 'export' | 'account';

interface ClientCRMProps {
  tenantPlan?: PlanType;
  contacts: Contact[];
  setContacts: (contacts: Contact[]) => void;
  selectedContact: Contact | null;
  setSelectedContact: (contact: Contact | null) => void;
  metrics: any;
  onRefresh: (params?: any) => void;
  activeTab: ClientTab;
  onChangeTab: (tab: ClientTab) => void;
  onTerminalMode: () => void;
  tenantSlug: string | null;
}

export const ClientCRM: React.FC<ClientCRMProps> = ({ tenantPlan, contacts, setContacts, selectedContact, setSelectedContact, metrics, onRefresh, activeTab, onChangeTab, onTerminalMode, tenantSlug }) => {
  const [copiedLink, setCopiedLink] = useState(false);
  const [modal, setModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    type: 'success' | 'error' | 'info' | 'warning';
    onConfirm?: () => void;
    confirmLabel?: string;
  }>({
    isOpen: false,
    title: '',
    message: '',
    type: 'info'
  });

  const handleDelete = async (id: string) => {
    setModal({
      isOpen: true,
      title: 'Excluir Cliente?',
      message: 'Esta ação não pode ser desfeita. Todo o histórico de pontos deste cliente será removido.',
      type: 'warning',
      confirmLabel: 'SIM, EXCLUIR',
      onConfirm: async () => {
        try {
          await api.delete(`/client/contacts/${id}`);
          setContacts(contacts.filter(c => c.id !== id));
        } catch (error) {
          setModal({
            isOpen: true,
            title: 'Erro!',
            message: 'Não foi possível excluir o cliente.',
            type: 'error'
          });
        }
      }
    });
  };

  const handleSave = async (data: Partial<Contact>) => {
    if (!data.name || !data.phone) {
      setModal({
        isOpen: true,
        title: 'Campos Obrigatórios',
        message: 'Nome e Telefone são obrigatórios para o cadastro.',
        type: 'info'
      });
      return;
    }

    try {
      const payload = {
        ...data,
        is_premium: false,
        points_balance: data.pointsBalance,
        last_contacted: data.lastContacted,
        reminder_date: data.reminderDate,
        reminder_time: data.reminderTime,
        reminder_text: data.reminderText,
        postal_code: data.postalCode,
        address: data.address,
        company_name: data.company_name,
        photo: (data as any).photo
      };
      if (selectedContact) {
        const res = await api.patch(`/client/contacts/${selectedContact.id}`, payload);
        const mapped = {
          ...res.data,
          pointsBalance: res.data.points_balance ?? res.data.pointsBalance ?? 0,
          isPremium: false,
          loyaltyLevel: res.data.loyalty_level ?? 1,
          loyalty_level_name: res.data.loyalty_level_name,
          postalCode: res.data.postal_code,
          address: res.data.address,
          linkedCard: res.data.devices && res.data.devices.length > 0 ? (res.data.devices[0].uid_formatted || res.data.devices[0].uid) : null,
          totalSpent: res.data.total_spent ?? res.data.totalSpent ?? 0,
          averageTicket: res.data.average_ticket ?? res.data.averageTicket ?? 0,
          attendanceCount: res.data.attendance_count ?? res.data.attendanceCount ?? 0,
          visitas: res.data.attendance_count ?? res.data.attendanceCount ?? 0,
          reminderTime: res.data.reminder_time,
          company_name: res.data.company_name,
          photo_url: res.data.photo_url,
          photo_url_full: res.data.photo_url_full
        };
        setContacts(contacts.map(c => c.id === selectedContact.id ? mapped : c));
        onRefresh();
      } else {
        const res = await api.post('/client/contacts', payload);
        const mapped = {
          ...res.data,
          pointsBalance: res.data.points_balance ?? res.data.pointsBalance ?? 0,
          isPremium: false,
          loyaltyLevel: res.data.loyalty_level ?? 1,
          loyalty_level_name: res.data.loyalty_level_name,
          postalCode: res.data.postal_code,
          address: res.data.address,
          linkedCard: res.data.devices && res.data.devices.length > 0 ? (res.data.devices[0].uid_formatted || res.data.devices[0].uid) : null,
          totalSpent: res.data.total_spent ?? res.data.totalSpent ?? 0,
          averageTicket: res.data.average_ticket ?? res.data.averageTicket ?? 0,
          attendanceCount: res.data.attendance_count ?? res.data.attendanceCount ?? 0,
          visitas: res.data.attendance_count ?? res.data.attendanceCount ?? 0,
          reminderTime: res.data.reminder_time,
          company_name: res.data.company_name,
          photo_url: res.data.photo_url,
          photo_url_full: res.data.photo_url_full
        };
        setContacts([mapped, ...contacts]);
        onRefresh();
      }

      setModal({
        isOpen: true,
        title: 'Sucesso!',
        message: selectedContact ? 'Dados do cliente atualizados com sucesso.' : 'Novo cliente cadastrado com sucesso.',
        type: 'success',
        onConfirm: () => {
          setSelectedContact(null);
          onChangeTab('clients');
        }
      });

    } catch (error: any) {
      const msg = error.response?.status === 403
        ? (error.response?.data?.error || 'Você atingiu o limite de contatos do seu plano. Realize o upgrade para continuar cadastrando.')
        : (error.response?.data?.message ||
          (error.response?.data?.code === 'DUPLICATE_PHONE' || error.response?.data?.error === 'DUPLICATE_PHONE'
            ? 'Este número de telefone já pertence a outro cliente cadastrado.'
            : 'Não foi possível salvar os dados do cliente.'));

      setModal({
        isOpen: true,
        title: error.response?.status === 403 ? 'Limite Atingido' : 'Erro ao Salvar',
        message: msg,
        type: 'error'
      });
    }
  };

  const handleExportSuccess = (ids: string[]) => {
    setContacts(contacts.map(c => ids.includes(c.id) ? { ...c, exported: true } : c));
  };

  const onCopyLink = async () => {
    if (!tenantSlug) return;
    const url = `${window.location.origin}/p/${tenantSlug}`;
    const success = await copyToClipboard(url);
    if (success) {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    } else {
      setModal({
        isOpen: true,
        title: 'Erro ao Copiar',
        message: 'Não foi possível copiar o link. Por favor, copie manualmente.',
        type: 'error'
      });
    }
  };

  return (
    <div className="w-full h-full">
      {activeTab === 'dashboard' && (
        <DashboardTab
          contacts={contacts}
          metrics={metrics}
          unexportedCount={contacts.filter(c => !c.exported).length}
          onChangeTab={onChangeTab}
          onCopyLink={onCopyLink}
          copiedLink={copiedLink}
          onTerminalMode={onTerminalMode}
          onRefresh={onRefresh}
          tenantSlug={tenantSlug}
          tenantPlan={tenantPlan}
          setSelectedContact={setSelectedContact}
        />
      )}
      {activeTab === 'loyalty' && <LoyaltyTab contacts={contacts} tenantPlan={tenantPlan} />}
      {activeTab === 'devices' && <DevicesTab tenantPlan={tenantPlan} tenantSlug={tenantSlug} contacts={contacts} />}
      {activeTab === 'visits' && <VisitRecordsTab />}
      {activeTab === 'clients' && (
        <ClientsTab contacts={contacts} onEdit={(c) => { setSelectedContact(c); onChangeTab('new'); }} onDelete={handleDelete} onNew={() => { setSelectedContact(null); onChangeTab('new'); }} onRefresh={onRefresh} />
      )}
      {activeTab === 'new' && (
        <EditorTab selectedContact={selectedContact} onSave={handleSave} onCancel={() => { setSelectedContact(null); onChangeTab('clients'); }} />
      )}
      {activeTab === 'export' && <ExportTab contacts={contacts} onExportSuccess={handleExportSuccess} />}
      {activeTab === 'account' && <AccountTab />}
      {modal.isOpen && (
        <StatusModal
          isOpen={modal.isOpen}
          title={modal.title}
          message={modal.message}
          type={modal.type}
          onConfirm={modal.onConfirm}
          confirmLabel={modal.confirmLabel}
          theme="accent"
          onClose={() => setModal(prev => ({ ...prev, isOpen: false, onConfirm: undefined }))}
        />
      )}
    </div>
  );
};
