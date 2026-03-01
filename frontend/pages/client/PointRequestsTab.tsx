import React, { useState, useEffect } from 'react';
import { Check, X, Clock, Smartphone, Globe, UserCheck } from 'lucide-react';
import { Button } from '../../components/ui';
import { PointRequest } from '../../types';
import api from '../../services/api';

export const PointRequestsTab: React.FC = () => {
    const [requests, setRequests] = useState<PointRequest[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const fetchRequests = async () => {
        setIsLoading(true);
        try {
            const res = await api.get('/client/point-requests');
            setRequests(res.data);
        } catch (error) {
            console.error('Error fetching point requests:', error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchRequests();
    }, []);

    const handleAction = async (id: string, action: 'approve' | 'deny') => {
        try {
            await api.post(`/client/point-requests/${id}/${action}`);
            setRequests(prev => prev.filter(r => r.id !== id));
        } catch (error) {
            console.error(`Error ${action}ing request:`, error);
            alert('Não foi possível processar a solicitação.');
        }
    };

    const getSourceIcon = (source: string) => {
        switch (source) {
            case 'manual_card': return <Smartphone className="w-4 h-4" />;
            case 'online_qr': return <Globe className="w-4 h-4" />;
            case 'auto_checkin': return <UserCheck className="w-4 h-4" />;
            default: return <Clock className="w-4 h-4" />;
        }
    };

    const getSourceLabel = (source: string) => {
        switch (source) {
            case 'approval': return 'Página Pública';
            case 'manual_card': return 'Cartão Manual';
            case 'online_qr': return 'QR Online';
            case 'auto_checkin': return 'Check-in Auto';
            default: return source;
        }
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-20">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500"></div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight">Solicitações Pendentes</h1>
                    <p className="text-gray-500 dark:text-gray-400 mt-1 text-lg">Gerencie as solicitações de pontos dos seus clientes.</p>
                </div>
                <Button onClick={fetchRequests} className="h-11 px-6 rounded-xl text-[11px] font-black uppercase tracking-widest border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-800 text-gray-700 shadow-sm hover:shadow-md transition-all">
                    Atualizar Lista
                </Button>
            </div>

            {requests.length === 0 ? (
                <div className="bg-white dark:bg-gray-900 rounded-3xl p-12 text-center border border-gray-100 dark:border-gray-800 shadow-sm">
                    <div className="w-16 h-16 bg-gray-50 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Check className="w-8 h-8 text-gray-400" />
                    </div>
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white">Tudo em dia!</h3>
                    <p className="text-gray-500">Não há solicitações de pontos pendentes no momento.</p>
                </div>
            ) : (
                <div className="grid gap-4">
                    {requests.map((request) => (
                        <div key={request.id} className="bg-white dark:bg-gray-900 rounded-2xl p-6 border border-gray-100 dark:border-gray-800 shadow-sm transition-all hover:shadow-md flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 bg-primary-50 dark:bg-primary-900/10 rounded-xl flex items-center justify-center shrink-0">
                                    <Smartphone className="w-6 h-6 text-primary-600" />
                                </div>
                                <div>
                                    <div className="flex items-center gap-2">
                                        <span className="font-bold text-gray-900 dark:text-white text-lg">{request.phone}</span>
                                        <span className="px-2 py-0.5 bg-gray-100 dark:bg-gray-800 text-gray-500 rounded text-[10px] font-bold uppercase tracking-wider flex items-center gap-1">
                                            {getSourceIcon(request.source)}
                                            {getSourceLabel(request.source)}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-3 text-sm text-gray-500 mt-1">
                                        <span className="flex items-center gap-1">
                                            <Clock className="w-3.5 h-3.5" />
                                            {new Date(request.created_at).toLocaleString('pt-BR')}
                                        </span>
                                        <span className="font-bold text-primary-600">
                                            +{request.requested_points} pts
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => handleAction(request.id, 'deny')}
                                    className="flex-1 md:flex-none h-11 px-6 rounded-xl border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 font-bold text-sm hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors flex items-center justify-center gap-2"
                                >
                                    <X className="w-4 h-4" /> Recusar
                                </button>
                                <button
                                    onClick={() => handleAction(request.id, 'approve')}
                                    className="flex-1 md:flex-none h-11 px-8 rounded-xl bg-primary-600 text-white font-bold text-sm hover:bg-primary-700 shadow-lg shadow-slate-400/20 transition-all active:scale-95 flex items-center justify-center gap-2"
                                >
                                    <Check className="w-4 h-4" /> Aprovar
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};
