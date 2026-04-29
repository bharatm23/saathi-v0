// src/components/SaathiLogo.tsx
import Link from 'next/link'

export function SaathiLogo({ dark = false }: { dark?: boolean }) {
  return (
    <Link href="/landing" className="flex items-center gap-2 flex-shrink-0">
      <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect width="32" height="32" rx="8" fill="#0F2D52"/>
        <path d="M16 23s-7-4.5-7-9.5A4.5 4.5 0 0 1 16 10.5 4.5 4.5 0 0 1 23 13.5C23 18.5 16 23 16 23z" fill="white"/>
      </svg>
      <span className={`font-semibold text-lg ${dark ? 'text-white' : 'text-gray-900'}`}>Saathi</span>
    </Link>
  )
}
