import { useState } from "react"

const RABATT = {
  "Pris":       { label: "Ingen rabatt", cls: "bg-green-100 text-green-700" },
  "Rabatt 1":   { label: "Lav rabatt",   cls: "bg-yellow-100 text-yellow-700" },
  "Rabatt 2":   { label: "Høy rabatt",   cls: "bg-red-100 text-red-700" },
  "Minstepris": { label: "Minstepris",   cls: "bg-red-100 text-red-700" },
}

const FEED = [
  { id: 1, rep: "Sara Lindgren",   type: "Direkteinnkjøp", innkjop: 185000, pris: 220000, rabatt: "Pris",       dato: "i dag, 14:32", initials: "SL", color: "bg-violet-500" },
  { id: 2, rep: "Mikkel Haugen",   type: "Byttehandel",    innkjop: 95000,  pris: 108000, rabatt: "Rabatt 1",   dato: "i dag, 11:15", initials: "MH", color: "bg-blue-500"   },
  { id: 3, rep: "Thea Norberg",    type: "Direkteinnkjøp", innkjop: 310000, pris: 342000, rabatt: "Pris",       dato: "i dag, 09:47", initials: "TN", color: "bg-emerald-500"},
  { id: 4, rep: "Jonas Eriksen",   type: "Direkteinnkjøp", innkjop: 72000,  pris: 78000,  rabatt: "Rabatt 2",   dato: "i går, 16:20", initials: "JE", color: "bg-orange-500" },
  { id: 5, rep: "Sara Lindgren",   type: "Byttehandel",    innkjop: 140000, pris: 161000, rabatt: "Pris",       dato: "i går, 13:05", initials: "SL", color: "bg-violet-500" },
  { id: 6, rep: "Camilla Vold",    type: "Direkteinnkjøp", innkjop: 55000,  pris: 55000,  rabatt: "Minstepris", dato: "i går, 10:30", initials: "CV", color: "bg-pink-500"   },
]

function fmtKr(n) {
  return `kr ${Math.round(n).toLocaleString("nb-NO")}`
}

function FeedCard({ item, isNew }) {
  const badge = RABATT[item.rabatt]
  const margin = item.pris - item.innkjop
  const marginPct = ((margin / item.innkjop) * 100).toFixed(1)

  return (
    <div className={`bg-white rounded-xl border ${isNew ? "border-red-200 shadow-sm" : "border-gray-200"} p-4 flex gap-3`}>
      {/* Avatar */}
      <div className={`w-9 h-9 rounded-full ${item.color} text-white text-xs font-bold flex items-center justify-center shrink-0 mt-0.5`}>
        {item.initials}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2 flex-wrap">
          <span className="font-semibold text-gray-900 text-sm">{item.rep}</span>
          <span className="text-gray-400 text-xs">kjøpte en bil</span>
          <span className="text-gray-400 text-xs ml-auto shrink-0">{item.dato}</span>
        </div>

        {/* Type pill */}
        <div className="mt-2 mb-3">
          <span className="text-xs font-medium bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
            {item.type}
          </span>
        </div>

        {/* Stats row */}
        <div className="flex gap-4 flex-wrap">
          <div>
            <p className="text-[11px] text-gray-400 uppercase tracking-wide font-medium">Innkjøpspris</p>
            <p className="text-sm font-semibold text-gray-800">{fmtKr(item.innkjop)}</p>
          </div>
          <div>
            <p className="text-[11px] text-gray-400 uppercase tracking-wide font-medium">Pris</p>
            <p className="text-sm font-semibold text-gray-800">{fmtKr(item.pris)}</p>
          </div>
          <div>
            <p className="text-[11px] text-gray-400 uppercase tracking-wide font-medium">Margin</p>
            <p className="text-sm font-semibold text-emerald-600">+{marginPct}%</p>
          </div>
          <div className="flex items-end">
            {badge && (
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${badge.cls}`}>
                {badge.label}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default function App() {
  const [tab, setTab] = useState("dashboard")
  const [seen, setSeen] = useState(false)
  const newCount = 3 // first 3 are "today" = unseen

  function handleFeedClick() {
    setTab("feed")
    setSeen(true)
  }

  return (
    <div className="min-h-screen bg-gray-50 font-sans">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-6 h-[60px] flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <div className="w-6 h-6 rounded bg-red-600" />
            <span className="font-bold text-gray-900 tracking-tight">rebil</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-gray-700">Sara Lindgren</span>
            <span className="text-sm text-gray-400">IK</span>
            <button className="text-sm text-gray-500 border border-gray-200 px-3 py-1.5 rounded-lg hover:bg-gray-50">
              Logg ut
            </button>
          </div>
        </div>
      </header>

      {/* Nav tabs */}
      <nav className="bg-white border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-6 flex gap-6">
          <button
            onClick={() => setTab("dashboard")}
            className={`py-3.5 text-sm font-medium border-b-2 transition-colors ${
              tab === "dashboard"
                ? "border-red-600 text-gray-900"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            Dashboard
          </button>

          <button
            onClick={handleFeedClick}
            className={`py-3.5 text-sm font-medium border-b-2 transition-colors flex items-center gap-1.5 ${
              tab === "feed"
                ? "border-red-600 text-gray-900"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            Feed
            {!seen && (
              <span className="w-2 h-2 rounded-full bg-red-500 inline-block" />
            )}
          </button>
        </div>
      </nav>

      {/* Content */}
      <main className="max-w-4xl mx-auto px-6 py-8">
        {tab === "dashboard" ? (
          <div className="space-y-4">
            {/* Placeholder dashboard tiles */}
            {[
              { label: "Biler kjøpt (mnd)", value: "12" },
              { label: "Leads (mnd)", value: "34" },
              { label: "Konvertering", value: "35,3%" },
              { label: "NPS", value: "72" },
            ].map(tile => (
              <div key={tile.label} className="bg-white rounded-xl border border-gray-200 p-5 flex justify-between items-center">
                <span className="text-sm text-gray-500">{tile.label}</span>
                <span className="text-2xl font-bold text-gray-900">{tile.value}</span>
              </div>
            ))}
            <p className="text-center text-gray-400 text-sm pt-4">← Klikk på Feed-fanen for å se mockup</p>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between mb-1">
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">
                Siste 7 dager · {FEED.length} kjøp
              </p>
              {!seen && (
                <span className="text-xs text-red-500 font-medium">{newCount} nye siden sist</span>
              )}
            </div>

            {FEED.map((item, i) => (
              <FeedCard key={item.id} item={item} isNew={!seen && i < newCount} />
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
