import type { Progress } from '../lib/progress'
import { dayKey } from '../lib/progress'
import { ensureDay, questPct, questsFor, questValue } from './quests'
import { QUEST_REWARD } from './xp'
import '../styles/motivation.css'

/** Thẻ 3 nhiệm vụ hôm nay với thanh tiến độ. */
export function DailyQuests({ p, now = Date.now() }: { p: Progress; now?: number }) {
  const day = dayKey(now)
  const d = ensureDay(p.daily, day)
  const qs = questsFor(day)
  const nDone = qs.filter((q) => d.done.includes(q.id)).length
  return (
    <section className="card quests" aria-label="Nhiệm vụ hôm nay">
      <div className="quests-head">
        <div className="grow">
          <div className="quests-title">Nhiệm vụ hôm nay</div>
          <div className="muted small">Làm mới mỗi ngày · mỗi nhiệm vụ +{QUEST_REWARD} XP</div>
        </div>
        <span className={`quests-count ${nDone === qs.length ? 'all' : ''}`}>{nDone}/{qs.length}</span>
      </div>
      <ul className="quest-list">
        {qs.map((q) => {
          const done = d.done.includes(q.id)
          const v = Math.min(q.target, questValue(q, d))
          return (
            <li key={q.id} className={`quest ${done ? 'done' : ''}`}>
              <span className="quest-icon" aria-hidden>{done ? '✅' : q.icon}</span>
              <div className="grow" style={{ minWidth: 0 }}>
                <div className="quest-row">
                  <span className="quest-name">{q.title}</span>
                  <span className="quest-v">{done ? `+${QUEST_REWARD} XP` : `${v}/${q.target}`}</span>
                </div>
                <div className="quest-bar" role="progressbar" aria-valuenow={Math.round(questPct(q, d))} aria-valuemin={0} aria-valuemax={100} aria-label={q.title}>
                  <div style={{ width: `${done ? 100 : questPct(q, d)}%` }} />
                </div>
              </div>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

/** Số nhiệm vụ còn lại hôm nay. */
export function questsLeft(p: Progress, now = Date.now()) {
  const day = dayKey(now)
  const d = ensureDay(p.daily, day)
  return questsFor(day).filter((q) => !d.done.includes(q.id)).length
}
