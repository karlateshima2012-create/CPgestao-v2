import React, { useState, useRef, useEffect } from 'react';
import { Card, Button, Input, Badge, StatusModal } from '../../components/ui';
import { Calendar, ShieldCheck, Upload, X, Image as ImageIcon, Lock, Send, ExternalLink, Eye, EyeOff, Copy, Settings, Rocket, ArrowUpCircle, Check } from 'lucide-react';
import api from '../../services/api';
import { copyToClipboard } from '../../utils/clipboard';

export const AccountTab: React.FC = () => {
  const [logo, setLogo] = useState<string | null>(null);
  const [cover, setCover] = useState<string | null>(null);
  const [tenantInfo, setTenantInfo] = useState({
    name: '',
    plan_expires_at: '',
    plan: '',
    slug: '',
    customers_count: 0,
    plan_limit: 0,
    extra_contacts_quota: 0,
    reward_text: ''
  });
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [telegramSettings, setTelegramSettings] = useState({
    chat_id: '',
    sound_registration: true,
    sound_points: true,
    sound_reminders: true
  });
  const [logoChanged, setLogoChanged] = useState(false);
  const [coverChanged, setCoverChanged] = useState(false);
  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const fileInputCoverRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const res = await api.get('/client/settings');
      const { tenant, settings } = res.data;
      setTenantInfo({
        ...tenant,
        reward_text: tenant.reward_text || ''
      });
      setLogo(tenant.logo_url || null);
      setCover(tenant.cover_url || null);
      setTelegramSettings({
        chat_id: settings.telegram_chat_id || '',
        sound_registration: settings.telegram_sound_registration ?? true,
        sound_points: settings.telegram_sound_points ?? true,
        sound_reminders: settings.telegram_sound_reminders ?? true
      });
      setCurrentPin(settings.pin || '');
      setNewPin('');
      setLogoChanged(false);
      setCoverChanged(false);
    } catch (error) {
      console.error('Error fetching settings:', error);
    }
  };

  const handleSave = async () => {
    setIsLoading(true);
    try {
      const payload: any = {
        pin: newPin,
        telegram_chat_id: telegramSettings.chat_id,
        telegram_sound_registration: telegramSettings.sound_registration,
        telegram_sound_points: telegramSettings.sound_points,
        telegram_sound_reminders: telegramSettings.sound_reminders,
        reward_text: tenantInfo.reward_text,
      };

      if (logoChanged) {
        payload.logo_url = logo;
      }
      if (coverChanged) {
        payload.cover_url = cover;
      }

      await api.patch('/client/settings', payload);
      setModal({
        isOpen: true,
        title: 'Sucesso!',
        message: 'Suas configurações foram salvas com sucesso.',
        type: 'success'
      });
      fetchSettings();
    } catch (error: any) {
      setModal({
        isOpen: true,
        title: 'Erro ao Salvar',
        message: error.response?.data?.message || error.response?.data?.error || 'Não foi possível salvar as alterações. Tente novamente mais tarde.',
        type: 'error'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      setModal({
        isOpen: true,
        title: 'Arquivo muito grande',
        message: 'A imagem de logo deve ter no máximo 2MB.',
        type: 'info'
      });
      return;
    }
    if (!file.type.startsWith('image/')) {
      setModal({
        isOpen: true,
        title: 'Formato Inválido',
        message: 'Por favor, selecione um arquivo de imagem válido (PNG, JPG, etc).',
        type: 'info'
      });
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      setLogo(event.target?.result as string);
      setLogoChanged(true);
    };
    reader.readAsDataURL(file);
  };

  const removeLogo = () => {
    setLogo(null);
    setLogoChanged(true);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleCoverUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      setModal({
        isOpen: true,
        title: 'Arquivo muito grande',
        message: 'A imagem de capa deve ter no máximo 2MB.',
        type: 'info'
      });
      return;
    }
    if (!file.type.startsWith('image/')) {
      setModal({
        isOpen: true,
        title: 'Formato Inválido',
        message: 'Por favor, selecione um arquivo de imagem válido (PNG, JPG, etc).',
        type: 'info'
      });
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      setCover(event.target?.result as string);
      setCoverChanged(true);
    };
    reader.readAsDataURL(file);
  };

  const removeCover = () => {
    setCover(null);
    setCoverChanged(true);
    if (fileInputCoverRef.current) fileInputCoverRef.current.value = '';
  };

  return (
    <div className="max-w-3xl mx-auto py-10 animate-fade-in space-y-8">
      <div>
        <h1 className="text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight">Minha Conta</h1>
        <p className="text-lg text-gray-500 dark:text-gray-400 mt-1">Gerencie as informações e configurações da sua loja.</p>
      </div>

      <Card className="p-8">
        <div className="flex flex-col md:flex-row items-center gap-8 mb-8 pb-8 border-b border-gray-100 dark:border-gray-800">
          <div className="relative group">
            <div className="w-40 h-40 md:w-48 md:h-48 rounded-[15px] bg-gray-50 dark:bg-gray-800 flex items-center justify-center overflow-hidden border-2 border-dashed border-gray-200 dark:border-gray-700 group-hover:border-primary-400 transition-all duration-300">
              {logo ? (
                <img src={logo} alt="Logo" className="w-full h-full object-cover" />
              ) : (
                <ImageIcon className="w-12 h-12 text-gray-300" />
              )}
              <button
                onClick={() => fileInputRef.current?.click()}
                className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-white"
              >
                <div className="flex flex-col items-center gap-2">
                  <Upload className="w-6 h-6" />
                  <span className="text-[10px] font-black uppercase">Carregar imagem da logo</span>
                  <span className="text-[8px] font-bold opacity-80">(aparece na sua página pública)</span>
                </div>
              </button>
            </div>
            {logo && (
              <button
                onClick={removeLogo}
                className="absolute -top-2 -right-2 p-1.5 bg-red-500 text-white rounded-full shadow-lg hover:bg-red-600 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            )}
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleLogoUpload}
              className="hidden"
              accept="image/*"
            />
          </div>

          <div className="flex-1 text-center md:text-left">
            <h2 className="text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight leading-none mb-2">{tenantInfo.name || 'Loja'}</h2>
            <p className="text-base text-gray-500 mb-4 font-medium leading-relaxed">
              Configurações gerais do estabelecimento.
            </p>
            <div className="flex flex-wrap justify-center md:justify-start gap-2">
              <Badge color="blue">{tenantInfo.plan || 'Carregando...'}</Badge>
              <span className="flex items-center gap-1 text-xs text-green-600 font-bold uppercase tracking-tighter">
                <ShieldCheck className="w-3.5 h-3.5" /> Conta Verificada
              </span>
            </div>
          </div>
        </div>

        <div className="space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

            {/* Cover Upload */}
            <div className="space-y-1 md:col-span-2">
              <label className="text-xs font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest ml-1 flex items-center gap-2">
                <ImageIcon className="w-3 h-3" /> Imagem de Capa <span className="text-[10px] font-bold text-primary-500/70 lowercase tracking-normal">(aparece de fundo na sua página pública)</span>
              </label>
              <div className="relative group mt-2">
                <div className="w-full h-40 md:h-48 rounded-[15px] bg-gray-50 dark:bg-gray-800 flex items-center justify-center overflow-hidden border-2 border-dashed border-gray-200 dark:border-gray-700 group-hover:border-primary-400 transition-all duration-300">
                  {cover ? (
                    <img src={cover} alt="Cover" className="w-full h-full object-cover" />
                  ) : (
                    <div className="flex flex-col items-center gap-2 text-gray-300">
                      <ImageIcon className="w-10 h-10" />
                      <span className="text-xs font-bold uppercase tracking-widest">Adicionar Capa</span>
                    </div>
                  )}
                  <button
                    onClick={() => fileInputCoverRef.current?.click()}
                    className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-white"
                  >
                    <div className="flex flex-col items-center gap-2">
                      <Upload className="w-6 h-6" />
                      <span className="text-[10px] font-black uppercase">Carregar imagem de capa</span>
                    </div>
                  </button>
                </div>
                {cover && (
                  <button
                    onClick={removeCover}
                    className="absolute -top-2 -right-2 p-1.5 bg-red-500 text-white rounded-full shadow-lg hover:bg-red-600 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
                <input
                  type="file"
                  ref={fileInputCoverRef}
                  onChange={handleCoverUpload}
                  className="hidden"
                  accept="image/*"
                />
              </div>
            </div>



            <div className="space-y-1 md:col-span-2">
              <label className="text-xs font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest ml-1 flex items-center gap-2">
                <ExternalLink className="w-3 h-3" /> LINK DA SUA PÁGINA PÚBLICA
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  readOnly
                  value={`${window.location.origin}/p/${tenantInfo.slug}`}
                  className="flex-1 px-4 py-3.5 bg-gray-50 dark:bg-gray-900/30 border border-gray-100 dark:border-gray-800 rounded-[15px] text-gray-500 font-medium text-sm outline-none"
                />
                <div className="flex flex-col items-center gap-1">
                  <Button
                    variant="secondary"
                    className="px-4 rounded-[15px] border-gray-100 h-[52px]"
                    type="button"
                    onClick={async () => {
                      const success = await copyToClipboard(`${window.location.origin}/p/${tenantInfo.slug}`);
                      if (success) {
                        setModal({
                          isOpen: true,
                          title: 'Link Copiado!',
                          message: 'O link do terminal já está na sua área de transferência.',
                          type: 'success'
                        });
                      } else {
                        setModal({
                          isOpen: true,
                          title: 'Erro ao Copiar',
                          message: 'Não foi possível copiar o link. Por favor, copie manualmente.',
                          type: 'error'
                        });
                      }
                    }}
                  >
                    <Copy className="w-4 h-4" />
                  </Button>
                  <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Copiar</span>
                </div>
              </div>
              <p className="text-[10px] text-gray-400 ml-1 font-bold">Encaminhe este link para seus clientes se cadastarem ou consultarem saldo.</p>
            </div>
          </div>

          {/* Telegram Notifications Section */}
          <div className="bg-blue-50/30 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-900/30 p-6 rounded-[15px] space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex flex-col gap-1">
                <h3 className="text-sm font-black text-blue-700 dark:text-blue-500 uppercase tracking-widest flex items-center gap-2">
                  <Send className="w-4 h-4" /> Notificações Telegram
                </h3>
                <p className="text-[10px] text-blue-600/70 font-bold ml-6">
                  Ative para receber avisos de novos cadastros e lembretes estratégicos.
                </p>
              </div>
              <a href="https://t.me/cpgestao_fidelidade_bot" target="_blank" rel="noreferrer" className="text-[10px] font-black p-2 bg-blue-100 dark:bg-blue-900/40 rounded-lg text-blue-600 flex items-center gap-2 hover:bg-blue-200 transition-colors">
                <Check className="w-3.5 h-3.5" /> ATIVAR BOT <ExternalLink className="w-3 h-3" />
              </a>
            </div>

            <div className="grid grid-cols-1 gap-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
                <Input
                  label="Seu Chat ID"
                  placeholder="Ex: 987654321"
                  value={telegramSettings.chat_id}
                  onChange={e => setTelegramSettings({ ...telegramSettings, chat_id: e.target.value })}
                />
                <div className="pb-3 text-[10px] text-blue-600 dark:text-blue-400 font-bold bg-blue-50/50 dark:bg-blue-900/20 p-4 rounded-[12px] border border-blue-100 dark:border-blue-800/50">
                  💡 <b>INSTRUÇÃO:</b> No Telegram, clique em <b>INICIAR</b> (/start) e o bot responderá instantaneamente com o seu <b>Número ID</b>. Copie e cole no campo ao lado.
                </div>
              </div>

              <div className="pt-4 border-t border-blue-900/10 dark:border-blue-100/10 space-y-4">
                <h4 className="text-xs font-black text-blue-700 dark:text-blue-500 uppercase tracking-widest">Opções de Aviso Sonoro</h4>

                <div className="flex items-center justify-between p-4 bg-white dark:bg-slate-900/50 rounded-xl border border-slate-100 dark:border-slate-800 shadow-sm">
                  <div>
                    <h5 className="text-sm font-semibold text-slate-800 dark:text-slate-200">Novos Cadastros</h5>
                    <p className="text-[10px] text-slate-500 mt-0.5">Notificar quando um cliente se cadastra na sua página pública</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      className="sr-only peer"
                      checked={telegramSettings.sound_registration}
                      onChange={(e) => setTelegramSettings({ ...telegramSettings, sound_registration: e.target.checked })}
                    />
                    <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-slate-600 peer-checked:bg-primary-500"></div>
                  </label>
                </div>

                {tenantInfo.plan.toLowerCase() !== 'classic' && (
                  <div className="flex items-center justify-between p-4 bg-white dark:bg-slate-900/50 rounded-xl border border-slate-100 dark:border-slate-800 shadow-sm animate-fade-in">
                    <div>
                      <h5 className="text-sm font-semibold text-slate-800 dark:text-slate-200">Pedidos de Ponto (Totem)</h5>
                      <p className="text-[10px] text-slate-500 mt-0.5">Tocar som quando um cliente pede ponto no modo aprovação</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        className="sr-only peer"
                        checked={telegramSettings.sound_points}
                        onChange={(e) => setTelegramSettings({ ...telegramSettings, sound_points: e.target.checked })}
                      />
                      <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-slate-600 peer-checked:bg-primary-500"></div>
                    </label>
                  </div>
                )}

                <div className="flex items-center justify-between p-4 bg-white dark:bg-slate-900/50 rounded-xl border border-slate-100 dark:border-slate-800 shadow-sm">
                  <div>
                    <h5 className="text-sm font-semibold text-slate-800 dark:text-slate-200">Lembretes Estratégicos</h5>
                    <p className="text-[10px] text-slate-500 mt-0.5">Notificar quando um lembrete do CRM é disparado</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      className="sr-only peer"
                      checked={telegramSettings.sound_reminders}
                      onChange={(e) => setTelegramSettings({ ...telegramSettings, sound_reminders: e.target.checked })}
                    />
                    <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-slate-600 peer-checked:bg-primary-500"></div>
                  </label>
                </div>
              </div>
            </div>
          </div>

          {/* Plan Status & Limits Unified Card */}
          <Card className="p-0 border-none shadow-xl overflow-hidden bg-white dark:bg-slate-900">
            <div className="bg-gradient-to-r from-primary-600 to-primary-400 p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-white/20 backdrop-blur-md rounded-[12px]">
                    <Rocket className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-white uppercase tracking-wider">Status do Plano</h3>
                    <p className="text-[10px] text-white/70 font-bold uppercase tracking-widest">Resumo de utilização e validade</p>
                  </div>
                </div>
                <Badge variant="secondary" className="bg-white/20 text-white border-none px-4 py-1.5 rounded-full text-[10px] font-black tracking-widest uppercase">
                  Plano {tenantInfo.plan}
                </Badge>
              </div>
            </div>

            <div className="p-8 space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Validity Metric */}
                <div className="flex items-center gap-5">
                  <div className="p-4 bg-primary-50 dark:bg-primary-900/20 rounded-2xl shadow-inner border border-primary-100/30">
                    <Calendar className="w-6 h-6 text-primary-600" />
                  </div>
                  <div>
                    <p className="text-[10px] text-primary-500 uppercase font-black tracking-widest leading-none mb-1.5">Validade da Licença</p>
                    <p className="text-xl font-black text-slate-800 dark:text-slate-100 tabular-nums">
                      {tenantInfo.plan_expires_at || '--/--/--'}
                    </p>
                  </div>
                </div>

                {/* Contact Limit Metric */}
                <div className="flex items-center gap-5">
                  <div className="p-4 bg-primary-50 dark:bg-primary-900/20 rounded-2xl shadow-inner border border-primary-100/30">
                    <ShieldCheck className="w-6 h-6 text-primary-600" />
                  </div>
                  <div>
                    <p className="text-[10px] text-primary-500 uppercase font-black tracking-widest leading-none mb-1.5">Limite de Contatos</p>
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-xl font-black text-slate-800 dark:text-slate-100 tabular-nums">
                        {tenantInfo.customers_count.toLocaleString()}
                      </span>
                      <span className="text-sm font-bold text-slate-300">/</span>
                      <span className="text-xl font-black text-slate-800 dark:text-slate-100 tabular-nums">
                        {tenantInfo.plan_limit >= 999999 ? '∞' : tenantInfo.plan_limit.toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Progress Bar Section */}
              {tenantInfo.plan_limit < 999999 && (
                <div className="space-y-3">
                  <div className="flex justify-between items-end px-1">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Uso da Capacidade</span>
                    <span className={`text-xs font-black ${(tenantInfo.customers_count / tenantInfo.plan_limit) >= 0.9 ? 'text-red-500' :
                      (tenantInfo.customers_count / tenantInfo.plan_limit) >= 0.8 ? 'text-orange-500' : 'text-primary-600'
                      }`}>
                      {Math.round((tenantInfo.customers_count / tenantInfo.plan_limit) * 100)}%
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 dark:bg-slate-800 h-3 rounded-full overflow-hidden p-0.5 border border-slate-200/50 dark:border-slate-700">
                    <div
                      className={`h-full rounded-full transition-all duration-1000 shadow-sm ${(tenantInfo.customers_count / tenantInfo.plan_limit) >= 0.9 ? 'bg-gradient-to-r from-red-600 to-red-400' :
                        (tenantInfo.customers_count / tenantInfo.plan_limit) >= 0.8 ? 'bg-gradient-to-r from-orange-600 to-orange-400' : 'bg-gradient-to-r from-primary-600 to-primary-400'
                        }`}
                      style={{ width: `${Math.min(100, (tenantInfo.customers_count / tenantInfo.plan_limit) * 100)}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Quick Actions inside Card */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-slate-100 dark:border-slate-800">
                <Button
                  variant="ghost"
                  className="h-12 border-primary-100 dark:border-slate-700 text-primary-600 dark:text-primary-400 font-bold uppercase text-[10px] tracking-widest hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded-xl"
                  onClick={() => window.open('https://wa.me/819011886491', '_blank')}
                >
                  Falar com Suporte
                </Button>

                {tenantInfo.plan_limit < 999999 && (
                  <Button
                    onClick={() => setShowUpgradeModal(true)}
                    className="h-12 bg-primary-600 hover:bg-primary-700 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-primary-500/20 flex items-center justify-center gap-2"
                  >
                    <ArrowUpCircle className="w-4 h-4" /> Solicitar Upgrade
                  </Button>
                )}
              </div>
            </div>
          </Card>

          <Button
            onClick={handleSave}
            isLoading={isLoading}
            className="w-full bg-blue-600 hover:bg-blue-700 dark:bg-primary-600 text-white h-14 text-sm font-black uppercase tracking-[0.2em] rounded-[15px] shadow-xl shadow-blue-500/20"
          >
            Salvar Configurações
          </Button>
        </div>
      </Card>
      {modal.isOpen && (
        <StatusModal
          isOpen={modal.isOpen}
          title={modal.title}
          message={modal.message}
          type={modal.type}
          theme="accent"
          onClose={() => setModal(prev => ({ ...prev, isOpen: false }))}
        />
      )}

      {/* MODAL DE UPGRADE */}
      {showUpgradeModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-2 sm:p-4 bg-black/60 backdrop-blur-md animate-fade-in overflow-y-auto">
          <Card className="w-full max-w-2xl p-0 shadow-2xl overflow-hidden animate-scale-up my-auto max-h-[95vh] flex flex-col">
            <div className="p-4 sm:p-8 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center bg-gray-50/50 dark:bg-gray-900/50 shrink-0">
              <div>
                <h3 className="text-xl sm:text-2xl font-black text-gray-900 dark:text-white flex items-center gap-3">
                  <Rocket className="w-5 h-5 sm:w-6 sm:h-6 text-purple-600" /> Upgrade de Base
                </h3>
                <p className="text-[10px] sm:text-xs text-gray-500 font-bold uppercase tracking-widest mt-1">Expanda seu limite de contatos instantaneamente</p>
              </div>
              <button
                onClick={() => setShowUpgradeModal(false)}
                className="p-2 hover:bg-gray-200 dark:hover:bg-gray-800 rounded-full transition-colors"
              >
                <X className="w-6 h-6 text-gray-400" />
              </button>
            </div>

            <div className="p-4 sm:p-8 overflow-y-auto">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {[
                  { name: 'Pack Bronze', extra: '+1.000', price: '¥ 2.500', color: 'orange' },
                  { name: 'Pack Prata', extra: '+2.000', price: '¥ 4.500', color: 'blue' },
                  { name: 'Pack Ouro', extra: '+4.000', price: '¥ 8.000', color: 'yellow' },
                  { name: 'Pack Infinity', extra: 'Ilimitado', price: 'Consultar', color: 'purple' },
                ].map((pack) => {
                  const colorClasses: Record<string, string> = {
                    orange: 'bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400',
                    blue: 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400',
                    yellow: 'bg-yellow-50 dark:bg-yellow-900/20 text-yellow-600 dark:text-yellow-400',
                    purple: 'bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400',
                  };
                  return (
                    <div key={pack.name} className="relative group">
                      <div className={`h-full border-2 border-gray-100 dark:border-gray-800 rounded-3xl p-6 transition-all hover:border-purple-500 hover:shadow-xl hover:shadow-purple-500/10 bg-white dark:bg-gray-900`}>
                        <div className="flex justify-between items-start mb-4">
                          <div className={`p-3 rounded-2xl ${colorClasses[pack.color] || 'bg-gray-50 text-gray-600'}`}>
                            <ArrowUpCircle className="w-6 h-6" />
                          </div>
                          <Badge color={pack.color as any}>{pack.price}</Badge>
                        </div>
                        <h4 className="text-xl font-black text-gray-900 dark:text-white mb-1">{pack.name}</h4>
                        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-6">{pack.extra} contatos</p>

                        <Button
                          onClick={() => {
                            const message = `Olá Karla! Gostaria de solicitar o upgrade do meu CPgestao-v2.
Loja: ${tenantInfo.name}
Plano Atual: ${tenantInfo.plan}
Pacote Escolhido: ${pack.name} (Valor: ${pack.price})`;
                            window.open(`https://wa.me/819011886491?text=${encodeURIComponent(message)}`, '_blank');
                          }}
                          className="w-full bg-gray-900 dark:bg-white dark:text-gray-900 text-white font-black uppercase text-[10px] tracking-widest py-3 rounded-xl hover:bg-purple-600 dark:hover:bg-purple-500 transition-all border-none"
                        >
                          Solicitar Upgrade
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="mt-8 p-6 bg-purple-50 dark:bg-purple-900/20 rounded-3xl border border-purple-100 dark:border-purple-900/30 flex items-center gap-4">
                <div className="p-3 bg-white dark:bg-gray-900 rounded-full text-purple-600 shadow-sm">
                  <Settings className="w-5 h-5 animate-spin-slow" />
                </div>
                <div className="flex-1">
                  <p className="text-xs font-black text-purple-900 dark:text-purple-100 uppercase tracking-widest leading-tight">Pagamento Único e Vitalício</p>
                  <p className="text-[10px] text-purple-600 dark:text-purple-400 font-bold mt-0.5">Adquira agora e mantenha seu limite extra para sempre, mesmo se trocar de plano.</p>
                </div>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};
