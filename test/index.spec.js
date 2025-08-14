import { env, createExecutionContext, waitOnExecutionContext, SELF } from 'cloudflare:test';
import { describe, it, expect } from 'vitest';
import worker from '../src';

describe('Clash订阅生成器 Worker', () => {
	describe('API Routes', () => {
		it('GET /api/proxies returns empty array initially', async () => {
			const request = new Request('http://example.com/api/proxies');
			const ctx = createExecutionContext();
			const response = await worker.fetch(request, env, ctx);
			await waitOnExecutionContext(ctx);

			expect(response.status).toBe(200);
			expect(response.headers.get('Content-Type')).toBe('application/json');
			const data = await response.json();
			expect(Array.isArray(data)).toBe(true);
		});

		it('GET /api/submerge returns empty array initially', async () => {
			const request = new Request('http://example.com/api/submerge');
			const ctx = createExecutionContext();
			const response = await worker.fetch(request, env, ctx);
			await waitOnExecutionContext(ctx);

			expect(response.status).toBe(200);
			expect(response.headers.get('Content-Type')).toBe('application/json');
			const data = await response.json();
			expect(Array.isArray(data)).toBe(true);
		});

		it('POST /api/proxies with invalid action returns 400', async () => {
			const request = new Request('http://example.com/api/proxies', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ action: 'invalid' })
			});
			const ctx = createExecutionContext();
			const response = await worker.fetch(request, env, ctx);
			await waitOnExecutionContext(ctx);

			expect(response.status).toBe(400);
		});

		it('POST /api/submerge with invalid action returns 400', async () => {
			const request = new Request('http://example.com/api/submerge', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ action: 'invalid' })
			});
			const ctx = createExecutionContext();
			const response = await worker.fetch(request, env, ctx);
			await waitOnExecutionContext(ctx);

			expect(response.status).toBe(400);
		});
	});

	describe('Config Generation', () => {
		it('GET /clash/proxies returns YAML config', async () => {
			const request = new Request('http://example.com/clash/proxies');
			const ctx = createExecutionContext();
			const response = await worker.fetch(request, env, ctx);
			await waitOnExecutionContext(ctx);

			expect(response.status).toBe(200);
			expect(response.headers.get('Content-Type')).toBe('text/yaml; charset=utf-8');
			expect(response.headers.get('Content-Disposition')).toBe('attachment; filename=ProxySub');
		});

		it('GET /clash/submerge returns YAML config', async () => {
			const request = new Request('http://example.com/clash/submerge');
			const ctx = createExecutionContext();
			const response = await worker.fetch(request, env, ctx);
			await waitOnExecutionContext(ctx);

			expect(response.status).toBe(200);
			expect(response.headers.get('Content-Type')).toBe('text/yaml; charset=utf-8');
			expect(response.headers.get('Content-Disposition')).toBe('attachment; filename=SubMerge');
		});
	});

	describe('Static File Serving', () => {
		it('GET / returns 404 in test environment (static files handled by platform)', async () => {
			const request = new Request('http://example.com/');
			const ctx = createExecutionContext();
			const response = await worker.fetch(request, env, ctx);
			await waitOnExecutionContext(ctx);

			// 在测试环境中，静态文件处理由平台处理，worker 返回 404 是正常的
			expect(response.status).toBe(404);
		});
	});

	describe('404 Handling', () => {
		it('GET /nonexistent returns 404', async () => {
			const request = new Request('http://example.com/nonexistent');
			const ctx = createExecutionContext();
			const response = await worker.fetch(request, env, ctx);
			await waitOnExecutionContext(ctx);

			expect(response.status).toBe(404);
			expect(await response.text()).toBe('Not Found');
		});
	});
});
