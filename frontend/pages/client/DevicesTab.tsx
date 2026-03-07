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
    const [telegramData, setTelegramData] = useState({ chat_id: '', responsible_name: '', sound_points: true });
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
                telegram_chat_id: telegramData.chat_id,
                responsible_name: telegramData.responsible_name,
                telegram_sound_points: telegramData.sound_points
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
                                        <div className="p-2 rounded-xl bg-blue-100 text-blue-600 relative">
                                            <Monitor className="w-5 h-5" />
                                            {!device.active && (
                                                <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full border-2 border-white" />
                                            )}
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <p className="font-bold text-gray-700 dark:text-gray-200">{device.name}</p>
                                                <Badge color={device.active ? 'green' : 'red'} className="text-[8px] px-1.5 py-0">
                                                    {device.active ? 'ATIVO' : 'PAUSADO'}
                                                </Badge>
                                            </div>
                                            <p className="text-[10px] text-gray-400 font-mono select-all uppercase">UID: {device.nfc_uid}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <Button
                                            size="sm"
                                            variant="secondary"
                                            className={`h-9 px-4 text-[10px] font-black uppercase tracking-widest ${device.active ? 'text-red-500 hover:bg-red-50' : 'text-green-600 hover:bg-green-50'}`}
                                            onClick={async () => {
                                                try {
                                                    setIsLoading(true);
                                                    await api.put(`/client/devices/${device.id}`, { active: !device.active });
                                                    fetchDevices();
                                                } catch (e) {
                                                    setModal({ isOpen: true, title: 'Erro', message: 'Falha ao alterar status do totem.', type: 'error' });
                                                } finally {
                                                    setIsLoading(false);
                                                }
                                            }}
                                            disabled={isLoading}
                                        >
                                            {device.active ? 'Pausar Link' : 'Reativar Link'}
                                        </Button>
                                    </div>

                                    {/* Telegram Notification Management - Integrated directly */}
                                    <div className="w-full mt-2 pt-4 border-t border-gray-100 dark:border-gray-800">
                                        <div className="flex items-center justify-between mb-2">
                                            <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest flex items-center gap-1.5">
                                                <MessageCircle className="w-3.5 h-3.5 text-blue-500" /> WhatsApp/Telegram do Responsável
                                            </p>
                                            {editingTelegram !== device.id && (
                                                <button
                                                    onClick={() => {
                                                        setEditingTelegram(device.id);
                                                        setTelegramData({
                                                            chat_id: device.telegram_chat_id || '',
                                                            responsible_name: device.responsible_name || '',
                                                            sound_points: device.telegram_sound_points ?? true
                                                        });
                                                    }}
                                                    className="text-[10px] text-blue-500 hover:underline font-bold uppercase tracking-widest"
                                                >
                                                    {device.telegram_chat_id ? 'Alterar Configuração' : 'Configurar Recebimento'}
                                                </button>
                                            )}
                                        </div>

                                        {editingTelegram === device.id ? (
                                            <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-blue-100 dark:border-blue-900/30 space-y-4 mt-2 animate-fade-in shadow-sm">
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                    <div className="space-y-1.5">
                                                        <div className="flex items-center justify-between">
                                                            <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">ID do Telegram</label>
                                                            <a
                                                                href="https://t.me/cpgestao_fidelidade_bot"
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="text-[9px] font-bold text-blue-500 hover:underline flex items-center gap-1 uppercase"
                                                            >
                                                                <HelpCircle className="w-3 h-3" /> Pegar ID
                                                            </a>
                                                        </div>
                                                        <Input
                                                            placeholder="Ex: 123456789"
                                                            value={telegramData.chat_id}
                                                            onChange={e => setTelegramData({ ...telegramData, chat_id: e.target.value })}
                                                        />
                                                    </div>

                                                    <div className="space-y-1.5">
                                                        <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Nome / Local (Ex: Balcão)</label>
                                                        <Input
                                                            placeholder="Ex: Loja 1"
                                                            value={telegramData.responsible_name}
                                                            onChange={e => setTelegramData({ ...telegramData, responsible_name: e.target.value })}
                                                        />
                                                    </div>
                                                </div>

                                                <div className="flex items-center justify-between p-3 bg-blue-50/50 dark:bg-blue-900/10 rounded-xl border border-blue-100 dark:border-blue-900/30">
                                                    <div>
                                                        <h5 className="text-[10px] font-black text-blue-700 dark:text-blue-400 uppercase tracking-widest">Aviso Sonoro</h5>
                                                        <p className="text-[9px] text-blue-600/70 font-bold">Tocar alerta neste totem</p>
                                                    </div>
                                                    <label className="relative inline-flex items-center cursor-pointer">
                                                        <input
                                                            type="checkbox"
                                                            className="sr-only peer"
                                                            checked={telegramData.sound_points}
                                                            onChange={(e) => setTelegramData({ ...telegramData, sound_points: e.target.checked })}
                                                        />
                                                        <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-slate-600 peer-checked:bg-blue-500"></div>
                                                    </label>
                                                </div>

                                                <div className="flex gap-2 justify-end">
                                                    <Button size="sm" variant="secondary" onClick={() => setEditingTelegram(null)}>Cancelar</Button>
                                                    <Button size="sm" onClick={() => handleUpdateTelegram(device.id)} disabled={isLoading}>Salvar Configuração</Button>
                                                </div>
                                            </div>
                                        ) : (
                                            device.telegram_chat_id ? (
                                                <div className="bg-blue-50/20 dark:bg-blue-900/5 p-3 rounded-xl border border-blue-50 dark:border-blue-900/20 flex items-center justify-between">
                                                    <div className="space-y-1">
                                                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">ID Ativo</p>
                                                        <p className="text-sm font-bold text-slate-700 dark:text-slate-200">{device.telegram_chat_id}</p>
                                                    </div>
                                                    <div className="text-right space-y-1">
                                                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Responsável</p>
                                                        <div className="flex items-center gap-2 justify-end">
                                                            <span className="text-sm font-bold text-blue-600">{device.responsible_name || 'Geral'}</span>
                                                            <Badge color={device.telegram_sound_points ? 'blue' : 'gray'} className="text-[7px] px-1.5 py-0 uppercase">
                                                                {device.telegram_sound_points ? 'Som Ativo' : 'Mudo'}
                                                            </Badge>
                                                        </div>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="p-4 bg-gray-50/50 dark:bg-gray-800/20 rounded-xl border border-dashed border-gray-200 dark:border-gray-800 text-center">
                                                    <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">
                                                        ⚠️ Nenhuma notificação configurada para este totem
                                                    </p>
                                                </div>
                                            )
                                        )}
                                    </div>
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
