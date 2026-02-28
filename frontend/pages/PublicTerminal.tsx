import React, { useState, useEffect } from 'react';
import { Card, Button, Input, Badge, StatusModal } from '../components/ui';
import {
  Smartphone,
  CheckCircle2,
  XCircle,
  ArrowRight,
  Gift,
  Search,
  ChevronLeft,
  Settings,
  Lock,
  LockOpen,
  UserPlus,
  UserCheck,
  Trophy,
  Target,
  ShieldCheck,
  X,
  AlertCircle,
  Calendar,
  MapPin
} from 'lucide-react';
import { terminalService, contactsService } from '../services/api';
import { PlanType } from '../types';

const DefaultLogo: React.FC<{ className?: string }> = ({ className = "w-32 h-32" }) => (
  <div className={`grid grid-cols-4 grid-rows-4 gap-[8%] bg-white dark:bg-gray-800 p-6 rounded-[15px] shadow-inner ${className}`}>
    <div className="col-span-2 row-span-2 bg-gray-200 dark:bg-gray-700 rounded-[15%]"></div>
    <div className="col-start-3 row-start-1 col-span-1 row-span-1 bg-gray-300 dark:bg-gray-600 rounded-[15%]"></div>
    <div className="col-start-3 row-start-2 col-span-1 row-span-1 bg-gray-400 dark:bg-gray-500 rounded-[15%]"></div>
    <div className="col-start-4 row-start-2 col-span-1 row-span-1 bg-gray-200 dark:bg-gray-700 rounded-[15%]"></div>
    <div className="col-span-2 row-span-2 bg-gray-400 dark:bg-gray-500 rounded-[15%]"></div>
    <div className="col-span-2 row-span-2 bg-gray-300 dark:bg-gray-600 rounded-[15%]"></div>
  </div>
);

type TerminalMode =
  | 'START'
  | 'CONSULT'
  | 'RESULT_CLIENT'
  | 'RESULT_OPERATOR_ACTION'
  | 'LOJISTA_SEARCH'
  | 'LOJISTA_ACTIONS'
  | 'LOJISTA_NEW_CUSTOMER'
  | 'LOJISTA_QUICK_REGISTER'
  | 'LOJISTA_CARD_PROMPT'
  | 'LOJISTA_CARD_LINK_SEARCH'
  | 'SUCCESS'
  | 'AUTO_SUCCESS'
  | 'ERROR'
  | 'LOADING'
  | 'INVALID_DEVICE'
  | 'REGISTER'
  | 'WAITING_APPROVAL';

interface PublicTerminalProps {
  slug?: string;
  uid?: string | null;
  contacts?: any[];
  onUpdatePoints?: (phone: string, points: number) => void;
  onQuickRegister?: (customer: any) => void;
  forceShowOwnerActions?: boolean;
}



export const PublicTerminal: React.FC<PublicTerminalProps> = ({
  slug: propSlug,
  uid: propUid,
  forceShowOwnerActions
}) => {
  const [mode, setMode] = useState<TerminalMode>('LOADING');
  const [phone, setPhone] = useState('');
  const [customerData, setCustomerData] = useState({
    name: '',
    email: '',
    city: '',
    province: '',
    postalCode: '',
    address: '',
    birthday: ''
  });
  const [bDay, setBDay] = useState('');
  const [bMonth, setBMonth] = useState('');

  useEffect(() => {
    if (bDay && bMonth) {
      const monthMap: { [key: string]: string } = {
        'Janeiro': '01', 'Fevereiro': '02', 'Março': '03', 'Abril': '04',
        'Maio': '05', 'Junho': '06', 'Julho': '07', 'Agosto': '08',
        'Setembro': '09', 'Outubro': '10', 'Novembro': '11', 'Dezembro': '12'
      };
      const mVal = monthMap[bMonth] || bMonth.padStart(2, '0');
      setCustomerData(p => ({ ...p, birthday: `2000-${mVal}-${bDay.padStart(2, '0')}` }));
    }
  }, [bDay, bMonth]);

  const [loading, setLoading] = useState(false);
  const [modal, setModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    type: 'success' | 'error' | 'info';
  }>({
    isOpen: false,
    title: '',
    message: '',
    type: 'info'
  });
  const [foundCustomer, setFoundCustomer] = useState<any>(null);
  const [storeInfo, setStoreInfo] = useState<any>(null);
  const [deviceUid, setDeviceUid] = useState<string | null>(null);
  const [qrToken, setQrToken] = useState<string | null>(null);
  const [tenantSlug, setTenantSlug] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [requestId, setRequestId] = useState<string | null>(null);
  const [approvedData, setApprovedData] = useState<any>(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);

  useEffect(() => {
    if (mode === 'LOJISTA_CARD_LINK_SEARCH' && searchTerm.length >= 2) {
      const delayDebounceFn = setTimeout(() => {
        searchCustomers();
      }, 500);
      return () => clearTimeout(delayDebounceFn);
    } else if (mode === 'LOJISTA_CARD_LINK_SEARCH' && searchTerm.length === 0) {
      setSearchResults([]);
    }
  }, [searchTerm, mode]);

  const searchCustomers = async () => {
    try {
      setLoading(true);
      const res = await contactsService.getAll({ search: searchTerm });
      setSearchResults(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    console.log("CP Gestao Version: 2.1.2 - Loyalty & Registration Fixes");
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');
    if (token) setQrToken(token);
  }, []);

  // Polling for Approval
  useEffect(() => {
    let interval: any;
    if (mode === 'WAITING_APPROVAL' && requestId && tenantSlug && deviceUid) {
      interval = setInterval(async () => {
        try {
          const res = await terminalService.getRequestStatus(tenantSlug, deviceUid, requestId);
          if (res.data.status === 'approved') {
            setApprovedData(res.data);
            setMode('SUCCESS');
            clearInterval(interval);
          } else if (res.data.status === 'rejected') {
            setModal({
              isOpen: true,
              title: 'Solicitação Recusada',
              message: 'Sua solicitação não foi aprovada pelo gerente.',
              type: 'error'
            });
            setMode('RESULT_CLIENT');
            clearInterval(interval);
          }
        } catch (error) {
          console.error('Polling error:', error);
        }
      }, 3000);
    }
    return () => clearInterval(interval);
  }, [mode, requestId, tenantSlug, deviceUid]);

  const formatJapanesePhone = (val: string) => {
    const digits = val.replace(/\D/g, '').slice(0, 11);
    if (digits.length <= 3) return digits;
    if (digits.length <= 7) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
    return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
  };

  const normalizeText = (text: string) => {
    return text.toLowerCase().replace(/(^\w|\s\w)/g, m => m.toUpperCase());
  };

  useEffect(() => {
    if (propSlug) {
      setTenantSlug(propSlug);
      setDeviceUid(propUid || null);
      resolveTerminal(propSlug, propUid || undefined);
    } else {
      // URL parsing: /terminal/:slug/:uid OR /p/:slug
      const path = window.location.pathname;
      const parts = path.split('/').filter(p => p);

      if (parts[0] === 'terminal' && parts[1] && parts[2]) {
        setTenantSlug(parts[1]);
        setDeviceUid(parts[2]);
        resolveTerminal(parts[1], parts[2]);
      } else if (parts[0] === 'p' && parts[1]) {
        const params = new URLSearchParams(window.location.search);
        const uidParam = params.get('uid');
        setTenantSlug(parts[1]);
        setDeviceUid(uidParam);
        resolveTerminal(parts[1], uidParam || undefined);
      } else {
        // Fallback or development
        const params = new URLSearchParams(window.location.search);
        const s = params.get('slug') || 'loja-teste';
        const u = params.get('uid');
        setTenantSlug(s);
        setDeviceUid(u);
        resolveTerminal(s, u || undefined);
      }
    }
  }, [propSlug, propUid]);

  const resolveTerminal = async (slug: string, uid?: string | null) => {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const token = urlParams.get('token');

      const res = await terminalService.getInfo(slug, uid, token);
      setStoreInfo(res.data);

      if (token && res.data.token_valid === false) {
        setModal({
          isOpen: true,
          title: 'QR Inválido',
          message: 'Este QR Code já foi utilizado ou é inválido.',
          type: 'error'
        });
      }

      const isAdmin = !!localStorage.getItem('auth_token');

      // Se houver telefone pré-preenchido (cartão já vinculado)
      if (res.data.prefill_phone) {
        setPhone(res.data.prefill_phone);
        // Se for o lojista escaneando, vamos direto para a tela de ação do lojista
        if (isAdmin) {
          const lookupRes = await terminalService.lookup(slug, uid || null, res.data.prefill_phone, token || qrToken);
          setFoundCustomer(lookupRes.data);
          setMode('LOJISTA_ACTIONS');
        } else {
          await handleLookup(res.data.prefill_phone, slug, uid || null, token || qrToken);
        }
      } else if (res.data.device_type === 'premium' && !res.data.prefill_phone && isAdmin) {
        // Cartão não vinculado mas lido pelo lojista
        setMode('LOJISTA_CARD_PROMPT');
      } else {
        setMode('START');
      }
    } catch (error: any) {
      const msg = error.response?.data?.error || error.response?.data?.message;
      setErrorMsg(msg);
      setMode('INVALID_DEVICE');
    }
  };


  const handleLookup = async (overridePhone?: string, overrideSlug?: string, overrideUid?: string | null, overrideToken?: string | null) => {
    const targetPhone = overridePhone || phone;
    const targetSlug = overrideSlug || tenantSlug;
    const targetUid = overrideUid === undefined ? deviceUid : overrideUid;
    const targetToken = overrideToken || qrToken;

    if (!targetPhone || !targetSlug) return;
    if (overridePhone) setPhone(overridePhone);
    setLoading(true);
    try {
      const res = await terminalService.lookup(targetSlug, targetUid, targetPhone, targetToken);
      if (res.data && res.data.customer_exists === false) {
        const isAdmin = !!localStorage.getItem('auth_token');
        if (isAdmin) {
          setMode('LOJISTA_QUICK_REGISTER');
        } else {
          setMode('REGISTER');
        }
      } else {
        setFoundCustomer(res.data);
        const isAdmin = !!localStorage.getItem('auth_token');
        if (isAdmin) {
          setMode('LOJISTA_ACTIONS');
        } else {
          setMode('RESULT_CLIENT');
        }
      }
    } catch (error: any) {
      if (error.response?.status === 404) {
        setMode('REGISTER');
      } else {
        setModal({
          isOpen: true,
          title: 'Erro',
          message: error.response?.data?.message || 'Erro ao buscar cliente',
          type: 'error'
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleActionPreCheck = () => {
    if (!phone || phone.length < 8) {
      setModal({
        isOpen: true,
        title: 'Telefone Inválido',
        message: 'Por favor, insira um número de telefone válido.',
        type: 'info'
      });
      return;
    }
    handleLookup();
  };

  const handleConsult = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!phone) {
      setModal({
        isOpen: true,
        title: 'Atenção',
        message: 'Por favor, informe seu número de telefone.',
        type: 'info'
      });
      return;
    }
    if (phone.replace(/\D/g, '').length < 8) {
      setModal({
        isOpen: true,
        title: 'Telefone Inválido',
        message: 'Por favor, digite seu telefone corretamente.',
        type: 'info'
      });
      return;
    }
    handleLookup();
  };

  const handleEarn = async () => {
    const isAdmin = !!localStorage.getItem('auth_token');
    setLoading(true);
    try {
      const res = await terminalService.earn(tenantSlug, deviceUid, phone, qrToken);
      const isAuto = res.data.auto_approved;
      setRequestId(res.data.request_id);

      if (isAdmin && isAuto) {
        // Update local state so lojista sees new balance/goal status immediately
        setFoundCustomer(prev => {
          if (!prev) return prev;
          return {
            ...prev,
            points_balance: res.data.new_balance,
            loyalty_level_name: res.data.loyalty_level_name || prev.loyalty_level_name,
            points_goal: res.data.points_goal || prev.points_goal
          };
        });

        setModal({
          isOpen: true,
          title: 'Ponto Adicionado!',
          message: res.data.message || `Lançamento de ponto realizado com sucesso para ${res.data.customer_name || foundCustomer?.name}.`,
          type: 'success'
        });
        // Stay in LOJISTA_ACTIONS mode (or where it was)
      } else if (isAuto) {
        setApprovedData({
          customer_name: res.data.customer_name || foundCustomer?.name,
          points_balance: res.data.new_balance,
          loyalty_level_name: res.data.loyalty_level_name || foundCustomer?.loyalty_level_name,
          points_goal: res.data.points_goal || storeInfo.points_goal,
          tenant_name: storeInfo.name,
          is_redemption: false
        });
        setMode('AUTO_SUCCESS');
      } else {
        setMode('WAITING_APPROVAL');
      }

      // Clear token after use if it was used successfully
      if (qrToken) setQrToken(null);
    } catch (error: any) {
      setModal({
        isOpen: true,
        title: 'Erro ao Pontuar',
        message: error.response?.data?.message || 'Ocorreu um erro ao processar sua pontuação.',
        type: 'error'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRedeem = async () => {
    const isAdmin = !!localStorage.getItem('auth_token');
    setLoading(true);
    try {
      const res = await terminalService.redeem(tenantSlug, deviceUid, phone, qrToken);
      const isAuto = res.data.auto_approved;
      setRequestId(res.data.request_id);

      if (isAdmin && isAuto) {
        setFoundCustomer(prev => {
          if (!prev) return prev;
          return {
            ...prev,
            points_balance: res.data.new_balance,
            loyalty_level_name: res.data.loyalty_level_name || prev.loyalty_level_name,
            points_goal: res.data.points_goal || prev.points_goal
          };
        });

        setModal({
          isOpen: true,
          title: 'Prêmio Entregue!',
          message: res.data.message || `Resgate processado com sucesso para ${res.data.customer_name || foundCustomer?.name}.`,
          type: 'success'
        });
        // Stay in LOJISTA_ACTIONS mode
      } else if (isAuto) {
        setApprovedData({
          customer_name: res.data.customer_name || foundCustomer?.name,
          points_balance: res.data.new_balance,
          loyalty_level_name: res.data.loyalty_level_name || foundCustomer?.loyalty_level_name,
          points_goal: res.data.points_goal || storeInfo.points_goal,
          tenant_name: storeInfo.name,
          is_redemption: true
        });
        setMode('AUTO_SUCCESS');
      } else {
        setMode('WAITING_APPROVAL');
      }
    } catch (error: any) {
      setModal({
        isOpen: true,
        title: 'Erro ao Resgatar',
        message: error.response?.data?.message || 'Ocorreu um erro ao processar o resgate.',
        type: 'error'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAction = (action: 'earn' | 'redeem') => {
    if (action === 'earn') handleEarn();
    if (action === 'redeem') handleRedeem();
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerData.name || !customerData.city || !customerData.province) {
      setModal({
        isOpen: true,
        title: 'Campos Obrigatórios',
        message: 'Por favor, preencha seu nome completo, cidade e província.',
        type: 'info'
      });
      return;
    }

    setLoading(true);
    try {
      const res = await terminalService.register(tenantSlug, deviceUid, {
        name: customerData.name,
        phone: phone,
        email: customerData.email,
        city: customerData.city,
        province: customerData.province,
        postal_code: customerData.postalCode,
        address: customerData.address,
        birthday: customerData.birthday
      });
      const isAdmin = !!localStorage.getItem('auth_token');
      if (isAdmin && res.data.points_balance !== undefined) {
        setApprovedData({
          customer_name: res.data.name || customerData.name,
          points_balance: res.data.points_balance,
          loyalty_level_name: res.data.loyalty_level_name || 'Bronze',
          points_goal: storeInfo?.levels_config?.[0]?.goal || storeInfo.points_goal,
          tenant_name: storeInfo.name,
          is_redemption: false
        });
        setMode('AUTO_SUCCESS');
      } else {
        setModal({
          isOpen: true,
          title: 'Cadastro Realizado!',
          message: res.data.message || 'Seu cadastro foi concluído com sucesso.',
          type: 'success'
        });
        handleLookup();
      }
    } catch (error: any) {
      let msg = error.response?.data?.message || 'Não foi possível completar seu cadastro agora.';

      // Tradução simples de erros comuns do Laravel
      if (msg.includes('The phone field is required')) msg = 'O campo telefone é obrigatório.';
      if (msg.includes('The name field is required')) msg = 'O campo nome é obrigatório.';
      if (msg.includes('The city field is required')) msg = 'O campo cidade é obrigatório.';
      if (msg.includes('The email has already been taken')) msg = 'Este e-mail já está cadastrado.';
      if (msg.includes('The selected phone is invalid')) msg = 'O telefone informado é inválido.';

      setModal({
        isOpen: true,
        title: 'Erro no Cadastro',
        message: msg,
        type: 'error'
      });
    } finally {
      setLoading(false);
    }
  };



  const reset = () => {
    setMode('START');
    setPhone('');
    setCustomerData({ name: '', email: '', city: '', province: '', postalCode: '', address: '', birthday: '' });
    setBDay('');
    setBMonth('');
    setFoundCustomer(null);
    setLoading(false);
  };

  if (mode === 'LOADING') return <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950 font-sans"><p className="text-gray-400 font-bold animate-pulse">CARREGANDO TERMINAL...</p></div>;
  if (mode === 'INVALID_DEVICE') return <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950 font-sans"><p className="text-gray-400 font-bold">{errorMsg || 'DISPOSITIVO INVÁLIDO OU NÃO ENCONTRADO'}</p></div>;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-gray-950 font-sans flex flex-col items-center pointer-events-auto">
      {/* MAIN UNIFIED CARD - Glued to top */}
      <div className="w-full md:w-[85%] max-w-4xl bg-white dark:bg-slate-900 md:rounded-t-none md:rounded-b-[50px] shadow-2xl relative z-20 flex flex-col overflow-hidden animate-fade-in border-none">
        {/* 1. HERO SECTION - Occupying 100% of the top */}
        <div className="h-72 md:h-[450px] w-full bg-slate-200 dark:bg-slate-800 relative shrink-0 overflow-hidden">
          {storeInfo.cover_url ? (
            <img src={storeInfo.cover_url} alt="Cover" className="w-full h-full object-cover block absolute inset-0" />
          ) : (
            <div className="w-full h-full bg-gradient-to-r from-gray-700 to-gray-900" />
          )}
          {/* Subtle dark overlay and gradient for better contrast and modern look */}
          <div className="absolute inset-0 bg-black/15 mix-blend-multiply"></div>
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent"></div>
        </div>

        {/* Content over Cover Image (Absolute Overlay) */}
        <div className="absolute top-0 left-0 right-0 h-72 md:h-[450px] flex flex-col justify-center p-6 z-10 text-white">
          <div className="flex items-center gap-6 md:gap-8 w-full">
            {/* Logo - Reduced Border Radius, floating shadow */}
            <div className="w-24 h-24 md:w-36 md:h-36 bg-white dark:bg-gray-900 rounded-[22px] shadow-[0_30px_70px_rgba(0,0,0,0.4)] flex shrink-0 items-center justify-center overflow-hidden bg-center bg-cover transform -translate-y-4">
              {storeInfo.logo_url ? (
                <img src={storeInfo.logo_url} alt={storeInfo.tenant_name} className="w-full h-full object-cover rounded-[22px]" />
              ) : (
                <DefaultLogo className="w-full h-full p-4" />
              )}
            </div>

            <div className="flex flex-col drop-shadow-2xl" style={{ textShadow: '0 2px 10px rgba(0,0,0,0.5)' }}>
              <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-white leading-tight">{storeInfo.name}</h1>
            </div>
          </div>
        </div>

        {/* Description Header Inside Unified Card */}
        <div className="w-full text-center px-6 py-10 md:py-14 bg-slate-50/20 dark:bg-slate-800/10">
          <p className="text-sm md:text-lg text-slate-600 dark:text-slate-300 font-semibold leading-relaxed max-w-2xl mx-auto px-4">
            {storeInfo.description || 'A descrição do programa de fidelidade da sua loja aparecerá aqui.'}
          </p>
        </div>

        {mode === 'START' && (
          <div className="p-6 md:p-12 animate-fade-in w-full">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
              {/* Action 1: Consultar Saldo */}
              <div
                onClick={() => setMode('CONSULT')}
                className="group cursor-pointer bg-white dark:bg-slate-800/80 rounded-[22px] p-8 shadow-[0_20px_50px_rgba(0,0,0,0.12)] border-none transition-all hover:-translate-y-1 hover:shadow-[0_30px_60px_rgba(0,0,0,0.18)] flex flex-col items-center justify-center text-center space-y-4 min-h-[160px]"
              >
                <div className="w-14 h-14 bg-slate-100 dark:bg-slate-800 rounded-2xl flex items-center justify-center shadow-inner group-hover:scale-110 transition-transform">
                  <Search className="w-7 h-7 text-slate-900 dark:text-white" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-lg font-black text-slate-900 dark:text-white tracking-tight">Ver meu Saldo</h3>
                  <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em]">Consultar</p>
                </div>
              </div>

              {/* Action 2: Cadastrar */}
              <div
                onClick={() => setMode('REGISTER')}
                className="group cursor-pointer bg-white dark:bg-slate-800/80 rounded-[22px] p-8 shadow-[0_20px_50px_rgba(0,0,0,0.12)] border-none transition-all hover:-translate-y-1 hover:shadow-[0_30px_60px_rgba(0,0,0,0.18)] flex flex-col items-center justify-center text-center space-y-4 min-h-[160px]"
              >
                <div className="w-14 h-14 bg-slate-100 dark:bg-slate-800 rounded-2xl flex items-center justify-center shadow-inner group-hover:scale-110 transition-transform">
                  <UserPlus className="w-7 h-7 text-slate-900 dark:text-white" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-lg font-black text-slate-900 dark:text-white tracking-tight">Criar Cadastro</h3>
                  <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em]">Começar Agora</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {mode === 'CONSULT' && (
          <div className="p-6 md:p-10 text-center relative overflow-hidden animate-fade-in space-y-8 w-full">
            <div className="flex items-center justify-start absolute top-6 left-6">
              <button type="button" onClick={() => setMode('START')} className="p-3 bg-slate-50 dark:bg-slate-800 rounded-full text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"><ChevronLeft className="w-5 h-5" /></button>
            </div>

            <div className="pt-4 space-y-2">
              <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tighter">Consulte seu Saldo</h2>
              <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Informe seu telefone cadastrado</p>
            </div>

            <form onSubmit={handleConsult} className="space-y-6">
              <div className="space-y-2 text-left">
                <div className="relative group">
                  <Smartphone className="absolute left-6 top-1/2 -translate-y-1/2 w-6 h-6 text-slate-300 group-focus-within:text-slate-900 dark:group-focus-within:text-white transition-colors" />
                  <input
                    type="tel"
                    placeholder="090-0000-0000"
                    className="w-full pl-16 pr-8 py-5 bg-slate-50 dark:bg-slate-800/50 border-2 border-slate-100 dark:border-slate-800 focus:border-slate-900 dark:focus:border-white rounded-2xl text-2xl font-black tracking-wider text-slate-900 dark:text-white outline-none transition-all placeholder:text-slate-200 dark:placeholder:text-slate-700"
                    value={phone}
                    onChange={e => setPhone(formatJapanesePhone(e.target.value))}
                    autoFocus
                  />
                </div>
              </div>

              <Button
                type="submit"
                isLoading={loading}
                className="w-full h-16 text-base font-black uppercase tracking-widest bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:opacity-90 rounded-2xl shadow-xl shadow-slate-900/20 transition-all active:scale-95 flex items-center justify-center gap-3"
              >
                Ver meu Saldo
                <ArrowRight className="w-5 h-5" />
              </Button>
            </form>
          </div>
        )}

        {mode === 'RESULT_CLIENT' && foundCustomer && (
          <div className="p-6 md:p-8 relative overflow-hidden animate-fade-in space-y-8 w-full">
            <button
              onClick={reset}
              className="absolute top-6 right-6 p-2.5 bg-slate-100/80 dark:bg-slate-800/80 backdrop-blur-md text-slate-500 hover:text-slate-900 dark:hover:text-white transition-all rounded-full z-20 border border-slate-200/50 dark:border-slate-700/50 shadow-sm active:scale-90"
              title="Fechar"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Header: Name and Level */}
            <div className="text-center space-y-3 pt-4">
              <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Área do Cliente</h3>
              <p className="text-3xl font-black text-slate-900 dark:text-white tracking-tighter">{foundCustomer.name || 'Cliente'}</p>
              <div className={`inline-flex items-center gap-2 px-5 py-2 rounded-xl border-2 ${(foundCustomer.loyalty_level || 1) <= 1 ? 'bg-orange-50 border-orange-100 text-orange-700' :
                (foundCustomer.loyalty_level || 1) === 2 ? 'bg-slate-50 border-slate-100 text-slate-700' :
                  (foundCustomer.loyalty_level || 1) === 3 ? 'bg-yellow-50 border-yellow-100 text-yellow-700' :
                    'bg-cyan-50 border-cyan-100 text-cyan-700'
                }`}>
                <span className="text-[13px] font-black uppercase tracking-widest text-center">
                  {foundCustomer.loyalty_level_name || (
                    (foundCustomer.loyalty_level || 1) <= 1 ? '🥉 Bronze' :
                      (foundCustomer.loyalty_level || 1) === 2 ? '🥈 Prata' :
                        (foundCustomer.loyalty_level || 1) === 3 ? '🥇 Ouro' : '💎 Diamante'
                  )}
                </span>
              </div>
            </div>

            {/* Main Balance Display */}
            <div className="bg-white dark:bg-slate-800 rounded-[30px] p-8 text-slate-900 dark:text-white border border-slate-100 dark:border-slate-800 shadow-xl relative overflow-hidden group">
              <div className="relative z-10 text-center space-y-2">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">Saldo Disponível</p>
                <div className="flex items-center justify-center gap-2">
                  <span className="text-7xl font-black tracking-tighter tabular-nums text-slate-900 dark:text-white">{foundCustomer.points_balance}</span>
                  <div className="flex flex-col items-start leading-none opacity-80">
                    <span className="text-sm font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">Pontos</span>
                    <span className="text-[10px] font-medium opacity-60 text-slate-400">Acumulados</span>
                  </div>
                </div>
              </div>

              {/* Reward Progress Integration */}
              <div className="mt-8 pt-6 border-t border-slate-100 dark:border-slate-700 text-center">
                <p className="text-sm font-medium text-slate-600 dark:text-slate-300 tracking-tight leading-relaxed">
                  {(() => {
                    const levelIdx = Math.max(0, (foundCustomer.loyalty_level || 1) - 1);
                    const goal = storeInfo?.levels_config?.[levelIdx]?.goal || storeInfo.points_goal;
                    const pointsNeeded = Math.max(0, goal - foundCustomer.points_balance);
                    const reward = storeInfo?.levels_config?.[levelIdx]?.reward || storeInfo.reward_text || 'Prêmio em definição';

                    if (pointsNeeded === 0) {
                      return (
                        <div className="space-y-4 animate-bounce">
                          <span className="font-black text-amber-600 dark:text-amber-400 text-xl uppercase tracking-tighter">
                            🚀 META ATINGIDA!
                          </span>
                          <p className="text-sm font-black text-slate-700 dark:text-white uppercase">
                            Na próxima visita você resgata o seu prêmio!
                          </p>
                        </div>
                      );
                    }
                    if (pointsNeeded === 1) {
                      return (
                        <>
                          Você está a apenas <span className="font-black text-slate-900 dark:text-white">1 ponto</span> de atingir a meta do prêmio: <span className="font-black text-slate-900 dark:text-white">{reward}</span>
                        </>
                      );
                    }
                    return (
                      <>
                        Você está a <span className="font-black text-slate-900 dark:text-white">{pointsNeeded}</span> pontos do seu prêmio: <span className="font-black text-slate-900 dark:text-white">{reward}</span>
                      </>
                    );
                  })()}
                </p>
              </div>

              {(() => {
                const levelIdx = Math.max(0, (foundCustomer.loyalty_level || 1) - 1);
                const goal = storeInfo?.levels_config?.[levelIdx]?.goal || storeInfo.points_goal;
                if (foundCustomer.points_balance >= goal) {
                  return (
                    <div className="mt-8 p-6 bg-amber-500 rounded-[25px] shadow-lg shadow-amber-500/20 text-white animate-pulse">
                      <div className="flex items-center justify-center gap-3">
                        <Gift className="w-8 h-8" />
                        <span className="text-xl font-black uppercase tracking-widest">RESGATAR PRÊMIO</span>
                      </div>
                      <p className="text-[10px] font-bold mt-2 opacity-90">
                        (na próxima visita você poderá resgatar o seu prêmio)
                      </p>
                    </div>
                  );
                }
                return null;
              })()}
            </div>

            {/* Bottom Section: Simplified for Client - Only Close button */}
            <div className="pt-6">
              <Button
                onClick={reset}
                className="w-full h-16 text-base font-black uppercase tracking-widest bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-2xl shadow-xl shadow-slate-900/20 active:scale-95 flex items-center justify-center gap-3 transition-all"
              >
                <X className="w-5 h-5" />
                Fechar e Sair
              </Button>
            </div>
          </div>
        )}

        {/* LOJISTA - ATRIBUIR CARTÃO */}
        {mode === 'LOJISTA_SEARCH' && (
          <div className="p-6 md:p-10 text-center animate-fade-in space-y-8 w-full">
            <div className="pt-4 space-y-2">
              <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tighter uppercase">Vincular Novo Cartão</h2>
              <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest leading-relaxed">
                Este cartão ainda não está vinculado.<br />Informe o telefone do cliente para associar.
              </p>
            </div>

            <form onSubmit={handleConsult} className="space-y-6">
              <div className="relative group">
                <Smartphone className="absolute left-6 top-1/2 -translate-y-1/2 w-6 h-6 text-slate-300" />
                <input
                  type="tel"
                  placeholder="090-0000-0000"
                  className="w-full pl-16 pr-8 py-5 bg-slate-50 dark:bg-slate-800/50 border-2 border-slate-100 dark:border-slate-800 rounded-2xl text-2xl font-black text-slate-900 dark:text-white outline-none transition-all placeholder:text-slate-200"
                  value={phone}
                  onChange={e => setPhone(formatJapanesePhone(e.target.value))}
                  autoFocus
                />
              </div>

              <Button type="submit" isLoading={loading} className="w-full h-16 bg-slate-900 text-white rounded-2xl font-black uppercase tracking-widest">
                BUSCAR CLIENTE
              </Button>
            </form>
          </div>
        )}

        {/* LOJISTA - CONFIRMAR PONTUAÇÃO */}
        {mode === 'LOJISTA_ACTIONS' && foundCustomer && (
          <div className="p-6 md:p-10 text-center animate-fade-in space-y-8 w-full">
            <div className="space-y-4">
              <div className="w-20 h-20 bg-slate-100 dark:bg-slate-800 rounded-3xl flex items-center justify-center mx-auto shadow-inner">
                <UserCheck className="w-10 h-10 text-slate-900 dark:text-white" />
              </div>
              <div className="space-y-1">
                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Confirmar Atendimento</h3>
                <h2 className="text-3xl font-black text-slate-900 dark:text-white tracking-tighter">{foundCustomer.name}</h2>
                <p className="text-sm font-bold text-slate-500">{foundCustomer.phone}</p>
              </div>
            </div>

            <div className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-6 space-y-4">
              <div className="space-y-1">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Saldo Atual</p>
                <p className="text-4xl font-black text-slate-900 dark:text-white">{foundCustomer.points_balance} pts</p>
              </div>

              {/* Progress Bar for Lojista */}
              <div className="pt-2">
                <div className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-slate-800 dark:bg-blue-500 transition-all duration-1000"
                    style={{
                      width: `${Math.min(100, (foundCustomer.points_balance / (foundCustomer.points_goal || storeInfo?.levels_config?.[Math.max(0, (foundCustomer.loyalty_level || 1) - 1)]?.goal || storeInfo.points_goal)) * 100)}%`
                    }}
                  ></div>
                </div>
                <div className="mt-2 flex justify-between items-center">
                  <p className="text-[10px] font-bold text-slate-400 uppercase">
                    Meta: {foundCustomer.points_goal || storeInfo?.levels_config?.[Math.max(0, (Number(foundCustomer.loyalty_level) || 1) - 1)]?.goal || storeInfo.points_goal} pts
                  </p>
                  <div className="text-right">
                    {(() => {
                      const levelIdx = Math.max(0, (Number(foundCustomer.loyalty_level) || 1) - 1);
                      const goal = storeInfo?.levels_config?.[levelIdx]?.goal || storeInfo.points_goal;
                      const remaining = Math.max(0, goal - foundCustomer.points_balance);

                      if (remaining === 0) return (
                        <span className="text-[10px] font-black text-amber-600 dark:text-amber-400 uppercase animate-pulse">
                          🎉 META ATINGIDA!
                        </span>
                      );
                      if (remaining === 1) return (
                        <span className="text-[10px] font-black text-blue-600 dark:text-blue-400 uppercase">
                          🎁 Falta apenas 1 ponto!
                        </span>
                      );
                      return (
                        <span className="text-[10px] font-black text-slate-500 uppercase">
                          Faltam {remaining} pts
                        </span>
                      );
                    })()}
                  </div>
                </div>
                {(() => {
                  const levelIdx = Math.max(0, (Number(foundCustomer.loyalty_level) || 1) - 1);
                  const goal = foundCustomer.points_goal || storeInfo?.levels_config?.[levelIdx]?.goal || storeInfo.points_goal;
                  const remaining = Math.max(0, goal - foundCustomer.points_balance);
                  if (remaining === 1) return (
                    <div className="mt-3 text-[11px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-tight text-center bg-blue-50 dark:bg-blue-900/20 py-2 rounded-lg border border-blue-100 dark:border-blue-900/30">
                      🎁 O cliente está a apenas 1 ponto de atingir a meta!
                    </div>
                  );
                  if (remaining === 0) return (
                    <div className="mt-3 text-[11px] font-black text-amber-600 dark:text-amber-400 uppercase tracking-tight text-center bg-amber-50 dark:bg-amber-900/20 py-2 rounded-lg border border-amber-100 dark:border-amber-900/30 animate-bounce">
                      🚀 META ATINGIDA! O PRÊMIO PODE SER ENTREGUE AGORA!
                    </div>
                  );
                  return null;
                })()}
              </div>
            </div>

            <div className="flex flex-col gap-4">
              {(() => {
                const levelIdx = Math.max(0, (Number(foundCustomer.loyalty_level) || 1) - 1);
                const goal = foundCustomer.points_goal || storeInfo?.levels_config?.[levelIdx]?.goal || storeInfo.points_goal;
                const canRedeem = foundCustomer.points_balance >= goal;

                if (canRedeem) {
                  return (
                    <Button
                      onClick={() => handleAction('redeem')}
                      isLoading={loading}
                      className="h-24 bg-amber-500 hover:bg-amber-600 text-white rounded-2xl font-black uppercase tracking-widest text-lg shadow-xl shadow-amber-500/20 transition-all flex flex-col items-center justify-center gap-0 group"
                    >
                      <div className="flex items-center gap-2">
                        <Gift className="w-6 h-6 animate-bounce" />
                        <span>PRÊMIO ENTREGUE</span>
                      </div>
                      <span className="text-[10px] opacity-90 font-bold tracking-tight normal-case">(esta ação reiniciará o ciclo do cliente)</span>
                    </Button>
                  );
                }
                return null;
              })()}
              <Button
                onClick={() => handleAction('earn')}
                isLoading={loading}
                className="h-20 bg-green-600 hover:bg-green-700 text-white rounded-2xl font-black uppercase tracking-widest text-lg shadow-xl shadow-green-600/20 transition-all flex flex-col items-center justify-center gap-0 group"
              >
                <div className="flex items-center gap-2">
                  <Trophy className="w-6 h-6 group-hover:scale-110 transition-transform" />
                  <span>Dê +{(() => {
                    const levelIdx = Math.max(0, (foundCustomer.loyalty_level || 1) - 1);
                    return storeInfo?.levels_config?.[levelIdx]?.points_per_visit || 1;
                  })()} Pontos</span>
                </div>
                <span className="text-[10px] opacity-80 font-bold tracking-tight normal-case">Pontuação do Nível {foundCustomer.loyalty_level_name || 'Atual'}</span>
              </Button>

              <Button
                variant="ghost"
                onClick={reset}
                className="h-10 text-slate-400 font-bold uppercase tracking-widest text-[9px] hover:text-slate-600"
              >
                CANCELAR
              </Button>
            </div>

            {/* Se o lojista escaneou e o cliente não está vinculado (ou link incompleto) */}
            {deviceUid && (
              <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
                <Button
                  onClick={async () => {
                    try {
                      setLoading(true);
                      await terminalService.linkVip(tenantSlug, deviceUid, { phone, target_uid: deviceUid });
                      setModal({
                        isOpen: true,
                        title: 'Cartão Vinculado!',
                        message: 'Este cartão agora pertence a este cliente.',
                        type: 'success'
                      });
                      handleLookup();
                    } catch (err: any) {
                      setModal({
                        isOpen: true,
                        title: 'Erro ao Vincular',
                        message: err.response?.data?.message || 'Erro ao vincular cartão',
                        type: 'error'
                      });
                    } finally {
                      setLoading(false);
                    }
                  }}
                  className={`w-full h-14 rounded-2xl font-black text-xs uppercase transition-all ${foundCustomer.is_premium
                    ? "border-amber-200 text-amber-600 bg-amber-50 hover:bg-amber-100"
                    : "bg-primary-500 text-white shadow-lg shadow-primary-500/20"
                    }`}
                >
                  <ShieldCheck className="w-5 h-5 mr-3" />
                  {foundCustomer.is_premium ? "ATUALIZAR VÍNCULO DO CARTÃO" : "ATIVAR E VINCULAR CARTÃO VIP"}
                </Button>
                {foundCustomer.is_premium && (
                  <p className="text-[9px] font-bold text-amber-500 mt-2 uppercase text-center">
                    Este cliente já é VIP, mas você pode atualizar o cartão vinculado.
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {/* LOJISTA - CARTÃO NOVO DETECTADO */}
        {mode === 'LOJISTA_CARD_PROMPT' && (
          <div className="p-6 md:p-10 text-center animate-fade-in space-y-8 w-full">
            <div className="space-y-4">
              <div className="w-24 h-24 bg-amber-50 dark:bg-amber-900/20 rounded-full flex items-center justify-center mx-auto border-4 border-amber-100 dark:border-amber-900/30">
                <AlertCircle className="w-12 h-12 text-amber-500 animate-pulse" />
              </div>
              <div className="space-y-1">
                <h2 className="text-3xl font-black text-slate-900 dark:text-white tracking-tighter uppercase">Cartão Novo!</h2>
                <p className="text-sm font-bold text-slate-500 uppercase tracking-widest">Este dispositivo ainda está livre</p>
              </div>
            </div>

            <div className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-6 space-y-1 text-left">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">ID do Dispositivo</p>
              <p className="text-lg font-mono font-bold text-slate-700 dark:text-slate-300">{deviceUid}</p>
            </div>

            <div className="flex flex-col gap-4">
              <Button
                onClick={() => setMode('LOJISTA_CARD_LINK_SEARCH')}
                className="h-20 bg-slate-900 text-white rounded-2xl font-black uppercase tracking-widest text-lg shadow-xl shadow-slate-900/20 transition-all flex items-center justify-center gap-3"
              >
                <ShieldCheck className="w-6 h-6" />
                Vincular Agora
              </Button>

              <Button
                variant="ghost"
                onClick={reset}
                className="h-10 text-slate-400 font-bold uppercase tracking-widest text-xs"
              >
                MAIS TARDE
              </Button>
            </div>
          </div>
        )}

        {/* LOJISTA - BUSCAR CLIENTE PARA VINCULAR */}
        {mode === 'LOJISTA_CARD_LINK_SEARCH' && (
          <div className="p-6 md:p-10 animate-fade-in space-y-6 w-full">
            <div className="text-center space-y-2">
              <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tighter uppercase">Vincular Cartão</h2>
              <div className="inline-flex items-center px-3 py-1 bg-slate-100 dark:bg-slate-800 rounded-full">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">ID: {deviceUid}</span>
              </div>
            </div>

            <div className="space-y-4">
              <div className="relative group">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300 group-focus-within:text-primary-500 transition-colors" />
                <input
                  type="text"
                  placeholder="Buscar no CRM (Nome ou Telefone)..."
                  className="w-full pl-12 pr-4 py-4 bg-slate-50 dark:bg-slate-800/50 border-2 border-slate-100 dark:border-slate-800 rounded-2xl text-lg font-bold text-slate-900 dark:text-white outline-none focus:border-primary-500 transition-all placeholder:text-slate-300"
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  autoFocus
                />
              </div>

              <div className="max-h-[300px] overflow-y-auto space-y-2 pr-2 custom-scrollbar">
                {loading && searchResults.length === 0 && (
                  <div className="py-8 text-center text-slate-400 font-bold animate-pulse text-xs uppercase tracking-widest">
                    Buscando clientes...
                  </div>
                )}

                {searchResults.map(customer => (
                  <button
                    key={customer.id}
                    onClick={() => {
                      setSelectedCustomerId(customer.id);
                      setPhone(customer.phone); // Important for linkVip
                    }}
                    className={`w-full p-4 rounded-xl flex items-center justify-between border-2 transition-all ${selectedCustomerId === customer.id
                      ? "border-primary-500 bg-primary-50 dark:bg-primary-900/10"
                      : "border-transparent bg-slate-50 dark:bg-slate-800/30 hover:bg-slate-100"
                      }`}
                  >
                    <div className="text-left">
                      <p className={`font-black uppercase tracking-tight ${selectedCustomerId === customer.id ? 'text-primary-600' : 'text-slate-800 dark:text-white'}`}>
                        {customer.name}
                      </p>
                      <p className="text-xs font-bold text-slate-400">{customer.phone}</p>
                    </div>
                    {selectedCustomerId === customer.id && <CheckCircle2 className="w-6 h-6 text-primary-500" />}
                  </button>
                ))}

                {searchTerm.length >= 2 && !loading && searchResults.length === 0 && (
                  <div className="py-8 text-center text-slate-400 font-medium italic text-sm">
                    Nenhum cliente encontrado com "{searchTerm}"
                  </div>
                )}
              </div>

              <div className="pt-2">
                <Button
                  onClick={() => setMode('LOJISTA_QUICK_REGISTER')}
                  variant="outline"
                  className="w-full h-14 border-dashed border-2 border-slate-200 dark:border-slate-700 text-slate-500 rounded-xl font-bold text-xs uppercase hover:border-slate-400"
                >
                  <UserPlus className="w-5 h-5 mr-3" />
                  Cadastrar Cliente
                </Button>
              </div>
            </div>

            <div className="flex flex-col gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
              <Button
                disabled={!selectedCustomerId || loading}
                isLoading={loading}
                onClick={async () => {
                  try {
                    setLoading(true);
                    await terminalService.linkVip(tenantSlug, deviceUid!, { phone, target_uid: deviceUid! });
                    setModal({
                      isOpen: true,
                      title: 'Sucesso!',
                      message: 'Cartão vinculado com sucesso. Você já pode pontuar o cliente.',
                      type: 'success'
                    });
                    handleLookup(); // Refresh will take it to LOJISTA_ACTIONS
                  } catch (err: any) {
                    setModal({
                      isOpen: true,
                      title: 'Erro',
                      message: err.response?.data?.message || 'Erro ao vincular',
                      type: 'error'
                    });
                  } finally {
                    setLoading(false);
                  }
                }}
                className="w-full h-16 bg-primary-500 text-white shadow-xl shadow-primary-500/20 rounded-2xl font-black uppercase tracking-widest"
              >
                Vincular
              </Button>
              <Button
                variant="ghost"
                onClick={reset}
                className="w-full h-12 text-slate-400 font-bold uppercase tracking-widest text-xs"
              >
                CANCELAR
              </Button>
            </div>
          </div>
        )}

        {/* LOJISTA - CADASTRO RÁPIDO */}
        {mode === 'LOJISTA_QUICK_REGISTER' && (
          <div className="p-6 md:p-10 text-center animate-fade-in space-y-8 w-full">
            <div className="pt-4 space-y-2">
              <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tighter uppercase">Cadastro Rápido</h2>
              <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest leading-relaxed">
                Novo cliente? Cadastre agora para pontuar e vincular o cartão.
              </p>
            </div>

            <form onSubmit={handleRegister} className="space-y-4 text-left">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Nome Completo *</label>
                <input
                  type="text"
                  placeholder="Nome do Cliente"
                  className="w-full h-12 px-4 bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-800 rounded-xl font-bold text-slate-900 dark:text-white outline-none focus:border-primary-500 transition-all"
                  value={customerData.name}
                  onChange={e => setCustomerData({ ...customerData, name: normalizeText(e.target.value) })}
                  autoFocus
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Telefone</label>
                  <div className="w-full h-12 px-4 bg-slate-100 dark:bg-slate-800 border-transparent rounded-xl flex items-center font-black text-slate-500 dark:text-slate-400">
                    {phone}
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Província *</label>
                  <input
                    type="text"
                    placeholder="Ex: Aichi"
                    className="w-full h-12 px-4 bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-800 rounded-xl font-bold text-slate-900 dark:text-white outline-none focus:border-primary-500 transition-all"
                    value={customerData.province}
                    onChange={e => setCustomerData({ ...customerData, province: normalizeText(e.target.value) })}
                    required
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Cidade *</label>
                <input
                  type="text"
                  placeholder="Cidade"
                  className="w-full h-12 px-4 bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-800 rounded-xl font-bold text-slate-900 dark:text-white outline-none focus:border-primary-500 transition-all"
                  value={customerData.city}
                  onChange={e => setCustomerData({ ...customerData, city: normalizeText(e.target.value) })}
                  required
                />
              </div>

              <div className="pt-4 space-y-4">
                <Button
                  type="submit"
                  isLoading={loading}
                  className="w-full h-16 bg-primary-500 text-white shadow-xl shadow-primary-500/20 rounded-2xl font-black uppercase tracking-widest text-lg"
                >
                  CADASTRAR E VINCULAR
                </Button>

                <Button
                  variant="ghost"
                  onClick={reset}
                  className="w-full h-12 text-slate-400 font-bold uppercase tracking-widest text-xs"
                >
                  CANCELAR
                </Button>
              </div>
            </form>
          </div>
        )}
        {
          mode === 'REGISTER' && (
            <div className="p-6 md:p-8 relative overflow-hidden animate-fade-in space-y-6 w-full">
              {storeInfo?.is_limit_reached ? (
                <div className="py-12 flex flex-col items-center text-center space-y-6">
                  <div className="w-20 h-20 bg-amber-50 dark:bg-amber-900/20 rounded-full flex items-center justify-center border-4 border-amber-100 dark:border-amber-900/10">
                    <AlertCircle className="w-10 h-10 text-amber-500" />
                  </div>
                  <div className="space-y-2">
                    <h2 className="text-2xl font-black text-slate-800 dark:text-white uppercase tracking-tighter">Limite Atingido</h2>
                    <p className="text-sm text-slate-500 font-medium max-w-[280px] mx-auto leading-relaxed">
                      Esta loja atingiu o limite máximo de clientes cadastrados para o plano atual.
                    </p>
                    <p className="text-xs text-amber-600 font-bold uppercase tracking-widest mt-4">Por favor, informe ao proprietário.</p>
                  </div>
                  <Button onClick={() => setMode('START')} variant="secondary" className="px-8 bg-slate-100 font-bold">Voltar</Button>
                </div>
              ) : (
                <form onSubmit={handleRegister} className="space-y-6">
                  <div className="flex items-center justify-start">
                    <button type="button" onClick={() => setMode('START')} className="p-2.5 bg-slate-50 dark:bg-slate-800 rounded-full text-slate-500 hover:bg-slate-100 transition-colors"><ChevronLeft className="w-5 h-5" /></button>
                  </div>
                  <div className="space-y-1 text-center">
                    <h2 className="text-xl font-bold text-slate-800 dark:text-white tracking-tight">Criar Cadastro</h2>
                    <p className="text-sm text-slate-500 font-medium">Preencha seus dados para ganhar seu primeiro ponto!</p>
                  </div>
                  <div className="space-y-4">
                    <Input
                      label="Nome Completo *"
                      placeholder="Ex: João Silva"
                      value={customerData.name}
                      onChange={e => setCustomerData({ ...customerData, name: normalizeText(e.target.value) })}
                      className="h-12 rounded-[15px] focus:ring-slate-300"
                    />
                    <div className="grid grid-cols-2 gap-3">
                      <Input
                        label="Seu Telefone *"
                        placeholder="090-0000-0000"
                        value={phone}
                        onChange={e => setPhone(formatJapanesePhone(e.target.value))}
                        className="h-11 rounded-[15px] bg-slate-100 border-transparent font-black focus:ring-slate-300"
                      />
                      <Input
                        label="E-mail"
                        type="email"
                        placeholder="seu@email.com"
                        value={customerData.email}
                        onChange={e => setCustomerData({ ...customerData, email: e.target.value })}
                        className="h-11 rounded-[15px] focus:ring-slate-300"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1 text-slate-400">ANIVERSÁRIO (OPCIONAL)</label>
                        <div className="flex gap-2">
                          <div className="flex-1 relative">
                            <input
                              list="days"
                              placeholder="Dia"
                              className="w-full h-11 px-3 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-[15px] text-sm font-bold outline-none text-slate-600 focus:ring-2 focus:ring-slate-300 transition-all"
                              value={bDay}
                              onChange={e => {
                                const v = e.target.value.replace(/\D/g, '').slice(0, 2);
                                if (parseInt(v) > 31) return;
                                setBDay(v);
                              }}
                            />
                            <datalist id="days">
                              {Array.from({ length: 31 }, (_, i) => (i + 1).toString().padStart(2, '0')).map(d => <option key={d} value={d} />)}
                            </datalist>
                          </div>
                          <div className="flex-1 relative">
                            <input
                              list="months"
                              placeholder="Mês"
                              className="w-full h-11 px-3 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-[15px] text-sm font-bold outline-none text-slate-600 focus:ring-2 focus:ring-slate-300 transition-all"
                              value={bMonth}
                              onChange={e => setBMonth(e.target.value)}
                            />
                            <datalist id="months">
                              {['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'].map(m => <option key={m} value={m} />)}
                            </datalist>
                          </div>
                        </div>
                      </div>
                      <Input
                        label="Código Postal"
                        placeholder="000-0000"
                        value={customerData.postalCode}
                        onChange={e => setCustomerData({ ...customerData, postalCode: e.target.value })}
                        className="h-11 rounded-[15px] focus:ring-slate-300"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <Input
                        label="Província *"
                        placeholder="Ex: Aichi"
                        value={customerData.province}
                        onChange={e => setCustomerData({ ...customerData, province: normalizeText(e.target.value) })}
                        className="h-11 rounded-[15px] focus:ring-slate-300"
                      />
                      <Input
                        label="Cidade *"
                        placeholder="Sua Cidade"
                        value={customerData.city}
                        onChange={e => setCustomerData({ ...customerData, city: normalizeText(e.target.value) })}
                        className="h-11 rounded-[15px] focus:ring-slate-300"
                      />
                    </div>

                    <Input
                      label="Endereço"
                      placeholder="Nome da rua, número, apto..."
                      value={customerData.address}
                      onChange={e => setCustomerData({ ...customerData, address: normalizeText(e.target.value) })}
                      className="h-11 rounded-[15px] focus:ring-slate-300"
                    />
                  </div>
                  <Button
                    type="submit"
                    isLoading={loading}
                    variant="secondary"
                    className="w-full h-16 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-[25px] font-black uppercase tracking-widest shadow-xl shadow-slate-900/20 transition-all transform active:scale-[0.98] mt-4"
                    onClick={(e) => {
                      if (!customerData.name || !customerData.city || !customerData.province) {
                        e.preventDefault();
                        setModal({
                          isOpen: true,
                          title: 'Campos Obrigatórios',
                          message: 'Por favor, preencha os campos obrigatórios (Nome, Cidade e Província).',
                          type: 'info'
                        });
                      }
                    }}
                  >
                    CADASTRAR
                  </Button>
                </form>
              )}
            </div>
          )
        }

        {
          mode === 'WAITING_APPROVAL' && (
            <div className="p-6 md:p-8 text-center py-12 animate-fade-in space-y-8 w-full">
              <div className="relative mx-auto w-24 h-24">
                <div className="absolute inset-0 bg-blue-500/20 rounded-full animate-ping"></div>
                <div className="relative w-24 h-24 bg-blue-50 dark:bg-blue-900/20 rounded-full flex items-center justify-center border-4 border-blue-100 dark:border-blue-900/30">
                  <Smartphone className="w-10 h-10 text-blue-500 animate-bounce" />
                </div>
              </div>
              <div className="space-y-3">
                <h2 className="text-2xl font-black text-slate-800 dark:text-white uppercase tracking-tighter">Aguardando Aprovação</h2>
                <p className="text-sm text-slate-600 dark:text-slate-400 font-medium max-w-[280px] mx-auto leading-relaxed">
                  Sua solicitação foi enviada para o gerente. Confirme no balcão para ganhar seu ponto!
                </p>
              </div>
              <div className="flex justify-center gap-2">
                <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce"></div>
              </div>
            </div>
          )
        }

        {(mode === 'SUCCESS' || mode === 'AUTO_SUCCESS') && approvedData && (
          <div className="p-6 md:p-8 text-center py-10 animate-fade-in relative overflow-hidden w-full">
            {/* Background Decorative Element */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-64 bg-green-500/5 rounded-full blur-3xl -z-10"></div>

            <div className={`w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-6 border-4 ${approvedData.is_redemption || approvedData.points_balance >= approvedData.points_goal
              ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-100 dark:border-amber-900/30'
              : 'bg-green-50 dark:bg-green-900/20 border-green-100 dark:border-green-900/30'
              }`}>
              {approvedData.is_redemption || approvedData.points_balance >= approvedData.points_goal ? (
                <Gift className="w-12 h-12 text-amber-500 animate-bounce" />
              ) : (
                <CheckCircle2 className="w-12 h-12 text-green-500" />
              )}
            </div>

            <div className="space-y-2 mb-8">
              <h2 className={`text-3xl font-black tracking-tighter uppercase ${approvedData.points_balance >= approvedData.points_goal ? 'text-amber-600 dark:text-amber-400' : 'text-slate-800 dark:text-white'
                }`}>
                {approvedData.is_redemption
                  ? "🎉 PRÊMIO ENTREGUE!"
                  : approvedData.points_balance >= approvedData.points_goal
                    ? "🎁 META ATINGIDA!"
                    : "✅ PONTO CONFIRMADO!"}
              </h2>
              <p className="text-sm font-bold text-slate-500 dark:text-slate-400">
                {approvedData.is_redemption
                  ? `${approvedData.customer_name}, parabéns pelo seu prêmio! Seu ciclo foi reiniciado. Continue pontuando!`
                  : approvedData.points_balance >= approvedData.points_goal
                    ? `META ATINGIDA! Na próxima visita você resgata o seu prêmio.`
                    : `Parabéns, ${approvedData.customer_name}! Seu ponto foi registrado com sucesso.`}
              </p>
            </div>

            <div className="bg-slate-50 dark:bg-slate-800/50 rounded-3xl p-8 mb-8 border border-slate-100 dark:border-slate-800 relative z-10">
              <div className="flex flex-col items-center">
                <span className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em] mb-2">
                  {approvedData.is_redemption ? "Saldo Inicial do Novo Nível" : "Seu Novo Saldo"}
                </span>
                <div className="flex items-baseline justify-center gap-2">
                  <span className="text-7xl font-black text-slate-900 dark:text-white tabular-nums tracking-tighter">
                    {approvedData.points_balance}
                  </span>
                  <span className="text-sm font-black text-slate-400 uppercase">Pontos</span>
                </div>
              </div>

              <div className="mt-8 pt-6 border-t border-slate-200/50 dark:border-slate-700/50">
                <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-4">
                  {approvedData.is_redemption ? "📈 Próxima Meta Bloqueada" : "🎁 Progresso para o Prêmio"}
                </p>
                <div className="w-full h-3 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden mb-4">
                  <div
                    className={`h-full transition-all duration-1000 ${approvedData.is_redemption ? 'bg-amber-500' : 'bg-green-500'}`}
                    style={{ width: `${Math.min(100, (approvedData.points_balance / approvedData.points_goal) * 100)}%` }}
                  ></div>
                </div>

                <p className={`text-xs font-black uppercase tracking-tight ${approvedData.points_balance >= approvedData.points_goal ? 'text-amber-600 animate-pulse' : 'text-slate-500 dark:text-slate-400'
                  }`}>
                  {(() => {
                    const remaining = Math.max(0, approvedData.points_goal - approvedData.points_balance);
                    if (remaining === 0) return "🚀 META ATINGIDA! NA PRÓXIMA VISITA VOCÊ RESGATA O SEU PRÊMIO! 🎁";
                    if (remaining === 1) return "🎁 Você está a apenas 1 ponto de atingir a meta do prêmio!";
                    return `🎁 Faltam apenas ${remaining} pontos para você desbloquear o seu próximo prêmio!`;
                  })()}
                </p>
              </div>
            </div>

            <p className="text-xs font-medium text-slate-400 mb-6 px-4">
              {approvedData.is_redemption
                ? "Aproveite seu prêmio! Continue pontuando para ganhar mais."
                : `Agradecemos a sua visita na ${approvedData.tenant_name}!`}
            </p>

            <Button onClick={reset} className="w-full h-16 font-black uppercase tracking-widest bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-2xl shadow-xl shadow-slate-900/20 transition-all">
              Voltar ao Início
            </Button>
          </div>
        )}

        {
          mode === 'ERROR' && (
            <div className="p-6 md:p-8 text-center py-10 animate-fade-in space-y-6 w-full">
              <div className="w-24 h-24 bg-red-50 dark:bg-red-900/20 rounded-full flex items-center justify-center mx-auto">
                <XCircle className="w-12 h-12 text-red-500" />
              </div>
              <div className="space-y-4">
                <h2 className="text-xl font-bold text-slate-800 dark:text-white tracking-tight">Ocorreu um erro</h2>
                <p className="text-sm text-slate-500">Verifique os dados ou contate o atendente.</p>
                <Button variant="secondary" className="w-full h-12 rounded-[15px] font-bold bg-slate-800 hover:bg-slate-700 text-white transition-colors" onClick={() => setMode('START')}>Tentar Novamente</Button>
              </div>
            </div>
          )
        }
      </div>

      <div className="w-full md:w-[80%] max-w-3xl flex flex-col items-center pb-8">
        {/* 3. RULES SECTION */}
        <div className="w-full text-center px-4 py-8 md:py-10 animate-fade-in space-y-4">
          <h3 className="text-sm font-semibold text-slate-700 dark:text-white uppercase tracking-wide">Regras do Programa</h3>
          <ul className="text-sm text-slate-500 dark:text-slate-400 font-normal space-y-2 list-inside list-disc marker:text-slate-300">
            {storeInfo?.rules_text ? (
              storeInfo.rules_text.split('\n').map((rule: string, i: number) => rule.trim() && (
                <li key={i}>{rule}</li>
              ))
            ) : (
              <>
                <li>As regras do programa de fidelidade da sua loja aparecerão aqui.</li>
                <li>Por exemplo: A cada X compras, ganhe um brinde especial.</li>
                <li>Por exemplo: Os pontos acumulados expiram em 6 meses.</li>
              </>
            )}
          </ul>
        </div>

        <div className="mt-4 text-center flex flex-col items-center gap-6">
          <p className="text-[10px] font-black text-gray-300 dark:text-gray-600 uppercase tracking-widest">CP System &copy; 2026</p>
        </div>
      </div>

      {
        modal.isOpen && (
          <StatusModal
            isOpen={modal.isOpen}
            title={modal.title}
            message={modal.message}
            type={modal.type}
            theme="neutral"
            onClose={() => {
              setModal(prev => ({ ...prev, isOpen: false }));
              if (mode === 'SUCCESS' || mode === 'AUTO_SUCCESS') {
                reset();
              }
            }}
          />
        )
      }


    </div>
  );
};
