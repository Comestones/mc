export class ApiError extends Error { constructor(public status: number) { super('请求未完成'); } }
export async function call<T>(base: string, path: string, data?: unknown, token?: string): Promise<T> {
  const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 10000);
  try {
    const response = await fetch(base + path, { method: data === undefined ? 'GET' : 'POST', credentials: 'omit', signal: controller.signal,
      headers: { ...(data !== undefined ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      ...(data !== undefined ? { body: JSON.stringify(data) } : {}) });
    if (!response.ok) throw new ApiError(response.status);
    return await response.json();
  } finally { clearTimeout(timer); }
}
export function message(error: unknown) {
  if (error instanceof ApiError) {
    if (error.status === 401) return '邮箱或密码不正确，或会话已过期。';
    if (error.status === 403) return '初始化密钥不正确，或当前来源未获允许。';
    if (error.status === 409) return '初始化已完成或邮箱已存在，请重新检查部署状态。';
    if (error.status === 400) return '请检查邮箱、名称和密码格式。';
    if (error.status === 429) return '请求过于频繁，请稍后再试。';
  }
  return '暂时无法连接账户服务，请稍后重试。';
}
