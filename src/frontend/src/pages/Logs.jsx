import { useState } from 'react'
import Matches from './Matches'
import Notes from './Notes'
import Workouts from './Workouts'
import Goals from './Goals'

const TABS = [
  { key: 'MATCHES',  Component: Matches },
  { key: 'NOTES',    Component: Notes },
  { key: 'WORKOUTS', Component: Workouts },
  { key: 'GOALS',    Component: Goals },
]

export default function Logs() {
  const [activeTab, setActiveTab] = useState('MATCHES')
  const Active = TABS.find(t => t.key === activeTab).Component

  return (
    <div className="space-y-0">
      {/* Tab bar */}
      <div className="border-b border-[#1a1a1a] mb-6">
        <div className="flex">
          {TABS.map(({ key }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`px-5 py-2.5 text-[10px] tracking-[0.18em] font-display font-medium transition-colors ${
                activeTab === key
                  ? 'text-[#e8712a] border-b-2 border-[#e8712a] -mb-px'
                  : 'text-[#555] hover:text-[#aaa]'
              }`}
            >
              {key}
            </button>
          ))}
        </div>
      </div>

      {/* Active tab content — remounts on switch, giving each a fresh state */}
      <Active />
    </div>
  )
}
