import React, { useState, useEffect } from 'react';
import { Check, X, Clock, Smartphone, Globe, UserCheck, Filter, ChevronLeft, ChevronRight, Search, Activity, Trash2, CheckCircle2 } from 'lucide-react';
import { Button } from '../../components/ui';
import { Visit } from '../../types';
import api from '../../services/api';

export const VisitRecordsTab: React.FC = () => {
    const [visits, setVisits] = useState<Visit[]>([]);
    const [pagination, setPagination] = useState({
        current_page: 1,
        last_page: 1,
        total: 0
    });
    const [isLoading, setIsLoading] = useState(true);
    const [pendingCount, setPendingCount] = useState(0);

    // Filters
    const [period, setPeriod] = useState('all');
    const [status, setStatus] = useState('all');
    const [customerFilter, setCustomerFilter] = useState('');

    const fetchVisits = async (page = 1) => {
        setIsLoading(true);
        try {
            const params = {
                page,
                period,
                status,
                customer: customerFilter
            };
            const res = await api.get('/client/visits', { params });
            setVisits(res.data.visits.data);
            setPagination({
                current_page: res.data.visits.current_page,
                last_page: res.data.visits.last_page,
                total: res.data.visits.total
            });
            setPendingCount(res.data.pending_count);
        } catch (error) {
            console.error('Error fetching visits:', error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchVisits(1);
    }, [period, status]);

    const handleAction = async (id: string, action: 'approve' | 'deny') => {
        try {
            await api.post(`/client/visits/${id}/${action}`);
            fetchVisits(pagination.current_page);
        } catch (error: any) {
            console.error(`Error ${action}ing visit:`, error);
            alert(error.response?.data?.message || 'Erro ao processar ação.');
        }
    };

    const handleApproveAll = async () => {
        if (!confirm('Deseja aprovar todas as solicitações pendentes deste filtro?')) return;
        try {
            await api.post('/client/visits/approve-all');
            fetchVisits(1);
        } catch (error) {
            console.error('Error approving all:', error);
        }
    };

    const getOriginIcon = (origin: string) => {
        switch (origin) {
            case 'nfc': return <Smartphone className="w-3 h-3" />;
            case 'qr': return <Globe className="w-3 h-3" />;
            case 'manual': return <UserCheck className="w-3 h-3" />;
            default: return <Activity className="w-3 h-3" />;
        }
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Header com Filtros */}
            <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-6">
                <div>
                    <h1 className="text-3xl font-black text-gray-900 dark:text-white tracking-tight flex items-center gap-3">
                        Registros de Visitas
                        {pendingCount > 0 && (
                            <span className="bg-red-500 text-white text-xs font-black px-2.5 py-1 rounded-full animate-pulse">
                                {pendingCount} PENDENTES
                            </span>
                        )}
                    </h1>
                    <p className="text-gray-500 dark:text-gray-400 mt-1 font-medium">Histórico completo de interações e pontuações.</p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                    <div className="flex bg-white dark:bg-gray-900 p-1 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm">
                        {['all', 'today', '7days', '30days'].map((p) => (
                            <button
                                key={p}
                                onClick={() => setPeriod(p)}
                                className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${period === p
                                        ? 'bg-primary-500 text-white shadow-lg shadow-primary-500/20'
                                        : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-200'
                                    }`}
                            >
                                {p === 'all' ? 'Todos' : p === 'today' ? 'Hoje' : p === '7days' ? '7 Dias' : '30 Dias'}
                            </button>
                        ))}
                    </div>

                    <select
                        value={status}
                        onChange={(e) => setStatus(e.target.value)}
                        className="h-11 px-4 rounded-2xl bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 text-[11px] font-black uppercase tracking-widest text-gray-700 dark:text-gray-300 focus:ring-2 focus:ring-primary-500 transition-all outline-none"
                    >
                        <option value="all">Todos Status</option>
                        <option value="pendente">Pendente</option>
                        <option value="aprovado">Aprovado</option>
                        <option value="negado">Negado</option>
                    </select>

                    {pendingCount > 0 && (
                        <Button
                            onClick={handleApproveAll}
                            className="h-11 px-6 rounded-2xl bg-emerald-500 hover:bg-emerald-600 text-white text-[11px] font-black uppercase tracking-widest shadow-lg shadow-emerald-500/20"
                        >
                            Aprovar Todas
                        </Button>
                    )}
                </div>
            </div>

            {/* Barra de Busca */}
            <div className="relative group">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 group-focus-within:text-primary-500 transition-colors" />
                <input
                    type="text"
                    placeholder="Buscar por cliente ou telefone..."
                    value={customerFilter}
                    onChange={(e) => setCustomerFilter(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && fetchVisits(1)}
                    className="w-full h-14 pl-12 pr-4 rounded-[24px] bg-white dark:bg-gray-900 border-2 border-transparent focus:border-primary-500/20 focus:bg-white dark:focus:bg-gray-900 shadow-sm text-sm font-medium outline-none transition-all group-hover:shadow-md"
                />
            </div>

            {/* Tabela de Visitas */}
            <div className="bg-white dark:bg-gray-900 rounded-[32px] border border-gray-100 dark:border-gray-800 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-gray-50/50 dark:bg-gray-800/50">
                                <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Cliente</th>
                                <th className="px-6 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Empresa</th>
                                <th className="px-6 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest text-center">Status</th>
                                <th className="px-6 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Horário</th>
                                <th className="px-6 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest text-center">Origem</th>
                                <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                            {isLoading ? (
                                Array(5).fill(0).map((_, i) => (
                                    <tr key={i} className="animate-pulse">
                                        <td colSpan={6} className="px-8 py-6 h-20 bg-gray-50/20 dark:bg-gray-800/10"></td>
                                    </tr>
                                ))
                            ) : visits.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-8 py-20 text-center">
                                        <div className="flex flex-col items-center justify-center opacity-40">
                                            <Activity className="w-12 h-12 mb-4" />
                                            <p className="text-sm font-bold uppercase tracking-widest">Nenhum registro encontrado</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                visits.map((v) => (
                                    <tr key={v.id} className="group hover:bg-gray-50/50 dark:hover:bg-gray-800/30 transition-colors">
                                        <td className="px-8 py-5">
                                            <div className="flex items-center gap-4">
                                                <div className="w-10 h-10 rounded-full overflow-hidden bg-gray-100 dark:bg-gray-800 flex items-center justify-center shadow-inner border-2 border-white dark:border-gray-700">
                                                    {v.customer_photo_url ? (
                                                        <img src={v.customer_photo_url} alt="" className="w-full h-full object-cover" />
                                                    ) : (
                                                        <span className="text-xs font-black text-gray-400">{(v.customer_name || '?')[0].toUpperCase()}</span>
                                                    )}
                                                </div>
                                                <div className="flex flex-col">
                                                    <span className="text-sm font-bold text-gray-900 dark:text-white capitalize">{v.customer_name}</span>
                                                    <span className="text-[11px] text-gray-400 font-medium font-mono">{v.customer_phone}</span>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-5">
                                            <span className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-tight">
                                                {v.customer_company || '—'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-5">
                                            <div className="flex justify-center">
                                                <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest flex items-center gap-1.5 ${v.status === 'aprovado' ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10' :
                                                        v.status === 'negado' ? 'bg-red-50 text-red-600 dark:bg-red-500/10' :
                                                            'bg-amber-50 text-amber-600 dark:bg-amber-500/10'
                                                    }`}>
                                                    <div className={`w-1 h-1 rounded-full ${v.status === 'aprovado' ? 'bg-emerald-500' :
                                                            v.status === 'negado' ? 'bg-red-500' :
                                                                'bg-amber-500 animate-pulse'
                                                        }`} />
                                                    {v.status}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-5">
                                            <div className="flex flex-col">
                                                <span className="text-xs font-bold text-gray-700 dark:text-gray-300">
                                                    {new Date(v.visit_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                </span>
                                                <span className="text-[10px] text-gray-400">
                                                    {new Date(v.visit_at).toLocaleDateString()}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-5">
                                            <div className="flex justify-center">
                                                <div className="w-8 h-8 rounded-xl bg-gray-50 dark:bg-gray-800 flex items-center justify-center text-gray-400 group-hover:text-primary-500 transition-colors shadow-sm">
                                                    {getOriginIcon(v.origin)}
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-8 py-5">
                                            <div className="flex items-center justify-end gap-2">
                                                {v.status === 'pendente' ? (
                                                    <>
                                                        <button
                                                            onClick={() => handleAction(v.id, 'deny')}
                                                            className="p-2.5 rounded-xl border border-gray-100 dark:border-gray-800 text-gray-400 hover:text-red-500 hover:bg-red-50 transition-all shadow-sm"
                                                            title="Negar"
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </button>
                                                        <button
                                                            onClick={() => handleAction(v.id, 'approve')}
                                                            className="px-4 py-2.5 rounded-xl bg-primary-500 text-white text-[10px] font-black uppercase tracking-widest shadow-lg shadow-primary-500/20 hover:scale-105 active:scale-95 transition-all flex items-center gap-2"
                                                        >
                                                            <CheckCircle2 className="w-3.5 h-3.5" /> Aprovar +{v.points_granted}
                                                        </button>
                                                    </>
                                                ) : (
                                                    <span className="text-[10px] font-black text-gray-300 dark:text-gray-600 uppercase tracking-widest">Processado</span>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Paginação */}
                <div className="px-8 py-6 bg-gray-50/50 dark:bg-gray-800/30 flex items-center justify-between border-t border-gray-100 dark:border-gray-800">
                    <span className="text-xs font-bold text-gray-400">
                        Mostrando <span className="text-gray-900 dark:text-white">{visits.length}</span> de <span className="text-gray-900 dark:text-white">{pagination.total}</span> registros
                    </span>
                    <div className="flex items-center gap-2">
                        <button
                            disabled={pagination.current_page === 1}
                            onClick={() => fetchVisits(pagination.current_page - 1)}
                            className="w-10 h-10 rounded-xl bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 flex items-center justify-center text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed hover:shadow-md transition-all shadow-sm"
                        >
                            <ChevronLeft className="w-5 h-5" />
                        </button>
                        <div className="px-4 h-10 rounded-xl bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 flex items-center justify-center text-[11px] font-black text-gray-900 dark:text-white shadow-sm">
                            {pagination.current_page} / {pagination.last_page}
                        </div>
                        <button
                            disabled={pagination.current_page === pagination.last_page}
                            onClick={() => fetchVisits(pagination.current_page + 1)}
                            className="w-10 h-10 rounded-xl bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 flex items-center justify-center text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed hover:shadow-md transition-all shadow-sm"
                        >
                            <ChevronRight className="w-5 h-5" />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
