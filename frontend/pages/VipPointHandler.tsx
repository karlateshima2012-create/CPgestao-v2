import React, { useEffect, useState } from 'react';
import { Smartphone, CheckCircle, XCircle } from 'lucide-react';
import { Button } from '../components/ui';
import api from '../services/api';

export const VipPointHandler: React.FC = () => {
    // Extract uid from path: /vip/xxx
    const uid = window.location.pathname.split('/').pop() || '';

    // modes: loading, owner_prompt, success, error, public_view, pending
    const [mode, setMode] = useState<'loading' | 'owner_prompt' | 'success' | 'error' | 'public_view' | 'pending'>('loading');
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
                if (info.is_owner) {
                    setMode('owner_prompt');
                } else {
                    // Redirect to the public terminal to view balance
                    window.location.href = `/p/${info.tenant.slug}`;
                }
            })
            .catch(err => {
                setErrorMsg(err.response?.data?.error || 'Erro ao ler o cartão VIP.');
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
            setErrorMsg(err.response?.data?.error || 'Erro ao adicionar ponto.');
            setMode('error');
        } finally {
            setLoadingPoint(false);
        }
    };

    if (mode === 'loading') {
        return (
            <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-emerald-500"></div>
            </div>
        );
    }

    if (mode === 'owner_prompt' && data) {
        if (data.is_unlinked) {
            return (
                <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-4 font-sans text-white">
                    <div className="bg-slate-800 rounded-3xl p-8 max-w-sm w-full shadow-2xl space-y-6 animate-fade-in text-center border border-slate-700">
                        <div className="w-20 h-20 bg-slate-700/50 rounded-full flex items-center justify-center mx-auto shadow-inner">
                            <Smartphone className="w-10 h-10 text-emerald-400" />
                        </div>
                        <div className="space-y-2">
                            <h2 className="text-2xl font-bold tracking-tight">Cartão Novo Lido!</h2>
                            <p className="text-slate-400 text-sm">Este Cartão VIP ainda não foi entregue a nenhum cliente.</p>
                            <p className="text-emerald-400 font-mono text-sm mt-2">{data.card_uid}</p>
                        </div>
                        <Button
                            onClick={() => window.location.href = `/client?tab=devices&link_uid=${data.card_uid}`}
                            className="w-full h-14 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-2xl shadow-lg shadow-emerald-500/20"
                        >
                            Vincular a um Cliente Agora
                        </Button>
                        <button
                            onClick={() => window.location.href = '/client'}
                            className="w-full mt-2 h-12 text-slate-400 hover:text-white text-sm font-medium transition-colors"
                        >
                            Voltar ao Painel
                        </button>
                    </div>
                </div>
            );
        }

        return (
            <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-4 font-sans text-white">
                <div className="bg-slate-800 rounded-3xl p-8 max-w-sm w-full shadow-2xl space-y-8 animate-fade-in text-center relative overflow-hidden border border-slate-700">
                    <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-emerald-400 to-teal-500"></div>

                    <div className="w-20 h-20 bg-slate-700/50 rounded-full flex items-center justify-center mx-auto shadow-inner">
                        <Smartphone className="w-10 h-10 text-emerald-400" />
                    </div>

                    <div className="space-y-1">
                        <h2 className="text-2xl font-bold tracking-tight">Cartão VIP Aberto!</h2>
                        <p className="text-slate-400">Cliente: <span className="font-bold text-white text-lg block mt-1">{data.customer.name}</span></p>
                    </div>

                    <div className="bg-slate-900/50 rounded-2xl p-4 border border-slate-700/50">
                        <p className="text-sm text-slate-400 font-medium uppercase tracking-widest">Saldo Atual</p>
                        <p className="text-3xl font-black text-white mt-1">{data.customer.points_balance} <span className="text-lg text-slate-500 font-medium">/ {data.goal}</span></p>
                    </div>

                    <div className="pt-2">
                        <Button
                            onClick={handleAddPoint}
                            isLoading={loadingPoint}
                            className="w-full h-14 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-2xl text-lg shadow-lg shadow-emerald-500/20"
                        >
                            Confirmar +{data.points_to_add || 1} Ponto{data.points_to_add > 1 ? 's' : ''}
                        </Button>
                        <button
                            onClick={() => window.location.href = '/client'}
                            className="w-full mt-4 h-12 text-slate-400 hover:text-white text-sm font-medium transition-colors"
                        >
                            Cancelar
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    if (mode === 'pending') {
        return (
            <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-4 font-sans text-white">
                <div className="bg-slate-800 rounded-3xl p-8 max-w-sm w-full shadow-2xl space-y-6 animate-fade-in text-center border border-slate-700 relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-2 bg-blue-500"></div>
                    <div className="w-24 h-24 bg-blue-500/10 rounded-full flex items-center justify-center mx-auto">
                        <Smartphone className="w-14 h-14 text-blue-500 animate-pulse" />
                    </div>
                    <div className="space-y-2">
                        <h2 className="text-2xl font-bold tracking-tight">Aguardando Aprovação</h2>
                        <p className="text-slate-400 font-medium">Enviamos um pedido de confirmação para o Telegram do lojista.</p>
                    </div>
                    <div className="pt-2 w-full">
                        <Button
                            onClick={() => window.location.href = '/client'}
                            className="w-full h-14 bg-slate-700 hover:bg-slate-600 text-white font-bold rounded-2xl"
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
            <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-4 font-sans text-white">
                <div className="bg-slate-800 rounded-3xl p-8 max-w-sm w-full shadow-2xl space-y-6 animate-fade-in text-center border border-slate-700 relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-emerald-400 to-teal-500"></div>
                    <div className="w-24 h-24 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto">
                        <CheckCircle className="w-14 h-14 text-emerald-500" />
                    </div>
                    <div className="space-y-2">
                        <h2 className="text-3xl font-bold tracking-tight">Sucesso!</h2>
                        <p className="text-emerald-400 font-medium text-lg leading-tight">{data.success_message}</p>
                    </div>
                    <div className="bg-slate-900/50 rounded-2xl p-4 border border-slate-700/50 w-full">
                        <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">Novo Saldo</p>
                        <p className="text-2xl font-black text-white mt-1">{data.new_balance} / {data.goal}</p>
                    </div>
                    <div className="pt-2 w-full">
                        <Button
                            onClick={() => window.location.href = '/client'}
                            className="w-full h-14 bg-slate-700 hover:bg-slate-600 text-white font-bold rounded-2xl"
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
            <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-4 font-sans text-white">
                <div className="bg-slate-800 rounded-3xl p-8 max-w-sm w-full shadow-2xl space-y-6 animate-fade-in text-center border border-slate-700">
                    <div className="w-24 h-24 bg-red-500/10 rounded-full flex items-center justify-center mx-auto">
                        <XCircle className="w-14 h-14 text-red-500" />
                    </div>
                    <div className="space-y-2">
                        <h2 className="text-2xl font-bold tracking-tight">Ops, problema.</h2>
                        <p className="text-slate-400 font-medium">{errorMsg}</p>
                    </div>
                    <Button
                        onClick={() => window.location.href = '/client'}
                        className="w-full h-14 bg-slate-700 hover:bg-slate-600 text-white font-bold rounded-2xl mt-4"
                    >
                        Voltar
                    </Button>
                </div>
            </div>
        );
    }

    return null;
};
