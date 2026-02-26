import React, { useState, useEffect, useRef } from 'react';
import {
    LayoutDashboard,
    Star,
    Calendar,
    UserPlus,
    Download,
    UserCircle,
    ArrowRight,
    CheckCircle2,
    Rocket
} from 'lucide-react';
import { Button } from '../components/ui';

interface OnboardingModalProps {
    onComplete: () => void;
    onChangeTab: (tab: string) => void;
}

const steps = [
    {
        title: "Bem-vindo ao seu CRM! 🚀",
        description: "Vamos fazer um tour rápido para você conhecer as principais funcionalidades do seu novo sistema de gestão de clientes e programa de fidelidade.",
        icon: Rocket,
        tab: "dashboard",
        color: "bg-blue-500"
    },
    {
        title: "Dashboard",
        description: "Aba inicial: Visão Geral do seu negócio, total de pontos distribuídos e desempenho dos seus clientes.",
        icon: LayoutDashboard,
        tab: "dashboard",
        color: "bg-[#25aae1]"
    },
    {
        title: "Fidelidade & Pontos",
        description: "Espaço para configurar suas metas de pontos e gerenciar seus cartões premium/VIP.",
        icon: Star,
        tab: "loyalty",
        color: "bg-amber-400"
    },
    {
        title: "Meus Clientes",
        description: "Lista completa de todos os clientes cadastrados no seu sistema, com histórico e saldo.",
        icon: Calendar,
        tab: "clients",
        color: "bg-[#ec4899]"
    },
    {
        title: "Novo Cadastro",
        description: "Aba rápida para cadastrar novos clientes no sistema de forma prática.",
        icon: UserPlus,
        tab: "new",
        color: "bg-green-500"
    },
    {
        title: "Exportar Dados",
        description: "Aqui você exporta todos os dados dos seus clientes em formato de planilha para o seu computador.",
        icon: Download,
        tab: "export",
        color: "bg-purple-500"
    },
    {
        title: "Minha Conta",
        description: "Verifique o status do seu plano e configure os dados básicos da sua conta e perfil.",
        icon: UserCircle,
        tab: "account",
        color: "bg-gray-600"
    }
];

export const OnboardingModal: React.FC<OnboardingModalProps> = ({ onComplete, onChangeTab }) => {
    const [currentStep, setCurrentStep] = useState(0);
    const step = steps[currentStep];


    const handleNext = () => {
        if (currentStep < steps.length - 1) {
            const nextStep = currentStep + 1;
            setCurrentStep(nextStep);
            onChangeTab(steps[nextStep].tab);
        } else {
            onComplete();
        }
    };

    const handlePrev = () => {
        if (currentStep > 0) {
            const prevStep = currentStep - 1;
            setCurrentStep(prevStep);
            onChangeTab(steps[prevStep].tab);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-6 bg-black/10 animate-fade-in pointer-events-none">
            <div className="bg-white dark:bg-gray-900 w-full max-w-lg rounded-[2.5rem] shadow-2xl shadow-black/20 overflow-hidden animate-scale-in border border-gray-100 dark:border-gray-800 pointer-events-auto">
                {/* Header Color Bar */}
                <div className={`h-2 w-full ${step.color} transition-colors duration-500`} />

                <div className="p-8 md:p-10 flex flex-col items-center text-center space-y-6">
                    <div className={`w-24 h-24 ${step.color} bg-opacity-10 rounded-[2rem] flex items-center justify-center mb-2`}>
                        <step.icon className={`w-12 h-12 text-white fill-current`} style={{ color: step.color.includes('[#') ? step.color.replace('bg-', '') : '' }} />
                        {/* Fallback for specific hex colors if simple text-color class doesn't work well */}
                        <step.icon className="w-12 h-12" style={{ color: step.color.startsWith('bg-') && !step.color.includes('[') ? '' : step.color.replace('bg-[', '').replace(']', '') }} />
                    </div>

                    <div className="space-y-3">
                        <h2 className="text-3xl font-black text-gray-900 dark:text-white uppercase tracking-tight leading-tight">
                            {step.title}
                        </h2>
                        <p className="text-gray-500 dark:text-gray-400 font-medium leading-relaxed max-w-xs mx-auto">
                            {step.description}
                        </p>
                    </div>

                    {/* Progress Dots */}
                    <div className="flex gap-2 py-2">
                        {steps.map((_, idx) => (
                            <div
                                key={idx}
                                className={`h-1.5 rounded-full transition-all duration-300 ${idx === currentStep ? `w-8 ${step.color}` : 'w-2 bg-gray-200 dark:bg-gray-800'}`}
                            />
                        ))}
                    </div>

                    <Button
                        onClick={handleNext}
                        className={`w-full h-16 rounded-[1.5rem] text-lg font-bold shadow-xl transition-all flex items-center justify-center gap-2 ${step.color} text-white hover:opacity-90`}
                    >
                        {currentStep === steps.length - 1 ? (
                            <>ACESSAR SISTEMA <CheckCircle2 className="w-6 h-6" /></>
                        ) : (
                            <>SEGUIR <ArrowRight className="w-6 h-6" /></>
                        )}
                    </Button>

                    {currentStep > 0 && (
                        <button
                            onClick={handlePrev}
                            className="text-sm font-bold text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
                        >
                            Voltar anterior
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};
