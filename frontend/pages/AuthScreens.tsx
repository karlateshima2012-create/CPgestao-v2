import React, { useState } from 'react';
import { Card, Button, Input } from '../components/ui';
import { ArrowLeft, Key, Mail, ShieldAlert, CheckCircle, ArrowRight } from 'lucide-react';
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

            <div className="p-4 bg-gray-50 rounded-xl border border-gray-100 italic text-[10px] text-gray-500 font-bold">
                ⚠️ REQUISITOS: Mínimo de 8 caracteres, conter pelo menos uma letra MAIÚSCULA e um número.
            </div>

            <Button className="w-full bg-[#25aae1] text-white h-14 font-bold rounded-2xl flex items-center justify-center gap-2" onClick={handleSubmit} disabled={isLoading}>
                {isLoading ? 'Salvando...' : 'Definir Senha e Entrar'} <ArrowRight className="w-5 h-5 text-white" />
            </Button>
        </div>
    );
};
