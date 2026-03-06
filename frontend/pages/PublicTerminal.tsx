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
  UserPlus,
  UserCheck,
  Trophy,
  X,
  AlertCircle,
  Star
} from 'lucide-react';
import { terminalService, contactsService } from '../services/api';

type TerminalMode =
  | 'START'
  | 'CONSULT'
  | 'RESULT_CLIENT'
  | 'LOJISTA_ACTIONS'
  | 'LOJISTA_QUICK_REGISTER'
  | 'SUCCESS'
  | 'AUTO_SUCCESS'
  | 'ERROR'
  | 'LOADING'
  | 'INVALID_DEVICE'
  | 'REGISTER'
  | 'PONTUAR'
  | 'VISIT_NOT_FOUND'
  | 'WAITING_APPROVAL';

interface PublicTerminalProps {
  slug?: string;
  uid?: string | null;
  contacts?: any[];
  onUpdatePoints?: (phone: string, points: number) => void;
  onQuickRegister?: (customer: any) => void;
  forceShowOwnerActions?: boolean;
}

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

export const PublicTerminal: React.FC<PublicTerminalProps> = ({
  slug: propSlug,
  uid: propUid
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
    type: 'success' | 'error' | 'info' | 'warning';
    onConfirm?: () => void;
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

  useEffect(() => {
    console.log("CP Gestao Version: 2.3.0 - Digital First");
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
      const path = window.location.pathname;
      const parts = path.split('/').filter(p => p);

      const pIdx = parts.indexOf('p');
      const tIdx = parts.indexOf('terminal');

      if (tIdx !== -1 && parts[tIdx + 1] && parts[tIdx + 2]) {
        const s = parts[tIdx + 1];
        const u = parts[tIdx + 2];
        setTenantSlug(s);
        setDeviceUid(u);
        resolveTerminal(s, u);
      } else if (pIdx !== -1 && parts[pIdx + 1]) {
        const s = parts[pIdx + 1];
        const params = new URLSearchParams(window.location.search);
        const uidParam = params.get('uid');
        setTenantSlug(s);
        setDeviceUid(uidParam);
        resolveTerminal(s, uidParam || undefined);
      } else {
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

      setMode('START');

      // Auto-trigger actions from URL
      const acao = urlParams.get('acao');
      if (acao === 'pontuar') {
        setTimeout(() => {
          const element = document.getElementById('card-pontuar');
          if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
            // Optionally auto-open the mode
            setMode('PONTUAR');
          }
        }, 500);
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
        } else if (targetToken) {
          handleEarn();
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

  const handlePontuarVisita = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!phone || phone.replace(/\D/g, '').length < 8) {
      setModal({ isOpen: true, title: 'Atenção', message: 'Informe seu telefone corretamente.', type: 'info' });
      return;
    }

    setLoading(true);
    try {
      const res = await terminalService.lookup(tenantSlug, deviceUid, phone, qrToken);
      if (res.data && res.data.customer_exists === false) {
        setMode('VISIT_NOT_FOUND');
      } else {
        setFoundCustomer(res.data);
        handleEarn();
      }
    } catch (error: any) {
      if (error.response?.status === 404) {
        setMode('VISIT_NOT_FOUND');
      } else {
        setModal({ isOpen: true, title: 'Erro', message: 'Erro ao processar visita.', type: 'error' });
      }
    } finally {
      setLoading(false);
    }
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
    if (!tenantSlug) return;
    const isAdmin = !!localStorage.getItem('auth_token');
    setLoading(true);
    try {
      const res = await terminalService.earn(tenantSlug, deviceUid, phone, qrToken);
      const isAuto = res.data.auto_approved;
      setRequestId(res.data.request_id);

      if (isAdmin && isAuto) {
        setFoundCustomer(prev => {
          if (!prev) return prev;
          return {
            ...prev,
            points_balance: res.data.new_balance,
            loyalty_level: res.data.loyalty_level ?? prev.loyalty_level,
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
      } else if (isAuto) {
        setApprovedData({
          customer_name: res.data.customer_name || foundCustomer?.name,
          points_balance: res.data.new_balance,
          loyalty_level_name: res.data.loyalty_level_name || foundCustomer?.loyalty_level_name,
          points_goal: res.data.points_goal || storeInfo?.points_goal,
          tenant_name: storeInfo?.name || 'Estabelecimento',
          is_redemption: false
        });
        setMode('AUTO_SUCCESS');
      } else {
        setMode('WAITING_APPROVAL');
      }

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

  const handleRedeem = async (confirmed = false) => {
    const isAdmin = !!localStorage.getItem('auth_token');

    if (isAdmin && !confirmed) {
      setModal({
        isOpen: true,
        title: 'Confirmar Entrega',
        message: 'Deseja confirmar a entrega do prêmio agora? O ciclo do cliente será reiniciado.',
        type: 'warning',
        onConfirm: () => handleRedeem(true)
      });
      return;
    }

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
            loyalty_level: res.data.loyalty_level ?? prev.loyalty_level,
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
      } else if (isAuto) {
        setApprovedData({
          customer_name: res.data.customer_name || foundCustomer?.name,
          points_balance: res.data.new_balance,
          loyalty_level_name: res.data.loyalty_level_name || foundCustomer?.loyalty_level_name,
          points_goal: res.data.points_goal || storeInfo?.points_goal,
          tenant_name: storeInfo?.name,
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
    if (action === 'redeem') handleRedeem(false);
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerData.name) {
      setModal({
        isOpen: true,
        title: 'Campo Obrigatório',
        message: 'Por favor, preencha seu nome completo.',
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
        setFoundCustomer(res.data);
        setMode('LOJISTA_ACTIONS');
        setModal({
          isOpen: true,
          title: 'Cadastro Realizado!',
          message: res.data.message || 'O cliente foi cadastrado e pontuado com sucesso.',
          type: 'success'
        });
      } else {
        setModal({
          isOpen: true,
          title: 'Cadastro Realizado!',
          message: res.data.message || 'Seu cadastro foi concluído com sucesso.',
          type: 'success'
        });
        setQrToken(null);
        await handleLookup();
      }
    } catch (error: any) {
      let msg = error.response?.data?.message || 'Não foi possível completar seu cadastro agora.';
      setModal({ isOpen: true, title: 'Erro no Cadastro', message: msg, type: 'error' });
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
    setQrToken(null);

    const url = new URL(window.location.href);
    url.search = '';
    window.history.replaceState({}, '', url.toString());
  };

  if (mode === 'LOADING') return <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950 font-sans"><p className="text-gray-400 font-bold animate-pulse">CARREGANDO TERMINAL...</p></div>;
  if (mode === 'INVALID_DEVICE') return <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950 font-sans"><p className="text-gray-400 font-bold">{errorMsg || 'DISPOSITIVO INVÁLIDO OU NÃO ENCONTRADO'}</p></div>;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-gray-950 font-sans flex flex-col items-center pointer-events-auto">
      <div className="w-full md:w-[85%] max-w-4xl bg-white dark:bg-slate-900 md:rounded-t-none md:rounded-b-[50px] shadow-2xl relative z-20 flex flex-col overflow-hidden animate-fade-in border-none">
        <div className="h-72 md:h-[450px] w-full bg-slate-200 dark:bg-slate-800 relative shrink-0 overflow-hidden">
          {storeInfo?.cover_url ? (
            <img src={storeInfo?.cover_url} alt="Cover" className="w-full h-full object-cover block absolute inset-0" />
          ) : (
            <div className="w-full h-full bg-gradient-to-r from-gray-700 to-gray-900" />
          )}
          <div className="absolute inset-0 bg-black/15 mix-blend-multiply"></div>
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent"></div>
        </div>

        <div className="absolute top-0 left-0 right-0 h-72 md:h-[450px] flex flex-col justify-center p-6 z-10 text-white">
          <div className="flex items-center gap-6 md:gap-8 w-full">
            <div className="w-36 h-36 md:w-56 md:h-56 rounded-[20px] shadow-[0_25px_60px_rgba(0,0,0,0.6)] flex shrink-0 items-center justify-center overflow-hidden ring-2 ring-white/25 backdrop-blur-xl bg-white/10">
              {storeInfo?.logo_url ? (
                <img src={storeInfo?.logo_url} alt={storeInfo?.name} className="w-full h-full object-cover rounded-[20px]" />
              ) : (
                <div className="w-full h-full bg-white/10 flex items-center justify-center">
                  <DefaultLogo className="w-full h-full p-8" />
                </div>
              )}
            </div>

            <div className="flex flex-col drop-shadow-2xl flex-1" style={{ textShadow: '0 4px 15px rgba(0,0,0,0.6)' }}>
              <h1 className="text-4xl md:text-6xl font-black tracking-tight text-white leading-[1.1] drop-shadow-lg">{storeInfo?.name || 'Carregando...'}</h1>
            </div>
          </div>
        </div>

        <div className="w-full text-center px-6 py-8 md:py-12">
          <p className="text-sm md:text-lg text-slate-500 dark:text-slate-400 font-semibold leading-relaxed max-w-2xl mx-auto px-4">
            {storeInfo?.description || 'Obrigado por nos visitar!'}
          </p>
        </div>

        {mode === 'START' && (
          <div className="p-6 md:p-12 animate-fade-in w-full space-y-6">
            {/* Card Grande (Destaque) - Pontuar Visita */}
            <div
              id="card-pontuar"
              onClick={() => setMode('PONTUAR')}
              className="group cursor-pointer bg-white dark:bg-slate-800/90 rounded-[32px] p-8 md:p-14 shadow-[0_25px_60px_rgba(0,0,0,0.1)] border-2 border-transparent transition-all hover:scale-[1.01] hover:border-primary-500 hover:shadow-[0_35px_70px_rgba(0,0,0,0.15)] flex flex-col items-center justify-center text-center space-y-6 relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 w-40 h-40 bg-primary-50 dark:bg-primary-900/10 rounded-full -translate-y-1/2 translate-x-1/2" />
              <div className="w-20 h-20 bg-primary-100 dark:bg-primary-500/10 rounded-2xl flex items-center justify-center shadow-inner group-hover:scale-110 transition-transform">
                <Star className="w-10 h-10 text-primary-500 group-hover:fill-current" />
              </div>
              <div className="space-y-3 relative z-10">
                <h3 className="text-3xl md:text-4xl font-black text-slate-900 dark:text-white tracking-tight">Pontuar Visita</h3>
                <p className="text-slate-500 dark:text-slate-400 text-sm md:text-base font-bold leading-tight">Já é cliente? Ganhe um ponto pela sua visita.</p>
              </div>
            </div>

            {/* 2 Cards de tamanho igual um ao lado do outro */}
            <div className="grid grid-cols-2 gap-4 md:gap-8">
              {/* Card Cadastrar no Programa */}
              <div
                onClick={() => setMode('REGISTER')}
                className="group cursor-pointer bg-white dark:bg-slate-800/80 rounded-[28px] p-6 md:p-10 shadow-[0_20px_50px_rgba(0,0,0,0.08)] border-2 border-transparent transition-all hover:-translate-y-1 hover:border-slate-300 hover:shadow-[0_40px_80px_rgba(0,0,0,0.15)] flex flex-col items-center justify-center text-center space-y-4"
              >
                <div className="w-14 h-14 bg-slate-100 dark:bg-slate-800 rounded-2xl flex items-center justify-center shadow-inner group-hover:scale-110 transition-transform">
                  <UserPlus className="w-7 h-7 text-slate-900 dark:text-white" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-lg font-black text-slate-900 dark:text-white tracking-tight">Cadastrar</h3>
                  <p className="text-[10px] md:text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Ainda não tem cadastro?</p>
                </div>
              </div>

              {/* Card Consultar Saldo */}
              <div
                onClick={() => setMode('CONSULT')}
                className="group cursor-pointer bg-white dark:bg-slate-800/80 rounded-[28px] p-6 md:p-10 shadow-[0_20px_50px_rgba(0,0,0,0.08)] border-2 border-transparent transition-all hover:-translate-y-1 hover:border-slate-300 hover:shadow-[0_40px_80px_rgba(0,0,0,0.15)] flex flex-col items-center justify-center text-center space-y-4"
              >
                <div className="w-14 h-14 bg-slate-100 dark:bg-slate-800 rounded-2xl flex items-center justify-center shadow-inner group-hover:scale-110 transition-transform">
                  <Search className="w-7 h-7 text-slate-900 dark:text-white" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-lg font-black text-slate-900 dark:text-white tracking-tight">Saldo</h3>
                  <p className="text-[10px] md:text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Ver Pontuação</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {mode === 'PONTUAR' && (
          <div className="p-6 md:p-12 text-center relative overflow-hidden animate-fade-in space-y-10 w-full min-h-[400px] flex flex-col justify-center">
            <div className="flex items-center justify-start absolute top-8 left-8">
              <button type="button" onClick={() => setMode('START')} className="p-3 bg-slate-100 dark:bg-slate-800 rounded-full text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">
                <ChevronLeft className="w-6 h-6" />
              </button>
            </div>
            <div className="space-y-3 pt-6">
              <h2 className="text-4xl font-black text-slate-900 dark:text-white tracking-tighter">Pontuar visita ⭐</h2>
              <p className="text-sm font-bold text-slate-500 dark:text-slate-400">Digite seu telefone para registrar sua visita.</p>
            </div>
            <form onSubmit={handlePontuarVisita} className="space-y-8 max-w-sm mx-auto w-full">
              <div className="relative group">
                <Smartphone className="absolute left-6 top-1/2 -translate-y-1/2 w-7 h-7 text-slate-300 group-focus-within:text-slate-900 dark:group-focus-within:text-white transition-colors" />
                <input
                  type="tel"
                  placeholder="090-0000-0000"
                  className="w-full pl-16 pr-8 py-6 bg-slate-50 dark:bg-slate-800/50 border-2 border-slate-100 dark:border-slate-800 focus:border-slate-900 dark:focus:border-white rounded-3xl text-3xl font-black tracking-widest text-slate-900 dark:text-white outline-none transition-all placeholder:text-slate-200 dark:placeholder:text-slate-700"
                  value={phone}
                  onChange={e => setPhone(formatJapanesePhone(e.target.value))}
                  autoFocus
                />
              </div>
              <Button type="submit" isLoading={loading} className="w-full h-20 text-xl font-black uppercase tracking-widest bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-[28px] shadow-[0_20px_50px_rgba(0,0,0,0.2)] transition-all active:scale-95">
                Registrar visita
              </Button>
            </form>
          </div>
        )}

        {mode === 'VISIT_NOT_FOUND' && (
          <div className="p-6 md:p-12 text-center animate-fade-in space-y-8 w-full min-h-[400px] flex flex-col justify-center items-center">
            <div className="w-24 h-24 bg-rose-50 dark:bg-rose-500/10 rounded-full flex items-center justify-center text-rose-500 animate-pulse">
              <AlertCircle className="w-12 h-12" />
            </div>
            <div className="space-y-4 max-w-md">
              <h2 className="text-3xl font-black text-slate-900 dark:text-white tracking-tighter">Telefone não encontrado.</h2>
              <p className="text-slate-500 dark:text-slate-400 font-bold leading-relaxed">
                Parece que você ainda não tem um cadastro no nosso sistema.<br />
                Cadastre-se primeiro para participar do programa de pontos.
              </p>
            </div>
            <div className="flex flex-col gap-4 w-full max-w-xs">
              <Button onClick={() => setMode('REGISTER')} className="w-full h-16 bg-primary-500 text-white rounded-2xl font-black uppercase tracking-widest shadow-lg">
                Cadastrar agora
              </Button>
              <Button variant="ghost" onClick={() => setMode('START')} className="w-full text-slate-400 font-bold uppercase text-[10px] tracking-widest">
                Tentar outro número
              </Button>
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
              <Button type="submit" isLoading={loading} className="w-full h-16 text-base font-black uppercase tracking-widest bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-2xl shadow-xl flex items-center justify-center gap-3">
                Ver meu Saldo <ArrowRight className="w-5 h-5" />
              </Button>
            </form>
          </div>
        )}

        {mode === 'RESULT_CLIENT' && foundCustomer && (
          <div className="p-6 md:p-8 relative overflow-hidden animate-fade-in space-y-8 w-full">
            <button onClick={reset} className="absolute top-6 right-6 p-2.5 bg-slate-100/80 dark:bg-slate-800/80 backdrop-blur-md text-slate-500 hover:text-slate-900 rounded-full z-20 border border-slate-200/50 shadow-sm active:scale-90"><X className="w-5 h-5" /></button>
            <div className="text-center space-y-3 pt-6">
              <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.25em]">Área do Cliente</h3>
              <p className="text-4xl md:text-5xl font-black text-slate-900 dark:text-white tracking-tighter leading-tight">{foundCustomer?.name || 'Cliente'}</p>
              <div className="inline-flex items-center gap-2 px-5 py-2 rounded-xl border-2 bg-slate-50 border-slate-100 text-slate-700">
                <span className="text-[13px] font-black uppercase tracking-widest text-center">{foundCustomer.loyalty_level_name || 'Bronze'}</span>
              </div>
            </div>
            <div className="bg-white dark:bg-slate-800 rounded-[30px] p-8 text-slate-900 dark:text-white border border-slate-100 dark:border-slate-800 shadow-xl relative overflow-hidden">
              <div className="text-center space-y-2">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">Saldo Disponível</p>
                <div className="flex items-baseline justify-center gap-2">
                  <span className="text-7xl font-black tracking-tighter tabular-nums text-slate-900 dark:text-white">{foundCustomer?.points_balance}</span>
                  <span className="text-2xl font-black text-slate-300 dark:text-slate-600">/ {Number(foundCustomer?.points_goal || storeInfo?.points_goal)}</span>
                </div>
              </div>
            </div>
            <Button onClick={reset} className="w-full h-16 font-black uppercase bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-2xl shadow-xl flex items-center justify-center gap-3">
              <X className="w-5 h-5" /> Fechar e Sair
            </Button>
          </div>
        )}

        {mode === 'LOJISTA_ACTIONS' && foundCustomer && (() => {
          const balance = Number(foundCustomer.points_balance || 0);
          const goal = Number(foundCustomer.points_goal || storeInfo?.points_goal || 10);
          const canRedeem = balance >= goal;
          return (
            <div className="p-6 md:p-10 text-center animate-fade-in space-y-8 w-full">
              <div className="space-y-4">
                <div className="w-20 h-20 bg-slate-100 dark:bg-slate-800 rounded-3xl flex items-center justify-center mx-auto shadow-inner"><UserCheck className="w-10 h-10 text-slate-900 dark:text-white" /></div>
                <div className="space-y-1">
                  <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Atendimento ao Cliente</h3>
                  <h2 className="text-3xl font-black text-slate-900 dark:text-white tracking-tighter">{foundCustomer?.name}</h2>
                  <p className="text-sm font-bold text-slate-500">{foundCustomer?.phone}</p>
                </div>
              </div>
              <div className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-6 space-y-1">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Saldo Atual</p>
                <p className="text-5xl font-black tracking-tighter text-slate-900 dark:text-white">{balance} <span className="text-xl text-slate-300">/ {goal}</span></p>
              </div>
              <div className="flex flex-col gap-4">
                <Button onClick={() => handleAction(canRedeem ? 'redeem' : 'earn')} isLoading={loading} className={`h-20 ${canRedeem ? 'bg-amber-500' : 'bg-primary-500'} text-white rounded-2xl font-black uppercase text-lg shadow-xl`}>
                  {canRedeem ? 'RESGATAR PRÊMIO' : 'DANÇAR PONTO'}
                </Button>
                <Button variant="ghost" onClick={reset} className="h-12 text-slate-400 font-bold uppercase text-xs">CANCELAR</Button>
              </div>
            </div>
          );
        })()}

        {mode === 'LOJISTA_QUICK_REGISTER' && (
          <div className="p-6 md:p-10 text-center animate-fade-in space-y-8 w-full">
            <h2 className="text-2xl font-black uppercase tracking-tighter">Cadastro Rápido</h2>
            <form onSubmit={handleRegister} className="space-y-4 text-left">
              <Input label="Nome Completo *" value={customerData.name} onChange={e => setCustomerData({ ...customerData, name: normalizeText(e.target.value) })} required />
              <Input label="Telefone" value={phone} disabled />
              <div className="grid grid-cols-2 gap-4">
                <Input label="Província *" value={customerData.province} onChange={e => setCustomerData({ ...customerData, province: normalizeText(e.target.value) })} required />
                <Input label="Cidade *" value={customerData.city} onChange={e => setCustomerData({ ...customerData, city: normalizeText(e.target.value) })} required />
              </div>
              <Button type="submit" isLoading={loading} className="w-full h-16 bg-primary-500 text-white rounded-2xl font-black uppercase">CADASTRAR E PONTUAR</Button>
              <Button variant="ghost" onClick={reset} className="w-full h-12 text-slate-400 font-bold uppercase text-xs">CANCELAR</Button>
            </form>
          </div>
        )}

        {mode === 'REGISTER' && (
          <div className="p-6 md:p-8 relative overflow-hidden animate-fade-in space-y-6 w-full">
            <form onSubmit={handleRegister} className="space-y-6">
              <div className="flex items-center justify-start"><button type="button" onClick={() => setMode('START')} className="p-2.5 bg-slate-50 rounded-full text-slate-500"><ChevronLeft className="w-5 h-5" /></button></div>
              <div className="space-y-1 text-center"><h2 className="text-xl font-bold tracking-tight">Criar Cadastro</h2><p className="text-sm text-slate-500 font-medium">Preencha seus dados para ganhar seu primeiro ponto!</p></div>
              <div className="space-y-4">
                <Input label="Nome Completo *" value={customerData.name} onChange={e => setCustomerData({ ...customerData, name: normalizeText(e.target.value) })} required />
                <div className="grid grid-cols-2 gap-3">
                  <Input label="Seu Telefone *" value={phone} onChange={e => setPhone(formatJapanesePhone(e.target.value))} required />
                  <Input label="Cidade *" value={customerData.city} onChange={e => setCustomerData({ ...customerData, city: normalizeText(e.target.value) })} required />
                </div>
                <Input label="Província *" value={customerData.province} onChange={e => setCustomerData({ ...customerData, province: normalizeText(e.target.value) })} required />
              </div>
              <Button type="submit" isLoading={loading} className="w-full h-16 bg-slate-900 text-white rounded-[25px] font-black uppercase">CADASTRAR</Button>
            </form>
          </div>
        )}

        {mode === 'WAITING_APPROVAL' && (
          <div className="p-6 md:p-8 text-center py-12 animate-fade-in space-y-8 w-full">
            <div className="relative mx-auto w-24 h-24 flex items-center justify-center bg-blue-50 rounded-full border-4 border-blue-100">
              <Smartphone className="w-10 h-10 text-blue-500 animate-bounce" />
            </div>
            <div className="space-y-4">
              <h2 className="text-4xl font-black uppercase tracking-tighter text-slate-900 dark:text-white">Visita registrada ✅</h2>
              <p className="text-base text-slate-600 dark:text-slate-400 font-bold max-w-[320px] mx-auto leading-relaxed italic">
                Sua pontuação será confirmada pelo lojista em instantes.
              </p>
            </div>
            <div className="pt-8 w-full max-w-xs mx-auto">
              <Button onClick={reset} className="w-full h-16 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-2xl font-black uppercase tracking-widest transition-all active:scale-95 shadow-lg">
                Ok, entendi
              </Button>
            </div>
          </div>
        )}

        {(mode === 'SUCCESS' || mode === 'AUTO_SUCCESS') && approvedData && (
          <div className="p-6 md:p-8 text-center py-10 animate-fade-in w-full">
            <div className="w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-6 bg-green-50 border-4 border-green-100">
              <CheckCircle2 className="w-12 h-12 text-green-500" />
            </div>
            <h2 className="text-4xl font-black tracking-tighter uppercase text-slate-900 dark:text-white leading-tight">PONTO ADICIONADO COM SUCESSO ⭐</h2>
            <div className="bg-slate-50 dark:bg-slate-800/50 rounded-3xl p-8 mb-8 border-2 border-slate-100 dark:border-slate-800 shadow-inner">
              <p className="text-[11px] font-black uppercase text-slate-400 dark:text-slate-500 mb-2 tracking-widest">Obrigado pela visita!</p>
              <p className="text-[10px] font-black uppercase text-slate-300 dark:text-slate-600 mb-1">Novo Saldo</p>
              <p className="text-8xl font-black text-slate-900 dark:text-white tracking-tighter">{approvedData.points_balance} <span className="text-3xl text-slate-300 dark:text-slate-700">/ {approvedData.points_goal}</span></p>
            </div>
            <Button onClick={reset} className="w-full h-16 font-black uppercase bg-slate-900 text-white rounded-2xl">Voltar ao Início</Button>
          </div>
        )}
      </div>

      <div className="w-full md:w-[80%] max-w-3xl flex flex-col items-center pb-8 p-4">
        <p className="text-[10px] font-black text-gray-300 uppercase tracking-widest">CP System &copy; 2026</p>
      </div>

      {modal.isOpen && <StatusModal isOpen={modal.isOpen} title={modal.title} message={modal.message} type={modal.type} theme="neutral" confirmLabel="OK" onClose={() => setModal(prev => ({ ...prev, isOpen: false }))} />}
    </div >
  );
};

export default PublicTerminal;
