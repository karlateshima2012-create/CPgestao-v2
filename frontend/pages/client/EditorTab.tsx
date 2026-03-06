import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Card, Button, Input, Badge, StatusModal } from '../../components/ui';
import {
  Camera, Save, ArrowLeft, RefreshCw, Smartphone, Star,
  Calendar, Copy, Check, Clock, Edit2, Shield,
  AlertTriangle, MonitorPlay, BarChart3, ChevronDown,
  User, Crown, FileText, Bell, Trash2
} from 'lucide-react';
import { Contact, TenantTag } from '../../types';
import api from '../../services/api';

interface EditorTabProps {
  selectedContact: Contact | null;
  onSave: (data: Partial<Contact>) => void;
  onCancel: () => void;
}

const ComboboxDate = ({ value, onChange, options = [], placeholder, isDay }: any) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const selected = (options || []).find((o: any) => o.value === value);
    setSearch(selected ? selected.label : (value || ''));
  }, [value, options]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
        const searchLower = (search || '').toLowerCase();
        const match = (options || []).find((o: any) =>
          (o.label || '').toLowerCase() === searchLower ||
          o.value === search ||
          (isDay && parseInt(o.value) === parseInt(search))
        );
        if (match) onChange(match.value);
        else if (isDay && search && parseInt(search) > 0 && parseInt(search) <= 31) {
          onChange(search.padStart(2, '0'));
        } else if (!search) {
          onChange('');
        } else {
          const prevMatch = (options || []).find((o: any) => o.value === value);
          setSearch(prevMatch ? prevMatch.label : '');
        }
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [search, options, onChange, isDay, value]);

  const selectedLabel = (options || []).find((o: any) => o.value === value)?.label;
  const isExactMatch = search === selectedLabel;

  const filtered = (options || []).filter((o: any) =>
    !search || isExactMatch ||
    (o.label || '').toLowerCase().includes((search || '').toLowerCase()) ||
    (o.value || '').includes(search || '')
  );

  return (
    <div ref={wrapperRef} className={`relative ${isDay ? 'w-24' : 'flex-1'}`}>
      <input
        type="text"
        placeholder={placeholder}
        className={`w-full h-11 pl-4 pr-10 appearance-none bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-[15px] font-bold text-sm text-gray-700 dark:text-gray-300 outline-none focus:ring-2 focus:ring-gray-300 dark:focus:ring-gray-600 transition-all ${isDay ? 'text-center pl-2' : ''}`}
        value={search}
        onChange={e => { setSearch(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
      />
      <div
        className="absolute right-0 top-0 h-11 w-10 flex items-center justify-center cursor-pointer"
        onClick={() => setOpen(!open)}
      >
        <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </div>

      {open && (
        <div className="absolute top-[calc(100%+4px)] left-0 w-full max-h-48 overflow-y-auto bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-[15px] shadow-xl z-50 p-1 custom-scrollbar">
          {filtered.map((o: any) => (
            <div
              key={o.value}
              className="px-4 py-2 text-sm font-bold text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer rounded-[10px]"
              onClick={() => {
                setSearch(o.label);
                onChange(o.value);
                setOpen(false);
              }}
            >
              {o.label}
            </div>
          ))}
          {filtered.length === 0 && <div className="px-4 py-2 text-xs text-gray-400 text-center">Nenhum</div>}
        </div>
      )}
    </div>
  );
};

const getTimeDisplay = (t24?: string) => {
  if (!t24 || !t24.includes(':')) return { time: '', period: 'AM' };
  const p = t24.split(':');
  let h = parseInt(p[0]);
  const m = p[1];
  const per = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return { time: `${h.toString().padStart(2, '0')}:${m}`, period: per };
};

const ComboboxTime = ({ value, onChange, placeholder }: any) => {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const { time: display, period } = getTimeDisplay(value);
  const [hour, minute] = display.includes(':') ? display.split(':').map(n => parseInt(n)) : [12, 0];

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (h: number, m: number, p: string) => {
    let finalH = h;
    if (p === 'PM' && h < 12) finalH += 12;
    if (p === 'AM' && h === 12) finalH = 0;
    onChange(`${finalH.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`);
  };

  const handleType = (val: string) => {
    const clean = val.replace(/\D/g, '').slice(0, 4);
    let h = parseInt(clean.slice(0, 2) || '12');
    let m = parseInt(clean.slice(2, 4) || '0');
    if (h > 12) h = 12;
    if (m > 59) m = 59;
    handleSelect(h, m, period);
  };

  const hours = Array.from({ length: 12 }, (_, i) => i + 1);

  return (
    <div ref={wrapperRef} className="relative flex-1">
      <div className="flex items-center gap-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-[15px] h-11 px-3 shadow-sm focus-within:ring-2 focus-within:ring-gray-300 dark:focus-within:ring-gray-600 transition-all">
        <Clock className="w-4 h-4 text-gray-400" />
        <input
          type="text"
          placeholder={placeholder}
          className="w-14 bg-transparent text-sm font-bold outline-none text-gray-700 dark:text-gray-300"
          value={value ? `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}` : ''}
          onChange={e => handleType(e.target.value)}
          onFocus={() => setOpen(true)}
        />
        <div className="flex bg-white dark:bg-gray-900/50 p-0.5 rounded-lg ml-auto border border-gray-100 dark:border-gray-700">
          {['AM', 'PM'].map(p => (
            <button
              key={p}
              type="button"
              onClick={() => handleSelect(hour, minute, p)}
              className={`px-2 py-0.5 rounded-md text-[9px] font-black transition-all ${period === p ? 'bg-gray-600 text-white shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {open && (
        <div className="absolute bottom-full left-0 mb-2 w-full min-w-[120px] bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-[20px] shadow-2xl z-50 p-2 animate-in fade-in slide-in-from-bottom-2 duration-200">
          <p className="text-[9px] font-black text-gray-400 uppercase mb-2 ml-2 tracking-widest text-center mt-1">Selecionar Hora</p>
          <div className="max-h-48 overflow-y-auto custom-scrollbar space-y-1">
            {hours.map((h) => (
              <button
                key={h}
                onClick={() => { handleSelect(h, minute, period); setOpen(false); }}
                className={`w-full py-2.5 px-4 rounded-[12px] text-sm font-bold transition-all text-left flex items-center justify-between ${hour === h ? 'bg-primary-500 text-white' : 'hover:bg-gray-50 dark:hover:bg-gray-900 text-gray-600 dark:text-gray-400'}`}
              >
                <span>{h.toString().padStart(2, '0')}</span>
                {hour === h && <Check className="w-3 h-3" />}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

const BirthdayInput = ({ value, onChange }: { value: string, onChange: (v: string) => void }) => {
  const y = '2000';
  const valStrInitial = value || '';
  const valStr = valStrInitial.split('T')[0]; // Prevenir problemas com datas ISO (YYYY-MM-DDTHH:MM...)
  const m = valStr.includes('-') ? valStr.split('-')[1] : (valStr.includes('/') ? valStr.split('/')[1] : '');
  const d = valStr.includes('-') ? valStr.split('-')[2] : (valStr.includes('/') ? valStr.split('/')[0] : '');

  const dayOptions = useMemo(() => Array.from({ length: 31 }, (_, i) => {
    const v = (i + 1).toString().padStart(2, '0');
    return { value: v, label: v };
  }), []);

  const monthOptions = useMemo(() => [
    { value: '01', label: 'Janeiro' }, { value: '02', label: 'Fevereiro' },
    { value: '03', label: 'Março' }, { value: '04', label: 'Abril' },
    { value: '05', label: 'Maio' }, { value: '06', label: 'Junho' },
    { value: '07', label: 'Julho' }, { value: '08', label: 'Agosto' },
    { value: '09', label: 'Setembro' }, { value: '10', label: 'Outubro' },
    { value: '11', label: 'Novembro' }, { value: '12', label: 'Dezembro' }
  ], []);

  const handleDay = (newDay: string) => {
    if (!newDay) return onChange('');
    onChange(`${y}-${m || '01'}-${newDay.padStart(2, '0')}`);
  }

  const handleMonth = (newMonth: string) => {
    if (!newMonth) return onChange('');
    onChange(`${y}-${newMonth}-${(d || '01').padStart(2, '0')}`);
  }

  return (
    <div className="flex flex-col gap-[6px] relative z-20">
      <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">DATA DE ANIVERSÁRIO</label>
      <div className="flex gap-2">
        <ComboboxDate value={d} onChange={handleDay} options={dayOptions} placeholder="Dia" isDay={true} />
        <ComboboxDate value={m} onChange={handleMonth} options={monthOptions} placeholder="Mês" isDay={false} />
      </div>
    </div>
  );
};

export const EditorTab: React.FC<EditorTabProps> = ({ selectedContact, onSave, onCancel }) => {
  const initialData: Partial<Contact> = useMemo(() => ({
    name: '', phone: '', email: '', birthday: '', postalCode: '', province: '', city: '', address: '', notes: '',
    pointsBalance: 0, loyaltyLevel: 1, source: '', tags: [], preferences: [],
    totalSpent: 0, averageTicket: 0, attendanceCount: 0, reminderTime: '', reminderDate: '', reminderText: ''
  }), []);

  const [formData, setFormData] = useState<Partial<Contact>>(initialData);
  const [serviceModal, setServiceModal] = useState(false);
  const [serviceForm, setServiceForm] = useState({
    service_name: '', amount: '', payment_method: '', notes: '', service_date: new Date().toISOString().split('T')[0]
  });
  const [serviceHistory, setServiceHistory] = useState<any[]>([]);
  const [historyPagination, setHistoryPagination] = useState({ current_page: 1, last_page: 1, total: 0 });
  const [systemModal, setSystemModal] = useState<{ isOpen: boolean; title: string; message: string; type: 'success' | 'error' | 'info' | 'warning' }>({ isOpen: false, title: '', message: '', type: 'info' });
  const [availableTags, setAvailableTags] = useState<TenantTag[]>([]);
  const [tagModal, setTagModal] = useState(false);
  const [isTagSelectOpen, setIsTagSelectOpen] = useState(false);
  const [newTagForm, setNewTagForm] = useState({ name: '', category: 'Comportamento', color: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800' });
  const [pointsInput, setPointsInput] = useState('1');
  const [loyaltySettings, setLoyaltySettings] = useState<any>(null);
  const [reminders, setReminders] = useState<any[]>([]);
  const [newReminder, setNewReminder] = useState({ date: '', time: '', text: '' });

  useEffect(() => {
    loadTags();
    fetchLoyaltySettings();
    if (selectedContact) {
      setFormData({ ...initialData, ...selectedContact });
      if (selectedContact.id) {
        loadHistory(selectedContact.id);
        loadReminders(selectedContact.id);
      }
    } else {
      setFormData(initialData);
      setServiceHistory([]);
      setReminders([]);
    }
  }, [selectedContact, initialData]);

  const fetchLoyaltySettings = async () => {
    try {
      const res = await api.get('/client/loyalty/settings');
      setLoyaltySettings(res.data);
    } catch (err) { console.error('Erro ao carregar configurações de fidelidade:', err); }
  };

  const addManualPoints = (amount: number) => {
    if (isNaN(amount) || amount === 0) return;
    setFormData(prev => ({
      ...prev,
      pointsBalance: (prev.pointsBalance || 0) + amount
    }));
  };

  const addDefaultPoints = () => {
    const levelIdx = Math.max(0, (formData.loyaltyLevel || 1) - 1);
    const defaultPoints = loyaltySettings?.levels_config?.[levelIdx]?.points_per_visit || 1;
    addManualPoints(Number(defaultPoints));
  };

  const loadHistory = async (id: string, page: number = 1) => {
    try {
      const res = await api.get(`/client/contacts/${id}/service-records?page=${page}`);

      // Tentar extrair os dados de diferentes níveis (devido a possíveis interceptores do Axios)
      const rawData = res.data?.data || res.data;
      const paginator = rawData?.data ? rawData : (res.data?.data?.data ? res.data.data : null);

      if (paginator && paginator.data) {
        setServiceHistory(paginator.data);
        setHistoryPagination({
          current_page: paginator.current_page || 1,
          last_page: paginator.last_page || 1,
          total: paginator.total || paginator.data.length
        });
      } else {
        const list = Array.isArray(rawData) ? rawData : (Array.isArray(rawData?.data) ? rawData.data : []);
        setServiceHistory(list);
        setHistoryPagination({ current_page: 1, last_page: 1, total: list.length });
      }
    } catch (e) {
      console.error('Erro ao carregar histórico:', e);
      setServiceHistory([]);
    }
  };

  const loadTags = async () => {
    try {
      const res = await api.get('/client/tags');
      setAvailableTags(Array.isArray(res.data) ? res.data : []);
    } catch (e) { console.error(e); }
  };

  const loadReminders = async (id: string) => {
    try {
      const res = await api.get(`/client/contacts/${id}/reminders`);
      const list = res.data?.data || res.data || [];
      setReminders(list);
    } catch (e) {
      console.error('Erro ao carregar lembretes:', e);
    }
  };

  const addReminder = async () => {
    if (!selectedContact?.id || !newReminder.date || !newReminder.time || !newReminder.text) return;
    try {
      await api.post(`/client/contacts/${selectedContact.id}/reminders`, {
        reminder_date: newReminder.date,
        reminder_time: newReminder.time,
        reminder_text: newReminder.text
      });
      setNewReminder({ date: '', time: '', text: '' });
      loadReminders(selectedContact.id);
    } catch (err: any) {
      setSystemModal({ isOpen: true, title: 'Erro', message: err.response?.data?.message || 'Erro ao agendar lembrete.', type: 'error' });
    }
  };

  const deleteReminder = async (rid: string) => {
    try {
      await api.delete(`/client/reminders/${rid}`);
      if (selectedContact?.id) loadReminders(selectedContact.id);
    } catch (e) { console.error(e); }
  };

  const createTag = async () => {
    if (!newTagForm.name.trim()) return;
    try {
      await api.post('/client/tags', newTagForm);
      setTagModal(false);
      setNewTagForm({ name: '', category: 'Comportamento', color: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800' });
      loadTags();
    } catch (err: any) {
      setSystemModal({ isOpen: true, title: 'Erro', message: err.response?.data?.error || 'Erro ao criar tag.', type: 'error' });
    }
  };

  const handleAddService = async () => {
    if (!selectedContact?.id || !serviceForm.service_name || !serviceForm.amount) return;

    // Para Yen, removemos qualquer caractere que não seja número (pontos, vírgulas, etc)
    const cleanAmount = parseInt(serviceForm.amount.toString().replace(/\D/g, '')) || 0;

    try {
      await api.post(`/client/contacts/${selectedContact.id}/service-records`, {
        ...serviceForm,
        amount: cleanAmount
      });
      setServiceModal(false);
      setServiceForm({ service_name: '', amount: '', payment_method: '', notes: '', service_date: new Date().toISOString().split('T')[0] });
      loadHistory(selectedContact.id);

      // Atualizar métricas localmente ou recarregar contato
      const contactRes = await api.get(`/client/contacts/${selectedContact.id}`);
      const updatedData = contactRes.data?.data || contactRes.data;

      if (updatedData && typeof updatedData === 'object') {
        // Mapear campos snake_case para camelCase como feito em App.tsx
        const mappedData = {
          ...updatedData,
          pointsBalance: updatedData.points_balance ?? updatedData.pointsBalance ?? 0,
          loyaltyLevel: updatedData.loyalty_level ?? updatedData.loyaltyLevel ?? 1,
          postalCode: updatedData.postal_code ?? updatedData.postalCode,
          totalSpent: updatedData.total_spent ?? updatedData.totalSpent ?? 0,
          averageTicket: updatedData.average_ticket ?? updatedData.averageTicket ?? 0,
          attendanceCount: updatedData.attendance_count ?? updatedData.attendanceCount ?? 0,
          lastActivityAt: updatedData.last_activity_at ?? updatedData.lastActivityAt
        };
        setFormData(prev => ({ ...prev, ...mappedData }));
      }

      setSystemModal({ isOpen: true, title: 'Sucesso', message: 'Movimentação registrada com sucesso!', type: 'success' });
    } catch (err: any) {
      console.error('Erro detalhado ao salvar movimentação:', err);
      setSystemModal({
        isOpen: true,
        title: 'Erro',
        message: err.response?.data?.message || err.message || 'Erro ao registrar movimentação.',
        type: 'error'
      });
    }
  };

  const deleteTag = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await api.delete(`/client/tags/${id}`);
      loadTags();
      setFormData(prev => ({ ...prev, tags: (prev.tags || []).filter(name => availableTags.find(t => t.id === id)?.name !== name) }));
    } catch (err: any) {
      setSystemModal({ isOpen: true, title: 'Erro', message: 'Erro ao excluir tag.', type: 'error' });
    }
  };

  const toggleTagSelection = (tagName: string) => {
    const current = formData.tags || [];
    setFormData(prev => ({ ...prev, tags: current.includes(tagName) ? current.filter(t => t !== tagName) : [...current, tagName] }));
  };

  const handleCapitalize = (field: keyof Contact, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value.replace(/(?:^|\s)\S/g, a => a.toUpperCase()) }));
  };

  const handlePhoneMask = (value: string) => {
    let nums = value.replace(/\D/g, '').slice(0, 11);
    let f = nums;
    if (nums.length > 0) {
      const isShort = /^0[36]/.test(nums);
      if (isShort) {
        if (nums.length > 2) f = nums.slice(0, 2) + '-' + nums.slice(2);
        if (nums.length > 6) f = f.slice(0, 7) + '-' + nums.slice(6);
      } else {
        if (nums.length > 3) f = nums.slice(0, 3) + '-' + nums.slice(3);
        if (nums.length > 7) f = f.slice(0, 8) + '-' + nums.slice(7);
      }
    }
    setFormData(prev => ({ ...prev, phone: f }));
  };

  const formatDateForInput = (dStr?: string) => {
    if (!dStr) return '';
    const p = dStr.includes('/') ? dStr.split('/') : dStr.split('-');
    if (p.length === 3) return p[0].length === 4 ? dStr : `${p[2]}-${p[1]}-${p[0]}`;
    return dStr;
  };

  const handleDateChange = (field: keyof Contact, val: string) => {
    if (val && val.includes('-')) {
      const [y, m, d] = val.split('-');
      setFormData(prev => ({ ...prev, [field]: `${d}/${m}/${y}` }));
    } else setFormData(prev => ({ ...prev, [field]: val || '' }));
  };

  const { time: displayTime, period } = getTimeDisplay(formData.reminderTime);

  return (
    <div className="max-w-4xl mx-auto animate-fade-in pb-20 space-y-8 flex flex-col items-center">
      <div className="w-full">
        <div className="flex items-center gap-4">
          <button onClick={onCancel} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors">
            <ArrowLeft className="w-6 h-6 text-gray-400 hover:text-gray-900 dark:text-gray-500 dark:hover:text-white" />
          </button>
          <div>
            <h1 className="text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight">
              {selectedContact ? 'Ficha do Cliente' : 'Novo Cadastro'}
            </h1>
            <p className="text-gray-500 dark:text-gray-400 mt-1 text-lg">
              {selectedContact ? 'Visualize e edite as informações do seu cliente.' : 'Cadastre um novo cliente no seu programa.'}
            </p>
          </div>
        </div>
      </div>

      {selectedContact && (
        <Card className="p-8 w-full flex items-center gap-6 border border-gray-200 dark:border-gray-800 shadow-xl bg-white dark:bg-gray-900 rounded-[24px]">
          <div className="w-20 h-20 shrink-0 rounded-[20px] flex items-center justify-center text-3xl font-black bg-gray-50 dark:bg-gray-800">
            {(formData.name || '?')[0].toUpperCase()}
          </div>
          <div className="flex-1 space-y-1">
            <div className="flex items-center gap-3">
              <h2 className="text-3xl font-black tracking-tight">{formData.name || 'Sem Nome'}</h2>
              <Badge color={(formData as any).loyaltyLevel === 4 ? 'diamond' : (formData as any).loyaltyLevel === 3 ? 'gold' : (formData as any).loyaltyLevel === 2 ? 'silver' : 'bronze'}>
                {(formData as any).loyalty_level_name || ((formData as any).loyaltyLevel === 4 ? '💎 Diamante' : (formData as any).loyaltyLevel === 3 ? '🥇 Ouro' : (formData as any).loyaltyLevel === 2 ? '🥈 Prata' : '🥉 Bronze')}
              </Badge>
            </div>
            <p className="text-gray-500 font-bold">{formData.phone}</p>
          </div>
          <div className="flex flex-col items-end text-right">
            <p className="text-xs font-black text-gray-400 uppercase tracking-widest">Total Gasto</p>
            <p className="text-3xl font-black">¥ {Number(formData.totalSpent || 0).toLocaleString('en-US')}</p>
          </div>
        </Card>
      )}

      <Card className="p-8 border border-gray-200 dark:border-gray-800 w-full rounded-[24px]">
        <h3 className="text-sm font-black uppercase tracking-widest flex items-center gap-2 mb-8"><User className="w-5 h-5 text-gray-400" /> Dados Básicos</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div className="md:col-span-3"><Input label="NOME COMPLETO *" value={formData.name || ''} onChange={e => handleCapitalize('name', e.target.value)} /></div>
          <Input label="TELEFONE *" value={formData.phone || ''} onChange={e => handlePhoneMask(e.target.value)} />
          <Input label="E-MAIL" type="email" value={formData.email || ''} onChange={e => setFormData(p => ({ ...p, email: e.target.value }))} />
          <BirthdayInput value={formData.birthday || ''} onChange={v => setFormData(p => ({ ...p, birthday: v }))} />
          <Input label="CÓDIGO POSTAL" value={formData.postalCode || ''} onChange={e => setFormData(p => ({ ...p, postalCode: e.target.value }))} />
          <Input label="PROVÍNCIA *" value={formData.province || ''} onChange={e => handleCapitalize('province', e.target.value)} />
          <Input label="CIDADE *" value={formData.city || ''} onChange={e => handleCapitalize('city', e.target.value)} />
          <div className="md:col-span-3"><Input label="ENDEREÇO" value={formData.address || ''} onChange={e => handleCapitalize('address', e.target.value)} /></div>

          <div className="md:col-span-1 space-y-2">
            <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">ORIGEM</label>
            <select className="w-full h-11 px-4 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-[15px] font-bold text-sm" value={formData.source || ''} onChange={e => setFormData(p => ({ ...p, source: e.target.value }))}>
              <option value="">Selecione...</option><option value="Indicação">Indicação</option><option value="Instagram">Instagram</option><option value="Facebook">Facebook</option><option value="Google">Google</option><option value="Outro">Outro</option>
            </select>
          </div>

          <div className="md:col-span-2 space-y-2">
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">PONTUAR CLIENTE</label>
            <div className="flex gap-2">
              <div className="flex-1 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-[15px] h-11 flex items-center px-4 focus-within:ring-2 focus-within:ring-primary-500/20 transition-all">
                <input
                  type="number"
                  placeholder="Quantidade..."
                  value={pointsInput}
                  onChange={e => setPointsInput(e.target.value)}
                  className="w-full bg-transparent text-sm font-bold outline-none text-gray-700 dark:text-gray-300"
                />
              </div>
              <Button
                onClick={() => addManualPoints(parseInt(pointsInput) || 0)}
                className="px-4 bg-gray-900 dark:bg-gray-800 text-white font-black text-[10px] uppercase rounded-[12px] hover:scale-105 active:scale-95 transition-all shadow-lg shadow-gray-900/10"
              >
                PONTUAR
              </Button>
              <Button
                onClick={addDefaultPoints}
                className="px-4 bg-primary-500 text-white font-black text-[10px] uppercase rounded-[12px] flex items-center gap-2 hover:scale-105 active:scale-95 transition-all shadow-lg shadow-primary-500/20"
              >
                <Star className="w-3 h-3 fill-white" /> + PONTO
              </Button>
            </div>
          </div>
        </div>
      </Card>

      <Card className="p-8 border border-gray-200 dark:border-gray-800 w-full rounded-[24px]">
        <h3 className="text-sm font-black uppercase tracking-widest flex items-center justify-between mb-8">
          <span className="flex items-center gap-2"><Star className="w-5 h-5 text-gray-400" /> Indicadores</span>
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-gray-50 dark:bg-gray-800 rounded-2xl p-4 border border-gray-200 flex flex-col items-center">
            <p className="text-[10px] font-black text-gray-400 uppercase mb-1">Pontos</p>
            <div className="flex items-center gap-1">
              <input type="number" value={Number(formData.pointsBalance || 0)} onChange={e => setFormData(p => ({ ...p, pointsBalance: parseInt(e.target.value) || 0 }))} className="w-16 bg-transparent border-b outline-none text-2xl font-black text-center" />
              <span className="text-[10px] font-black text-gray-400">Pts</span>
            </div>
          </div>
          <div className="bg-gray-50 dark:bg-gray-800 rounded-2xl p-4 border border-gray-200 flex flex-col items-center">
            <p className="text-[10px] font-black text-gray-400 uppercase mb-1">Ticket Médio</p>
            <p className="text-2xl font-black">¥ {Number(formData.averageTicket || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
          </div>
          <div className="bg-gray-50 dark:bg-gray-800 rounded-2xl p-4 border border-gray-200 flex flex-col items-center">
            <p className="text-[10px] font-black text-gray-400 uppercase mb-1">Movimentações</p>
            <p className="text-2xl font-black">{formData.attendanceCount || 0}</p>
          </div>
        </div>
      </Card>

      <Card className="p-8 border border-gray-200 dark:border-gray-800 w-full rounded-[24px]">
        <h3 className="text-sm font-black uppercase tracking-widest flex items-center gap-2 mb-8"><BarChart3 className="w-5 h-5 text-gray-400" /> Perfil Estratégico</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="p-6 bg-gray-50 dark:bg-gray-800/50 rounded-[20px] border border-gray-100 space-y-4">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Tags</label>
              <button onClick={() => setTagModal(true)} className="text-[9px] font-black text-white bg-gray-600 px-2.5 py-1 rounded-[6px] uppercase">+ Nova</button>
            </div>
            <div className="flex flex-wrap gap-2 min-h-[46px] p-3 bg-white dark:bg-gray-900 border border-gray-200 rounded-[12px]">
              {(!formData.tags || formData.tags.length === 0) ? <div className="w-full text-center text-[10px] font-bold text-gray-400">Vazio</div> : formData.tags.map(t => <span key={t} onClick={() => toggleTagSelection(t)} className="px-2.5 py-1 rounded-[8px] text-[10px] font-black uppercase border cursor-pointer hover:bg-gray-50"><Check className="w-2.5 h-2.5 mr-1 inline" />{t}</span>)}
            </div>
            <div className="relative">
              <div onClick={() => setIsTagSelectOpen(!isTagSelectOpen)} className="w-full h-10 px-4 flex items-center justify-between bg-white dark:bg-gray-900 border border-gray-200 rounded-[12px] cursor-pointer text-[10px] font-black text-gray-400 uppercase">Selecionar ▾</div>
              {isTagSelectOpen && <div className="absolute z-20 top-full left-0 right-0 mt-2 p-4 bg-white dark:bg-gray-800 border border-gray-200 rounded-[20px] shadow-2xl max-h-[250px] overflow-y-auto">
                {['Comportamento', 'Perfil', 'Serviço / Interesse', 'Relacionamento', 'Outro'].map(cat => {
                  const items = availableTags.filter(t => t.category === cat && !formData.tags?.includes(t.name));
                  if (!items.length) return null;
                  return <div key={cat} className="mb-4 last:mb-0"><p className="text-[9px] font-black text-gray-400 uppercase mb-2 ml-1">{cat}</p><div className="flex flex-wrap gap-2">{items.map(tag => <span key={tag.id} onClick={() => { toggleTagSelection(tag.name); setIsTagSelectOpen(false); }} className={`px-2.5 py-1 rounded-[8px] text-[10px] font-black uppercase border cursor-pointer ${tag.color} opacity-60 hover:opacity-100`}>{tag.name}</span>)}</div></div>
                })}
              </div>}
            </div>
          </div>
          <div className="p-6 bg-gray-50 dark:bg-gray-800/50 rounded-[20px] border border-gray-100 flex flex-col">
            <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-4">Notas</label>
            <textarea placeholder="..." value={formData.notes || ''} onChange={e => setFormData(p => ({ ...p, notes: e.target.value }))} className="w-full flex-grow h-32 p-4 bg-white dark:bg-gray-900 border border-gray-200 rounded-[15px] text-sm outline-none resize-none" />
          </div>
        </div>

        <div className="mt-8 p-6 bg-gray-50 dark:bg-gray-800/50 rounded-[20px] border border-gray-100">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2 text-gray-500 font-black text-[10px] uppercase tracking-widest"><Bell className="w-4 h-4" /> Lembretes Ativos</div>
            <Badge color="gray" className="text-[10px] font-black">{reminders.length} / 3</Badge>
          </div>

          <div className="space-y-4 mb-8">
            {reminders.length === 0 ? (
              <div className="py-8 text-center bg-white dark:bg-gray-900 border border-dashed border-gray-200 dark:border-gray-700 rounded-[18px]">
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Nenhum lembrete agendado</p>
              </div>
            ) : (
              reminders.map((r: any) => (
                <div key={r.id} className="flex items-center justify-between p-4 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-[18px] shadow-sm group">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[10px] font-black text-amber-600 bg-amber-50 dark:bg-amber-900/30 px-2 py-0.5 rounded-md">
                        {new Date(r.reminder_date).toLocaleDateString('pt-BR')} às {r.reminder_time.substring(0, 5)}
                      </span>
                    </div>
                    <p className="text-xs font-bold text-gray-700 dark:text-gray-300">{r.reminder_text}</p>
                  </div>
                  <button onClick={() => deleteReminder(r.id)} className="p-2 text-gray-400 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-all">✕</button>
                </div>
              ))
            )}
          </div>

          {selectedContact && (
            <div className={`p-4 rounded-[20px] border transition-all duration-300 ${reminders.length >= 3 ? 'bg-amber-50/50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-800' : 'bg-white/50 dark:bg-gray-900/20 border-gray-100 dark:border-gray-800'}`}>
              <div className="flex items-center justify-between mb-5">
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Agendar Novo Lembrete</p>
                {reminders.length >= 3 && (
                  <Badge color="yellow" className="text-[8px] border-amber-500 text-amber-600 bg-amber-50">LIMITE ATINGIDO</Badge>
                )}
              </div>

              <div className={`space-y-5 transition-opacity duration-300 ${reminders.length >= 3 ? 'opacity-50 pointer-events-none' : 'opacity-100'}`}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5 items-end">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">DATA</label>
                    <div className="bg-gray-50 dark:bg-gray-800 border border-gray-200 rounded-[15px] h-11 flex items-center px-4">
                      <input type="date" value={newReminder.date} onChange={e => setNewReminder(p => ({ ...p, date: e.target.value }))} className="w-full bg-transparent text-sm font-bold outline-none" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">HORÁRIO</label>
                    <ComboboxTime value={newReminder.time} onChange={(t: string) => setNewReminder(p => ({ ...p, time: t }))} placeholder="00:00" />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">MOTIVO DO LEMBRETE</label>
                  <div className="flex gap-3">
                    <div className="flex-1 bg-gray-50 dark:bg-gray-800 border border-gray-200 rounded-[15px] h-11 flex items-center px-4">
                      <input type="text" placeholder="..." value={newReminder.text} onChange={e => setNewReminder(p => ({ ...p, text: e.target.value }))} className="w-full bg-transparent text-sm font-bold outline-none" />
                    </div>
                    <Button
                      onClick={addReminder}
                      disabled={reminders.length >= 3}
                      className="h-11 px-6 bg-gray-900 text-white font-black uppercase text-[10px] rounded-[15px] disabled:bg-gray-300"
                    >
                      OK
                    </Button>
                  </div>
                </div>
              </div>

              {reminders.length >= 3 && (
                <p className="text-[9px] font-bold text-amber-600 mt-4 text-center">
                  Máximo de 3 lembretes pendentes. Exclua um para agendar novo.
                </p>
              )}
            </div>
          )}

          {!selectedContact && (
            <p className="text-center py-4 text-[10px] font-bold text-gray-400 uppercase">Crie o cadastro primeiro para agendar lembretes.</p>
          )}
        </div>
      </Card>

      {selectedContact && (
        <Card className="p-8 border border-gray-200 dark:border-gray-800 w-full rounded-[24px]">
          <h3 className="text-sm font-black uppercase tracking-widest flex items-center justify-between mb-8">
            <span className="flex items-center gap-2"><FileText className="w-5 h-5 text-gray-400" /> Movimentação</span>
            <Button onClick={() => setServiceModal(true)} className="h-8 px-4 text-[10px] bg-primary-500 text-white font-black uppercase rounded-[10px] shadow-lg shadow-primary-500/20 hover:scale-105 active:scale-95 transition-all">+ Novo</Button>
          </h3>
          <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
            {!serviceHistory.length ? (
              <div className="p-8 text-center bg-gray-50 dark:bg-gray-800 rounded-[20px] border border-gray-100">
                <p className="text-xs font-black text-gray-400 uppercase">Nenhum atendimento.</p>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {serviceHistory.map(r => (
                  <div key={r.id} className="group px-4 py-3 bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800/50 rounded-[15px] border border-gray-100 dark:border-gray-800 flex items-center gap-4 transition-all shadow-sm">
                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-tighter bg-gray-50 dark:bg-gray-800 px-2 py-1 rounded-md shrink-0 ring-1 ring-gray-100 dark:ring-gray-700">
                      {new Date(r.service_date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                    </span>
                    <p className="font-bold text-sm text-gray-700 dark:text-gray-300 flex-1 truncate" title={r.service_name}>
                      {r.service_name}
                    </p>
                    <div className="flex items-center gap-3 shrink-0">
                      {r.payment_method && (
                        <span className="text-[9px] font-black text-gray-400 uppercase bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded-md">
                          {r.payment_method}
                        </span>
                      )}
                      <p className="font-black text-sm text-gray-900 dark:text-white">
                        ¥ {Math.floor(Number(r.amount)).toLocaleString('ja-JP')}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {historyPagination.last_page > 1 && (
              <div className="mt-6 flex items-center justify-between border-t border-gray-100 dark:border-gray-800 pt-4 px-2">
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                  Página {historyPagination.current_page} de {historyPagination.last_page}
                </p>
                <div className="flex gap-2">
                  <button
                    disabled={historyPagination.current_page === 1}
                    onClick={() => selectedContact?.id && loadHistory(selectedContact.id, historyPagination.current_page - 1)}
                    className="px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest bg-gray-50 dark:bg-gray-800 text-gray-500 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                  >
                    Anterior
                  </button>
                  <button
                    disabled={historyPagination.current_page === historyPagination.last_page}
                    onClick={() => selectedContact?.id && loadHistory(selectedContact.id, historyPagination.current_page + 1)}
                    className="px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest bg-gray-900 text-white disabled:opacity-30 disabled:cursor-not-allowed hover:bg-black transition-colors"
                  >
                    Próximo
                  </button>
                </div>
              </div>
            )}
          </div>
        </Card>
      )}

      <div className="w-full pt-8 pb-12 border-t border-gray-100 dark:border-gray-800">
        <Button
          onClick={() => onSave(formData)}
          className="w-full h-16 bg-primary-500 text-white shadow-2xl shadow-primary-500/30 font-black text-lg uppercase tracking-[0.2em] rounded-[20px] hover:scale-[1.01] active:scale-[0.99] transition-all"
        >
          {selectedContact ? 'Gravar Alterações do Cliente' : 'Finalizar e Criar Cadastro'}
        </Button>
      </div>

      {systemModal.isOpen && <StatusModal isOpen={systemModal.isOpen} title={systemModal.title} message={systemModal.message} type={systemModal.type} onClose={() => setSystemModal(p => ({ ...p, isOpen: false }))} theme="accent" />}
      {tagModal && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"><Card className="w-full max-w-sm p-8 bg-white dark:bg-gray-900 rounded-[24px] relative"><button onClick={() => setTagModal(false)} className="absolute top-5 right-5 p-2 text-gray-400">✕</button><h2 className="text-xl font-black mb-6">Nova Tag</h2><div className="space-y-5"><Input label="Nome" value={newTagForm.name} onChange={e => setNewTagForm(p => ({ ...p, name: e.target.value.replace(/(?:^|\s)\S/g, a => a.toUpperCase()) }))} /><Button onClick={createTag} className="w-full bg-gray-900 text-white font-black uppercase text-[12px]">Criar Tag</Button></div></Card></div>}
      {serviceModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <Card className="w-full max-w-md p-0 overflow-hidden bg-white dark:bg-gray-900 rounded-[32px] border-none shadow-2xl animate-in fade-in zoom-in duration-300">
            <button onClick={() => setServiceModal(false)} className="absolute top-6 right-6 p-2 text-gray-400 hover:text-gray-600 transition-colors">✕</button>
            <div className="p-8 pb-4">
              <h2 className="text-2xl font-black tracking-tight text-gray-900 dark:text-white">Registrar Movimentação</h2>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mt-1">Lançamento manual de serviço ou produto</p>
            </div>
            <div className="p-8 pt-4 space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">SERVIÇO / PRODUTO</label>
                <div className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-[15px] h-11 flex items-center px-4">
                  <input
                    type="text"
                    placeholder="Ex: Corte de Cabelo, Pizza G..."
                    value={serviceForm.service_name}
                    onChange={e => setServiceForm(p => ({ ...p, service_name: e.target.value.replace(/(?:^|\s)\S/g, a => a.toUpperCase()) }))}
                    className="w-full bg-transparent text-sm font-bold outline-none"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="VALOR (¥)"
                  value={serviceForm.amount}
                  onChange={e => {
                    const v = e.target.value.replace(/\D/g, '');
                    setServiceForm(p => ({ ...p, amount: v ? Number(v).toLocaleString('ja-JP') : '' }));
                  }}
                />
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">DATA</label>
                  <div className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-[15px] h-11 flex items-center px-4">
                    <input
                      type="date"
                      value={serviceForm.service_date}
                      onChange={e => setServiceForm(p => ({ ...p, service_date: e.target.value }))}
                      className="w-full bg-transparent text-sm font-bold outline-none"
                    />
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">PAGAMENTO</label>
                <select
                  className="w-full h-11 px-4 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-[15px] font-bold text-sm"
                  value={serviceForm.payment_method}
                  onChange={e => setServiceForm(p => ({ ...p, payment_method: e.target.value }))}
                >
                  <option value="">Selecione...</option>
                  <option value="Dinheiro">Dinheiro</option>
                  <option value="Cartão">Cartão</option>
                  <option value="PayPay">PayPay</option>
                  <option value="Transferência">Transferência</option>
                </select>
              </div>

              <div className="pt-8 flex flex-col items-center gap-4">
                <Button
                  onClick={handleAddService}
                  className="w-full h-14 bg-gray-900 text-white font-black uppercase text-[13px] shadow-2xl shadow-gray-900/30 rounded-[18px] hover:scale-[1.02] active:scale-[0.98] transition-all"
                >
                  Registrar Movimentação
                </Button>
                <button
                  onClick={() => setServiceModal(false)}
                  className="text-[10px] font-black text-gray-400 uppercase tracking-widest hover:text-gray-600 transition-colors py-2"
                >
                  Cancelar e voltar
                </button>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};
