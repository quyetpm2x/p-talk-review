import { useCallback } from 'react'
import { lessons } from '../lessons'
import { useProgress } from '../lib/ProgressContext'
import { applyActivity, type RewardReport } from './engine'
import type { Activity } from './types'

/** Trả về hàm ghi nhận một hoạt động đã xong → cộng XP/nhiệm vụ/huy hiệu, trả báo cáo phần thưởng. */
export function useReward() {
  const [, update] = useProgress()
  return useCallback((act: Activity): RewardReport | null => {
    let report: RewardReport | null = null
    // update chạy đồng bộ (xem ProgressContext) nên report có ngay sau lời gọi
    update((pp) => {
      const r = applyActivity(pp, act, Date.now(), lessons)
      report = r.report
      return r.progress
    })
    return report
  }, [update])
}
