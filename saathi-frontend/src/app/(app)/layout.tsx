import { Sidebar } from '@/components/Sidebar'
import { GlobalHeader } from '@/components/GlobalHeader'
import { MemberProvider } from '@/lib/member-context'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <MemberProvider>
      <div className="flex h-screen overflow-hidden bg-gray-50">
        <Sidebar />
        <div className="flex-1 flex flex-col overflow-hidden">
          <GlobalHeader />
          <main className="flex-1 overflow-y-auto">
            {children}
          </main>
        </div>
      </div>
    </MemberProvider>
  )
}
