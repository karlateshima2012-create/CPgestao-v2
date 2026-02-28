import React, { InputHTMLAttributes, useState } from 'react';
import { Loader2, CheckCircle2, XCircle, AlertCircle, Eye, EyeOff } from 'lucide-react';

// --- Card ---
export const Card: React.FC<{ children: React.ReactNode; className?: string; onClick?: () => void }> = ({ children, className = '', onClick }) => (
  <div
    onClick={onClick}
    className={`bg-white dark:bg-gray-900 rounded-[15px] border border-gray-200 dark:border-gray-800 shadow-sm hover:shadow-md transition-shadow duration-300 overflow-hidden ${className}`}
  >
    {children}
  </div>
);

// --- Button ---
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  isLoading,
  className = '',
  disabled,
  ...props
}) => {
  const baseStyles = "inline-flex items-center justify-center font-medium transition-all duration-200 active:scale-95 disabled:opacity-50 disabled:pointer-events-none rounded-[15px] focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-primary-400 dark:focus:ring-offset-gray-900";

  const variants = {
    primary: "bg-primary-500 text-white hover:bg-primary-700 hover:shadow-lg hover:shadow-slate-400/20",
    secondary: "bg-gray-100 text-gray-900 hover:bg-gray-300 dark:bg-gray-800 dark:text-gray-100 dark:hover:bg-gray-950",
    outline: "border-2 border-gray-200 text-gray-700 hover:border-primary-700 hover:text-primary-700 dark:border-gray-700 dark:text-gray-300",
    ghost: "text-gray-600 hover:bg-gray-200 dark:text-gray-400 dark:hover:bg-gray-950",
    danger: "bg-red-600 text-white hover:bg-red-800 shadow-red-500/20",
  };

  const sizes = {
    sm: "h-8 px-4 text-xs",
    md: "h-11 px-6 text-sm",
    lg: "h-14 px-8 text-base",
  };

  return (
    <button
      className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${className}`}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
      {children}
    </button>
  );
};

// --- Input ---
interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Input: React.FC<InputProps> = ({ label, error, className = '', type, ...props }) => {
  const [showPassword, setShowPassword] = useState(false);
  const isPassword = type === 'password';
  const inputType = isPassword ? (showPassword ? 'text' : 'password') : type;

  return (
    <div className="w-full relative">
      {label && <label className="block text-[10px] font-black text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-1.5 ml-1">{label}</label>}
      <div className="relative group">
        <input
          type={inputType}
          className={`w-full px-4 py-3 bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-[15px] text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all duration-200 outline-none ${error ? 'border-red-500 focus:ring-red-500' : ''} ${isPassword ? 'pr-12' : ''} ${className}`}
          {...props}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors p-1"
          >
            {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
          </button>
        )}
      </div>
      {error && <p className="mt-1 text-xs text-red-500 ml-1">{error}</p>}
    </div>
  );
};

// --- Badge ---
export const Badge: React.FC<{ children: React.ReactNode; color?: 'blue' | 'green' | 'red' | 'yellow' | 'gray' | 'bronze' | 'silver' | 'gold' | 'diamond' | 'orange' | 'purple'; className?: string }> = ({ children, color = 'blue', className = '' }) => {
  const colors = {
    blue: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
    green: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
    red: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
    yellow: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
    gray: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
    bronze: 'bg-orange-100 text-orange-900 border border-orange-200 dark:bg-orange-900/20 dark:text-orange-300 dark:border-orange-800',
    silver: 'bg-slate-100 text-slate-700 border border-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-600',
    gold: 'bg-yellow-100 text-yellow-800 border border-yellow-400 dark:bg-yellow-900/50 dark:text-yellow-400 dark:border-yellow-700',
    diamond: 'bg-cyan-100 text-cyan-800 border border-cyan-300 dark:bg-cyan-900/50 dark:text-cyan-300 dark:border-cyan-700',
    orange: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
    purple: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
  };
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap px-2.5 py-0.5 rounded-[10px] text-xs font-medium ${colors[color]} ${className}`}>
      {children}
    </span>
  );
};
// --- StatusModal ---
export const StatusModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onConfirm?: () => void;
  title: string;
  message: string;
  type?: 'success' | 'error' | 'info' | 'warning';
  confirmLabel?: string;
  cancelLabel?: string;
  theme?: 'neutral' | 'accent';
}> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  type = 'info',
  confirmLabel = 'OK',
  cancelLabel = 'FECHAR',
  theme = 'neutral'
}) => {
    if (!isOpen) return null;

    const icons = {
      success: <CheckCircle2 className={`w-10 h-10 ${theme === 'accent' ? 'text-green-500' : 'text-gray-900'}`} />,
      error: <XCircle className={`w-10 h-10 ${theme === 'accent' ? 'text-red-500' : 'text-gray-400'}`} />,
      info: <AlertCircle className={`w-10 h-10 ${theme === 'accent' ? 'text-primary-500' : 'text-gray-900'}`} />,
      warning: <AlertCircle className={`w-10 h-10 ${theme === 'accent' ? 'text-amber-500' : 'text-gray-400'}`} />,
    };

    const buttonBg = theme === 'accent' ? 'bg-primary-500 hover:bg-primary-700' : 'bg-gray-900 hover:bg-black';

    return (
      <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
        <div className="bg-white dark:bg-gray-900 p-8 rounded-[15px] shadow-2xl text-center space-y-5 max-w-sm w-full animate-scale-in border border-gray-100 dark:border-gray-800">
          <div className="w-20 h-20 bg-gray-50 dark:bg-gray-800 rounded-[15px] flex items-center justify-center mx-auto">
            {icons[type]}
          </div>
          <div className="space-y-1">
            <h3 className="text-2xl font-black text-gray-900 dark:text-white uppercase tracking-tighter leading-none">{title}</h3>
            <p className="text-sm text-gray-500 font-bold leading-relaxed">{message}</p>
          </div>
          <div className="flex flex-col gap-2">
            {onConfirm && (
              <Button
                className={`w-full ${buttonBg} text-white rounded-[15px] font-bold h-14 transition-colors`}
                onClick={() => { onConfirm(); onClose(); }}
              >
                {confirmLabel}
              </Button>
            )}
            <Button
              variant={onConfirm ? "ghost" : "secondary"}
              className={`w-full font-bold h-14 transition-colors ${(!onConfirm) ? `${buttonBg} text-white` : 'text-gray-400'}`}
              onClick={onClose}
            >
              {onConfirm ? cancelLabel : confirmLabel}
            </Button>
          </div>
        </div>
      </div>
    );
  };
