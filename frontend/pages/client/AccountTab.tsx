import React, { useState, useRef, useEffect } from 'react';
import { Card, Button, Input, Badge, StatusModal } from '../../components/ui';
import { Calendar, ShieldCheck, Upload, X, Image as ImageIcon, Lock, Send, ExternalLink, Eye, EyeOff, Copy, Settings } from 'lucide-react';
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
    reward_text: ''
  });
  const [telegramSettings, setTelegramSettings] = useState({
    bot_token: '',
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
        bot_token: settings.telegram_bot_token || '',
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
        telegram_bot_token: telegramSettings.bot_token,
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
    } catch (error) {
      setModal({
        isOpen: true,
        title: 'Erro ao Salvar',
        message: 'Não foi possível salvar as alterações. Tente novamente mais tarde.',
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
            <h2 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight">{tenantInfo.name || 'Loja'}</h2>
            <p className="text-sm text-gray-500 mb-4 font-medium leading-relaxed">
              Configure as informações básicas da sua conta.
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
                  Ative para receber notificações quando novos clientes se cadastrarem na página pública.
                </p>
              </div>
              <a href="https://t.me/BotFather" target="_blank" rel="noreferrer" className="text-[10px] font-bold text-blue-600 flex items-center gap-1 hover:underline">
                Criar Bot <ExternalLink className="w-3 h-3" />
              </a>
            </div>

            <div className="grid grid-cols-1 gap-4">
              <Input
                label="Bot Token"
                placeholder="Ex: 123456:ABC-DEF..."
                value={telegramSettings.bot_token}
                onChange={e => setTelegramSettings({ ...telegramSettings, bot_token: e.target.value })}
              />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
                <Input
                  label="Chat ID"
                  placeholder="Ex: 987654321"
                  value={telegramSettings.chat_id}
                  onChange={e => setTelegramSettings({ ...telegramSettings, chat_id: e.target.value })}
                />
                <div className="pb-3 text-[10px] text-gray-400 font-medium">
                  💡 Dica: Use o bot <b>@userinfobot</b> no Telegram para descobrir seu Chat ID.
                </div>
              </div>

              <div className="pt-4 border-t border-blue-900/10 dark:border-blue-100/10 space-y-4">
                <h4 className="text-xs font-black text-blue-700 dark:text-blue-500 uppercase tracking-widest">Opções de Aviso Sonoro</h4>

                <div className="flex items-center justify-between p-4 bg-white dark:bg-slate-900/50 rounded-xl border border-slate-100 dark:border-slate-800">
                  <div>
                    <h5 className="text-sm font-semibold text-slate-800 dark:text-slate-200">Novos Cadastros</h5>
                    <p className="text-[10px] text-slate-500 mt-0.5">Tocar som quando um cliente se cadastra na página pública</p>
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

                <div className="flex items-center justify-between p-4 bg-white dark:bg-slate-900/50 rounded-xl border border-slate-100 dark:border-slate-800">
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

                <div className="flex items-center justify-between p-4 bg-white dark:bg-slate-900/50 rounded-xl border border-slate-100 dark:border-slate-800">
                  <div>
                    <h5 className="text-sm font-semibold text-slate-800 dark:text-slate-200">Lembretes Estratégicos</h5>
                    <p className="text-[10px] text-slate-500 mt-0.5">Tocar som quando um lembrete do CRM é disparado</p>
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

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="p-6 bg-blue-50/50 dark:bg-blue-900/10 border-none">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-white dark:bg-gray-900 rounded-[15px] shadow-sm">
                  <Calendar className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <p className="text-[10px] text-blue-500 uppercase font-black tracking-widest leading-none mb-1">Validade do Plano</p>
                  <p className="text-lg font-black text-blue-900 dark:text-blue-50">{tenantInfo.plan_expires_at || '--/--/--'}</p>
                </div>
              </div>
            </Card>

            <Card className="p-6 bg-purple-50/50 dark:bg-purple-900/10 border-none">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-white dark:bg-gray-900 rounded-[15px] shadow-sm">
                    <ShieldCheck className="w-6 h-6 text-purple-600" />
                  </div>
                  <div>
                    <p className="text-[10px] text-purple-500 uppercase font-black tracking-widest leading-none mb-1">Limite de Contatos</p>
                    <p className="text-lg font-black text-purple-900 dark:text-purple-50">
                      {tenantInfo.customers_count} / {tenantInfo.plan_limit >= 999999 ? 'Ilimitado' : tenantInfo.plan_limit}
                    </p>
                  </div>
                </div>
              </div>
            </Card>
          </div>

          <div className="pt-4 space-y-4">
            <Button
              onClick={handleSave}
              isLoading={isLoading}
              className="w-full bg-primary-500 text-white h-14 text-sm font-black uppercase tracking-[0.2em] rounded-[15px] shadow-xl shadow-primary-500/20"
            >
              Salvar Configurações
            </Button>

            <div className="flex justify-center pt-2">
              <Button
                variant="ghost"
                className="text-primary-600 font-black uppercase text-xs tracking-[0.1em] bg-primary-50 hover:bg-primary-100/50 px-8 py-4 rounded-[15px] transition-all"
                onClick={() => window.open('https://wa.me/819011886491', '_blank')}
              >
                Falar com Suporte
              </Button>
            </div>
          </div>
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
    </div>
  );
};
