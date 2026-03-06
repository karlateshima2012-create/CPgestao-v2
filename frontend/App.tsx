import React, { useState, useEffect } from 'react';
import { AdminDashboard } from './pages/AdminDashboard';
import { ClientCRM } from './pages/ClientCRM';
import { PublicTerminal } from './pages/PublicTerminal';
import { ForgotPasswordScreen, ResetPasswordScreen, FirstAccessChangeScreen } from './pages/AuthScreens';
import { OnboardingModal } from './pages/OnboardingModal';
import {
  LayoutDashboard,
  Users,
  Settings,
  Moon,
  Sun,
  Menu,
  LogOut,
  UserPlus,
  Download,
  UserCircle,
  Calendar,
  ArrowRight,
  Star,
  ChevronLeft,
  AlertTriangle,
  X,
  Smartphone
} from 'lucide-react';
import { Button, Input } from './components/ui';
import { Contact, PlanType } from './types';
import api from './services/api';

type Role = 'admin' | 'client' | 'terminal' | null;
type ClientTab = 'dashboard' | 'clients' | 'loyalty' | 'devices' | 'requests' | 'new' | 'export' | 'account';

const CPLogo: React.FC<{ className?: string }> = ({ className = "w-12 h-12" }) => (
  <div className={`grid grid-cols-4 grid-rows-4 gap-[8%] ${className}`}>
    <div className="col-span-2 row-span-2 bg-[#ec4899] rounded-[15%]"></div>
    <div className="col-start-3 row-start-1 col-span-1 row-span-1 bg-[#facc15] rounded-[15%]"></div>
    <div className="col-start-3 row-start-2 col-span-1 row-span-1 bg-[#25aae1] rounded-[15%]"></div>
    <div className="col-start-4 row-start-2 col-span-1 row-span-1 bg-[#ec4899] rounded-[15%]"></div>
    <div className="col-span-2 row-span-2 bg-[#25aae1] rounded-[15%]"></div>
    <div className="col-span-2 row-span-2 bg-[#facc15] rounded-[15%]"></div>
  </div>
);

const SidebarItem: React.FC<{
  icon: any,
  label: string,
  active?: boolean,
  onClick: () => void,
  collapsed: boolean,
  id?: string,
  onboardingActive?: boolean
}> = ({ icon: Icon, label, active, onClick, collapsed, id, onboardingActive }) => (
  <button
    id={id}
    onClick={onClick}
    className={`w-full flex items-center px-4 py-3 mb-2 rounded-xl transition-all duration-200 group ${active
      ? 'bg-primary-500 text-white shadow-md shadow-primary-500/20'
      : 'text-gray-600 hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-gray-800'
      } ${onboardingActive ? 'onboarding-pulse' : ''}`}
  >
    <Icon className={`w-5 h-5 flex-shrink-0 ${active ? 'text-white' : 'text-gray-700 group-hover:text-gray-900 dark:text-gray-400 dark:group-hover:text-white'}`} />
    {!collapsed && (
      <span className="ml-3 font-medium text-sm whitespace-nowrap overflow-hidden">{label}</span>
    )}
  </button>
);

const App: React.FC = () => {
  const [authRole, setAuthRole] = useState<Role>(null);
  const [clientTab, setClientTab] = useState<ClientTab>('dashboard');
  const [darkMode, setDarkMode] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [loginForm, setLoginForm] = useState({ email: '', password: '' });
  const [isLoading, setIsLoading] = useState(false);
  const [blockedReason, setBlockedReason] = useState<string | null>(null);
  const [tenantSlug, setTenantSlug] = useState<string | null>(null);
  const [authView, setAuthView] = useState<'login' | 'forgot-password' | 'reset-password' | 'first-access'>('login');
  const [resetToken, setResetToken] = useState<string | null>(null);
  const [resetEmail, setResetEmail] = useState<string | null>(null);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [userData, setUserData] = useState<any>(null);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [dashboardMetrics, setDashboardMetrics] = useState<any>(null);
  const [pendingRequestsCount, setPendingRequestsCount] = useState(0);
  const [accountSettings, setAccountSettings] = useState<any>(null);

  const playNotificationSound = () => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();

      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(880, audioCtx.currentTime); // A5
      oscillator.frequency.exponentialRampToValueAtTime(440, audioCtx.currentTime + 0.5); // A4

      gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.5);

      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);

      oscillator.start();
      oscillator.stop(audioCtx.currentTime + 0.5);
    } catch (e) {
      console.warn('Audio alert failed:', e);
    }
  };

  useEffect(() => {
    const root = window.document.documentElement;
    if (darkMode) root.classList.add('dark');
    else root.classList.remove('dark');
  }, [darkMode]);

  // Check login on load
  useEffect(() => {
    const isPublic = window.location.pathname.startsWith('/terminal') || window.location.pathname.startsWith('/p/');
    if (isPublic) return;

    const token = localStorage.getItem('auth_token');
    if (token) {
      api.get('/me').then(res => {
        setUserData(res.data);
        setAuthRole(res.data.role);
        if (res.data.tenant) {
          setTenantSlug(res.data.tenant.slug);
        }
        if (res.data.role === 'client') {
          const params = new URLSearchParams(window.location.search);
          const urlTab = params.get('tab') as ClientTab;
          if (urlTab) setClientTab(urlTab);

          fetchContacts();
          fetchDashboardMetrics();
          if (!res.data.onboarding_completed) {
            setShowOnboarding(true);
          }
          fetchAccountSettings();
        }
      }).catch((err) => {
        if (err.response?.status === 403) {
          setBlockedReason(err.response.data.error || 'Acesso Suspenso');
          setAuthRole('client'); // Still set as client to show the layout but with blocked content
        } else {
          localStorage.removeItem('auth_token');
        }
      });
    }
  }, []);

  // Check for reset password token in URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('reset_token');
    const email = params.get('email');
    if (token && email) {
      setResetToken(token);
      setResetEmail(email);
      setAuthView('reset-password');
      // Clean URL
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  const fetchContacts = async () => {
    try {
      const res = await api.get('/client/contacts');
      const mapped = (Array.isArray(res.data) ? res.data : [])
        .map((c: any) => {
          if (!c) return null;
          return {
            ...c,
            name: c.name || '',
            phone: c.phone || '',
            pointsBalance: c.points_balance ?? c.pointsBalance ?? 0,
            loyaltyLevel: c.loyalty_level ?? 1,
            loyalty_level_name: c.loyalty_level_name,
            postalCode: c.postal_code,
            address: c.address,
            linkedCard: c.devices && c.devices.length > 0 ? (c.devices[0].uid_formatted || c.devices[0].uid) : null,
            lastContacted: c.last_contacted ?? c.lastContacted,
            reminderDate: c.reminder_date ?? c.reminderDate,
            reminderText: c.reminder_text ?? c.reminderText,
            totalSpent: c.total_spent ?? c.totalSpent ?? 0,
            averageTicket: c.average_ticket ?? c.averageTicket ?? 0,
            attendanceCount: c.attendance_count ?? c.attendanceCount ?? 0,
          };
        })
        .filter(Boolean);
      setContacts(mapped as any);
      setBlockedReason(null);
    } catch (error: any) {
      if (error.response?.status === 403) {
        setBlockedReason(error.response.data.error || 'Acesso Suspenso');
      }
      console.error('Error fetching contacts:', error);
    }
  };

  const fetchDashboardMetrics = async (params = {}) => {
    try {
      const res = await api.get('/client/dashboard/metrics', { params });
      setDashboardMetrics(res.data);
    } catch (error) {
      console.error('Error fetching dashboard metrics:', error);
    }
  };

  const fetchPendingRequestsCount = async (shouldNotify = false) => {
    try {
      const res = await api.get('/client/point-requests/count');
      const newCount = res.data.count;

      if (shouldNotify && newCount > pendingRequestsCount && accountSettings?.telegram_sound_points) {
        playNotificationSound();
      }

      setPendingRequestsCount(newCount);
    } catch (error) {
      console.error('Error fetching requests count:', error);
    }
  };

  const fetchAccountSettings = async () => {
    try {
      const res = await api.get('/client/settings');
      setAccountSettings(res.data.settings);
    } catch (error) {
      console.error('Error fetching account settings:', error);
    }
  };

  const refreshAllData = (params = {}) => {
    if (authRole === 'client') {
      fetchContacts();
      fetchDashboardMetrics(params);
      fetchPendingRequestsCount();
    }
  };

  // Re-fetch when switching to dashboard or clients tab to ensure fresh data
  useEffect(() => {
    if (authRole === 'client' && (clientTab === 'dashboard' || clientTab === 'clients' || clientTab === 'requests')) {
      refreshAllData();
    }
  }, [clientTab, authRole]);

  // Periodic polling for pending requests
  useEffect(() => {
    let interval: any;
    if (authRole === 'client') {
      interval = setInterval(() => {
        fetchPendingRequestsCount(true);
      }, 20000); // Polling every 20 seconds
    }
    return () => clearInterval(interval);
  }, [authRole, pendingRequestsCount, accountSettings]);

  const handleLogin = async (email?: string, password?: string) => {
    setIsLoading(true);
    try {
      const res = await api.post('/auth/login', {
        email: (email || loginForm.email).trim().replace(/\.+$/, ''),
        password: password || loginForm.password,
      });

      const user = res.data.user;

      if (user.must_change_password) {
        localStorage.setItem('auth_token', res.data.access_token);
        setAuthView('first-access');
        return;
      }

      localStorage.setItem('auth_token', res.data.access_token);
      setUserData(user);
      setAuthRole(user.role);
      if (user.tenant) {
        setTenantSlug(user.tenant.slug);
      }
      if (user.role === 'client') {
        const params = new URLSearchParams(window.location.search);
        const urlTab = params.get('tab') as ClientTab;
        if (urlTab) {
          setClientTab(urlTab);
        } else {
          setClientTab('dashboard');
        }

        fetchContacts();
        fetchDashboardMetrics();
        if (!user.onboarding_completed) {
          setShowOnboarding(true);
        }
        fetchAccountSettings();
      }
    } catch (error) {
      alert('Falha no login. Verifique suas credenciais.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('auth_token');
    setAuthRole(null);
    setTenantSlug(null);
    setShowOnboarding(false);
    setIsMobileMenuOpen(false);
  };

  const handleCompleteOnboarding = async () => {
    try {
      await api.post('/auth/complete-onboarding');
      setShowOnboarding(false);
    } catch (error) {
      console.error('Error completing onboarding:', error);
      setShowOnboarding(false); // Still hide it to not block the user
    }
  };

  const updateSingleContactPoints = (phone: string, pointsToAdd: number) => {
    setContacts(prev => prev.map(c => {
      if (c.phone === phone || c.phone.replace(/\D/g, '') === phone.replace(/\D/g, '')) {
        return { ...c, pointsBalance: (c.pointsBalance || 0) + pointsToAdd };
      }
      return c;
    }));
  };

  const registerNewContact = (contact: Contact) => {
    setContacts(prev => [contact, ...prev]);
  };

  const isPublicTerminal = window.location.pathname.includes('/terminal') || window.location.pathname.includes('/p/');

  if (isPublicTerminal) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 font-sans">
        <PublicTerminal />
      </div>
    );
  }

  if (authRole === 'terminal') {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 font-sans">
        <div className="absolute top-6 left-6 z-50">
          <Button variant="ghost" onClick={() => setAuthRole('client')} className="text-gray-500 bg-white/80 backdrop-blur shadow-sm">
            <ChevronLeft className="w-4 h-4 mr-2" /> Voltar ao Painel
          </Button>
        </div>
        <PublicTerminal
          slug={tenantSlug || undefined}
          forceShowOwnerActions={true}
          contacts={contacts}
          onUpdatePoints={updateSingleContactPoints}
          onQuickRegister={registerNewContact}
        />
      </div>
    );
  }

  if (!authRole) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 dark:bg-gray-950 p-4 font-sans transition-colors">
        <div className="bg-white dark:bg-gray-900 w-full max-w-[420px] p-8 md:p-10 rounded-[2rem] shadow-xl shadow-gray-200/50 dark:shadow-none border-t-[6px] border-t-[#25aae1] relative z-10">
          <div className="flex items-center justify-center gap-4 mb-8">
            <CPLogo className="w-14 h-14 shrink-0" />
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white leading-tight">CP - CRM Gestão</h1>
          </div>

          {authView === 'login' && (
            <div className="space-y-5">
              <Input
                label="Email"
                type="email"
                autoComplete="email"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck="false"
                placeholder="seu@email.com"
                value={loginForm.email}
                onChange={(e) => setLoginForm({ ...loginForm, email: e.target.value })}
              />
              <div className="space-y-1">
                <Input
                  label="Senha"
                  type="password"
                  placeholder="Mínimo 8 caracteres"
                  minLength={8}
                  value={loginForm.password}
                  onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
                />
                <div className="text-right">
                  <button
                    onClick={() => setAuthView('forgot-password')}
                    className="text-xs font-bold text-[#25aae1] hover:underline"
                  >
                    Esqueceu a senha?
                  </button>
                </div>
              </div>
              <button
                className="w-full py-3.5 bg-[#25aae1] hover:bg-[#1c98ce] text-white font-bold rounded-xl shadow-lg shadow-cyan-500/20 transition-all active:scale-[0.98] flex items-center justify-center gap-2 mt-2 disabled:opacity-50"
                onClick={() => handleLogin()}
                disabled={isLoading}
              >
                {isLoading ? 'Entrando...' : 'Entrar'} <ArrowRight className="w-5 h-5 text-white" />
              </button>
            </div>
          )}

          {authView === 'forgot-password' && (
            <ForgotPasswordScreen onBack={() => setAuthView('login')} />
          )}

          {authView === 'first-access' && (
            <FirstAccessChangeScreen
              onBack={() => { handleLogout(); setAuthView('login'); }}
              onSuccess={() => {
                // Refresh user data after password change
                api.get('/me').then(res => {
                  setUserData(res.data);
                  setAuthRole(res.data.role);
                  if (res.data.tenant) setTenantSlug(res.data.tenant.slug);
                  if (res.data.role === 'client') {
                    fetchContacts();
                    if (!res.data.onboarding_completed) {
                      setShowOnboarding(true);
                    }
                  }
                  setAuthView('login');
                });
              }}
            />
          )}

          {authView === 'reset-password' && resetToken && (
            <ResetPasswordScreen
              token={resetToken}
              email={resetEmail || ''}
              onBack={() => setAuthView('login')}
            />
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-[#f8fafc] dark:bg-gray-950 overflow-hidden font-sans">
      {/* Sidebar Mobile Overlay */}
      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-30 md:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      <aside className={`
        fixed inset-y-0 left-0 z-40 w-72 bg-white dark:bg-gray-900 border-r border-gray-100 dark:border-gray-800 transition-transform duration-300 transform 
        ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'} 
        md:relative md:translate-x-0 ${sidebarCollapsed ? 'md:w-20' : 'md:w-72'}
        flex flex-col shadow-[2px_0_24px_-12px_rgba(0,0,0,0.05)]
        ${authRole === 'admin' ? 'hidden' : ''}
      `}>
        <div className="h-24 flex items-center px-6 mb-2">
          <div className="flex items-center justify-between w-full">
            {!sidebarCollapsed ? (
              <div className="flex items-center gap-3">
                <CPLogo className="w-9 h-9 shrink-0" />
                <div>
                  <h1 className="font-bold text-gray-900 dark:text-white text-base leading-tight">
                    {authRole === 'admin' ? 'Admin Panel' : 'CP - CRM Gestão'}
                  </h1>
                  <p className="text-xs text-gray-400">Sistema de Gestão</p>
                </div>
              </div>
            ) : (
              <div className="mx-auto"><CPLogo className="w-9 h-9" /></div>
            )}
            <button className="md:hidden p-2 text-gray-500" onClick={() => setIsMobileMenuOpen(false)}>
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
        <div className="flex-1 px-4 py-2 overflow-y-auto no-scrollbar">
          {authRole === 'admin' ? (
            <>
              <SidebarItem icon={LayoutDashboard} label="Visão Geral" active={clientTab === 'dashboard'} onClick={() => { setClientTab('dashboard'); setIsMobileMenuOpen(false); }} collapsed={sidebarCollapsed} />
            </>
          ) : (
            <>
              <SidebarItem id="side-tab-dashboard" icon={LayoutDashboard} label="Dashboard" onboardingActive={showOnboarding && clientTab === 'dashboard'} active={clientTab === 'dashboard'} onClick={() => { setClientTab('dashboard'); setIsMobileMenuOpen(false); }} collapsed={sidebarCollapsed} />

              <div className="relative">
                <SidebarItem id="side-tab-requests" icon={Calendar} label="Solicitações" active={clientTab === 'requests'} onClick={() => { setClientTab('requests'); setIsMobileMenuOpen(false); }} collapsed={sidebarCollapsed} />
                {pendingRequestsCount > 0 && (
                  <div className={`absolute ${sidebarCollapsed ? 'top-1 right-3' : 'top-3 right-4'} bg-red-500 text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center border-2 border-white dark:border-gray-900 pointer-events-none`}>
                    {pendingRequestsCount}
                  </div>
                )}
              </div>

              <SidebarItem id="side-tab-loyalty" icon={Star} label="Programa de Fidelidade" onboardingActive={showOnboarding && clientTab === 'loyalty'} active={clientTab === 'loyalty'} onClick={() => { setSelectedContact(null); setClientTab('loyalty'); setIsMobileMenuOpen(false); }} collapsed={sidebarCollapsed} />
              <SidebarItem id="side-tab-devices" icon={Smartphone} label="Gerenciar Dispositivos" onboardingActive={showOnboarding && clientTab === 'devices'} active={clientTab === 'devices'} onClick={() => { setSelectedContact(null); setClientTab('devices'); setIsMobileMenuOpen(false); }} collapsed={sidebarCollapsed} />
              <SidebarItem id="side-tab-clients" icon={Calendar} label="Meus Clientes" onboardingActive={showOnboarding && clientTab === 'clients'} active={clientTab === 'clients'} onClick={() => { setSelectedContact(null); setClientTab('clients'); setIsMobileMenuOpen(false); }} collapsed={sidebarCollapsed} />
              <SidebarItem id="side-tab-new" icon={UserPlus} label="Novo Cadastro" onboardingActive={showOnboarding && clientTab === 'new'} active={clientTab === 'new'} onClick={() => { setSelectedContact(null); setClientTab('new'); setIsMobileMenuOpen(false); }} collapsed={sidebarCollapsed} />
              <SidebarItem id="side-tab-export" icon={Download} label="Exportar Dados" onboardingActive={showOnboarding && clientTab === 'export'} active={clientTab === 'export'} onClick={() => { setSelectedContact(null); setClientTab('export'); setIsMobileMenuOpen(false); }} collapsed={sidebarCollapsed} />
              <SidebarItem id="side-tab-account" icon={UserCircle} label="Minha Conta" onboardingActive={showOnboarding && clientTab === 'account'} active={clientTab === 'account'} onClick={() => { setSelectedContact(null); setClientTab('account'); setIsMobileMenuOpen(false); }} collapsed={sidebarCollapsed} />
            </>
          )}
        </div>
        <div className="p-4 border-t border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 space-y-1">
          <button onClick={handleLogout} className={`w-full flex items-center px-3 py-2.5 text-sm font-medium text-gray-700 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10 rounded-xl transition-colors ${sidebarCollapsed ? 'justify-center' : ''}`}>
            <LogOut className={`w-5 h-5 ${sidebarCollapsed ? '' : 'mr-3'} text-gray-700`} />
            {!sidebarCollapsed && "Sair da conta"}
          </button>
        </div>
      </aside>
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        <header className="h-20 bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between px-8 sticky top-0 z-10">
          <div className="flex items-center gap-4">
            {authRole !== 'admin' && (
              <Button variant="ghost" size="sm" className="md:hidden" onClick={() => setIsMobileMenuOpen(true)}>
                <Menu className="w-5 h-5 text-gray-700 border-none" />
              </Button>
            )}
            <div className="flex items-center gap-4">
              {authRole === 'admin' && <CPLogo className="w-10 h-10" />}
              <div>
                <h1 className="text-xl font-bold text-gray-900 dark:text-white">
                  {authRole === 'admin' ? 'Super Admin' : (userData?.tenant?.name || 'Painel')}
                </h1>
                <p className="text-sm text-gray-500">
                  Painel de Gerenciamento
                </p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <button onClick={() => setDarkMode(!darkMode)} className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 transition-colors">
              {darkMode ? <Sun className="w-5 h-5 text-gray-700" /> : <Moon className="w-5 h-5 text-gray-700" />}
            </button>
            {authRole === 'admin' && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleLogout}
                className="text-gray-500 hover:text-red-500 hover:bg-red-50"
              >
                <LogOut className="w-5 h-5 mr-2" /> Sair
              </Button>
            )}
          </div>
        </header>
        <div className="flex-1 overflow-y-auto p-4 md:p-8 scroll-smooth bg-[#f8fafc] dark:bg-gray-950">
          <div className="max-w-7xl mx-auto">
            {authRole === 'admin' ? (
              <AdminDashboard />
            ) : blockedReason ? (
              <div className="flex flex-col items-center justify-center py-20 text-center space-y-6">
                <div className="w-24 h-24 bg-red-50 dark:bg-red-900/10 rounded-full flex items-center justify-center">
                  <AlertTriangle className="w-12 h-12 text-red-600" />
                </div>
                <div className="space-y-2">
                  <h2 className="text-3xl font-black text-gray-900 dark:text-white uppercase tracking-tight">Acesso Suspenso</h2>
                  <p className="text-gray-500 max-w-md mx-auto font-medium">
                    {blockedReason === 'Plano Expirado'
                      ? "O período de validade do seu plano terminou. Entre em contato com o suporte para renovar seu acesso."
                      : "Você atingiu o limite de contatos do seu plano atual. Realize o upgrade para continuar utilizando o CRM."}
                  </p>
                </div>
                <div className="bg-white dark:bg-gray-900 p-6 rounded-3xl border border-gray-100 dark:border-gray-800 shadow-sm inline-block">
                  <p className="text-sm font-bold text-gray-700 dark:text-gray-300">Motivo: <span className="text-red-600">{blockedReason}</span></p>
                </div>
                <Button className="bg-[#25aae1] text-white px-10 h-14 rounded-2xl font-bold" onClick={() => window.open('https://wa.me/819011886491', '_blank')}>
                  FALAR COM SUPORTE
                </Button>
              </div>
            ) : (
              <ClientCRM
                tenantPlan={userData?.tenant?.plan as PlanType}
                contacts={contacts}
                setContacts={setContacts}
                selectedContact={selectedContact}
                setSelectedContact={setSelectedContact}
                metrics={dashboardMetrics}
                onRefresh={refreshAllData}
                activeTab={clientTab}
                onChangeTab={setClientTab}
                onTerminalMode={() => setAuthRole('terminal')}
                tenantSlug={tenantSlug}
              />
            )}
          </div>
        </div>
      </main>

      {showOnboarding && (
        <OnboardingModal
          onComplete={handleCompleteOnboarding}
          onChangeTab={(tab) => setClientTab(tab as any)}
        />
      )}
    </div>
  );
};

export default App;
