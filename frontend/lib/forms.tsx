'use client';

import { ReactNode, InputHTMLAttributes } from 'react';
import {
  ArrowRight,
  CircleCheck,
  CircleX,
  Eye,
  EyeOff,
  Loader,
  Lock,
  Mail,
  MailOpen,
  MailPlus,
  User,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export function fieldBorderClass(hasError: boolean) {
  return hasError ? 'border-error' : 'border-outline-variant';
}

const AUTH_ICON_MAP: Record<string, LucideIcon> = {
  mail: Mail,
  lock: Lock,
  person: User,
  visibility: Eye,
  visibility_off: EyeOff,
  mark_email_unread: MailPlus,
  check_circle: CircleCheck,
  error: CircleX,
};

interface AuthIconProps {
  name: string;
  className?: string;
  strokeWidth?: number;
}

export function AuthIcon({ name, className, strokeWidth = 2 }: AuthIconProps) {
  const Icon = AUTH_ICON_MAP[name] ?? MailOpen;
  return <Icon className={className} strokeWidth={strokeWidth} />;
}

interface AuthShellProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
  maxWidthClass?: string;
  className?: string;
}

export function AuthShell({
  title,
  subtitle,
  children,
  footer,
  maxWidthClass = 'max-w-[440px]',
  className,
}: AuthShellProps) {
  return (
    <div
      className={cn(
        'ats-auth dark bg-background text-on-background flex items-center justify-center p-md min-h-screen',
        className
      )}
    >
      <div className="fixed inset-0 pointer-events-none overflow-hidden opacity-20">
        <div className="absolute -top-[10%] -left-[10%] w-[40%] h-[40%] bg-primary-container rounded-full blur-[120px]" />
        <div className="absolute -bottom-[10%] -right-[10%] w-[40%] h-[40%] bg-secondary-container rounded-full blur-[120px]" />
      </div>

      <main
        className={cn(
          'relative z-10 w-full bg-surface-container border border-outline-variant rounded-xl p-xl shadow-2xl',
          maxWidthClass
        )}
      >
        <header className="flex flex-col items-center text-center mb-xl">
          <h1 className="text-on-surface font-headline-lg text-headline-lg mb-xs">
            {title}
          </h1>
          {subtitle && (
            <p className="text-on-surface-variant font-body-md text-body-md">
              {subtitle}
            </p>
          )}
        </header>

        <div className="w-full h-px bg-outline-variant mb-xl" />

        {children}

        {footer && <footer className="mt-xl text-center">{footer}</footer>}
      </main>
    </div>
  );
}

interface AuthInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'name'> {
  label: string;
  name: string;
  icon?: string;
  error?: string;
  trailing?: ReactNode;
  inputClassName?: string;
}

export function AuthInput({
  label,
  name,
  icon,
  error,
  trailing,
  className,
  inputClassName,
  type = 'text',
  ...rest
}: AuthInputProps) {
  return (
    <div className={cn('flex flex-col gap-xs', className)}>
      <label
        className="text-on-surface font-label-md text-label-md ml-1"
        htmlFor={name}
      >
        {label}
      </label>
      <div className="relative group input-focus-glow rounded-lg">
        {icon && (
          <AuthIcon
            name={icon}
            className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-on-surface-variant group-focus-within:text-primary transition-colors"
          />
        )}
        <input
          id={name}
          name={name}
          type={type}
          className={cn(
            'w-full bg-background border rounded-lg py-2.5 text-on-surface text-body-md placeholder:text-outline focus:border-primary focus:ring-0 transition-all outline-none',
            icon ? 'pl-10' : 'pl-4',
            trailing ? 'pr-10' : 'pr-4',
            fieldBorderClass(!!error),
            inputClassName
          )}
          aria-invalid={!!error}
          aria-describedby={error ? `${name}-error` : undefined}
          {...rest}
        />
        {trailing && (
          <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center">
            {trailing}
          </div>
        )}
      </div>
      {error && (
        <p id={`${name}-error`} className="text-error text-[12px] mt-1">
          {error}
        </p>
      )}
    </div>
  );
}

interface AuthPasswordInputProps
  extends Omit<AuthInputProps, 'type' | 'trailing'> {
  showPassword: boolean;
  onToggleShow: () => void;
}

export function AuthPasswordInput({
  showPassword,
  onToggleShow,
  ...rest
}: AuthPasswordInputProps) {
  return (
    <AuthInput
      {...rest}
      type={showPassword ? 'text' : 'password'}
      trailing={
        <button
          type="button"
          aria-label={showPassword ? 'Hide password' : 'Show password'}
          onClick={onToggleShow}
          className="p-2 text-on-surface-variant hover:text-on-surface transition-colors cursor-pointer"
        >
          {showPassword ? (
            <EyeOff className="w-5 h-5" />
          ) : (
            <Eye className="w-5 h-5" />
          )}
        </button>
      }
    />
  );
}

interface AuthButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  loading?: boolean;
  loadingText?: string;
  trailingIcon?: ReactNode;
}

export function AuthButton({
  loading = false,
  loadingText,
  trailingIcon = <ArrowRight className="w-[18px] h-[18px]" />,
  children,
  className,
  disabled,
  ...rest
}: AuthButtonProps) {
  return (
    <button
      className={cn(
        'w-full bg-primary-container hover:bg-primary-container/90 active:scale-[0.98] text-white font-label-md text-body-lg py-3 rounded-lg flex items-center justify-center gap-2 transition-all mt-xl shadow-lg shadow-primary-container/10 disabled:opacity-70 disabled:cursor-not-allowed disabled:active:scale-100',
        className
      )}
      disabled={loading || disabled}
      {...rest}
    >
      {loading ? (
        <>
          <Loader className="w-[18px] h-[18px] animate-spin" />
          {loadingText ?? 'Working...'}
        </>
      ) : (
        <>
          {children}
          {trailingIcon}
        </>
      )}
    </button>
  );
}
