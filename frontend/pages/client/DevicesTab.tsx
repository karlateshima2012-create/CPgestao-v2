import React, { useState, useEffect } from 'react';
import { Card, Button, Input, Badge, StatusModal } from '../../components/ui';
import {
    Smartphone, Monitor, Copy,
    MessageCircle, HelpCircle
} from 'lucide-react';
import { Device, Contact, PlanType } from '../../types';
import api from '../../services/api';
import { copyToClipboard } from '../../utils/clipboard';

interface DevicesTabProps {
    tenantPlan?: PlanType;
    tenantSlug?: string | null;
    contacts?: Contact[];
}

export const DevicesTab: React.FC<DevicesTabProps> = ({ tenantPlan, tenantSlug }) => {
    const [isLoading, setIsLoading] = useState(false);
    const [modal, setModal] = useState<{
        isOpen: boolean; title: string; message: string;
        type: 'success' | 'error' | 'info' | 'warning';
        onConfirm?: () => void; confirmLabel?: string;
        theme?: 'neutral' | 'accent';
    }>({ isOpen: false, title: '', message: '', type: 'info' });

    // Totem State
    const [devices, setDevices] = useState<any[]>([]);
    const [editingTelegram, setEditingTelegram] = useState<string | null>(null);
    const [telegramData, setTelegramData] = useState({ chat_id: '' });
    const [generalTelegramId, setGeneralTelegramId] = useState('');
    const [isEditingGeneral, setIsEditingGeneral] = useState(false);

    useEffect(() => {
        fetchDevices();
        fetchGeneralSettings();
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

    return (
        <div className="space-y-6 animate-fade-in pb-12 w-full max-w-5xl mx-auto pt-6">
            {/* SESSSÃO: CONFIGURAÇÃO DE NOTIFICAÇÃO CENTRAL */}
            {tenantPlan === PlanType.PRO && (
                <div className="bg-blue-50/50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-900/30 p-6 rounded-[15px] space-y-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <h3 className="text-sm font-black text-blue-700 dark:text-blue-500 uppercase tracking-widest flex items-center gap-2">
                                <MessageCircle className="w-5 h-5" /> ID para Aprovação de Pontos (Telegram)
                            </h3>
                            <p className="text-[10px] text-blue-600/70 font-bold mt-1">
                                Este ID receberá os pedidos de aprovação dos Totens.
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
            )}

            {/* SESSÃO: GERENCIAR TOTENS */}
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
                                                    if (tenantSlug) copyToClipboard(`${window.location.origin}/p/${tenantSlug}`)
                                                }}
                                                className="text-xs text-blue-500 hover:underline flex items-center gap-1"
                                            >
                                                <Copy className="w-3.5 h-3.5" /> Copiar Link Público
                                            </button>
                                        </div>
                                    </div>

                                    {/* Telegram Notification Management */}
                                    {tenantPlan === PlanType.PRO && (
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
                                                device.telegram_chat_id ? (
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
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

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
