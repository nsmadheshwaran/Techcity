import { useId } from 'react'
import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react'
import { AlertCircle } from 'lucide-react'
import clsx from 'clsx'

interface BaseProps {
  label?: string
  error?: string
  hint?: string
  required?: boolean
  className?: string
}

function Wrapper({
  label,
  error,
  hint,
  required,
  className,
  htmlFor,
  children,
}: BaseProps & { htmlFor?: string; children: ReactNode }) {
  return (
    <div className={className}>
      {label && (
        <label className="field-label" htmlFor={htmlFor}>
          {label}
          {required && <span className="ml-0.5 text-red-500">*</span>}
        </label>
      )}
      {children}
      {error ? (
        <p className="mt-1 flex items-center gap-1 text-[12px] font-medium text-red-600">
          <AlertCircle size={12} /> {error}
        </p>
      ) : hint ? (
        <p className="mt-1 text-[12px] text-ink-500">{hint}</p>
      ) : null}
    </div>
  )
}

export function TextField({
  label,
  error,
  hint,
  required,
  className,
  prefix,
  ...props
}: BaseProps & InputHTMLAttributes<HTMLInputElement> & { prefix?: string }) {
  const autoId = useId()
  const id = props.id ?? autoId
  return (
    <Wrapper
      label={label}
      error={error}
      hint={hint}
      required={required}
      className={className}
      htmlFor={id}
    >
      <div className="relative">
        {prefix && (
          <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-sm text-ink-500">
            {prefix}
          </span>
        )}
        <input
          {...props}
          id={id}
          className={clsx('input', prefix && 'pl-7', error && 'input-error')}
        />
      </div>
    </Wrapper>
  )
}

export function NumberField({
  label,
  error,
  hint,
  required,
  className,
  currency = '₹',
  value,
  onValueChange,
  ...props
}: BaseProps &
  Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> & {
    currency?: string | null
    value: number
    onValueChange: (v: number) => void
  }) {
  const autoId = useId()
  const id = props.id ?? autoId
  return (
    <Wrapper
      label={label}
      error={error}
      hint={hint}
      required={required}
      className={className}
      htmlFor={id}
    >
      <div className="relative">
        {currency && (
          <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-sm text-ink-500">
            {currency}
          </span>
        )}
        <input
          {...props}
          id={id}
          type="number"
          inputMode="decimal"
          min={props.min ?? 0}
          step={props.step ?? '0.01'}
          value={Number.isFinite(value) ? String(value) : '0'}
          onChange={(e) => {
            const raw = e.target.value
            onValueChange(raw === '' ? 0 : Number(raw))
          }}
          onFocus={(e) => e.currentTarget.select()}
          className={clsx('input', currency && 'pl-7', error && 'input-error')}
        />
      </div>
    </Wrapper>
  )
}

export function SelectField({
  label,
  error,
  hint,
  required,
  className,
  options,
  children,
  ...props
}: BaseProps &
  SelectHTMLAttributes<HTMLSelectElement> & {
    options?: readonly string[] | { value: string; label: string }[]
  }) {
  const autoId = useId()
  const id = props.id ?? autoId
  return (
    <Wrapper
      label={label}
      error={error}
      hint={hint}
      required={required}
      className={className}
      htmlFor={id}
    >
      <select {...props} id={id} className={clsx('input pr-8', error && 'input-error')}>
        {children}
        {options?.map((o) =>
          typeof o === 'string' ? (
            <option key={o} value={o}>
              {o}
            </option>
          ) : (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ),
        )}
      </select>
    </Wrapper>
  )
}

export function TextAreaField({
  label,
  error,
  hint,
  required,
  className,
  ...props
}: BaseProps & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const autoId = useId()
  const id = props.id ?? autoId
  return (
    <Wrapper
      label={label}
      error={error}
      hint={hint}
      required={required}
      className={className}
      htmlFor={id}
    >
      <textarea
        {...props}
        id={id}
        rows={props.rows ?? 3}
        className={clsx('input resize-y', error && 'input-error')}
      />
    </Wrapper>
  )
}

/** Free-text input backed by a datalist — lets the user pick or type a custom value. */
export function ComboField({
  label,
  error,
  hint,
  required,
  className,
  options,
  listId,
  ...props
}: BaseProps &
  InputHTMLAttributes<HTMLInputElement> & { options: readonly string[]; listId: string }) {
  const autoId = useId()
  const id = props.id ?? autoId
  return (
    <Wrapper
      label={label}
      error={error}
      hint={hint}
      required={required}
      className={className}
      htmlFor={id}
    >
      <input
        {...props}
        id={id}
        list={listId}
        className={clsx('input', error && 'input-error')}
      />
      <datalist id={listId}>
        {options.map((o) => (
          <option key={o} value={o} />
        ))}
      </datalist>
    </Wrapper>
  )
}
