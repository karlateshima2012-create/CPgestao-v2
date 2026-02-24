import React, { useState } from 'react';
import { Card, Button, Badge, StatusModal } from '../../components/ui';
import { Download, UploadCloud, ListFilter, Database, CheckCircle2, Settings2, CheckSquare, FileText, AlertCircle, X, Search } from 'lucide-react';
import { Contact } from '../../types';

const EXPORT_OPTIONS = [
  { key: 'name', label: 'Nome Completo' },
  { key: 'email', label: 'Email' },
  { key: 'phone', label: 'Telefone' },
  { key: 'province', label: 'Província' },
  { key: 'city', label: 'Cidade' },
  { key: 'notes', label: 'Observações' },
  { key: 'createdAt', label: 'Data de Cadastro' },
  { key: 'lastContacted', label: 'Último Contato' },
  { key: 'reminderDate', label: 'Data Lembrete' },
  { key: 'reminderText', label: 'Mensagem do Lembrete' },
  { key: 'public_url', label: 'Link do Terminal/Cartão' },
];

interface ExportTabProps {
  contacts: Contact[];
  onExportSuccess: (exportedIds: string[]) => void;
}

export const ExportTab: React.FC<ExportTabProps> = ({ contacts, onExportSuccess }) => {
  const [mode, setMode] = useState<'new' | 'custom' | 'full'>('new');
  const [search, setSearch] = useState('');
  const [selectedFields, setSelectedFields] = useState<string[]>(['name', 'email', 'phone', 'city']);
  const [showSuccessModal, setShowSuccessModal] = useState(false);

  const getBaseList = () => {
    if (mode === 'new') return contacts.filter(c => !c.exported);
    return contacts;
  };

  const unexported = contacts.filter(c => !c.exported);

  const filteredList = getBaseList().filter(c => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (
      c.name.toLowerCase().includes(s) ||
      (c.email && c.email.toLowerCase().includes(s)) ||
      (c.city && c.city.toLowerCase().includes(s)) ||
      (c.phone && c.phone.includes(s))
    );
  });

  const handleDownload = () => {
    if (filteredList.length === 0) return;
    const fieldsToExport = mode === 'full' ? EXPORT_OPTIONS.map(o => o.key) : selectedFields;

    const header = EXPORT_OPTIONS
      .filter(o => fieldsToExport.includes(o.key))
      .map(o => o.label)
      .join(',');

    const rows = filteredList.map(c =>
      EXPORT_OPTIONS
        .filter(o => fieldsToExport.includes(o.key))
        .map(o => {
          let v = (c as any)[o.key] || '';
          return `"${String(v).replace(/"/g, '""')}"`;
        })
        .join(',')
    ).join('\n');

    const csv = `data:text/csv;charset=utf-8,\uFEFF${header}\n${rows}`;
    const link = document.createElement("a");
    link.href = encodeURI(csv);
    link.download = `export_${mode}_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();

    if (mode === 'new') {
      const exportedIds = filteredList.map(c => c.id);
      onExportSuccess(exportedIds);
    }

    setShowSuccessModal(true);
  };

  return (
    <div className="max-w-5xl mx-auto py-10 animate-fade-in">
      <div className="mb-12">
        <h1 className="text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight">Exportação de Dados</h1>
        <p className="text-lg text-gray-500 dark:text-gray-400 mt-1">Prepare seus relatórios e backups da base de clientes.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
        {[
          { id: 'new', icon: UploadCloud, title: 'Novos Contatos', desc: 'Apenas o que ainda não foi exportado.', count: unexported.length, color: 'orange' },
          { id: 'custom', icon: ListFilter, title: 'Personalizado', desc: 'Filtre e selecione campos específicos.', count: contacts.length, color: 'blue' },
          { id: 'full', icon: Database, title: 'Backup Completo', desc: 'Toda a base de dados com todas colunas.', count: contacts.length, color: 'green' }
        ].map(m => (
          <button key={m.id} onClick={() => setMode(m.id as any)} className={`p-6 border-2 rounded-[15px] text-left transition-all ${mode === m.id ? 'border-primary-500 bg-primary-50/30' : 'border-gray-100 hover:border-primary-200 bg-white'}`}>
            <m.icon className={`w-8 h-8 mb-4 ${mode === m.id ? 'text-primary-500' : 'text-gray-400'}`} />
            <h3 className="font-bold mb-1">{m.title}</h3>
            <p className="text-xs text-gray-500 mb-4">{m.desc}</p>
            <Badge color={m.color as any}>{m.count} registros</Badge>
          </button>
        ))}
      </div>

      <div className="mb-8 relative max-w-2xl mx-auto shadow-sm">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
        <input
          className="w-full pl-12 pr-4 py-4 rounded-[15px] border border-gray-100 outline-none focus:ring-2 focus:ring-primary-500 transition-all font-medium text-sm"
          placeholder="Filtrar clientes por nome, e-mail, cidade ou telefone..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {mode !== 'full' && (
        <Card className="p-8 mb-8 border-none shadow-sm">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
            <h3 className="font-bold flex items-center gap-2"><Settings2 className="w-5 h-5 text-gray-400" /> Escolha os Dados para Exportação</h3>
            <div className="flex gap-2">
              <button
                onClick={() => setSelectedFields(EXPORT_OPTIONS.map(o => o.key))}
                className="text-[10px] font-black uppercase tracking-widest text-primary-600 hover:text-primary-700 underline underline-offset-4"
              >
                Selecionar Tudo
              </button>
              <span className="text-gray-300">|</span>
              <button
                onClick={() => setSelectedFields([])}
                className="text-[10px] font-black uppercase tracking-widest text-gray-400 hover:text-gray-600 underline underline-offset-4"
              >
                Limpar
              </button>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {EXPORT_OPTIONS.map(opt => (
              <label key={opt.key} className={`flex items-center gap-3 p-3 border rounded-[15px] cursor-pointer transition-all ${selectedFields.includes(opt.key) ? 'border-primary-500 bg-primary-50 text-primary-700' : 'border-gray-100 text-gray-500'}`}>
                <input type="checkbox" className="hidden" checked={selectedFields.includes(opt.key)} onChange={() => {
                  if (selectedFields.includes(opt.key)) setSelectedFields(selectedFields.filter(f => f !== opt.key));
                  else setSelectedFields([...selectedFields, opt.key]);
                }} />
                <CheckSquare className={`w-4 h-4 ${selectedFields.includes(opt.key) ? 'text-primary-500' : 'text-gray-300'}`} />
                <span className="text-xs font-medium">{opt.label}</span>
              </label>
            ))}
          </div>
        </Card>
      )}

      {filteredList.length > 0 ? (
        <div className="space-y-6">
          <Button
            onClick={handleDownload}
            size="lg"
            className="w-full h-16 text-lg font-bold bg-primary-500 shadow-xl shadow-primary-500/20 rounded-[15px]"
            disabled={selectedFields.length === 0 && mode !== 'full'}
          >
            <Download className="mr-2" /> Baixar Planilha CSV ({filteredList.length} registros)
          </Button>
          <Card className="p-6 bg-gray-50/50 border-none">
            <h4 className="text-sm font-bold flex items-center gap-2 mb-4"><AlertCircle className="w-4 h-4 text-primary-500" /> Resumo da Exportação:</h4>
            <ul className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
              <li className="flex flex-col gap-1">
                <span className="text-gray-400 uppercase font-black tracking-tighter">Registros</span>
                <strong className="text-gray-900 text-sm leading-none">{filteredList.length} encontrados</strong>
              </li>
              <li className="flex flex-col gap-1">
                <span className="text-gray-400 uppercase font-black tracking-tighter">Colunas</span>
                <strong className="text-gray-900 text-sm leading-none">{mode === 'full' ? 'Todas (Backup)' : `${selectedFields.length} selecionadas`}</strong>
              </li>
              <li className="flex flex-col gap-1">
                <span className="text-gray-400 uppercase font-black tracking-tighter">Formato</span>
                <strong className="text-gray-900 text-sm leading-none">CSV para Excel (UTF-8 BOM)</strong>
              </li>
            </ul>
          </Card>
        </div>
      ) : (
        <div className="text-center py-20 opacity-50 bg-gray-50/50 rounded-[15px] border-2 border-dashed border-gray-100">
          <X className="w-12 h-12 mx-auto mb-4 text-gray-300" />
          <p className="font-bold text-gray-400">Nenhum registro encontrado com os filtros atuais.</p>
        </div>
      )}

      <StatusModal
        isOpen={showSuccessModal}
        onClose={() => setShowSuccessModal(false)}
        type="success"
        title="Sucesso!"
        message="Sua planilha CSV foi gerada e o download iniciado com sucesso."
        confirmLabel="OK"
        theme="accent"
      />
    </div>
  );
};