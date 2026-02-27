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
import { terminalService } from '../services/api';
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

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
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

      // Se for um dispositivo PREMIUM e estiver VINCULADO, apenas preenche e consulta
      if (res.data.device_type === 'premium' && res.data.prefill_phone) {
        setPhone(res.data.prefill_phone);
        handleLookup();
      } else {
        setMode('START');
      }
    } catch (error: any) {
      const msg = error.response?.data?.error || error.response?.data?.message;
      setErrorMsg(msg);
      setMode('INVALID_DEVICE');
    }
  };


  const handleLookup = async () => {
    if (!phone) return;
    setLoading(true);
    try {
      const res = await terminalService.lookup(tenantSlug, deviceUid, phone, qrToken);
      if (res.data && res.data.customer_exists === false) {
        setMode('REGISTER');
      } else {
        setFoundCustomer(res.data);
        setMode('RESULT_CLIENT');
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
    setLoading(true);
    try {
      const res = await terminalService.earn(tenantSlug, deviceUid, phone, qrToken);
      const isAuto = res.data.auto_approved;
      setRequestId(res.data.request_id);
      if (isAuto) {
        setApprovedData({
          customer_name: foundCustomer.name,
          points_balance: res.data.new_balance,
          loyalty_level_name: foundCustomer.loyalty_level_name,
          points_goal: storeInfo?.levels_config?.[foundCustomer.loyalty_level || 0]?.goal || storeInfo.points_goal,
          tenant_name: storeInfo.name
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
    setLoading(true);
    try {
      const res = await terminalService.redeem(tenantSlug, deviceUid, phone);
      const isAuto = res.data.auto_approved;
      setRequestId(res.data.request_id);
      if (isAuto) {
        setApprovedData({
          customer_name: foundCustomer.name,
          points_balance: res.data.new_balance,
          loyalty_level_name: foundCustomer.loyalty_level_name,
          points_goal: storeInfo?.levels_config?.[foundCustomer.loyalty_level || 0]?.goal || storeInfo.points_goal,
          tenant_name: storeInfo.name
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
      setModal({
        isOpen: true,
        title: 'Cadastro Realizado!',
        message: res.data.message || 'Seu cadastro foi concluído com sucesso.',
        type: 'success'
      });
      handleLookup();
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
    setMode('CONSULT');
    setCustomerData({ name: '', email: '', city: '', province: '', postalCode: '', address: '', birthday: '' });
    setBDay('');
    setBMonth('');
    setFoundCustomer(null);
    setLoading(false);
  };

  if (mode === 'LOADING') return <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950 font-sans"><p className="text-gray-400 font-bold animate-pulse">CARREGANDO TERMINAL...</p></div>;
  if (mode === 'INVALID_DEVICE') return <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950 font-sans"><p className="text-gray-400 font-bold">{errorMsg || 'DISPOSITIVO INVÁLIDO OU NÃO ENCONTRADO'}</p></div>;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-gray-950 font-sans flex flex-col items-center pb-12">
      {/* 1. HERO SECTION */}
      <div className="w-[90%] md:w-[80%] max-w-3xl bg-white dark:bg-gray-900 shadow-lg overflow-hidden relative mb-4 animate-fade-in rounded-b-xl">
        {/* Cover Image Background */}
        <div className="h-72 md:h-80 w-full bg-gray-200 dark:bg-gray-800 relative">
          {storeInfo.cover_url ? (
            <img src={storeInfo.cover_url} alt="Cover" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full bg-gradient-to-r from-gray-700 to-gray-900" />
          )}
          {/* Enhanced gradient overlay to guarantee text readability on light or dark images */}
          <div className="absolute inset-0 bg-black/20 mix-blend-multiply"></div>
          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent"></div>
        </div>

        {/* Content over Cover Image */}
        <div className="absolute inset-0 flex flex-col justify-center p-6 z-10 text-white">
          <div className="flex items-center gap-6 md:gap-8 w-full">
            {/* Logo left aligned, larger, centered vertically with text */}
            <div className="w-24 h-24 md:w-32 md:h-32 bg-white dark:bg-gray-900 rounded-[24px] shadow-2xl flex shrink-0 items-center justify-center overflow-hidden border-2 border-white/50 bg-center bg-cover">
              {storeInfo.logo_url ? (
                <img src={storeInfo.logo_url} alt={storeInfo.tenant_name} className="w-full h-full object-cover" />
              ) : (
                <DefaultLogo className="w-full h-full" />
              )}
            </div>

            <div className="flex flex-col drop-shadow-2xl" style={{ textShadow: '0 2px 10px rgba(0,0,0,0.9), 0 1px 3px rgba(0,0,0,1)' }}>
              <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-white leading-tight">{storeInfo.name}</h1>
            </div>
          </div>
        </div>
      </div>

      <div className="w-[90%] md:w-[80%] max-w-3xl flex flex-col gap-6">
        {/* Description Below Hero */}
        <div className="w-full text-center px-4 py-8 md:py-10">
          <p className="text-sm md:text-base text-slate-600 dark:text-slate-300 font-medium leading-relaxed">
            {storeInfo.description || 'A descrição do programa de fidelidade da sua loja aparecerá aqui. Escreva um texto mostrando onde ela está, explicando as regras e benefícios aos clientes.'}
          </p>
        </div>

        {mode === 'START' && (
          <div className="flex flex-col gap-4 animate-fade-in">
            {/* Action 1: Ver Saldo */}
            <div
              onClick={() => setMode('CONSULT')}
              className="group cursor-pointer bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl rounded-xl p-4 md:p-6 shadow-xl border border-white/40 dark:border-slate-700/50 relative overflow-hidden transition-all hover:-translate-y-1 hover:shadow-2xl flex flex-col items-center justify-center space-y-2 md:space-y-3 text-center min-h-[120px] md:min-h-[140px]"
            >
              <div className="w-12 h-12 md:w-16 md:h-16 bg-white dark:bg-slate-800 rounded-xl md:rounded-[20px] flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                <Search className="w-6 h-6 md:w-8 md:h-8 text-slate-800 dark:text-white" />
              </div>
              <div>
                <h3 className="text-sm md:text-xl font-bold text-slate-800 dark:text-white mb-1">Ver Saldo</h3>
                <p className="text-[10px] md:text-sm font-medium text-slate-500 dark:text-slate-400 leading-tight">Já sou cadastrado</p>
              </div>
            </div>

            {/* Action 2: Cadastrar */}
            <div
              onClick={() => setMode('REGISTER')}
              className="group cursor-pointer bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl rounded-xl p-4 md:p-6 shadow-xl border border-white/40 dark:border-slate-700/50 relative overflow-hidden transition-all hover:-translate-y-1 hover:shadow-2xl flex flex-col items-center justify-center space-y-2 md:space-y-3 text-center min-h-[120px] md:min-h-[140px]"
            >
              <div className="w-12 h-12 md:w-16 md:h-16 bg-white dark:bg-slate-800 rounded-xl md:rounded-[20px] flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                <UserPlus className="w-6 h-6 md:w-8 md:h-8 text-slate-800 dark:text-white" />
              </div>
              <div>
                <h3 className="text-sm md:text-xl font-bold text-slate-800 dark:text-white mb-1">Cadastrar</h3>
                <p className="text-[10px] md:text-sm font-medium text-slate-500 dark:text-slate-400 leading-tight">Criar minha conta</p>
              </div>
            </div>
          </div>
        )}

        {mode === 'CONSULT' && (
          <div className="bg-white dark:bg-slate-900 rounded-xl p-8 shadow-xl border border-slate-100 dark:border-slate-800 text-center relative overflow-hidden animate-fade-in space-y-8">
            <div className="flex items-center justify-start absolute top-6 left-6">
              <button type="button" onClick={() => setMode('START')} className="p-2.5 bg-slate-50 dark:bg-slate-800 rounded-full text-slate-500 hover:bg-slate-100 transition-colors"><ChevronLeft className="w-5 h-5" /></button>
            </div>
            <h2 className="text-xl font-bold text-slate-800 dark:text-white tracking-tight mt-2">Consulte seu Saldo</h2>

            <form onSubmit={handleConsult} className="space-y-4">
              <div className="space-y-2 text-left">
                <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 pl-2">Seu Telefone</label>
                <div className="relative">
                  <Smartphone className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="tel"
                    placeholder="090-0000-0000"
                    className="w-full pl-14 pr-6 py-4 bg-slate-50 dark:bg-slate-800 border-2 border-transparent focus:border-slate-400 dark:focus:border-slate-600 rounded-[15px] text-xl font-semibold tracking-wider text-slate-900 dark:text-white outline-none transition-all text-center"
                    value={phone}
                    onChange={e => setPhone(formatJapanesePhone(e.target.value))}
                    autoFocus
                  />
                </div>
              </div>

              <Button
                type="submit"
                isLoading={loading}
                variant="secondary"
                className="w-full h-14 text-sm font-bold bg-slate-800 dark:bg-slate-700 text-white hover:bg-slate-700 dark:hover:bg-slate-600 rounded-[15px] shadow-lg shadow-slate-900/10 gap-2 mt-4 transition-colors"
              >
                Ver Saldo
                <ArrowRight className="w-4 h-4" />
              </Button>
            </form>

          </div>
        )}

        {mode === 'RESULT_CLIENT' && foundCustomer && (
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-8 shadow-2xl border border-slate-100 dark:border-slate-800 relative overflow-hidden animate-fade-in space-y-8">
            <button onClick={reset} className="absolute top-6 right-6 p-2 text-slate-400 hover:text-slate-800 transition-colors bg-slate-50 dark:bg-slate-800 rounded-full z-20"><X className="w-5 h-5" /></button>

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
                  Você está a <span className="font-black text-slate-900 dark:text-white">{Math.max(0, (storeInfo?.levels_config?.[foundCustomer.loyalty_level || 0]?.goal || storeInfo.points_goal) - foundCustomer.points_balance)}</span> pontos do seu prêmio: <span className="font-black text-slate-900 dark:text-white">{storeInfo?.levels_config && storeInfo.levels_config[foundCustomer.loyalty_level || 0]?.reward
                    ? storeInfo.levels_config[foundCustomer.loyalty_level || 0].reward
                    : storeInfo.reward_text || 'Prêmio em definição'}</span>
                </p>
                <div className="flex flex-col items-center gap-1 mt-4">
                  <div className="w-full h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-slate-800 dark:bg-blue-500 transition-all duration-1000"
                      style={{ width: `${Math.min(100, (foundCustomer.points_balance / (storeInfo?.levels_config?.[foundCustomer.loyalty_level || 0]?.goal || storeInfo.points_goal)) * 100)}%` }}
                    ></div>
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom Section: Plan Logic */}
            <div className="pt-2">
              {storeInfo.tenant_plan === PlanType.CLASSIC ? (
                <div className="text-center p-6 bg-slate-50 dark:bg-slate-800/40 rounded-[25px] border border-slate-100 dark:border-slate-800 shadow-sm">
                  <p className="text-sm font-black text-slate-800 dark:text-slate-200 tracking-tight leading-relaxed">
                    Apresente o seu cartão para pontuar.
                  </p>
                </div>
              ) : storeInfo.device_mode === 'manual' ? (
                <div className="text-center p-6 bg-slate-50 dark:bg-slate-800/40 rounded-[25px] border border-slate-100 dark:border-slate-800">
                  <p className="text-sm font-bold text-slate-500 dark:text-slate-400 italic">
                    Apresente seu Cartão VIP ou informe seu telefone ao atendente para pontuar.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-4">
                  <Button variant="secondary" onClick={() => handleAction('earn')} isLoading={loading} className="h-16 bg-blue-600 hover:bg-blue-700 text-white shadow-xl shadow-blue-600/20 rounded-2xl font-black uppercase tracking-widest text-xs transition-all">
                    <Trophy className="w-5 h-5 mr-2" /> {storeInfo.device_mode === 'auto_checkin' || storeInfo.tenant_plan === PlanType.UNLIMITED ? 'Fazer Check-in' : 'Ganhar Ponto'}
                  </Button>
                  <Button variant="secondary" onClick={() => handleAction('redeem')} isLoading={loading} className="h-16 bg-slate-900 dark:bg-slate-800 hover:bg-slate-800 text-white rounded-2xl font-black uppercase tracking-widest text-xs transition-all">
                    <Gift className="w-5 h-5 mr-2" /> Resgatar Prêmio
                  </Button>
                </div>
              )}
            </div>
          </div>
        )}
        {
          mode === 'REGISTER' && (
            <div className="bg-white dark:bg-slate-900 rounded-xl p-8 shadow-xl border border-slate-100 dark:border-slate-800 relative overflow-hidden animate-fade-in space-y-6">
              {storeInfo?.is_limit_reached ? (
                <div className="py-12 flex flex-col items-center text-center space-y-6">
                  <div className="w-20 h-20 bg-amber-50 dark:bg-amber-900/20 rounded-full flex items-center justify-center border-4 border-amber-100 dark:border-amber-900/10">
                    <AlertCircle className="w-10 h-10 text-amber-500" />
                  </div>
                  <div className="space-y-2">
                    <h2 className="text-2xl font-black text-slate-800 dark:text-white uppercase tracking-tighter">Limite Atingido</h2>
                    <p className="text-sm text-slate-500 font-medium max-w-[280px] mx-auto leading-relaxed italic">
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
                    className="w-full h-14 bg-slate-500 hover:bg-slate-600 text-white rounded-[20px] font-black uppercase tracking-widest shadow-lg shadow-slate-500/10 transition-all transform active:scale-[0.98]"
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
            <div className="bg-white dark:bg-slate-900 rounded-xl p-8 shadow-xl border border-slate-100 dark:border-slate-800 text-center py-12 animate-fade-in space-y-8">
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
          <div className="bg-white dark:bg-slate-900 rounded-xl p-8 shadow-2xl border border-slate-100 dark:border-slate-800 text-center py-10 animate-fade-in relative overflow-hidden">
            {/* Background Decorative Element */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-64 bg-green-500/5 rounded-full blur-3xl -z-10"></div>

            <div className="w-24 h-24 bg-green-50 dark:bg-green-900/20 rounded-full flex items-center justify-center mx-auto mb-6 border-4 border-green-100 dark:border-green-900/30">
              <CheckCircle2 className="w-12 h-12 text-green-500" />
            </div>

            <div className="space-y-2 mb-8">
              <h2 className="text-3xl font-black text-slate-800 dark:text-white tracking-tighter uppercase italic">🎉 Ponto Confirmado!</h2>
              <p className="text-sm font-bold text-slate-500 dark:text-slate-400">
                Parabéns, <span className="text-slate-800 dark:text-white">{approvedData.customer_name}</span>! Seu ponto foi registrado com sucesso.
              </p>
            </div>

            <div className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-6 border border-slate-100 dark:border-slate-800 space-y-6 mb-8">
              <div className="space-y-1">
                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center justify-center gap-1">
                  <Target className="w-3 h-3" /> Seu Progresso Atual
                </h3>
                <div className="flex items-baseline justify-center gap-1">
                  <span className="text-5xl font-black text-slate-800 dark:text-white tracking-tighter">{approvedData.points_balance}</span>
                  <span className="text-sm font-bold text-slate-400 uppercase">pontos</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800 flex flex-col items-center gap-1 shadow-sm">
                  <Trophy className="w-4 h-4 text-amber-500" />
                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Nível</span>
                  <span className="text-xs font-bold text-slate-800 dark:text-white">{approvedData.loyalty_level_name}</span>
                </div>
                <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800 flex flex-col items-center gap-1 shadow-sm">
                  <Gift className="w-4 h-4 text-blue-500" />
                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Faltam</span>
                  <span className="text-xs font-bold text-slate-800 dark:text-white">{Math.max(0, approvedData.points_goal - approvedData.points_balance)} pontos</span>
                </div>
              </div>

              <div className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-slate-800 dark:bg-slate-100 transition-all duration-1000"
                  style={{ width: `${Math.min(100, (approvedData.points_balance / approvedData.points_goal) * 100)}%` }}
                ></div>
              </div>

              <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 italic">
                🎁 Faltam apenas {Math.max(0, approvedData.points_goal - approvedData.points_balance)} pontos para você desbloquear o seu próximo prêmio!
              </p>
            </div>

            <p className="text-xs font-medium text-slate-400 mb-6 px-4">
              Agradecemos a sua visita na <span className="font-bold text-slate-600 dark:text-slate-300">{approvedData.tenant_name}</span>!
            </p>

            <Button variant="secondary" onClick={reset} className="w-full h-14 font-black uppercase tracking-widest bg-slate-800 hover:bg-slate-700 text-white rounded-[15px] shadow-lg shadow-slate-900/20 transition-all">
              Tirar essa tela
            </Button>
          </div>
        )}

        {
          mode === 'ERROR' && (
            <div className="bg-white dark:bg-slate-900 rounded-xl p-8 shadow-xl border border-slate-100 dark:border-slate-800 text-center py-10 animate-fade-in space-y-6">
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


    </div >
  );
};
