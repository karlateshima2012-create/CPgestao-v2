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
            <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center p-4">
                <div className="relative">
                    <div className="w-16 h-16 rounded-full border-4 border-blue-100 dark:border-blue-900/10 border-t-blue-600 animate-spin"></div>
                </div>
                <p className="mt-6 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.3em] animate-pulse">Lendo Cartão VIP...</p>
            </div>
        );
    }

    if (mode === 'owner_prompt' && data) {
        if (data.is_unlinked) {
            return (
                <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center p-4 font-sans">
                    <div className="bg-white dark:bg-slate-900 rounded-[30px] p-8 max-w-sm w-full shadow-2xl space-y-8 animate-fade-in text-center border border-slate-100 dark:border-slate-800 overflow-hidden relative">

                        <div className="text-center space-y-3 pt-4">
                            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Configuração</h3>
                            <p className="text-3xl font-black text-slate-900 dark:text-white tracking-tighter">Cartão Novo!</p>
                            <div className="inline-flex items-center gap-2 px-5 py-2 rounded-xl border-2 bg-blue-50 border-blue-100 text-blue-700">
                                <span className="text-[13px] font-black uppercase tracking-widest">✨ Vincular a um cliente</span>
                            </div>
                        </div>

                        <div className="bg-white dark:bg-slate-800 rounded-[30px] p-8 text-slate-900 dark:text-white border border-slate-100 dark:border-slate-800 shadow-xl space-y-6">
                            <div className="w-20 h-20 bg-blue-50 dark:bg-blue-900/20 rounded-2xl flex items-center justify-center mx-auto shadow-sm">
                                <Smartphone className="w-10 h-10 text-blue-600" />
                            </div>
                            <div className="space-y-2">
                                <p className="text-slate-500 dark:text-slate-400 text-sm font-medium leading-relaxed">Este Cartão VIP ainda não foi entregue a nenhum cliente.</p>
                                <div className="bg-slate-50 dark:bg-slate-900/50 py-2 rounded-xl border border-slate-100 dark:border-slate-800 inline-block px-4">
                                    <p className="text-blue-600 dark:text-blue-400 font-mono text-xs font-bold uppercase select-all tracking-widest">ID: {data.card_uid}</p>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-3">
                            <Button
                                onClick={() => window.location.href = `/client?tab=devices&link_uid=${data.card_uid}`}
                                className="w-full h-16 bg-blue-600 hover:bg-blue-700 text-white font-black uppercase tracking-widest rounded-2xl shadow-xl shadow-blue-600/20 text-sm transition-all active:scale-95"
                            >
                                Vincular Agora
                            </Button>
                            <button
                                onClick={() => window.location.href = '/client'}
                                className="w-full h-12 text-slate-400 hover:text-slate-600 dark:hover:text-white text-xs font-black uppercase tracking-widest transition-colors"
                            >
                                Voltar ao Painel
                            </button>
                        </div>
                    </div>
                </div>
            );
        }

        return (
            <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center p-4 font-sans">
                <div className="bg-white dark:bg-slate-900 rounded-[30px] p-8 max-w-sm w-full shadow-2xl space-y-8 animate-fade-in text-center relative overflow-hidden border border-slate-100 dark:border-slate-800">


                    <div className="text-center space-y-3 pt-4">
                        <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Conselho do Dia</h3>
                        <p className="text-3xl font-black text-slate-900 dark:text-white tracking-tighter">Cartão VIP Lido!</p>
                        <div className="inline-flex items-center gap-2 px-5 py-2 rounded-xl border-2 bg-blue-50 border-blue-100 text-blue-700">
                            <span className="text-[13px] font-black uppercase tracking-widest text-center flex items-center gap-2">
                                📱 Atendimento VIP
                            </span>
                        </div>
                    </div>

                    <div className="bg-white dark:bg-slate-800 rounded-[30px] p-8 text-slate-900 dark:text-white border border-slate-100 dark:border-slate-800 shadow-xl relative overflow-hidden group">
                        <div className="relative z-10 text-center space-y-2">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">Cliente Associado</p>
                            <span className="text-2xl font-black text-slate-900 dark:text-white tracking-tighter block">{data.customer.name}</span>
                        </div>

                        <div className="mt-8 pt-6 border-t border-slate-100 dark:border-slate-700 text-center space-y-2">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Saldo Atual</p>
                            <p className="text-5xl font-black tracking-tighter tabular-nums text-slate-900 dark:text-white">
                                {data.customer.points_balance}
                                <span className="text-xl text-slate-300 dark:text-slate-600 ml-2">/ {data.goal}</span>
                            </p>
                        </div>
                    </div>

                    <div className="pt-2">
                        <Button
                            onClick={handleAddPoint}
                            isLoading={loadingPoint}
                            className="w-full h-16 bg-blue-600 hover:bg-blue-700 text-white font-black uppercase tracking-widest rounded-2xl text-base shadow-xl shadow-blue-600/20 transition-all active:scale-95"
                        >
                            Confirmar +{data.points_to_add || 1} Ponto{data.points_to_add > 1 ? 's' : ''}
                        </Button>
                        <button
                            onClick={() => window.location.href = '/client'}
                            className="w-full mt-4 h-12 text-slate-400 hover:text-red-500 text-xs font-black uppercase tracking-widest transition-colors"
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
            <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center p-4 font-sans">
                <div className="bg-white dark:bg-slate-900 rounded-[30px] p-8 max-w-sm w-full shadow-2xl space-y-8 animate-fade-in text-center border border-slate-100 dark:border-slate-800 overflow-hidden relative">


                    <div className="text-center space-y-3 pt-4">
                        <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Configuração</h3>
                        <p className="text-3xl font-black text-slate-900 dark:text-white tracking-tighter">Cartão Novo!</p>
                        <div className="inline-flex items-center gap-2 px-5 py-2 rounded-xl border-2 bg-blue-50 border-blue-100 text-blue-700">
                            <span className="text-[13px] font-black uppercase tracking-widest">✨ Vinculação Pendente</span>
                        </div>
                    </div>

                    <div className="bg-white dark:bg-slate-800 rounded-[30px] p-8 text-slate-900 dark:text-white border border-slate-100 dark:border-slate-800 shadow-xl space-y-6">
                        <div className="w-20 h-20 bg-blue-50 dark:bg-blue-900/20 rounded-2xl flex items-center justify-center mx-auto shadow-sm">
                            <Smartphone className="w-10 h-10 text-blue-600" />
                        </div>
                        <div className="space-y-2">
                            <p className="text-slate-500 dark:text-slate-400 text-sm font-medium leading-relaxed">Este Cartão VIP ainda não foi vinculado a um cliente.</p>
                            <div className="bg-slate-50 dark:bg-slate-900/50 py-2 rounded-xl border border-slate-100 dark:border-slate-800 inline-block px-4">
                                <p className="text-blue-600 dark:text-blue-400 font-mono text-xs font-bold uppercase select-all tracking-widest">ID: {data.card_uid}</p>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-6">
                        <div className="bg-blue-600/5 p-4 rounded-2xl border border-blue-600/10">
                            <p className="text-[10px] text-blue-600 dark:text-blue-400 font-black leading-tight uppercase tracking-[0.2em]">
                                Lojista: Entre na sua conta para vincular este cartão ao CRM.
                            </p>
                        </div>

                        <Button
                            onClick={() => window.location.href = `/client?tab=devices&link_uid=${data.card_uid}`}
                            className="w-full h-16 bg-blue-600 hover:bg-blue-700 text-white font-black uppercase tracking-widest rounded-2xl shadow-xl shadow-blue-600/20 text-sm transition-all active:scale-95"
                        >
                            Entrar e Vincular
                        </Button>
                    </div>
                </div>
            </div>
        );
    }

    if (mode === 'pending') {
        return (
            <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center p-4 font-sans">
                <div className="bg-white dark:bg-slate-900 rounded-[30px] p-8 max-w-sm w-full shadow-2xl space-y-8 animate-fade-in text-center border border-slate-100 dark:border-slate-800 relative overflow-hidden">


                    <div className="text-center space-y-3 pt-4">
                        <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Fluxo de Aprovação</h3>
                        <p className="text-3xl font-black text-slate-900 dark:text-white tracking-tighter">Aguardando...</p>
                        <div className="inline-flex items-center gap-2 px-5 py-2 rounded-xl border-2 bg-amber-50 border-amber-100 text-amber-700">
                            <span className="text-[13px] font-black uppercase tracking-widest">⏳ Confirmação Pendente</span>
                        </div>
                    </div>

                    <div className="bg-white dark:bg-slate-800 rounded-[30px] p-8 text-slate-900 dark:text-white border border-slate-100 dark:border-slate-800 shadow-xl space-y-6">
                        <div className="w-24 h-24 bg-amber-50 dark:bg-amber-900/20 rounded-full flex items-center justify-center mx-auto">
                            <Smartphone className="w-12 h-12 text-amber-600 animate-pulse" />
                        </div>
                        <p className="text-slate-500 dark:text-slate-400 font-medium leading-relaxed">Enviamos um pedido de confirmação para o Telegram do lojista.</p>
                    </div>

                    <div className="pt-2 w-full">
                        <Button
                            onClick={() => window.location.href = '/client'}
                            className="w-full h-14 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-900 dark:text-white font-black uppercase tracking-widest rounded-2xl text-xs"
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
            <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center p-4 font-sans">
                <div className="bg-white dark:bg-slate-900 rounded-[30px] p-8 max-w-sm w-full shadow-2xl space-y-8 animate-fade-in text-center border border-slate-100 dark:border-slate-800 relative overflow-hidden">


                    <div className="text-center space-y-3 pt-4">
                        <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Operação Finalizada</h3>
                        <p className="text-3xl font-black text-slate-900 dark:text-white tracking-tighter">Tudo Certo!</p>
                        <div className="inline-flex items-center gap-2 px-5 py-2 rounded-xl border-2 bg-green-50 border-green-100 text-green-700">
                            <span className="text-[13px] font-black uppercase tracking-widest">✅ Ponto Adicionado</span>
                        </div>
                    </div>

                    <div className="bg-white dark:bg-slate-800 rounded-[30px] p-8 text-slate-900 dark:text-white border border-slate-100 dark:border-slate-800 shadow-xl relative overflow-hidden group">
                        <div className="relative z-10 text-center space-y-2">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">Confirmação</p>
                            <p className="font-black text-green-600 dark:text-green-400 text-lg leading-tight tracking-tight">{data.success_message}</p>
                        </div>

                        <div className="mt-8 pt-6 border-t border-slate-100 dark:border-slate-700 text-center space-y-2">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Novo Saldo</p>
                            <p className="text-5xl font-black tracking-tighter tabular-nums text-slate-900 dark:text-white">
                                {data.new_balance}
                                <span className="text-xl text-slate-300 dark:text-slate-600 ml-2">/ {data.goal}</span>
                            </p>
                        </div>
                    </div>

                    <div className="pt-2 w-full">
                        <Button
                            onClick={() => window.location.href = '/client'}
                            className="w-full h-14 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-900 dark:text-white font-black uppercase tracking-widest rounded-2xl text-xs shadow-sm"
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
            <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center p-4 font-sans">
                <div className="bg-white dark:bg-slate-900 rounded-[30px] p-8 max-w-sm w-full shadow-2xl space-y-8 animate-fade-in text-center border border-slate-100 dark:border-slate-800 relative overflow-hidden">


                    <div className="text-center space-y-3 pt-4">
                        <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Ops!</h3>
                        <p className="text-3xl font-black text-slate-900 dark:text-white tracking-tighter">Problema Lido.</p>
                        <div className="inline-flex items-center gap-2 px-5 py-2 rounded-xl border-2 bg-red-50 border-red-100 text-red-700">
                            <span className="text-[13px] font-black uppercase tracking-widest">❌ Erro Identificado</span>
                        </div>
                    </div>

                    <div className="bg-white dark:bg-slate-800 rounded-[30px] p-8 text-slate-900 dark:text-white border border-slate-100 dark:border-slate-800 shadow-xl space-y-6">
                        <div className="w-24 h-24 bg-red-50 dark:bg-red-900/20 rounded-full flex items-center justify-center mx-auto">
                            <XCircle className="w-12 h-12 text-red-600" />
                        </div>
                        <p className="text-slate-500 dark:text-slate-400 font-medium leading-relaxed">{errorMsg}</p>
                    </div>

                    <Button
                        onClick={() => window.location.href = '/client'}
                        className="w-full h-14 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-900 dark:text-white font-black uppercase tracking-widest rounded-2xl text-xs mt-4"
                    >
                        Voltar
                    </Button>
                </div>
            </div>
        );
    }

    return null;
};
