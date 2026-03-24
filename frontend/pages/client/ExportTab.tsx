import React, { useState } from 'react';
import { Card, Button, StatusModal, Badge } from '../../components/ui';
import {
  Database,
  Settings2,
  CheckSquare,
  Search,
  Calendar,
  FileSpreadsheet,
  FileCode,
  UserPlus,
  Smartphone,
  X
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

const PREVIEW_LIMIT = 5;

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
  const [modalConfig, setModalConfig] = useState<{ isOpen: boolean, title: string, message: string, type: any }>({
    isOpen: false,
    title: '',
    message: '',
    type: 'info'
  });
  const [showMacTutorial, setShowMacTutorial] = useState(false);

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

  const filteredContacts = initialContacts.filter(c => {
    const matchesSearch = !search ||
      (c.name?.toLowerCase().includes(search.toLowerCase())) ||
      (c.email?.toLowerCase().includes(search.toLowerCase())) ||
      (c.phone?.includes(search)) ||
      (c.city?.toLowerCase().includes(search.toLowerCase()));

    const createdAtStr = (c as any).created_at || (c as any).createdAt;
    const createdAt = new Date(createdAtStr);
    // Add 1 day to dateTo to include the whole day
    const matchesDateFrom = !dateFrom || createdAt >= new Date(dateFrom);
    const matchesDateTo = !dateTo || createdAt <= new Date(new Date(dateTo).setHours(23, 59, 59, 999));

    return matchesSearch && matchesDateFrom && matchesDateTo;
  });

  const filteredCount = filteredContacts.length;
  const previewList = filteredContacts.slice(0, PREVIEW_LIMIT);

  const handleFetchExport = async () => {
    try {
      setLoadingExport(true);
      const params = {
        search: search.trim(),
        date_from: dateFrom,
        date_to: dateTo
      };
      const res = await reportsService.getExport(params);
      const data = res.data || [];

      if (data.length === 0) {
        setModalConfig({
          isOpen: true,
          title: 'Nenhum contato encontrado',
          message: 'Tente ajustar seus filtros. Não há dados para exportar com a seleção atual.',
          type: 'warning'
        });
        return [];
      }
      setExportData(data);
      return data;
    } catch (error) {
      console.error('Erro ao buscar dados para exportação:', error);
      setModalConfig({
        isOpen: true,
        title: 'Erro na Exportação',
        message: 'Ocorreu um erro ao processar os dados no servidor. Tente novamente.',
        type: 'error'
      });
      return [];
    } finally {
      setLoadingExport(false);
    }
  };

  const generateDownload = async (format: 'csv' | 'xls') => {
    if (selectedFields.length === 0) {
      setModalConfig({
        isOpen: true,
        title: 'Selecione os Campos',
        message: 'Por favor, selecione ao menos um campo para incluir no relatório.',
        type: 'info'
      });
      return;
    }

    const data = await handleFetchExport();
    if (!data || data.length === 0) return;

    const separator = format === 'xls' ? '\t' : ',';

    const header = EXPORT_OPTIONS
      .filter(o => selectedFields.includes(o.key))
      .map(o => o.label)
      .join(separator);

    const rows = data.map((c: any) =>
      EXPORT_OPTIONS
        .filter(o => selectedFields.includes(o.key))
        .map(o => {
          let v = c[o.key] ?? '';
          if (typeof v === 'string') {
            v = v.replace(/[\n\r\t,]/g, ' ');
          }
          return format === 'csv' ? `"${String(v).replace(/"/g, '""')}"` : String(v);
        })
        .join(separator)
    ).join('\n');

    const content = `\uFEFF${header}\n${rows}`;
    const blob = new Blob([content], { type: format === 'xls' ? 'application/vnd.ms-excel' : 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    const extension = format === 'xls' ? 'xls' : 'csv';
    link.download = `relatorio_clientes_${new Date().toISOString().split('T')[0]}.${extension}`;
    link.click();

    setTimeout(() => URL.revokeObjectURL(url), 500);
    setShowSuccessModal(true);
  };

  return (
    <div className="max-w-6xl mx-auto py-8 px-4 animate-fade-in space-y-12">
      <div>
        <h1 className="text-4xl font-black text-slate-900 dark:text-white tracking-tight">Exportação & Inteligência</h1>
        <p className="text-lg text-slate-500 dark:text-slate-400 mt-2 font-medium">Relatórios estratégicos sincronizados em tempo real com seu CRM.</p>
      </div>

      <section className="space-y-8">
        <div className="flex flex-col gap-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-slate-100 dark:bg-slate-800 rounded-xl">
              <Database className="w-5 h-5 text-slate-600" />
            </div>
            <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">Relatório & Exportação</h2>
          </div>

          <div className="flex flex-wrap gap-4">
            <button
              onClick={clearFilters}
              className={`px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all border-2 ${filterMode === 'all' ? 'bg-slate-900 text-white border-slate-900 shadow-lg' : 'bg-white text-slate-400 border-slate-100 hover:border-slate-300 dark:bg-slate-900 dark:border-slate-800'}`}
            >
              Todos os Dados
            </button>
            <button
              onClick={setQuickFilterNew}
              className={`px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all border-2 flex items-center gap-2 ${filterMode === 'new' ? 'bg-primary-500 text-white border-primary-500 shadow-lg shadow-primary-500/20' : 'bg-white text-slate-400 border-slate-100 hover:border-primary-200 dark:bg-slate-900 dark:border-slate-800'}`}
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

        {/* Vista Prévia (Relocated) */}
        <div className="flex flex-col gap-4 bg-slate-50 dark:bg-slate-800/50 p-6 rounded-3xl border border-slate-100 dark:border-slate-800 animate-fade-in">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Seleção para Exportação:</span>
              <span className={`text-xl font-black ${filteredCount > 0 ? 'text-primary-600' : 'text-red-500'}`}>
                {filteredCount} {filteredCount === 1 ? 'Contato' : 'Contatos'}
              </span>
            </div>
            {filteredCount > 0 && (
              <Badge color="blue" className="text-[9px] font-black uppercase px-3 py-1">Vista Prévia</Badge>
            )}
          </div>

          {filteredCount > 0 ? (
            <div className="space-y-2">
              <div className="grid grid-cols-1 gap-1">
                {previewList.map(c => (
                  <div key={c.id} className="flex items-center justify-between py-2 px-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800 shadow-sm hover:shadow-md transition-shadow">
                    <span className="text-sm font-bold text-slate-700 dark:text-slate-200">{c.name}</span>
                    <span className="text-[10px] font-medium text-slate-400">{c.phone}</span>
                  </div>
                ))}
              </div>

              {filteredCount > PREVIEW_LIMIT && (
                <div className="flex items-center gap-2 pt-2">
                  <div className="h-px bg-slate-200 dark:bg-slate-700 flex-1" />
                  <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest italic text-center px-4 leading-relaxed">
                    + {filteredCount - PREVIEW_LIMIT} outros contatos serão exportados no total
                  </span>
                  <div className="h-px bg-slate-200 dark:bg-slate-700 flex-1" />
                </div>
              )}
            </div>
          ) : (
            <div className="py-4 text-center">
              <p className="text-sm font-bold text-slate-400 italic">Nenhum cliente atende aos filtros atuais.</p>
            </div>
          )}
        </div>

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
        <div className="flex flex-col items-center gap-4 mt-12 bg-slate-50 dark:bg-slate-900/50 p-8 rounded-[32px] border border-dashed border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-6">
            <Smartphone className="w-8 h-8 text-primary-500 animate-bounce" />
            <div className="text-left">
              <h4 className="text-sm font-black text-slate-800 dark:text-white uppercase tracking-tighter">Dica do Especialista</h4>
              <p className="text-[11px] text-slate-500 font-medium">Sincronize sua base de clientes com seu ecossistema Apple em segundos.</p>
            </div>
            <button
              onClick={() => setShowMacTutorial(true)}
              className="px-6 py-3 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl text-[10px] font-black text-primary-600 uppercase tracking-widest hover:bg-primary-50 dark:hover:bg-primary-950/30 transition-all shadow-sm active:scale-95"
            >
              Como importar contatos no Mac?
            </button>
          </div>
        </div>
      </section>

      {/* Modal Tutorial Mac */}
      {showMacTutorial && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-md animate-fade-in">
          <Card className="w-full max-w-xl bg-white dark:bg-slate-900 rounded-[2.5rem] p-10 shadow-2xl overflow-hidden relative">
            <button
              onClick={() => setShowMacTutorial(false)}
              className="absolute top-6 right-6 p-2 bg-slate-50 dark:bg-slate-800 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
            >
              <X className="w-5 h-5 text-slate-400" />
            </button>

            <div className="flex flex-col items-center text-center space-y-6">
              <div className="w-20 h-20 bg-primary-50 dark:bg-primary-900/20 rounded-[2.5rem] flex items-center justify-center">
                <Smartphone className="w-10 h-10 text-primary-600" />
              </div>
              <div>
                <h3 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tighter">CSV → Contatos do Mac</h3>
                <p className="text-slate-500 text-sm mt-1 font-medium">Veja seus clientes salvos no Macbook e iPhone instantaneamente.</p>
              </div>

              <div className="w-full space-y-4 pt-4">
                {[
                  { step: 1, text: "Exporte seu relatório no formato CSV aqui no painel." },
                  { step: 2, text: "Abra o aplicativo 'Contatos' no seu Macbook." },
                  { step: 3, text: "Vá no menu 'Arquivo' -> 'Importar' (ou use ⌘+O)." },
                  { step: 4, text: "Selecione o arquivo CSV baixado e clique em Importar." },
                  { step: 5, text: "Mapeie os campos se o Mac solicitar (ex: Nome = First Name)." }
                ].map((item) => (
                  <div key={item.step} className="flex items-center gap-4 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl text-left hover:translate-x-1 transition-transform">
                    <span className="w-8 h-8 rounded-full bg-white dark:bg-slate-900 flex items-center justify-center text-xs font-black text-primary-600 shadow-sm grow-0 shrink-0">
                      {item.step}
                    </span>
                    <p className="text-sm font-bold text-slate-700 dark:text-slate-300 leading-tight">{item.text}</p>
                  </div>
                ))}
              </div>

              <div className="pt-6 w-full">
                <Button
                  className="w-full h-14 bg-primary-600 hover:bg-primary-700 text-white font-black uppercase tracking-widest rounded-2xl shadow-lg shadow-primary-500/20"
                  onClick={() => setShowMacTutorial(false)}
                >
                  Entendi, mãos à obra!
                </Button>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-4">
                  💡 Os contatos serão sincronizados via iCloud.
                </p>
              </div>
            </div>
          </Card>
        </div>
      )}

      <StatusModal
        isOpen={showSuccessModal}
        onClose={() => setShowSuccessModal(false)}
        type="success"
        title="Relatório Gerado!"
        message="Seu download foi iniciado. Verifique sua pasta de transferências."
        confirmLabel="OK"
        theme="accent"
      />

      <StatusModal
        isOpen={modalConfig.isOpen}
        onClose={() => setModalConfig({ ...modalConfig, isOpen: false })}
        type={modalConfig.type}
        title={modalConfig.title}
        message={modalConfig.message}
        confirmLabel="FECHAR"
        theme="neutral"
      />
    </div>
  );
};