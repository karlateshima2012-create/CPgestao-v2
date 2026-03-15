import React, { useState, useEffect } from 'react';
import { Card, Button, Input, Badge, StatusModal } from '../components/ui';

const animationStyles = `
@keyframes starBurst {
  0% { transform: rotate(var(--star-angle)) translateY(0) scale(0.8); opacity: 1; }
  100% { transform: rotate(var(--star-angle)) translateY(calc(-1 * var(--star-dist))) scale(1.2); opacity: 0; }
}
.animate-star-burst {
  animation: starBurst 0.8s ease-out forwards;
  animation-delay: var(--star-delay);
}
button:focus, a:focus, input:focus {
  outline: none !important;
}
.focus-ring-gray {
  box-shadow: 0 0 0 4px rgba(209, 213, 219, 0.5) !important;
}
`;
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
  Star,
  Camera,
  Upload
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
  | 'LEVEL_UP'
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
  useEffect(() => {
    const style = document.createElement('style');
    style.innerHTML = animationStyles;
    document.head.appendChild(style);
    return () => {
      document.head.removeChild(style);
    };
  }, []);

  const [mode, setMode] = useState<TerminalMode>('LOADING');
  const [phone, setPhone] = useState('');
  const [customerData, setCustomerData] = useState({
    name: '',
    email: '',
    city: '',
    province: '',
    postalCode: '',
    address: '',
    birthday: '',
    companyName: '',
    photo: undefined as string | undefined
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
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [requestId, setRequestId] = useState<string | null>(null);
  const [approvedData, setApprovedData] = useState<any>(null);
  const [uploading, setUploading] = useState(false);
  const [showStars, setShowStars] = useState(false);
  const [rewardModal, setRewardModal] = useState({
    isOpen: false,
    title: '',
    message: '',
    points: 0,
    goal: 10
  });

  useEffect(() => {
    console.log("CP Gestao Version: 2.7.2 - Digital Ready");
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');
    if (token) setQrToken(token);
  }, []);

  // Polling for Approval & Balance Updates
  useEffect(() => {
    let interval: any;

    // 1. Polling for a SPECIFIC request approval
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
          console.error('Polling error (Approval):', error);
        }
      }, 3000);
    }
    // 2. Polling for GENERAL balance updates (Real-time feeling when merchant approves via Telegram/Admin)
    else if (mode === 'RESULT_CLIENT' && foundCustomer && tenantSlug && phone) {
      interval = setInterval(async () => {
        try {
          const res = await terminalService.lookup(tenantSlug, deviceUid, phone, qrToken, sessionToken);
          if (res.data && res.data.points_balance !== foundCustomer.points_balance) {
            console.log("Real-time balance update detected!");
            setFoundCustomer(res.data);
          }
        } catch (error) {
          // Silent fail for background polling
        }
      }, 5000); // Check every 5s for balance changes
    }

    return () => clearInterval(interval);
  }, [mode, requestId, tenantSlug, deviceUid, foundCustomer, phone, qrToken, sessionToken]);

  // Redirecionamento automático removido a pedido do usuário.
  // O fluxo agora depende exclusivamente do clique no botão de confirmação.



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

      console.log(`Resolving Terminal: Slug=${slug}, UID=${uid}, Token=${token}`);
      const res = await terminalService.getInfo(slug, uid, token);
      console.log("Terminal Resolved:", res.data);
      setStoreInfo(res.data);
      const newSessionToken = res.data.session_token;
      if (newSessionToken) setSessionToken(newSessionToken);

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
      const phoneParam = urlParams.get('phone');

      if (phoneParam) {
        const formatted = formatJapanesePhone(phoneParam);
        setPhone(formatted);
        // Important: use the NEW session token directly to avoid state race condition
        setTimeout(() => {
          handleLookup(phoneParam, slug, uid, token, newSessionToken);
        }, 100);
      } else if (acao === 'pontuar') {
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


  const handleLookup = async (overridePhone?: string, overrideSlug?: string, overrideUid?: string | null, overrideToken?: string | null, overrideSession?: string | null) => {
    const targetPhone = overridePhone || phone;
    const targetSlug = overrideSlug || tenantSlug;
    const targetUid = overrideUid === undefined ? deviceUid : overrideUid;
    const targetToken = overrideToken || qrToken;
    const targetSession = overrideSession || sessionToken;

    if (!targetPhone || !targetSlug) return;
    if (overridePhone) setPhone(overridePhone);
    setLoading(true);
    try {
      const res = await terminalService.lookup(targetSlug, targetUid, targetPhone, targetToken, targetSession);
      if (res.data && res.data.customer_exists === false) {
        const isAdmin = !!localStorage.getItem('auth_token');
        if (isAdmin) {
          setMode('LOJISTA_QUICK_REGISTER');
        } else {
          setMode('VISIT_NOT_FOUND');
        }
      } else {
        setFoundCustomer(res.data);
        const isAdmin = !!localStorage.getItem('auth_token');

        // SÓ MOSTRA AÇÕES DE LOJISTA SE: For admin E estiver em um terminal físico (com UID)
        // Se for o link público web (/p/slug), mostra apenas o saldo (RESULT_CLIENT)
        if (isAdmin && deviceUid) {
          setMode('LOJISTA_ACTIONS');
        } else if (targetToken) {
          handleEarn();
        } else if (res.data.show_level_up) {
          setMode('LEVEL_UP');
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
    handleEarn(e);
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


  const handleEarn = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!phone || phone.length < 8) return;

    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(30);
    }

    setLoading(true);
    try {
      const lookupRes = await terminalService.lookup(tenantSlug, deviceUid, phone, qrToken, sessionToken);

      if (lookupRes.data.customer_exists) {
        // Cliente existe, pontuar agora
        const earnRes = await terminalService.earn(tenantSlug, deviceUid, phone, qrToken, sessionToken);
        const isAuto = earnRes.data.auto_approved;

        const reachedGoal = earnRes.data.new_balance >= earnRes.data.points_goal;
        setRewardModal({
          isOpen: true,
          title: reachedGoal ? 'Meta Atingida! 🎉' : (isAuto ? 'Ponto Adicionado! 🎉' : 'Ponto solicitado! ✅'),
          message: reachedGoal
            ? 'Parabéns! Você acaba de atingir sua meta.\nResgate seu prêmio na próxima visita.'
            : (isAuto
              ? 'Seu ponto foi creditado com sucesso!\nVocê será redirecionado para acompanhar seu saldo.'
              : `${storeInfo?.name || 'A loja'} vai confirmar em instantes.\nVocê será redirecionado para acompanhar seu saldo.`),
          points: earnRes.data.new_balance,
          goal: earnRes.data.points_goal
        });

        // IMPORTANTE: Definir o mode ativará o useEffect de redirecionamento automático
        setMode(isAuto ? 'AUTO_SUCCESS' : 'WAITING_APPROVAL');

        setShowStars(true);
        setTimeout(() => setShowStars(false), 1500);

        if (qrToken) setQrToken(null);
        // We do NOT clear the phone here anymore, to allow redirection ?phone= to work.
        // It will be cleared when the user lands on the next page or clicks 'Reset'.
      } else {
        // Cliente não existe
        setMode('VISIT_NOT_FOUND');
      }
    } catch (error: any) {
      const msg = error.response?.data?.message || 'Ocorreu um erro. Tente novamente.';
      // Se for um erro do sistema (como cooldown ou limite), mostramos o modal.
      // Se for apenas erro de lookup de dispositivo (404), aí sim poderíamos cair no VISIT_NOT_FOUND, 
      // mas com os argumentos certos isso não deve acontecer para números válidos.

      if (error.response?.status === 429 || error.response?.status === 403 || error.response?.status === 409) {
        setModal({
          isOpen: true,
          title: 'Atenção',
          message: msg,
          type: 'warning'
        });
      } else {
        setMode('VISIT_NOT_FOUND');
      }
    }
    finally {
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
      const res = await terminalService.redeem(tenantSlug, deviceUid, phone, qrToken, sessionToken);
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

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !foundCustomer) return;

    if (file.size > 10 * 1024 * 1024) {
      setModal({ isOpen: true, title: 'Arquivo muito grande', message: 'A foto deve ter no máximo 10MB.', type: 'error' });
      return;
    }

    setUploading(true);
    const formData = new FormData();
    formData.append('photo', file);
    formData.append('phone', phone);
    if (qrToken) formData.append('token', qrToken);

    try {
      const res = await terminalService.updatePhoto(tenantSlug, deviceUid, formData);
      setFoundCustomer((prev: any) => ({
        ...prev,
        foto_perfil_url: res.data.foto_perfil_url,
        foto_perfil_thumb_url: res.data.foto_perfil_thumb_url
      }));
      setModal({ isOpen: true, title: 'Sucesso', message: 'Foto de perfil atualizada!', type: 'success' });
    } catch (error: any) {
      setModal({
        isOpen: true,
        title: 'Erro no Upload',
        message: error.response?.data?.message || 'Não foi possível atualizar a foto agora.',
        type: 'error'
      });
    } finally {
      setUploading(false);
    }
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
        birthday: customerData.birthday,
        company_name: customerData.companyName,
        photo: customerData.photo
      });
      const isAdmin = !!localStorage.getItem('auth_token');

      // SÓ MOSTRA AÇÕES DE LOJISTA SE: For admin E estiver em um terminal físico (com UID)
      if (isAdmin && deviceUid && res.data.points_balance !== undefined) {
        setFoundCustomer(res.data);
        setMode('LOJISTA_ACTIONS');
        setModal({
          isOpen: true,
          title: 'Cadastro Realizado!',
          message: res.data.message || 'O cliente foi cadastrado e pontuado com sucesso.',
          type: 'success'
        });
      } else {
        setApprovedData({
          customer_name: res.data.name,
          points_balance: res.data.points_balance,
          points_goal: res.data.points_goal,
          tenant_name: storeInfo?.name,
          is_registration: true
        });
        setQrToken(null);
        setMode('AUTO_SUCCESS');
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
    setCustomerData({ name: '', email: '', city: '', province: '', postalCode: '', address: '', birthday: '', companyName: '', photo: undefined });
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

  const isTerminalMode = !!(deviceUid || qrToken);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 font-sans selection:bg-slate-900 selection:text-white pb-20 overflow-x-hidden flex flex-col items-center">
      <div className="w-full md:w-[85%] max-w-4xl bg-white dark:bg-slate-900 md:rounded-t-none md:rounded-b-[50px] shadow-2xl relative z-20 flex flex-col overflow-hidden animate-fade-in border-none">
        <div className="h-80 md:h-[500px] w-full bg-slate-200 dark:bg-slate-800 relative shrink-0 overflow-hidden">
          {storeInfo?.cover_url ? (
            <img src={storeInfo?.cover_url} alt="Cover" className="w-full h-full object-cover block absolute inset-0" />
          ) : (
            <div className="w-full h-full bg-gradient-to-r from-gray-700 to-gray-900" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/40 to-black/30"></div>

          <div className="absolute inset-0 flex flex-col items-start justify-start pt-8 pb-12 px-8 md:px-12 text-white">
            <div className="flex flex-col items-start gap-4 md:gap-6 w-full">
              <div className="w-24 h-24 md:w-32 md:h-32 rounded-[24px] shadow-[0_20px_40px_rgba(0,0,0,0.4)] flex shrink-0 items-center justify-center overflow-hidden ring-4 ring-white/20 backdrop-blur-xl bg-white/5 animate-scale-in">
                {storeInfo?.logo_url ? (
                  <img src={storeInfo?.logo_url} alt={storeInfo?.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-white/10 flex items-center justify-center">
                    <DefaultLogo className="w-full h-full p-8" />
                  </div>
                )}
              </div>

              <div className="flex flex-col drop-shadow-2xl max-w-3xl text-left" style={{ textShadow: '0 4px 15px rgba(0,0,0,0.5)' }}>
                <h1 className="text-3xl md:text-5xl font-black tracking-tighter text-white leading-tight drop-shadow-xl uppercase">
                  {storeInfo?.name || 'Carregando...'}
                </h1>
                <p className="mt-2 text-sm md:text-xl text-white/90 font-bold leading-relaxed drop-shadow-lg">
                  {storeInfo?.description || 'Obrigado por nos visitar!'}
                </p>
              </div>
            </div>
          </div>
        </div>

        {mode === 'START' && (
          <div className="p-6 md:p-12 animate-fade-in w-full space-y-12 bg-white dark:bg-gray-950 flex flex-col items-center">

            {isTerminalMode ? (
              /* =========================================================================
                 IN-STORE TERMINAL MODE: Single Card - Register Visit
                 ========================================================================= */
              <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-[40px] p-8 md:p-14 shadow-[0_45px_100px_-25px_rgba(0,0,0,0.18)] border border-gray-100/80 flex flex-col items-center text-center space-y-10">

                <div className="w-20 h-20 bg-slate-50 dark:bg-slate-800 rounded-3xl flex items-center justify-center shadow-inner border border-slate-100 dark:border-slate-700">
                  <Star className="w-10 h-10 text-slate-900 dark:text-white" />
                </div>

                <div className="space-y-3 pt-6">
                  <h3 className="text-3xl md:text-5xl font-black text-slate-900 dark:text-white tracking-tighter uppercase leading-tight">Solicitar Ponto</h3>
                  <p className="text-sm font-bold text-slate-500 dark:text-slate-400 italic">Informe seu telefone para registrar sua visita.</p>
                </div>

                <form onSubmit={handleEarn} className="w-full space-y-8">
                  <div className="relative group">
                    <Smartphone className="absolute left-6 top-1/2 -translate-y-1/2 w-7 h-7 text-slate-200 group-focus-within:text-slate-900 transition-colors" />
                    <input
                      type="tel"
                      placeholder="090-0000-0000"
                      className="w-full pl-16 pr-8 py-6 bg-slate-50 dark:bg-slate-800/50 border-2 border-slate-100 focus:border-slate-900 rounded-3xl text-2xl font-black tracking-widest text-slate-900 outline-none transition-all placeholder:text-slate-200"
                      value={phone}
                      onChange={e => setPhone(formatJapanesePhone(e.target.value))}
                      autoFocus
                    />
                  </div>

                  <div className="relative">
                    <Button
                      type="submit"
                      isLoading={loading}
                      className="w-full h-20 text-xl font-black uppercase tracking-[0.2em] bg-[#2B2B2B] hover:bg-[#444444] text-white rounded-[25px] shadow-[0_20px_50px_rgba(0,0,0,0.12)] transition-all active:scale-95 overflow-visible focus:ring-4 focus:ring-gray-300"
                    >
                      GANHAR PONTO
                    </Button>

                    {showStars && (
                      <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                        {[...Array(8)].map((_, i) => (
                          <div key={i} className="absolute animate-star-burst"
                            style={{ '--star-angle': `${(360 / 8) * i}deg`, '--star-dist': '60px', '--star-delay': `${i * 0.05}s` } as any}
                          >
                            <Star className="w-6 h-6 text-amber-400 fill-amber-400" />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </form>
              </div>
            ) : (
              /* =========================================================================
                 PUBLIC PAGE MODE (SOCIAL MEDIA): Dual Card - Register & Check Balance
                 ========================================================================= */
              <div className="w-full max-w-4xl grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Card: Participar do Programa (REGISTER) */}
                <div className="bg-white dark:bg-slate-900 rounded-[40px] p-8 md:p-12 shadow-[0_45px_100px_-25px_rgba(0,0,0,0.18)] border border-gray-100/80 flex flex-col items-center text-center group hover:scale-[1.02] transition-all duration-300">
                  <div className="w-16 h-16 bg-blue-50 dark:bg-blue-500/10 rounded-2xl flex items-center justify-center shadow-inner border border-blue-100 dark:border-blue-900/50 mb-8">
                    <UserPlus className="w-8 h-8 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div className="space-y-3 flex-1 mb-8">
                    <h3 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tight">Quero Participar</h3>
                    <p className="text-sm font-bold text-slate-500 dark:text-slate-400">Crie sua conta e comece a acumular pontos.</p>
                  </div>
                  <Button
                    onClick={() => setMode('REGISTER')}
                    className="w-full h-20 text-base font-black uppercase tracking-widest bg-[#2B2B2B] hover:bg-[#444444] text-white rounded-2xl shadow-lg transition-all active:scale-95 focus:ring-4 focus:ring-gray-300 mt-auto"
                  >
                    CADASTRAR
                  </Button>
                </div>

                {/* Card: Ver Meus Pontos (CONSULT) */}
                <div className="bg-white dark:bg-slate-900 rounded-[40px] p-8 md:p-12 shadow-[0_45px_100px_-25px_rgba(0,0,0,0.18)] border border-gray-100/80 flex flex-col items-center text-center group hover:scale-[1.02] transition-all duration-300">
                  <div className="w-16 h-16 bg-slate-50 dark:bg-slate-800 rounded-2xl flex items-center justify-center shadow-inner border border-slate-100 dark:border-slate-700 mb-8">
                    <Smartphone className="w-8 h-8 text-slate-900 dark:text-white" />
                  </div>
                  <div className="space-y-3 flex-1 mb-8">
                    <h3 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tight">Já Sou Cliente</h3>
                    <p className="text-sm font-bold text-slate-500 dark:text-slate-400">Consulte seu saldo e histórico.</p>
                  </div>
                  <Button
                    onClick={() => setMode('CONSULT')}
                    className="w-full h-20 text-base font-black uppercase tracking-widest bg-[#2B2B2B] hover:bg-[#444444] text-white rounded-2xl shadow-lg transition-all active:scale-95 focus:ring-4 focus:ring-gray-300 mt-auto"
                  >
                    VER MEUS PONTOS
                  </Button>
                </div>
              </div>
            )}

          </div>
        )}



        {
          mode === 'VISIT_NOT_FOUND' && (
            <div className="p-6 md:p-12 text-center animate-fade-in space-y-8 w-full min-h-[400px] flex flex-col justify-center items-center bg-white dark:bg-gray-950">
              <div className="w-24 h-24 bg-slate-50 dark:bg-slate-800 rounded-full flex items-center justify-center text-slate-900 dark:text-white">
                <UserPlus className="w-12 h-12" />
              </div>
              <div className="space-y-4 max-w-md">
                <h2 className="text-3xl font-black text-slate-900 dark:text-white tracking-tighter uppercase">Ops! Ainda não participa</h2>
                <p className="text-slate-500 dark:text-slate-400 font-bold leading-relaxed">
                  Esse número ainda não está participando. Clique em cadastrar para começar a ganhar pontos!
                </p>
              </div>
              <div className="flex flex-col gap-4 w-full max-w-sm">
                <Button onClick={() => setMode('REGISTER')} className="w-full h-20 bg-[#2B2B2B] hover:bg-[#444444] text-white rounded-2xl font-black uppercase tracking-widest shadow-xl text-sm focus:ring-4 focus:ring-gray-300">
                  CADASTRAR
                </Button>
                <button onClick={() => setMode('START')} className="text-gray-400 font-bold uppercase text-[10px] tracking-widest py-2">
                  Tentar outro número
                </button>
              </div>
            </div>
          )
        }

        {
          mode === 'CONSULT' && (
            <div className="p-6 md:p-12 text-center relative overflow-hidden animate-fade-in space-y-10 w-full max-w-lg mx-auto bg-white dark:bg-gray-950">
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
                <Button type="submit" isLoading={loading} className="w-full h-20 text-base font-black uppercase tracking-widest bg-[#2B2B2B] hover:bg-[#444444] text-white rounded-2xl shadow-xl flex items-center justify-center gap-3 focus:ring-4 focus:ring-gray-300">
                  Ver meu Saldo <ArrowRight className="w-5 h-5" />
                </Button>
              </form>
            </div>
          )
        }
        {
          mode === 'LEVEL_UP' && foundCustomer && (
            <div className="p-8 md:p-12 text-center relative overflow-hidden animate-fade-in space-y-10 w-full max-w-lg mx-auto bg-white dark:bg-gray-950 flex flex-col items-center">
              <div className="relative">
                <div className="absolute inset-0 animate-ping bg-amber-400/20 rounded-full scale-150"></div>
                <div className="w-32 h-32 bg-gradient-to-br from-amber-400 to-orange-500 rounded-full flex items-center justify-center text-white shadow-2xl relative z-10 border-4 border-white">
                  <Trophy className="w-16 h-16 animate-bounce" />
                </div>
              </div>

              <div className="space-y-4">
                <h2 className="text-4xl font-black text-slate-900 dark:text-white tracking-tighter uppercase leading-tight">
                  Parabéns, {foundCustomer.name.split(' ')[0]}!
                </h2>
                <p className="text-xl font-bold text-slate-600 dark:text-slate-400">
                  Você conquistou o nível:
                </p>
                <div className="inline-flex items-center gap-3 px-8 py-4 rounded-3xl bg-amber-50 dark:bg-amber-900/20 border-2 border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-400">
                  <span className="text-3xl font-black uppercase tracking-tighter">
                    {foundCustomer.loyalty_level_name}
                  </span>
                </div>
              </div>

              <p className="text-slate-500 font-medium leading-relaxed max-w-sm">
                Seus benefícios foram atualizados! Agora você ganha pontos mais rápido e tem novos prêmios para conquistar.
              </p>

              <Button
                onClick={() => setMode('RESULT_CLIENT')}
                className="w-full h-20 bg-[#2B2B2B] hover:bg-[#444444] text-white rounded-2xl font-black uppercase tracking-widest shadow-xl text-lg flex items-center justify-center gap-3 group focus:ring-4 focus:ring-gray-300"
              >
                Ver Meus Pontos <ArrowRight className="w-6 h-6 group-hover:translate-x-1 transition-transform" />
              </Button>
            </div>
          )
        }

        {
          mode === 'RESULT_CLIENT' && foundCustomer && (
            <div className="p-6 md:p-12 relative overflow-hidden animate-fade-in space-y-10 w-full max-w-lg mx-auto flex flex-col items-center bg-white dark:bg-gray-950">
              <button onClick={reset} className="absolute top-6 right-6 p-2.5 bg-slate-100/80 dark:bg-slate-800/80 backdrop-blur-md text-slate-500 hover:text-slate-900 rounded-full z-20 border border-slate-200/50 shadow-sm active:scale-90"><X className="w-5 h-5" /></button>

              {/* Foto de Perfil */}
              <div className="relative w-32 h-32 md:w-40 md:h-40 group mt-4">
                <div className="w-full h-full rounded-full overflow-hidden border-4 border-white dark:border-slate-800 shadow-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center relative">
                  {foundCustomer.foto_perfil_url ? (
                    <img src={foundCustomer.foto_perfil_url} alt={foundCustomer.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-slate-900 flex items-center justify-center text-white font-black text-4xl">
                      {foundCustomer.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}
                    </div>
                  )}
                  {uploading && (
                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                      <div className="w-8 h-8 border-4 border-white border-t-transparent rounded-full animate-spin"></div>
                    </div>
                  )}
                </div>
                <label className="absolute bottom-1 right-1 w-10 h-10 md:w-12 md:h-12 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-full flex items-center justify-center cursor-pointer shadow-xl hover:scale-110 active:scale-90 transition-all border-4 border-white dark:border-slate-800 z-10">
                  <Camera className="w-5 h-5 md:w-6 md:h-6" />
                  <input type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} disabled={uploading} />
                </label>
              </div>

              <div className="text-center space-y-2">
                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.25em]">Área do Cliente</h3>
                <p className="text-3xl md:text-5xl font-black text-slate-900 dark:text-white tracking-tighter leading-tight px-4">{foundCustomer?.name || 'Cliente'}</p>
                <div className="flex flex-col items-center gap-2">
                  <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-xl border-2 bg-slate-50 dark:bg-slate-800 border-slate-100 dark:border-slate-700 text-slate-700 dark:text-slate-300">
                    <span className="text-[12px] font-black uppercase tracking-widest text-center">{foundCustomer.loyalty_level_name || 'Bronze'}</span>
                  </div>
                  {foundCustomer.days_to_downgrade > 0 && (
                    <p className="text-[10px] font-black text-amber-500 uppercase tracking-tighter text-center max-w-[200px]">
                      Mantenha seu nível! Pontue a cada {foundCustomer.days_to_downgrade} dias.
                    </p>
                  )}
                </div>
              </div>
              <div className="bg-white dark:bg-slate-800 rounded-[30px] p-8 text-slate-900 dark:text-white border border-slate-100 dark:border-slate-800 shadow-xl relative overflow-hidden">
                <div className="text-center space-y-4">
                  <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mb-2">Saldo Disponível</p>
                    <div className="flex items-baseline justify-center gap-2">
                      <span className="text-7xl font-black tracking-tighter tabular-nums text-slate-900 dark:text-white">{foundCustomer?.points_balance}</span>
                      <span className="text-2xl font-black text-slate-300 dark:text-slate-600">/ {Number(foundCustomer?.points_goal || storeInfo?.points_goal)}</span>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-50 dark:border-slate-700/50">
                    <p className="text-sm font-bold text-slate-600 dark:text-slate-400 italic">
                      {foundCustomer.remaining <= 0
                        ? `Meta Atingida! Resgate seu prêmio na próxima visita. 🎁`
                        : foundCustomer.remaining === 1
                          ? `Falta apenas 1 ponto para o seu prêmio ${foundCustomer.reward_name || 'especial'}! ✨`
                          : `Faltam ${foundCustomer.remaining} pontos para o prêmio ${foundCustomer.reward_name || 'especial'}!`}
                    </p>
                  </div>
                </div>
              </div>
              <Button onClick={reset} className="w-full h-16 font-black uppercase bg-[#2B2B2B] hover:bg-[#444444] text-white rounded-2xl shadow-xl flex items-center justify-center gap-3 focus:ring-4 focus:ring-gray-300">
                <X className="w-5 h-5" /> Fechar e Sair
              </Button>
            </div>
          )
        }

        {
          mode === 'LOJISTA_ACTIONS' && foundCustomer && (() => {
            const balance = Number(foundCustomer.points_balance || 0);
            const goal = Number(foundCustomer.points_goal || storeInfo?.points_goal || 10);
            const canRedeem = balance >= goal;
            return (
              <div className="p-6 md:p-10 relative overflow-hidden animate-fade-in space-y-8 w-full max-w-lg mx-auto flex flex-col items-center bg-white dark:bg-gray-950">
                <button onClick={reset} className="absolute top-6 right-6 p-2.5 bg-slate-100/80 dark:bg-slate-800/80 backdrop-blur-md text-slate-500 hover:text-slate-900 rounded-full z-20 border border-slate-200/50 shadow-sm active:scale-90"><X className="w-5 h-5" /></button>

                {/* Foto de Perfil */}
                <div className="relative w-32 h-32 md:w-40 md:h-40 group mt-4">
                  <div className="w-full h-full rounded-full overflow-hidden border-4 border-white dark:border-slate-800 shadow-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center relative">
                    {foundCustomer.foto_perfil_url ? (
                      <img src={foundCustomer.foto_perfil_url} alt={foundCustomer.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full bg-slate-900 flex items-center justify-center text-white font-black text-4xl leading-none">
                        {foundCustomer.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}
                      </div>
                    )}
                    {uploading && (
                      <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                        <div className="w-8 h-8 border-4 border-white border-t-transparent rounded-full animate-spin"></div>
                      </div>
                    )}
                  </div>
                  <label className="absolute bottom-1 right-1 w-10 h-10 md:w-12 md:h-12 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-full flex items-center justify-center cursor-pointer shadow-xl hover:scale-110 active:scale-90 transition-all border-4 border-white dark:border-slate-800 z-10">
                    <Camera className="w-5 h-5 md:w-6 md:h-6" />
                    <input type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} disabled={uploading} />
                  </label>
                </div>

                <div className="text-center space-y-2">
                  <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.25em]">Atendimento ao Cliente</h3>
                  <p className="text-3xl md:text-5xl font-black text-slate-900 dark:text-white tracking-tighter leading-tight px-4">{foundCustomer?.name || 'Cliente'}</p>

                  {/* Badge de Nível */}
                  <div className="flex flex-col items-center gap-2">
                    <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-xl border-2 bg-slate-50 dark:bg-slate-800 border-slate-100 dark:border-slate-700 text-slate-700 dark:text-slate-300">
                      <span className="text-[12px] font-black uppercase tracking-widest text-center">
                        {foundCustomer.loyalty_level === 1 ? '🥉 BRONZE' :
                          foundCustomer.loyalty_level === 2 ? '🥈 SILVER' :
                            foundCustomer.loyalty_level === 3 ? '🥇 GOLD' :
                              foundCustomer.loyalty_level_name || '🥉 Bronze'}
                      </span>
                    </div>
                    <p className="text-[11px] font-bold text-slate-400">{foundCustomer?.phone}</p>
                  </div>
                </div>

                <div className="bg-white dark:bg-slate-800 rounded-[30px] p-8 md:px-14 text-slate-900 dark:text-white border border-slate-100 dark:border-slate-800 shadow-xl relative overflow-hidden">
                  <div className="text-center space-y-4">
                    <div>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mb-1">Saldo Atual</p>
                      <div className="flex items-baseline justify-center gap-2">
                        <span className="text-7xl font-black tracking-tighter tabular-nums text-slate-900 dark:text-white">{balance}</span>
                        <span className="text-2xl font-black text-slate-300 dark:text-slate-600">/ {goal}</span>
                      </div>
                    </div>
                    <div className="pt-3 border-t border-slate-50 dark:border-slate-700/50">
                      <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 italic">
                        {balance >= goal
                          ? `Disponível para Resgate: ${foundCustomer.reward_name || 'prêmio'}! 🎁`
                          : (goal - balance) === 1
                            ? `Falta apenas 1 ponto para o prêmio: ${foundCustomer.reward_name || 'prêmio'} ✨`
                            : `Faltam ${goal - balance} pontos para o prêmio: ${foundCustomer.reward_name || 'prêmio'}`}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-4 w-full">
                  <Button
                    onClick={() => handleAction(canRedeem ? 'redeem' : 'earn')}
                    isLoading={loading}
                    className={`w-full h-20 ${canRedeem ? 'bg-amber-500 hover:bg-amber-600' : 'bg-[#2B2B2B] hover:bg-[#444444]'} text-white rounded-[25px] font-black uppercase text-xl shadow-2xl transition-all active:scale-95 focus:ring-4 focus:ring-gray-300`}
                  >
                    {canRedeem ? 'RESGATAR PRÊMIO' : 'LANÇAR PONTO'}
                  </Button>
                  <button onClick={reset} className="text-slate-400 font-bold uppercase text-[10px] tracking-widest hover:text-slate-600 transition-colors">CANCELAR</button>
                </div>
              </div>
            );
          })()
        }

        {
          mode === 'LOJISTA_QUICK_REGISTER' && (
            <div className="p-6 md:p-10 text-center animate-fade-in space-y-8 w-full bg-white dark:bg-gray-950">
              <h2 className="text-2xl font-black uppercase tracking-tighter">Cadastro Rápido</h2>
              <form onSubmit={handleRegister} className="space-y-4 text-left">
                <Input label="Nome Completo *" value={customerData.name} onChange={e => setCustomerData({ ...customerData, name: normalizeText(e.target.value) })} required className="focus:ring-gray-200 focus:border-gray-400" />
                <Input label="Telefone" value={phone} disabled className="focus:ring-gray-200 focus:border-gray-400" />
                <div className="grid grid-cols-2 gap-4">
                  <Input label="Província *" value={customerData.province} onChange={e => setCustomerData({ ...customerData, province: normalizeText(e.target.value) })} required className="focus:ring-gray-200 focus:border-gray-400" />
                  <Input label="Cidade *" value={customerData.city} onChange={e => setCustomerData({ ...customerData, city: normalizeText(e.target.value) })} required className="focus:ring-gray-200 focus:border-gray-400" />
                </div>
                <Button type="submit" isLoading={loading} className="w-full h-20 bg-[#2B2B2B] hover:bg-[#444444] text-white rounded-2xl font-black uppercase focus:ring-4 focus:ring-gray-300">CADASTRAR E PONTUAR</Button>
                <Button variant="ghost" onClick={reset} className="w-full h-12 text-slate-400 font-bold uppercase text-xs">CANCELAR</Button>
              </form>
            </div>
          )
        }

        {
          mode === 'REGISTER' && (
            <div className="p-6 md:p-8 relative overflow-hidden animate-fade-in space-y-6 w-full max-w-lg mx-auto bg-white dark:bg-gray-950">
              <form onSubmit={handleRegister} className="space-y-6">
                <div className="flex items-center justify-start">
                  <button type="button" onClick={() => setMode('START')} className="p-2.5 bg-slate-100 dark:bg-slate-800 rounded-full text-slate-500 hover:bg-slate-200 transition-colors">
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                </div>

                <div className="text-center space-y-4">
                  {/* Foto de Perfil Opcional */}
                  <div className="relative w-24 h-24 mx-auto group">
                    <div className="w-full h-full rounded-full overflow-hidden border-2 border-dashed border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 flex flex-col items-center justify-center text-slate-400 group-hover:border-slate-900 transition-colors relative">
                      {customerData.photo ? (
                        <img src={customerData.photo} alt="Preview" className="w-full h-full object-cover" />
                      ) : (
                        <>
                          <Camera className="w-8 h-8 mb-1" />
                          <span className="text-[9px] font-black uppercase tracking-tighter">Foto Opcional</span>
                        </>
                      )}
                    </div>
                    <label className="absolute inset-0 cursor-pointer">
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            const reader = new FileReader();
                            reader.onloadend = () => {
                              setCustomerData({ ...customerData, photo: reader.result as string });
                            };
                            reader.readAsDataURL(file);
                          }
                        }}
                      />
                    </label>
                    {customerData.photo && (
                      <button
                        type="button"
                        onClick={() => setCustomerData({ ...customerData, photo: undefined })}
                        className="absolute -top-1 -right-1 w-6 h-6 bg-rose-500 text-white rounded-full flex items-center justify-center shadow-md hover:bg-rose-600 transition-colors"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>

                  <div className="space-y-1">
                    <h2 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">Criar Cadastro</h2>
                    <p className="text-sm text-slate-500 font-medium">Preencha seus dados para ganhar seu primeiro ponto!</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <Input
                    label="Nome Completo *"
                    value={customerData.name}
                    placeholder="Digite seu nome completo"
                    onChange={e => setCustomerData({ ...customerData, name: normalizeText(e.target.value) })}
                    required
                    className="focus:ring-gray-200 focus:border-gray-400"
                  />

                  <Input
                    label="Nome da Empresa"
                    value={customerData.companyName}
                    placeholder="Digite o nome da sua empresa"
                    onChange={e => setCustomerData({ ...customerData, companyName: normalizeText(e.target.value) })}
                    className="focus:ring-gray-200 focus:border-gray-400"
                  />

                  <div className="grid grid-cols-2 gap-3">
                    <Input
                      label="Seu Telefone *"
                      value={phone}
                      placeholder="Digite seu telefone"
                      onChange={e => setPhone(formatJapanesePhone(e.target.value))}
                      required
                      className="focus:ring-gray-200 focus:border-gray-400"
                    />
                    <Input
                      label="Cidade *"
                      value={customerData.city}
                      placeholder="Nome da sua cidade"
                      onChange={e => setCustomerData({ ...customerData, city: normalizeText(e.target.value) })}
                      required
                      className="focus:ring-gray-200 focus:border-gray-400"
                    />
                  </div>
                  <Input
                    label="Província *"
                    value={customerData.province}
                    placeholder="digite o nome da Província"
                    onChange={e => setCustomerData({ ...customerData, province: normalizeText(e.target.value) })}
                    required
                    className="focus:ring-gray-200 focus:border-gray-400"
                  />
                </div>
                <Button type="submit" isLoading={loading} className="w-full h-20 bg-[#2B2B2B] hover:bg-[#444444] text-white rounded-[25px] font-black uppercase text-base shadow-xl tracking-widest transition-transform active:scale-95 focus:ring-4 focus:ring-gray-300">
                  CADASTRAR E GANHAR PONTO
                </Button>
              </form>
            </div>
          )
        }

        {
          mode === 'WAITING_APPROVAL' && (
            <div className="p-6 md:p-8 text-center py-12 animate-fade-in space-y-8 w-full bg-white dark:bg-gray-950">

              <div className="relative mx-auto w-24 h-24 flex items-center justify-center bg-slate-50 dark:bg-slate-800 rounded-full border-4 border-slate-100 dark:border-slate-700">
                <Smartphone className="w-10 h-10 text-slate-500 animate-bounce" />
              </div>
              <div className="space-y-4">
                <h2 className="text-4xl font-black uppercase tracking-tighter text-slate-900 dark:text-white">Ponto solicitado! ✅</h2>
                <p className="text-base text-slate-600 dark:text-slate-400 font-bold max-w-[320px] mx-auto leading-relaxed">
                  Sua solicitação de ponto foi enviada com sucesso.<br />
                  Você será redirecionado para acompanhar seu saldo.
                </p>
              </div>
              <div className="pt-8 w-full max-w-xs mx-auto">
                <Button onClick={reset} className="w-full h-20 bg-[#2B2B2B] hover:bg-[#444444] text-white rounded-2xl font-black uppercase tracking-widest transition-all active:scale-95 shadow-lg focus:ring-4 focus:ring-gray-300">
                  Ok, entendi
                </Button>
              </div>
            </div>
          )
        }

        {
          (mode === 'SUCCESS' || mode === 'AUTO_SUCCESS') && approvedData && (
            <div className="p-6 md:p-8 text-center py-10 animate-fade-in w-full bg-white dark:bg-gray-950">
              <div className="w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-6 bg-green-50 border-4 border-green-100">
                <CheckCircle2 className="w-12 h-12 text-green-500" />
              </div>
              <h2 className="text-2xl md:text-3xl font-black tracking-tight text-slate-900 dark:text-white leading-tight">
                {approvedData.is_registration
                  ? "Obrigado por participar,\nvocê já recebeu seu primeiro ponto!"
                  : (approvedData.points_balance >= approvedData.points_goal)
                    ? "Meta Atingida!\nResgate na próxima visita."
                    : <>Solicitação enviada!<br />Seu ponto foi adicionado.</>}
              </h2>
              <p className="text-sm text-slate-500 font-bold mt-2">
                {approvedData.is_registration
                  ? "Consulte seu saldo clicando no botão ver meus pontos."
                  : (approvedData.points_balance >= approvedData.points_goal)
                    ? "Parabéns! Você atingiu a pontuação necessária."
                    : "Você será redirecionado para acompanhar seu saldo."}
              </p>
              <div className="bg-slate-50 dark:bg-slate-800/50 rounded-3xl p-8 mb-8 mt-8 border-2 border-slate-100 dark:border-slate-800 shadow-inner">
                <p className="text-[11px] font-black uppercase text-slate-400 dark:text-slate-500 mb-2 tracking-widest">Obrigado pela visita!</p>
                <p className="text-[10px] font-black uppercase text-slate-300 dark:text-slate-600 mb-1">Novo Saldo</p>
                <p className="text-8xl font-black text-slate-900 dark:text-white tracking-tighter">{approvedData.points_balance} <span className="text-3xl text-slate-300 dark:text-slate-700">/ {approvedData.points_goal}</span></p>
              </div>
              <Button
                onClick={() => {
                  if (tenantSlug) {
                    const cleanPhone = phone.replace(/\D/g, '');
                    window.location.href = `/p/${tenantSlug}${cleanPhone ? `?phone=${cleanPhone}` : ''}`;
                  } else {
                    reset();
                  }
                }}
                className="w-full h-20 font-black uppercase bg-[#2B2B2B] hover:bg-[#444444] text-white rounded-2xl focus:ring-4 focus:ring-gray-300"
              >
                {approvedData.is_registration ? "Ver Meus Pontos" : "Voltar ao Início"}
              </Button>
            </div>
          )
        }
      </div >

      <div className="w-full md:w-[80%] max-w-4xl flex flex-col items-center pb-12 p-6 space-y-8">
        {storeInfo?.rules_text && (
          <div className="w-full bg-white dark:bg-slate-900/50 p-8 rounded-[30px] border border-gray-100 dark:border-slate-800 shadow-sm">
            <h4 className="text-xs font-black uppercase tracking-[0.3em] text-slate-400 mb-4 text-center">Regras do Programa</h4>
            <div className="text-xs md:text-sm text-slate-500 dark:text-slate-400 leading-relaxed whitespace-pre-line text-justify">
              {storeInfo.rules_text}
            </div>
          </div>
        )}
        <p className="text-[10px] font-black text-gray-300 uppercase tracking-widest">CP System &copy; 2026</p>
      </div>

      {modal.isOpen && <StatusModal isOpen={modal.isOpen} title={modal.title} message={modal.message} type={modal.type} theme="neutral" confirmLabel="OK" onClose={() => setModal(prev => ({ ...prev, isOpen: false }))} />}

      <RewardSuccessModal
        {...rewardModal}
        onClose={() => {
          setRewardModal(prev => ({ ...prev, isOpen: false }));
          if (tenantSlug) {
            const cleanPhone = phone.replace(/\D/g, '');
            window.location.href = `/p/${tenantSlug}${cleanPhone ? `?phone=${cleanPhone}` : ''}`;
          }
        }}
      />
    </div >
  );
};

// --- RewardSuccessModal ---
const RewardSuccessModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  title: string;
  message: string;
  points: number;
  goal: number;
}> = ({ isOpen, onClose, title, message, points, goal }) => {
  React.useEffect(() => {
    if (isOpen && navigator.vibrate) {
      navigator.vibrate(30);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-fade-in transition-all">
      <div className="bg-white dark:bg-gray-900 p-8 rounded-[40px] shadow-2xl text-center space-y-7 max-w-sm w-full animate-scale-in border border-gray-100 dark:border-gray-800 relative overflow-hidden">

        {/* Estrelas Animadas */}
        <div className="absolute inset-0 pointer-events-none">
          <Star className="absolute top-10 left-10 w-4 h-4 text-amber-400 fill-amber-400 animate-star-rise" style={{ animationDelay: '0s' }} />
          <Star className="absolute top-14 right-14 w-6 h-6 text-amber-400 fill-amber-400 animate-star-rise" style={{ animationDelay: '0.2s' }} />
          <Star className="absolute top-12 left-1/2 w-3 h-3 text-amber-400 fill-amber-400 animate-star-rise" style={{ animationDelay: '0.4s' }} />
          <Star className="absolute top-20 right-10 w-5 h-5 text-amber-400 fill-amber-400 animate-star-rise" style={{ animationDelay: '0.1s' }} />
        </div>

        <div className="w-24 h-24 bg-slate-50 dark:bg-slate-800 rounded-3xl flex items-center justify-center mx-auto shadow-inner border border-slate-100 dark:border-slate-700 animate-pulse-soft">
          <CheckCircle2 className="w-12 h-12 text-slate-800 dark:text-white" />
        </div>

        <div className="space-y-3">
          <h3 className="text-3xl font-black text-slate-900 dark:text-white uppercase tracking-tighter leading-none">{title}</h3>
          <p className="text-sm font-bold text-slate-500 dark:text-slate-400 leading-relaxed whitespace-pre-line px-4">{message}</p>
        </div>


        <Button
          className="w-full bg-[#2B2B2B] hover:bg-[#444444] text-white rounded-[24px] font-black uppercase tracking-[0.2em] h-16 transition-all hover:scale-[1.02] active:scale-95 shadow-xl shadow-slate-400/10 focus:ring-4 focus:ring-gray-300"
          onClick={onClose}
        >
          OK, ENTENDI
        </Button>
      </div>
    </div>
  );
};


export default PublicTerminal;
