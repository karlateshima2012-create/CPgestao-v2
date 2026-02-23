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
  AlertCircle
} from 'lucide-react';
import { terminalService } from '../services/api';

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
  | 'REGISTER';

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
    province: ''
  });

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

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    if (token) setQrToken(token);
  }, []);

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
      setFoundCustomer(res.data);
      setMode('RESULT_CLIENT');
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
      setModal({
        isOpen: true,
        title: isAuto ? 'Ponto Adicionado!' : 'Solicitação Enviada!',
        message: isAuto
          ? `SENSACIONAL! ${res.data.points_earned} PONTO ADICIONADO COM SUCESSO!`
          : `SOLICITAÇÃO DE ${res.data.points_earned} PONTO(S) ENVIADA PARA APROVAÇÃO.`,
        type: 'success'
      });
      setMode(isAuto ? 'AUTO_SUCCESS' : 'SUCCESS');

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
      setModal({
        isOpen: true,
        title: isAuto ? 'Prêmio Resgatado!' : 'Resgate Solicitado!',
        message: isAuto
          ? (res.data.message || 'O prêmio foi processado e o saldo atualizado com sucesso!')
          : 'Sua solicitação de resgate foi enviada para o gerente. Aguarde a confirmação no balcão.',
        type: 'success'
      });
      setMode(isAuto ? 'AUTO_SUCCESS' : 'SUCCESS');
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
    if (!customerData.name) {
      setModal({
        isOpen: true,
        title: 'Campo Obrigatório',
        message: 'Por favor, digite seu nome completo.',
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
        province: customerData.province
      });
      setModal({
        isOpen: true,
        title: 'Cadastro Realizado!',
        message: res.data.message || 'Seu cadastro foi concluído com sucesso.',
        type: 'success'
      });
      handleLookup();
    } catch (error: any) {
      setModal({
        isOpen: true,
        title: 'Erro no Cadastro',
        message: error.response?.data?.message || 'Não foi possível completar seu cadastro agora.',
        type: 'error'
      });
    } finally {
      setLoading(false);
    }
  };



  const reset = () => {
    setMode('CONSULT');
    setPhone('');
    setCustomerData({ name: '', email: '', city: '', province: '' });
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
                Ver Saldo ou Cadastrar
                <ArrowRight className="w-4 h-4" />
              </Button>
            </form>

          </div>
        )}

        {mode === 'RESULT_CLIENT' && foundCustomer && (
          <div className="bg-white dark:bg-slate-900 rounded-xl p-8 shadow-xl border border-slate-100 dark:border-slate-800 relative overflow-hidden animate-fade-in space-y-6">
            <button onClick={reset} className="absolute top-6 right-6 p-2 text-slate-400 hover:text-slate-800 transition-colors bg-slate-50 rounded-full"><X className="w-4 h-4" /></button>

            <div className="text-center space-y-1">
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Cliente</h3>
              <p className="text-2xl font-bold text-slate-800 dark:text-white tracking-tight">{foundCustomer.name || 'Cliente'}</p>
            </div>

            <div className="text-center">
              <Badge className="font-semibold uppercase tracking-wide" color={foundCustomer.is_vip ? 'purple' : 'gray'}>
                {storeInfo?.levels_config && storeInfo.levels_config[foundCustomer.loyalty_level || 0]
                  ? storeInfo.levels_config[foundCustomer.loyalty_level || 0].name
                  : (foundCustomer.is_vip ? 'Cliente VIP' : 'Cliente Padrão')}
              </Badge>
            </div>

            <div className="text-center pt-4">
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Seu Saldo</h3>
              <div className="inline-flex items-baseline space-x-1">
                <span className="text-5xl font-bold text-slate-800 dark:text-white tracking-tight">{foundCustomer.points_balance}</span>
                <span className="text-sm font-medium text-slate-400">pontos</span>
              </div>
            </div>

            <div className="text-center pt-2">
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">Meta para o próximo prêmio</h3>
              <p className="text-lg font-bold text-slate-600 dark:text-slate-300">
                {storeInfo?.levels_config && storeInfo.levels_config[foundCustomer.loyalty_level || 0]
                  ? storeInfo.levels_config[foundCustomer.loyalty_level || 0].goal
                  : storeInfo.points_goal} pontos
              </p>
            </div>

            <div className="pt-6">
              {storeInfo.device_mode === 'manual' ? (
                <div className="text-center p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800">
                  <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
                    Apresente seu Cartão VIP ou informe seu telefone ao atendente para pontuar ou resgatar prêmios.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  <Button variant="secondary" onClick={() => handleAction('earn')} isLoading={loading} className="h-14 bg-slate-800 text-white hover:bg-slate-700 rounded-[15px] font-bold text-sm transition-colors">
                    <Trophy className="w-4 h-4 mr-2" /> {storeInfo.device_mode === 'auto_checkin' ? 'Check-in' : 'Solicitar Ponto'}
                  </Button>
                  <Button variant="secondary" onClick={() => handleAction('redeem')} isLoading={loading} className="h-14 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 hover:bg-slate-100 border border-slate-200 dark:border-slate-700 rounded-[15px] font-bold text-sm transition-colors">
                    <Gift className="w-4 h-4 mr-2" /> Resgatar
                  </Button>
                </div>
              )}
            </div>

            {(storeInfo?.levels_config && storeInfo.levels_config[foundCustomer.loyalty_level || 0]?.reward) || storeInfo.reward_text ? (
              <div className="pt-6 border-t border-slate-100 dark:border-slate-800 text-center space-y-2 mt-2">
                <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Prêmio</h3>
                <p className="text-base font-medium text-slate-700 dark:text-slate-300">
                  {storeInfo?.levels_config && storeInfo.levels_config[foundCustomer.loyalty_level || 0]?.reward
                    ? storeInfo.levels_config[foundCustomer.loyalty_level || 0].reward
                    : storeInfo.reward_text}
                </p>
              </div>
            ) : null}

          </div>
        )}

        {
          mode === 'REGISTER' && (
            <div className="bg-white dark:bg-slate-900 rounded-xl p-8 shadow-xl border border-slate-100 dark:border-slate-800 relative overflow-hidden animate-fade-in space-y-6">
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
                    label="Seu Nome *"
                    placeholder="Ex: João Silva"
                    value={customerData.name}
                    onChange={e => setCustomerData({ ...customerData, name: normalizeText(e.target.value) })}
                    className="h-12 rounded-[15px]"
                  />
                  <Input
                    label="E-mail (Opcional)"
                    type="email"
                    placeholder="seu@email.com"
                    value={customerData.email}
                    onChange={e => setCustomerData({ ...customerData, email: e.target.value })}
                    className="h-12 rounded-[15px]"
                  />
                  <div className="grid grid-cols-2 gap-3">
                    <Input
                      label="Cidade"
                      placeholder="Sua Cidade"
                      value={customerData.city}
                      onChange={e => setCustomerData({ ...customerData, city: normalizeText(e.target.value) })}
                      className="h-12 rounded-[15px]"
                    />
                    <Input
                      label="Província"
                      placeholder="Ex: Aichi"
                      value={customerData.province}
                      onChange={e => setCustomerData({ ...customerData, province: normalizeText(e.target.value) })}
                      className="h-12 rounded-[15px]"
                    />
                  </div>
                  <Input
                    label="Seu Telefone *"
                    placeholder="090-0000-0000"
                    value={phone}
                    onChange={e => setPhone(formatJapanesePhone(e.target.value))}
                    className="h-12 rounded-[15px] bg-slate-50 border-transparent"
                    readOnly
                  />
                </div>
                <Button
                  type="submit"
                  isLoading={loading}
                  variant="secondary"
                  className="w-full h-14 bg-slate-800 text-white hover:bg-slate-700 rounded-[15px] font-bold shadow-lg shadow-slate-900/10 transition-colors"
                  onClick={(e) => {
                    if (!customerData.name) {
                      e.preventDefault();
                      setModal({
                        isOpen: true,
                        title: 'Campos Obrigatórios',
                        message: 'Por favor, preencha seu nome e cidade.',
                        type: 'info'
                      });
                    }
                  }}
                >
                  Finalizar Cadastro
                </Button>
              </form>
            </div>
          )
        }

        {
          mode === 'SUCCESS' && (
            <div className="bg-white dark:bg-slate-900 rounded-xl p-8 shadow-xl border border-slate-100 dark:border-slate-800 text-center py-10 animate-fade-in space-y-6">
              <div className="w-24 h-24 bg-slate-50 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-12 h-12 text-slate-800 dark:text-white" />
              </div>
              <div className="space-y-1">
                <h2 className="text-2xl font-bold text-slate-800 dark:text-white tracking-tight leading-tight mb-2">Operação Concluída!</h2>
                <p className="text-sm text-slate-500 font-medium mx-auto">O saldo do cliente foi atualizado com sucesso.</p>
              </div>
              <div className="pt-4">
                <Button variant="secondary" onClick={reset} className="px-8 h-12 font-bold bg-slate-800 hover:bg-slate-700 text-white rounded-[15px] transition-colors">
                  Fechar
                </Button>
              </div>
            </div>
          )
        }

        {
          mode === 'AUTO_SUCCESS' && (
            <div className="bg-white dark:bg-slate-900 rounded-xl p-8 shadow-xl border border-slate-100 dark:border-slate-800 text-center py-10 animate-fade-in space-y-6">
              <div className="w-24 h-24 bg-emerald-50 dark:bg-emerald-900/20 rounded-full flex items-center justify-center mx-auto border-4 border-emerald-100 dark:border-emerald-800">
                <CheckCircle2 className="w-12 h-12 text-emerald-500" />
              </div>
              <div className="space-y-1">
                <h2 className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 tracking-tight leading-tight mb-2">Sucesso!</h2>
                <p className="text-sm text-slate-500 font-medium mx-auto">Sua operação foi aprovada automaticamente.</p>
              </div>
              <div className="pt-4">
                <Button variant="secondary" onClick={reset} className="px-8 h-12 font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-[15px] transition-colors">
                  Fechar
                </Button>
              </div>
            </div>
          )
        }

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
            theme="accent"
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
