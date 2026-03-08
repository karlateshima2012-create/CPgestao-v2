import React, { useState, useEffect } from 'react';
import { Card, Button, Badge, StatusModal } from '../../components/ui';
import {
  Download,
  UploadCloud,
  ListFilter,
  Database,
  Settings2,
  CheckSquare,
  Search,
  Calendar,
  Filter,
  FileSpreadsheet,
  FileCode,
  UserPlus,
  Zap
} from 'lucide-react';
import { Contact } from '../../types';
import { reportsService } from '../../services/api';

const EXPORT_OPTIONS = [
  { key: 'name', label: 'Nome Completo' },
  { key: 'phone', label: 'Telefone' },
  { key: 'email', label: 'E-mail' },
  { key: 'company_name', label: 'Nome da Empresa' },
  { key: 'birthday', label: 'Data de Aniversário' },
  { key: 'postal_code', label: 'Código Postal' },
  { key: 'province', label: 'Província' },
  { key: 'city', label: 'Cidade' },
  { key: 'address', label: 'Endereço' },
  { key: 'source', label: 'Origem do Cadastro' },
  { key: 'notes', label: 'Notas' },
  { key: 'points_balance', label: 'Saldo de Pontos' },
  { key: 'attendance_count', label: 'Total de Visitas' },
  { key: 'average_ticket', label: 'Ticket Médio' },
  { key: 'loyalty_level_name', label: 'Nível de Fidelidade' },
  { key: 'created_at', label: 'Data de Cadastro' },
];

interface ExportTabProps {
  contacts: Contact[];
  onExportSuccess?: (ids: string[]) => void;
}

export const ExportTab: React.FC<ExportTabProps> = ({ contacts: initialContacts }) => {
  const [exportData, setExportData] = useState<any[]>([]);
  const [loadingExport, setLoadingExport] = useState(false);

  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [selectedFields, setSelectedFields] = useState<string[]>([
    'name', 'email', 'phone', 'city', 'points_balance', 'attendance_count'
  ]);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [filterMode, setFilterMode] = useState<'all' | 'new'>('all');

  const setQuickFilterNew = () => {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    setDateFrom(thirtyDaysAgo.toISOString().split('T')[0]);
    setDateTo(new Date().toISOString().split('T')[0]);
    setFilterMode('new');
  };

  const clearFilters = () => {
    setSearch('');
    setDateFrom('');
    setDateTo('');
    setFilterMode('all');
  };

  const handleFetchExport = async () => {
    try {
      setLoadingExport(true);
      const params = {
        search,
        date_from: dateFrom,
        date_to: dateTo
      };
      const res = await reportsService.getExport(params);
      setExportData(res.data);
      return res.data;
    } catch (error) {
      console.error('Erro ao buscar dados para exportação:', error);
      return [];
    } finally {
      setLoadingExport(false);
    }
  };

  const generateDownload = async (format: 'csv' | 'xls') => {
    const data = await handleFetchExport();
    if (data.length === 0) return;

    const fieldsToExport = selectedFields;
    const header = EXPORT_OPTIONS
      .filter(o => fieldsToExport.includes(o.key))
      .map(o => o.label)
      .join(',');

    const rows = data.map((c: any) =>
      EXPORT_OPTIONS
        .filter(o => fieldsToExport.includes(o.key))
        .map(o => {
          let v = c[o.key] || '';
          return `"${String(v).replace(/"/g, '""')}"`;
        })
        .join(',')
    ).join('\n');

    const content = `\uFEFF${header}\n${rows}`;
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `relatorio_clientes_${format === 'xls' ? 'excel' : 'csv'}_${new Date().toISOString().split('T')[0]}.${format === 'xls' ? 'csv' : 'csv'}`;
    link.click();
    setShowSuccessModal(true);
  };

  return (
    <div className="max-w-6xl mx-auto py-8 px-4 animate-fade-in space-y-12">
      {/* Header */}
      <div>
        <h1 className="text-4xl font-black text-slate-900 dark:text-white tracking-tight">Exportação & Inteligência</h1>
        <p className="text-lg text-slate-500 dark:text-slate-400 mt-2 font-medium">Relatórios estratégicos sincronizados em tempo real com seu CRM.</p>
      </div>

      {/* Seção de Filtros e Exportação */}
      <section className="space-y-8">
        <div className="flex flex-col gap-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-slate-100 dark:bg-slate-800 rounded-xl">
              <Database className="w-5 h-5 text-slate-600" />
            </div>
            <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">Relatório & Exportação</h2>
          </div>

          {/* Quick Actions / Presets */}
          <div className="flex flex-wrap gap-4">
            <button
              onClick={clearFilters}
              className={`px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all border-2 ${filterMode === 'all' ? 'bg-slate-900 text-white border-slate-900 shadow-lg' : 'bg-white text-slate-400 border-slate-100 hover:border-slate-300'}`}
            >
              Todos os Dados
            </button>
            <button
              onClick={setQuickFilterNew}
              className={`px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all border-2 flex items-center gap-2 ${filterMode === 'new' ? 'bg-primary-500 text-white border-primary-500 shadow-lg shadow-primary-500/20' : 'bg-white text-slate-400 border-slate-100 hover:border-primary-200'}`}
            >
              <UserPlus className="w-3.5 h-3.5" /> Apenas Novos (30d)
            </button>
          </div>
        </div>

        <Card className="p-8 border-none shadow-xl shadow-slate-200/50 dark:shadow-none bg-white dark:bg-slate-900">
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-10">
            <div className="lg:col-span-2 space-y-2">
              <label className="text-[11px] font-black uppercase text-slate-400 tracking-widest ml-1">Buscar Cliente</label>
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 w-5 h-5" />
                <input
                  className="w-full pl-12 pr-4 h-14 rounded-2xl border border-slate-100 dark:border-slate-800 outline-none focus:ring-2 focus:ring-primary-500 transition-all font-medium text-sm bg-slate-50/50 dark:bg-slate-950/50"
                  placeholder="Nome, e-mail, telefone ou cidade..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-[11px] font-black uppercase text-slate-400 tracking-widest ml-1">De (Cadastro)</label>
              <div className="relative">
                <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 w-4 h-4" />
                <input
                  type="date"
                  className="w-full pl-11 pr-4 h-14 rounded-2xl border border-slate-100 dark:border-slate-800 outline-none focus:ring-2 focus:ring-primary-500 transition-all font-medium text-sm bg-slate-50/50 dark:bg-slate-950/50"
                  value={dateFrom}
                  onChange={e => setDateFrom(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-[11px] font-black uppercase text-slate-400 tracking-widest ml-1">Até (Cadastro)</label>
              <div className="relative">
                <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 w-4 h-4" />
                <input
                  type="date"
                  className="w-full pl-11 pr-4 h-14 rounded-2xl border border-slate-100 dark:border-slate-800 outline-none focus:ring-2 focus:ring-primary-500 transition-all font-medium text-sm bg-slate-50/50 dark:bg-slate-950/50"
                  value={dateTo}
                  onChange={e => setDateTo(e.target.value)}
                />
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="font-black text-slate-800 dark:text-white flex items-center gap-2 text-base">
                <Settings2 className="w-5 h-5 text-slate-400" />
                Campos para o Relatório
              </h3>
              <div className="flex gap-4">
                <button
                  onClick={() => setSelectedFields(EXPORT_OPTIONS.map(o => o.key))}
                  className="text-[10px] font-black uppercase tracking-widest text-primary-600 hover:text-primary-700 underline underline-offset-4"
                >
                  Selecionar Tudo
                </button>
                <button
                  onClick={() => setSelectedFields([])}
                  className="text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-600 underline underline-offset-4"
                >
                  Limpar
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {EXPORT_OPTIONS.map(opt => (
                <label key={opt.key} className={`flex items-center gap-3 p-4 border rounded-2xl cursor-pointer transition-all ${selectedFields.includes(opt.key) ? 'border-primary-500 bg-primary-50 dark:bg-primary-950/20 text-primary-700 dark:text-primary-300' : 'border-slate-100 dark:border-slate-800 text-slate-500'}`}>
                  <input type="checkbox" className="hidden" checked={selectedFields.includes(opt.key)} onChange={() => {
                    if (selectedFields.includes(opt.key)) setSelectedFields(selectedFields.filter(f => f !== opt.key));
                    else setSelectedFields([...selectedFields, opt.key]);
                  }} />
                  <CheckSquare className={`w-4 h-4 ${selectedFields.includes(opt.key) ? 'text-primary-500' : 'text-slate-300 dark:text-slate-700'}`} />
                  <span className="text-[11px] font-bold leading-tight">{opt.label}</span>
                </label>
              ))}
            </div>
          </div>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Button
            onClick={() => generateDownload('csv')}
            isLoading={loadingExport}
            className="h-20 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-[28px] text-lg font-black uppercase tracking-wider shadow-2xl transition-transform active:scale-95 flex items-center justify-center gap-4"
          >
            <FileCode className="w-6 h-6" /> Exportar em CSV
          </Button>
          <Button
            onClick={() => generateDownload('xls')}
            isLoading={loadingExport}
            className="h-20 bg-emerald-600 text-white rounded-[28px] text-lg font-black uppercase tracking-wider shadow-2xl transition-transform active:scale-95 flex items-center justify-center gap-4"
          >
            <FileSpreadsheet className="w-6 h-6" /> Exportar em EXCEL
          </Button>
        </div>
      </section>

      <StatusModal
        isOpen={showSuccessModal}
        onClose={() => setShowSuccessModal(false)}
        type="success"
        title="Relatório Gerado!"
        message="Seu download foi iniciado. Verifique sua pasta de transferências."
        confirmLabel="OK"
        theme="accent"
      />
    </div>
  );
};