/** Kiểm tra một file bài học; trả về danh sách lỗi (rỗng = hợp lệ). */
export function validateLesson(x: unknown): string[] {
  const errs: string[] = []
  const l = x as any
  if (!l || typeof l !== 'object') return ['lesson: không phải object']
  for (const k of ['id', 'title', 'titleVi']) if (typeof l[k] !== 'string' || !l[k]) errs.push(`lesson.${k}: thiếu`)
  for (const k of ['level', 'number']) if (typeof l[k] !== 'number') errs.push(`lesson.${k}: phải là số`)
  for (const k of ['objectives', 'groups', 'phrases', 'extraPhrases', 'dialogues', 'missions', 'grammar'])
    if (!Array.isArray(l[k])) errs.push(`lesson.${k}: phải là mảng`)
  if (errs.length) return errs

  const groupIds = new Set<string>(l.groups.map((g: any) => g.id))
  const ids = new Set<string>()
  const checkId = (id: unknown, where: string) => {
    if (typeof id !== 'string' || !id) errs.push(`${where}: thiếu id`)
    else if (ids.has(id)) errs.push(`${where}: id trùng "${id}"`)
    else ids.add(id)
  }

  l.phrases.forEach((p: any, i: number) => {
    const w = `phrases[${i}]`
    checkId(p.id, w)
    if (!p.en || !p.vi) errs.push(`${w}: thiếu en/vi`)
    if (!groupIds.has(p.group)) errs.push(`${w}: group "${p.group}" không tồn tại`)
    if (p.blank && !String(p.en).includes(p.blank)) errs.push(`${w}: blank "${p.blank}" không nằm trong cụm`)
    if (p.intensity !== undefined && ![1, 2, 3].includes(p.intensity)) errs.push(`${w}: intensity phải là 1–3`)
  })
  l.extraPhrases.forEach((p: any, i: number) => {
    const w = `extraPhrases[${i}]`
    checkId(p.id, w)
    if (!p.en || !p.vi) errs.push(`${w}: thiếu en/vi`)
    if (p.blank && !String(p.en).includes(p.blank)) errs.push(`${w}: blank "${p.blank}" không nằm trong cụm`)
  })
  l.dialogues.forEach((d: any, i: number) => {
    if (!Array.isArray(d.lines) || !d.lines.length) errs.push(`dialogues[${i}]: không có câu`)
    if (d.voices) for (const [k, v] of Object.entries(d.voices))
      if ((k !== 'A' && k !== 'B') || !/^[ab][fm]_[a-z]+$/.test(String(v))) errs.push(`dialogues[${i}].voices: "${k}: ${v}" không hợp lệ`)
    d.lines?.forEach((ln: any, j: number) => {
      if (ln.speaker !== 'A' && ln.speaker !== 'B') errs.push(`dialogues[${i}].lines[${j}]: speaker phải là A/B`)
      for (const t of ln.toolkit ?? [])
        if (!String(ln.text).includes(t)) errs.push(`dialogues[${i}].lines[${j}]: toolkit "${t}" không nằm trong câu`)
    })
  })
  l.missions.forEach((m: any, i: number) => {
    if (!m.title || !m.kickoff || !Array.isArray(m.goals)) errs.push(`missions[${i}]: thiếu title/kickoff/goals`)
  })
  l.grammar.forEach((g: any, i: number) => {
    g.exercises?.forEach((e: any, j: number) => {
      const w = `grammar[${i}].exercises[${j}]`
      if (e.type === 'choice') {
        if (!Array.isArray(e.options) || e.answer < 0 || e.answer >= e.options.length) errs.push(`${w}: answer không hợp lệ`)
      } else if (e.type === 'input') {
        if (!Array.isArray(e.answers) || !e.answers.length) errs.push(`${w}: thiếu answers`)
      } else errs.push(`${w}: type không hợp lệ`)
    })
  })
  return errs
}
