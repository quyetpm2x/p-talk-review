/** Gọi API máy chủ PTalk (PTalk-be). Địa chỉ đặt qua biến VITE_API_URL lúc build. */
export const API_URL = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '') ?? ''

export type User = { username: string; name: string; classCode: string }

export class ApiError extends Error {
  constructor(public status: number, message: string, public body?: any) {
    super(message)
  }
}

export async function api<T>(path: string, opts: { method?: string; body?: unknown; token?: string } = {}): Promise<T> {
  if (!API_URL) throw new ApiError(0, 'Ứng dụng chưa được cấu hình máy chủ')
  let res: Response
  try {
    res = await fetch(API_URL + path, {
      method: opts.method ?? 'GET',
      headers: {
        ...(opts.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(opts.token ? { Authorization: `Bearer ${opts.token}` } : {}),
      },
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    })
  } catch {
    throw new ApiError(0, 'Không kết nối được máy chủ. Kiểm tra mạng rồi thử lại nhé')
  }
  const body = await res.json().catch(() => ({}))
  if (!res.ok) throw new ApiError(res.status, body?.error ?? 'Máy chủ gặp lỗi, thử lại sau', body)
  return body as T
}

export type AuthResult = { token: string; user: User }
export const apiRegister = (b: { name: string; username: string; password: string; classCode: string }) =>
  api<AuthResult>('/auth/register', { method: 'POST', body: b })
export const apiLogin = (b: { username: string; password: string }) => api<AuthResult>('/auth/login', { method: 'POST', body: b })
export const apiGetProgress = (token: string) => api<{ data: unknown; rev: number }>('/progress', { token })
export const apiPutProgress = (token: string, data: unknown, baseRev: number) =>
  api<{ rev: number }>('/progress', { method: 'PUT', body: { data, baseRev }, token })
