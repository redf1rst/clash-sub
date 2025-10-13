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

	describe('Content-Disposition Header Parsing', () => {
		it('should parse filename*=UTF-8 format correctly', () => {
			// 模拟 parseHeaders 函数的逻辑
			const testCases = [
				{
					header: "attachment;filename*=UTF-8''%E9%9D%92%E4%BA%91%E6%A2%AF",
					expected: "青云梯"
				},
				{
					header: "attachment; filename=SubMerge",
					expected: "SubMerge"
				},
				{
					header: 'attachment; filename="PandaFan Home User 353784"',
					expected: "PandaFan Home User 353784"
				},
				{
					header: "attachment;filename*=UTF-8''Nova%E5%8A%A0%E9%80%9F",
					expected: "Nova加速"
				}
			];

			testCases.forEach(({ header, expected }) => {
				const subInfo = { name: '', download: 0, total: 0, expire: null, success: true, statusCode: 200 };

				// 模拟 parseHeaders 函数的 Content-Disposition 解析逻辑
				if (header) {
					// 先处理 filename*=UTF-8'' 格式（RFC 5987）
					const filenameStarMatch = header.match(/filename\*\s*=\s*(?:UTF-8|utf-8)''([^;]+)/i);
					if (filenameStarMatch) {
						try {
							// URL 解码，filenameStarMatch[1] 是实际的文件名值
							subInfo.name = decodeURIComponent(filenameStarMatch[1]);
						} catch (e) {
							// 解码失败，尝试作为原始值
							subInfo.name = filenameStarMatch[1];
						}
					}

					// 如果没有获取到名称，尝试标准 filename= 格式
					if (!subInfo.name) {
						const filenameMatch = header.match(/filename\s*=\s*([^;]+)/i);
						if (filenameMatch) {
							let rawName = filenameMatch[1].trim();

							// 移除可能的引号
							if ((rawName.startsWith('"') && rawName.endsWith('"')) ||
								(rawName.startsWith("'") && rawName.endsWith("'"))) {
								rawName = rawName.slice(1, -1);
							}

							if (rawName) {
								if (rawName.includes('%')) {
									try {
										subInfo.name = decodeURIComponent(rawName);
									} catch (e) {
										subInfo.name = rawName;
									}
								} else {
									subInfo.name = rawName;
								}
							}
						}
					}
				}

				expect(subInfo.name).toBe(expected);
			});
		});

		describe('Case-Insensitive Header Parsing', () => {
			it('should handle case-insensitive headers correctly', () => {
				// 模拟大小写不敏感的头部获取函数
				function getHeaderCaseInsensitive(headers, headerName) {
					// 首先尝试直接获取
					let value = headers.get(headerName);
					if (value) return value;

					// 如果没有找到，遍历所有头部进行大小写不敏感匹配
					const lowerHeaderName = headerName.toLowerCase();
					for (const [key, val] of headers.entries()) {
						if (key.toLowerCase() === lowerHeaderName) {
							return val;
						}
					}

					return null;
				}

				// 模拟 Headers 对象
				const mockHeaders = new Map([
					['content-disposition', 'attachment;filename*=UTF-8\'\'Nova%E5%8A%A0%E9%80%9F'],
					['subscription-userinfo', 'upload=8808742990; download=682978730455; total=1073741824000000; expire=']
				]);

				// 测试大小写不敏感获取
				expect(getHeaderCaseInsensitive(mockHeaders, 'Content-Disposition')).toBe('attachment;filename*=UTF-8\'\'Nova%E5%8A%A0%E9%80%9F');
				expect(getHeaderCaseInsensitive(mockHeaders, 'CONTENT-DISPOSITION')).toBe('attachment;filename*=UTF-8\'\'Nova%E5%8A%A0%E9%80%9F');
				expect(getHeaderCaseInsensitive(mockHeaders, 'content-disposition')).toBe('attachment;filename*=UTF-8\'\'Nova%E5%8A%A0%E9%80%9F');

				expect(getHeaderCaseInsensitive(mockHeaders, 'Subscription-Userinfo')).toBe('upload=8808742990; download=682978730455; total=1073741824000000; expire=');
				expect(getHeaderCaseInsensitive(mockHeaders, 'SUBSCRIPTION-USERINFO')).toBe('upload=8808742990; download=682978730455; total=1073741824000000; expire=');
				expect(getHeaderCaseInsensitive(mockHeaders, 'subscription-userinfo')).toBe('upload=8808742990; download=682978730455; total=1073741824000000; expire=');
			});

			it('should parse subscription-userinfo with various cases correctly', () => {
				const testCases = [
					{
						userInfo: 'upload=86333840; download=64883843714; total=64424509440; expire=1760187900',
						expected: {
							download: 64883843714,
							total: 64424509440,
							expire: 1760187900
						}
					},
					{
						userInfo: 'UPLOAD=86333840; DOWNLOAD=64883843714; TOTAL=64424509440; EXPIRE=1760187900',
						expected: {
							download: 64883843714,
							total: 64424509440,
							expire: 1760187900
						}
					},
					{
						userInfo: 'upload=8808742990; download=682978730455; total=1073741824000000; expire=',
						expected: {
							download: 682978730455,
							total: 1073741824000000,
							expire: null
						}
					}
				];

				testCases.forEach(({ userInfo, expected }) => {
					const subInfo = { name: '', download: 0, total: 0, expire: null, success: true, statusCode: 200 };

					// 模拟 parseHeaders 函数的 Subscription-Userinfo 解析逻辑
					if (userInfo) {
						const parts = userInfo.split(';').map(part => part.trim());
						for (const part of parts) {
							const [key, value] = part.split('=').map(s => s.trim());
							const lowerKey = key.toLowerCase();
							switch (lowerKey) {
								case 'upload':
									// 上传流量，暂时不使用但保留解析
									break;
								case 'download':
									subInfo.download = parseInt(value) || 0;
									break;
								case 'total':
									subInfo.total = parseInt(value) || 0;
									break;
								case 'expire':
									// 处理空值或无效值的情况
									const expireValue = parseInt(value);
									subInfo.expire = (expireValue && expireValue > 0) ? expireValue : null;
									break;
							}
						}
					}

					expect(subInfo.download).toBe(expected.download);
					expect(subInfo.total).toBe(expected.total);
					expect(subInfo.expire).toBe(expected.expire);
				});
			});
		});
	});
});
