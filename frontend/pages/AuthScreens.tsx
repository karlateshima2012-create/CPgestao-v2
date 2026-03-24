import React, { useState } from 'react';
import { Card, Button, Input } from '../components/ui';
import { ArrowLeft, Key, Mail, ShieldAlert, CheckCircle, ArrowRight, ShieldCheck, Rocket, X } from 'lucide-react';
import api from '../services/api';

interface AuthPageProps {
    onBack: () => void;
    email?: string;
    onSuccess?: () => void;
}

export const ForgotPasswordScreen: React.FC<AuthPageProps> = ({ onBack }) => {
    const [email, setEmail] = useState('');
    const [isSent, setIsSent] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async () => {
        setIsLoading(true);
        const cleanEmail = email.trim().replace(/\.+$/, '');
        try {
            await api.post('/auth/forgot-password', { email: cleanEmail });
            setIsSent(true);
        } catch (error) {
            alert('Erro ao enviar link de recuperação.');
        } finally {
            setIsLoading(false);
        }
    };

    if (isSent) {
        return (
            <div className="text-center space-y-6">
                <div className="w-20 h-20 bg-green-50 rounded-full flex items-center justify-center mx-auto">
                    <CheckCircle className="w-10 h-10 text-green-500" />
                </div>
                <div>
                    <h2 className="text-2xl font-bold">Verifique seu E-mail</h2>
                    <p className="text-gray-500 mt-2">Enviamos as instruções para <strong className="text-gray-900">{email.trim().replace(/\.+$/, '')}</strong></p>
                </div>
                <Button variant="secondary" className="w-full" onClick={onBack}>Voltar ao Login</Button>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="space-y-2">
                <h2 className="text-2xl font-bold">Esqueceu a senha?</h2>
                <p className="text-gray-500 text-sm">Digite seu e-mail para receber um link de recuperação.</p>
            </div>
            <Input
                label="E-mail cadastrado"
                type="email"
                autoComplete="email"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck="false"
                placeholder="seu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
            />
            <div className="space-y-3">
                <Button className="w-full bg-[#25aae1] text-white" onClick={handleSubmit} disabled={isLoading}>
                    {isLoading ? 'Enviando...' : 'Enviar Link de Recuperação'}
                </Button>
                <button onClick={onBack} className="w-full text-sm font-medium text-gray-500 flex items-center justify-center gap-2">
                    <ArrowLeft className="w-4 h-4" /> Voltar ao LogIn
                </button>
            </div>
        </div>
    );
};

export const ResetPasswordScreen: React.FC<AuthPageProps & { token: string }> = ({ email: initialEmail, token, onBack }) => {
    const [formData, setFormData] = useState({ email: initialEmail || '', password: '', password_confirmation: '' });
    const [isLoading, setIsLoading] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);

    const handleSubmit = async () => {
        if (formData.password !== formData.password_confirmation) {
            alert('As senhas não coincidem.');
            return;
        }
        setIsLoading(true);
        try {
            await api.post('/auth/reset-password', {
                ...formData,
                email: formData.email.trim().replace(/\.+$/, ''),
                token
            });
            setIsSuccess(true);
        } catch (error) {
            alert('Token inválido ou expirado.');
        } finally {
            setIsLoading(false);
        }
    };

    if (isSuccess) {
        return (
            <div className="text-center space-y-6">
                <div className="w-20 h-20 bg-green-50 rounded-full flex items-center justify-center mx-auto">
                    <CheckCircle className="w-10 h-10 text-green-500" />
                </div>
                <div>
                    <h2 className="text-2xl font-bold">Senha Redefinida!</h2>
                    <p className="text-gray-500 mt-2">Sua nova senha foi salva com sucesso.</p>
                </div>
                <Button className="w-full bg-[#25aae1] text-white" onClick={onBack}>Fazer LogIn Agora</Button>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="space-y-2">
                <h2 className="text-2xl font-bold">Nova Senha</h2>
                <p className="text-gray-500 text-sm">Defina sua nova senha de acesso.</p>
            </div>
            <div className="space-y-4">
                <Input
                    label="E-mail"
                    type="email"
                    autoComplete="email"
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck="false"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                />
                <Input label="Nova Senha" type="password" placeholder="Mínimo 8 caracteres, 1 maiúscula e 1 número" minLength={8} value={formData.password} onChange={(e) => setFormData({ ...formData, password: e.target.value })} />
                <Input label="Confirmar Nova Senha" type="password" placeholder="Repita a nova senha" minLength={8} value={formData.password_confirmation} onChange={(e) => setFormData({ ...formData, password_confirmation: e.target.value })} />
            </div>
            <Button className="w-full bg-[#25aae1] text-white" onClick={handleSubmit} disabled={isLoading}>
                {isLoading ? 'Salvando...' : 'Redefinir Senha'}
            </Button>
        </div>
    );
};

export const FirstAccessChangeScreen: React.FC<AuthPageProps> = ({ onSuccess }) => {
    const [formData, setFormData] = useState({ password: '', password_confirmation: '' });
    const [isLoading, setIsLoading] = useState(false);
    const [acceptedTerms, setAcceptedTerms] = useState(false);
    const [showTermsModal, setShowTermsModal] = useState(false);

    const handleSubmit = async () => {
        if (formData.password !== formData.password_confirmation) {
            alert('As senhas não coincidem.');
            return;
        }
        if (formData.password.length < 8) {
            alert('A senha deve ter pelo menos 8 caracteres.');
            return;
        }

        setIsLoading(true);
        try {
            await api.post('/auth/change-password', formData);
            onSuccess?.();
        } catch (error) {
            alert('Erro ao atualizar senha.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col items-center text-center space-y-3">
                <div className="w-16 h-16 bg-amber-50 rounded-full flex items-center justify-center">
                    <ShieldAlert className="w-8 h-8 text-amber-500" />
                </div>
                <div>
                    <h2 className="text-2xl font-bold">Primeiro Acesso</h2>
                    <p className="text-sm text-gray-500">Para sua segurança, defina uma nova senha pessoal antes de continuar.</p>
                </div>
            </div>

            <div className="space-y-4">
                <Input
                    label="Nova Senha"
                    type="password"
                    placeholder="Mínimo 8 caracteres, 1 maiúscula, 1 número"
                    minLength={8}
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                />
                <Input
                    label="Confirmar Senha"
                    type="password"
                    placeholder="Repita a nova senha"
                    minLength={8}
                    value={formData.password_confirmation}
                    onChange={(e) => setFormData({ ...formData, password_confirmation: e.target.value })}
                />
            </div>

            <div className="space-y-4">
                <div className="flex items-start gap-3 p-4 bg-primary-50/50 dark:bg-primary-900/10 rounded-2xl border border-primary-100 dark:border-primary-900/20 group cursor-pointer transition-all hover:bg-primary-50" onClick={() => setAcceptedTerms(!acceptedTerms)}>
                    <div className="mt-0.5 relative flex items-center justify-center">
                        <input
                            type="checkbox"
                            className="sr-only"
                            checked={acceptedTerms}
                            onChange={() => { }}
                        />
                        <div className={`w-5 h-5 rounded-md border-2 transition-all flex items-center justify-center ${acceptedTerms ? 'bg-primary-500 border-primary-500 shadow-lg shadow-primary-500/30' : 'border-gray-300 bg-white'}`}>
                            {acceptedTerms && <CheckCircle className="w-3.5 h-3.5 text-white" />}
                        </div>
                    </div>
                    <div className="flex-1">
                        <p className="text-[11px] font-black text-gray-700 dark:text-gray-300 uppercase tracking-tight">
                            Li e concordo com os <button type="button" onClick={(e) => { e.stopPropagation(); setShowTermsModal(true); }} className="text-primary-600 hover:underline">Termos de Uso</button> e <button type="button" onClick={(e) => { e.stopPropagation(); setShowTermsModal(true); }} className="text-primary-600 hover:underline">Política de Privacidade</button>
                        </p>
                        <p className="text-[9px] text-gray-500 font-bold uppercase tracking-widest mt-1 italic">
                            * Estes documentos estarão sempre disponíveis na aba "Minha Conta"
                        </p>
                    </div>
                </div>

                <Button
                    className={`w-full h-14 font-black rounded-2xl flex items-center justify-center gap-2 transition-all shadow-xl ${acceptedTerms ? 'bg-[#25aae1] text-white shadow-[#25aae1]/20 hover:scale-[1.02]' : 'bg-gray-100 text-gray-400 cursor-not-allowed opacity-60'}`}
                    onClick={handleSubmit}
                    disabled={isLoading || !acceptedTerms}
                >
                    {isLoading ? 'Salvando...' : 'Definir Senha e Entrar'} <ArrowRight className="w-5 h-5" />
                </Button>
            </div>

            {/* MODAL DE TERMOS E POLÍTICAS */}
            {showTermsModal && (
                <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md overflow-y-auto animate-fade-in">
                    <Card className="w-full max-w-3xl p-0 shadow-2xl overflow-hidden animate-scale-up my-8 max-h-[90vh] flex flex-col bg-white dark:bg-gray-900 border-none rounded-[30px]">
                        <div className="p-6 sm:p-8 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center bg-gray-50/50 dark:bg-gray-900/50 shrink-0">
                            <div>
                                <h3 className="text-xl sm:text-2xl font-black text-gray-900 dark:text-white flex items-center gap-3 uppercase tracking-tight">
                                    Termos e Políticas
                                </h3>
                                <p className="text-[10px] sm:text-xs text-gray-500 font-bold uppercase tracking-widest mt-1">Sua segurança e privacidade em primeiro lugar</p>
                            </div>
                            <button
                                onClick={() => setShowTermsModal(false)}
                                className="p-2 hover:bg-gray-200 dark:hover:bg-gray-800 rounded-full transition-colors"
                            >
                                <X className="w-6 h-6 text-gray-400" />
                            </button>
                        </div>

                        <div className="p-8 sm:p-10 overflow-y-auto custom-scrollbar space-y-10 text-gray-700 dark:text-gray-300">
                            {/* POLÍTICA DE PRIVACIDADE */}
                            <section className="space-y-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-lg bg-green-50 dark:bg-green-900/20 flex items-center justify-center">
                                        <ShieldCheck className="w-5 h-5 text-green-600" />
                                    </div>
                                    <h4 className="text-lg font-black text-gray-900 dark:text-white uppercase tracking-tight">Política de Privacidade</h4>
                                </div>
                                <p className="text-sm leading-relaxed">
                                    A <strong>Creative Print</strong> valoriza a privacidade de seus usuários. Esta Política descreve como coletamos e utilizamos seus dados no sistema <strong>CP Gestão</strong>.
                                </p>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
                                    <div className="p-5 bg-gray-50 dark:bg-gray-800/50 rounded-2xl border border-gray-100 dark:border-gray-800">
                                        <h5 className="font-black text-[10px] uppercase text-gray-400 mb-2">1. Coleta de Dados</h5>
                                        <p>Coletamos apenas informações essenciais para a prestação de nossos serviços de gestão e fidelidade, como nome, contato da empresa e preferências configuradas pelo administrador.</p>
                                    </div>
                                    <div className="p-5 bg-gray-50 dark:bg-gray-800/50 rounded-2xl border border-gray-100 dark:border-gray-800">
                                        <h5 className="font-black text-[10px] uppercase text-gray-400 mb-2">2. Uso das Informações</h5>
                                        <p>Seus dados são utilizados exclusivamente para gerenciar seus clientes, processar pontuações automatizadas e enviar notificações estratégicas via bot.</p>
                                    </div>
                                    <div className="p-5 bg-gray-50 dark:bg-gray-800/50 rounded-2xl border border-gray-100 dark:border-gray-800 text-[11px]">
                                        <h5 className="font-black text-[10px] uppercase text-gray-400 mb-2">3. Segurança e Isolamento</h5>
                                        <p>Garantimos isolamento total dos dados de cada loja (Multi-Tenant). Adotamos criptografia em trânsito e medidas técnicas contra acessos não autorizados.</p>
                                    </div>
                                    <div className="p-5 bg-gray-50 dark:bg-gray-800/50 rounded-2xl border border-gray-100 dark:border-gray-800 text-[11px]">
                                        <h5 className="font-black text-[10px] uppercase text-gray-400 mb-2">4. Armazenamento</h5>
                                        <p>Os dados são processados e armazenados em servidores seguros, mantendo a integridade de todas as transações do seu CRM.</p>
                                    </div>
                                </div>
                            </section>

                            {/* TERMOS DE USO */}
                            <section className="space-y-4 pt-10 border-t border-gray-100 dark:border-gray-800">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center">
                                        <Rocket className="w-5 h-5 text-blue-600" />
                                    </div>
                                    <h4 className="text-lg font-black text-gray-900 dark:text-white uppercase tracking-tight">Termos de Uso</h4>
                                </div>
                                <div className="space-y-4">
                                    {[
                                        { t: 'Licença de Uso', c: 'Concedemos uma licença limitada e intransferível para o uso de nossa plataforma conforme o plano contratado.' },
                                        { t: 'Responsabilidade pelos Dados', c: 'O usuário administrador é o único responsável pelos dados de seus clientes inseridos na plataforma.' },
                                        { t: 'Manutenção de Assinatura', c: 'O acesso ao sistema está condicionado à manutenção do plano de assinatura ativo.' },
                                        { t: 'Cancelamento', c: 'O cancelamento pode ser feito a qualquer momento. Não haverá reembolso de ciclos já pagos.' },
                                    ].map((item, idx) => (
                                        <div key={idx} className="flex gap-4 p-4 hover:bg-gray-50 dark:hover:bg-gray-800/30 rounded-xl transition-colors">
                                            <span className="text-primary-500 font-black text-sm">{idx + 1}.</span>
                                            <div>
                                                <p className="font-bold text-gray-900 dark:text-white text-sm mb-1">{item.t}</p>
                                                <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">{item.c}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </section>

                            <div className="p-6 bg-primary-50 dark:bg-primary-900/10 rounded-3xl text-center border border-primary-100 dark:border-primary-900/30 shrink-0">
                                <p className="text-[10px] font-black text-primary-700 dark:text-primary-400 uppercase tracking-widest">
                                    Última atualização: {new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
                                </p>
                            </div>
                        </div>

                        <div className="p-6 sm:p-8 bg-gray-50 dark:bg-gray-900/50 shrink-0 border-t border-gray-100 dark:border-gray-800">
                            <Button
                                onClick={() => { setShowTermsModal(false); setAcceptedTerms(true); }}
                                className="w-full bg-gray-900 dark:bg-white text-white dark:text-gray-900 font-bold uppercase tracking-widest py-4 rounded-xl"
                            >
                                Entendi e Aceito os Termos
                            </Button>
                        </div>
                    </Card>
                </div>
            )}
        </div>
    );
};
