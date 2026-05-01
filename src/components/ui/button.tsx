import React from 'react'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'outline' | 'ghost'
  asChild?: boolean
  children: React.ReactNode
}

export function Button({
  variant = 'default',
  asChild,
  children,
  className = '',
  ...props
}: ButtonProps) {
  const baseStyles = 'inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg font-medium transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed'

  const variantStyles = {
    default: 'bg-[#7C3AED] hover:bg-[#5B21B6] text-white',
    outline: 'border border-purple-500/30 bg-transparent hover:bg-purple-500/10 text-white',
    ghost: 'bg-transparent hover:bg-white/5 text-gray-400 hover:text-white',
  }

  const combinedClassName = `${baseStyles} ${variantStyles[variant]} ${className}`

  if (asChild && React.isValidElement(children)) {
    const child = children as React.ReactElement<{ className?: string }>
    return React.cloneElement(child, {
      className: `${combinedClassName} ${child.props.className || ''}`,
    })
  }

  return (
    <button className={combinedClassName} {...props}>
      {children}
    </button>
  )
}
