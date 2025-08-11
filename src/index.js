// Clash订阅生成器 - Cloudflare Worker
export default {
	async fetch(request, env) {
		const url = new URL(request.url);
		const path = url.pathname;

		// 路由处理
		if (path === '/') {
			return new Response(getHTML(request), {
				headers: { 'Content-Type': 'text/html; charset=utf-8' }
			});
		}

		if (path === '/api/proxies') {
			return handleProxiesAPI(request, env);
		}

		if (path === '/api/submerge') {
			return handleSubMergeAPI(request, env);
		}

		if (path === '/clash/proxies') {
			return generateProxiesConfig(env);
		}

		if (path === '/clash/submerge') {
			return generateSubMergeConfig(env);
		}

		return new Response('Not Found', { status: 404 });
	}
};

// 处理节点整合API
async function handleProxiesAPI(request, env) {
	const method = request.method;

	if (method === 'GET') {
		const proxies = await env.CLASH_KV?.get('proxies') || '[]';
		return new Response(proxies, {
			headers: { 'Content-Type': 'application/json' }
		});
	}

	if (method === 'POST') {
		const { action, data } = await request.json();

		switch (action) {
			case 'add':
				return await addProxy(data, env);
			case 'delete':
				return await deleteProxy(data.index, env);
			case 'clear':
				return await clearProxies(env);
			default:
				return new Response('Invalid action', { status: 400 });
		}
	}

	return new Response('Method not allowed', { status: 405 });
}

// 处理订阅整合API
async function handleSubMergeAPI(request, env) {
	const method = request.method;

	if (method === 'GET') {
		const url = new URL(request.url);
		if (url.searchParams.get('names') === 'true') {
			const subscriptionNames = await env.CLASH_KV?.get('subscription_names') || '[]';
			return new Response(subscriptionNames, {
				headers: { 'Content-Type': 'application/json' }
			});
		}

		if (url.searchParams.get('update') === 'true') {
			return await updateSubscriptionNames(env);
		}

		const subscriptions = await env.CLASH_KV?.get('subscriptions') || '[]';
		return new Response(subscriptions, {
			headers: { 'Content-Type': 'application/json' }
		});
	}

	if (method === 'POST') {
		const { action, data } = await request.json();

		switch (action) {
			case 'add':
				return await addSubscription(data, env);
			case 'delete':
				return await deleteSubscription(data.index, env);
			case 'clear':
				return await clearSubscriptions(env);
			default:
				return new Response('Invalid action', { status: 400 });
		}
	}

	return new Response('Method not allowed', { status: 405 });
}

// 添加节点
async function addProxy(data, env) {
	try {
		const { proxyUrls, region } = data;
		const proxies = JSON.parse(await env.CLASH_KV?.get('proxies') || '[]');

		// 支持多行输入
		const urls = proxyUrls.split('\n').map(url => url.trim()).filter(url => url);

		let successCount = 0;
		let duplicateCount = 0;
		const addedProxies = [];

		for (const proxyUrl of urls) {
			const proxyConfig = parseProxyUrl(proxyUrl);

			if (!proxyConfig) {
				continue; // 跳过无效的节点链接
			}

			// 检查重复节点
			const isDuplicate = proxies.some(p =>
				p.server === proxyConfig.server && p.port === proxyConfig.port
			);

			if (isDuplicate) {
				duplicateCount++;
				continue;
			}

			// 生成节点名称
			let detectedRegion;
			if (region === 'auto') {
				detectedRegion = await detectRegion(proxyConfig.server);
			} else {
				detectedRegion = region;
			}

			// 地区代码映射为英文缩写+中文格式
			const regionNames = {
				'HK': 'HK香港',
				'TW': 'TW台湾',
				'JP': 'JP日本',
				'KR': 'KR韩国',
				'SG': 'SG新加坡',
				'US': 'US美国',
				'UK': 'UK英国',
				'DE': 'DE德国',
				'FR': 'FR法国',
				'AU': 'AU澳洲',
				'CA': 'CA加拿大',
				'RU': 'RU俄罗斯',
				'IN': 'IN印度',
				'BR': 'BR巴西',
				'NL': 'NL荷兰',
				'IT': 'IT意大利',
				'ES': 'ES西班牙',
				'CH': 'CH瑞士',
				'MY': 'MY马来西亚',
				'TH': 'TH泰国',
				'VN': 'VN越南',
				'ID': 'ID印尼',
				'PH': 'PH菲律宾',
				'TR': 'TR土耳其',
				'AE': 'AE阿联酋',
				'IL': 'IL以色列',
				'ZA': 'ZA南非',
				'EG': 'EG埃及',
				'AR': 'AR阿根廷',
				'CL': 'CL智利',
				'MX': 'MX墨西哥',
				'CO': 'CO哥伦比亚',
				'PE': 'PE秘鲁',
				'UA': 'UA乌克兰',
				'PL': 'PL波兰',
				'CZ': 'CZ捷克',
				'AT': 'AT奥地利',
				'BE': 'BE比利时',
				'SE': 'SE瑞典',
				'NO': 'NO挪威',
				'DK': 'DK丹麦',
				'FI': 'FI芬兰',
				'Unknown': 'Unknown未知'
			};

			const regionName = regionNames[detectedRegion] || `${detectedRegion}未知`;
			const isIPv6 = proxyConfig.server.includes(':');
			const suffix = isIPv6 ? '-IPv6' : '-IPv4';

			// 计算序号 - 找到该地区可用的最小序号，填补空缺
			const regionPattern = new RegExp(`^${regionName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\d{2})-(IPv4|IPv6)$`);
			const usedNumbers = new Set();

			// 检查现有节点使用的序号
			proxies.forEach(p => {
				const match = p.name.match(regionPattern);
				if (match) {
					const num = parseInt(match[1]);
					usedNumbers.add(num);
				}
			});

			// 检查本次添加的节点使用的序号
			addedProxies.forEach(p => {
				const match = p.name.match(regionPattern);
				if (match) {
					const num = parseInt(match[1]);
					usedNumbers.add(num);
				}
			});

			// 找到最小的可用序号（填补空缺）
			let nodeNumber = 1;
			while (usedNumbers.has(nodeNumber)) {
				nodeNumber++;
			}
			usedNumbers.add(nodeNumber);

			// 使用两位数字格式
			const nodeNumberStr = String(nodeNumber).padStart(2, '0');
			proxyConfig.name = `${regionName}${nodeNumberStr}${suffix}`;

			proxies.push(proxyConfig);
			addedProxies.push(proxyConfig);
			successCount++;
		}

		// 对节点进行排序：先按地区缩写(A-Z)，再按序号排序
		proxies.sort((a, b) => {
			// 提取地区缩写和序号
			const regionPatternForSort = /^([A-Z]{2}[^0-9]*?)(\d{2})-(IPv4|IPv6)$/;
			const matchA = a.name.match(regionPatternForSort);
			const matchB = b.name.match(regionPatternForSort);

			if (matchA && matchB) {
				const regionA = matchA[1];
				const regionB = matchB[1];
				const numberA = parseInt(matchA[2]);
				const numberB = parseInt(matchB[2]);

				// 首先按地区缩写排序
				if (regionA !== regionB) {
					return regionA.localeCompare(regionB);
				}
				// 地区相同时按序号排序
				return numberA - numberB;
			}

			// 如果匹配失败，按名称排序
			return a.name.localeCompare(b.name);
		});

		await env.CLASH_KV?.put('proxies', JSON.stringify(proxies));

		return new Response(JSON.stringify({
			success: true,
			successCount,
			duplicateCount,
			addedProxies
		}), {
			headers: { 'Content-Type': 'application/json' }
		});
	} catch (error) {
		return new Response(JSON.stringify({ error: '添加节点失败' }), {
			status: 500,
			headers: { 'Content-Type': 'application/json' }
		});
	}
}

// 删除节点
async function deleteProxy(index, env) {
	try {
		const proxies = JSON.parse(await env.CLASH_KV?.get('proxies') || '[]');
		proxies.splice(index, 1);

		// 删除后也进行排序，保持一致性
		proxies.sort((a, b) => {
			// 提取地区缩写和序号
			const regionPatternForSort = /^([A-Z]{2}[^0-9]*?)(\d{2})-(IPv4|IPv6)$/;
			const matchA = a.name.match(regionPatternForSort);
			const matchB = b.name.match(regionPatternForSort);

			if (matchA && matchB) {
				const regionA = matchA[1];
				const regionB = matchB[1];
				const numberA = parseInt(matchA[2]);
				const numberB = parseInt(matchB[2]);

				// 首先按地区缩写排序
				if (regionA !== regionB) {
					return regionA.localeCompare(regionB);
				}
				// 地区相同时按序号排序
				return numberA - numberB;
			}

			// 如果匹配失败，按名称排序
			return a.name.localeCompare(b.name);
		});

		await env.CLASH_KV?.put('proxies', JSON.stringify(proxies));

		return new Response(JSON.stringify({ success: true }), {
			headers: { 'Content-Type': 'application/json' }
		});
	} catch (error) {
		return new Response(JSON.stringify({ error: '删除节点失败' }), {
			status: 500,
			headers: { 'Content-Type': 'application/json' }
		});
	}
}

// 清空所有节点
async function clearProxies(env) {
	try {
		await env.CLASH_KV?.put('proxies', '[]');
		return new Response(JSON.stringify({ success: true }), {
			headers: { 'Content-Type': 'application/json' }
		});
	} catch (error) {
		return new Response(JSON.stringify({ error: '清空节点失败' }), {
			status: 500,
			headers: { 'Content-Type': 'application/json' }
		});
	}
}

// 添加订阅
async function addSubscription(data, env) {
	try {
		const subscriptions = JSON.parse(await env.CLASH_KV?.get('subscriptions') || '[]');
		const subscriptionNames = JSON.parse(await env.CLASH_KV?.get('subscription_names') || '[]');

		// 支持批量添加
		const urls = data.split('\n').map(url => url.trim()).filter(url => url);

		let successCount = 0;
		let duplicateCount = 0;
		let failedCount = 0;
		const addedSubscriptions = [];

		for (const subUrl of urls) {
			// 检查重复订阅
			if (subscriptions.includes(subUrl)) {
				duplicateCount++;
				continue; // 跳过重复的订阅
			}

			// 获取订阅信息（包括名称、流量、到期时间）
			const subInfo = await getSubscriptionInfo(subUrl);

			// 检查订阅是否获取失败（403或502）
			if (!subInfo.success) {
				failedCount++;
				continue; // 跳过获取失败的订阅
			}

			// 生成订阅名称
			const subName = generateSubscriptionName(subInfo, subscriptionNames);

			subscriptions.push(subUrl);
			subscriptionNames.push(subName);
			addedSubscriptions.push({ url: subUrl, name: subName });
			successCount++;
		}

		// 对订阅进行排序：按序号由小到大排序
		// 创建索引数组来保持订阅链接和名称的对应关系
		const subscriptionPairs = subscriptions.map((url, index) => ({
			url: url,
			name: subscriptionNames[index],
			index: index
		}));

		// 按订阅名称中的序号排序
		subscriptionPairs.sort((a, b) => {
			const matchA = a.name.match(/^订阅(\d{2})$/);
			const matchB = b.name.match(/^订阅(\d{2})$/);

			if (matchA && matchB) {
				const numberA = parseInt(matchA[1]);
				const numberB = parseInt(matchB[1]);
				return numberA - numberB;
			}

			// 如果不匹配默认格式，按名称排序
			return a.name.localeCompare(b.name);
		});

		// 重新构建排序后的数组
		const sortedSubscriptions = subscriptionPairs.map(pair => pair.url);
		const sortedSubscriptionNames = subscriptionPairs.map(pair => pair.name);

		await env.CLASH_KV?.put('subscriptions', JSON.stringify(sortedSubscriptions));
		await env.CLASH_KV?.put('subscription_names', JSON.stringify(sortedSubscriptionNames));

		return new Response(JSON.stringify({
			success: true,
			successCount,
			duplicateCount,
			failedCount,
			addedSubscriptions
		}), {
			headers: { 'Content-Type': 'application/json' }
		});
	} catch (error) {
		return new Response(JSON.stringify({ error: '添加订阅失败' }), {
			status: 500,
			headers: { 'Content-Type': 'application/json' }
		});
	}
}

// 删除订阅
async function deleteSubscription(index, env) {
	try {
		const subscriptions = JSON.parse(await env.CLASH_KV?.get('subscriptions') || '[]');
		const subscriptionNames = JSON.parse(await env.CLASH_KV?.get('subscription_names') || '[]');

		subscriptions.splice(index, 1);
		subscriptionNames.splice(index, 1);

		// 删除后进行排序：按序号由小到大排序
		// 创建索引数组来保持订阅链接和名称的对应关系
		const subscriptionPairs = subscriptions.map((url, idx) => ({
			url: url,
			name: subscriptionNames[idx],
			index: idx
		}));

		// 按订阅名称中的序号排序
		subscriptionPairs.sort((a, b) => {
			const matchA = a.name.match(/^订阅(\d{2})$/);
			const matchB = b.name.match(/^订阅(\d{2})$/);

			if (matchA && matchB) {
				const numberA = parseInt(matchA[1]);
				const numberB = parseInt(matchB[1]);
				return numberA - numberB;
			}

			// 如果不匹配默认格式，按名称排序
			return a.name.localeCompare(b.name);
		});

		// 重新构建排序后的数组
		const sortedSubscriptions = subscriptionPairs.map(pair => pair.url);
		const sortedSubscriptionNames = subscriptionPairs.map(pair => pair.name);

		await env.CLASH_KV?.put('subscriptions', JSON.stringify(sortedSubscriptions));
		await env.CLASH_KV?.put('subscription_names', JSON.stringify(sortedSubscriptionNames));

		return new Response(JSON.stringify({ success: true }), {
			headers: { 'Content-Type': 'application/json' }
		});
	} catch (error) {
		return new Response(JSON.stringify({ error: '删除订阅失败' }), {
			status: 500,
			headers: { 'Content-Type': 'application/json' }
		});
	}
}

// 清空所有订阅
async function clearSubscriptions(env) {
	try {
		await env.CLASH_KV?.put('subscriptions', '[]');
		await env.CLASH_KV?.put('subscription_names', '[]');
		return new Response(JSON.stringify({ success: true }), {
			headers: { 'Content-Type': 'application/json' }
		});
	} catch (error) {
		return new Response(JSON.stringify({ error: '清空订阅失败' }), {
			status: 500,
			headers: { 'Content-Type': 'application/json' }
		});
	}
}

// 生成节点配置
async function generateProxiesConfig(env) {
	try {
		const proxies = JSON.parse(await env.CLASH_KV?.get('proxies') || '[]');

		// 对节点进行排序：先按地区缩写(A-Z)，再按序号排序
		proxies.sort((a, b) => {
			// 提取地区缩写和序号
			const regionPatternForSort = /^([A-Z]{2}[^0-9]*?)(\d{2})-(IPv4|IPv6)$/;
			const matchA = a.name.match(regionPatternForSort);
			const matchB = b.name.match(regionPatternForSort);

			if (matchA && matchB) {
				const regionA = matchA[1];
				const regionB = matchB[1];
				const numberA = parseInt(matchA[2]);
				const numberB = parseInt(matchB[2]);

				// 首先按地区缩写排序
				if (regionA !== regionB) {
					return regionA.localeCompare(regionB);
				}
				// 地区相同时按序号排序
				return numberA - numberB;
			}

			// 如果匹配失败，按名称排序
			return a.name.localeCompare(b.name);
		});

		const config = {
			// 全局配置 - 参照clash.yaml
			port: 7890,
			'socks-port': 7891,
			'redir-port': 7892,
			'mixed-port': 7893,
			'tproxy-port': 7894,
			'allow-lan': true,
			'bind-address': '*',
			ipv6: false,
			'unified-delay': true,
			'tcp-concurrent': true,
			'log-level': 'info',
			mode: 'rule',
			'geodata-mode': false,
			'geodata-loader': 'standard',
			'geo-auto-update': true,
			'geo-update-interval': 24,

			// 节点配置
			proxies: proxies,

			// 代理组配置 - 参照clash.yaml
			'proxy-groups': [
				{
					name: '节点选择',
					type: 'select',
					proxies: [...proxies.map(p => p.name), 'DIRECT'],
					icon: 'https://cdn.jsdelivr.net/gh/Koolson/Qure@master/IconSet/Color/Proxy.png'
				},
				{
					name: '媒体服务',
					type: 'select',
					proxies: ['节点选择', 'DIRECT', ...proxies.map(p => p.name)],
					icon: 'https://cdn.jsdelivr.net/gh/Koolson/Qure@master/IconSet/Color/Netflix.png'
				},
				{
					name: '微软服务',
					type: 'select',
					proxies: ['节点选择', 'DIRECT', ...proxies.map(p => p.name)],
					icon: 'https://cdn.jsdelivr.net/gh/Koolson/Qure@master/IconSet/Color/Microsoft.png'
				},
				{
					name: '苹果服务',
					type: 'select',
					proxies: ['节点选择', 'DIRECT', ...proxies.map(p => p.name)],
					icon: 'https://cdn.jsdelivr.net/gh/Koolson/Qure@master/IconSet/Color/Apple.png'
				},
				{
					name: 'CDN服务',
					type: 'select',
					proxies: ['节点选择', 'DIRECT', ...proxies.map(p => p.name)],
					icon: 'https://cdn.jsdelivr.net/gh/Koolson/Qure@master/IconSet/Color/OneDrive.png'
				},
				{
					name: 'AI服务',
					type: 'select',
					proxies: ['节点选择', 'DIRECT', ...proxies.map(p => p.name)],
					icon: 'https://cdn.jsdelivr.net/gh/Koolson/Qure@master/IconSet/Color/ChatGPT.png'
				},
				{
					name: 'Telegram',
					type: 'select',
					proxies: ['节点选择', 'DIRECT', ...proxies.map(p => p.name)],
					icon: 'https://cdn.jsdelivr.net/gh/Koolson/Qure@master/IconSet/Color/Telegram.png'
				}
			],

			// 规则配置 - 参照clash.yaml
			rules: [
				'RULE-SET,reject_non_ip,REJECT',
				'RULE-SET,reject_domainset,REJECT',
				'RULE-SET,reject_extra_domainset,REJECT',
				'RULE-SET,reject_non_ip_drop,REJECT-DROP',
				'RULE-SET,reject_non_ip_no_drop,REJECT',
				'RULE-SET,telegram_non_ip,Telegram',
				'RULE-SET,apple_cdn,苹果服务',
				'RULE-SET,apple_cn_non_ip,苹果服务',
				'RULE-SET,microsoft_cdn_non_ip,微软服务',
				'RULE-SET,apple_services,苹果服务',
				'RULE-SET,microsoft_non_ip,微软服务',
				'RULE-SET,download_domainset,CDN服务',
				'RULE-SET,download_non_ip,CDN服务',
				'RULE-SET,cdn_domainset,CDN服务',
				'RULE-SET,cdn_non_ip,CDN服务',
				'RULE-SET,stream_non_ip,媒体服务',
				'RULE-SET,ai_non_ip,AI服务',
				'RULE-SET,global_non_ip,节点选择',
				'RULE-SET,domestic_non_ip,DIRECT',
				'RULE-SET,direct_non_ip,DIRECT',
				'RULE-SET,lan_non_ip,DIRECT',
				'RULE-SET,advertising-ads,REJECT',
				'DOMAIN-KEYWORD,ad,REJECT',
				'DOMAIN-KEYWORD,ads,REJECT',
				'DOMAIN-KEYWORD,analytics,REJECT',
				'DOMAIN-KEYWORD,doubleclick,REJECT',
				'DOMAIN-KEYWORD,googlesyndication,REJECT',
				'DOMAIN,cdn.jsdmirror.com,CDN服务',
				'DOMAIN,raw.githubusercontent.com,CDN服务',
				'DOMAIN-SUFFIX,cdn.jsdelivr.net,CDN服务',
				'DOMAIN-SUFFIX,cdnjs.cloudflare.com,CDN服务',
				'DOMAIN-SUFFIX,gstatic.com,CDN服务',
				'DOMAIN-SUFFIX,adobe.io,REJECT',
				'DOMAIN-SUFFIX,adobestats.io,REJECT',
				'DOMAIN-SUFFIX,cursor.sh,节点选择',
				'DOMAIN-SUFFIX,cursorapi.com,节点选择',
				'DOMAIN-SUFFIX,linux.do,DIRECT',
				'GEOSITE,CN,DIRECT',
				'RULE-SET,reject_ip,REJECT',
				'RULE-SET,telegram_ip,Telegram',
				'RULE-SET,stream_ip,媒体服务',
				'RULE-SET,lan_ip,DIRECT',
				'RULE-SET,domestic_ip,DIRECT',
				'RULE-SET,china_ip,DIRECT',
				'GEOIP,LAN,DIRECT',
				'GEOIP,CN,DIRECT',
				'MATCH,节点选择'
			],

			// 规则提供者配置 - 参照clash.yaml
			'rule-providers': {
				'advertising-ads': {
					type: 'http',
					interval: 3600,
					behavior: 'domain',
					format: 'mrs',
					proxy: '节点选择',
					url: 'https://cdn.jsdmirror.com/gh/TG-Twilight/AWAvenue-Ads-Rule@main/Filters/AWAvenue-Ads-Rule-Clash.mrs',
					path: './rule_set/advertising_ads_Domain.mrs'
				},
				reject_non_ip_no_drop: {
					type: 'http',
					behavior: 'classical',
					interval: 43200,
					format: 'text',
					proxy: '节点选择',
					url: 'https://ruleset.skk.moe/Clash/non_ip/reject-no-drop.txt',
					path: './rule_set/sukkaw_ruleset/reject_non_ip_no_drop.txt'
				},
				reject_non_ip_drop: {
					type: 'http',
					behavior: 'classical',
					interval: 43200,
					format: 'text',
					proxy: '节点选择',
					url: 'https://ruleset.skk.moe/Clash/non_ip/reject-drop.txt',
					path: './rule_set/sukkaw_ruleset/reject_non_ip_drop.txt'
				},
				reject_non_ip: {
					type: 'http',
					behavior: 'classical',
					interval: 43200,
					format: 'text',
					proxy: '节点选择',
					url: 'https://ruleset.skk.moe/Clash/non_ip/reject.txt',
					path: './rule_set/sukkaw_ruleset/reject_non_ip.txt'
				},
				reject_domainset: {
					type: 'http',
					behavior: 'domain',
					interval: 43200,
					format: 'text',
					proxy: '节点选择',
					url: 'https://ruleset.skk.moe/Clash/domainset/reject.txt',
					path: './rule_set/sukkaw_ruleset/reject_domainset.txt'
				},
				reject_extra_domainset: {
					type: 'http',
					behavior: 'domain',
					interval: 43200,
					format: 'text',
					proxy: '节点选择',
					url: 'https://ruleset.skk.moe/Clash/domainset/reject_extra.txt',
					path: './sukkaw_ruleset/reject_domainset_extra.txt'
				},
				reject_ip: {
					type: 'http',
					behavior: 'classical',
					interval: 43200,
					format: 'text',
					proxy: '节点选择',
					url: 'https://ruleset.skk.moe/Clash/ip/reject.txt',
					path: './rule_set/sukkaw_ruleset/reject_ip.txt'
				},
				cdn_domainset: {
					type: 'http',
					behavior: 'domain',
					interval: 43200,
					format: 'text',
					proxy: '节点选择',
					url: 'https://ruleset.skk.moe/Clash/domainset/cdn.txt',
					path: './rule_set/sukkaw_ruleset/cdn_domainset.txt'
				},
				cdn_non_ip: {
					type: 'http',
					behavior: 'domain',
					interval: 43200,
					format: 'text',
					proxy: '节点选择',
					url: 'https://ruleset.skk.moe/Clash/non_ip/cdn.txt',
					path: './rule_set/sukkaw_ruleset/cdn_non_ip.txt'
				},
				stream_non_ip: {
					type: 'http',
					behavior: 'classical',
					interval: 43200,
					format: 'text',
					proxy: '节点选择',
					url: 'https://ruleset.skk.moe/Clash/non_ip/stream.txt',
					path: './rule_set/sukkaw_ruleset/stream_non_ip.txt'
				},
				stream_ip: {
					type: 'http',
					behavior: 'classical',
					interval: 43200,
					format: 'text',
					proxy: '节点选择',
					url: 'https://ruleset.skk.moe/Clash/ip/stream.txt',
					path: './rule_set/sukkaw_ruleset/stream_ip.txt'
				},
				ai_non_ip: {
					type: 'http',
					behavior: 'classical',
					interval: 43200,
					format: 'text',
					proxy: '节点选择',
					url: 'https://ruleset.skk.moe/Clash/non_ip/ai.txt',
					path: './rule_set/sukkaw_ruleset/ai_non_ip.txt'
				},
				telegram_non_ip: {
					type: 'http',
					behavior: 'classical',
					interval: 43200,
					format: 'text',
					proxy: '节点选择',
					url: 'https://ruleset.skk.moe/Clash/non_ip/telegram.txt',
					path: './rule_set/sukkaw_ruleset/telegram_non_ip.txt'
				},
				telegram_ip: {
					type: 'http',
					behavior: 'classical',
					interval: 43200,
					format: 'text',
					proxy: '节点选择',
					url: 'https://ruleset.skk.moe/Clash/ip/telegram.txt',
					path: './rule_set/sukkaw_ruleset/telegram_ip.txt'
				},
				apple_cdn: {
					type: 'http',
					behavior: 'domain',
					interval: 43200,
					format: 'text',
					proxy: '节点选择',
					url: 'https://ruleset.skk.moe/Clash/domainset/apple_cdn.txt',
					path: './rule_set/sukkaw_ruleset/apple_cdn.txt'
				},
				apple_services: {
					type: 'http',
					behavior: 'classical',
					interval: 43200,
					format: 'text',
					proxy: '节点选择',
					url: 'https://ruleset.skk.moe/Clash/non_ip/apple_services.txt',
					path: './rule_set/sukkaw_ruleset/apple_services.txt'
				},
				apple_cn_non_ip: {
					type: 'http',
					behavior: 'classical',
					interval: 43200,
					format: 'text',
					proxy: '节点选择',
					url: 'https://ruleset.skk.moe/Clash/non_ip/apple_cn.txt',
					path: './rule_set/sukkaw_ruleset/apple_cn_non_ip.txt'
				},
				microsoft_cdn_non_ip: {
					type: 'http',
					behavior: 'classical',
					interval: 43200,
					format: 'text',
					proxy: '节点选择',
					url: 'https://ruleset.skk.moe/Clash/non_ip/microsoft_cdn.txt',
					path: './rule_set/sukkaw_ruleset/microsoft_cdn_non_ip.txt'
				},
				microsoft_non_ip: {
					type: 'http',
					behavior: 'classical',
					interval: 43200,
					format: 'text',
					proxy: '节点选择',
					url: 'https://ruleset.skk.moe/Clash/non_ip/microsoft.txt',
					path: './rule_set/sukkaw_ruleset/microsoft_non_ip.txt'
				},
				download_domainset: {
					type: 'http',
					behavior: 'domain',
					interval: 43200,
					format: 'text',
					proxy: '节点选择',
					url: 'https://ruleset.skk.moe/Clash/domainset/download.txt',
					path: './rule_set/sukkaw_ruleset/download_domainset.txt'
				},
				download_non_ip: {
					type: 'http',
					behavior: 'domain',
					interval: 43200,
					format: 'text',
					proxy: '节点选择',
					url: 'https://ruleset.skk.moe/Clash/non_ip/download.txt',
					path: './rule_set/sukkaw_ruleset/download_non_ip.txt'
				},
				lan_non_ip: {
					type: 'http',
					behavior: 'classical',
					interval: 43200,
					format: 'text',
					proxy: '节点选择',
					url: 'https://ruleset.skk.moe/Clash/non_ip/lan.txt',
					path: './rule_set/sukkaw_ruleset/lan_non_ip.txt'
				},
				lan_ip: {
					type: 'http',
					behavior: 'classical',
					interval: 43200,
					format: 'text',
					proxy: '节点选择',
					url: 'https://ruleset.skk.moe/Clash/ip/lan.txt',
					path: './rule_set/sukkaw_ruleset/lan_ip.txt'
				},
				domestic_non_ip: {
					type: 'http',
					behavior: 'classical',
					interval: 43200,
					format: 'text',
					proxy: '节点选择',
					url: 'https://ruleset.skk.moe/Clash/non_ip/domestic.txt',
					path: './rule_set/sukkaw_ruleset/domestic_non_ip.txt'
				},
				direct_non_ip: {
					type: 'http',
					behavior: 'classical',
					interval: 43200,
					format: 'text',
					proxy: '节点选择',
					url: 'https://ruleset.skk.moe/Clash/non_ip/direct.txt',
					path: './rule_set/sukkaw_ruleset/direct_non_ip.txt'
				},
				global_non_ip: {
					type: 'http',
					behavior: 'classical',
					interval: 43200,
					format: 'text',
					proxy: '节点选择',
					url: 'https://ruleset.skk.moe/Clash/non_ip/global.txt',
					path: './rule_set/sukkaw_ruleset/global_non_ip.txt'
				},
				domestic_ip: {
					type: 'http',
					behavior: 'classical',
					interval: 43200,
					format: 'text',
					proxy: '节点选择',
					url: 'https://ruleset.skk.moe/Clash/ip/domestic.txt',
					path: './rule_set/sukkaw_ruleset/domestic_ip.txt'
				},
				china_ip: {
					type: 'http',
					behavior: 'ipcidr',
					interval: 43200,
					format: 'text',
					proxy: '节点选择',
					url: 'https://ruleset.skk.moe/Clash/ip/china_ip.txt',
					path: './rule_set/sukkaw_ruleset/china_ip.txt'
				}
			}
		};

		const yamlContent = convertToYAML(config);

		return new Response(yamlContent, {
			headers: {
				'Content-Type': 'text/yaml; charset=utf-8',
				'Content-Disposition': 'attachment; filename=ProxySub'
			}
		});
	} catch (error) {
		return new Response('生成配置失败', { status: 500 });
	}
}

// 生成订阅整合配置
async function generateSubMergeConfig(env) {
	try {
		const subscriptions = JSON.parse(await env.CLASH_KV?.get('subscriptions') || '[]');
		const subscriptionNames = JSON.parse(await env.CLASH_KV?.get('subscription_names') || '[]');

		// 对订阅进行排序：按序号由小到大排序
		// 创建索引数组来保持订阅链接和名称的对应关系
		const subscriptionPairs = subscriptions.map((url, index) => ({
			url: url,
			name: subscriptionNames[index] || `provider${index + 1}`,
			index: index
		}));

		// 按订阅名称中的序号排序
		subscriptionPairs.sort((a, b) => {
			const matchA = a.name.match(/^订阅(\d{2})$/);
			const matchB = b.name.match(/^订阅(\d{2})$/);

			if (matchA && matchB) {
				const numberA = parseInt(matchA[1]);
				const numberB = parseInt(matchB[1]);
				return numberA - numberB;
			}

			// 如果不匹配默认格式，按名称排序
			return a.name.localeCompare(b.name);
		});

		// 重新构建排序后的数组
		const sortedSubscriptions = subscriptionPairs.map(pair => pair.url);
		const sortedSubscriptionNames = subscriptionPairs.map(pair => pair.name);

		// 根据example.yaml的完整配置格式
		const baseConfig = {
			// 全局配置
			port: 7890,
			'socks-port': 7891,
			'redir-port': 7892,
			'mixed-port': 7893,
			'tproxy-port': 7894,
			'allow-lan': true,
			'bind-address': '*',
			ipv6: false,
			'unified-delay': true,
			'tcp-concurrent': true,
			'log-level': 'info',
			'global-client-fingerprint': 'chrome',
			'keep-alive-idle': 600,
			'keep-alive-interval': 15,
			'disable-keep-alive': false,
			profile: {
				'store-selected': true,
				'store-fake-ip': true
			},
			mode: 'rule',
			'geodata-mode': false,
			'geodata-loader': 'standard',
			'geo-auto-update': true,
			'geo-update-interval': 24,

			// 节点信息
			proxies: [
				{ name: '直连', type: 'direct' }
			],

			// 嗅探
			sniffer: {
				enable: true,
				'force-dns-mapping': true,
				'parse-pure-ip': true,
				'override-destination': true,
				sniff: {
					HTTP: {
						ports: [80, '8080-8880'],
						'override-destination': true
					},
					TLS: {
						ports: [443, 8443]
					},
					QUIC: {
						ports: [443, 8443]
					}
				},
				'force-domain': ['+.v2ex.com'],
				'skip-domain': ['+.baidu.com', 'Mijia.Cloud.com'],
				'skip-src-address': ['192.168.0.3/32'],
				'skip-dst-address': ['192.168.0.3/32']
			},

			// 入站
			tun: {
				enable: true,
				stack: 'mixed',
				'dns-hijack': ['any:53', 'tcp://any:53'],
				'auto-route': true,
				'auto-redirect': true,
				'auto-detect-interface': true,
				device: 'utun0',
				mtu: 1500,
				'strict-route': true,
				gso: true,
				'gso-max-size': 65536,
				'udp-timeout': 300,
				'endpoint-independent-nat': false
			},

			// DNS模块
			dns: {
				enable: true,
				listen: '0.0.0.0:1053',
				ipv6: false,
				'respect-rules': true,
				'enhanced-mode': 'fake-ip',
				'fake-ip-range': '28.0.0.1/8',
				'fake-ip-filter-mode': 'blacklist',
				'fake-ip-filter': [
					'rule-set:private_domain,cn_domain',
					'+.msftconnecttest.com',
					'+.msftncsi.com',
					'time.*.com',
					'+.market.xiaomi.com',
					'dns.alidns.com',
					'cloudflare-dns.com',
					'dns.google',
					'dns.adguard-dns.com',
					'dns.nextdns.io',
					'public.dns.iij.jp',
					'dns0.eu',
					'dns.18bit.cn',
					'2025.dns1.top',
					'dns.ipv4dns.com'
				],
				'default-nameserver': [
					'223.5.5.5',
					'223.6.6.6'
				],
				'proxy-server-nameserver': [
					'https://223.5.5.5/dns-query',
					'https://223.6.6.6/dns-query'
				],
				nameserver: [
					'223.5.5.5',
					'119.29.29.29'
				],
				'nameserver-policy': {
					'+.jp': ['https://public.dns.iij.jp/dns-query#h3=true'],
					'+.hk': ['quic://dns.nextdns.io'],
					'+.eu': ['quic://dns0.eu']
				}
			},

			'proxy-providers': {},
			'proxy-groups': [],
			'rule-providers': {},
			rules: [],
			'sub-rules': {}
		};

		// 添加rule-anchor (锚点定义)
		baseConfig['rule-anchor'] = {
			ip: { type: 'http', interval: 3600, behavior: 'ipcidr', format: 'mrs' },
			domain: { type: 'http', interval: 3600, behavior: 'domain', format: 'mrs' },
			class: { type: 'http', interval: 3600, behavior: 'classical', format: 'yaml' },
			RuleSet: { type: 'http', behavior: 'classical', interval: 3600, format: 'yaml', proxy: 'Proxy' }
		};

		// 添加proxy-providers
		if (sortedSubscriptions.length > 0) {
			sortedSubscriptions.forEach((sub, index) => {
				const providerName = sortedSubscriptionNames[index];
				baseConfig['proxy-providers'][providerName] = {
					type: 'http',
					url: sub,
					interval: 86400,
					'health-check': {
						enable: true,
						url: 'https://www.gstatic.com/generate_204',
						interval: 300
					},
					proxy: '直连'
				};
			});
		}

		// 添加proxy-groups (出站策略)
		baseConfig['proxy-groups'] = [
			{ name: '🚀 默认代理', type: 'select', proxies: ['♻️ 台湾自动', '♻️ 日本自动', '♻️ 新加坡自动', '♻️ 美国自动', '♻️ 韩国自动', '♻️ 香港自动', '♻️ 澳洲自动', '♻️ 自动选择', '🔯 香港故转', '🔯 日本故转', '🔯 新加坡故转', '🔯 美国故转', '🇭🇰 香港节点', '🇹🇼 台湾节点', '🇯🇵 日本节点', '🇸🇬 新加坡节点', '🇺🇲 美国节点', '🇰🇷 韩国节点', '🇦🇺 澳洲节点', '🇬🇧 英国节点', '🇫🇷 法国节点', '🇩🇪 德国节点', '🌐 全部节点', '直连'] },
			{ name: '🌐 全部节点', type: 'select', 'include-all': true },
			{ name: '🪟 Microsoft', type: 'select', proxies: ['直连', '🚀 默认代理'] },
			{ name: '🍎 Apple', type: 'select', proxies: ['直连', '🚀 默认代理'] },
			{ name: '🍀 Google', type: 'select', proxies: ['♻️ 台湾自动', '♻️ 日本自动', '♻️ 美国自动', '♻️ 新加坡自动', '🇹🇼 台湾节点', '🇯🇵 日本节点', '🇸🇬 新加坡节点', '🇺🇲 美国节点', '直连'] },
			{ name: '🤖 ChatGPT', type: 'select', proxies: ['♻️ 台湾自动', '♻️ 日本自动', '♻️ 美国自动', '♻️ 新加坡自动', '♻️ 自动选择', '🇹🇼 台湾节点', '🇯🇵 日本节点', '🇸🇬 新加坡节点', '🇺🇲 美国节点', '直连'] },
			{ name: '🎯 直连/代理', type: 'select', proxies: ['直连', '🚀 默认代理'] },
			{ name: '☁️ CDN服务', type: 'select', proxies: ['♻️ 自动选择', '♻️ 台湾自动', '♻️ 香港自动', '♻️ 日本自动', '♻️ 新加坡自动', '♻️ 美国自动', '🌐 全部节点', '直连'] },
			{ name: '✈️ Speedtest', type: 'select', proxies: ['♻️ 自动选择', '♻️ 香港自动', '♻️ 日本自动', '♻️ 新加坡自动', '♻️ 美国自动', '🌐 全部节点', '直连'] },
			{ name: '🐟 漏网之鱼', type: 'select', proxies: ['🚀 默认代理', '直连'] },
			{ name: '🪧 广告拦截', type: 'select', proxies: ['🚫 静默拒绝', '🚫 拒绝连接', '⚪ 绕过连接'] },
			{ name: '💧 泄漏拦截', type: 'select', proxies: ['🚫 静默拒绝', '🚫 拒绝连接', '⚪ 绕过连接'] },
			{ name: '🎯 全球直连', type: 'select', hidden: true, proxies: ['直连'] },
			{ name: '🚫 拒绝连接', type: 'select', hidden: true, proxies: ['REJECT'] },
			{ name: '🚫 静默拒绝', type: 'select', hidden: true, proxies: ['REJECT-DROP'] },
			{ name: '⚪ 绕过连接', type: 'select', hidden: true, proxies: ['PASS'] },
			{ name: '🇭🇰 香港节点', type: 'select', 'include-all': true, filter: '^(?!.*10x)(?=.*((?i)🇭🇰|香港|九龙|新界|\\b(HK|HongKong|Hong Kong)\\b)).*$' },
			{ name: '🇯🇵 日本节点', type: 'select', 'include-all': true, filter: '^(?!.*10x)(?=.*((?i)🇯🇵|日本|东京|大阪|京都|名古屋|埼玉|\\b(JP|Japan)\\b)).*$' },
			{ name: '🇸🇬 新加坡节点', type: 'select', 'include-all': true, filter: '^(?!.*10x)(?=.*((?i)🇸🇬|新加坡|新加坡|\\b(SG|Singapore)\\b)).*$' },
			{ name: '🇺🇲 美国节点', type: 'select', 'include-all': true, filter: '^(?!.*10x)(?=.*((?i)🇺🇸|美国|波特兰|达拉斯|俄勒冈|凤凰城|费利蒙|硅谷|拉斯维加斯|洛杉矶|圣何塞|圣克拉拉|西雅图|芝加哥|\\b(US|United States|America)\\b)).*$' },
			{ name: '🇰🇷 韩国节点', type: 'select', 'include-all': true, filter: '^(?!.*10x)(?=.*((?i)🇰🇷|韩国|韓國|首尔|釜山|\\b(KR|Korea)\\b)).*$' },
			{ name: '🇬🇧 英国节点', type: 'select', 'include-all': true, filter: '^(?!.*10x)(?=.*((?i)🇬🇧|英国|伦敦|曼彻斯特|\\b(UK|United Kingdom|Britain)\\b)).*$' },
			{ name: '🇫🇷 法国节点', type: 'select', 'include-all': true, filter: '^(?!.*10x)(?=.*((?i)🇫🇷|法国|巴黎|马赛|\\b(FR|France)\\b)).*$' },
			{ name: '🇩🇪 德国节点', type: 'select', 'include-all': true, filter: '^(?!.*10x)(?=.*((?i)🇩🇪|德国|柏林|法兰克福|慕尼黑|\\b(DE|Germany)\\b)).*$' },
			{ name: '🇹🇼 台湾节点', type: 'select', 'include-all': true, filter: '^(?!.*10x)(?=.*((?i)🇹🇼|台湾|台北|新北|高雄|\\b(TW|Taiwan|Tai wan)\\b)).*$' },
			{ name: '🇦🇺 澳洲节点', type: 'select', 'include-all': true, filter: '^(?!.*10x)(?=.*((?i)🇦🇺|澳大利亚|澳洲|悉尼|墨尔本|\\b(AU|AUS|Australia)\\b)).*$' },
			{ name: '🔯 香港故转', type: 'fallback', 'include-all': true, tolerance: 20, interval: 300, filter: '^(?!.*10x)(?=.*((?i)🇭🇰|香港|九龙|新界|\\b(HK|HongKong|Hong Kong)\\b)).*$' },
			{ name: '🔯 日本故转', type: 'fallback', 'include-all': true, tolerance: 20, interval: 300, filter: '^(?!.*10x)(?=.*((?i)🇯🇵|日本|东京|大阪|京都|名古屋|埼玉|\\b(JP|Japan)\\b)).*$' },
			{ name: '🔯 新加坡故转', type: 'fallback', 'include-all': true, tolerance: 20, interval: 300, filter: '^(?!.*10x)(?=.*((?i)🇸🇬|新加坡|新加坡|\\b(SG|Singapore)\\b)).*$' },
			{ name: '🔯 美国故转', type: 'fallback', 'include-all': true, tolerance: 20, interval: 300, filter: '^(?!.*10x)(?=.*((?i)🇺🇸|美国|波特兰|达拉斯|俄勒冈|凤凰城|费利蒙|硅谷|拉斯维加斯|洛杉矶|圣何塞|圣克拉拉|西雅图|芝加哥|\\b(US|United States|America)\\b)).*$' },
			{ name: '♻️ 香港自动', type: 'url-test', 'include-all': true, tolerance: 20, interval: 300, filter: '^(?!.*10x)(?=.*((?i)🇭🇰|香港|九龙|新界|\\b(HK|HongKong|Hong Kong)\\b)).*$' },
			{ name: '♻️ 日本自动', type: 'url-test', 'include-all': true, tolerance: 20, interval: 300, filter: '^(?!.*10x)(?=.*((?i)🇯🇵|日本|东京|大阪|京都|名古屋|埼玉|\\b(JP|Japan)\\b)).*$' },
			{ name: '♻️ 新加坡自动', type: 'url-test', 'include-all': true, tolerance: 20, interval: 300, filter: '^(?!.*10x)(?=.*((?i)🇸🇬|新加坡|新加坡|\\b(SG|Singapore)\\b)).*$' },
			{ name: '♻️ 美国自动', type: 'url-test', 'include-all': true, tolerance: 20, interval: 300, filter: '^(?!.*10x)(?=.*((?i)🇺🇸|美国|波特兰|达拉斯|俄勒冈|凤凰城|费利蒙|硅谷|拉斯维加斯|洛杉矶|圣何塞|圣克拉拉|西雅图|芝加哥|\\b(US|United States|America)\\b)).*$' },
			{ name: '♻️ 韩国自动', type: 'url-test', 'include-all': true, tolerance: 20, interval: 300, filter: '^(?!.*10x)(?=.*((?i)🇰🇷|韩国|韓國|首尔|釜山|\\b(KR|Korea)\\b)).*$' },
			{ name: '♻️ 台湾自动', type: 'url-test', 'include-all': true, tolerance: 20, interval: 300, filter: '^(?!.*10x)(?=.*((?i)🇹🇼|台湾|台北|新北|高雄|\\b(TW|Taiwan|Tai wan)\\b)).*$' },
			{ name: '♻️ 澳洲自动', type: 'url-test', 'include-all': true, tolerance: 20, interval: 300, filter: '^(?!.*10x)(?=.*((?i)🇦🇺|澳大利亚|澳洲|悉尼|墨尔本|\\b(AU|AUS|Australia)\\b)).*$' },
			{ name: '♻️ 自动选择', type: 'url-test', 'include-all': true, tolerance: 20, interval: 300, filter: '^(?!.*10x)^((?!(直连)).)*$' }
		];

		// 添加rule-providers (规则集)
		baseConfig['rule-providers'] = {
			// MetaCubeX 提供的通用域名规则集
			private_domain: { type: 'http', interval: 3600, behavior: 'domain', format: 'mrs', url: 'https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite/private.mrs' },
			ai: { type: 'http', interval: 3600, behavior: 'domain', format: 'mrs', url: 'https://github.com/MetaCubeX/meta-rules-dat/raw/refs/heads/meta/geo/geosite/category-ai-!cn.mrs' },
			youtube_domain: { type: 'http', interval: 3600, behavior: 'domain', format: 'mrs', url: 'https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite/youtube.mrs' },
			google_domain: { type: 'http', interval: 3600, behavior: 'domain', format: 'mrs', url: 'https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite/google.mrs' },
			github_domain: { type: 'http', interval: 3600, behavior: 'domain', format: 'mrs', url: 'https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite/github.mrs' },
			telegram_domain: { type: 'http', interval: 3600, behavior: 'domain', format: 'mrs', url: 'https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite/telegram.mrs' },
			netflix_domain: { type: 'http', interval: 3600, behavior: 'domain', format: 'mrs', url: 'https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite/netflix.mrs' },
			paypal_domain: { type: 'http', interval: 3600, behavior: 'domain', format: 'mrs', url: 'https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite/paypal.mrs' },
			onedrive_domain: { type: 'http', interval: 3600, behavior: 'domain', format: 'mrs', url: 'https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite/onedrive.mrs' },
			microsoft_domain: { type: 'http', interval: 3600, behavior: 'domain', format: 'mrs', url: 'https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite/microsoft.mrs' },
			apple_domain: { type: 'http', interval: 3600, behavior: 'domain', format: 'mrs', url: 'https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite/apple-cn.mrs' },
			speedtest_domain: { type: 'http', interval: 3600, behavior: 'domain', format: 'mrs', url: 'https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite/ookla-speedtest.mrs' },
			tiktok_domain: { type: 'http', interval: 3600, behavior: 'domain', format: 'mrs', url: 'https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite/tiktok.mrs' },
			spotify_domain: { type: 'http', interval: 3600, behavior: 'domain', format: 'mrs', url: 'https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite/spotify.mrs' },
			gfw_domain: { type: 'http', interval: 3600, behavior: 'domain', format: 'mrs', url: 'https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite/gfw.mrs' },
			'geolocation-!cn': { type: 'http', interval: 3600, behavior: 'domain', format: 'mrs', url: 'https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite/geolocation-!cn.mrs' },
			cn_domain: { type: 'http', interval: 3600, behavior: 'domain', format: 'mrs', url: 'https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite/cn.mrs' },

			// MetaCubeX 提供的通用 IP 规则集
			cn_ip: { type: 'http', interval: 3600, behavior: 'ipcidr', format: 'mrs', url: 'https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geoip/cn.mrs' },
			google_ip: { type: 'http', interval: 3600, behavior: 'ipcidr', format: 'mrs', url: 'https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geoip/google.mrs' },
			telegram_ip: { type: 'http', interval: 3600, behavior: 'ipcidr', format: 'mrs', url: 'https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geoip/telegram.mrs' },
			netflix_ip: { type: 'http', interval: 3600, behavior: 'ipcidr', format: 'mrs', url: 'https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geoip/netflix.mrs' },

			// blackmatrix7 提供的补充规则集
			ChinaMedia: { type: 'http', behavior: 'classical', interval: 3600, format: 'yaml', proxy: 'Proxy', url: 'https://raw.githubusercontent.com/blackmatrix7/ios_rule_script/master/rule/Clash/ChinaMedia/ChinaMedia.yaml', path: './ruleSet/ChinaMedia.yaml' },
			LAN: { type: 'http', behavior: 'classical', interval: 3600, format: 'yaml', proxy: 'Proxy', url: 'https://raw.githubusercontent.com/blackmatrix7/ios_rule_script/master/rule/Clash/Lan/Lan.yaml', path: './ruleSet/LAN.yaml' },
			China: { type: 'http', behavior: 'classical', interval: 3600, format: 'yaml', proxy: 'Proxy', url: 'https://raw.githubusercontent.com/blackmatrix7/ios_rule_script/refs/heads/master/rule/Clash/ChinaMax/ChinaMax_Classical.yaml', path: './ruleSet/China.yaml' },

			// 其他作者提供的规则集，使用 CDN 加速
			Private: { type: 'http', interval: 3600, behavior: 'domain', format: 'mrs', proxy: '☁️ CDN服务', url: 'https://cdn.jsdmirror.com/gh/MetaCubeX/meta-rules-dat@meta/geo/geosite/private.mrs', path: './ruleset/Private_Domain.mrs' },
			Fakeip_Filter: { type: 'http', interval: 3600, behavior: 'domain', format: 'mrs', proxy: '☁️ CDN服务', url: 'https://cdn.jsdmirror.com/gh/DustinWin/ruleset_geodata@mihomo-ruleset/fakeip-filter.mrs', path: './ruleset/Fakeip_Filter_Domain.mrs' },
			'Advertising-ads': { type: 'http', interval: 3600, behavior: 'domain', format: 'mrs', proxy: '☁️ CDN服务', url: 'https://cdn.jsdmirror.com/gh/TG-Twilight/AWAvenue-Ads-Rule@main/Filters/AWAvenue-Ads-Rule-Clash.mrs', path: './ruleset/Advertising_ads_Domain.mrs' },
			STUN: { type: 'http', interval: 3600, behavior: 'domain', format: 'mrs', proxy: '☁️ CDN服务', url: 'https://cdn.jsdmirror.com/gh/Kwisma/rules@main/rules/mihomo/STUN/STUN_Domain.mrs', path: './ruleset/STUN_Domain.mrs' },
			CNcidr: { type: 'http', interval: 3600, behavior: 'ipcidr', format: 'mrs', proxy: '☁️ CDN服务', url: 'https://cdn.jsdmirror.com/gh/Kwisma/clash-rules@release/cncidr.mrs', path: './ruleset/CN_IP.mrs' }
		};

		// 添加rules (规则匹配)
		baseConfig.rules = [
			// 以下是主规则，顺序保持不变
			'RULE-SET,Private,🎯 全球直连',
			'RULE-SET,LAN,🎯 直连/代理',
			'RULE-SET,Fakeip_Filter,🎯 全球直连',

			// 特定服务规则
			'RULE-SET,ai,🤖 ChatGPT',
			'RULE-SET,github_domain,🚀 默认代理',
			'RULE-SET,youtube_domain,🚀 默认代理',
			'RULE-SET,google_domain,🍀 Google',
			'RULE-SET,onedrive_domain,🚀 默认代理',
			'RULE-SET,microsoft_domain,🪟 Microsoft',
			'RULE-SET,tiktok_domain,🚀 默认代理',
			'RULE-SET,telegram_domain,🚀 默认代理',
			'RULE-SET,spotify_domain,🚀 默认代理',
			'RULE-SET,netflix_domain,🚀 默认代理',
			'RULE-SET,paypal_domain,🚀 默认代理',
			'RULE-SET,apple_domain,🍎 Apple',
			'RULE-SET,speedtest_domain,✈️ Speedtest',

			// 通用国内/国外流量
			'RULE-SET,gfw_domain,🚀 默认代理',
			'RULE-SET,geolocation-!cn,🚀 默认代理',
			'DOMAIN-SUFFIX,linux.do,DIRECT',

			// Adobe弹窗拦截
			'DOMAIN-SUFFIX,adobe.io,REJECT',
			'DOMAIN-SUFFIX,adobestats.io,REJECT',

			// IP 规则
			'GEOIP,CNcidr,🎯 直连/代理',
			'RULE-SET,cn_ip,🎯 直连/代理',
			'RULE-SET,google_ip,🍀 Google,no-resolve',
			'RULE-SET,netflix_ip,🚀 默认代理,no-resolve',
			'RULE-SET,telegram_ip,🚀 默认代理,no-resolve',

			// 国内域名规则
			'RULE-SET,cn_domain,🎯 直连/代理',
			'RULE-SET,ChinaMedia,🎯 直连/代理',
			'RULE-SET,China,🎯 直连/代理',

			// 兜底规则
			'MATCH,🐟 漏网之鱼'
		];

		// 添加sub-rules (子规则)
		baseConfig['sub-rules'] = {
			'SUB-REJECT': [
				// 广告和恶意域名拦截
				'RULE-SET,Advertising-ads,🪧 广告拦截',
				'DOMAIN-KEYWORD,ad,🪧 广告拦截',
				'DOMAIN-KEYWORD,ads,🪧 广告拦截',
				'DOMAIN-KEYWORD,analytics,🪧 广告拦截',
				'DOMAIN-KEYWORD,doubleclick,🪧 广告拦截',
				'DOMAIN-KEYWORD,googlesyndication,🪧 广告拦截',
				'RULE-SET,STUN,💧 泄漏拦截',
				'DOMAIN-KEYWORD,stun,💧 泄漏拦截',
				'DOMAIN-KEYWORD,dnsleaktest,💧 泄漏拦截',

				// 特殊协议和端口拦截
				'DST-PORT,3478,💧 泄漏拦截',
				'DST-PORT,53,💧 泄漏拦截',
				'DST-PORT,6881-6889,💧 泄漏拦截',

				// 常用的 CDN 和规则集提供者直连，确保规则和应用加载速度
				'DOMAIN,cdn.jsdmirror.com,☁️ CDN服务',
				'DOMAIN,raw.githubusercontent.com,☁️ CDN服务',
				'DOMAIN-SUFFIX,cdn.jsdelivr.net,☁️ CDN服务',
				'DOMAIN-SUFFIX,cdnjs.cloudflare.com,☁️ CDN服务',
				'DOMAIN-SUFFIX,gstatic.com,☁️ CDN服务'
			]
		};

		const yamlContent = convertToYAML(baseConfig);

		return new Response(yamlContent, {
			headers: {
				'Content-Type': 'text/yaml; charset=utf-8',
				'Content-Disposition': 'attachment; filename=SubMerge'
			}
		});
	} catch (error) {
		return new Response('生成配置失败', { status: 500 });
	}
}

// 解析代理URL
function parseProxyUrl(url) {
	try {
		// 支持vmess, vless, ss, hysteria2, trojan等协议
		if (url.startsWith('vmess://')) {
			return parseVmess(url);
		} else if (url.startsWith('vless://')) {
			return parseVless(url);
		} else if (url.startsWith('ss://')) {
			return parseShadowsocks(url);
		} else if (url.startsWith('hysteria2://') || url.startsWith('hy2://')) {
			return parseHysteria2(url);
		} else if (url.startsWith('trojan://')) {
			return parseTrojan(url);
		}
		return null;
	} catch (error) {
		return null;
	}
}

// 解析VMess
function parseVmess(url) {
	const data = JSON.parse(atob(url.substring(8)));
	return {
		name: data.ps || 'VMess',
		type: 'vmess',
		server: data.add,
		port: parseInt(data.port),
		uuid: data.id,
		alterId: parseInt(data.aid) || 0,
		cipher: 'auto',
		network: data.net || 'tcp',
		tls: data.tls === 'tls'
	};
}

// 解析VLess
function parseVless(url) {
	const parsed = new URL(url);
	return {
		name: decodeURIComponent(parsed.hash.substring(1)) || 'VLess',
		type: 'vless',
		server: parsed.hostname,
		port: parseInt(parsed.port),
		uuid: parsed.username,
		network: parsed.searchParams.get('type') || 'tcp',
		tls: parsed.searchParams.get('security') === 'tls'
	};
}

// 解析Shadowsocks
function parseShadowsocks(url) {
	const parsed = new URL(url);
	const userInfo = atob(parsed.username);
	const [method, password] = userInfo.split(':');

	return {
		name: decodeURIComponent(parsed.hash.substring(1)) || 'Shadowsocks',
		type: 'ss',
		server: parsed.hostname,
		port: parseInt(parsed.port),
		cipher: method,
		password: password
	};
}

// 解析Hysteria2
function parseHysteria2(url) {
	const parsed = new URL(url);
	return {
		name: decodeURIComponent(parsed.hash.substring(1)) || 'Hysteria2',
		type: 'hysteria2',
		server: parsed.hostname,
		port: parseInt(parsed.port),
		password: parsed.username
	};
}

// 解析Trojan
function parseTrojan(url) {
	const parsed = new URL(url);
	return {
		name: decodeURIComponent(parsed.hash.substring(1)) || 'Trojan',
		type: 'trojan',
		server: parsed.hostname,
		port: parseInt(parsed.port),
		password: parsed.username,
		sni: parsed.searchParams.get('sni') || parsed.hostname
	};
}

// 更新订阅名称
async function updateSubscriptionNames(env) {
	try {
		const subscriptions = JSON.parse(await env.CLASH_KV?.get('subscriptions') || '[]');
		const oldNames = JSON.parse(await env.CLASH_KV?.get('subscription_names') || '[]');
		const newNames = [];
		
		// 存储已经使用的基础名称（不含流量和到期信息）以避免重复
		const usedBaseNames = new Set();

		for (let i = 0; i < subscriptions.length; i++) {
			const subUrl = subscriptions[i];
			const subInfo = await getSubscriptionInfo(subUrl);
			
			// 如果订阅获取失败，保持原有名称
			if (!subInfo.success) {
				if (oldNames[i]) {
					newNames.push(oldNames[i]);
				} else {
					// 如果没有原有名称，生成默认名称
					const usedNumbers = new Set();
					newNames.forEach(name => {
						const match = name.match(/^订阅(\d{2})(?:\s|\[|$)/);
						if (match) {
							usedNumbers.add(parseInt(match[1]));
						}
					});

					let counter = 1;
					while (usedNumbers.has(counter)) {
						counter++;
					}
					newNames.push(`订阅${String(counter).padStart(2, '0')}`);
				}
				continue;
			}
			
			// 提取旧名称的基础部分
			let baseName = subInfo.name;
			if (!baseName && oldNames[i]) {
				// 从旧名称提取基础名称
				const baseNameMatch = oldNames[i].match(/^([^[\(]+?)(?:\s*\[.*?\])?(?:\s*\(.*?\))?$/);
				if (baseNameMatch) {
					baseName = baseNameMatch[1].trim();
				}
			}
			
			// 如果还是没有基础名称，使用订阅编号
			if (!baseName) {
				const usedNumbers = new Set();
				newNames.forEach(name => {
					const match = name.match(/^订阅(\d{2})(?:\s|\[|$)/);
					if (match) {
						usedNumbers.add(parseInt(match[1]));
					}
				});

				let counter = 1;
				while (usedNumbers.has(counter)) {
					counter++;
				}
				baseName = `订阅${String(counter).padStart(2, '0')}`;
			}
			
			// 处理基础名称重复的情况
			let uniqueBaseName = baseName;
			let counter = 2;
			while (usedBaseNames.has(uniqueBaseName)) {
				uniqueBaseName = `${baseName}-${String(counter).padStart(2, '0')}`;
				counter++;
			}
			usedBaseNames.add(uniqueBaseName);
			
			// 使用唯一的基础名称构造完整名称
			const tempSubInfo = { ...subInfo, name: uniqueBaseName };
			const newName = generateSubscriptionName(tempSubInfo, newNames);
			newNames.push(newName);
		}

		// 保存更新后的名称
		await env.CLASH_KV?.put('subscription_names', JSON.stringify(newNames));

		return new Response(JSON.stringify({ 
			success: true, 
			message: '订阅名称更新成功',
			updated: newNames.length 
		}), {
			headers: { 'Content-Type': 'application/json' }
		});

	} catch (error) {
		return new Response(JSON.stringify({ 
			success: false, 
			message: '更新订阅名称失败: ' + error.message 
		}), {
			status: 500,
			headers: { 'Content-Type': 'application/json' }
		});
	}
}

// 获取订阅信息（名称、流量、到期时间）
async function getSubscriptionInfo(subUrl) {
	const subInfo = {
		name: '',
		download: 0,
		total: 0,
		expire: null,
		success: true,
		statusCode: 0
	};

	try {
		// 使用简单的GET请求，避免HEAD请求兼容性问题
		const response = await fetch(subUrl, {
			method: 'GET',
			headers: {
				'User-Agent': 'Clash Verge'
			}
		});

		subInfo.statusCode = response.status;

		// 检查是否是不允许的状态码
		if (response.status === 403 || response.status === 502) {
			subInfo.success = false;
			return subInfo;
		}

		// 只要请求成功就尝试解析头部
		if (response.ok) {
			const contentDisposition = response.headers.get('content-disposition');
			const userInfo = response.headers.get('subscription-userinfo');
			return parseHeaders(contentDisposition, userInfo, subInfo);
		}

	} catch (error) {
		subInfo.success = false;
	}

	return subInfo;
}

// 解析响应头的辅助函数
function parseHeaders(contentDisposition, userInfo, subInfo) {
	// 解析 Content-Disposition 获取订阅名称
	if (contentDisposition) {
		// 优先匹配 filename*=UTF-8''encoded_name 格式（RFC 5987）
		const filenameStarMatch = contentDisposition.match(/filename\*\s*=\s*UTF-8''([^;]+)/i);
		if (filenameStarMatch) {
			try {
				subInfo.name = decodeURIComponent(filenameStarMatch[1]);
			} catch (e) {
				// 解码失败，忽略
			}
		} else {
			// 匹配标准 filename= 格式
			const filenameMatch = contentDisposition.match(/filename\s*=\s*([^;]+)/i);
			if (filenameMatch) {
				let rawName = filenameMatch[1].trim();
				// 移除前后的引号（如果有）
				if ((rawName.startsWith('"') && rawName.endsWith('"')) || 
					(rawName.startsWith("'") && rawName.endsWith("'"))) {
					rawName = rawName.slice(1, -1);
				}
				
				if (rawName) {
					try {
						// 尝试URL解码（如果是编码的）
						subInfo.name = decodeURIComponent(rawName);
					} catch (e) {
						// 解码失败则直接使用原始值
						subInfo.name = rawName;
					}
				}
			}
		}
	}

	// 解析 Subscription-Userinfo 获取流量信息
	if (userInfo) {
		// 解析格式: upload=123; download=456; total=789; expire=1234567890
		const parts = userInfo.split(';').map(part => part.trim());
		for (const part of parts) {
			const [key, value] = part.split('=').map(s => s.trim());
			switch (key) {
				case 'download':
					subInfo.download = parseInt(value) || 0;
					break;
				case 'total':
					subInfo.total = parseInt(value) || 0;
					break;
				case 'expire':
					subInfo.expire = parseInt(value) || null;
					break;
			}
		}
	}

	return subInfo;
}

// 生成订阅名称
function generateSubscriptionName(subInfo, existingNames) {
	let baseName = subInfo.name;
	
	// 如果没有获取到名称，使用默认命名
	if (!baseName) {
		// 查找可用的最小序号，填补空缺
		const usedNumbers = new Set();
		existingNames.forEach(name => {
			const match = name.match(/^订阅(\d{2})(?:\s|\[|$)/);
			if (match) {
				usedNumbers.add(parseInt(match[1]));
			}
		});

		// 找到最小的可用序号
		let counter = 1;
		while (usedNumbers.has(counter)) {
			counter++;
		}
		baseName = `订阅${String(counter).padStart(2, '0')}`;
	}

	// 构建完整名称
	let fullName = baseName;
	
	// 添加流量信息
	if (subInfo.download > 0 && subInfo.total > 0) {
		const downloadGiB = (subInfo.download / (1024 * 1024 * 1024)).toFixed(2);
		const totalGiB = (subInfo.total / (1024 * 1024 * 1024)).toFixed(1);
		fullName += ` [${downloadGiB}GiB/${totalGiB}GiB]`;
	}
	
	// 添加到期时间
	if (subInfo.expire) {
		const expireDate = new Date(subInfo.expire * 1000);
		const year = expireDate.getFullYear();
		const month = String(expireDate.getMonth() + 1).padStart(2, '0');
		const day = String(expireDate.getDate()).padStart(2, '0');
		fullName += ` (${year}-${month}-${day}到期)`;
	}

	// 处理重复名称
	let finalName = fullName;
	let counter = 2;
	while (existingNames.includes(finalName)) {
		// 从基础名称开始构建，避免重复添加编号
		let numberedBaseName = `${baseName}-${String(counter).padStart(2, '0')}`;
		finalName = numberedBaseName;
		
		// 重新添加流量和到期信息
		if (subInfo.download > 0 && subInfo.total > 0) {
			const downloadGiB = (subInfo.download / (1024 * 1024 * 1024)).toFixed(2);
			const totalGiB = (subInfo.total / (1024 * 1024 * 1024)).toFixed(1);
			finalName += ` [${downloadGiB}GiB/${totalGiB}GiB]`;
		}
		
		if (subInfo.expire) {
			const expireDate = new Date(subInfo.expire * 1000);
			const year = expireDate.getFullYear();
			const month = String(expireDate.getMonth() + 1).padStart(2, '0');
			const day = String(expireDate.getDate()).padStart(2, '0');
			finalName += ` (${year}-${month}-${day}到期)`;
		}
		
		counter++;
	}

	return finalName;
}

// 检测地区
async function detectRegion(serverAddress) {
	try {
		// 调用IP-API获取地理位置信息
		const apiUrl = `http://ip-api.com/json/${encodeURIComponent(serverAddress)}?fields=status,country,countryCode`;
		const response = await fetch(apiUrl);
		
		if (!response.ok) {
			throw new Error(`HTTP error! status: ${response.status}`);
		}
		
		const data = await response.json();
		
		// 检查API响应状态
		if (data.status === 'success' && data.countryCode) {
			return data.countryCode;
		}
		
		// 如果API失败，回退到原来的关键词识别方式
		return detectRegionByKeywords(serverAddress);
		
	} catch (error) {
		// 网络错误或其他异常时，回退到关键词识别
		console.warn('IP-API failed, falling back to keyword detection:', error.message);
		return detectRegionByKeywords(serverAddress);
	}
}

// 关键词地区检测（作为备用方案）
function detectRegionByKeywords(serverAddress) {
	const regionKeywords = {
		'HK': ['hk', 'hong', 'kong', '香港', '港', 'hongkong'],
		'TW': ['tw', 'taiwan', 'tai', '台湾', '台', 'taipei'],
		'JP': ['jp', 'japan', 'tokyo', '日本', '东京', '大阪', 'osaka', 'kyoto'],
		'KR': ['kr', 'korea', 'seoul', '韩国', '首尔', '釜山'],
		'SG': ['sg', 'singapore', 'singapo', '新加坡', '狮城'],
		'US': ['us', 'usa', 'america', 'united', 'states', '美国', 'los', 'angeles', 'new', 'york', 'chicago', 'seattle'],
		'UK': ['uk', 'britain', 'england', 'london', '英国', '伦敦'],
		'DE': ['de', 'germany', 'german', 'berlin', '德国', '柏林'],
		'FR': ['fr', 'france', 'french', 'paris', '法国', '巴黎'],
		'AU': ['au', 'australia', 'sydney', '澳洲', '澳大利亚', '悉尼'],
		'CA': ['ca', 'canada', 'toronto', '加拿大', '多伦多'],
		'RU': ['ru', 'russia', 'moscow', '俄罗斯', '莫斯科'],
		'IN': ['in', 'india', 'mumbai', '印度', '孟买'],
		'BR': ['br', 'brazil', 'sao', 'paulo', '巴西', '圣保罗'],
		'NL': ['nl', 'netherlands', 'amsterdam', '荷兰', '阿姆斯特丹'],
		'IT': ['it', 'italy', 'rome', '意大利', '罗马'],
		'ES': ['es', 'spain', 'madrid', '西班牙', '马德里'],
		'CH': ['ch', 'switzerland', 'zurich', '瑞士', '苏黎世'],
		'MY': ['my', 'malaysia', 'kuala', 'lumpur', '马来西亚', '吉隆坡'],
		'TH': ['th', 'thailand', 'bangkok', '泰国', '曼谷'],
		'VN': ['vn', 'vietnam', 'hanoi', '越南', '河内'],
		'ID': ['id', 'indonesia', 'jakarta', '印尼', '雅加达'],
		'PH': ['ph', 'philippines', 'manila', '菲律宾', '马尼拉'],
		'TR': ['tr', 'turkey', 'istanbul', '土耳其', '伊斯坦布尔'],
		'AE': ['ae', 'uae', 'dubai', '阿联酋', '迪拜'],
		'IL': ['il', 'israel', 'tel', 'aviv', '以色列', '特拉维夫'],
		'ZA': ['za', 'south', 'africa', 'cape', 'town', '南非', '开普敦'],
		'EG': ['eg', 'egypt', 'cairo', '埃及', '开罗'],
		'AR': ['ar', 'argentina', 'buenos', 'aires', '阿根廷', '布宜诺斯艾利斯'],
		'CL': ['cl', 'chile', 'santiago', '智利', '圣地亚哥'],
		'MX': ['mx', 'mexico', 'mexico', 'city', '墨西哥', '墨西哥城'],
		'CO': ['co', 'colombia', 'bogota', '哥伦比亚', '波哥大'],
		'PE': ['pe', 'peru', 'lima', '秘鲁', '利马'],
		'UA': ['ua', 'ukraine', 'kiev', '乌克兰', '基辅'],
		'PL': ['pl', 'poland', 'warsaw', '波兰', '华沙'],
		'CZ': ['cz', 'czech', 'prague', '捷克', '布拉格'],
		'AT': ['at', 'austria', 'vienna', '奥地利', '维也纳'],
		'BE': ['be', 'belgium', 'brussels', '比利时', '布鲁塞尔'],
		'SE': ['se', 'sweden', 'stockholm', '瑞典', '斯德哥尔摩'],
		'NO': ['no', 'norway', 'oslo', '挪威', '奥斯陆'],
		'DK': ['dk', 'denmark', 'copenhagen', '丹麦', '哥本哈根'],
		'FI': ['fi', 'finland', 'helsinki', '芬兰', '赫尔辛基']
	};

	const lowerAddress = serverAddress.toLowerCase();

	for (const [region, keywords] of Object.entries(regionKeywords)) {
		for (const keyword of keywords) {
			if (lowerAddress.includes(keyword.toLowerCase())) {
				return region;
			}
		}
	}

	const domainMatch = serverAddress.match(/\.([a-z]{2})$/i);
	if (domainMatch) {
		const countryCode = domainMatch[1].toUpperCase();
		if (regionKeywords[countryCode]) {
			return countryCode;
		}
	}

	return 'Unknown';
}

// 转换为YAML格式
function convertToYAML(obj) {
	function escapeYamlValue(value) {
		if (typeof value !== 'string') return value;

		// 如果包含特殊字符，需要用引号包围
		if (value.includes(':') || value.includes('#') || value.includes('[') ||
			value.includes(']') || value.includes('{') || value.includes('}') ||
			value.includes('|') || value.includes('>') || value.includes('&') ||
			value.includes('*') || value.includes('!') || value.includes('%') ||
			value.includes('@') || value.includes('`') || value.startsWith(' ') ||
			value.endsWith(' ') || /^[\d\-+.]/.test(value)) {
			return `"${value.replace(/"/g, '\\"')}"`;
		}

		return value;
	}

	function toYAML(obj, indent = 0) {
		const spaces = '  '.repeat(indent);
		let result = '';

		if (Array.isArray(obj)) {
			if (obj.length === 0) return '[]';
			for (const item of obj) {
				if (typeof item === 'object' && item !== null) {
					result += `${spaces}- ${toYAML(item, indent + 1).trim()}\n`;
				} else {
					result += `${spaces}- ${escapeYamlValue(item)}\n`;
				}
			}
		} else if (typeof obj === 'object' && obj !== null) {
			for (const [key, value] of Object.entries(obj)) {
				const escapedKey = key.includes('-') || key.includes(' ') ? `"${key}"` : key;

				if (Array.isArray(value)) {
					if (value.length === 0) {
						result += `${spaces}${escapedKey}: []\n`;
					} else {
						result += `${spaces}${escapedKey}:\n`;
						result += toYAML(value, indent + 1);
					}
				} else if (typeof value === 'object' && value !== null) {
					result += `${spaces}${escapedKey}:\n`;
					result += toYAML(value, indent + 1);
				} else {
					result += `${spaces}${escapedKey}: ${escapeYamlValue(value)}\n`;
				}
			}
		} else {
			return escapeYamlValue(obj);
		}

		return result;
	}

	return toYAML(obj);
}

// 获取HTML页面
function getHTML(request) {
	const url = new URL(request.url);
	const origin = `${url.protocol}//${url.host}`;

	return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Clash订阅生成器</title>
    <link rel="icon" type="image/x-icon" href="https://edit-upload-pic.cdn.bcebos.com/fa92cdaae067ca91eaac54032820ff02.jpeg?authorization=bce-auth-v1%2FALTAKh1mxHnNIyeO93hiasKJqq%2F2025-08-10T22%3A10%3A49Z%2F3600%2Fhost%2F20b1ae151cd70e88c0871772b2a49140b85e8cc36bd779cd56551ad26e6006fc">
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/lipis/flag-icons@7.2.3/css/flag-icons.min.css" />
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Segoe UI Emoji', 'Segoe UI Symbol', 'Noto Color Emoji', 'Apple Color Emoji', Roboto, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            padding: 20px;
        }

        .container {
            max-width: 1200px;
            margin: 0 auto;
            background: white;
            border-radius: 12px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.1);
            overflow: hidden;
        }

        .header {
            background: #2c3e50;
            color: white;
            padding: 30px;
            text-align: center;
        }

        .header h1 {
            font-size: 2.5em;
            margin-bottom: 10px;
        }

        .header p {
            opacity: 0.8;
            font-size: 1.1em;
        }

        .tabs {
            display: flex;
            background: #34495e;
        }

        .tab {
            flex: 1;
            padding: 20px;
            text-align: center;
            color: #000;
            cursor: pointer;
            transition: background 0.3s;
            border: none;
            font-size: 1.1em;
            background: #ecf0f1;
        }

        .tab.active {
            background: #3498db;
            color: white;
        }

        .tab:hover {
            background: #2980b9;
            color: white;
        }

        .content {
            padding: 30px;
        }

        .section {
            display: none;
        }

        .section.active {
            display: block;
        }

        .input-group {
            margin-bottom: 25px;
        }

        .input-group label {
            display: block;
            margin-bottom: 8px;
            font-weight: 600;
            color: #2c3e50;
        }

        .input-group input, .input-group textarea, .input-group select {
            width: 100%;
            padding: 12px 15px;
            border: 2px solid #e0e0e0;
            border-radius: 8px;
            font-size: 1em;
            transition: border-color 0.3s;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Segoe UI Emoji', 'Segoe UI Symbol', 'Noto Color Emoji', 'Apple Color Emoji', Arial, sans-serif;
            background: white;
        }

        .input-group textarea {
            min-height: 120px;
            resize: vertical;
        }

        .input-group input:focus, .input-group textarea:focus, .input-group select:focus {
            outline: none;
            border-color: #3498db;
        }

        .input-group select {
            cursor: pointer;
        }

        /* 自定义下拉菜单样式 */
        .custom-select {
            position: relative;
            width: 100%;
        }

        .select-display {
            width: 100%;
            padding: 12px 15px;
            border: 2px solid #e0e0e0;
            border-radius: 8px;
            font-size: 1em;
            background: white;
            cursor: pointer;
            display: flex;
            justify-content: space-between;
            align-items: center;
            transition: border-color 0.3s;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Segoe UI Emoji', 'Segoe UI Symbol', 'Noto Color Emoji', 'Apple Color Emoji', Arial, sans-serif;
        }

        .select-display:hover {
            border-color: #3498db;
        }

        .select-display.active {
            border-color: #3498db;
            border-bottom-left-radius: 0;
            border-bottom-right-radius: 0;
        }

        .select-arrow {
            transition: transform 0.3s;
            color: #666;
        }

        .select-display.active .select-arrow {
            transform: rotate(180deg);
        }

        .select-options {
            position: absolute;
            top: 100%;
            left: 0;
            right: 0;
            background: white;
            border: 2px solid #3498db;
            border-top: none;
            border-radius: 0 0 8px 8px;
            max-height: 200px;
            overflow-y: auto;
            z-index: 1000;
            display: none;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        }

        .select-options.show {
            display: block;
        }

        .select-option {
            padding: 12px 15px;
            cursor: pointer;
            transition: background-color 0.2s;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Segoe UI Emoji', 'Segoe UI Symbol', 'Noto Color Emoji', 'Apple Color Emoji', Arial, sans-serif;
            display: flex;
            align-items: center;
            gap: 8px;
        }

        .select-option .fi {
            width: 20px;
            height: 15px;
            border-radius: 2px;
        }

        .select-option:hover {
            background-color: #f8f9fa;
        }

        .select-option.selected {
            background-color: #3498db;
            color: white;
        }

        .btn {
            background: #3498db;
            color: white;
            border: none;
            padding: 12px 25px;
            border-radius: 8px;
            cursor: pointer;
            font-size: 1em;
            transition: background 0.3s;
            margin-right: 10px;
            margin-bottom: 10px;
        }

        .btn:hover {
            background: #2980b9;
        }

        .btn.danger {
            background: #e74c3c;
        }

        .btn.danger:hover {
            background: #c0392b;
        }

        .btn.success {
            background: #27ae60;
        }

        .btn.success:hover {
            background: #229954;
        }

        .list {
            background: #f8f9fa;
            border-radius: 8px;
            padding: 20px;
            margin-top: 20px;
        }

        .list-item {
            background: white;
            padding: 15px;
            margin-bottom: 10px;
            border-radius: 6px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }

        .list-item:last-child {
            margin-bottom: 0;
        }

        .item-info {
            flex: 1;
        }

        .item-name {
            font-weight: 600;
            color: #2c3e50;
            margin-bottom: 5px;
        }

        .item-details {
            color: #7f8c8d;
            font-size: 0.9em;
        }

        .subscription-links {
            background: #e8f5e8;
            padding: 20px;
            border-radius: 8px;
            margin-top: 20px;
        }

        .subscription-links h3 {
            color: #27ae60;
            margin-bottom: 15px;
        }

        .link-item {
            background: white;
            padding: 15px;
            border-radius: 6px;
            margin-bottom: 10px;
            border-left: 4px solid #27ae60;
        }

        .link-item:last-child {
            margin-bottom: 0;
        }

        .link-url {
            font-family: monospace;
            background: #f1f2f6;
            padding: 8px 12px;
            border-radius: 4px;
            word-break: break-all;
            margin-top: 8px;
        }

        .message {
            padding: 12px 15px;
            border-radius: 6px;
            margin-bottom: 15px;
            display: none;
        }

        .message.success {
            background: #d4edda;
            color: #155724;
            border: 1px solid #c3e6cb;
        }

        .message.error {
            background: #f8d7da;
            color: #721c24;
            border: 1px solid #f5c6cb;
        }
        .message.info {
            background: #d1ecf1;
            color: #0c5460;
            border: 1px solid #bee5eb;
        }

        .empty-state {
            text-align: center;
            color: #7f8c8d;
            padding: 40px;
        }

        .empty-state i {
            font-size: 3em;
            margin-bottom: 15px;
            opacity: 0.5;
        }

        @media (max-width: 768px) {
            .container {
                margin: 10px;
                border-radius: 8px;
            }

            .header {
                padding: 20px;
            }

            .header h1 {
                font-size: 2em;
            }

            .content {
                padding: 20px;
            }

            .tabs {
                flex-direction: column;
            }

            .list-item {
                flex-direction: column;
                align-items: flex-start;
            }

            .list-item .btn {
                margin-top: 10px;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🚀 Clash订阅生成器</h1>
            <p>轻松管理你的代理节点和订阅链接</p>
        </div>

        <div class="tabs">
            <button class="tab active" onclick="switchTab('proxies')">节点整合</button>
            <button class="tab" onclick="switchTab('submerge')">订阅整合</button>
        </div>

        <div class="content">
            <!-- 节点整合部分 -->
            <div id="proxies" class="section active">
                <div class="input-group">
                    <label for="proxyUrl">添加节点链接（支持批量添加，每行一个链接）</label>
                    <textarea id="proxyUrl" placeholder="支持 vmess://, vless://, ss://, hysteria2://, trojan:// 等协议，每行一个链接"></textarea>
                </div>

                <div class="input-group">
                    <label for="regionSelect">地区选择</label>
                    <div class="custom-select" id="regionSelect">
                        <div class="select-display" onclick="toggleRegionDropdown()">
                            <span id="selectedRegion">🌍 自动识别地区</span>
                            <span class="select-arrow">▼</span>
                        </div>
                        <div class="select-options" id="regionOptions">
                            <div class="select-option" data-value="auto">🌍 自动识别地区</div>
                            <div class="select-option" data-value="US"><span class="fi fi-us"></span> 美国</div>
                            <div class="select-option" data-value="HK"><span class="fi fi-hk"></span> 香港</div>
                            <div class="select-option" data-value="JP"><span class="fi fi-jp"></span> 日本</div>
                            <div class="select-option" data-value="KR"><span class="fi fi-kr"></span> 韩国</div>
                            <div class="select-option" data-value="TW"><span class="fi fi-tw"></span> 台湾</div>
                            <div class="select-option" data-value="SG"><span class="fi fi-sg"></span> 新加坡</div>
                            <div class="select-option" data-value="UK"><span class="fi fi-gb"></span> 英国</div>
                            <div class="select-option" data-value="FR"><span class="fi fi-fr"></span> 法国</div>
                            <div class="select-option" data-value="DE"><span class="fi fi-de"></span> 德国</div>
                            <div class="select-option" data-value="AU"><span class="fi fi-au"></span> 澳大利亚</div>
                            <div class="select-option" data-value="MY"><span class="fi fi-my"></span> 马来西亚</div>
                            <div class="select-option" data-value="IT"><span class="fi fi-it"></span> 意大利</div>
                            <div class="select-option" data-value="ES"><span class="fi fi-es"></span> 西班牙</div>
                            <div class="select-option" data-value="NL"><span class="fi fi-nl"></span> 荷兰</div>
                            <div class="select-option" data-value="RU"><span class="fi fi-ru"></span> 俄罗斯</div>
                            <div class="select-option" data-value="CH"><span class="fi fi-ch"></span> 瑞士</div>
                            <div class="select-option" data-value="UA"><span class="fi fi-ua"></span> 乌克兰</div>
                            <div class="select-option" data-value="CL"><span class="fi fi-cl"></span> 智利</div>
                            <div class="select-option" data-value="BR"><span class="fi fi-br"></span> 巴西</div>
                            <div class="select-option" data-value="MX"><span class="fi fi-mx"></span> 墨西哥</div>
                            <div class="select-option" data-value="AR"><span class="fi fi-ar"></span> 阿根廷</div>
                            <div class="select-option" data-value="TR"><span class="fi fi-tr"></span> 土耳其</div>
                            <div class="select-option" data-value="AE"><span class="fi fi-ae"></span> 阿联酋</div>
                            <div class="select-option" data-value="IN"><span class="fi fi-in"></span> 印度</div>
                            <div class="select-option" data-value="VN"><span class="fi fi-vn"></span> 越南</div>
                            <div class="select-option" data-value="TH"><span class="fi fi-th"></span> 泰国</div>
                            <div class="select-option" data-value="ID"><span class="fi fi-id"></span> 印尼</div>
                            <div class="select-option" data-value="CA"><span class="fi fi-ca"></span> 加拿大</div>
                            <div class="select-option" data-value="PL"><span class="fi fi-pl"></span> 波兰</div>
                            <div class="select-option" data-value="CZ"><span class="fi fi-cz"></span> 捷克</div>
                            <div class="select-option" data-value="AT"><span class="fi fi-at"></span> 奥地利</div>
                            <div class="select-option" data-value="BE"><span class="fi fi-be"></span> 比利时</div>
                            <div class="select-option" data-value="SE"><span class="fi fi-se"></span> 瑞典</div>
                            <div class="select-option" data-value="NO"><span class="fi fi-no"></span> 挪威</div>
                            <div class="select-option" data-value="DK"><span class="fi fi-dk"></span> 丹麦</div>
                            <div class="select-option" data-value="FI"><span class="fi fi-fi"></span> 芬兰</div>
                            <div class="select-option" data-value="PH"><span class="fi fi-ph"></span> 菲律宾</div>
                            <div class="select-option" data-value="IL"><span class="fi fi-il"></span> 以色列</div>
                            <div class="select-option" data-value="ZA"><span class="fi fi-za"></span> 南非</div>
                            <div class="select-option" data-value="EG"><span class="fi fi-eg"></span> 埃及</div>
                            <div class="select-option" data-value="CO"><span class="fi fi-co"></span> 哥伦比亚</div>
                            <div class="select-option" data-value="PE"><span class="fi fi-pe"></span> 秘鲁</div>
                        </div>
                    </div>
                </div>

                <button class="btn" onclick="addProxy()">添加节点</button>
                <button class="btn danger" onclick="clearProxies()">清空所有节点</button>

                <div id="proxyMessage" class="message"></div>

                <div class="list" id="proxyList">
                    <div class="empty-state">
                        <div>📡</div>
                        <p>暂无节点，请添加节点链接</p>
                    </div>
                </div>

                <div class="subscription-links">
                    <h3>📋 节点整合订阅链接</h3>
                    <div class="link-item">
                        <strong>ProxySub配置</strong>
                        <div class="link-url" id="proxiesLink">${origin}/clash/proxies</div>
                        <button class="btn success" onclick="copyLink('proxiesLink')">复制链接</button>
                    </div>
                </div>
            </div>

            <!-- 订阅整合部分 -->
            <div id="submerge" class="section">
                <div class="input-group">
                    <label for="subUrl">添加订阅链接（支持批量添加，每行一个链接）</label>
                    <textarea id="subUrl" placeholder="输入Clash订阅链接，支持批量添加，每行一个链接"></textarea>
                </div>

                <button class="btn" onclick="addSubscription()">添加订阅</button>
                <button class="btn" onclick="updateSubscriptionNames()">更新订阅名称</button>
                <button class="btn danger" onclick="clearSubscriptions()">清空所有订阅</button>

                <div id="subMessage" class="message"></div>

                <div class="list" id="subList">
                    <div class="empty-state">
                        <div>🔗</div>
                        <p>暂无订阅，请添加订阅链接</p>
                    </div>
                </div>

                <div class="subscription-links">
                    <h3>📋 订阅整合链接</h3>
                    <div class="link-item">
                        <strong>SubMerge配置</strong>
                        <div class="link-url" id="submergeLink">${origin}/clash/submerge</div>
                        <button class="btn success" onclick="copyLink('submergeLink')">复制链接</button>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <script>
        let proxies = [];
        let subscriptions = [];
        let subscriptionNames = [];

        // 页面加载时初始化
        window.addEventListener('load', function() {
            loadProxies();
            loadSubscriptions();
            // 启动订阅名称定时更新（每小时）
            startSubscriptionNameUpdater();
        });

        // 切换标签页
        function switchTab(tab) {
            document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));

            event.target.classList.add('active');
            document.getElementById(tab).classList.add('active');
        }

        // 显示消息
        function showMessage(elementId, message, type = 'success') {
            const messageEl = document.getElementById(elementId);
            messageEl.textContent = message;
            messageEl.className = 'message ' + type;
            messageEl.style.display = 'block';

            setTimeout(() => {
                messageEl.style.display = 'none';
            }, 3000);
        }

        // 自定义下拉菜单相关变量
        let selectedRegionValue = 'auto';

        // 切换下拉菜单显示/隐藏
        function toggleRegionDropdown() {
            const display = document.querySelector('.select-display');
            const options = document.getElementById('regionOptions');

            display.classList.toggle('active');
            options.classList.toggle('show');
        }

        // 选择地区选项
        function selectRegionOption(value, text) {
            selectedRegionValue = value;
            document.getElementById('selectedRegion').innerHTML = text;

            // 更新选中状态
            document.querySelectorAll('.select-option').forEach(option => {
                option.classList.remove('selected');
            });
            document.querySelector('[data-value="' + value + '"]').classList.add('selected');

            // 关闭下拉菜单
            document.querySelector('.select-display').classList.remove('active');
            document.getElementById('regionOptions').classList.remove('show');
        }

        // 点击选项事件处理
        document.addEventListener('DOMContentLoaded', function() {
            document.querySelectorAll('.select-option').forEach(option => {
                option.addEventListener('click', function() {
                    const value = this.getAttribute('data-value');
                    const text = this.innerHTML;
                    selectRegionOption(value, text);
                });
            });

            // 点击外部关闭下拉菜单
            document.addEventListener('click', function(event) {
                const customSelect = document.querySelector('.custom-select');
                if (!customSelect.contains(event.target)) {
                    document.querySelector('.select-display').classList.remove('active');
                    document.getElementById('regionOptions').classList.remove('show');
                }
            });

            // 设置默认选中项
            document.querySelector('[data-value="auto"]').classList.add('selected');
        });

        // 添加节点
        async function addProxy() {
            const proxyUrls = document.getElementById('proxyUrl').value.trim();
            const region = selectedRegionValue;

            if (!proxyUrls) {
                showMessage('proxyMessage', '请输入节点链接', 'error');
                return;
            }

            try {
                const response = await fetch('/api/proxies', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'add', data: { proxyUrls, region } })
                });

                const result = await response.json();

                if (result.error) {
                    showMessage('proxyMessage', result.error, 'error');
                } else {
                    var message = "成功添加 " + result.successCount + " 个节点";
                    if (result.duplicateCount > 0) {
                        message += '，' + result.duplicateCount + ' 个重复节点已跳过';
                    }
                    showMessage('proxyMessage', message);
                    document.getElementById('proxyUrl').value = '';
                    loadProxies();
                }
            } catch (error) {
                showMessage('proxyMessage', '添加节点失败', 'error');
            }
        }

        // 删除节点
        async function deleteProxy(index) {
            try {
                const response = await fetch('/api/proxies', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'delete', data: { index } })
                });

                const result = await response.json();

                if (result.error) {
                    showMessage('proxyMessage', result.error, 'error');
                } else {
                    showMessage('proxyMessage', '节点删除成功');
                    loadProxies();
                }
            } catch (error) {
                showMessage('proxyMessage', '删除节点失败', 'error');
            }
        }

        // 清空所有节点
        async function clearProxies() {
            try {
                const response = await fetch('/api/proxies', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'clear' })
                });

                const result = await response.json();

                if (result.error) {
                    showMessage('proxyMessage', result.error, 'error');
                } else {
                    showMessage('proxyMessage', '所有节点已清空');
                    loadProxies();
                }
            } catch (error) {
                showMessage('proxyMessage', '清空节点失败', 'error');
            }
        }

        // 加载节点列表
        async function loadProxies() {
            try {
                const response = await fetch('/api/proxies');
                proxies = await response.json();
                renderProxies();
            } catch (error) {
                console.error('加载节点失败:', error);
            }
        }

        // 渲染节点列表
        function renderProxies() {
            const listEl = document.getElementById('proxyList');

            if (proxies.length === 0) {
                listEl.innerHTML = '<div class="empty-state"><div>📡</div><p>暂无节点，请添加节点链接</p></div>';
                return;
            }

            let html = '';
            for (let i = 0; i < proxies.length; i++) {
                const proxy = proxies[i];
                html += '<div class="list-item">';
                html += '<div class="item-info">';
                html += '<div class="item-name">' + proxy.name + '</div>';
                html += '<div class="item-details">' + proxy.server + ':' + proxy.port + ' (' + proxy.type.toUpperCase() + ')</div>';
                html += '</div>';
                html += '<button class="btn danger" onclick="deleteProxy(' + i + ')">删除</button>';
                html += '</div>';
            }
            listEl.innerHTML = html;
        }

        // 添加订阅
        async function addSubscription() {
            const subUrl = document.getElementById('subUrl').value.trim();
            if (!subUrl) {
                showMessage('subMessage', '请输入订阅链接', 'error');
                return;
            }

            try {
                const response = await fetch('/api/submerge', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'add', data: subUrl })
                });

                const result = await response.json();

                if (result.error) {
                    showMessage('subMessage', result.error, 'error');
                } else {
                    var message = '成功添加 ' + result.successCount + ' 个订阅';
                    if (result.duplicateCount > 0) {
                        message += '，' + result.duplicateCount + ' 个重复订阅已跳过';
                    }
                    if (result.failedCount > 0) {
                        message += '，' + result.failedCount + ' 个订阅添加失败';
                    }
                    showMessage('subMessage', message);
                    document.getElementById('subUrl').value = '';
                    loadSubscriptions();
                }
            } catch (error) {
                showMessage('subMessage', '添加订阅失败', 'error');
            }
        }

        // 删除订阅
        async function deleteSubscription(index) {
            try {
                const response = await fetch('/api/submerge', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'delete', data: { index } })
                });

                const result = await response.json();

                if (result.error) {
                    showMessage('subMessage', result.error, 'error');
                } else {
                    showMessage('subMessage', '订阅删除成功');
                    loadSubscriptions();
                }
            } catch (error) {
                showMessage('subMessage', '删除订阅失败', 'error');
            }
        }

        // 清空所有订阅
        async function clearSubscriptions() {
            try {
                const response = await fetch('/api/submerge', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'clear' })
                });

                const result = await response.json();

                if (result.error) {
                    showMessage('subMessage', result.error, 'error');
                } else {
                    showMessage('subMessage', '所有订阅已清空');
                    loadSubscriptions();
                }
            } catch (error) {
                showMessage('subMessage', '清空订阅失败', 'error');
            }
        }

        // 加载订阅列表
        async function loadSubscriptions() {
            try {
                const response = await fetch('/api/submerge');
                const data = await response.json();
                subscriptions = data;

                // 获取订阅名称
                const namesResponse = await fetch('/api/submerge?names=true');
                if (namesResponse.ok) {
                    subscriptionNames = await namesResponse.json();
                } else {
                    subscriptionNames = subscriptions.map((_, index) => '订阅' + (index + 1));
                }

                renderSubscriptions();
            } catch (error) {
                console.error('加载订阅失败:', error);
            }
        }

        // 渲染订阅列表
        function renderSubscriptions() {
            const listEl = document.getElementById('subList');

            if (subscriptions.length === 0) {
                listEl.innerHTML = '<div class="empty-state"><div>🔗</div><p>暂无订阅，请添加订阅链接</p></div>';
                return;
            }

            let html = '';
            for (let i = 0; i < subscriptions.length; i++) {
                const sub = subscriptions[i];
                const name = subscriptionNames[i] || ('订阅' + (i + 1));
                html += '<div class="list-item">';
                html += '<div class="item-info">';
                html += '<div class="item-name">' + name + '</div>';
                html += '<div class="item-details">' + sub + '</div>';
                html += '</div>';
                html += '<button class="btn danger" onclick="deleteSubscription(' + i + ')">删除</button>';
                html += '</div>';
            }
            listEl.innerHTML = html;
        }

        // 复制链接
        function copyLink(elementId) {
            const linkElement = document.getElementById(elementId);
            const text = linkElement.textContent;

            navigator.clipboard.writeText(text).then(() => {
                // 简单的视觉反馈
                const originalText = linkElement.textContent;
                linkElement.textContent = '已复制!';
                linkElement.style.color = '#27ae60';

                setTimeout(() => {
                    linkElement.textContent = originalText;
                    linkElement.style.color = '';
                }, 1000);
            }).catch(() => {
                // 降级方案
                const textArea = document.createElement('textarea');
                textArea.value = text;
                document.body.appendChild(textArea);
                textArea.select();
                document.execCommand('copy');
                document.body.removeChild(textArea);

                const originalText = linkElement.textContent;
                linkElement.textContent = '已复制!';
                linkElement.style.color = '#27ae60';

                setTimeout(() => {
                    linkElement.textContent = originalText;
                    linkElement.style.color = '';
                }, 1000);
            });
        }

        // 启动订阅名称定时更新器
        function startSubscriptionNameUpdater() {
            // 每小时更新一次订阅名称 (3600000毫秒 = 1小时)
            setInterval(async () => {
                try {
                    const response = await fetch('/api/submerge?update=true');
                    if (response.ok) {
                        const result = await response.json();
                        if (result.success) {
                            console.log('订阅名称自动更新成功:', result.updated + ' 个订阅已更新');
                            // 如果当前页面显示的是订阅整合，刷新列表
                            if (document.getElementById('submerge').classList.contains('active')) {
                                loadSubscriptions();
                            }
                        }
                    }
                } catch (error) {
                    console.warn('订阅名称自动更新失败:', error.message);
                }
            }, 3600000); // 1小时 = 3600000毫秒
        }

        // 手动更新订阅名称
        async function updateSubscriptionNames() {
            try {
                showMessage('subMessage', '正在更新订阅名称...', 'info');
                const response = await fetch('/api/submerge?update=true');
                if (response.ok) {
                    const result = await response.json();
                    if (result.success) {
                        showMessage('subMessage', '订阅名称更新成功，更新了 ' + result.updated + ' 个订阅');
                        loadSubscriptions();
                    } else {
                        showMessage('subMessage', result.message, 'error');
                    }
                } else {
                    showMessage('subMessage', '更新请求失败', 'error');
                }
            } catch (error) {
                showMessage('subMessage', '更新订阅名称失败', 'error');
            }
        }
    </script>
</body>
</html>`;
}
