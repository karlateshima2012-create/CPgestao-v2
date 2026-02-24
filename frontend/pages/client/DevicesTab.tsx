import React, { useState, useEffect } from 'react';
import { Card, Button, Input, Badge, StatusModal } from '../../components/ui';
import {
    Smartphone, Monitor, Copy,
    ArrowDownLeft, Crown, Search, CheckCircle2, X, MessageCircle, HelpCircle
} from 'lucide-react';
import { Device, Contact, DeviceBatch, PlanType } from '../../types';
import api from '../../services/api';
import { copyToClipboard } from '../../utils/clipboard';

interface DevicesTabProps {
    tenantPlan?: PlanType;
    tenantSlug?: string | null;
    contacts?: Contact[];
}

export const DevicesTab: React.FC<DevicesTabProps> = ({ tenantPlan, tenantSlug, contacts = [] }) => {
    const [isLoading, setIsLoading] = useState(false);
    const [modal, setModal] = useState<{
        isOpen: boolean; title: string; message: string;
        type: 'success' | 'error' | 'info' | 'warning';
        onConfirm?: () => void; confirmLabel?: string;
    }>({ isOpen: false, title: '', message: '', type: 'info' });

    // Totem State
    const [devices, setDevices] = useState<any[]>([]);
    const [editingTelegram, setEditingTelegram] = useState<string | null>(null);
    const [telegramData, setTelegramData] = useState({ chat_id: '' });
    const [generalTelegramId, setGeneralTelegramId] = useState('');
    const [isEditingGeneral, setIsEditingGeneral] = useState(false);

    // Cards State
    const [selectedBatch, setSelectedBatch] = useState<DeviceBatch | null>(null);
    const [batches, setBatches] = useState<DeviceBatch[]>([]);
    const [batchCards, setBatchCards] = useState<Device[]>([]);
    const [showLinkModal, setShowLinkModal] = useState<Device | null>(null);
    const [customerSearch, setCustomerSearch] = useState('');
    const [batchPagination, setBatchPagination] = useState({ current_page: 1, last_page: 1, total: 0 });
    const [batchFilter, setBatchFilter] = useState<'all' | 'available' | 'linked'>('all');

    useEffect(() => {
        fetchDevices();
        fetchGeneralSettings();
        if (tenantPlan === PlanType.CLASSIC) {
            fetchBatches();
        }
    }, [tenantPlan]);

    useEffect(() => {
        const urlParams = new URLSearchParams(window.location.search);
        const linkUid = urlParams.get('link_uid');
        if (linkUid) {
            setShowLinkModal({ uid: linkUid } as any);
            window.history.replaceState({}, document.title, window.location.pathname + '?tab=devices');
        }
    }, []);

    const fetchGeneralSettings = async () => {
        try {
            const res = await api.get('/client/settings');
            setGeneralTelegramId(res.data.settings?.telegram_chat_id || '');
        } catch (error) {
            console.error('Error fetching general settings', error);
        }
    };

    const fetchDevices = async () => {
        try {
            const res = await api.get('/client/devices?type=default');
            setDevices(Array.isArray(res.data) ? res.data : []);
        } catch (error) {
            console.error('Error fetching devices', error);
        }
    };

    const handleUpdateGeneralTelegram = async () => {
        setIsLoading(true);
        try {
            await api.patch('/client/settings', {
                telegram_chat_id: generalTelegramId
            });
            setModal({
                isOpen: true, title: 'Configuração Salva',
                message: 'O Chat ID para notificações gerais foi atualizado.', type: 'success'
            });
            setIsEditingGeneral(false);
        } catch (error) {
            setModal({
                isOpen: true, title: 'Erro ao Salvar',
                message: 'Não foi possível salvar o Chat ID.', type: 'error'
            });
        } finally {
            setIsLoading(false);
        }
    };


    const handleUpdateTelegram = async (deviceId: string) => {
        setIsLoading(true);
        try {
            await api.put(`/client/devices/${deviceId}`, {
                telegram_chat_id: telegramData.chat_id
            });
            setModal({
                isOpen: true, title: 'Configuração Salva',
                message: 'O Chat ID do Telegram foi atualizado com sucesso.', type: 'success'
            });
            setEditingTelegram(null);
            fetchDevices();
        } catch (error) {
            setModal({
                isOpen: true, title: 'Erro ao Salvar',
                message: 'Não foi possível salvar a configuração do Telegram.', type: 'error'
            });
        } finally {
            setIsLoading(false);
        }
    };

    // --- Cards Methods ---
    const fetchBatches = async () => {
        try {
            const res = await api.get('/client/premium-batches');
            setBatches(res.data || []);
        } catch (error) {
            console.error('Error fetching batches:', error);
        }
    };

    const fetchBatchCards = async (batchId: string, page: number = 1, status: string = 'all') => {
        try {
            setIsLoading(true);
            const res = await api.get(`/client/premium-batches/${batchId}/cards`, {
                params: { page, status: status !== 'all' ? status : undefined }
            });
            setBatchCards(res.data.data || []);
            setBatchPagination({
                current_page: res.data.current_page,
                last_page: res.data.last_page,
                total: res.data.total
            });
        } catch (error) {
            console.error('Error fetching batch cards:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleLink = async (customerId: string) => {
        if (!showLinkModal) return;
        setIsLoading(true);
        try {
            await api.post('/client/devices/premium/link', {
                uid: showLinkModal.uid,
                customer_id: customerId
            });
            setShowLinkModal(null);
            if (selectedBatch) fetchBatchCards(selectedBatch.id, batchPagination.current_page, batchFilter);
            setModal({
                isOpen: true, title: 'Cartão Vinculado!',
                message: 'O cartão premium foi associado ao cliente com sucesso.',
                type: 'success', theme: 'accent'
            });
        } catch (error) {
            setModal({
                isOpen: true, title: 'Erro ao Vincular',
                message: 'Ocorreu um problema ao vincular o cartão.', type: 'error'
            });
        } finally {
            setIsLoading(false);
        }
    };

    const handleUnlink = async (uid: string) => {
        setModal({
            isOpen: true, title: 'Desvincular Cartão?',
            message: 'Este cartão ficará disponível para ser vinculado a outro cliente. O histórico de pontos não será afetado.',
            type: 'warning', confirmLabel: 'SIM, DESVINCULAR',
            onConfirm: async () => {
                try {
                    await api.post('/client/devices/premium/unlink', { uid });
                    if (selectedBatch) fetchBatchCards(selectedBatch.id, batchPagination.current_page, batchFilter);
                } catch (error) {
                    setModal({ isOpen: true, title: 'Erro!', message: 'Não foi possível desvincular o cartão.', type: 'error' });
                }
            }
        });
    };

    const handleDisableCard = async (uid: string) => {
        setModal({
            isOpen: true, title: 'CANCELAR CARTÃO?',
            message: 'Use esta opção APENAS se o cliente perdeu o cartão físico. O cartão será bloqueado permanentemente.',
            type: 'warning', confirmLabel: 'SIM, CANCELAR PERMANENTEMENTE',
            onConfirm: async () => {
                try {
                    await api.post('/client/devices/premium/disable', { uid });
                    if (selectedBatch) fetchBatchCards(selectedBatch.id, batchPagination.current_page, batchFilter);
                    setModal({ isOpen: true, title: 'Cartão Cancelado', message: 'Bloqueado com sucesso.', type: 'success', theme: 'accent' });
                } catch (error) {
                    setModal({ isOpen: true, title: 'Erro!', message: 'Não foi possível cancelar o cartão.', type: 'error' });
                }
            }
        });
    };

    const formatUID = (uid: string) => {
        if (uid.length === 16) return uid.replace(/(\d{4})(\d{4})(\d{4})(\d{4})/, '$1-$2-$3-$4');
        return uid;
    };

    const filteredCustomers = (contacts || []).filter(c => {
        if (!c) return false;
        const name = (c.name || '').toLowerCase();
        const search = (customerSearch || '').toLowerCase();
        const phone = (c.phone || '');
        return name.includes(search) || phone.includes(customerSearch || '');
    });

    const recentBatches = [...batches]
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 10);

    return (
        <div className="space-y-6 animate-fade-in pb-12 w-full max-w-5xl mx-auto pt-6">
            {/* SESSSÃO: CONFIGURAÇÃO DE NOTIFICAÇÃO CENTRAL */}
            <div className="bg-blue-50/50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-900/30 p-6 rounded-[15px] space-y-4">
                <div className="flex items-center justify-between">
                    <div>
                        <h3 className="text-sm font-black text-blue-700 dark:text-blue-500 uppercase tracking-widest flex items-center gap-2">
                            <MessageCircle className="w-5 h-5" /> ID para Aprovação de Pontos (Telegram)
                        </h3>
                        <p className="text-[10px] text-blue-600/70 font-bold mt-1">
                            Este ID receberá os pedidos de aprovação dos Totens e Cartões NFC.
                        </p>
                    </div>
                    {!isEditingGeneral && (
                        <Button
                            size="sm"
                            variant="secondary"
                            className="bg-white dark:bg-blue-900/40 text-blue-600 border-blue-200"
                            onClick={() => setIsEditingGeneral(true)}
                        >
                            {generalTelegramId ? 'Alterar ID' : 'Configurar'}
                        </Button>
                    )}
                </div>

                {isEditingGeneral ? (
                    <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-blue-100 dark:border-blue-900/30 space-y-3 animate-fade-in shadow-sm">
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Seu Chat ID do Telegram</label>
                                <a
                                    href="https://t.me/cpgestao_fidelidade_bot"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-[9px] font-bold text-blue-500 hover:underline flex items-center gap-1 uppercase"
                                >
                                    <HelpCircle className="w-3 h-3" /> Abrir Bot e pegar ID
                                </a>
                            </div>
                            <Input
                                placeholder="Ex: 123456789"
                                value={generalTelegramId}
                                onChange={e => setGeneralTelegramId(e.target.value)}
                            />
                        </div>
                        <div className="flex gap-2 justify-end">
                            <Button size="sm" variant="secondary" onClick={() => { setIsEditingGeneral(false); fetchGeneralSettings(); }}>Cancelar</Button>
                            <Button size="sm" onClick={handleUpdateGeneralTelegram} disabled={isLoading} className="bg-blue-600 text-white hover:bg-blue-700">Salvar ID</Button>
                        </div>
                    </div>
                ) : generalTelegramId && (
                    <div className="flex items-center gap-2 text-[11px] font-black">
                        <span className="bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400 px-3 py-1.5 rounded-lg border border-blue-200 dark:border-blue-800">
                            ATIVO: {generalTelegramId}
                        </span>
                    </div>
                )}
            </div>

            {/* SESSÃO: GERENCIAR TOTENS */}
            {!selectedBatch && (
                <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 p-6 rounded-[15px] space-y-6">
                    <div className="flex items-center justify-between">
                        <h3 className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-[0.2em] flex items-center gap-2">
                            <Smartphone className="w-5 h-5 text-primary-500" /> Gerenciar Totens
                        </h3>
                    </div>
                    <div className="space-y-4">
                        <h4 className="text-sm font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                            <Monitor className="w-4 h-4" /> Totens Ativos
                        </h4>
                        {devices.length === 0 ? (
                            <div className="text-center py-8 text-gray-400 italic bg-gray-50 dark:bg-gray-800/30 rounded-2xl border border-dashed border-gray-200 dark:border-gray-800">
                                Nenhum totem registrado para esta loja.
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 gap-3">
                                {devices.map((device) => (
                                    <div key={device.id} className="bg-gray-50 dark:bg-gray-800/30 p-4 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm flex flex-col md:flex-row md:items-center justify-between group gap-4">
                                        <div className="flex items-center gap-3">
                                            <div className="p-2 rounded-xl bg-blue-100 text-blue-600">
                                                <Monitor className="w-5 h-5" />
                                            </div>
                                            <div>
                                                <p className="font-bold text-gray-700 dark:text-gray-200">{device.name}</p>
                                                <p className="text-[10px] text-gray-400 font-mono select-all uppercase">UID: {device.nfc_uid}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-4 justify-between md:justify-end">
                                            <div className="text-right">
                                                <p className="text-[10px] font-black uppercase text-gray-400">Página do Terminal</p>
                                                <button
                                                    onClick={() => {
                                                        if (tenantSlug) copyToClipboard(`${window.location.origin}/terminal/${tenantSlug}/${device.nfc_uid}`)
                                                    }}
                                                    className="text-xs text-blue-500 hover:underline flex items-center gap-1"
                                                >
                                                    <Copy className="w-3.5 h-3.5" /> Copiar Link
                                                </button>
                                            </div>
                                        </div>

                                        {/* Telegram Notification Management */}
                                        <div className="w-full mt-2 pt-4 border-t border-gray-100 dark:border-gray-800">
                                            <div className="flex items-center justify-between mb-2">
                                                <p className="text-xs font-bold text-gray-500 flex items-center gap-1">
                                                    <MessageCircle className="w-3.5 h-3.5 text-blue-500" /> Notificação Telegram
                                                </p>
                                                {editingTelegram !== device.id && (
                                                    <button
                                                        onClick={() => {
                                                            setEditingTelegram(device.id);
                                                            setTelegramData({ chat_id: device.telegram_chat_id || '' });
                                                        }}
                                                        className="text-[10px] text-blue-500 hover:underline font-bold uppercase tracking-widest disabled:opacity-50"
                                                    >
                                                        {device.telegram_chat_id ? 'Alterar Chat ID' : 'Configurar Telegram'}
                                                    </button>
                                                )}
                                            </div>

                                            {editingTelegram === device.id ? (
                                                <div className="bg-white dark:bg-gray-800 p-3 rounded-xl border border-blue-100 dark:border-blue-900/30 space-y-3 mt-2 animate-fade-in">
                                                    <div className="space-y-2">
                                                        <div className="flex items-center justify-between">
                                                            <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">ID de Notificação (Telegram)</label>
                                                            <a
                                                                href="https://t.me/cpgestao_fidelidade_bot"
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="text-[9px] font-bold text-blue-500 hover:underline flex items-center gap-1 uppercase"
                                                            >
                                                                <HelpCircle className="w-3 h-3" /> Como pegar meu ID?
                                                            </a>
                                                        </div>
                                                        <Input
                                                            placeholder="Ex: 123456789"
                                                            value={telegramData.chat_id}
                                                            onChange={e => setTelegramData({ chat_id: e.target.value })}
                                                        />
                                                    </div>
                                                    <div className="flex gap-2 justify-end">
                                                        <Button size="sm" variant="secondary" onClick={() => setEditingTelegram(null)}>Cancelar</Button>
                                                        <Button size="sm" onClick={() => handleUpdateTelegram(device.id)} disabled={isLoading}>Salvar</Button>
                                                    </div>
                                                </div>
                                            ) : (
                                                (device.telegram_chat_id && tenantPlan !== PlanType.CLASSIC) ? (
                                                    <div className="flex items-center gap-4 text-[10px] font-medium text-gray-600 dark:text-gray-400">
                                                        <span className="bg-blue-50 dark:bg-blue-900/20 px-2 py-1 rounded-md border border-blue-100 dark:border-blue-900/30">
                                                            <b className="text-blue-500">CANAL ATIVO (CHAT ID):</b> {device.telegram_chat_id}
                                                        </span>
                                                    </div>
                                                ) : (
                                                    <p className="text-[10px] text-gray-400 italic">
                                                        Notificações desativadas para este totem.
                                                    </p>
                                                )
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* SESSÃO: GERENCIAR CARTÕES */}
            {selectedBatch ? (
                <div className="space-y-6 animate-fade-in">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <button onClick={() => setSelectedBatch(null)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors">
                                <ArrowDownLeft className="w-6 h-6 rotate-45 text-gray-400" />
                            </button>
                            <div>
                                <h2 className="text-2xl font-black text-gray-900 dark:text-white uppercase tracking-tighter">Lote #{selectedBatch.batch_number || selectedBatch.id.slice(0, 8)}</h2>
                                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">{selectedBatch.assigned} cartões disponíveis / {selectedBatch.linked} vinculados</p>
                            </div>
                        </div>
                        <Button variant="secondary" size="sm" onClick={() => setSelectedBatch(null)} className="font-bold">
                            Voltar aos Lotes
                        </Button>
                    </div>

                    <div className="flex gap-2 bg-gray-50 dark:bg-gray-800 p-2 rounded-[15px] border border-gray-100 dark:border-gray-700 w-fit">
                        {[
                            { id: 'all', label: 'Todos' },
                            { id: 'available', label: 'Disponíveis' },
                            { id: 'linked', label: 'Vinculados' }
                        ].map(f => (
                            <button
                                key={f.id}
                                onClick={() => {
                                    setBatchFilter(f.id as any);
                                    fetchBatchCards(selectedBatch.id, 1, f.id);
                                }}
                                className={`px-4 py-2 rounded-[12px] text-xs font-bold transition-all ${batchFilter === f.id ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
                            >
                                {f.label}
                            </button>
                        ))}
                    </div>

                    <Card className="overflow-hidden border-none shadow-sm">
                        <table className="w-full text-left">
                            <thead className="bg-gray-50 dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700">
                                <tr>
                                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-gray-400">Cartão ID (UID)</th>
                                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-gray-400">Status</th>
                                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-gray-400">Cliente Atual</th>
                                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-gray-400 text-right">Ação</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                                {batchCards.map(card => (
                                    <tr key={card.id} className="hover:bg-gray-50/30 dark:hover:bg-gray-800/20 transition-colors">
                                        <td className="px-4 py-3 font-mono font-bold text-gray-700 dark:text-gray-300">
                                            {card.uid_formatted || card.uid}
                                        </td>
                                        <td className="px-6 py-4">
                                            <Badge color={card.status === 'linked' ? 'yellow' : card.status === 'disabled' ? 'red' : 'green'}>
                                                {card.status === 'linked' ? 'VINCULADO' : card.status === 'disabled' ? 'BLOQUEADO' : 'DISPONÍVEL'}
                                            </Badge>
                                        </td>
                                        <td className="px-6 py-4">
                                            {card.customer ? (
                                                <div className="flex flex-col">
                                                    <span className="font-bold text-gray-900 dark:text-white">{card.customer.name}</span>
                                                    <span className="text-[10px] font-bold text-gray-400 uppercase">{card.customer.phone}</span>
                                                </div>
                                            ) : (
                                                <span className="text-xs text-gray-300 italic">Disponível para uso</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex justify-end gap-2">
                                                {card.status === 'assigned' && (
                                                    <Button size="sm" variant="secondary" className="font-bold" onClick={() => setShowLinkModal(card)}>
                                                        Vincular
                                                    </Button>
                                                )}
                                                {card.status === 'linked' && (
                                                    <Button size="sm" variant="ghost" className="text-gray-400 hover:text-red-500 font-bold" onClick={() => handleUnlink(card.uid)}>
                                                        Desvincular
                                                    </Button>
                                                )}
                                                {card.status !== 'disabled' && (
                                                    <Button size="sm" variant="ghost" className="p-2 h-auto text-gray-200 hover:text-red-600 transition-colors" onClick={() => handleDisableCard(card.uid)} title="Cancelar Cartão">
                                                        <X className="w-5 h-5" />
                                                    </Button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        {batchCards.length === 0 && (
                            <p className="text-center py-20 text-gray-400 italic">Nenhum cartão neste lote.</p>
                        )}

                        {batchPagination.last_page > 1 && (
                            <div className="flex justify-between items-center px-6 py-4 bg-gray-50 dark:bg-gray-800/50 border-t border-gray-100 dark:border-gray-700">
                                <p className="text-xs font-bold text-gray-400 uppercase">
                                    Total: {batchPagination.total} cartões
                                </p>
                                <div className="flex gap-2">
                                    <Button size="sm" variant="secondary" disabled={batchPagination.current_page === 1 || isLoading} onClick={() => fetchBatchCards(selectedBatch.id, batchPagination.current_page - 1, batchFilter)}>
                                        Anterior
                                    </Button>
                                    <div className="flex items-center px-3 text-xs font-bold text-gray-600 dark:text-gray-400">
                                        Página {batchPagination.current_page} de {batchPagination.last_page}
                                    </div>
                                    <Button size="sm" variant="secondary" disabled={batchPagination.current_page === batchPagination.last_page || isLoading} onClick={() => fetchBatchCards(selectedBatch.id, batchPagination.current_page + 1, batchFilter)}>
                                        Próxima
                                    </Button>
                                </div>
                            </div>
                        )}
                    </Card>
                </div>
            ) : (
                tenantPlan === PlanType.CLASSIC && (
                    <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 p-6 rounded-[15px] space-y-6">
                        <h2 className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-[0.2em] flex items-center gap-2">
                            <Crown className="w-5 h-5 text-gray-700 dark:text-gray-300" />
                            Lotes de Cartões (VIP)
                        </h2>

                        <Card className="border-none shadow-sm overflow-hidden border border-gray-100 dark:border-gray-800">
                            <table className="w-full text-left text-sm">
                                <thead className="bg-gray-50 dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700">
                                    <tr>
                                        <th className="px-6 py-4 text-[10px] font-black uppercase text-gray-400">Lote</th>
                                        <th className="px-6 py-4 text-[10px] font-black uppercase text-gray-400">Status</th>
                                        <th className="px-6 py-4 text-[10px] font-black uppercase text-gray-400 text-right">Ação</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                                    {recentBatches.map(batch => (
                                        <tr key={batch.id} className={`${batch.linked === batch.total ? 'opacity-50' : ''} hover:bg-gray-50/50 dark:hover:bg-gray-800/30 transition-all cursor-pointer`} onClick={() => { setSelectedBatch(batch); setBatchFilter('all'); fetchBatchCards(batch.id, 1, 'all'); }}>
                                            <td className="px-6 py-4 font-bold text-gray-900 dark:text-white uppercase">#{batch.batch_number || batch.id.slice(0, 8)}</td>
                                            <td className="px-6 py-4">
                                                <div className="flex flex-col gap-1">
                                                    <div className="flex justify-between text-[10px] font-bold text-gray-400 uppercase">
                                                        <span>{batch.linked}/{batch.total} Vinculados</span>
                                                    </div>
                                                    <div className="w-24 h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                                                        <div
                                                            className="h-full bg-yellow-400 rounded-full"
                                                            style={{ width: `${(batch.linked / batch.total) * 100}%` }}
                                                        />
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <button className="text-primary-500 font-bold text-xs uppercase hover:underline">
                                                    Gerenciar
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            {batches.length === 0 && (
                                <p className="text-center py-12 text-gray-400 italic">Nenhum lote criado.</p>
                            )}
                        </Card>
                    </div>
                )
            )}

            {/* Modal Vincular */}
            {showLinkModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
                    <Card className="w-full max-w-md p-0 shadow-2xl border-none overflow-hidden">
                        <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                            <h3 className="font-bold text-lg text-gray-900 flex items-center gap-2"><Crown className="w-5 h-5 text-gray-700" /> Vincular Cartão</h3>
                            <button onClick={() => setShowLinkModal(null)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
                        </div>
                        <div className="p-8 space-y-6">
                            <div className="p-4 bg-yellow-50 rounded-[15px] border border-yellow-100">
                                <p className="text-[10px] font-bold text-yellow-600 uppercase tracking-widest mb-1">Cartão ID</p>
                                <p className="font-mono font-bold text-gray-700">{formatUID(showLinkModal.uid)}</p>
                            </div>
                            <div className="relative">
                                <Search className="absolute left-3 top-3.5 w-4 h-4 text-gray-400" />
                                <Input
                                    placeholder="Buscar no CRM..."
                                    className="pl-10"
                                    value={customerSearch}
                                    onChange={(e) => setCustomerSearch(e.target.value)}
                                />
                            </div>
                            <div className="space-y-2 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                                {filteredCustomers.map(customer => (
                                    <button
                                        key={customer.id}
                                        onClick={() => handleLink(customer.id)}
                                        className="w-full p-4 rounded-[15px] border border-gray-100 hover:border-yellow-400 hover:bg-yellow-50/30 transition-all flex justify-between items-center group"
                                    >
                                        <div className="text-left">
                                            <p className="font-bold text-sm text-gray-900">{customer.name}</p>
                                            <p className="text-[10px] text-gray-400 font-bold uppercase">{customer.phone}</p>
                                        </div>
                                        <CheckCircle2 className="w-5 h-5 text-transparent group-hover:text-gray-700 transition-colors" />
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div className="p-6 border-t border-gray-100 bg-gray-50/30 flex gap-2">
                            <Button variant="secondary" className="flex-1" onClick={() => setShowLinkModal(null)}>Cancelar</Button>
                        </div>
                    </Card>
                </div>
            )}

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
