import React, { useState, useEffect } from 'react';
import { Card, Button, Input, Badge, StatusModal } from '../../components/ui';
import {
    Smartphone, Monitor, Copy,
    MessageCircle, HelpCircle, Volume2
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

    useEffect(() => {
        fetchDevices();
    }, []);

    const fetchDevices = async () => {
        try {
            const res = await api.get('/client/devices?type=default');
            setDevices(Array.isArray(res.data) ? res.data : []);
        } catch (error) {
            console.error('Error fetching devices', error);
        }
    };

    const handleUpdateLocal = (id: string, field: string, value: any) => {
        setDevices(prev => prev.map(d => d.id === id ? { ...d, [field]: value } : d));
    };

    const handleSaveDevice = async (id: string, overrides: any = {}) => {
        const d = devices.find(x => x.id === id);
        if (!d) return;

        const payload = {
            telegram_chat_id: overrides.telegram_chat_id !== undefined ? overrides.telegram_chat_id : (d.telegram_chat_id || ''),
            responsible_name: overrides.responsible_name !== undefined ? overrides.responsible_name : (d.responsible_name || ''),
            nfc_uid: overrides.nfc_uid !== undefined ? overrides.nfc_uid : (d.nfc_uid || ''),
            telegram_sound_points: overrides.telegram_sound_points !== undefined ? overrides.telegram_sound_points : (d.telegram_sound_points ?? true),
        };

        try {
            await api.put(`/client/devices/${id}`, payload);
        } catch (error) {
            console.error('Error auto-saving device', error);
        }
    };

    return (
        <div className="animate-fade-in pb-12 w-full max-w-5xl mx-auto">
            <div className="space-y-4">
                {devices.length === 0 ? (
                    <div className="text-center py-12 text-gray-400 italic bg-gray-50/50 dark:bg-gray-800/20 rounded-[30px] border border-dashed border-gray-200 dark:border-gray-800">
                        Nenhum totem registrado para esta loja.
                    </div>
                ) : (
                    <div className="grid grid-cols-1 gap-6">
                        {devices.map((device) => (
                            <div key={device.id} className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 p-6 rounded-[22px] shadow-sm space-y-6 hover:shadow-md transition-all">
                                {/* Top Section: Identity and Action */}
                                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                    <div className="flex items-center gap-4">
                                        <div className="p-3 bg-blue-50 dark:bg-blue-900/20 text-blue-500 rounded-2xl">
                                            <Monitor className="w-6 h-6" />
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2 mb-0.5">
                                                <h4 className="text-base font-black text-gray-900 dark:text-white uppercase tracking-tight">{device.name}</h4>
                                                <Badge color={device.active ? 'green' : 'red'} className="text-[8px] px-1.5 py-0">
                                                    {device.active ? 'ATIVO' : 'PAUSADO'}
                                                </Badge>
                                                <a
                                                    href="https://t.me/cpgestao_fidelidade_bot"
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="flex items-center gap-1 px-2 py-0.5 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 text-[8px] font-black uppercase tracking-widest rounded-full hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-all border border-blue-100 dark:border-blue-800"
                                                    title="Clique para pegar seu Chat ID no Telegram"
                                                >
                                                    <MessageCircle className="w-2.5 h-2.5" /> Pegar ID
                                                </a>
                                            </div>
                                            <p className="text-[10px] text-gray-400 font-mono select-all bg-gray-50 dark:bg-gray-800/50 px-2 py-0.5 rounded border border-gray-100/50 dark:border-gray-800/50 inline-block uppercase italic">
                                                UID: {device.nfc_uid}
                                            </p>
                                        </div>
                                    </div>
                                    <Button
                                        size="sm"
                                        variant="secondary"
                                        className={`h-10 px-6 rounded-xl text-[10px] font-black uppercase tracking-widest ${device.active ? 'text-red-500 hover:bg-red-50' : 'text-green-600 hover:bg-green-50'}`}
                                        onClick={async () => {
                                            try {
                                                setIsLoading(true);
                                                await api.put(`/client/devices/${device.id}`, { active: !device.active });
                                                fetchDevices();
                                            } catch (e) {
                                                setModal({ isOpen: true, title: 'Erro', message: 'Falha ao alterar status.', type: 'error' });
                                            } finally {
                                                setIsLoading(false);
                                            }
                                        }}
                                        disabled={isLoading}
                                    >
                                        {device.active ? 'Pausar Link' : 'Reativar Link'}
                                    </Button>
                                </div>

                                {/* Configuration Section (Direct Edit) */}
                                <div className="grid grid-cols-1 md:grid-cols-12 gap-4 pt-5 border-t border-gray-50 dark:border-gray-800 items-end">
                                    <div className="md:col-span-3 space-y-1.5">
                                        <div className="flex items-center justify-between ml-1">
                                            <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-1.5">
                                                <MessageCircle className="w-3 h-3 text-blue-500" /> ID TELEGRAM
                                            </label>
                                        </div>
                                        <Input
                                            placeholder="Ex: 1234567"
                                            value={device.telegram_chat_id || ''}
                                            onChange={e => handleUpdateLocal(device.id, 'telegram_chat_id', e.target.value)}
                                            onBlur={() => handleSaveDevice(device.id)}
                                            className="h-10 text-xs bg-gray-50/50 dark:bg-gray-800/50 border-gray-100 dark:border-gray-800 rounded-xl"
                                        />
                                    </div>

                                    <div className="md:col-span-3 space-y-1.5">
                                        <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest ml-1">
                                            RESPONSÁVEL
                                        </label>
                                        <Input
                                            placeholder="Ex: João / Balcão"
                                            value={device.responsible_name || ''}
                                            onChange={e => handleUpdateLocal(device.id, 'responsible_name', e.target.value)}
                                            onBlur={() => handleSaveDevice(device.id)}
                                            className="h-10 text-xs bg-gray-50/50 dark:bg-gray-800/50 border-gray-100 dark:border-gray-800 rounded-xl"
                                        />
                                    </div>

                                    <div className="md:col-span-3 space-y-1.5">
                                        <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest ml-1">
                                            UID DO TOTEM (URL)
                                        </label>
                                        <Input
                                            placeholder="Ex: abc123def456"
                                            value={device.nfc_uid || ''}
                                            onChange={e => handleUpdateLocal(device.id, 'nfc_uid', e.target.value)}
                                            onBlur={() => handleSaveDevice(device.id)}
                                            className="h-10 text-xs bg-gray-50/50 dark:bg-gray-800/50 border-gray-100 dark:border-gray-800 rounded-xl font-mono"
                                        />
                                    </div>

                                    <div className="md:col-span-3 pb-0.5">
                                        <div className="flex items-center justify-between h-10 px-4 bg-blue-50/30 dark:bg-blue-900/10 rounded-xl border border-blue-100/50 dark:border-blue-900/30">
                                            <div className="flex items-center gap-2.5">
                                                <div className={`p-1.5 rounded-lg ${device.telegram_sound_points !== false ? 'bg-primary-500 text-white' : 'bg-gray-200 text-gray-400'} transition-all`}>
                                                    <Volume2 className="w-3 h-3" />
                                                </div>
                                                <div className="flex flex-col">
                                                    <span className="text-[9px] font-black text-primary-600 dark:text-primary-400 uppercase tracking-widest">Aviso</span>
                                                </div>
                                            </div>
                                            <label className="relative inline-flex items-center cursor-pointer">
                                                <input
                                                    type="checkbox"
                                                    className="sr-only peer"
                                                    checked={device.telegram_sound_points !== false}
                                                    onChange={e => {
                                                        const val = e.target.checked;
                                                        handleUpdateLocal(device.id, 'telegram_sound_points', val);
                                                        handleSaveDevice(device.id, { telegram_sound_points: val });
                                                    }}
                                                />
                                                <div className="w-10 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-slate-600 peer-checked:bg-primary-500"></div>
                                            </label>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {
                modal.isOpen && (
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
                )
            }
        </div >
    );
};
