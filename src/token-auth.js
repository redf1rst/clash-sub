// 访问令牌认证模块 - 简洁的Cookie Token认证

/**
 * 从Cookie中获取访问令牌
 */
function getTokenFromCookie(request) {
	const cookieHeader = request.headers.get('Cookie');
	if (!cookieHeader) return null;

	const cookies = cookieHeader.split(';').map(c => c.trim());
	const tokenCookie = cookies.find(c => c.startsWith('access_token='));

	if (!tokenCookie) return null;
	return tokenCookie.split('=')[1];
}

/**
 * 设置访问令牌Cookie (双Cookie策略)
 * @param {string} token - 访问令牌
 * @param {boolean} isSecure - 是否使用Secure属性(HTTPS环境)
 * @returns {Array} 返回两个Cookie字符串数组
 */
function setTokenCookie(token, isSecure = false) {
	// 30天有效期
	const maxAge = 30 * 24 * 60 * 60;
	// 在HTTPS环境下使用Secure属性,HTTP环境(如本地开发)不使用
	const secureFlag = isSecure ? '; Secure' : '';

	// 双Cookie策略:
	// 1. HttpOnly cookie用于后端验证(更安全,JS无法读取)
	const httpOnlyCookie = `access_token=${token}; Path=/; Max-Age=${maxAge}; HttpOnly; SameSite=Strict${secureFlag}`;
	// 2. 前端可读cookie仅用于标记已登录(不包含敏感信息)
	const frontendCookie = `access_token_client=1; Path=/; Max-Age=${maxAge}; SameSite=Strict${secureFlag}`;

	return [httpOnlyCookie, frontendCookie];
}

/**
 * 清除访问令牌Cookie (双Cookie策略)
 * @param {boolean} isSecure - 是否使用Secure属性(HTTPS环境)
 * @returns {Array} 返回两个Cookie字符串数组
 */
function clearTokenCookie(isSecure = false) {
	const secureFlag = isSecure ? '; Secure' : '';
	// 清除两个cookie
	const clearHttpOnly = `access_token=; Path=/; Max-Age=0; HttpOnly; SameSite=Strict${secureFlag}`;
	const clearFrontend = `access_token_client=; Path=/; Max-Age=0; SameSite=Strict${secureFlag}`;
	return [clearHttpOnly, clearFrontend];
}

/**
 * 检查路径是否在白名单中（无需令牌）
 */
function isWhitelistedPath(path) {
	const whitelist = [
		'/auth',
		'/auth.html',
		'/api/verify-token',
		'/favicon.ico'
	];

	// 订阅路径白名单 - 允许Clash客户端直接访问
	const subscriptionPaths = [
		'/clash/proxies',      // 节点订阅
		'/clash/submerge'      // 订阅整合
	];

	// 检查精确匹配
	if (whitelist.includes(path)) {
		return true;
	}

	// 检查订阅路径前缀匹配 (支持带集合ID的路径)
	return subscriptionPaths.some(prefix => path.startsWith(prefix));
}

/**
 * 验证访问令牌
 */
function verifyToken(token, env) {
	// 检查是否启用认证
	const authEnabled = env.ACCESS_TOKEN_ENABLED === 'true';
	if (!authEnabled) {
		return true; // 未启用认证，直接通过
	}

	// 判断是否为本地开发环境 (wrangler dev)
	const isDev = env.ENVIRONMENT === 'development' || !env.ACCESS_TOKEN;
	const validToken = isDev ? env.ACCESS_TOKEN_DEV : env.ACCESS_TOKEN;

	if (!validToken) {
		console.warn(`${isDev ? 'ACCESS_TOKEN_DEV' : 'ACCESS_TOKEN'}未配置，认证系统无法工作`);
		return false;
	}

	return token === validToken;
}

/**
 * 认证中间件 - 检查访问令牌
 */
function checkToken(request, env) {
	const url = new URL(request.url);
	const path = url.pathname;

	// 检查是否启用认证
	const authEnabled = env.ACCESS_TOKEN_ENABLED === 'true';
	if (!authEnabled) {
		return { authenticated: true, response: null };
	}

	// 白名单路径直接放行
	if (isWhitelistedPath(path)) {
		return { authenticated: true, response: null };
	}

	// 从Cookie获取令牌
	const token = getTokenFromCookie(request);
	const isValid = verifyToken(token, env);

	if (!isValid) {
		// 令牌无效，重定向到验证页面
		const authUrl = new URL('/auth', url.origin);
		authUrl.searchParams.set('redirect', path);

		return {
			authenticated: false,
			response: Response.redirect(authUrl.toString(), 302)
		};
	}

	// 令牌有效
	return {
		authenticated: true,
		response: null
	};
}

/**
 * 处理令牌验证请求
 */
async function handleTokenVerification(request, env) {
	if (request.method !== 'POST') {
		return new Response('Method Not Allowed', { status: 405 });
	}

	try {
		const { token } = await request.json();

		// 判断是否为本地开发环境 (wrangler dev)
		const isDev = env.ENVIRONMENT === 'development' || !env.ACCESS_TOKEN;
		const validToken = isDev ? env.ACCESS_TOKEN_DEV : env.ACCESS_TOKEN;

		if (!validToken) {
			return new Response(JSON.stringify({
				success: false,
				message: `认证系统未配置，请设置 ${isDev ? 'ACCESS_TOKEN_DEV' : 'ACCESS_TOKEN'} 环境变量`
			}), {
				status: 500,
				headers: { 'Content-Type': 'application/json' }
			});
		}

		if (token !== validToken) {
			return new Response(JSON.stringify({
				success: false,
				message: '访问令牌错误'
			}), {
				status: 401,
				headers: { 'Content-Type': 'application/json' }
			});
		}

		// 令牌正确，设置Cookie
		// 检测是否为HTTPS环境
		const url = new URL(request.url);
		const isSecure = url.protocol === 'https:';

		// 获取双Cookie数组
		const cookies = setTokenCookie(token, isSecure);

		// 使用Headers对象设置多个Set-Cookie头
		const headers = new Headers();
		headers.set('Content-Type', 'application/json');
		cookies.forEach(cookie => headers.append('Set-Cookie', cookie));

		return new Response(JSON.stringify({
			success: true,
			message: '验证成功'
		}), {
			status: 200,
			headers: headers
		});

	} catch (error) {
		return new Response(JSON.stringify({
			success: false,
			message: '验证失败'
		}), {
			status: 500,
			headers: { 'Content-Type': 'application/json' }
		});
	}
}

/**
 * 处理清除令牌请求
 */
function handleClearToken(request) {
	// 检测是否为HTTPS环境
	const url = new URL(request.url);
	const isSecure = url.protocol === 'https:';

	// 获取双Cookie数组
	const cookies = clearTokenCookie(isSecure);

	// 使用Headers对象设置多个Set-Cookie头
	const headers = new Headers();
	headers.set('Content-Type', 'application/json');
	cookies.forEach(cookie => headers.append('Set-Cookie', cookie));

	return new Response(JSON.stringify({
		success: true,
		message: '令牌已清除'
	}), {
		status: 200,
		headers: headers
	});
}

// 导出函数
export {
	checkToken,
	handleTokenVerification,
	handleClearToken,
	getTokenFromCookie,
	verifyToken
};
