import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost'
}

export function Button({ 
  className, 
  variant = 'primary', 
  children, 
  ...props 
}: ButtonProps): JSX.Element {
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center px-4 py-2 rounded-lg font-medium transition-colors',
        'focus:outline-none focus:ring-2 focus:ring-offset-2',
        variant === 'primary' && [
          'bg-blue-600 text-white',
          'hover:bg-blue-700',
          'focus:ring-blue-500'
        ],
        variant === 'secondary' && [
          'bg-gray-200 text-gray-900',
          'hover:bg-gray-300',
          'focus:ring-gray-500'
        ],
        variant === 'ghost' && [
          'bg-transparent text-gray-700',
          'hover:bg-gray-100',
          'focus:ring-gray-500'
        ],
        'disabled:opacity-50 disabled:cursor-not-allowed',
        className
      )}
      {...props}
    >
      {children}
    </button>
  )
}
