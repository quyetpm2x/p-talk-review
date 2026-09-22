/** Tên người học — nhập ở lần mở app đầu tiên, dùng để xưng hô trong app. */
export const NAME_MAX = 20

/** Chuẩn hoá tên: bỏ ký tự điều khiển và < >, gộp khoảng trắng, tối đa NAME_MAX ký tự. */
export function cleanName(raw: string): string {
  return [...raw.replace(/[\p{C}<>]+/gu, ' ').replace(/\s+/g, ' ').trim()].slice(0, NAME_MAX).join('').trim()
}

/** Lỗi khi nhập tên (null = hợp lệ). */
export function nameError(raw: string): string | null {
  const n = cleanName(raw)
  if (!n) return 'Nhập tên của bạn nhé'
  if (!/\p{L}/u.test(n)) return 'Tên cần có ít nhất một chữ cái'
  return null
}

/** Lời chào theo giờ trong ngày. */
export function greeting(h: number) {
  if (h < 11) return 'Chào buổi sáng'
  if (h < 13) return 'Chào buổi trưa'
  if (h < 18) return 'Chào buổi chiều'
  return 'Chào buổi tối'
}
