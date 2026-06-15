import * as React from 'react';
import { cn } from '@/lib/utils';

/**
 * TextField — 공통 텍스트 입력 컴포넌트 (Figma node 44-1718 스펙).
 *
 * Anatomy: Label(optional) + Required *(optional) / Input box / Helper·Error text(optional)
 *
 * Default 스펙:
 *   - Input box: height 52px / padding 0 16px / radius 8px(rounded-lg) / border 1px #dcdee3
 *   - Text·Placeholder: Pretendard 16px / 400 / line-height 1.48 / #1a1c20
 *   - Label: 16px / #1a1c20, Required *: #fa342c, label→input gap 8px(gap-2)
 *
 * 프로젝트 정합: 포커스는 브랜드 그린(brand-600), 다크모드 변형 포함.
 * 로그인·검색창은 제외(별도 디자인) — 일반 폼 입력에만 사용.
 */
export interface TextFieldProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  /** 입력 위 라벨. 생략 시 라벨 영역 미노출 */
  label?: React.ReactNode;
  /** 필수 입력 표시(*) 노출 */
  required?: boolean;
  /** 보조 설명 텍스트(에러가 없을 때만 노출) */
  helperText?: React.ReactNode;
  /** 에러 메시지. 존재 시 critical 상태(테두리·텍스트 #fa342c) */
  error?: React.ReactNode;
  /** 외곽 래퍼 className */
  containerClassName?: string;
}

export const TextField = React.forwardRef<HTMLInputElement, TextFieldProps>(
  (
    {
      label,
      required,
      helperText,
      error,
      id,
      className,
      containerClassName,
      type = 'text',
      ...props
    },
    ref,
  ) => {
    const autoId = React.useId();
    const inputId = id ?? autoId;
    const invalid = Boolean(error);
    const describedBy = invalid
      ? `${inputId}-error`
      : helperText
        ? `${inputId}-helper`
        : undefined;

    return (
      <div className={cn('flex flex-col gap-2', containerClassName)}>
        {label != null && (
          <label
            htmlFor={inputId}
            className="text-[16px] font-normal leading-[1.48] text-[#1a1c20] dark:text-slate-100"
          >
            {label}
            {required && (
              <span className="ml-0.5 text-[#fa342c]" aria-hidden>
                *
              </span>
            )}
          </label>
        )}

        <input
          id={inputId}
          ref={ref}
          type={type}
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
          aria-required={required || undefined}
          className={cn(
            'h-[52px] w-full rounded-lg border bg-white px-4 text-[16px] font-normal leading-[1.48] text-[#1a1c20] transition-colors',
            'placeholder:text-[#8b8f9a]',
            'focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600/30',
            'disabled:cursor-not-allowed disabled:bg-slate-50 disabled:opacity-60',
            'dark:bg-slate-900 dark:text-slate-50 dark:placeholder:text-slate-500',
            invalid
              ? 'border-[#fa342c] focus:border-[#fa342c] focus:ring-[#fa342c]/25'
              : 'border-[#dcdee3] dark:border-slate-700',
            className,
          )}
          {...props}
        />

        {invalid ? (
          <p
            id={`${inputId}-error`}
            className="text-[13px] leading-[1.4] text-[#fa342c]"
          >
            {error}
          </p>
        ) : helperText ? (
          <p
            id={`${inputId}-helper`}
            className="text-[13px] leading-[1.4] text-slate-500 dark:text-slate-400"
          >
            {helperText}
          </p>
        ) : null}
      </div>
    );
  },
);
TextField.displayName = 'TextField';
