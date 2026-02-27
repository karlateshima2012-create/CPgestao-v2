import React, { useEffect, useState } from 'react';
import { Smartphone, CheckCircle, XCircle } from 'lucide-react';
import { Button } from '../components/ui';
import api from '../services/api';

export const VipPointHandler: React.FC = () => {
    // Extract uid from path: /vip/xxx
    const uid = window.location.pathname.split('/').filter(p => p).pop() || '';

    // modes: loading, owner_prompt, success, error, public_view, pending, guest_unlinked
    const [mode, setMode] = useState<'loading' | 'owner_prompt' | 'success' | 'error' | 'public_view' | 'pending' | 'guest_unlinked'>('loading');
    const [data, setData] = useState<any>(null);
    const [errorMsg, setErrorMsg] = useState('');
    const [loadingPoint, setLoadingPoint] = useState(false);

    useEffect(() => {
        if (!uid) {
            setErrorMsg('Código VIP inválido');
            setMode('error');
            return;
        }

        api.get(`/vip/resolve/${uid}`)
            .then(res => {
                const info = res.data;
                setData(info);
                if (info.is_unlinked) {
                    if (info.is_owner) {
                        setMode('owner_prompt');
                    } else {
                        setMode('guest_unlinked');
                    }
                } else if (info.is_owner) {
                    setMode('owner_prompt');
                } else {
                    // Redirect to the public terminal to view balance
                    window.location.href = `/p/${info.tenant.slug}`;
                }
            })
            .catch(err => {
                setErrorMsg(err.response?.data?.message || 'Erro ao ler o cartão VIP.');
                setMode('error');
            });
    }, [uid]);

    const handleAddPoint = async () => {
        setLoadingPoint(true);
        try {
            const res = await api.post(`/vip/point/${uid}`);
            setData({
                ...data,
                points_earned: res.data.points_earned,
                new_balance: res.data.new_balance,
                success_message: res.data.message
            });

            if (res.data.auto_approved === false) {
                setMode('pending');
            } else {
                setMode('success');
            }
        } catch (err: any) {
            setErrorMsg(err.response?.data?.message || 'Erro ao adicionar ponto.');
            setMode('error');
        } finally {
            setLoadingPoint(false);
        }
    };

    if (mode === 'loading') {
        return (
            <div className="min-h-screen bg-gray-50 dark:bg-slate-950 flex flex-col items-center justify-center p-4">
                <div className="relative">
                    <div className="w-16 h-16 rounded-full border-4 border-blue-100 dark:border-blue-900/30 border-t-blue-600 animate-spin"></div>
                </div>
                <p className="mt-4 text-xs font-black text-gray-400 uppercase tracking-widest animate-pulse">Lendo Cartão VIP...</p>
            </div>
        );
    }

    if (mode === 'owner_prompt' && data) {
        if (data.is_unlinked) {
            return (
                <div className="min-h-screen bg-gray-50 dark:bg-slate-950 flex flex-col items-center justify-center p-4 font-sans">
                    <div className="bg-white dark:bg-slate-900 rounded-[30px] p-8 max-w-sm w-full shadow-2xl space-y-6 animate-fade-in text-center border border-gray-100 dark:border-slate-800">
                        <div className="w-20 h-20 bg-blue-50 dark:bg-blue-900/20 rounded-2xl flex items-center justify-center mx-auto shadow-sm">
                            <Smartphone className="w-10 h-10 text-blue-600" />
                        </div>
                        <div className="space-y-2">
                            <h2 className="text-2xl font-black text-gray-900 dark:text-white uppercase tracking-tighter italic">Cartão Novo Lido!</h2>
                            <p className="text-gray-500 dark:text-slate-400 text-sm font-medium">Este Cartão VIP ainda não foi entregue a nenhum cliente.</p>
                            <div className="bg-gray-50 dark:bg-slate-800/50 py-2 rounded-xl border border-gray-100 dark:border-slate-800 inline-block px-4">
                                <p className="text-blue-600 dark:text-blue-400 font-mono text-sm font-bold uppercase select-all tracking-wider">{data.card_uid}</p>
                            </div>
                        </div>
                        <Button
                            onClick={() => window.location.href = `/client?tab=devices&link_uid=${data.card_uid}`}
                            className="w-full h-14 bg-blue-600 hover:bg-blue-700 text-white font-black uppercase tracking-widest rounded-2xl shadow-xl shadow-blue-600/20 text-sm"
                        >
                            Vincular Cartão Agora
                        </Button>
                        <button
                            onClick={() => window.location.href = '/client'}
                            className="w-full mt-2 h-12 text-gray-400 hover:text-gray-600 dark:hover:text-white text-xs font-black uppercase tracking-widest transition-colors"
                        >
                            Voltar ao Painel
                        </button>
                    </div>
                </div>
            );
        }

        return (
            <div className="min-h-screen bg-gray-50 dark:bg-slate-950 flex flex-col items-center justify-center p-4 font-sans">
                <div className="bg-white dark:bg-slate-900 rounded-[30px] p-8 max-w-sm w-full shadow-2xl space-y-8 animate-fade-in text-center relative overflow-hidden border border-gray-100 dark:border-slate-800">
                    <div className="absolute top-0 left-0 w-full h-1.5 bg-blue-600"></div>

                    <div className="w-20 h-20 bg-blue-50 dark:bg-blue-900/20 rounded-2xl flex items-center justify-center mx-auto shadow-sm">
                        <Smartphone className="w-10 h-10 text-blue-600" />
                    </div>

                    <div className="space-y-1">
                        <h2 className="text-2xl font-black text-gray-900 dark:text-white uppercase tracking-tighter italic">Cartão VIP Aberto!</h2>
                        <div className="mt-4 p-4 bg-gray-50 dark:bg-slate-800/50 rounded-2xl border border-gray-100 dark:border-slate-800">
                            <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest mb-1">Cliente Associado</p>
                            <span className="font-black text-gray-900 dark:text-white text-xl block leading-tight">{data.customer.name}</span>
                        </div>
                    </div>

                    <div className="bg-blue-600 py-6 px-4 rounded-[25px] shadow-xl shadow-blue-600/20">
                        <p className="text-[10px] text-blue-100 font-black uppercase tracking-[0.2em]">Saldo de Pontos</p>
                        <p className="text-4xl font-black text-white mt-2 flex items-center justify-center gap-2">
                            {data.customer.points_balance}
                            <span className="text-lg text-blue-200/60 font-medium">/ {data.goal}</span>
                        </p>
                    </div>

                    <div className="pt-2">
                        <Button
                            onClick={handleAddPoint}
                            isLoading={loadingPoint}
                            className="w-full h-16 bg-blue-600 hover:bg-blue-700 text-white font-black uppercase tracking-widest rounded-2xl text-base shadow-xl shadow-blue-600/20"
                        >
                            Confirmar +{data.points_to_add || 1} Ponto{data.points_to_add > 1 ? 's' : ''}
                        </Button>
                        <button
                            onClick={() => window.location.href = '/client'}
                            className="w-full mt-4 h-12 text-gray-400 hover:text-red-500 text-xs font-black uppercase tracking-widest transition-colors"
                        >
                            Cancelar Operação
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    if (mode === 'guest_unlinked' && data) {
        return (
            <div className="min-h-screen bg-gray-50 dark:bg-slate-950 flex flex-col items-center justify-center p-4 font-sans">
                <div className="bg-white dark:bg-slate-900 rounded-[30px] p-8 max-w-sm w-full shadow-2xl space-y-6 animate-fade-in text-center border border-gray-100 dark:border-slate-800">
                    <div className="w-20 h-20 bg-blue-50 dark:bg-blue-900/20 rounded-2xl flex items-center justify-center mx-auto shadow-sm">
                        <Smartphone className="w-10 h-10 text-blue-600" />
                    </div>
                    <div className="space-y-2">
                        <h2 className="text-2xl font-black text-gray-900 dark:text-white uppercase tracking-tighter italic">Cartão Novo!</h2>
                        <p className="text-gray-500 dark:text-slate-400 text-sm font-medium">Este Cartão VIP ainda não foi vinculado a um cliente.</p>
                        <div className="bg-gray-50 dark:bg-slate-800/50 py-2 rounded-xl border border-gray-100 dark:border-slate-800 inline-block px-4 mt-2">
                            <p className="text-blue-600 dark:text-blue-400 font-mono text-xs font-bold uppercase select-all tracking-wider">ID: {data.card_uid}</p>
                        </div>
                    </div>

                    <div className="bg-blue-600/10 p-4 rounded-2xl border border-blue-600/20">
                        <p className="text-[10px] text-blue-600 dark:text-blue-400 font-black leading-tight uppercase tracking-widest">
                            Lojista: Entre na sua conta para vincular este cartão ao CRM.
                        </p>
                    </div>

                    <Button
                        onClick={() => window.location.href = `/client?tab=devices&link_uid=${data.card_uid}`}
                        className="w-full h-14 bg-blue-600 hover:bg-blue-700 text-white font-black uppercase tracking-widest rounded-2xl shadow-xl shadow-blue-600/20 text-sm"
                    >
                        Entrar e Vincular
                    </Button>
                </div>
            </div>
        );
    }

    if (mode === 'pending') {
        return (
            <div className="min-h-screen bg-gray-50 dark:bg-slate-950 flex flex-col items-center justify-center p-4 font-sans">
                <div className="bg-white dark:bg-slate-900 rounded-[30px] p-8 max-w-sm w-full shadow-2xl space-y-6 animate-fade-in text-center border border-gray-100 dark:border-slate-800 relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-1.5 bg-blue-600"></div>
                    <div className="w-24 h-24 bg-blue-50 dark:bg-blue-900/20 rounded-full flex items-center justify-center mx-auto">
                        <Smartphone className="w-14 h-14 text-blue-600 animate-pulse" />
                    </div>
                    <div className="space-y-2">
                        <h2 className="text-2xl font-black text-gray-900 dark:text-white uppercase tracking-tighter italic">Aguardando...</h2>
                        <p className="text-gray-500 dark:text-slate-400 font-medium">Enviamos um pedido de confirmação para o Telegram do lojista.</p>
                    </div>
                    <div className="pt-2 w-full">
                        <Button
                            onClick={() => window.location.href = '/client'}
                            className="w-full h-14 bg-gray-100 hover:bg-gray-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-gray-900 dark:text-white font-black uppercase tracking-widest rounded-2xl text-xs"
                        >
                            Voltar ao Painel
                        </Button>
                    </div>
                </div>
            </div>
        );
    }

    if (mode === 'success') {
        return (
            <div className="min-h-screen bg-gray-50 dark:bg-slate-950 flex flex-col items-center justify-center p-4 font-sans">
                <div className="bg-white dark:bg-slate-900 rounded-[30px] p-8 max-w-sm w-full shadow-2xl space-y-6 animate-fade-in text-center border border-gray-100 dark:border-slate-800 relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-1.5 bg-blue-600"></div>
                    <div className="w-24 h-24 bg-blue-50 dark:bg-blue-900/20 rounded-full flex items-center justify-center mx-auto">
                        <CheckCircle className="w-14 h-14 text-blue-600" />
                    </div>
                    <div className="space-y-2">
                        <h2 className="text-3xl font-black text-gray-900 dark:text-white uppercase tracking-tighter italic">Sucesso!</h2>
                        <p className="text-blue-600 dark:text-blue-400 font-black text-lg leading-tight italic">{data.success_message}</p>
                    </div>
                    <div className="bg-blue-600 py-6 px-4 rounded-[25px] shadow-xl shadow-blue-600/20 w-full">
                        <p className="text-[10px] text-blue-100 font-black uppercase tracking-[0.2em]">Novo Saldo</p>
                        <p className="text-3xl font-black text-white mt-1 flex items-center justify-center gap-2">
                            {data.new_balance}
                            <span className="text-lg text-blue-200/60 font-medium">/ {data.goal}</span>
                        </p>
                    </div>
                    <div className="pt-2 w-full">
                        <Button
                            onClick={() => window.location.href = '/client'}
                            className="w-full h-14 bg-gray-100 hover:bg-gray-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-gray-900 dark:text-white font-black uppercase tracking-widest rounded-2xl text-xs"
                        >
                            Voltar ao Painel
                        </Button>
                    </div>
                </div>
            </div>
        );
    }

    if (mode === 'error') {
        return (
            <div className="min-h-screen bg-gray-50 dark:bg-slate-950 flex flex-col items-center justify-center p-4 font-sans">
                <div className="bg-white dark:bg-slate-900 rounded-[30px] p-8 max-w-sm w-full shadow-2xl space-y-6 animate-fade-in text-center border border-gray-100 dark:border-slate-800">
                    <div className="w-24 h-24 bg-red-50 dark:bg-red-900/20 rounded-full flex items-center justify-center mx-auto">
                        <XCircle className="w-14 h-14 text-red-600" />
                    </div>
                    <div className="space-y-2">
                        <h2 className="text-2xl font-black text-gray-900 dark:text-white uppercase tracking-tighter italic">Ops, problema.</h2>
                        <p className="text-gray-500 dark:text-slate-400 font-medium">{errorMsg}</p>
                    </div>
                    <Button
                        onClick={() => window.location.href = '/client'}
                        className="w-full h-14 bg-gray-100 hover:bg-gray-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-gray-900 dark:text-white font-black uppercase tracking-widest rounded-2xl text-xs mt-4"
                    >
                        Voltar
                    </Button>
                </div>
            </div>
        );
    }

    return null;
};
