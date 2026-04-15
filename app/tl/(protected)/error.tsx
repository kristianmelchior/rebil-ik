'use client'

export default function TlError({ error }: { error: Error }) {
  return (
    <div className="bg-[#FCEBEB] border border-[#F5C6C6] rounded-card px-4 py-3 text-sm text-[#A32D2D] font-mono">
      {error.message}
    </div>
  )
}
