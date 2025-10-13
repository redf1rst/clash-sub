// Clash订阅生成器 - Cloudflare Worker

// 导入访问令牌认证模块
import { checkToken, handleTokenVerification, handleClearToken } from './token-auth.js';

// 统一的国家/地区代码映射 (基于ISO 3166-1 alpha-2标准)
const REGION_NAMES = {
	// 亚洲 - Asia
	'HK': 'HK香港', 'TW': 'TW台湾', 'JP': 'JP日本', 'KR': 'KR韩国', 'SG': 'SG新加坡',
	'MY': 'MY马来西亚', 'TH': 'TH泰国', 'VN': 'VN越南', 'ID': 'ID印尼', 'PH': 'PH菲律宾',
	'IN': 'IN印度', 'PK': 'PK巴基斯坦', 'BD': 'BD孟加拉', 'KH': 'KH柬埔寨', 'MM': 'MM缅甸',
	'LK': 'LK斯里兰卡', 'NP': 'NP尼泊尔', 'KZ': 'KZ哈萨克斯坦', 'UZ': 'UZ乌兹别克斯坦',
	'LA': 'LA老挝', 'BN': 'BN文莱', 'MN': 'MN蒙古', 'BT': 'BT不丹', 'MV': 'MV马尔代夫',
	'TJ': 'TJ塔吉克斯坦', 'KG': 'KG吉尔吉斯斯坦', 'TM': 'TM土库曼斯坦',

	// 美洲 - Americas
	'US': 'US美国', 'CA': 'CA加拿大', 'MX': 'MX墨西哥', 'BR': 'BR巴西', 'AR': 'AR阿根廷',
	'CL': 'CL智利', 'CO': 'CO哥伦比亚', 'PE': 'PE秘鲁', 'VE': 'VE委内瑞拉', 'EC': 'EC厄瓜多尔',
	'BO': 'BO玻利维亚', 'PY': 'PY巴拉圭', 'UY': 'UY乌拉圭', 'CR': 'CR哥斯达黎加', 'PA': 'PA巴拿马',
	'CW': 'CW库拉索', 'AW': 'AW阿鲁巴', 'BZ': 'BZ伯利兹', 'GT': 'GT危地马拉', 'HN': 'HN洪都拉斯',
	'NI': 'NI尼加拉瓜', 'SV': 'SV萨尔瓦多', 'DO': 'DO多米尼加', 'CU': 'CU古巴', 'JM': 'JM牙买加',
	'HT': 'HT海地', 'TT': 'TT特立尼达', 'BS': 'BS巴哈马', 'BB': 'BB巴巴多斯', 'GY': 'GY圭亚那',
	'SR': 'SR苏里南', 'FK': 'FK福克兰群岛',

	// 欧洲 - Europe
	// 西欧
	'UK': 'UK英国', 'GB': 'GB英国', 'FR': 'FR法国', 'DE': 'DE德国', 'NL': 'NL荷兰',
	'BE': 'BE比利时', 'LU': 'LU卢森堡', 'IE': 'IE爱尔兰', 'AT': 'AT奥地利', 'CH': 'CH瑞士',
	'LI': 'LI列支敦士登',
	// 南欧
	'IT': 'IT意大利', 'ES': 'ES西班牙', 'PT': 'PT葡萄牙', 'GR': 'GR希腊', 'MT': 'MT马耳他',
	'CY': 'CY塞浦路斯', 'AD': 'AD安道尔', 'SM': 'SM圣马力诺', 'VA': 'VA梵蒂冈', 'MC': 'MC摩纳哥',
	// 北欧
	'SE': 'SE瑞典', 'NO': 'NO挪威', 'DK': 'DK丹麦', 'FI': 'FI芬兰', 'IS': 'IS冰岛',
	'EE': 'EE爱沙尼亚', 'LV': 'LV拉脱维亚', 'LT': 'LT立陶宛',
	// 东欧
	'RU': 'RU俄罗斯', 'UA': 'UA乌克兰', 'PL': 'PL波兰', 'CZ': 'CZ捷克', 'SK': 'SK斯洛伐克',
	'HU': 'HU匈牙利', 'RO': 'RO罗马尼亚', 'BG': 'BG保加利亚', 'BY': 'BY白俄罗斯', 'MD': 'MD摩尔多瓦',
	// 巴尔干
	'RS': 'RS塞尔维亚', 'HR': 'HR克罗地亚', 'SI': 'SI斯洛文尼亚', 'BA': 'BA波黑', 'ME': 'ME黑山',
	'MK': 'MK北马其顿', 'AL': 'AL阿尔巴尼亚', 'XK': 'XK科索沃',
	// 高加索
	'GE': 'GE格鲁吉亚', 'AM': 'AM亚美尼亚', 'AZ': 'AZ阿塞拜疆',

	// 中东 - Middle East
	'TR': 'TR土耳其', 'AE': 'AE阿联酋', 'IL': 'IL以色列', 'SA': 'SA沙特', 'QA': 'QA卡塔尔',
	'KW': 'KW科威特', 'BH': 'BH巴林', 'OM': 'OM阿曼', 'JO': 'JO约旦', 'LB': 'LB黎巴嫩',
	'SY': 'SY叙利亚', 'IQ': 'IQ伊拉克', 'IR': 'IR伊朗', 'YE': 'YE也门', 'PS': 'PS巴勒斯坦',
	'AF': 'AF阿富汗',

	// 非洲 - Africa
	'ZA': 'ZA南非', 'EG': 'EG埃及', 'NG': 'NG尼日利亚', 'KE': 'KE肯尼亚', 'ET': 'ET埃塞俄比亚',
	'GH': 'GH加纳', 'DZ': 'DZ阿尔及利亚', 'MA': 'MA摩洛哥', 'TN': 'TN突尼斯', 'LY': 'LY利比亚',
	'SD': 'SD苏丹', 'UG': 'UG乌干达', 'ZW': 'ZW津巴布韦', 'TZ': 'TZ坦桑尼亚', 'AO': 'AO安哥拉',
	'MZ': 'MZ莫桑比克', 'NA': 'NA纳米比亚', 'BW': 'BW博茨瓦纳', 'MU': 'MU毛里求斯', 'SC': 'SC塞舌尔',
	'CI': 'CI科特迪瓦', 'CM': 'CM喀麦隆', 'SN': 'SN塞内加尔', 'ZM': 'ZM赞比亚', 'RW': 'RW卢旺达',
	'SO': 'SO索马里', 'CD': 'CD刚果金', 'CG': 'CG刚果布', 'GA': 'GA加蓬', 'BJ': 'BJ贝宁',
	'BF': 'BF布基纳法索', 'ML': 'ML马里', 'NE': 'NE尼日尔', 'TD': 'TD乍得', 'ER': 'ER厄立特里亚',
	'DJ': 'DJ吉布提', 'MG': 'MG马达加斯加', 'MW': 'MW马拉维', 'LS': 'LS莱索托', 'SZ': 'SZ斯威士兰',
	'RE': 'RE留尼汪',

	// 大洋洲 - Oceania
	'AU': 'AU澳洲', 'NZ': 'NZ新西兰', 'FJ': 'FJ斐济', 'PG': 'PG巴新', 'NC': 'NC新喀里多尼亚',
	'PF': 'PF法属波利尼西亚', 'GU': 'GU关岛', 'WS': 'WS萨摩亚', 'VU': 'VU瓦努阿图', 'TO': 'TO汤加',
	'SB': 'SB所罗门群岛', 'KI': 'KI基里巴斯', 'FM': 'FM密克罗尼西亚', 'PW': 'PW帕劳',

	// 中国特别行政区 (已包含在亚洲部分)
	'CN': 'CN中国', 'MO': 'MO澳门',

	// 其他
	'Unknown': 'Unknown未知'
};

// 统一的节点排序函数
function sortProxiesByRegion(proxies) {
	proxies.sort((a, b) => {
		// 提取节点名称前两位国家代码（大小写不敏感）
		// 只识别符合命名规范的节点：国家代码+中文/数字/特殊字符（非纯英文）
		const extractCountryCode = (name) => {
			// 匹配：两个字母开头 + 非英文字母（中文/数字/符号等）
			const match = name.match(/^([A-Z]{2})(?![a-z])/i);
			return match ? match[1].toUpperCase() : null;
		};

		const countryA = extractCountryCode(a.name);
		const countryB = extractCountryCode(b.name);

		// 如果有一个没有国家代码，没有国家代码的排在最后
		if (countryA && !countryB) {
			return -1; // A有国家代码，排在前面
		}
		if (!countryA && countryB) {
			return 1; // B有国家代码，排在前面
		}

		// 如果两个都没有国家代码，按完整名称字母排序
		if (!countryA && !countryB) {
			return a.name.localeCompare(b.name);
		}

		// 以下是两个都有国家代码的情况
		// 定义高优先级国家顺序
		const priorityCountries = ['US', 'JP', 'SG', 'TW', 'KR', 'HK', 'UK', 'DE', 'FR', 'AU'];

		// 获取优先级索引（-1表示不在优先级列表中）
		const priorityA = priorityCountries.indexOf(countryA);
		const priorityB = priorityCountries.indexOf(countryB);

		// 情况1: 两个都是高优先级国家
		if (priorityA !== -1 && priorityB !== -1) {
			if (priorityA !== priorityB) {
				return priorityA - priorityB; // 按优先级顺序排序
			}
			// 优先级相同，按节点名称字母排序
			return a.name.localeCompare(b.name);
		}

		// 情况2: 只有A是高优先级国家
		if (priorityA !== -1 && priorityB === -1) {
			return -1; // A排在前面
		}

		// 情况3: 只有B是高优先级国家
		if (priorityA === -1 && priorityB !== -1) {
			return 1; // B排在前面
		}

		// 情况4: 两个都不是高优先级国家，按国家代码字母排序
		if (countryA !== countryB) {
			return countryA.localeCompare(countryB);
		}
		// 国家代码相同，按完整名称排序
		return a.name.localeCompare(b.name);
	});
}

export default {
	async fetch(request, env) {
		const url = new URL(request.url);
		const path = url.pathname;

		// 令牌验证路由（不需要令牌）
		if (path === '/api/verify-token') {
			return handleTokenVerification(request, env);
		}

		if (path === '/api/clear-token') {
			return handleClearToken(request);
		}

		// 检查访问令牌
		const tokenCheck = checkToken(request, env);
		if (!tokenCheck.authenticated) {
			return tokenCheck.response;
		}

		// 路由处理
		// 根路径现在由静态文件处理，不需要特殊处理

		if (path === '/api/proxies') {
			return handleProxiesAPI(request, env);
		}

		if (path === '/api/proxy-collections') {
			return handleProxyCollectionsAPI(request, env);
		}

		if (path === '/api/submerge') {
			return handleSubMergeAPI(request, env);
		}

		if (path === '/api/sub-collections') {
			return handleSubCollectionsAPI(request, env);
		}

		if (path === '/api/submerge/check') {
			return handleSubscriptionCheck(request);
		}

		// 节点集合配置生成
		if (path.startsWith('/clash/proxies/')) {
			const collectionId = path.split('/')[3];
			return generateProxyCollectionConfig(collectionId, env);
		}

		// 订阅集合配置生成
		if (path.startsWith('/clash/submerge/')) {
			const collectionId = path.split('/')[3];
			return generateSubCollectionConfig(collectionId, env);
		}

		// 处理静态资源 (通过认证后才能访问)
		if (env.ASSETS) {
			return env.ASSETS.fetch(request);
		}

		return new Response('Not Found', { status: 404 });
	}
};

// 处理节点整合API
async function handleProxiesAPI(request, env) {
	const method = request.method;

	if (method === 'GET') {
		const url = new URL(request.url);

		// 检查是否需要排序现有节点
		if (url.searchParams.get('sort') === 'true') {
			return await sortExistingProxies(env);
		}

		const proxies = await env.CLASH_KV?.get('proxies') || '[]';
		return new Response(proxies, {
			headers: { 'Content-Type': 'application/json' }
		});
	}

	if (method === 'POST') {
		const requestData = await request.json();
		const { action, data, indexes, proxies } = requestData;

		switch (action) {
			case 'add':
				return await addProxy(data, env);
			case 'delete':
				return await deleteProxy(data.index, env);
			case 'clear':
				return await clearProxies(env);
			case 'batchDelete':
				return await batchDeleteProxies(indexes, env);
			case 'addJSON':
				return await addJSONProxies(proxies, data?.region || 'auto', env);
			case 'addMixed':
				return await addMixedProxies(data, env);
			default:
				return new Response('Invalid action', { status: 400 });
		}
	}

	return new Response('Method not allowed', { status: 405 });
}

// 排序现有节点
async function sortExistingProxies(env) {
	try {
		const proxies = JSON.parse(await env.CLASH_KV?.get('proxies') || '[]');

		if (proxies.length === 0) {
			return new Response(JSON.stringify({
				success: true,
				message: '没有节点需要排序',
				sorted: 0
			}), {
				headers: { 'Content-Type': 'application/json' }
			});
		}

		// 使用统一的排序逻辑
		sortProxiesByRegion(proxies);

		// 保存排序后的节点
		await env.CLASH_KV?.put('proxies', JSON.stringify(proxies));

		return new Response(JSON.stringify({
			success: true,
			message: '节点排序完成',
			sorted: proxies.length,
			proxies: proxies.map(p => p.name) // 返回排序后的节点名称列表
		}), {
			headers: { 'Content-Type': 'application/json' }
		});

	} catch (error) {
		return new Response(JSON.stringify({
			success: false,
			message: '节点排序失败: ' + error.message
		}), {
			status: 500,
			headers: { 'Content-Type': 'application/json' }
		});
	}
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

		if (url.searchParams.get('active_detection') === 'true') {
			return await activeDetection(env);
		}

		const subscriptions = await env.CLASH_KV?.get('subscriptions') || '[]';
		return new Response(subscriptions, {
			headers: { 'Content-Type': 'application/json' }
		});
	}

	if (method === 'POST') {
		const url = new URL(request.url);

		// 处理批量活跃检测
		if (url.searchParams.get('active_detection_batch') === 'true') {
			try {
				const requestBody = await request.json();
				console.log('收到的请求体 results 数量:', requestBody.results?.length);
				const { results } = requestBody;

				if (!results) {
					console.error('缺少 results 字段');
					return new Response(JSON.stringify({
						success: false,
						message: '缺少 results 字段'
					}), {
						status: 400,
						headers: { 'Content-Type': 'application/json' }
					});
				}

				return await activeDetectionBatch(results, env);
			} catch (error) {
				console.error('处理活跃检测批量请求失败:', error);
				return new Response(JSON.stringify({
					success: false,
					message: '处理失败: ' + error.message
				}), {
					status: 500,
					headers: { 'Content-Type': 'application/json' }
				});
			}
		}
		const requestData = await request.json();
		const { action, data, indexes } = requestData;

		switch (action) {
			case 'add':
				return await addSubscription(data, env);
			case 'delete':
				return await deleteSubscription(data.index, env);
			case 'clear':
				return await clearSubscriptions(env);
			case 'updateName':
				return await updateSubscriptionName(data.index, data.newName, env);
			case 'batchDelete':
				return await batchDeleteSubscriptions(indexes, env);
			default:
				return new Response('Invalid action', { status: 400 });
		}
	}

	return new Response('Method not allowed', { status: 405 });
}

// 处理订阅集合API
async function handleSubCollectionsAPI(request, env) {
	const method = request.method;

	if (method === 'GET') {
		// 获取所有订阅集合
		const collections = await getSubCollections(env);
		return new Response(JSON.stringify(collections), {
			headers: { 'Content-Type': 'application/json' }
		});
	}

	if (method === 'POST') {
		const requestData = await request.json();
		const { action, data, collectionId, indexes } = requestData;

		switch (action) {
			case 'create':
				return await createSubCollection(data.name, env);
			case 'rename':
				return await renameSubCollection(data.id, data.newName, env);
			case 'delete':
				return await deleteSubCollection(data.id, env);
			case 'addSubscription':
				return await addSubscriptionToCollection(data.collectionId, data.subscriptionUrls, env);
			case 'deleteSubscription':
				return await deleteSubscriptionFromCollection(data.collectionId, data.index, env);
			case 'clearSubscriptions':
				return await clearSubscriptionsFromCollection(data.collectionId, env);
			case 'updateSubscriptionName':
				return await updateSubscriptionNameInCollection(data.collectionId, data.index, data.newName, env);
			case 'activeDetection':
				return await activeDetectionForCollection(data.collectionId, data.results, env);
			case 'batchDeleteSubscription':
				return await batchDeleteSubscriptionsFromCollection(collectionId, indexes, env);
			case 'togglePrefix':
				return await toggleSubCollectionPrefix(collectionId, env);
			default:
				return new Response('Invalid action', { status: 400 });
		}
	}

	return new Response('Method not allowed', { status: 405 });
}

// 获取所有订阅集合
async function getSubCollections(env) {
	try {
		const collections = await env.CLASH_KV?.get('sub_collections') || '[]';
		return JSON.parse(collections);
	} catch (error) {
		return [];
	}
}

// 创建新的订阅集合
async function createSubCollection(name, env) {
	try {
		const collections = await getSubCollections(env);

		// 生成唯一ID
		const id = 'sub_' + Date.now() + '_' + Math.random().toString(36).substring(2, 11);

		// 如果没有提供名称，生成默认名称
		if (!name || name.trim() === '') {
			const existingNumbers = collections
				.map(c => c.name.match(/^SubMerge(\d+)$/))
				.filter(match => match)
				.map(match => parseInt(match[1]));

			let counter = 1;
			while (existingNumbers.includes(counter)) {
				counter++;
			}
			name = `SubMerge${String(counter).padStart(2, '0')}`;
		}

		const newCollection = {
			id,
			name: name.trim(),
			subscriptions: [],
			subscriptionNames: [],
			enablePrefix: true, // 默认开启前缀
			createdAt: Date.now()
		};

		collections.push(newCollection);
		await env.CLASH_KV?.put('sub_collections', JSON.stringify(collections));

		return new Response(JSON.stringify({
			success: true,
			collection: newCollection
		}), {
			headers: { 'Content-Type': 'application/json' }
		});
	} catch (error) {
		return new Response(JSON.stringify({ error: '创建订阅集合失败' }), {
			status: 500,
			headers: { 'Content-Type': 'application/json' }
		});
	}
}

// 重命名订阅集合
async function renameSubCollection(id, newName, env) {
	try {
		const collections = await getSubCollections(env);
		const collection = collections.find(c => c.id === id);

		if (!collection) {
			return new Response(JSON.stringify({ error: '订阅集合不存在' }), {
				status: 404,
				headers: { 'Content-Type': 'application/json' }
			});
		}

		if (!newName || newName.trim() === '') {
			return new Response(JSON.stringify({ error: '集合名称不能为空' }), {
				status: 400,
				headers: { 'Content-Type': 'application/json' }
			});
		}

		collection.name = newName.trim();
		await env.CLASH_KV?.put('sub_collections', JSON.stringify(collections));

		return new Response(JSON.stringify({
			success: true,
			message: '订阅集合重命名成功'
		}), {
			headers: { 'Content-Type': 'application/json' }
		});
	} catch (error) {
		return new Response(JSON.stringify({ error: '重命名订阅集合失败' }), {
			status: 500,
			headers: { 'Content-Type': 'application/json' }
		});
	}
}

// 切换订阅集合前缀开关
async function toggleSubCollectionPrefix(collectionId, env) {
	try {
		const collections = await getSubCollections(env);
		const collection = collections.find(c => c.id === collectionId);

		if (!collection) {
			return new Response(JSON.stringify({ error: '订阅集合不存在' }), {
				status: 404,
				headers: { 'Content-Type': 'application/json' }
			});
		}

		// 切换前缀开关（如果字段不存在，默认为true，切换后为false）
		collection.enablePrefix = collection.enablePrefix === false ? true : false;

		await env.CLASH_KV?.put('sub_collections', JSON.stringify(collections));

		return new Response(JSON.stringify({
			success: true,
			enablePrefix: collection.enablePrefix,
			message: collection.enablePrefix ? '已开启订阅名称前缀' : '已关闭订阅名称前缀'
		}), {
			headers: { 'Content-Type': 'application/json' }
		});
	} catch (error) {
		return new Response(JSON.stringify({ error: '切换前缀开关失败' }), {
			status: 500,
			headers: { 'Content-Type': 'application/json' }
		});
	}
}

// 删除订阅集合
async function deleteSubCollection(id, env) {
	try {
		const collections = await getSubCollections(env);
		const index = collections.findIndex(c => c.id === id);

		if (index === -1) {
			return new Response(JSON.stringify({ error: '订阅集合不存在' }), {
				status: 404,
				headers: { 'Content-Type': 'application/json' }
			});
		}

		collections.splice(index, 1);
		await env.CLASH_KV?.put('sub_collections', JSON.stringify(collections));

		return new Response(JSON.stringify({
			success: true,
			message: '订阅集合删除成功'
		}), {
			headers: { 'Content-Type': 'application/json' }
		});
	} catch (error) {
		return new Response(JSON.stringify({ error: '删除订阅集合失败' }), {
			status: 500,
			headers: { 'Content-Type': 'application/json' }
		});
	}
}

// 向集合添加订阅
async function addSubscriptionToCollection(collectionId, subscriptionUrls, env) {
	try {
		const collections = await getSubCollections(env);
		const collection = collections.find(c => c.id === collectionId);

		if (!collection) {
			return new Response(JSON.stringify({ error: '订阅集合不存在' }), {
				status: 404,
				headers: { 'Content-Type': 'application/json' }
			});
		}

		// 支持批量添加
		const urls = subscriptionUrls.split('\n').map(url => url.trim()).filter(url => url);

		let successCount = 0;
		let duplicateCount = 0;
		let failedCount = 0;
		const addedSubscriptions = [];
		const failedSubscriptions = [];

		// 分批处理订阅，避免超时
		const BATCH_SIZE = 3; // 每批处理3个订阅()
		const batches = [];
		for (let i = 0; i < urls.length; i += BATCH_SIZE) {
			batches.push(urls.slice(i, i + BATCH_SIZE));
		}

		for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
			const batch = batches[batchIndex];
			console.log(`[COLLECTION BATCH] 处理第 ${batchIndex + 1}/${batches.length} 批，包含 ${batch.length} 个订阅`);

			// 并行处理当前批次的订阅
			const batchPromises = batch.map(async (subUrl, index) => {
				const globalIndex = batchIndex * BATCH_SIZE + index;
				console.log(`[COLLECTION ${globalIndex + 1}/${urls.length}] 处理订阅URL: ${subUrl}`);

				// 检查重复订阅
				if (collection.subscriptions.includes(subUrl)) {
					console.log(`[COLLECTION SKIP] 重复订阅: ${subUrl}`);
					return { type: 'duplicate', url: subUrl };
				}

				try {
					// 添加随机延迟，避免请求过于集中
					if (index > 0) {
						await new Promise(resolve => setTimeout(resolve, Math.random() * 1000 + 500));
					}

					// 获取订阅信息
					console.log(`[COLLECTION ${globalIndex + 1}/${urls.length}] 获取订阅信息: ${subUrl}`);
					const subInfo = await getSubscriptionInfo(subUrl);

					// 智能连通性判断
					console.log(`[COLLECTION ${globalIndex + 1}/${urls.length}] 开始连通性检查: ${subUrl}`);
					const shouldReject = await shouldRejectSubscription(subUrl, subInfo);
					if (shouldReject.reject) {
						console.log(`[COLLECTION FAILED] 订阅被拒绝: ${subUrl}, 原因: ${shouldReject.reason}`);
						return {
							type: 'failed',
							url: subUrl,
							error: shouldReject.reason,
							statusCode: subInfo.statusCode
						};
					}

					// 生成订阅名称
					console.log(`[COLLECTION SUCCESS] 订阅通过检查，生成名称: ${subUrl}`);
					const subName = generateSubscriptionName(subInfo, collection.subscriptionNames);

					console.log(`[COLLECTION ADDED] 订阅添加成功: ${subUrl} -> ${subName}`);
					return {
						type: 'success',
						url: subUrl,
						name: subName,
						subInfo: subInfo
					};
				} catch (error) {
					console.log(`[COLLECTION ERROR] 处理订阅时出错: ${subUrl}, 错误: ${error.message}`);
					return {
						type: 'failed',
						url: subUrl,
						error: '处理失败: ' + error.message,
						statusCode: 0
					};
				}
			});

			// 等待当前批次完成
			const batchResults = await Promise.allSettled(batchPromises);

			// 处理批次结果
			for (const result of batchResults) {
				if (result.status === 'fulfilled') {
					const data = result.value;
					switch (data.type) {
						case 'duplicate':
							duplicateCount++;
							break;
						case 'failed':
							failedCount++;
							failedSubscriptions.push({
								url: data.url,
								error: data.error,
								statusCode: data.statusCode
							});
							break;
						case 'success':
							collection.subscriptions.push(data.url);
							collection.subscriptionNames.push(data.name);
							addedSubscriptions.push({ url: data.url, name: data.name });
							successCount++;
							break;
					}
				} else {
					// Promise被拒绝的情况
					failedCount++;
					failedSubscriptions.push({
						url: 'unknown',
						error: '处理Promise失败: ' + result.reason,
						statusCode: 0
					});
				}
			}

			// 批次间添加短暂延迟
			if (batchIndex < batches.length - 1) {
				await new Promise(resolve => setTimeout(resolve, 1000));
			}
		}

		await env.CLASH_KV?.put('sub_collections', JSON.stringify(collections));

		return new Response(JSON.stringify({
			success: true,
			successCount,
			duplicateCount,
			failedCount,
			addedSubscriptions,
			failedSubscriptions
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

// 从集合删除订阅
async function deleteSubscriptionFromCollection(collectionId, index, env) {
	try {
		const collections = await getSubCollections(env);
		const collection = collections.find(c => c.id === collectionId);

		if (!collection) {
			return new Response(JSON.stringify({ error: '订阅集合不存在' }), {
				status: 404,
				headers: { 'Content-Type': 'application/json' }
			});
		}

		if (index < 0 || index >= collection.subscriptions.length) {
			return new Response(JSON.stringify({ error: '无效的订阅索引' }), {
				status: 400,
				headers: { 'Content-Type': 'application/json' }
			});
		}

		collection.subscriptions.splice(index, 1);
		collection.subscriptionNames.splice(index, 1);

		await env.CLASH_KV?.put('sub_collections', JSON.stringify(collections));

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

// 清空集合中的所有订阅
async function clearSubscriptionsFromCollection(collectionId, env) {
	try {
		const collections = await getSubCollections(env);
		const collection = collections.find(c => c.id === collectionId);

		if (!collection) {
			return new Response(JSON.stringify({ error: '订阅集合不存在' }), {
				status: 404,
				headers: { 'Content-Type': 'application/json' }
			});
		}

		collection.subscriptions = [];
		collection.subscriptionNames = [];

		await env.CLASH_KV?.put('sub_collections', JSON.stringify(collections));

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

// 批量删除集合中的订阅
async function batchDeleteSubscriptionsFromCollection(collectionId, indexes, env) {
	try {
		const collections = await getSubCollections(env);
		const collection = collections.find(c => c.id === collectionId);

		if (!collection) {
			return new Response(JSON.stringify({ error: '订阅集合不存在' }), {
				status: 404,
				headers: { 'Content-Type': 'application/json' }
			});
		}

		// 按索引降序排序，从后往前删除，避免索引错位
		const sortedIndexes = indexes.sort((a, b) => b - a);

		// 验证索引有效性
		for (const index of sortedIndexes) {
			if (index < 0 || index >= collection.subscriptions.length) {
				return new Response(JSON.stringify({ error: '无效的订阅索引' }), {
					status: 400,
					headers: { 'Content-Type': 'application/json' }
				});
			}
		}

		// 删除订阅和对应的名称
		for (const index of sortedIndexes) {
			collection.subscriptions.splice(index, 1);
			if (index < collection.subscriptionNames.length) {
				collection.subscriptionNames.splice(index, 1);
			}
		}

		await env.CLASH_KV?.put('sub_collections', JSON.stringify(collections));

		return new Response(JSON.stringify({
			success: true,
			deletedCount: indexes.length,
			remainingCount: collection.subscriptions.length
		}), {
			headers: { 'Content-Type': 'application/json' }
		});
	} catch (error) {
		return new Response(JSON.stringify({ error: '批量删除订阅失败' }), {
			status: 500,
			headers: { 'Content-Type': 'application/json' }
		});
	}
}

// 更新集合中订阅的名称
async function updateSubscriptionNameInCollection(collectionId, index, newName, env) {
	try {
		const collections = await getSubCollections(env);
		const collection = collections.find(c => c.id === collectionId);

		if (!collection) {
			return new Response(JSON.stringify({ error: '订阅集合不存在' }), {
				status: 404,
				headers: { 'Content-Type': 'application/json' }
			});
		}

		if (index < 0 || index >= collection.subscriptions.length) {
			return new Response(JSON.stringify({ error: '无效的订阅索引' }), {
				status: 400,
				headers: { 'Content-Type': 'application/json' }
			});
		}

		if (!newName || newName.trim() === '') {
			return new Response(JSON.stringify({ error: '订阅名称不能为空' }), {
				status: 400,
				headers: { 'Content-Type': 'application/json' }
			});
		}

		collection.subscriptionNames[index] = newName.trim();

		await env.CLASH_KV?.put('sub_collections', JSON.stringify(collections));

		return new Response(JSON.stringify({
			success: true,
			message: '订阅名称更新成功'
		}), {
			headers: { 'Content-Type': 'application/json' }
		});
	} catch (error) {
		return new Response(JSON.stringify({ error: '更新订阅名称失败' }), {
			status: 500,
			headers: { 'Content-Type': 'application/json' }
		});
	}
}

// 订阅集合的活跃检测
async function activeDetectionForCollection(collectionId, results, env) {
	try {
		const collections = await getSubCollections(env);
		const collection = collections.find(c => c.id === collectionId);

		if (!collection) {
			return new Response(JSON.stringify({ error: '订阅集合不存在' }), {
				status: 404,
				headers: { 'Content-Type': 'application/json' }
			});
		}

		// 验证输入参数
		if (!results || !Array.isArray(results)) {
			return new Response(JSON.stringify({
				success: false,
				message: '无效的检测结果数据'
			}), {
				status: 400,
				headers: { 'Content-Type': 'application/json' }
			});
		}

		const validSubscriptions = [];
		const validNames = [];
		const removedSubscriptions = [];

		// 存储已经使用的基础名称（不含流量和到期信息）以避免重复
		const usedBaseNames = new Set();

		for (const result of results) {
			// 检查订阅的有效性
			const subInfo = await getSubscriptionInfo(result.url);
			const shouldReject = await shouldRejectSubscription(result.url, subInfo);

			if (shouldReject.reject) {
				// 记录被移除的订阅
				removedSubscriptions.push({
					url: result.url,
					name: result.name || '未知订阅',
					reason: shouldReject.reason
				});
				continue; // 跳过无效的订阅
			}

			// 订阅有效，保留并更新名称
			validSubscriptions.push(result.url);

			// 提取基础名称
			let baseName = result.name;

			// 从现有名称中提取基础名称（去除流量和到期信息）
			if (baseName) {
				const baseNameMatch = baseName.match(/^([^[\(]+?)(?:\s*\[.*?\])?(?:\s*\(.*?\))?$/);
				if (baseNameMatch) {
					baseName = baseNameMatch[1].trim();
				}
			}

			// 如果没有基础名称，使用订阅编号
			if (!baseName) {
				const usedNumbers = new Set();
				validNames.forEach(name => {
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
			const tempSubInfo = {
				name: uniqueBaseName,
				download: subInfo.download || 0,
				total: subInfo.total || 0,
				expire: subInfo.expire || null
			};
			const newName = generateSubscriptionName(tempSubInfo, validNames);
			validNames.push(newName);
		}

		// 更新集合中的订阅和名称
		collection.subscriptions = validSubscriptions;
		collection.subscriptionNames = validNames;

		// 保存更新后的集合
		await env.CLASH_KV?.put('sub_collections', JSON.stringify(collections));

		return new Response(JSON.stringify({
			success: true,
			message: '活跃检测完成',
			totalChecked: results.length,
			updated: validNames.length,
			removed: removedSubscriptions.length,
			removedSubscriptions: removedSubscriptions
		}), {
			headers: { 'Content-Type': 'application/json' }
		});

	} catch (error) {
		return new Response(JSON.stringify({
			success: false,
			message: '活跃检测失败: ' + error.message
		}), {
			status: 500,
			headers: { 'Content-Type': 'application/json' }
		});
	}
}

// 处理节点集合API
async function handleProxyCollectionsAPI(request, env) {
	const method = request.method;

	if (method === 'GET') {
		// 获取所有节点集合
		const collections = await getProxyCollections(env);
		return new Response(JSON.stringify(collections), {
			headers: { 'Content-Type': 'application/json' }
		});
	}

	if (method === 'POST') {
		const requestData = await request.json();
		const { action, data, collectionId, indexes, proxies } = requestData;

		switch (action) {
			case 'create':
				return await createProxyCollection(data.name, env);
			case 'rename':
				return await renameProxyCollection(data.id, data.newName, env);
			case 'delete':
				return await deleteProxyCollection(data.id, env);
			case 'addProxy':
				return await addProxyToCollection(data.collectionId, data.proxyUrls, data.region, env);
			case 'deleteProxy':
				return await deleteProxyFromCollection(data.collectionId, data.index, env);
			case 'clearProxies':
				return await clearProxiesFromCollection(data.collectionId, env);
			case 'batchDeleteProxy':
				return await batchDeleteProxiesFromCollection(collectionId, indexes, env);
			case 'addJSONProxy':
				return await addJSONProxiesToCollection(collectionId, proxies, data?.region || 'auto', env);
			case 'addMixedProxy':
				return await addMixedProxiesToCollection(collectionId, data, env);
			case 'updateProxyName':
				return await updateProxyNameInCollection(data.collectionId, data.index, data.newName, env);
			case 'updateProxyServer':
				return await updateProxyServerInCollection(data.collectionId, data.index, data.newServer, env);
			default:
				return new Response('Invalid action', { status: 400 });
		}
	}

	return new Response('Method not allowed', { status: 405 });
}

// 辅助函数：深度比较两个节点是否完全相同
function areProxiesIdentical(proxy1, proxy2) {
	// 排除name字段的比较，因为name是自动生成的
	const p1 = { ...proxy1 };
	const p2 = { ...proxy2 };
	delete p1.name;
	delete p2.name;

	// 获取所有键
	const keys1 = Object.keys(p1).sort();
	const keys2 = Object.keys(p2).sort();

	// 如果键的数量不同，则不相同
	if (keys1.length !== keys2.length) {
		return false;
	}

	// 检查是否有相同的键
	if (keys1.some((key, index) => key !== keys2[index])) {
		return false;
	}

	// 深度比较每个字段的值
	for (const key of keys1) {
		const val1 = p1[key];
		const val2 = p2[key];

		// 处理不同类型的值
		if (val1 === val2) {
			continue;
		}

		// 如果值类型不同
		if (typeof val1 !== typeof val2) {
			return false;
		}

		// 处理对象和数组
		if (typeof val1 === 'object' && val1 !== null && val2 !== null) {
			// 简单的JSON字符串比较
			if (JSON.stringify(val1) !== JSON.stringify(val2)) {
				return false;
			}
		} else {
			return false;
		}
	}

	return true;
}

// 获取所有节点集合
async function getProxyCollections(env) {
	try {
		const collections = await env.CLASH_KV?.get('proxy_collections') || '[]';
		return JSON.parse(collections);
	} catch (error) {
		return [];
	}
}

// 创建新的节点集合
async function createProxyCollection(name, env) {
	try {
		const collections = await getProxyCollections(env);

		// 生成唯一ID
		const id = 'proxy_' + Date.now() + '_' + Math.random().toString(36).substring(2, 11);

		// 如果没有提供名称，生成默认名称
		if (!name || name.trim() === '') {
			const existingNumbers = collections
				.map(c => c.name.match(/^ProxySub(\d+)$/))
				.filter(match => match)
				.map(match => parseInt(match[1]));

			let counter = 1;
			while (existingNumbers.includes(counter)) {
				counter++;
			}
			name = `ProxySub${String(counter).padStart(2, '0')}`;
		}

		const newCollection = {
			id,
			name: name.trim(),
			proxies: [],
			createdAt: Date.now()
		};

		collections.push(newCollection);
		await env.CLASH_KV?.put('proxy_collections', JSON.stringify(collections));

		return new Response(JSON.stringify({
			success: true,
			collection: newCollection
		}), {
			headers: { 'Content-Type': 'application/json' }
		});
	} catch (error) {
		return new Response(JSON.stringify({ error: '创建节点集合失败' }), {
			status: 500,
			headers: { 'Content-Type': 'application/json' }
		});
	}
}

// 重命名节点集合
async function renameProxyCollection(id, newName, env) {
	try {
		const collections = await getProxyCollections(env);
		const collection = collections.find(c => c.id === id);

		if (!collection) {
			return new Response(JSON.stringify({ error: '节点集合不存在' }), {
				status: 404,
				headers: { 'Content-Type': 'application/json' }
			});
		}

		if (!newName || newName.trim() === '') {
			return new Response(JSON.stringify({ error: '集合名称不能为空' }), {
				status: 400,
				headers: { 'Content-Type': 'application/json' }
			});
		}

		collection.name = newName.trim();
		await env.CLASH_KV?.put('proxy_collections', JSON.stringify(collections));

		return new Response(JSON.stringify({
			success: true,
			message: '节点集合重命名成功'
		}), {
			headers: { 'Content-Type': 'application/json' }
		});
	} catch (error) {
		return new Response(JSON.stringify({ error: '重命名节点集合失败' }), {
			status: 500,
			headers: { 'Content-Type': 'application/json' }
		});
	}
}

// 删除节点集合
async function deleteProxyCollection(id, env) {
	try {
		const collections = await getProxyCollections(env);
		const index = collections.findIndex(c => c.id === id);

		if (index === -1) {
			return new Response(JSON.stringify({ error: '节点集合不存在' }), {
				status: 404,
				headers: { 'Content-Type': 'application/json' }
			});
		}

		collections.splice(index, 1);
		await env.CLASH_KV?.put('proxy_collections', JSON.stringify(collections));

		return new Response(JSON.stringify({
			success: true,
			message: '节点集合删除成功'
		}), {
			headers: { 'Content-Type': 'application/json' }
		});
	} catch (error) {
		return new Response(JSON.stringify({ error: '删除节点集合失败' }), {
			status: 500,
			headers: { 'Content-Type': 'application/json' }
		});
	}
}

// 向集合添加节点
async function addProxyToCollection(collectionId, proxyUrls, region, env) {
	try {
		const collections = await getProxyCollections(env);
		const collection = collections.find(c => c.id === collectionId);

		if (!collection) {
			return new Response(JSON.stringify({ error: '节点集合不存在' }), {
				status: 404,
				headers: { 'Content-Type': 'application/json' }
			});
		}

		// 支持多行输入
		const urls = proxyUrls.split('\n').map(url => url.trim()).filter(url => url);

		let successCount = 0;
		let duplicateCount = 0;
		let errorCount = 0;
		const addedProxies = [];

		for (const proxyUrl of urls) {
			const proxyConfig = parseProxyUrl(proxyUrl);

			if (!proxyConfig) {
				errorCount++;
				continue; // 跳过无效的节点链接
			}

			// 验证解析结果的关键字段
			if (!proxyConfig.type || !proxyConfig.server || !proxyConfig.port) {
				errorCount++;
				continue; // 跳过解析结果不完整的节点
			}

			// 检查重复节点 - 所有字段都相同才认为是重复
			const isDuplicate = collection.proxies.some(p =>
				areProxiesIdentical(p, proxyConfig)
			);

			if (isDuplicate) {
				duplicateCount++;
				continue;
			}

			// 生成节点名称 - 链接格式节点统一使用自动命名规则
			let detectedRegion;
			if (region === 'auto') {
				detectedRegion = await detectRegion(proxyConfig.server);
			} else {
				detectedRegion = region;
			}

			// 使用统一的地区代码映射
			const regionName = REGION_NAMES[detectedRegion] || detectedRegion;
			const isIPv6 = isIPv6Address(proxyConfig.server);
			const suffix = isIPv6 ? '-IPv6' : '';

			// 计算序号 - 找到该地区可用的最小序号，填补空缺
			const regionPattern = new RegExp(`^${regionName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\d{3})(-IPv6)?$`);
			const usedNumbers = new Set();

			// 检查现有节点使用的序号
			collection.proxies.forEach(p => {
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

			// 使用三位数字格式
			const nodeNumberStr = String(nodeNumber).padStart(3, '0');
			proxyConfig.name = `${regionName}${nodeNumberStr}${suffix}`;

			collection.proxies.push(proxyConfig);
			addedProxies.push(proxyConfig);
			successCount++;
		}

		// 排序节点 - 使用统一的排序逻辑
		sortProxiesByRegion(collection.proxies);

		await env.CLASH_KV?.put('proxy_collections', JSON.stringify(collections));

		return new Response(JSON.stringify({
			success: true,
			successCount,
			duplicateCount,
			errorCount,
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

// 从集合删除节点
async function deleteProxyFromCollection(collectionId, index, env) {
	try {
		const collections = await getProxyCollections(env);
		const collection = collections.find(c => c.id === collectionId);

		if (!collection) {
			return new Response(JSON.stringify({ error: '节点集合不存在' }), {
				status: 404,
				headers: { 'Content-Type': 'application/json' }
			});
		}

		if (index < 0 || index >= collection.proxies.length) {
			return new Response(JSON.stringify({ error: '无效的节点索引' }), {
				status: 400,
				headers: { 'Content-Type': 'application/json' }
			});
		}

		collection.proxies.splice(index, 1);
		await env.CLASH_KV?.put('proxy_collections', JSON.stringify(collections));

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

// 清空集合中的所有节点
async function clearProxiesFromCollection(collectionId, env) {
	try {
		const collections = await getProxyCollections(env);
		const collection = collections.find(c => c.id === collectionId);

		if (!collection) {
			return new Response(JSON.stringify({ error: '节点集合不存在' }), {
				status: 404,
				headers: { 'Content-Type': 'application/json' }
			});
		}

		collection.proxies = [];
		await env.CLASH_KV?.put('proxy_collections', JSON.stringify(collections));

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

// 批量删除集合中的节点
async function batchDeleteProxiesFromCollection(collectionId, indexes, env) {
	try {
		const collections = await getProxyCollections(env);
		const collection = collections.find(c => c.id === collectionId);

		if (!collection) {
			return new Response(JSON.stringify({ error: '节点集合不存在' }), {
				status: 404,
				headers: { 'Content-Type': 'application/json' }
			});
		}

		// 按索引降序排序，从后往前删除，避免索引错位
		const sortedIndexes = indexes.sort((a, b) => b - a);

		// 验证索引有效性
		for (const index of sortedIndexes) {
			if (index < 0 || index >= collection.proxies.length) {
				return new Response(JSON.stringify({ error: '无效的节点索引' }), {
					status: 400,
					headers: { 'Content-Type': 'application/json' }
				});
			}
		}

		// 删除节点
		for (const index of sortedIndexes) {
			collection.proxies.splice(index, 1);
		}

		await env.CLASH_KV?.put('proxy_collections', JSON.stringify(collections));

		return new Response(JSON.stringify({
			success: true,
			deletedCount: indexes.length,
			remainingCount: collection.proxies.length
		}), {
			headers: { 'Content-Type': 'application/json' }
		});
	} catch (error) {
		return new Response(JSON.stringify({ error: '批量删除节点失败' }), {
			status: 500,
			headers: { 'Content-Type': 'application/json' }
		});
	}
}

// 更新节点集合中的节点名称
async function updateProxyNameInCollection(collectionId, index, newName, env) {
	try {
		const collections = await getProxyCollections(env);
		const collection = collections.find(c => c.id === collectionId);

		if (!collection) {
			return new Response(JSON.stringify({ error: '节点集合不存在' }), {
				status: 404,
				headers: { 'Content-Type': 'application/json' }
			});
		}

		// 验证索引
		if (index < 0 || index >= collection.proxies.length) {
			return new Response(JSON.stringify({ error: '无效的节点索引' }), {
				status: 400,
				headers: { 'Content-Type': 'application/json' }
			});
		}

		// 验证新名称
		if (!newName || newName.trim() === '') {
			return new Response(JSON.stringify({ error: '节点名称不能为空' }), {
				status: 400,
				headers: { 'Content-Type': 'application/json' }
			});
		}

		// 更新节点名称
		collection.proxies[index].name = newName.trim();

		// 保存到KV
		await env.CLASH_KV?.put('proxy_collections', JSON.stringify(collections));

		return new Response(JSON.stringify({
			success: true,
			message: '节点名称更新成功',
			newName: newName.trim()
		}), {
			headers: { 'Content-Type': 'application/json' }
		});
	} catch (error) {
		return new Response(JSON.stringify({ error: '更新节点名称失败' }), {
			status: 500,
			headers: { 'Content-Type': 'application/json' }
		});
	}
}

// 更新节点集合中的节点server (IP优选)
async function updateProxyServerInCollection(collectionId, index, newServer, env) {
	try {
		const collections = await getProxyCollections(env);
		const collection = collections.find(c => c.id === collectionId);

		if (!collection) {
			return new Response(JSON.stringify({ error: '节点集合不存在' }), {
				status: 404,
				headers: { 'Content-Type': 'application/json' }
			});
		}

		// 验证索引
		if (index < 0 || index >= collection.proxies.length) {
			return new Response(JSON.stringify({ error: '无效的节点索引' }), {
				status: 400,
				headers: { 'Content-Type': 'application/json' }
			});
		}

		// 验证新server地址
		if (!newServer || newServer.trim() === '') {
			return new Response(JSON.stringify({ error: 'Server地址不能为空' }), {
				status: 400,
				headers: { 'Content-Type': 'application/json' }
			});
		}

		// 格式化server地址(处理IPv6)
		const formattedServer = formatServerAddress(newServer.trim());

		// 更新节点server
		collection.proxies[index].server = formattedServer;

		// 保存到KV
		await env.CLASH_KV?.put('proxy_collections', JSON.stringify(collections));

		return new Response(JSON.stringify({
			success: true,
			message: 'Server地址更新成功',
			newServer: formattedServer
		}), {
			headers: { 'Content-Type': 'application/json' }
		});
	} catch (error) {
		return new Response(JSON.stringify({ error: '更新Server地址失败' }), {
			status: 500,
			headers: { 'Content-Type': 'application/json' }
		});
	}
}



// 添加混合格式节点到节点整合
async function addMixedProxies(data, env) {
	try {
		const { jsonProxies, proxyUrls, region } = data;

		// 1. 处理链接格式节点
		const linkResult = await addProxy({ proxyUrls, region }, env);
		const linkData = await linkResult.json();

		// 如果链接处理失败，直接返回错误
		if (linkData.error) {
			return new Response(JSON.stringify(linkData), {
				status: linkResult.status,
				headers: { 'Content-Type': 'application/json' }
			});
		}

		// 2. 处理JSON格式节点
		const jsonResult = await addJSONProxies(jsonProxies, env);
		const jsonData = await jsonResult.json();

		// 如果JSON处理失败，直接返回错误
		if (jsonData.error) {
			return new Response(JSON.stringify(jsonData), {
				status: jsonResult.status,
				headers: { 'Content-Type': 'application/json' }
			});
		}

		// 3. 合并结果
		const combinedResult = {
			success: true,
			successCount: (linkData.successCount || 0) + (jsonData.addedCount || 0),
			duplicateCount: (linkData.duplicateCount || 0) + 0, // JSON处理目前没有重复计数
			addedProxies: [...(linkData.addedProxies || []), ...(jsonData.addedProxies || [])]
		};

		return new Response(JSON.stringify(combinedResult), {
			headers: { 'Content-Type': 'application/json' }
		});
	} catch (error) {
		return new Response(JSON.stringify({ error: '添加混合格式节点失败: ' + error.message }), {
			status: 500,
			headers: { 'Content-Type': 'application/json' }
		});
	}
}

// 添加混合格式节点到节点集合
async function addMixedProxiesToCollection(collectionId, data, env) {
	try {
		const { jsonProxies, proxyUrls, region } = data;

		// 1. 处理链接格式节点
		const linkResult = await addProxyToCollection(collectionId, proxyUrls, region, env);
		const linkData = await linkResult.json();

		// 如果链接处理失败，直接返回错误
		if (linkData.error) {
			return new Response(JSON.stringify(linkData), {
				status: linkResult.status,
				headers: { 'Content-Type': 'application/json' }
			});
		}

		// 2. 处理JSON格式节点
		const jsonResult = await addJSONProxiesToCollection(collectionId, jsonProxies, env);
		const jsonData = await jsonResult.json();

		// 如果JSON处理失败，直接返回错误
		if (jsonData.error) {
			return new Response(JSON.stringify(jsonData), {
				status: jsonResult.status,
				headers: { 'Content-Type': 'application/json' }
			});
		}

		// 3. 合并结果
		const combinedResult = {
			success: true,
			successCount: (linkData.successCount || 0) + (jsonData.successCount || 0),
			duplicateCount: (linkData.duplicateCount || 0) + (jsonData.duplicateCount || 0),
			errorCount: (linkData.errorCount || 0) + (jsonData.errorCount || 0),
			addedProxies: [...(linkData.addedProxies || []), ...(jsonData.addedProxies || [])]
		};

		return new Response(JSON.stringify(combinedResult), {
			headers: { 'Content-Type': 'application/json' }
		});
	} catch (error) {
		return new Response(JSON.stringify({ error: '添加混合格式节点失败: ' + error.message }), {
			status: 500,
			headers: { 'Content-Type': 'application/json' }
		});
	}
}

// 添加JSON格式节点到集合
async function addJSONProxiesToCollection(collectionId, proxiesToAdd, region, env) {
	try {
		const collections = await getProxyCollections(env);
		const collection = collections.find(c => c.id === collectionId);

		if (!collection) {
			return new Response(JSON.stringify({ error: '节点集合不存在' }), {
				status: 404,
				headers: { 'Content-Type': 'application/json' }
			});
		}

		let successCount = 0;
		let duplicateCount = 0;
		let errorCount = 0;
		const addedProxies = [];

		// 为每个地区+IP版本组合维护独立的编号集合
		const regionUsedNumbers = new Map();

		// 验证和处理每个节点
		for (const jsonData of proxiesToAdd) {
			let proxyData = jsonData;

			// ���ַ���(�� YAML ��һ�� "- { ... }" ��ʽ)�����Խ���
			if (typeof jsonData === 'string') {
				try {
					let inline = jsonData.trim();
					if (inline.startsWith('-')) {
						inline = inline.replace(/^\-\s*/, '');
					}
					// Ϊ name ֵ�����ԣ�ʹ�ø���ֵ�к���ַ���/CJKֵ�ܹ������
					inline = inline.replace(/(\bname\s*:\s*)([^,}]+)/, function (_, p1, v) {
						const t = v.trim();
						if (t.startsWith('"') || t.startsWith('\'')) return p1 + t;
						return p1 + '"' + t.replace(/"/g, '\\"') + '"';
					});
					proxyData = parseLooseJSON(inline);
				} catch (parseError) {
					return new Response(JSON.stringify({
						error: `JSON����ʧ��: ${parseError.message}`
					}), {
						status: 400,
						headers: { 'Content-Type': 'application/json' }
					});
				}
			}

			// 如果是无效JSON，尝试宽松解析
			if (jsonData._invalid) {
				try {
					proxyData = parseLooseJSON(jsonData._originalLine);
				} catch (parseError) {
					errorCount++;
					continue; // 跳过解析失败的JSON
				}
			}

			// 基本字段验证
			if (!proxyData.name || !proxyData.server || !proxyData.port || !proxyData.type) {
				errorCount++;
				continue; // 跳过格式错误的节点，继续处理其他节点
			}

			// 验证端口号
			const port = parseInt(proxyData.port);
			if (isNaN(port) || port < 1 || port > 65535) {
				errorCount++;
				continue; // 跳过端口号无效的节点
			}

			// 格式化server地址
			const formattedServer = formatServerAddress(proxyData.server.trim());

			// 检查重复节点 - 所有字段都相同才认为是重复
			// 先构建完整的节点对象用于比较
			const tempProxy = normalizeJSONProxy(proxyData, '', formattedServer, port);
			const isDuplicate = collection.proxies.some(p =>
				areProxiesIdentical(p, tempProxy)
			);

			if (isDuplicate) {
				duplicateCount++;
				continue; // 跳过重复节点
			}

			// 地区检测：手动选择优先，否则自动检测
			let detectedRegion;
			if (region === 'auto') {
				detectedRegion = await detectRegion(formattedServer);
			} else {
				detectedRegion = region;
			}

			// 使用统一的地区代码映射
			const regionName = REGION_NAMES[detectedRegion] || detectedRegion;
			const isIPv6 = isIPv6Address(formattedServer);
			const suffix = isIPv6 ? '-IPv6' : '';

			// 计算序号 - 找到该地区可用的最小序号，填补空缺
			const regionPattern = new RegExp(`^${regionName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\d{3})(-IPv6)?$`);
			const regionKey = `${regionName}${suffix}`; // 如 "US美国-IPv4"

			// 获取或创建该地区的编号集合
			if (!regionUsedNumbers.has(regionKey)) {
				const usedNumbers = new Set();

				// 检查现有节点使用的序号
				collection.proxies.forEach(p => {
					const match = p.name.match(regionPattern);
					if (match) {
						const num = parseInt(match[1]);
						usedNumbers.add(num);
					}
				});

				// 检查本次已添加的节点使用的序号
				addedProxies.forEach(p => {
					const match = p.name.match(regionPattern);
					if (match) {
						const num = parseInt(match[1]);
						usedNumbers.add(num);
					}
				});

				regionUsedNumbers.set(regionKey, usedNumbers);
			}

			const usedNumbers = regionUsedNumbers.get(regionKey);
			console.log(`[DEBUG] Region: ${regionKey}, usedNumbers before assignment:`, Array.from(usedNumbers));

			// 找到最小的可用序号（填补空缺）
			let nodeNumber = 1;
			while (usedNumbers.has(nodeNumber)) {
				nodeNumber++;
			}
			usedNumbers.add(nodeNumber); // 立即添加到集合中，防止重复

			// JSON格式节点：优先使用原始名称，如果重复则智能处理编号
			// 检查原始名称是否以三位数字结尾
			const match = proxyData.name.match(/^(.+?)(\d{3})$/);
			let baseName, hasThreeDigits;

			if (match) {
				// 名称末尾是三位数字，例如 "香港节点001"
				baseName = match[1];  // "香港节点"
				hasThreeDigits = true;
			} else {
				// 名称末尾不是三位数字
				baseName = proxyData.name;
				hasThreeDigits = false;
			}

			// 从001开始遍历，找到第一个可用编号
			let counter = 1;
			let finalName = proxyData.name;  // 先尝试原始名称
			let isNameDuplicate = true;

			while (isNameDuplicate) {
				// 检查名称是否重复
				isNameDuplicate = collection.proxies.some(p => p.name === finalName) ||
					addedProxies.some(p => p.name === finalName);

				if (isNameDuplicate) {
					const counterStr = String(counter).padStart(3, '0');
					// 无论末尾是否有三位数字，都直接拼接数字（如果有则替换，如果没有则添加）
					finalName = `${baseName}${counterStr}`;
					counter++;
				}
			}

			console.log(`[DEBUG] JSON node original name: ${proxyData.name}, final name: ${finalName}`);

			// 标准化节点数据 - 使用协议特定的解析函数
			const normalizedProxy = normalizeJSONProxy(proxyData, finalName, formattedServer, port);

			collection.proxies.push(normalizedProxy);
			addedProxies.push(normalizedProxy);
			successCount++;
		}

		// 排序节点 - 使用统一的排序逻辑
		sortProxiesByRegion(collection.proxies);

		await env.CLASH_KV?.put('proxy_collections', JSON.stringify(collections));

		return new Response(JSON.stringify({
			success: true,
			successCount,
			duplicateCount,
			errorCount,
			addedProxies
		}), {
			headers: { 'Content-Type': 'application/json' }
		});
	} catch (error) {
		return new Response(JSON.stringify({ error: '添加JSON节点失败: ' + error.message }), {
			status: 500,
			headers: { 'Content-Type': 'application/json' }
		});
	}
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

			// 检查重复节点 - 所有字段都相同才认为是重复
			const isDuplicate = proxies.some(p =>
				areProxiesIdentical(p, proxyConfig)
			);

			if (isDuplicate) {
				duplicateCount++;
				continue;
			}

			// 生成节点名称 - 链接格式节点统一使用自动命名规则
			let detectedRegion;
			if (region === 'auto') {
				detectedRegion = await detectRegion(proxyConfig.server);
			} else {
				detectedRegion = region;
			}

			// 使用统一的地区代码映射
			const regionName = REGION_NAMES[detectedRegion] || detectedRegion;
			const isIPv6 = isIPv6Address(proxyConfig.server);
			const suffix = isIPv6 ? '-IPv6' : '';

			// 计算序号 - 找到该地区可用的最小序号，填补空缺
			const regionPattern = new RegExp(`^${regionName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\d{3})(-IPv6)?$`);
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

			// 使用三位数字格式
			const nodeNumberStr = String(nodeNumber).padStart(3, '0');
			proxyConfig.name = `${regionName}${nodeNumberStr}${suffix}`;

			proxies.push(proxyConfig);
			addedProxies.push(proxyConfig);
			successCount++;
		}

		// 对节点进行排序 - 使用统一的排序逻辑
		sortProxiesByRegion(proxies);

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
		sortProxiesByRegion(proxies);

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

// 批量删除节点
async function batchDeleteProxies(indexes, env) {
	try {
		const proxies = JSON.parse(await env.CLASH_KV?.get('proxies') || '[]');

		// 按索引降序排序，从后往前删除，避免索引错位
		const sortedIndexes = indexes.sort((a, b) => b - a);

		// 验证索引有效性
		for (const index of sortedIndexes) {
			if (index < 0 || index >= proxies.length) {
				return new Response(JSON.stringify({ error: '无效的节点索引' }), {
					status: 400,
					headers: { 'Content-Type': 'application/json' }
				});
			}
		}

		// 删除节点
		for (const index of sortedIndexes) {
			proxies.splice(index, 1);
		}

		await env.CLASH_KV?.put('proxies', JSON.stringify(proxies));

		return new Response(JSON.stringify({
			success: true,
			deletedCount: indexes.length,
			remainingCount: proxies.length
		}), {
			headers: { 'Content-Type': 'application/json' }
		});
	} catch (error) {
		return new Response(JSON.stringify({ error: '批量删除节点失败' }), {
			status: 500,
			headers: { 'Content-Type': 'application/json' }
		});
	}
}

// 添加JSON格式节点
async function addJSONProxies(proxiesToAdd, region, env) {
	try {
		const proxies = JSON.parse(await env.CLASH_KV?.get('proxies') || '[]');
		const addedProxies = [];
		let successCount = 0;
		let duplicateCount = 0;

		// 验证和处理每个节点
		for (const jsonData of proxiesToAdd) {
			let proxyData = jsonData;

			// 如果是无效JSON，尝试宽松解析
			if (jsonData._invalid) {
				try {
					proxyData = parseLooseJSON(jsonData._originalLine);
				} catch (parseError) {
					return new Response(JSON.stringify({
						error: `JSON解析失败: ${parseError.message}`
					}), {
						status: 400,
						headers: { 'Content-Type': 'application/json' }
					});
				}
			}

			// 基本字段验证
			if (!proxyData.name || !proxyData.server || !proxyData.port || !proxyData.type) {
				return new Response(JSON.stringify({
					error: '节点数据格式不完整，必须包含 name、server、port、type 字段'
				}), {
					status: 400,
					headers: { 'Content-Type': 'application/json' }
				});
			}

			// 验证端口号
			const port = parseInt(proxyData.port);
			if (isNaN(port) || port < 1 || port > 65535) {
				return new Response(JSON.stringify({
					error: `节点 "${proxyData.name}" 的端口号无效`
				}), {
					status: 400,
					headers: { 'Content-Type': 'application/json' }
				});
			}

			// 格式化server地址
			const formattedServer = formatServerAddress(proxyData.server.trim());

			// 检查重复节点 - 所有字段都相同才认为是重复
			// 先构建完整的节点对象用于比较
			const tempProxy = normalizeJSONProxy(proxyData, '', formattedServer, port);
			const isDuplicate = proxies.some(p =>
				areProxiesIdentical(p, tempProxy)
			);

			if (isDuplicate) {
				duplicateCount++;
				continue; // 跳过重复节点
			}

			// 地区检测：手动选择优先，否则自动检测
			let detectedRegion;
			if (region === 'auto') {
				detectedRegion = await detectRegion(formattedServer);
			} else {
				detectedRegion = region;
			}

			// 使用统一的地区代码映射
			const regionName = REGION_NAMES[detectedRegion] || detectedRegion;
			const isIPv6 = isIPv6Address(formattedServer);
			const suffix = isIPv6 ? '-IPv6' : '';

			// 计算序号
			const regionPattern = new RegExp(`^${regionName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\d{3})(-IPv6)?$`);
			const usedNumbers = new Set();

			// 检查现有节点
			proxies.forEach(p => {
				const match = p.name.match(regionPattern);
				if (match) {
					usedNumbers.add(parseInt(match[1]));
				}
			});

			// 检查本次添加的节点
			addedProxies.forEach(p => {
				const match = p.name.match(regionPattern);
				if (match) {
					usedNumbers.add(parseInt(match[1]));
				}
			});

			// JSON格式节点：优先使用原始名称，如果重复则智能处理编号
			// 检查原始名称是否以三位数字结尾
			const matchName = proxyData.name.match(/^(.+?)(\d{3})$/);
			let baseName, hasThreeDigits;

			if (matchName) {
				// 名称末尾是三位数字，例如 "香港节点001"
				baseName = matchName[1];  // "香港节点"
				hasThreeDigits = true;
			} else {
				// 名称末尾不是三位数字
				baseName = proxyData.name;
				hasThreeDigits = false;
			}

			// 从001开始遍历，找到第一个可用编号
			let counter = 1;
			let finalName = proxyData.name;  // 先尝试原始名称
			let isNameDuplicate = true;

			while (isNameDuplicate) {
				// 检查名称是否重复
				isNameDuplicate = proxies.some(p => p.name === finalName) ||
					addedProxies.some(p => p.name === finalName);

				if (isNameDuplicate) {
					const counterStr = String(counter).padStart(3, '0');
					// 无论末尾是否有三位数字，都直接拼接数字（如果有则替换，如果没有则添加）
					finalName = `${baseName}${counterStr}`;
					counter++;
				}
			}

			// 标准化节点数据 - 使用协议特定的解析函数
			const normalizedProxy = normalizeJSONProxy(proxyData, finalName, formattedServer, port);

			proxies.push(normalizedProxy);
			addedProxies.push(normalizedProxy);
			successCount++;
		}

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
		return new Response(JSON.stringify({ error: '添加JSON节点失败: ' + error.message }), {
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
		const failedSubscriptions = [];

		// 分批处理订阅，避免超时
		const BATCH_SIZE = 3; // 每批处理3个订阅
		const batches = [];
		for (let i = 0; i < urls.length; i += BATCH_SIZE) {
			batches.push(urls.slice(i, i + BATCH_SIZE));
		}

		for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
			const batch = batches[batchIndex];
			console.log(`[BATCH] 处理第 ${batchIndex + 1}/${batches.length} 批，包含 ${batch.length} 个订阅`);

			// 并行处理当前批次的订阅
			const batchPromises = batch.map(async (subUrl, index) => {
				const globalIndex = batchIndex * BATCH_SIZE + index;
				console.log(`[${globalIndex + 1}/${urls.length}] 处理订阅URL: ${subUrl}`);

				// 检查重复订阅
				if (subscriptions.includes(subUrl)) {
					console.log(`[SKIP] 重复订阅: ${subUrl}`);
					return { type: 'duplicate', url: subUrl };
				}

				try {
					// 添加随机延迟，避免请求过于集中
					if (index > 0) {
						await new Promise(resolve => setTimeout(resolve, Math.random() * 1000 + 500));
					}

					// 获取订阅信息（包括名称、流量、到期时间）
					console.log(`[${globalIndex + 1}/${urls.length}] 获取订阅信息: ${subUrl}`);
					const subInfo = await getSubscriptionInfo(subUrl);

					// 智能连通性判断
					console.log(`[${globalIndex + 1}/${urls.length}] 开始连通性检查: ${subUrl}`);
					const shouldReject = await shouldRejectSubscription(subUrl, subInfo);
					if (shouldReject.reject) {
						console.log(`[FAILED] 订阅被拒绝: ${subUrl}, 原因: ${shouldReject.reason}`);
						return {
							type: 'failed',
							url: subUrl,
							error: shouldReject.reason,
							statusCode: subInfo.statusCode
						};
					}

					// 生成订阅名称
					console.log(`[SUCCESS] 订阅通过检查，生成名称: ${subUrl}`);
					const subName = generateSubscriptionName(subInfo, subscriptionNames);

					console.log(`[ADDED] 订阅添加成功: ${subUrl} -> ${subName}`);
					return {
						type: 'success',
						url: subUrl,
						name: subName,
						subInfo: subInfo
					};
				} catch (error) {
					console.log(`[ERROR] 处理订阅时出错: ${subUrl}, 错误: ${error.message}`);
					return {
						type: 'failed',
						url: subUrl,
						error: '处理失败: ' + error.message,
						statusCode: 0
					};
				}
			});

			// 等待当前批次完成
			const batchResults = await Promise.allSettled(batchPromises);

			// 处理批次结果
			for (const result of batchResults) {
				if (result.status === 'fulfilled') {
					const data = result.value;
					switch (data.type) {
						case 'duplicate':
							duplicateCount++;
							break;
						case 'failed':
							failedCount++;
							failedSubscriptions.push({
								url: data.url,
								error: data.error,
								statusCode: data.statusCode
							});
							break;
						case 'success':
							subscriptions.push(data.url);
							subscriptionNames.push(data.name);
							addedSubscriptions.push({ url: data.url, name: data.name });
							successCount++;
							break;
					}
				} else {
					// Promise被拒绝的情况
					failedCount++;
					failedSubscriptions.push({
						url: 'unknown',
						error: '处理Promise失败: ' + result.reason,
						statusCode: 0
					});
				}
			}

			// 批次间添加短暂延迟
			if (batchIndex < batches.length - 1) {
				await new Promise(resolve => setTimeout(resolve, 1000));
			}
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
			addedSubscriptions,
			failedSubscriptions
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



// 定义三种主要 Clash 客户端请求头
const CLASH_USER_AGENTS = [
	{
		name: 'Clash Verge',
		headers: {
			'User-Agent': 'Clash Verge',
			'Accept': '*/*',
			'Accept-Encoding': 'gzip'
		}
	},
	{
		name: 'Clash Meta',
		headers: {
			'User-Agent': 'Clash Meta',
			'Accept': '*/*',
			'Accept-Encoding': 'gzip'
		}
	},
	{
		name: 'Mihomo',
		headers: {
			'User-Agent': 'mihomo',
			'Accept': '*/*',
			'Accept-Encoding': 'gzip, deflate',
			'Connection': 'keep-alive'
		}
	}
];

// 使用多种请求头轮询获取订阅
async function fetchWithUserAgentRotation(url, timeout = 5000) {
	let lastError = null;
	let lastResponse = null;
	let attemptCount = 0;

	for (const userAgent of CLASH_USER_AGENTS) {
		attemptCount++;
		try {
			// 为403错误添加随机延迟，避免被识别为机器人
			if (attemptCount > 1) {
				await new Promise(resolve => setTimeout(resolve, Math.random() * 1000 + 500));
			}

			const response = await fetch(url, {
				method: 'GET',
				headers: userAgent.headers,
				signal: AbortSignal.timeout(timeout)
			});

			// 记录最后一个响应（即使是错误状态码）
			lastResponse = response;

			// 如果是成功的HTTP状态码，返回响应
			if (response.ok) {
				console.log(`${userAgent.name} 请求成功: ${response.status}`);
				return {
					response,
					userAgent: userAgent.name,
					success: true
				};
			} else if (response.status === 403) {
				// 403错误特殊处理，记录但继续尝试其他User-Agent
				console.log(`${userAgent.name} 返回403禁止访问，尝试下一个User-Agent`);
				lastError = new Error(`HTTP 403 - 访问被拒绝`);
			} else {
				// 其他HTTP错误状态码，记录但继续尝试下一个User-Agent
				console.log(`${userAgent.name} 返回HTTP错误状态码: ${response.status}`);
				lastError = new Error(`HTTP ${response.status}`);
			}
		} catch (error) {
			lastError = error;
			console.log(`${userAgent.name} 网络请求失败: ${error.message}`);
			// 继续尝试下一个 User-Agent
		}
	}

	// 如果有HTTP错误响应，返回最后一个响应（用于获取准确的状态码）
	if (lastResponse && !lastResponse.ok) {
		console.log(`所有User-Agent都失败，返回最后一个响应: ${lastResponse.status}`);
		return {
			response: lastResponse,
			userAgent: 'multiple-attempts',
			success: false
		};
	}

	// 所有 User-Agent 都失败了（网络错误）
	console.log(`所有User-Agent都失败，抛出错误: ${lastError?.message || '未知错误'}`);
	throw lastError || new Error('所有请求头都失败');
}

// 智能判断是否应该拒绝订阅（取消复检机制）
async function shouldRejectSubscription(subUrl, subInfo) {
	console.log(`[DEBUG] 检查订阅: ${subUrl}, success: ${subInfo.success}, statusCode: ${subInfo.statusCode}`);

	// 1. 网络连接失败，直接拒绝
	if (!subInfo.success && (subInfo.statusCode === 0 || subInfo.statusCode === 408)) {
		console.log(`[REJECT] 网络连接失败: ${subUrl}, statusCode: ${subInfo.statusCode}`);
		return {
			reject: true,
			reason: subInfo.statusCode === 408 ? '请求超时' : '网络连接失败'
		};
	}

	// 2. 对于HTTP错误状态码，直接拒绝
	if (!subInfo.success && subInfo.statusCode > 0) {
		console.log(`[REJECT] 检测到HTTP错误状态码: ${subInfo.statusCode}，直接拒绝订阅: ${subUrl}`);
		const errorMessage = getErrorMessage(subInfo.statusCode, true);
		return {
			reject: true,
			reason: errorMessage
		};
	}

	// 3. 对于成功的请求，检查内容有效性
	if (subInfo.success) {
		console.log(`检查订阅内容有效性: ${subUrl}`);

		try {
			// 获取订阅内容
			const result = await fetchWithUserAgentRotation(subUrl, 8000);

			// 检查响应是否成功
			if (!result.success) {
				console.log(`重新获取订阅内容失败: ${subUrl}, 状态码: ${result.response?.status}`);
				return {
					reject: true,
					reason: `无法获取订阅内容 (HTTP ${result.response?.status || 'Unknown'})`
				};
			}

			const content = await result.response.text();

			// 检查内容是否为空
			if (!content || content.trim().length === 0) {
				return {
					reject: true,
					reason: '订阅内容为空'
				};
			}

			// 检查是否包含proxies字段
			if (!isValidConfigContent(content)) {
				return {
					reject: true,
					reason: '订阅内容不包含有效的proxies配置'
				};
			}

			// 进一步检查proxies块是否包含有效节点
			if (!hasValidProxiesInContent(content)) {
				return {
					reject: true,
					reason: 'proxies块中没有有效的节点配置'
				};
			}

			console.log(`订阅内容验证通过: ${subUrl}`);

		} catch (error) {
			console.log(`获取订阅内容失败: ${subUrl}, 错误: ${error.message}`);
			return {
				reject: true,
				reason: '无法获取订阅内容进行验证: ' + error.message
			};
		}
	}

	// 4. 其他情况，接受订阅
	return { reject: false };
}

// 检查内容是否像有效的配置文件
function isValidConfigContent(content) {
	if (!content || content.length < 50) {
		return false;
	}

	const lowerContent = content.toLowerCase();

	// 首先检查是否包含 proxies 特征
	const hasProxiesSection = lowerContent.includes('proxies:');

	if (!hasProxiesSection) {
		return false;
	}

	// 检查是否包含任意一种节点格式
	const nodeFormats = [
		// 节点链接格式
		'vmess://', 'vless://', 'trojan://', 'ss://', 'ssr://',
		'hysteria://', 'hysteria2://', 'hy2://', 'tuic://', 'snell://',
		'wg://', 'wireguard://', 'mieru://', 'anytls://', 'ssh://',
		'socks5://', 'http://', 'https://',

		// YAML格式节点特征 (type字段)
		'type: vmess', 'type: vless', 'type: trojan', 'type: ss', 'type: ssr',
		'type: hysteria', 'type: hysteria2', 'type: tuic', 'type: snell',
		'type: wireguard', 'type: mieru', 'type: anytls', 'type: ssh',
		'type: socks5', 'type: http',

		// JSON格式节点特征 ("type"字段)
		'"type": "vmess"', '"type": "vless"', '"type": "trojan"', '"type": "ss"', '"type": "ssr"',
		'"type": "hysteria"', '"type": "hysteria2"', '"type": "tuic"', '"type": "snell"',
		'"type": "wireguard"', '"type": "mieru"', '"type": "anytls"', '"type": "ssh"',
		'"type": "socks5"', '"type": "http"',

		// 常见代理配置字段组合
		'server:', 'port:', 'cipher:', 'password:', 'uuid:'
	];

	return nodeFormats.some(format => lowerContent.includes(format.toLowerCase()));
}

// 检查proxies块是否包含有效节点
function hasValidProxiesInContent(content) {
	if (!content || content.length < 50) {
		return false;
	}

	const lowerContent = content.toLowerCase();

	// 首先确保包含proxies字段
	if (!lowerContent.includes('proxies:')) {
		return false;
	}

	// 检查是否有具体的节点配置
	const validNodeIndicators = [
		// 节点链接格式
		'vmess://', 'vless://', 'trojan://', 'ss://', 'ssr://',
		'hysteria://', 'hysteria2://', 'hy2://', 'tuic://', 'snell://',
		'wg://', 'wireguard://', 'mieru://', 'anytls://', 'ssh://',
		'socks5://', 'http://', 'https://',

		// YAML格式节点特征 - 更严格的检查
		'- name:', '- type:', '- server:', '- port:',

		// JSON格式节点特征
		'"name":', '"type":', '"server":', '"port":',

		// 具体的节点类型配置
		'type: vmess', 'type: vless', 'type: trojan', 'type: ss', 'type: ssr',
		'type: hysteria', 'type: hysteria2', 'type: tuic', 'type: snell',
		'type: wireguard', 'type: mieru', 'type: anytls', 'type: ssh',
		'type: socks5', 'type: http',

		'"type": "vmess"', '"type": "vless"', '"type": "trojan"', '"type": "ss"', '"type": "ssr"',
		'"type": "hysteria"', '"type": "hysteria2"', '"type": "tuic"', '"type": "snell"',
		'"type": "wireguard"', '"type": "mieru"', '"type": "anytls"', '"type": "ssh"',
		'"type": "socks5"', '"type": "http"'
	];

	// 检查是否包含任何有效的节点配置
	const hasValidNodes = validNodeIndicators.some(indicator =>
		lowerContent.includes(indicator.toLowerCase())
	);

	if (!hasValidNodes) {
		return false;
	}

	// 额外检查：确保不是空的proxies块
	// 查找proxies:后的内容
	const proxiesIndex = lowerContent.indexOf('proxies:');
	if (proxiesIndex !== -1) {
		const afterProxies = content.substring(proxiesIndex + 8).trim();

		// 检查是否为空数组或空块
		if (afterProxies.startsWith('[]') ||
			afterProxies.startsWith('{}') ||
			afterProxies.match(/^\s*$/)) {
			return false;
		}

		// 检查是否只包含注释或空行
		const lines = afterProxies.split('\n').slice(0, 10); // 检查前10行
		const hasContent = lines.some(line => {
			const trimmed = line.trim();
			return trimmed && !trimmed.startsWith('#') && !trimmed.startsWith('//');
		});

		if (!hasContent) {
			return false;
		}
	}

	return true;
}

// 获取错误信息
function getErrorMessage(statusCode, success) {
	if (!success) {
		return '网络连接失败或超时';
	}

	switch (statusCode) {
		case 400:
			return '请求格式错误 (400)';
		case 401:
			return '未授权访问 (401)';
		case 403:
			return '访问被禁止 (403)';
		case 404:
			return '订阅链接不存在 (404)';
		case 405:
			return '请求方法不允许 (405)';
		case 408:
			return '请求超时 (408)';
		case 429:
			return '请求过于频繁 (429)';
		case 500:
			return '服务器内部错误 (500)';
		case 502:
			return '网关错误 (502)';
		case 503:
			return '服务不可用 (503)';
		case 504:
			return '网关超时 (504)';
		case 520:
			return 'Cloudflare 未知错误 (520)';
		case 521:
			return '服务器拒绝连接 (521)';
		case 522:
			return '连接超时 (522)';
		case 523:
			return '源服务器不可达 (523)';
		case 524:
			return '源服务器超时 (524)';
		default:
			return `HTTP错误 (${statusCode})`;
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

// 批量删除订阅
async function batchDeleteSubscriptions(indexes, env) {
	try {
		const subscriptions = JSON.parse(await env.CLASH_KV?.get('subscriptions') || '[]');
		const subscriptionNames = JSON.parse(await env.CLASH_KV?.get('subscription_names') || '[]');

		// 按索引降序排序，从后往前删除，避免索引错位
		const sortedIndexes = indexes.sort((a, b) => b - a);

		// 验证索引有效性
		for (const index of sortedIndexes) {
			if (index < 0 || index >= subscriptions.length) {
				return new Response(JSON.stringify({ error: '无效的订阅索引' }), {
					status: 400,
					headers: { 'Content-Type': 'application/json' }
				});
			}
		}

		// 删除订阅和对应的名称
		for (const index of sortedIndexes) {
			subscriptions.splice(index, 1);
			if (index < subscriptionNames.length) {
				subscriptionNames.splice(index, 1);
			}
		}

		await env.CLASH_KV?.put('subscriptions', JSON.stringify(subscriptions));
		await env.CLASH_KV?.put('subscription_names', JSON.stringify(subscriptionNames));

		return new Response(JSON.stringify({
			success: true,
			deletedCount: indexes.length,
			remainingCount: subscriptions.length
		}), {
			headers: { 'Content-Type': 'application/json' }
		});
	} catch (error) {
		return new Response(JSON.stringify({ error: '批量删除订阅失败' }), {
			status: 500,
			headers: { 'Content-Type': 'application/json' }
		});
	}
}

// 更新订阅名称
async function updateSubscriptionName(index, newName, env) {
	try {
		const subscriptions = JSON.parse(await env.CLASH_KV?.get('subscriptions') || '[]');
		const subscriptionNames = JSON.parse(await env.CLASH_KV?.get('subscription_names') || '[]');

		// 验证索引
		if (index < 0 || index >= subscriptions.length) {
			return new Response(JSON.stringify({ error: '无效的订阅索引' }), {
				status: 400,
				headers: { 'Content-Type': 'application/json' }
			});
		}

		// 验证新名称
		if (!newName || newName.trim() === '') {
			return new Response(JSON.stringify({ error: '订阅名称不能为空' }), {
				status: 400,
				headers: { 'Content-Type': 'application/json' }
			});
		}

		// 更新名称
		subscriptionNames[index] = newName.trim();

		// 保存更新后的名称
		await env.CLASH_KV?.put('subscription_names', JSON.stringify(subscriptionNames));

		return new Response(JSON.stringify({
			success: true,
			message: '订阅名称更新成功'
		}), {
			headers: { 'Content-Type': 'application/json' }
		});
	} catch (error) {
		return new Response(JSON.stringify({ error: '更新订阅名称失败' }), {
			status: 500,
			headers: { 'Content-Type': 'application/json' }
		});
	}
}

// 生成特定节点集合的配置
async function generateProxyCollectionConfig(collectionId, env) {
	try {
		const collections = await getProxyCollections(env);
		const collection = collections.find(c => c.id === collectionId);

		if (!collection) {
			return new Response('节点集合不存在', { status: 404 });
		}

		const proxies = collection.proxies;

		if (proxies.length === 0) {
			return new Response('节点集合为空', { status: 400 });
		}

		// 对节点进行排序 - 使用统一的排序逻辑
		sortProxiesByRegion(proxies);

		const config = {
			// proxysub-节点集合
			// port: 7890,
			// 'socks-port': 7891,
			// 'redir-port': 7892,
			// 'mixed-port': 7897,
			// 'tproxy-port': 7894,
			// 'allow-lan': true,
			// 'bind-address': '*',
			// 'unified-delay': true,
			// 'tcp-concurrent': true,
			// 'log-level': 'info',
			// 'find-process-mode': 'off',
			// 'global-client-fingerprint': 'chrome',
			// 'keep-alive-idle': 600,
			// 'keep-alive-interval': 15,
			// 'disable-keep-alive': false,
			// profile: {
			// 	'store-selected': true,
			// 	'store-fake-ip': true
			// },
			// mode: 'rule',
			// 'geodata-mode': false,
			// 'geodata-loader': 'standard',
			// 'geo-auto-update': true,
			// 'geo-update-interval': 24,

			// 嗅探配置
			// sniffer: {
			// 	enable: true,
			// 	'force-dns-mapping': true,
			// 	'parse-pure-ip': true,
			// 	'override-destination': true,
			// 	sniff: {
			// 		HTTP: {
			// 			ports: [80, '8080-8880'],
			// 			'override-destination': true
			// 		},
			// 		TLS: {
			// 			ports: [443, 8443]
			// 		},
			// 		QUIC: {
			// 			ports: [443, 8443]
			// 		}
			// 	},
			// 	'force-domain': ['+.v2ex.com'],
			// 	'skip-domain': ['+.baidu.com', 'Mijia.Cloud.com'],
			// 	'skip-src-address': ['192.168.0.3/32'],
			// 	'skip-dst-address': ['192.168.0.3/32']
			// },

			// 入站配置
			// tun : {
			// 	enable: true,
			// 	stack: 'mixed',
			// 	'dns-hijack': ['any:53', 'tcp://any:53'],
			// 	'auto-route': true,
			// 	'auto-redirect': true,
			// 	'auto-detect-interface': true,
			// 	device: 'utun0',
			// 	mtu: 1500,
			// 	'strict-route': true,
			// 	gso: true,
			// 	'gso-max-size': 65536,
			// 	'udp-timeout': 300,
			// 	'endpoint-independent-nat': false
			// },

			// DNS模块
			dns: {
				enable: true,
				listen: '[::]:1053',
				ipv6: true,
				'respect-rules': true,
				'enhanced-mode': 'fake-ip',
				'fake-ip-range': '198.18.0.1/16',
				nameserver: [
					'https://8.8.8.8/dns-query#disable-ipv6=true',
					'https://1.1.1.1/dns-query#disable-ipv6=true',
				],
				'proxy-server-nameserver': [
					'https://223.5.5.5/dns-query',
					'https://1.12.12.12/dns-query',
				],
				'nameserver-policy': {
					// '+.ddnsdomain.xyz': '114.114.114.114',
					'rule-set:cn_domain': [
						'https://223.5.5.5/dns-query',
						'https://1.12.12.12/dns-query',
					]
				}
			},

			// 节点配置
			proxies: proxies,

			// 节点集合代理组
			'proxy-groups': [
				{
					name: '节点选择',
					type: 'select',
					proxies: [...proxies.map(p => p.name), 'DIRECT'],
					icon: 'https://cdn.jsdelivr.net/gh/Koolson/Qure@master/IconSet/Color/Proxy.png'
				},
				{
					name: 'AI服务',
					type: 'select',
					proxies: ['节点选择', ...proxies.map(p => p.name), 'DIRECT'],
					icon: 'https://cdn.jsdelivr.net/gh/Koolson/Qure@master/IconSet/Color/ChatGPT.png'
				},
				{
					name: 'Linux DO',
					type: 'select',
					proxies: ['DIRECT', '节点选择'],
					icon: 'https://github.com/redf1rst/clash-sub/blob/main/img/linux-do.png?raw=true'
				},
				{
					name: '微软服务',
					type: 'select',
					proxies: ['节点选择', 'DIRECT'],
					icon: 'https://cdn.jsdelivr.net/gh/Koolson/Qure@master/IconSet/Color/Microsoft.png'
				},
				{
					name: '苹果服务',
					type: 'select',
					proxies: ['DIRECT', '节点选择'],
					icon: 'https://cdn.jsdelivr.net/gh/Koolson/Qure@master/IconSet/Color/Apple.png'
				},
				// {
				// 	name: 'Local',
				// 	type: 'select',
				// 	proxies: ['DIRECT', '节点选择'],
				// }
			],

			// 规则提供者配置 - 参照clash.yaml
			'rule-providers': {
				private_domain: {
					type: 'http',
					interval: 3600,
					behavior: 'domain',
					format: 'mrs',
					proxy: '节点选择',
					url: 'https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite/private.mrs',
					path: './ruleset/private_domain.mrs'
				},
				ai: {
					type: 'http',
					interval: 3600,
					behavior: 'domain',
					format: 'mrs',
					proxy: '节点选择',
					url: 'https://github.com/MetaCubeX/meta-rules-dat/raw/refs/heads/meta/geo/geosite/category-ai-!cn.mrs',
					path: './ruleset/ai.mrs'
				},
				youtube_domain: {
					type: 'http',
					interval: 3600,
					behavior: 'domain',
					format: 'mrs',
					proxy: '节点选择',
					url: 'https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite/youtube.mrs',
					path: './ruleset/youtube_domain.mrs'
				},
				google_domain: {
					type: 'http',
					interval: 3600,
					behavior: 'domain',
					format: 'mrs',
					proxy: '节点选择',
					url: 'https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite/google.mrs',
					path: './ruleset/google_domain.mrs'
				},
				github_domain: {
					type: 'http',
					interval: 3600,
					behavior: 'domain',
					format: 'mrs',
					proxy: '节点选择',
					url: 'https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite/github.mrs',
					path: './ruleset/github_domain.mrs'
				},
				telegram_domain: {
					type: 'http',
					interval: 3600,
					behavior: 'domain',
					format: 'mrs',
					proxy: '节点选择',
					url: 'https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite/telegram.mrs',
					path: './ruleset/telegram_domain.mrs'
				},
				netflix_domain: {
					type: 'http',
					interval: 3600,
					behavior: 'domain',
					format: 'mrs',
					proxy: '节点选择',
					url: 'https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite/netflix.mrs',
					path: './ruleset/netflix_domain.mrs'
				},
				paypal_domain: {
					type: 'http',
					interval: 3600,
					behavior: 'domain',
					format: 'mrs',
					proxy: '节点选择',
					url: 'https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite/paypal.mrs',
					path: './ruleset/paypal_domain.mrs'
				},
				onedrive_domain: {
					type: 'http',
					interval: 3600,
					behavior: 'domain',
					format: 'mrs',
					proxy: '节点选择',
					url: 'https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite/onedrive.mrs',
					path: './ruleset/onedrive_domain.mrs'
				},
				microsoft_domain: {
					type: 'http',
					interval: 3600,
					behavior: 'domain',
					format: 'mrs',
					proxy: '节点选择',
					url: 'https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite/microsoft.mrs',
					path: './ruleset/microsoft_domain.mrs'
				},
				apple_domain: {
					type: 'http',
					interval: 3600,
					behavior: 'domain',
					format: 'mrs',
					proxy: '节点选择',
					url: 'https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite/apple-cn.mrs',
					path: './ruleset/apple_domain.mrs'
				},
				speedtest_domain: {
					type: 'http',
					interval: 3600,
					behavior: 'domain',
					format: 'mrs',
					proxy: '节点选择',
					url: 'https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite/ookla-speedtest.mrs',
					path: './ruleset/speedtest_domain.mrs'
				},
				tiktok_domain: {
					type: 'http',
					interval: 3600,
					behavior: 'domain',
					format: 'mrs',
					proxy: '节点选择',
					url: 'https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite/tiktok.mrs',
					path: './ruleset/tiktok_domain.mrs'
				},
				spotify_domain: {
					type: 'http',
					interval: 3600,
					behavior: 'domain',
					format: 'mrs',
					proxy: '节点选择',
					url: 'https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite/spotify.mrs',
					path: './ruleset/spotify_domain.mrs'
				},
				gfw_domain: {
					type: 'http',
					interval: 3600,
					behavior: 'domain',
					format: 'mrs',
					proxy: '节点选择',
					url: 'https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite/gfw.mrs',
					path: './ruleset/gfw_domain.mrs'
				},
				'geolocation-!cn': {
					type: 'http',
					interval: 3600,
					behavior: 'domain',
					format: 'mrs',
					proxy: '节点选择',
					url: 'https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite/geolocation-!cn.mrs',
					path: './ruleset/geolocation-!cn.mrs'
				},
				cn_domain: {
					type: 'http',
					interval: 3600,
					behavior: 'domain',
					format: 'mrs',
					proxy: '节点选择',
					url: 'https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite/cn.mrs',
					path: './ruleset/cn_domain.mrs'
				},
				// MetaCubeX 提供的通用 IP 规则集
				cn_ip: {
					type: 'http',
					interval: 3600,
					behavior: 'ipcidr',
					format: 'mrs',
					proxy: '节点选择',
					url: 'https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geoip/cn.mrs',
					path: './ruleset/cn_ip.mrs'
				},
				google_ip: {
					type: 'http',
					interval: 3600,
					behavior: 'ipcidr',
					format: 'mrs',
					proxy: '节点选择',
					url: 'https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geoip/google.mrs',
					path: './ruleset/google_ip.mrs'
				},
				telegram_ip: {
					type: 'http',
					interval: 3600,
					behavior: 'ipcidr',
					format: 'mrs',
					proxy: '节点选择',
					url: 'https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geoip/telegram.mrs',
					path: './ruleset/telegram_ip.mrs'
				},
				netflix_ip: {
					type: 'http',
					interval: 3600,
					behavior: 'ipcidr',
					format: 'mrs',
					proxy: '节点选择',
					url: 'https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geoip/netflix.mrs',
					path: './ruleset/netflix_ip.mrs'
				},
				// blackmatrix7 提供的补充规则集
				ChinaMedia: {
					type: 'http',
					behavior: 'classical',
					interval: 3600,
					format: 'yaml',
					proxy: '节点选择',
					url: 'https://raw.githubusercontent.com/blackmatrix7/ios_rule_script/master/rule/Clash/ChinaMedia/ChinaMedia.yaml',
					path: './ruleset/ChinaMedia.yaml'
				},
				LAN: {
					type: 'http',
					behavior: 'classical',
					interval: 3600,
					format: 'yaml',
					proxy: '节点选择',
					url: 'https://raw.githubusercontent.com/blackmatrix7/ios_rule_script/master/rule/Clash/Lan/Lan.yaml',
					path: './ruleset/LAN.yaml'
				},
				China: {
					type: 'http',
					behavior: 'classical',
					interval: 3600,
					format: 'yaml',
					proxy: '节点选择',
					url: 'https://raw.githubusercontent.com/blackmatrix7/ios_rule_script/refs/heads/master/rule/Clash/ChinaMax/ChinaMax_Classical.yaml',
					path: './ruleset/China.yaml'
				},
				// 其他作者提供的规则集，使用 CDN 加速并指定代理以确保下载
				Private: {
					type: 'http',
					interval: 3600,
					behavior: 'domain',
					format: 'mrs',
					proxy: '节点选择',
					url: 'https://cdn.jsdmirror.com/gh/MetaCubeX/meta-rules-dat@meta/geo/geosite/private.mrs',
					path: './ruleset/Private.mrs'
				},
				Fakeip_Filter: {
					type: 'http',
					interval: 3600,
					behavior: 'domain',
					format: 'mrs',
					proxy: '节点选择',
					url: 'https://cdn.jsdmirror.com/gh/DustinWin/ruleset_geodata@mihomo-ruleset/fakeip-filter.mrs',
					path: './ruleset/Fakeip_Filter.mrs'
				},
				STUN: {
					type: 'http',
					interval: 3600,
					behavior: 'domain',
					format: 'mrs',
					proxy: '节点选择',
					url: 'https://cdn.jsdmirror.com/gh/Kwisma/rules@main/rules/mihomo/STUN/STUN_Domain.mrs',
					path: './ruleset/STUN.mrs'
				},
				CNcidr: {
					type: 'http',
					interval: 3600,
					behavior: 'ipcidr',
					format: 'mrs',
					proxy: '节点选择',
					url: 'https://cdn.jsdmirror.com/gh/Kwisma/clash-rules@release/cncidr.mrs',
					path: './ruleset/CNcidr.mrs'
				},
				// reject_non_ip_no_drop: {
				// 	type: 'http',
				// 	behavior: 'classical',
				// 	interval: 43200,
				// 	format: 'text',
				// 	proxy: '节点选择',
				// 	url: 'https://ruleset.skk.moe/Clash/non_ip/reject-no-drop.txt',
				// 	path: './ruleset/reject_non_ip_no_drop.txt'
				// },
				// reject_non_ip_drop: {
				// 	type: 'http',
				// 	behavior: 'classical',
				// 	interval: 43200,
				// 	format: 'text',
				// 	proxy: '节点选择',
				// 	url: 'https://ruleset.skk.moe/Clash/non_ip/reject-drop.txt',
				// 	path: './ruleset/reject_non_ip_drop.txt'
				// },
				// reject_non_ip: {
				// 	type: 'http',
				// 	behavior: 'classical',
				// 	interval: 43200,
				// 	format: 'text',
				// 	proxy: '节点选择',
				// 	url: 'https://ruleset.skk.moe/Clash/non_ip/reject.txt',
				// 	path: './ruleset/reject_non_ip.txt'
				// },
				// reject_domainset: {
				// 	type: 'http',
				// 	behavior: 'domain',
				// 	interval: 43200,
				// 	format: 'text',
				// 	proxy: '节点选择',
				// 	url: 'https://ruleset.skk.moe/Clash/domainset/reject.txt',
				// 	path: './ruleset/reject_domainset.txt'
				// },
				// reject_extra_domainset: {
				// 	type: 'http',
				// 	behavior: 'domain',
				// 	interval: 43200,
				// 	format: 'text',
				// 	proxy: '节点选择',
				// 	url: 'https://ruleset.skk.moe/Clash/domainset/reject_extra.txt',
				// 	path: './ruleset/reject_domainset_extra.txt'
				// },
				// reject_ip: {
				// 	type: 'http',
				// 	behavior: 'classical',
				// 	interval: 43200,
				// 	format: 'text',
				// 	proxy: '节点选择',
				// 	url: 'https://ruleset.skk.moe/Clash/ip/reject.txt',
				// 	path: './ruleset/reject_ip.txt'
				// },
				'Advertising-ads': {
					type: 'http',
					interval: 3600,
					behavior: 'domain',
					format: 'mrs',
					proxy: '节点选择',
					url: 'https://cdn.jsdmirror.com/gh/TG-Twilight/AWAvenue-Ads-Rule@main/Filters/AWAvenue-Ads-Rule-Clash.mrs',
					path: './ruleset/Advertising-ads.mrs'
				}
			},

			// 规则配置
			rules: [
				// 自定义优先规则
				'DOMAIN-SUFFIX,linux.do,Linux DO',
				'DOMAIN-SUFFIX,idcflare.com,Linux DO',
				'DOMAIN-SUFFIX,anyrouter.top,DIRECT',
				'DOMAIN-SUFFIX,elysia.h-e.top,DIRECT',
				'DOMAIN-SUFFIX,b4u.qzz.io,DIRECT',
				'DOMAIN-SUFFIX,leaflow.net,DIRECT',
				'DOMAIN-SUFFIX,cloudflare.com,节点选择',
				'DOMAIN-SUFFIX,github.com,节点选择',
				'DOMAIN-SUFFIX,githubusercontent.com,节点选择',
				'RULE-SET,github_domain,节点选择',
				'DOMAIN-SUFFIX,adobe.io,REJECT',
				'DOMAIN-SUFFIX,adobestats.io,REJECT',
				'DOMAIN-SUFFIX,bilibili.com,DIRECT',
				'DOMAIN-SUFFIX,cdn.bcebos.com,DIRECT',
				'RULE-SET,Advertising-ads,REJECT',
				// 内网
				'RULE-SET,Private,DIRECT',
				'RULE-SET,Fakeip_Filter,DIRECT',

				// 特定服务规则
				'RULE-SET,ai,AI服务',
				'DOMAIN-SUFFIX,codebuddy.ai,AI服务',
				'RULE-SET,youtube_domain,节点选择',
				'RULE-SET,google_domain,AI服务',
				'RULE-SET,onedrive_domain,微软服务',
				'RULE-SET,microsoft_domain,微软服务',
				'RULE-SET,tiktok_domain,节点选择',
				'RULE-SET,telegram_domain,节点选择',
				'RULE-SET,spotify_domain,节点选择',
				'RULE-SET,netflix_domain,节点选择',
				'RULE-SET,paypal_domain,节点选择',
				'RULE-SET,apple_domain,苹果服务',
				'RULE-SET,speedtest_domain,节点选择',
				// 通用国内/国外流量
				'RULE-SET,gfw_domain,节点选择',
				'RULE-SET,geolocation-!cn,节点选择',
				// IP 规则
				'RULE-SET,CNcidr,DIRECT',
				'RULE-SET,cn_ip,DIRECT',
				'RULE-SET,google_ip,节点选择,no-resolve',
				'RULE-SET,netflix_ip,节点选择,no-resolve',
				'RULE-SET,telegram_ip,节点选择,no-resolve',
				// 国内域名
				'RULE-SET,cn_domain,DIRECT',
				'RULE-SET,ChinaMedia,DIRECT',
				'RULE-SET,China,DIRECT',
				// CDN
				'DOMAIN-SUFFIX,cdn.jsdmirror.com,节点选择',
				'DOMAIN-SUFFIX,raw.githubusercontent.com,节点选择',
				'DOMAIN-SUFFIX,cdn.jsdelivr.net,节点选择',
				'DOMAIN-SUFFIX,cdnjs.cloudflare.com,节点选择',
				'DOMAIN-SUFFIX,gstatic.com,节点选择',

				// 特殊协议和端口拦截
				// 'DST-PORT,3478,REJECT', // STUN 端口
				// 'DST-PORT,53,REJECT', // DNS 端口，防止DNS泄漏
				// 'DST-PORT,6881-6889,REJECT', // BitTorrent 端口
				// 拦截
				// 'RULE-SET,reject_ip,REJECT',
				// 'RULE-SET,reject_non_ip,REJECT',
				// 'RULE-SET,reject_domainset,REJECT',
				// 'RULE-SET,reject_extra_domainset,REJECT',
				// 'RULE-SET,reject_non_ip_drop,REJECT-DROP',
				// 'RULE-SET,reject_non_ip_no_drop,REJECT',

				// Local
				'IP-CIDR,127.0.0.0/8,DIRECT',
				'IP-CIDR,172.16.0.0/12,DIRECT',
				'IP-CIDR,192.168.0.0/16,DIRECT',
				'IP-CIDR,10.0.0.0/8,DIRECT',
				'IP-CIDR,17.0.0.0/8,DIRECT',
				'IP-CIDR,100.64.0.0/10,DIRECT',
				'IP-CIDR,224.0.0.0/24,DIRECT',
				//'RULE-SET,LAN,DIRECT',

				// CN
				'DOMAIN-SUFFIX,cn,DIRECT',
				'DOMAIN-KEYWORD,-cn,DIRECT',
				'GEOIP,CN,DIRECT',

				// 兜底规则
				'MATCH,节点选择'
			]
		};

		const yamlContent = convertToYAML(config);

		return new Response(yamlContent, {
			headers: {
				'Content-Type': 'text/yaml; charset=utf-8',
				'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(collection.name)}`,
				'profile-update-interval': '12'
			}
		});
	} catch (error) {
		return new Response('生成配置失败', { status: 500 });
	}
}

// 生成特定订阅集合的配置
async function generateSubCollectionConfig(collectionId, env) {
	try {
		const collections = await getSubCollections(env);
		const collection = collections.find(c => c.id === collectionId);

		if (!collection) {
			return new Response('订阅集合不存在', { status: 404 });
		}

		const subscriptions = collection.subscriptions;
		const subscriptionNames = collection.subscriptionNames;

		if (subscriptions.length === 0) {
			return new Response('订阅集合为空', { status: 400 });
		}

		// 对订阅进行排序
		const subscriptionPairs = subscriptions.map((url, index) => ({
			url: url,
			name: subscriptionNames[index] || `provider${index + 1}`,
			index: index
		}));

		subscriptionPairs.sort((a, b) => {
			const extractBaseName = (fullName) => {
				const baseNameMatch = fullName.match(/^([^[\(]+?)(?:\s*\[.*?\])?(?:\s*\(.*?\))?$/);
				return baseNameMatch ? baseNameMatch[1].trim() : fullName;
			};

			const baseNameA = extractBaseName(a.name);
			const baseNameB = extractBaseName(b.name);

			const matchA = baseNameA.match(/^订阅(\d{2})$/);
			const matchB = baseNameB.match(/^订阅(\d{2})$/);

			if (matchA && matchB) {
				const numberA = parseInt(matchA[1]);
				const numberB = parseInt(matchB[1]);
				return numberA - numberB;
			}

			return baseNameA.localeCompare(baseNameB);
		});

		const sortedSubscriptions = subscriptionPairs.map(pair => pair.url);

		// 根据 submerge-config.yaml 格式构建配置
		const config = {};

		// 全局规则
		// config.port = 7890;
		// config['socks-port'] = 7891;
		// config['redir-port'] = 7892;
		// config['mixed-port'] = 7897;
		// config['tproxy-port'] = 7894;
		// config['allow-lan'] = true;
		// config['bind-address'] = '*';
		// config['unified-delay'] = true;
		// config['tcp-concurrent'] = true;
		// config['log-level'] = 'info';
		// config['find-process-mode'] = 'off';
		// config['global-client-fingerprint'] = 'chrome';
		// config['keep-alive-idle'] = 600;
		// config['keep-alive-interval'] = 15;
		// config['disable-keep-alive'] = false;
		// config.profile = {
		// 	'store-selected': true,
		// 	'store-fake-ip': true
		// };
		// config.mode = 'rule';
		// config['geodata-mode'] = false;
		// config['geodata-loader'] = 'standard';
		// config['geo-auto-update'] = true;
		// config['geo-update-interval'] = 24;

		// 嗅探配置
		// config.sniffer = {
		// 	enable: true,
		// 	'force-dns-mapping': true,
		// 	'parse-pure-ip': true,
		// 	'override-destination': true,
		// 	sniff: {
		// 		HTTP: {
		// 			ports: [80, '8080-8880'],
		// 			'override-destination': true
		// 		},
		// 		TLS: {
		// 			ports: [443, 8443]
		// 		},
		// 		QUIC: {
		// 			ports: [443, 8443]
		// 		}
		// 	},
		// 	'force-domain': ['+.v2ex.com'],
		// 	'skip-domain': ['+.baidu.com', 'Mijia.Cloud.com'],
		// 	'skip-src-address': ['192.168.0.3/32'],
		// 	'skip-dst-address': ['192.168.0.3/32']
		// };

		// 入站配置
		// config.tun = {
		// 	enable: true,
		// 	stack: 'mixed',
		// 	'dns-hijack': ['any:53', 'tcp://any:53'],
		// 	'auto-route': true,
		// 	'auto-redirect': true,
		// 	'auto-detect-interface': true,
		// 	device: 'utun0',
		// 	mtu: 1500,
		// 	'strict-route': true,
		// 	gso: true,
		// 	'gso-max-size': 65536,
		// 	'udp-timeout': 300,
		// 	'endpoint-independent-nat': false
		// };

		// DNS模块
		config.dns = {
			enable: true,
			listen: '[::]:1053',
			ipv6: true,
			'respect-rules': true,
			'enhanced-mode': 'fake-ip',
			'fake-ip-range': '198.18.0.1/16',
			nameserver: [
				'https://8.8.8.8/dns-query#disable-ipv6=true',
				'https://1.1.1.1/dns-query#disable-ipv6=true',
			],
			'proxy-server-nameserver': [
				'https://223.5.5.5/dns-query',
				'https://1.12.12.12/dns-query',
			],
			'nameserver-policy': {
				// '+.ddnsdomain.xyz': '114.114.114.114',
				'rule-set:cn_domain': [
					'https://223.5.5.5/dns-query',
					'https://1.12.12.12/dns-query',
				]
			}
		};

		// 机场订阅
		config['proxy-providers'] = {};
		if (sortedSubscriptions.length > 0) {
			// 生成简化的订阅名称函数（不包含流量和到期信息）
			const generateSimpleProviderName = (subName, existingNames) => {
				let baseName = subName;

				// 如果没有获取到名称，使用默认命名
				if (!baseName) {
					// 查找可用的最小序号，填补空缺
					const usedNumbers = new Set();
					existingNames.forEach(name => {
						const match = name.match(/^订阅(\d{2})$/);
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

				// 处理重复名称
				let finalName = baseName;
				let counter = 2;
				while (existingNames.includes(finalName)) {
					finalName = `${baseName}-${String(counter).padStart(2, '0')}`;
					counter++;
				}

				return finalName;
			};

			const usedProviderNames = [];
			subscriptionPairs.forEach((pair, index) => {
				// 从排序后的 pair 中直接获取对应的名称,确保名称和URL的对应关系
				const subscriptionName = pair.name;

				// 提取基础名称（去除流量和到期信息）
				let baseName = subscriptionName;
				if (baseName) {
					// 移除流量信息 [xxx/xxx]
					baseName = baseName.replace(/\s*\[.*?\]/g, '');
					// 移除到期信息 (xxxx-xx-xx到期)
					baseName = baseName.replace(/\s*\(.*?到期\)/g, '');
					baseName = baseName.trim();
				}

				const providerName = generateSimpleProviderName(baseName, usedProviderNames);
				usedProviderNames.push(providerName);

				const providerConfig = {
					url: pair.url,
					type: 'http',
					interval: 3600,
					'health-check': {
						enable: true,
						url: 'https://www.gstatic.com/generate_204',
						interval: 300
					},
					proxy: 'DIRECT'
				};

				// 根据集合设置决定是否添加前缀
				if (collection.enablePrefix !== false) {
					providerConfig.override = {
						'additional-prefix': `[${providerName}]`
					};
				}

				config['proxy-providers'][providerName] = providerConfig;
			});
		}

		// 出站策略
		config['proxy-groups'] = [
			{
				name: '🚀 默认代理',
				type: 'select',
				proxies: [
					'🌐 全部节点',
					'♻️ 自动选择',
					'♻️ 美国自动',
					'♻️ 日本自动',
					'♻️ 新加坡自动',
					'♻️ 台湾自动',
					'♻️ 韩国自动',
					'♻️ 香港自动',
					// '♻️ 法国自动 🇫🇷',
					// '♻️ 英国自动 🇬🇧',
					// '♻️ 澳洲自动 🇦🇺',
					// '♻️ 德国自动 🇩🇪',
					'🇺🇲 美国节点',
					'🇯🇵 日本节点',
					'🇸🇬 新加坡节点',
					'🇨🇳 台湾节点',
					'🇰🇷 韩国节点',
					'🇭🇰 香港节点',
					// '🇬🇧 英国节点',
					// '🇫🇷 法国节点',
					// '🇮🇳 印度节点',
					// '🇦🇺 澳洲节点',
					// '🇩🇪 德国节点',
					'DIRECT'
				],
				icon: 'https://cdn.jsdelivr.net/gh/Koolson/Qure@master/IconSet/Color/Proxy.png'
			},
			{
				name: '🌐 全部节点',
				type: 'select',
				'include-all': true,
				'exclude-filter': '^(?=.*((?i)10x|6x|过滤|客户端|不要|付款|如果|群|邀请|返利|循环|官网|客服|网站|网址|获取|流量|到期|下次|版本|官址|备用|过期|已用|联系|邮箱|工单|贩卖|通知|倒卖|防止|国内|地址|频道|无法|说明|使用|提示|特别|访问|支持|教程|关注|更新|建议|备用|作者|加入|\\\\b(USE|USED|TOTAL|EXPIRE|EMAIL|Panel|Channel|Author)\\\\b)).*$'
			},
			{
				name: 'AI服务',
				type: 'select',
				proxies: [
					'🚀 默认代理',
					'🌐 全部节点',
					'♻️ 自动选择',
					'♻️ 美国自动',
					'♻️ 日本自动',
					'♻️ 新加坡自动',
					'♻️ 台湾自动',
					'♻️ 韩国自动',
					// '♻️ 英国自动 🇬🇧',
					// '♻️ 法国自动 🇫🇷',
					// '♻️ 澳洲自动 🇦🇺',
					// '♻️ 德国自动 🇩🇪',
					'🇺🇲 美国节点',
					'🇯🇵 日本节点',
					'🇸🇬 新加坡节点',
					'🇨🇳 台湾节点',
					'🇰🇷 韩国节点',
					// '🇬🇧 英国节点',
					// '🇫🇷 法国节点',
					// '🇮🇳 印度节点',
					// '🇦🇺 澳洲节点',
					// '🇩🇪 德国节点',

					'DIRECT'
				],
				icon: 'https://cdn.jsdelivr.net/gh/Koolson/Qure@master/IconSet/Color/ChatGPT.png'
			},
			{
				name: 'Linux DO',
				icon: 'https://github.com/redf1rst/clash-sub/blob/main/img/linux-do.png?raw=true',
				type: 'select',
				proxies: [
					'DIRECT',
					'🚀 默认代理'
				]
			},
			{
				name: '微软服务',
				icon: 'https://cdn.jsdelivr.net/gh/Koolson/Qure@master/IconSet/Color/Microsoft.png',
				type: 'select',
				proxies: ['AI服务', 'DIRECT']
			},
			{
				name: '苹果服务',
				icon: 'https://cdn.jsdelivr.net/gh/Koolson/Qure@master/IconSet/Color/Apple.png',
				type: 'select',
				proxies: ['DIRECT', '🚀 默认代理']
			},
			// {
			// 	name: 'Local',
			// 	type: 'select',
			// 	proxies: ['DIRECT', '🚀 默认代理'],
			// },
			{
				name: '♻️ 美国自动',
				icon: 'https://fastly.jsdelivr.net/gh/clash-verge-rev/clash-verge-rev.github.io@main/docs/assets/icons/flags/us.svg',
				type: 'url-test',
				'include-all': true,
				tolerance: 80,
				interval: 120,
				filter: '^(?!.*(10x|6x))(?=.*((?i)🇺🇸|美国|波特兰|达拉斯|俄勒冈|凤凰城|费利蒙|硅谷|拉斯维加斯|洛杉矶|圣何塞|圣克拉拉|西雅图|芝加哥|\\\\b(US|United States|America)\\\\b)).*$'
			},
			{
				name: '♻️ 日本自动',
				icon: 'https://fastly.jsdelivr.net/gh/clash-verge-rev/clash-verge-rev.github.io@main/docs/assets/icons/flags/jp.svg',
				type: 'url-test',
				'include-all': true,
				tolerance: 80,
				interval: 120,
				filter: '^(?!.*(10x|6x))(?=.*((?i)🇯🇵|日本|东京|大阪|京都|名古屋|埼玉|\\\\b(JP|Japan)\\\\b)).*$'
			},
			{
				name: '♻️ 新加坡自动',
				icon: 'https://fastly.jsdelivr.net/gh/clash-verge-rev/clash-verge-rev.github.io@main/docs/assets/icons/flags/sg.svg',
				type: 'url-test',
				'include-all': true,
				tolerance: 80,
				interval: 120,
				filter: '^(?!.*(10x|6x))(?=.*((?i)🇸🇬|新加坡|新加坡|\\\\b(SG|Singapore)\\\\b)).*$'
			},
			{
				name: '♻️ 台湾自动',
				icon: 'https://fastly.jsdelivr.net/gh/clash-verge-rev/clash-verge-rev.github.io@main/docs/assets/icons/flags/cn.svg',
				type: 'url-test',
				'include-all': true,
				tolerance: 80,
				interval: 150,
				filter: '^(?!.*(10x|6x))(?=.*((?i)🇹🇼|台湾|台北|新北|高雄|\\\\b(TW|Taiwan|Tai wan)\\\\b)).*$'
			},
			{
				name: '♻️ 韩国自动',
				icon: 'https://fastly.jsdelivr.net/gh/clash-verge-rev/clash-verge-rev.github.io@main/docs/assets/icons/flags/kr.svg',
				type: 'url-test',
				'include-all': true,
				tolerance: 80,
				interval: 120,
				filter: '^(?!.*(10x|6x))(?=.*((?i)🇰🇷|韩国|韓國|首尔|釜山|\\\\b(KR|Korea)\\\\b)).*$'
			},
			{
				name: '♻️ 香港自动',
				icon: 'https://fastly.jsdelivr.net/gh/clash-verge-rev/clash-verge-rev.github.io@main/docs/assets/icons/flags/hk.svg',
				type: 'url-test',
				'include-all': true,
				tolerance: 80,
				interval: 120,
				filter: '^(?!.*(10x|6x))(?=.*((?i)🇭🇰|香港|九龙|新界|\\\\b(HK|HongKong|Hong Kong)\\\\b)).*$'
			},
			{
				name: '♻️ 自动选择',
				icon: 'https://fastly.jsdelivr.net/gh/Orz-3/mini@master/Color/Auto.png',
				type: 'url-test',
				'include-all': true,
				tolerance: 80,
				interval: 120,
				'exclude-filter': '^(?=.*((?i)10x|6x|过滤|客户端|不要|付款|如果|群|邀请|返利|循环|官网|客服|网站|网址|获取|订阅|流量|到期|机场|下次|版本|官址|备用|过期|已用|联系|邮箱|工单|贩卖|通知|倒卖|防止|国内|地址|频道|无法|说明|使用|提示|特别|访问|支持|教程|关注|更新|建议|备用|作者|加入|\\\\b(USE|USED|TOTAL|EXPIRE|EMAIL|Panel|Channel|Author)\\\\b|(\\\\d{4}-\\\\d{2}-\\\\d{2}|\\\\d+G))).*$'
			},
			// {
			// 	name: '♻️ 英国自动 🇬🇧',
			// 	type: 'url-test',
			// 	'include-all': true,
			// 	tolerance: 80,
			// 	interval: 120,
			// 	filter: '^(?!.*(10x|6x))(?=.*((?i)🇬🇧|英国|伦敦|曼彻斯特|\\\\b(UK|United Kingdom|Britain)\\\\b)).*$'
			// },
			// {
			// 	name: '♻️ 法国自动 🇫🇷',
			// 	type: 'url-test',
			// 	'include-all': true,
			// 	tolerance: 80,
			// 	interval: 120,
			// 	filter: '^(?!.*(10x|6x))(?=.*((?i)🇫🇷|法国|巴黎|马赛|\\\\b(FR|France)\\\\b)).*$'
			// },
			// {
			// 	name: '♻️ 德国自动 🇩🇪',
			// 	type: 'url-test',
			// 	'include-all': true,
			// 	tolerance: 80,
			// 	interval: 120,
			// 	filter: '^(?!.*(10x|6x))(?=.*((?i)🇩🇪|德国|柏林|法兰克福|慕尼黑|\\\\b(DE|Germany)\\\\b)).*$'
			// },
			// {
			// 	name: '♻️ 澳洲自动 🇦🇺',
			// 	type: 'url-test',
			// 	'include-all': true,
			// 	tolerance: 80,
			// 	interval: 120,
			// 	filter: '^(?!.*(10x|6x))(?=.*((?i)🇦🇺|澳大利亚|澳洲|悉尼|墨尔本|\\\\b(AU|AUS|Australia)\\\\b)).*$'
			// },
			{
				name: '🇺🇲 美国节点',
				type: 'select',
				'include-all': true,
				filter: '^(?!.*(10x|6x))(?=.*((?i)🇺🇸|美国|波特兰|达拉斯|俄勒冈|凤凰城|费利蒙|硅谷|拉斯维加斯|洛杉矶|圣何塞|圣克拉拉|西雅图|芝加哥|\\\\b(US|United States|America)\\\\b)).*$'
			},
			{
				name: '🇯🇵 日本节点',
				type: 'select',
				'include-all': true,
				filter: '^(?!.*(10x|6x))(?=.*((?i)🇯🇵|日本|东京|大阪|京都|名古屋|埼玉|\\\\b(JP|Japan)\\\\b)).*$'
			},
			{
				name: '🇸🇬 新加坡节点',
				type: 'select',
				'include-all': true,
				filter: '^(?!.*(10x|6x))(?=.*((?i)🇸🇬|新加坡|新加坡|\\\\b(SG|Singapore)\\\\b)).*$'
			},
			{
				name: '🇨🇳 台湾节点',
				type: 'select',
				'include-all': true,
				filter: '^(?!.*(10x|6x))(?=.*((?i)🇹🇼|台湾|台北|新北|高雄|\\\\b(TW|Taiwan|Tai wan)\\\\b)).*$'
			},
			{
				name: '🇰🇷 韩国节点',
				type: 'select',
				'include-all': true,
				filter: '^(?!.*(10x|6x))(?=.*((?i)🇰🇷|韩国|韓國|首尔|釜山|\\\\b(KR|Korea)\\\\b)).*$'
			},
			{
				name: '🇭🇰 香港节点',
				type: 'select',
				'include-all': true,
				filter: '^(?!.*(10x|6x))(?=.*((?i)🇭🇰|香港|九龙|新界|\\\\b(HK|HongKong|Hong Kong)\\\\b)).*$'
			}
			// {
			// 	name: '🇬🇧 英国节点',
			// 	type: 'select',
			// 	'include-all': true,
			// 	filter: '^(?!.*(10x|6x))(?=.*((?i)🇬🇧|英国|伦敦|曼彻斯特|\\\\b(UK|United Kingdom|Britain)\\\\b)).*$'
			// },
			// {
			// 	name: '🇫🇷 法国节点',
			// 	type: 'select',
			// 	'include-all': true,
			// 	filter: '^(?!.*(10x|6x))(?=.*((?i)🇫🇷|法国|巴黎|马赛|\\\\b(FR|France)\\\\b)).*$'
			// },
			// {
			// 	name: '🇩🇪 德国节点',
			// 	type: 'select',
			// 	'include-all': true,
			// 	filter: '^(?!.*(10x|6x))(?=.*((?i)🇩🇪|德国|柏林|法兰克福|慕尼黑|\\\\b(DE|Germany)\\\\b)).*$'
			// },
			// {
			// 	name: '🇦🇺 澳洲节点',
			// 	type: 'select',
			// 	'include-all': true,
			// 	filter: '^(?!.*(10x|6x))(?=.*((?i)🇦🇺|澳大利亚|澳洲|悉尼|墨尔本|\\\\b(AU|AUS|Australia)\\\\b)).*$'
			// },
			// {
			// 	name: '🇮🇳 印度节点',
			// 	type: 'select',
			// 	'include-all': true,
			// 	filter: '^(?!.*(10x|6x))(?=.*((?i)🇮🇳|印度|\\\\b(India|IN)\\\\b)).*$'
			// }
		];

		// 规则集
		config['rule-providers'] = {
			// MetaCubeX 提供的通用域名规则集
			private_domain: {
				type: 'http',
				interval: 3600,
				behavior: 'domain',
				format: 'mrs',
				proxy: '🚀 默认代理',
				url: 'https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite/private.mrs',
				path: './ruleset/private_domain.mrs'
			},
			ai: {
				type: 'http',
				interval: 3600,
				behavior: 'domain',
				format: 'mrs',
				proxy: '🚀 默认代理',
				url: 'https://github.com/MetaCubeX/meta-rules-dat/raw/refs/heads/meta/geo/geosite/category-ai-!cn.mrs',
				path: './ruleset/ai.mrs'
			},
			youtube_domain: {
				type: 'http',
				interval: 3600,
				behavior: 'domain',
				format: 'mrs',
				proxy: '🚀 默认代理',
				url: 'https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite/youtube.mrs',
				path: './ruleset/youtube_domain.mrs'
			},
			google_domain: {
				type: 'http',
				interval: 3600,
				behavior: 'domain',
				format: 'mrs',
				proxy: '🚀 默认代理',
				url: 'https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite/google.mrs',
				path: './ruleset/google_domain.mrs'
			},
			github_domain: {
				type: 'http',
				interval: 3600,
				behavior: 'domain',
				format: 'mrs',
				proxy: '🚀 默认代理',
				url: 'https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite/github.mrs',
				path: './ruleset/github_domain.mrs'
			},
			telegram_domain: {
				type: 'http',
				interval: 3600,
				behavior: 'domain',
				format: 'mrs',
				proxy: '🚀 默认代理',
				url: 'https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite/telegram.mrs',
				path: './ruleset/telegram_domain.mrs'
			},
			netflix_domain: {
				type: 'http',
				interval: 3600,
				behavior: 'domain',
				format: 'mrs',
				proxy: '🚀 默认代理',
				url: 'https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite/netflix.mrs',
				path: './ruleset/netflix_domain.mrs'
			},
			paypal_domain: {
				type: 'http',
				interval: 3600,
				behavior: 'domain',
				format: 'mrs',
				proxy: '🚀 默认代理',
				url: 'https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite/paypal.mrs',
				path: './ruleset/paypal_domain.mrs'
			},
			onedrive_domain: {
				type: 'http',
				interval: 3600,
				behavior: 'domain',
				format: 'mrs',
				proxy: '🚀 默认代理',
				url: 'https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite/onedrive.mrs',
				path: './ruleset/onedrive_domain.mrs'
			},
			microsoft_domain: {
				type: 'http',
				interval: 3600,
				behavior: 'domain',
				format: 'mrs',
				proxy: '🚀 默认代理',
				url: 'https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite/microsoft.mrs',
				path: './ruleset/microsoft_domain.mrs'
			},
			apple_domain: {
				type: 'http',
				interval: 3600,
				behavior: 'domain',
				format: 'mrs',
				proxy: '🚀 默认代理',
				url: 'https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite/apple-cn.mrs',
				path: './ruleset/apple_domain.mrs'
			},
			speedtest_domain: {
				type: 'http',
				interval: 3600,
				behavior: 'domain',
				format: 'mrs',
				proxy: '🚀 默认代理',
				url: 'https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite/ookla-speedtest.mrs',
				path: './ruleset/speedtest_domain.mrs'
			},
			tiktok_domain: {
				type: 'http',
				interval: 3600,
				behavior: 'domain',
				format: 'mrs',
				proxy: '🚀 默认代理',
				url: 'https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite/tiktok.mrs',
				path: './ruleset/tiktok_domain.mrs'
			},
			spotify_domain: {
				type: 'http',
				interval: 3600,
				behavior: 'domain',
				format: 'mrs',
				proxy: '🚀 默认代理',
				url: 'https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite/spotify.mrs',
				path: './ruleset/spotify_domain.mrs'
			},
			gfw_domain: {
				type: 'http',
				interval: 3600,
				behavior: 'domain',
				format: 'mrs',
				proxy: '🚀 默认代理',
				url: 'https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite/gfw.mrs',
				path: './ruleset/gfw_domain.mrs'
			},
			'geolocation-!cn': {
				type: 'http',
				interval: 3600,
				behavior: 'domain',
				format: 'mrs',
				proxy: '🚀 默认代理',
				url: 'https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite/geolocation-!cn.mrs',
				path: './ruleset/geolocation-!cn.mrs'
			},
			cn_domain: {
				type: 'http',
				interval: 3600,
				behavior: 'domain',
				format: 'mrs',
				proxy: '🚀 默认代理',
				url: 'https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite/cn.mrs',
				path: './ruleset/cn_domain.mrs'
			},
			// MetaCubeX 提供的通用 IP 规则集
			cn_ip: {
				type: 'http',
				interval: 3600,
				behavior: 'ipcidr',
				format: 'mrs',
				proxy: '🚀 默认代理',
				url: 'https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geoip/cn.mrs',
				path: './ruleset/cn_ip.mrs'
			},
			google_ip: {
				type: 'http',
				interval: 3600,
				behavior: 'ipcidr',
				format: 'mrs',
				proxy: '🚀 默认代理',
				url: 'https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geoip/google.mrs',
				path: './ruleset/google_ip.mrs'
			},
			telegram_ip: {
				type: 'http',
				interval: 3600,
				behavior: 'ipcidr',
				format: 'mrs',
				proxy: '🚀 默认代理',
				url: 'https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geoip/telegram.mrs',
				path: './ruleset/telegram_ip.mrs'
			},
			netflix_ip: {
				type: 'http',
				interval: 3600,
				behavior: 'ipcidr',
				format: 'mrs',
				proxy: '🚀 默认代理',
				url: 'https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geoip/netflix.mrs',
				path: './ruleset/netflix_ip.mrs'
			},
			// blackmatrix7 提供的补充规则集
			ChinaMedia: {
				type: 'http',
				behavior: 'classical',
				interval: 3600,
				format: 'yaml',
				proxy: '🚀 默认代理',
				url: 'https://raw.githubusercontent.com/blackmatrix7/ios_rule_script/master/rule/Clash/ChinaMedia/ChinaMedia.yaml',
				path: './ruleset/ChinaMedia.yaml'
			},
			LAN: {
				type: 'http',
				behavior: 'classical',
				interval: 3600,
				format: 'yaml',
				proxy: '🚀 默认代理',
				url: 'https://raw.githubusercontent.com/blackmatrix7/ios_rule_script/master/rule/Clash/Lan/Lan.yaml',
				path: './ruleset/LAN.yaml'
			},
			China: {
				type: 'http',
				behavior: 'classical',
				interval: 3600,
				format: 'yaml',
				proxy: '🚀 默认代理',
				url: 'https://raw.githubusercontent.com/blackmatrix7/ios_rule_script/refs/heads/master/rule/Clash/ChinaMax/ChinaMax_Classical.yaml',
				path: './ruleset/China.yaml'
			},
			// 其他作者提供的规则集，使用 CDN 加速并指定代理以确保下载
			Private: {
				type: 'http',
				interval: 3600,
				behavior: 'domain',
				format: 'mrs',
				proxy: '🚀 默认代理',
				url: 'https://cdn.jsdmirror.com/gh/MetaCubeX/meta-rules-dat@meta/geo/geosite/private.mrs',
				path: './ruleset/Private.mrs'
			},
			Fakeip_Filter: {
				type: 'http',
				interval: 3600,
				behavior: 'domain',
				format: 'mrs',
				proxy: '🚀 默认代理',
				url: 'https://cdn.jsdmirror.com/gh/DustinWin/ruleset_geodata@mihomo-ruleset/fakeip-filter.mrs',
				path: './ruleset/Fakeip_Filter.mrs'
			},
			STUN: {
				type: 'http',
				interval: 3600,
				behavior: 'domain',
				format: 'mrs',
				proxy: '🚀 默认代理',
				url: 'https://cdn.jsdmirror.com/gh/Kwisma/rules@main/rules/mihomo/STUN/STUN_Domain.mrs',
				path: './ruleset/STUN.mrs'
			},
			CNcidr: {
				type: 'http',
				interval: 3600,
				behavior: 'ipcidr',
				format: 'mrs',
				proxy: '🚀 默认代理',
				url: 'https://cdn.jsdmirror.com/gh/Kwisma/clash-rules@release/cncidr.mrs',
				path: './ruleset/CNcidr.mrs'
			},
			// reject_non_ip_no_drop: {
			// 	type: 'http',
			// 	behavior: 'classical',
			// 	interval: 43200,
			// 	format: 'text',
			// 	proxy: '🚀 默认代理',
			// 	url: 'https://ruleset.skk.moe/Clash/non_ip/reject-no-drop.txt',
			// 	path: './ruleset/reject_non_ip_no_drop.txt'
			// },
			// reject_non_ip_drop: {
			// 	type: 'http',
			// 	behavior: 'classical',
			// 	interval: 43200,
			// 	format: 'text',
			// 	proxy: '🚀 默认代理',
			// 	url: 'https://ruleset.skk.moe/Clash/non_ip/reject-drop.txt',
			// 	path: './ruleset/reject_non_ip_drop.txt'
			// },
			// reject_non_ip: {
			// 	type: 'http',
			// 	behavior: 'classical',
			// 	interval: 43200,
			// 	format: 'text',
			// 	proxy: '🚀 默认代理',
			// 	url: 'https://ruleset.skk.moe/Clash/non_ip/reject.txt',
			// 	path: './ruleset/reject_non_ip.txt'
			// },
			// reject_domainset: {
			// 	type: 'http',
			// 	behavior: 'domain',
			// 	interval: 43200,
			// 	format: 'text',
			// 	proxy: '🚀 默认代理',
			// 	url: 'https://ruleset.skk.moe/Clash/domainset/reject.txt',
			// 	path: './ruleset/reject_domainset.txt'
			// },
			// reject_extra_domainset: {
			// 	type: 'http',
			// 	behavior: 'domain',
			// 	interval: 43200,
			// 	format: 'text',
			// 	proxy: '🚀 默认代理',
			// 	url: 'https://ruleset.skk.moe/Clash/domainset/reject_extra.txt',
			// 	path: './ruleset/reject_domainset_extra.txt'
			// },
			// reject_ip: {
			// 	type: 'http',
			// 	behavior: 'classical',
			// 	interval: 43200,
			// 	format: 'text',
			// 	proxy: '🚀 默认代理',
			// 	url: 'https://ruleset.skk.moe/Clash/ip/reject.txt',
			// 	path: './ruleset/reject_ip.txt'
			// },
			'Advertising-ads': {
				type: 'http',
				interval: 3600,
				behavior: 'domain',
				format: 'mrs',
				proxy: '🚀 默认代理',
				url: 'https://cdn.jsdmirror.com/gh/TG-Twilight/AWAvenue-Ads-Rule@main/Filters/AWAvenue-Ads-Rule-Clash.mrs',
				path: './ruleset/Advertising-ads.mrs'
			}
		};

		// submerge规则匹配
		config.rules = [
			// 自定义优先规则
			'DOMAIN-SUFFIX,linux.do,Linux DO',
			'DOMAIN-SUFFIX,idcflare.com,Linux DO',
			'DOMAIN-SUFFIX,anyrouter.top,DIRECT',
			'DOMAIN-SUFFIX,elysia.h-e.top,DIRECT',
			'DOMAIN-SUFFIX,b4u.qzz.io,DIRECT',
			'DOMAIN-SUFFIX,leaflow.net,DIRECT',
			'DOMAIN-SUFFIX,cloudflare.com,🚀 默认代理',
			'DOMAIN-SUFFIX,github.com,🚀 默认代理',
			'DOMAIN-SUFFIX,githubusercontent.com,🚀 默认代理',
			'RULE-SET,github_domain,🚀 默认代理',
			'DOMAIN-SUFFIX,adobe.io,REJECT',
			'DOMAIN-SUFFIX,adobestats.io,REJECT',
			'DOMAIN-SUFFIX,bilibili.com,DIRECT',
			'DOMAIN-SUFFIX,cdn.bcebos.com,DIRECT',
			'RULE-SET,Advertising-ads,REJECT',
			// 内网
			'RULE-SET,Private,DIRECT',
			'RULE-SET,Fakeip_Filter,DIRECT',

			// 特定服务规则
			'RULE-SET,ai,AI服务',
			'DOMAIN-SUFFIX,codebuddy.ai,AI服务',
			'RULE-SET,youtube_domain,🚀 默认代理',
			'RULE-SET,google_domain,AI服务',
			'RULE-SET,onedrive_domain,微软服务',
			'RULE-SET,microsoft_domain,微软服务',
			'RULE-SET,tiktok_domain,🚀 默认代理',
			'RULE-SET,telegram_domain,🚀 默认代理',
			'RULE-SET,spotify_domain,🚀 默认代理',
			'RULE-SET,netflix_domain,🚀 默认代理',
			'RULE-SET,paypal_domain,🚀 默认代理',
			'RULE-SET,apple_domain,苹果服务',
			'RULE-SET,speedtest_domain,🚀 默认代理',
			// 通用国内/国外流量
			'RULE-SET,gfw_domain,🚀 默认代理',
			'RULE-SET,geolocation-!cn,🚀 默认代理',
			// IP 规则
			'RULE-SET,CNcidr,DIRECT',
			'RULE-SET,cn_ip,DIRECT',
			'RULE-SET,google_ip,🚀 默认代理,no-resolve',
			'RULE-SET,netflix_ip,🚀 默认代理,no-resolve',
			'RULE-SET,telegram_ip,🚀 默认代理,no-resolve',
			// 国内域名
			'RULE-SET,cn_domain,DIRECT',
			'RULE-SET,ChinaMedia,DIRECT',
			'RULE-SET,China,DIRECT',
			// 为常用的CDN和规则集提供代理
			'DOMAIN-SUFFIX,cdn.jsdmirror.com,🚀 默认代理',
			'DOMAIN-SUFFIX,raw.githubusercontent.com,🚀 默认代理',
			'DOMAIN-SUFFIX,cdn.jsdelivr.net,🚀 默认代理',
			'DOMAIN-SUFFIX,cdnjs.cloudflare.com,🚀 默认代理',
			'DOMAIN-SUFFIX,gstatic.com,🚀 默认代理',

			// 特殊协议和端口拦截
			// 'DST-PORT,3478,REJECT', // STUN 端口
			// 'DST-PORT,53,REJECT', // DNS 端口，防止DNS泄漏
			// 'DST-PORT,6881-6889,REJECT', // BitTorrent 端口
			// 拦截
			// 'RULE-SET,reject_ip,REJECT',
			// 'RULE-SET,reject_non_ip,REJECT',
			// 'RULE-SET,reject_domainset,REJECT',
			// 'RULE-SET,reject_extra_domainset,REJECT',
			// 'RULE-SET,reject_non_ip_drop,REJECT-DROP',
			// 'RULE-SET,reject_non_ip_no_drop,REJECT',

			// Local
			'IP-CIDR,127.0.0.0/8,DIRECT',
			'IP-CIDR,172.16.0.0/12,DIRECT',
			'IP-CIDR,192.168.0.0/16,DIRECT',
			'IP-CIDR,10.0.0.0/8,DIRECT',
			'IP-CIDR,17.0.0.0/8,DIRECT',
			'IP-CIDR,100.64.0.0/10,DIRECT',
			'IP-CIDR,224.0.0.0/24,DIRECT',
			//'RULE-SET,LAN,DIRECT',

			// CN
			'DOMAIN-SUFFIX,cn,DIRECT',
			'DOMAIN-KEYWORD,-cn,DIRECT',
			'GEOIP,CN,DIRECT',

			// 兜底规则
			'MATCH,🚀 默认代理'
		];

		const yamlContent = convertToYAML(config);

		return new Response(yamlContent, {
			headers: {
				'Content-Type': 'text/yaml; charset=utf-8',
				'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(collection.name)}`,
				'profile-update-interval': '12'
			}
		});
	} catch (error) {
		return new Response('生成配置失败', { status: 500 });
	}
}


// 解析代理URL
function parseProxyUrl(url) {
	try {
		// 支持vmess, vless, ss, ssr, hysteria, hysteria2, trojan, tuic, socks5, http等协议
		if (url.startsWith('vmess://')) {
			return parseVmess(url);
		} else if (url.startsWith('vless://')) {
			return parseVless(url);
		} else if (url.startsWith('ss://')) {
			return parseShadowsocks(url);
		} else if (url.startsWith('ssr://')) {
			return parseShadowsocksR(url);
		} else if (url.startsWith('hysteria://')) {
			return parseHysteria(url);
		} else if (url.startsWith('hysteria2://') || url.startsWith('hy2://')) {
			return parseHysteria2(url);
		} else if (url.startsWith('trojan://')) {
			return parseTrojan(url);
		} else if (url.startsWith('tuic://')) {
			return parseTuic(url);
		} else if (url.startsWith('socks5://')) {
			return parseSocks5(url);
		} else if (url.startsWith('http://') || url.startsWith('https://')) {
			return parseHttp(url);
		} else if (url.startsWith('snell://')) {
			return parseSnell(url);
		} else if (url.startsWith('wg://') || url.startsWith('wireguard://')) {
			return parseWireGuard(url);
		} else if (url.startsWith('mieru://')) {
			return parseMieru(url);
		} else if (url.startsWith('anytls://')) {
			return parseAnyTLS(url);
		} else if (url.startsWith('ssh://')) {
			return parseSSH(url);
		}
		return null;
	} catch (error) {
		return null;
	}
}

// 解析VMess
function parseVmess(url) {
	const data = JSON.parse(atob(url.substring(8)));
	const config = {
		name: data.ps || 'VMess',
		type: 'vmess',
		server: formatServerAddress(data.add),
		port: parseInt(data.port),
		uuid: data.id,
		alterId: parseInt(data.aid) || 0,
		cipher: data.scy || 'auto',
		network: data.net || 'tcp',
		tls: data.tls === 'tls'
	};

	// 添加 UDP 支持
	if (data.udp !== undefined) {
		config.udp = data.udp === true || data.udp === 'true';
	}

	// 添加 IP 版本偏好
	if (data['ip-version']) {
		config['ip-version'] = data['ip-version'];
	}

	// 添加指纹配置
	if (data.fingerprint) {
		config.fingerprint = data.fingerprint;
	}

	// 添加客户端指纹
	if (data['client-fingerprint']) {
		config['client-fingerprint'] = data['client-fingerprint'];
	}

	// 添加跳过证书验证
	if (data['skip-cert-verify'] !== undefined) {
		config['skip-cert-verify'] = data['skip-cert-verify'] === true || data['skip-cert-verify'] === 'true';
	}

	// 添加 servername (SNI)
	if (data.tls === 'tls' && data.host) {
		config.servername = data.host;
	}

	// 添加 ECH 配置
	if (data['ech-opts']) {
		config['ech-opts'] = data['ech-opts'];
	}

	// 添加 Reality 配置
	if (data.tls === 'reality' || data.security === 'reality') {
		config['reality-opts'] = {};
		if (data.pbk) {
			config['reality-opts']['public-key'] = data.pbk;
		}
		if (data.sid) {
			config['reality-opts']['short-id'] = data.sid;
		}
		if (data['support-x25519mlkem768']) {
			config['reality-opts']['support-x25519mlkem768'] = data['support-x25519mlkem768'] === true || data['support-x25519mlkem768'] === 'true';
		}
	}

	// 添加 WebSocket 配置
	if (data.net === 'ws') {
		config['ws-opts'] = {};
		if (data.path) {
			config['ws-opts'].path = data.path;
		}
		if (data.host) {
			config['ws-opts'].headers = {
				Host: data.host
			};
		}
		// 添加 WebSocket 扩展配置
		if (data['max-early-data']) {
			config['ws-opts']['max-early-data'] = parseInt(data['max-early-data']);
		}
		if (data['early-data-header-name']) {
			config['ws-opts']['early-data-header-name'] = data['early-data-header-name'];
		}
		if (data['v2ray-http-upgrade'] !== undefined) {
			config['ws-opts']['v2ray-http-upgrade'] = data['v2ray-http-upgrade'] === true || data['v2ray-http-upgrade'] === 'true';
		}
		if (data['v2ray-http-upgrade-fast-open'] !== undefined) {
			config['ws-opts']['v2ray-http-upgrade-fast-open'] = data['v2ray-http-upgrade-fast-open'] === true || data['v2ray-http-upgrade-fast-open'] === 'true';
		}
	}

	// 添加 HTTP/2 配置
	if (data.net === 'h2') {
		config.network = 'h2';
		config['h2-opts'] = {};
		if (data.host) {
			// 支持多个主机
			config['h2-opts'].host = Array.isArray(data.host) ? data.host : [data.host];
		}
		if (data.path) {
			config['h2-opts'].path = data.path;
		}
	}

	// 添加 HTTP 配置
	if (data.net === 'http') {
		config['http-opts'] = {};
		if (data.method) {
			config['http-opts'].method = data.method;
		}
		if (data.path) {
			config['http-opts'].path = Array.isArray(data.path) ? data.path : [data.path];
		}
		if (data.headers) {
			config['http-opts'].headers = data.headers;
		}
	}

	// 添加 HTTP 配置
	if (data.net === 'http') {
		config.network = 'http';
		config['http-opts'] = {};
		if (data.method) {
			config['http-opts'].method = data.method;
		} else {
			config['http-opts'].method = 'GET';
		}
		if (data.path) {
			// 支持数组格式的path
			if (Array.isArray(data.path)) {
				config['http-opts'].path = data.path;
			} else {
				config['http-opts'].path = [data.path];
			}
		} else {
			config['http-opts'].path = ['/'];
		}
		if (data.headers) {
			config['http-opts'].headers = data.headers;
		}
	}

	// 添加 gRPC 配置
	if (data.net === 'grpc') {
		config['grpc-opts'] = {};
		if (data.path) {
			config['grpc-opts']['grpc-service-name'] = data.path;
		}
	}

	// 添加 VMess 特有字段
	if (data['packet-encoding']) {
		config['packet-encoding'] = data['packet-encoding'];
	}
	if (data['global-padding'] !== undefined) {
		config['global-padding'] = data['global-padding'] === true || data['global-padding'] === 'true';
	}
	if (data['authenticated-length'] !== undefined) {
		config['authenticated-length'] = data['authenticated-length'] === true || data['authenticated-length'] === 'true';
	}
	if (data.alpn) {
		config.alpn = Array.isArray(data.alpn) ? data.alpn : [data.alpn];
	}

	// 添加 SMUX 配置
	if (data.smux) {
		config.smux = data.smux;
	}

	// 添加 Brutal 配置
	if (data['brutal-opts']) {
		config['brutal-opts'] = data['brutal-opts'];
	}

	return config;
}

// 解析VLess
function parseVless(url) {
	const parsed = new URL(url);
	const params = parsed.searchParams;

	const config = {
		name: decodeURIComponent(parsed.hash.substring(1)) || 'VLess',
		type: 'vless',
		server: formatServerAddress(parsed.hostname),
		port: parseInt(parsed.port),
		uuid: parsed.username,
		network: params.get('type') || 'tcp',
		tls: params.get('security') === 'tls' || params.get('security') === 'reality'
	};

	// 添加 UDP 支持
	if (params.get('udp')) {
		config.udp = params.get('udp') === 'true' || params.get('udp') === '1';
	}

	// 添加 IP 版本偏好
	if (params.get('ip-version')) {
		config['ip-version'] = params.get('ip-version');
	}

	// 添加 flow 字段（用于 XTLS）
	if (params.get('flow')) {
		config.flow = params.get('flow');
	}

	// 添加指纹配置
	if (params.get('fingerprint')) {
		config.fingerprint = params.get('fingerprint');
	}

	// 添加客户端指纹
	if (params.get('client-fingerprint')) {
		config['client-fingerprint'] = params.get('client-fingerprint');
	}

	// 添加跳过证书验证
	if (params.get('skip-cert-verify')) {
		config['skip-cert-verify'] = params.get('skip-cert-verify') === 'true' || params.get('skip-cert-verify') === '1';
	}

	// 添加 servername (SNI)
	if (params.get('sni')) {
		config.servername = params.get('sni');
	} else if (params.get('security') === 'tls' && params.get('host')) {
		config.servername = params.get('host');
	}

	// 添加 ECH 配置
	if (params.get('ech-enable') === 'true') {
		config['ech-opts'] = {
			enable: true
		};
		if (params.get('ech-config')) {
			config['ech-opts'].config = params.get('ech-config');
		}
	}

	// 添加 Reality 配置
	if (params.get('security') === 'reality') {
		config['reality-opts'] = {};
		if (params.get('pbk')) {
			config['reality-opts']['public-key'] = params.get('pbk');
		}
		if (params.get('sid')) {
			config['reality-opts']['short-id'] = params.get('sid');
		}
		if (params.get('support-x25519mlkem768')) {
			config['reality-opts']['support-x25519mlkem768'] = params.get('support-x25519mlkem768') === 'true';
		}
	}

	// 添加 client-fingerprint
	if (params.get('fp')) {
		config['client-fingerprint'] = params.get('fp');
	} else if (config.tls) {
		config['client-fingerprint'] = 'chrome';
	}

	// 添加 WebSocket 配置
	if (params.get('type') === 'ws') {
		config['ws-opts'] = {};
		if (params.get('path')) {
			config['ws-opts'].path = decodeURIComponent(params.get('path'));
		}
		if (params.get('host')) {
			config['ws-opts'].headers = {
				Host: params.get('host')
			};
		}
		// 添加 VLess WebSocket 增强字段
		if (params.get('v2ray-http-upgrade')) {
			config['ws-opts']['v2ray-http-upgrade'] = params.get('v2ray-http-upgrade') === 'true';
		}
		if (params.get('v2ray-http-upgrade-fast-open')) {
			config['ws-opts']['v2ray-http-upgrade-fast-open'] = params.get('v2ray-http-upgrade-fast-open') === 'true';
		}
	}

	// 添加 gRPC 配置
	if (params.get('type') === 'grpc') {
		config['grpc-opts'] = {};
		if (params.get('serviceName')) {
			config['grpc-opts']['grpc-service-name'] = params.get('serviceName');
		}
	}

	// 添加 HTTP/2 配置
	if (params.get('type') === 'h2') {
		config['h2-opts'] = {};
		if (params.get('host')) {
			config['h2-opts'].host = params.get('host').split(',');
		}
		if (params.get('path')) {
			config['h2-opts'].path = params.get('path');
		}
	}

	// 添加 TCP 配置（HTTP伪装）
	if (params.get('type') === 'tcp' && params.get('headerType') === 'http') {
		config['tcp-opts'] = {
			'header': {
				'type': 'http'
			}
		};
		if (params.get('host')) {
			config['tcp-opts'].header.request = {
				'headers': {
					'Host': params.get('host').split(',')
				}
			};
		}
	}

	// 添加 skip-cert-verify
	if (params.get('insecure') === '1' || params.get('allowInsecure') === '1') {
		config['skip-cert-verify'] = true;
	}

	// 添加 ALPN
	if (params.get('alpn')) {
		config.alpn = decodeURIComponent(params.get('alpn')).split(',');
	}

	// 添加 Reality 配置增强
	if (config['reality-opts'] && params.get('support-x25519mlkem768')) {
		config['reality-opts']['support-x25519mlkem768'] = params.get('support-x25519mlkem768') === 'true';
	}

	// 添加 SMUX 配置
	const smuxConfig = parseSmuxConfig(params);
	if (smuxConfig) {
		config.smux = smuxConfig;
	}

	// 添加 Brutal 配置
	const brutalConfig = parseBrutalConfig(params);
	if (brutalConfig) {
		config['brutal-opts'] = brutalConfig;
	}

	return config;
}

// 解析Shadowsocks
function parseShadowsocks(url) {
	// 支持两种格式：
	// 1. ss://base64(method:password)@server:port#name
	// 2. ss://base64(method:password@server:port)#name

	const hashIndex = url.indexOf('#');
	const name = hashIndex !== -1 ? decodeURIComponent(url.substring(hashIndex + 1)) : 'Shadowsocks';
	const mainPart = hashIndex !== -1 ? url.substring(0, hashIndex) : url;

	// 移除 ss:// 前缀
	const withoutPrefix = mainPart.substring(5);

	let method, password, server, port;

	// 检查是否包含 @ 符号来判断格式
	if (withoutPrefix.includes('@')) {
		// 格式1: base64(method:password)@server:port
		const atIndex = withoutPrefix.lastIndexOf('@');
		const encodedPart = withoutPrefix.substring(0, atIndex);
		const serverPart = withoutPrefix.substring(atIndex + 1);

		// 解码用户信息
		const userInfo = atob(encodedPart);
		const colonIndex = userInfo.indexOf(':');
		method = userInfo.substring(0, colonIndex);
		password = userInfo.substring(colonIndex + 1);

		// 解析服务器信息
		const lastColonIndex = serverPart.lastIndexOf(':');
		server = serverPart.substring(0, lastColonIndex);
		port = parseInt(serverPart.substring(lastColonIndex + 1));
	} else {
		// 格式2: base64(method:password@server:port)
		const decoded = atob(withoutPrefix);
		const atIndex = decoded.lastIndexOf('@');
		const userInfo = decoded.substring(0, atIndex);
		const serverPart = decoded.substring(atIndex + 1);

		// 解析用户信息
		const colonIndex = userInfo.indexOf(':');
		method = userInfo.substring(0, colonIndex);
		password = userInfo.substring(colonIndex + 1);

		// 解析服务器信息
		const lastColonIndex = serverPart.lastIndexOf(':');
		server = serverPart.substring(0, lastColonIndex);
		port = parseInt(serverPart.substring(lastColonIndex + 1));
	}

	// 处理IPv6地址
	if (server.startsWith('[') && server.endsWith(']')) {
		server = server.slice(1, -1);
	}

	const config = {
		name: name,
		type: 'ss',
		server: formatServerAddress(server),
		port: port,
		cipher: method,
		password: password
	};

	// 从 URL 参数中解析额外配置
	const urlObj = new URL(url.replace('ss://', 'http://'));
	const params = urlObj.searchParams;

	// 添加 UDP 支持
	if (params.get('udp')) {
		config.udp = params.get('udp') === 'true' || params.get('udp') === '1';
	}

	// 添加 UDP over TCP
	if (params.get('udp-over-tcp')) {
		config['udp-over-tcp'] = params.get('udp-over-tcp') === 'true' || params.get('udp-over-tcp') === '1';
	}

	// 添加 UDP over TCP 版本
	if (params.get('udp-over-tcp-version')) {
		config['udp-over-tcp-version'] = parseInt(params.get('udp-over-tcp-version'));
	}

	// 添加 IP 版本偏好
	if (params.get('ip-version')) {
		config['ip-version'] = params.get('ip-version');
	}

	// 添加客户端指纹
	if (params.get('client-fingerprint')) {
		config['client-fingerprint'] = params.get('client-fingerprint');
	}

	// 添加 SMUX 配置
	if (params.get('smux-enabled') === 'true') {
		config.smux = {
			enabled: true,
			protocol: params.get('smux-protocol') || 'smux'
		};
		if (params.get('smux-max-connections')) {
			config.smux['max-connections'] = parseInt(params.get('smux-max-connections'));
		}
		if (params.get('smux-min-streams')) {
			config.smux['min-streams'] = parseInt(params.get('smux-min-streams'));
		}
		if (params.get('smux-max-streams')) {
			config.smux['max-streams'] = parseInt(params.get('smux-max-streams'));
		}
		if (params.get('smux-padding')) {
			config.smux.padding = params.get('smux-padding') === 'true';
		}
		if (params.get('smux-statistic')) {
			config.smux.statistic = params.get('smux-statistic') === 'true';
		}
		if (params.get('smux-only-tcp')) {
			config.smux['only-tcp'] = params.get('smux-only-tcp') === 'true';
		}
	}

	// 添加插件配置
	if (params.get('plugin')) {
		config.plugin = params.get('plugin');
		config['plugin-opts'] = {};

		// obfs 插件配置
		if (params.get('plugin') === 'obfs') {
			if (params.get('obfs-mode')) {
				config['plugin-opts'].mode = params.get('obfs-mode');
			}
			if (params.get('obfs-host')) {
				config['plugin-opts'].host = params.get('obfs-host');
			}
		}

		// v2ray-plugin 配置
		if (params.get('plugin') === 'v2ray-plugin') {
			if (params.get('v2ray-mode')) {
				config['plugin-opts'].mode = params.get('v2ray-mode');
			}
			if (params.get('v2ray-tls')) {
				config['plugin-opts'].tls = params.get('v2ray-tls') === 'true';
			}
			if (params.get('v2ray-host')) {
				config['plugin-opts'].host = params.get('v2ray-host');
			}
			if (params.get('v2ray-path')) {
				config['plugin-opts'].path = params.get('v2ray-path');
			}
			if (params.get('v2ray-mux')) {
				config['plugin-opts'].mux = params.get('v2ray-mux') === 'true';
			}
			if (params.get('v2ray-fingerprint')) {
				config['plugin-opts'].fingerprint = params.get('v2ray-fingerprint');
			}
			if (params.get('v2ray-skip-cert-verify')) {
				config['plugin-opts']['skip-cert-verify'] = params.get('v2ray-skip-cert-verify') === 'true';
			}
		}

		// shadow-tls 插件配置
		if (params.get('plugin') === 'shadow-tls') {
			if (params.get('shadow-tls-host')) {
				config['plugin-opts'].host = params.get('shadow-tls-host');
			}
			if (params.get('shadow-tls-password')) {
				config['plugin-opts'].password = params.get('shadow-tls-password');
			}
			if (params.get('shadow-tls-version')) {
				config['plugin-opts'].version = parseInt(params.get('shadow-tls-version'));
			}
			if (params.get('shadow-tls-alpn')) {
				config['plugin-opts'].alpn = params.get('shadow-tls-alpn').split(',');
			}
			// 添加客户端指纹支持
			if (params.get('client-fingerprint')) {
				config['client-fingerprint'] = params.get('client-fingerprint');
			}
		}

		// gost-plugin 配置
		if (params.get('plugin') === 'gost-plugin') {
			if (params.get('gost-mode')) {
				config['plugin-opts'].mode = params.get('gost-mode');
			}
			if (params.get('gost-tls')) {
				config['plugin-opts'].tls = params.get('gost-tls') === 'true';
			}
			if (params.get('gost-host')) {
				config['plugin-opts'].host = params.get('gost-host');
			}
			if (params.get('gost-path')) {
				config['plugin-opts'].path = params.get('gost-path');
			}
			if (params.get('gost-mux')) {
				config['plugin-opts'].mux = params.get('gost-mux') === 'true';
			}
			if (params.get('gost-fingerprint')) {
				config['plugin-opts'].fingerprint = params.get('gost-fingerprint');
			}
			if (params.get('gost-skip-cert-verify')) {
				config['plugin-opts']['skip-cert-verify'] = params.get('gost-skip-cert-verify') === 'true';
			}
			if (params.get('gost-headers')) {
				try {
					config['plugin-opts'].headers = JSON.parse(params.get('gost-headers'));
				} catch (e) {
					// 如果解析失败，忽略headers配置
				}
			}
		}

		// restls 插件配置
		if (params.get('plugin') === 'restls') {
			if (params.get('restls-host')) {
				config['plugin-opts'].host = params.get('restls-host');
			}
			if (params.get('restls-password')) {
				config['plugin-opts'].password = params.get('restls-password');
			}
			if (params.get('restls-version-hint')) {
				config['plugin-opts']['version-hint'] = params.get('restls-version-hint');
			}
			if (params.get('restls-script')) {
				config['plugin-opts']['restls-script'] = params.get('restls-script');
			}
		}
	}

	// 添加 SMUX 配置
	const smuxConfig = parseSmuxConfig(params);
	if (smuxConfig) {
		config.smux = smuxConfig;
	}

	return config;
}

// 解析ShadowsocksR
function parseShadowsocksR(url) {
	// SSR URL 格式: ssr://base64(server:port:protocol:method:obfs:password_base64/?params)
	const base64Part = url.substring(6); // 移除 ssr://
	const decoded = atob(base64Part);

	// 分割主要部分和参数部分
	const questionIndex = decoded.indexOf('/?');
	const mainPart = questionIndex !== -1 ? decoded.substring(0, questionIndex) : decoded;
	const paramsPart = questionIndex !== -1 ? decoded.substring(questionIndex + 2) : '';

	// 解析主要部分: server:port:protocol:method:obfs:password_base64
	const parts = mainPart.split(':');
	if (parts.length < 6) {
		return null;
	}

	const server = parts[0];
	const port = parseInt(parts[1]);
	const protocol = parts[2];
	const method = parts[3];
	const obfs = parts[4];
	const passwordBase64 = parts[5];

	// 解码密码
	let password;
	try {
		password = atob(passwordBase64);
	} catch (e) {
		password = passwordBase64; // 如果解码失败，直接使用原始值
	}

	const config = {
		name: 'ShadowsocksR',
		type: 'ssr',
		server: formatServerAddress(server),
		port: port,
		cipher: method,
		password: password,
		protocol: protocol,
		obfs: obfs
	};

	// 解析参数
	if (paramsPart) {
		const params = new URLSearchParams(paramsPart);

		// 解析混淆参数
		if (params.get('obfsparam')) {
			try {
				config['obfs-param'] = atob(params.get('obfsparam'));
			} catch (e) {
				config['obfs-param'] = params.get('obfsparam');
			}
		}

		// 解析协议参数
		if (params.get('protoparam')) {
			try {
				config['protocol-param'] = atob(params.get('protoparam'));
			} catch (e) {
				config['protocol-param'] = params.get('protoparam');
			}
		}

		// 解析备注
		if (params.get('remarks')) {
			try {
				config.name = atob(params.get('remarks'));
			} catch (e) {
				config.name = params.get('remarks');
			}
		}

		// 添加 UDP 支持
		if (params.get('udp')) {
			config.udp = params.get('udp') === 'true' || params.get('udp') === '1';
		}
	}

	return config;
}

// 解析Hysteria (v1)
function parseHysteria(url) {
	const parsed = new URL(url);
	const params = parsed.searchParams;

	const config = {
		name: decodeURIComponent(parsed.hash.substring(1)) || 'Hysteria',
		type: 'hysteria',
		server: formatServerAddress(parsed.hostname),
		port: parseInt(parsed.port)
	};

	// 添加认证字符串 - 支持多种参数名
	if (parsed.username) {
		config['auth-str'] = parsed.username;
	}
	// 支持 auth 参数（映射到 auth-str）
	if (params.get('auth')) {
		config['auth-str'] = params.get('auth');
	}
	// 支持 auth_str 参数（直接映射到 auth-str）
	if (params.get('auth_str')) {
		config['auth-str'] = params.get('auth_str');
	}

	// 添加端口范围
	if (params.get('ports')) {
		config.ports = params.get('ports');
	}

	// 添加混淆
	if (params.get('obfs')) {
		config.obfs = params.get('obfs');
	}

	// 添加协议类型 (udp/wechat-video/faketcp)
	if (params.get('protocol')) {
		config.protocol = params.get('protocol');
	}

	// 添加 ALPN
	if (params.get('alpn')) {
		config.alpn = params.get('alpn').split(',');
	}

	// 添加上传下载速度
	if (params.get('up')) {
		config.up = params.get('up');
	}
	if (params.get('down')) {
		config.down = params.get('down');
	}
	// 支持 upmbps 和 downmbps 参数
	if (params.get('upmbps')) {
		config.up = params.get('upmbps');
	}
	if (params.get('downmbps')) {
		config.down = params.get('downmbps');
	}

	// 添加 SNI - 支持多种参数名
	if (params.get('sni')) {
		config.sni = params.get('sni');
	}
	// 支持 peer 参数（映射到 sni）
	if (params.get('peer')) {
		config.sni = params.get('peer');
	}

	// 添加跳过证书验证 - 支持多种参数名
	if (params.get('skip-cert-verify')) {
		config['skip-cert-verify'] = params.get('skip-cert-verify') === 'true';
	}
	// 支持 insecure 参数（映射到 skip-cert-verify）
	if (params.get('insecure')) {
		config['skip-cert-verify'] = params.get('insecure') === '1' || params.get('insecure') === 'true';
	}

	// 添加延迟参数（虽然Clash可能不直接支持，但保留用于信息记录）
	if (params.get('delay')) {
		// 可以作为注释信息保存在名称中，或者忽略
		const delay = params.get('delay');
		if (delay && !isNaN(parseInt(delay))) {
			// 将延迟信息添加到节点名称中
			config.name += ` (${delay}ms)`;
		}
	}

	// 添加 ECH 配置
	if (params.get('ech-enable') === 'true') {
		config['ech-opts'] = {
			enable: true
		};
		if (params.get('ech-config')) {
			config['ech-opts'].config = params.get('ech-config');
		}
	}

	// 添加接收窗口配置
	if (params.get('recv-window-conn')) {
		config['recv-window-conn'] = parseInt(params.get('recv-window-conn'));
	}
	if (params.get('recv-window')) {
		config['recv-window'] = parseInt(params.get('recv-window'));
	}

	// 添加 CA 配置
	if (params.get('ca')) {
		config.ca = params.get('ca');
	}
	if (params.get('ca-str')) {
		config['ca-str'] = params.get('ca-str');
	}

	// 添加禁用 MTU 发现
	if (params.get('disable-mtu-discovery')) {
		config['disable-mtu-discovery'] = params.get('disable-mtu-discovery') === 'true';
	}

	// 添加指纹
	if (params.get('fingerprint')) {
		config.fingerprint = params.get('fingerprint');
	}

	// 添加快速打开
	if (params.get('fast-open')) {
		config['fast-open'] = params.get('fast-open') === 'true';
	}

	return config;
}

// 解析Hysteria2
function parseHysteria2(url) {
	const parsed = new URL(url);
	const params = parsed.searchParams;

	const config = {
		name: decodeURIComponent(parsed.hash.substring(1)) || 'Hysteria2',
		type: 'hysteria2',
		server: formatServerAddress(parsed.hostname),
		port: parseInt(parsed.port),
		password: parsed.username
	};

	// 添加端口范围支持
	if (params.get('ports')) {
		config.ports = params.get('ports');
	}

	// 添加跳跃间隔
	if (params.get('hop-interval')) {
		config['hop-interval'] = parseInt(params.get('hop-interval'));
	}

	// 添加上传下载速度
	if (params.get('up')) {
		config.up = params.get('up');
	}
	if (params.get('down')) {
		config.down = params.get('down');
	}

	// 添加 SNI
	if (params.get('sni')) {
		config.sni = params.get('sni');
	}

	// 添加 skip-cert-verify
	if (params.get('insecure') === '1' || params.get('skip-cert-verify') === 'true') {
		config['skip-cert-verify'] = true;
	}

	// 添加指纹
	if (params.get('fingerprint')) {
		config.fingerprint = params.get('fingerprint');
	}

	// 添加 ALPN
	if (params.get('alpn')) {
		config.alpn = decodeURIComponent(params.get('alpn')).split(',');
	}

	// 添加 CA 配置
	if (params.get('ca')) {
		config.ca = params.get('ca');
	}
	if (params.get('ca-str')) {
		config['ca-str'] = params.get('ca-str');
	}

	// 添加混淆
	if (params.get('obfs')) {
		config.obfs = params.get('obfs');
		if (params.get('obfs-password')) {
			config['obfs-password'] = params.get('obfs-password');
		}
	}

	// 添加 ECH 配置
	if (params.get('ech-enable') === 'true') {
		config['ech-opts'] = {
			enable: true
		};
		if (params.get('ech-config')) {
			config['ech-opts'].config = params.get('ech-config');
		}
	}

	// 添加 QUIC 特殊配置
	if (params.get('initial-stream-receive-window')) {
		config['initial-stream-receive-window'] = parseInt(params.get('initial-stream-receive-window'));
	}
	if (params.get('max-stream-receive-window')) {
		config['max-stream-receive-window'] = parseInt(params.get('max-stream-receive-window'));
	}
	if (params.get('initial-connection-receive-window')) {
		config['initial-connection-receive-window'] = parseInt(params.get('initial-connection-receive-window'));
	}
	if (params.get('max-connection-receive-window')) {
		config['max-connection-receive-window'] = parseInt(params.get('max-connection-receive-window'));
	}

	// 添加端口跳跃
	if (params.get('mport')) {
		config['ports'] = params.get('mport');
	}

	return config;
}

// 解析Trojan
function parseTrojan(url) {
	const parsed = new URL(url);
	const params = parsed.searchParams;

	const config = {
		name: decodeURIComponent(parsed.hash.substring(1)) || 'Trojan',
		type: 'trojan',
		server: formatServerAddress(parsed.hostname),
		port: parseInt(parsed.port),
		password: parsed.username,
		udp: true  // Trojan通常默认开启UDP
	};

	// 添加客户端指纹
	if (params.get('client-fingerprint')) {
		config['client-fingerprint'] = params.get('client-fingerprint');
	}

	// 添加指纹
	if (params.get('fingerprint')) {
		config.fingerprint = params.get('fingerprint');
	}

	// 添加 SNI (支持 sni 和 peer 两种参数名)
	if (params.get('sni')) {
		config.sni = params.get('sni');
	} else if (params.get('peer')) {
		config.sni = params.get('peer');
	} else {
		config.sni = parsed.hostname;
	}

	// 添加 skip-cert-verify (支持 allowInsecure 和 insecure)
	if (params.get('allowInsecure') === '1' ||
		params.get('allowInsecure') === 'true' ||
		params.get('insecure') === '1' ||
		params.get('insecure') === 'true') {
		config['skip-cert-verify'] = true;
	}

	// 添加 ALPN
	if (params.get('alpn')) {
		config.alpn = decodeURIComponent(params.get('alpn')).split(',');
	}

	// 添加 flow (用于流控模式，如 xtls-rprx-vision)
	if (params.get('flow')) {
		config.flow = params.get('flow');
	}

	// 添加 flow-show
	if (params.get('flow-show')) {
		config['flow-show'] = params.get('flow-show') === 'true';
	}

	// 添加 ECH 配置
	if (params.get('ech-enable') === 'true') {
		config['ech-opts'] = {
			enable: true
		};
		if (params.get('ech-config')) {
			config['ech-opts'].config = params.get('ech-config');
		}
	}

	// 添加 Shadowsocks 配置
	if (params.get('ss-enabled') === 'true') {
		config['ss-opts'] = {
			enabled: true
		};
		if (params.get('ss-method')) {
			config['ss-opts'].method = params.get('ss-method');
		}
		if (params.get('ss-password')) {
			config['ss-opts'].password = params.get('ss-password');
		}
	}

	// 添加 network (传输协议)
	const network = params.get('type');
	if (network && network !== 'tcp') {
		config.network = network;

		// WebSocket 配置
		if (network === 'ws') {
			config['ws-opts'] = {};
			if (params.get('path')) {
				config['ws-opts'].path = decodeURIComponent(params.get('path'));
			}
			if (params.get('host')) {
				config['ws-opts'].headers = {
					Host: params.get('host')
				};
			}
		}

		// gRPC 配置
		if (network === 'grpc') {
			config['grpc-opts'] = {};
			if (params.get('serviceName')) {
				config['grpc-opts']['grpc-service-name'] = params.get('serviceName');
			}
		}
	}

	// 添加 client-fingerprint (TLS指纹)
	if (params.get('fp')) {
		config['client-fingerprint'] = params.get('fp');
	}

	// 添加 Reality 配置
	if (params.get('security') === 'reality' || params.get('tls') === 'reality') {
		config['reality-opts'] = {};
		if (params.get('pbk')) {
			config['reality-opts']['public-key'] = params.get('pbk');
		}
		if (params.get('sid')) {
			config['reality-opts']['short-id'] = params.get('sid');
		}
		if (params.get('support-x25519mlkem768')) {
			config['reality-opts']['support-x25519mlkem768'] = params.get('support-x25519mlkem768') === 'true';
		}
	}

	// 添加 flow-show 字段
	if (params.get('flow-show')) {
		config['flow-show'] = params.get('flow-show') === 'true';
	}

	// 添加 ss-opts 配置
	if (params.get('ss-enabled') === 'true') {
		config['ss-opts'] = {
			enabled: true
		};
		if (params.get('ss-method')) {
			config['ss-opts'].method = params.get('ss-method');
		}
		if (params.get('ss-password')) {
			config['ss-opts'].password = params.get('ss-password');
		}
	}

	// 添加 SMUX 配置
	const smuxConfig = parseSmuxConfig(params);
	if (smuxConfig) {
		config.smux = smuxConfig;
	}

	return config;
}

// 解析TUIC
function parseTuic(url) {
	const parsed = new URL(url);
	const params = parsed.searchParams;

	// 解析用户名部分 (UUID:密码)
	const userInfo = decodeURIComponent(parsed.username);
	let uuid, password, token;

	if (userInfo.includes(':')) {
		const colonIndex = userInfo.indexOf(':');
		uuid = userInfo.substring(0, colonIndex);
		password = userInfo.substring(colonIndex + 1);
	} else {
		// 如果没有冒号，整个作为UUID，密码从参数获取
		uuid = userInfo;
		password = params.get('password') || '';
	}

	// 检查是否是 TUIC v4 (使用 token)
	if (params.get('token')) {
		token = params.get('token');
	}

	const config = {
		name: decodeURIComponent(parsed.hash.substring(1)) || 'TUIC',
		type: 'tuic',
		server: formatServerAddress(parsed.hostname),
		port: parseInt(parsed.port)
	};

	// TUIC v4 使用 token，v5 使用 uuid + password
	if (token) {
		config.token = token;
	} else {
		config.uuid = uuid;
		config.password = password;
	}

	// 添加 IP 覆盖
	if (params.get('ip')) {
		config.ip = params.get('ip');
	}

	// 添加心跳间隔
	if (params.get('heartbeat-interval')) {
		config['heartbeat-interval'] = parseInt(params.get('heartbeat-interval'));
	}

	// 添加 ALPN
	if (params.get('alpn')) {
		config.alpn = params.get('alpn').split(',');
	}

	// 添加禁用 SNI
	if (params.get('disable-sni')) {
		config['disable-sni'] = params.get('disable-sni') === 'true';
	}

	// 添加减少 RTT
	if (params.get('reduce-rtt')) {
		config['reduce-rtt'] = params.get('reduce-rtt') === 'true';
	}

	// 添加请求超时
	if (params.get('request-timeout')) {
		config['request-timeout'] = parseInt(params.get('request-timeout'));
	}

	// 添加 UDP 中继模式
	if (params.get('udp-relay-mode')) {
		config['udp-relay-mode'] = params.get('udp-relay-mode');
	}

	// 添加拥塞控制算法
	if (params.get('congestion-controller')) {
		config['congestion-controller'] = params.get('congestion-controller');
	}

	// 添加拥塞窗口
	if (params.get('cwnd')) {
		config.cwnd = parseInt(params.get('cwnd'));
	}

	// 添加最大 UDP 中继包大小
	if (params.get('max-udp-relay-packet-size')) {
		config['max-udp-relay-packet-size'] = parseInt(params.get('max-udp-relay-packet-size'));
	}

	// 添加快速打开
	if (params.get('fast-open')) {
		config['fast-open'] = params.get('fast-open') === 'true';
	}

	// 添加跳过证书验证
	if (params.get('skip-cert-verify')) {
		config['skip-cert-verify'] = params.get('skip-cert-verify') === 'true';
	}

	// 添加最大打开流数
	if (params.get('max-open-streams')) {
		config['max-open-streams'] = parseInt(params.get('max-open-streams'));
	}

	// 添加 SNI
	if (params.get('sni')) {
		config.sni = params.get('sni');
	}

	// 添加 ECH 配置
	if (params.get('ech-enable') === 'true') {
		config['ech-opts'] = {
			enable: true
		};
		if (params.get('ech-config')) {
			config['ech-opts'].config = params.get('ech-config');
		}
	}

	// 添加 UDP over Stream (私有扩展)
	if (params.get('udp-over-stream')) {
		config['udp-over-stream'] = params.get('udp-over-stream') === 'true';
	}
	if (params.get('udp-over-stream-version')) {
		config['udp-over-stream-version'] = parseInt(params.get('udp-over-stream-version'));
	}

	// 添加拥塞控制算法
	if (params.get('congestion_control')) {
		config['congestion-controller'] = params.get('congestion_control');
	} else {
		config['congestion-controller'] = 'bbr';
	}

	// 添加 UDP 中继模式
	if (params.get('udp_relay_mode')) {
		config['udp-relay-mode'] = params.get('udp_relay_mode');
	} else {
		config['udp-relay-mode'] = 'native';
	}

	// 添加 ALPN
	if (params.get('alpn')) {
		config.alpn = decodeURIComponent(params.get('alpn')).split(',');
	} else {
		// TUIC 默认使用 h3
		config.alpn = ['h3'];
	}

	// 添加 skip-cert-verify
	if (params.get('insecure') === '1' || params.get('allowInsecure') === '1') {
		config['skip-cert-verify'] = true;
	}

	// 添加禁用 SNI
	if (params.get('disable_sni') === '1') {
		config['disable-sni'] = true;
	}

	// 添加 reduce-rtt
	if (params.get('reduce_rtt') === '1') {
		config['reduce-rtt'] = true;
	}

	return config;
}

// 解析SOCKS5
function parseSocks5(url) {
	const parsed = new URL(url);
	const params = parsed.searchParams;

	const config = {
		name: decodeURIComponent(parsed.hash.substring(1)) || 'SOCKS5',
		type: 'socks5',
		server: formatServerAddress(parsed.hostname),
		port: parseInt(parsed.port)
	};

	// 添加用户名和密码
	if (parsed.username) {
		config.username = decodeURIComponent(parsed.username);
	}
	if (parsed.password) {
		config.password = decodeURIComponent(parsed.password);
	}

	// 添加 TLS 支持
	if (params.get('tls') === 'true') {
		config.tls = true;
	}

	// 添加指纹
	if (params.get('fingerprint')) {
		config.fingerprint = params.get('fingerprint');
	}

	// 添加跳过证书验证
	if (params.get('skip-cert-verify') === 'true') {
		config['skip-cert-verify'] = true;
	}

	// 添加 UDP 支持
	if (params.get('udp') === 'true') {
		config.udp = true;
	}

	// 添加 IP 版本偏好
	if (params.get('ip-version')) {
		config['ip-version'] = params.get('ip-version');
	}

	return config;
}

// 解析HTTP代理
function parseHttp(url) {
	const parsed = new URL(url);
	const params = parsed.searchParams;

	const config = {
		name: decodeURIComponent(parsed.hash.substring(1)) || 'HTTP',
		type: 'http',
		server: formatServerAddress(parsed.hostname),
		port: parseInt(parsed.port)
	};

	// 添加用户名和密码
	if (parsed.username) {
		config.username = decodeURIComponent(parsed.username);
	}
	if (parsed.password) {
		config.password = decodeURIComponent(parsed.password);
	}

	// 添加 TLS 支持 (HTTPS)
	if (url.startsWith('https://') || params.get('tls') === 'true') {
		config.tls = true;
	}

	// 添加跳过证书验证
	if (params.get('skip-cert-verify') === 'true') {
		config['skip-cert-verify'] = true;
	}

	// 添加 SNI
	if (params.get('sni')) {
		config.sni = params.get('sni');
	}

	// 添加指纹
	if (params.get('fingerprint')) {
		config.fingerprint = params.get('fingerprint');
	}

	// 添加 IP 版本偏好
	if (params.get('ip-version')) {
		config['ip-version'] = params.get('ip-version');
	}

	return config;
}

// 解析Snell
function parseSnell(url) {
	const parsed = new URL(url);
	const params = parsed.searchParams;

	const config = {
		name: decodeURIComponent(parsed.hash.substring(1)) || 'Snell',
		type: 'snell',
		server: formatServerAddress(parsed.hostname),
		port: parseInt(parsed.port)
	};

	// 添加 PSK (预共享密钥)
	if (parsed.username) {
		config.psk = decodeURIComponent(parsed.username);
	}

	// 添加版本
	if (params.get('version')) {
		config.version = parseInt(params.get('version'));
	} else {
		config.version = 4; // 默认版本4
	}

	// 添加混淆配置
	if (params.get('obfs')) {
		config['obfs-opts'] = {
			mode: params.get('obfs')
		};
		if (params.get('obfs-host')) {
			config['obfs-opts'].host = params.get('obfs-host');
		}
	}

	// 添加 UDP 支持
	if (params.get('udp') === 'true') {
		config.udp = true;
	}

	// 添加 IP 版本偏好
	if (params.get('ip-version')) {
		config['ip-version'] = params.get('ip-version');
	}

	return config;
}

// 解析WireGuard
function parseWireGuard(url) {
	const parsed = new URL(url);
	const params = parsed.searchParams;

	const config = {
		name: decodeURIComponent(parsed.hash.substring(1)) || 'WireGuard',
		type: 'wireguard',
		server: formatServerAddress(parsed.hostname),
		port: parseInt(parsed.port)
	};

	// 必需字段
	if (params.get('private-key')) {
		config['private-key'] = params.get('private-key');
	}
	if (params.get('public-key')) {
		config['public-key'] = params.get('public-key');
	}

	// IP配置
	if (params.get('ip')) {
		config.ip = params.get('ip');
	}
	if (params.get('ipv6')) {
		config.ipv6 = params.get('ipv6');
	}

	// 可选字段
	if (params.get('pre-shared-key')) {
		config['pre-shared-key'] = params.get('pre-shared-key');
	}
	if (params.get('reserved')) {
		const reserved = params.get('reserved');
		// 支持数组格式 [209,98,59] 或字符串格式 "U4An"
		if (reserved.startsWith('[') && reserved.endsWith(']')) {
			try {
				config.reserved = JSON.parse(reserved);
			} catch (e) {
				config.reserved = reserved;
			}
		} else {
			config.reserved = reserved;
		}
	}

	// 高级配置
	if (params.get('dialer-proxy')) {
		config['dialer-proxy'] = params.get('dialer-proxy');
	}
	if (params.get('remote-dns-resolve') === 'true') {
		config['remote-dns-resolve'] = true;
	}
	if (params.get('dns')) {
		config.dns = params.get('dns').split(',');
	}
	if (params.get('refresh-server-ip-interval')) {
		config['refresh-server-ip-interval'] = parseInt(params.get('refresh-server-ip-interval'));
	}

	// UDP支持
	if (params.get('udp') === 'true') {
		config.udp = true;
	}

	// Peers配置 (如果存在)
	if (params.get('peers')) {
		try {
			config.peers = JSON.parse(decodeURIComponent(params.get('peers')));
		} catch (e) {
			// 如果解析失败，忽略peers配置
		}
	}

	// AmneziaWG配置
	if (params.get('amnezia-jc')) {
		config['amnezia-wg-option'] = {
			jc: parseInt(params.get('amnezia-jc')),
			jmin: parseInt(params.get('amnezia-jmin')) || 500,
			jmax: parseInt(params.get('amnezia-jmax')) || 501,
			s1: parseInt(params.get('amnezia-s1')) || 30,
			s2: parseInt(params.get('amnezia-s2')) || 40,
			h1: parseInt(params.get('amnezia-h1')) || 123456,
			h2: parseInt(params.get('amnezia-h2')) || 67543,
			h3: parseInt(params.get('amnezia-h3')) || 123123,
			h4: parseInt(params.get('amnezia-h4')) || 32345
		};
	}

	return config;
}

// 解析Mieru
function parseMieru(url) {
	const parsed = new URL(url);
	const params = parsed.searchParams;

	const config = {
		name: decodeURIComponent(parsed.hash.substring(1)) || 'Mieru',
		type: 'mieru',
		server: formatServerAddress(parsed.hostname),
		port: parseInt(parsed.port)
	};

	// 必需字段
	if (parsed.username) {
		config.username = decodeURIComponent(parsed.username);
	}
	if (parsed.password) {
		config.password = decodeURIComponent(parsed.password);
	}

	// 传输协议 (只支持TCP)
	config.transport = 'TCP';

	// 端口范围 (不可同时填写port和port-range)
	if (params.get('port-range')) {
		config['port-range'] = params.get('port-range');
		delete config.port; // 移除单独的port字段
	}

	// UDP支持 (UDP over TCP)
	if (params.get('udp') === 'true') {
		config.udp = true;
	}

	// 多路复用配置
	if (params.get('multiplexing')) {
		const multiplexing = params.get('multiplexing').toUpperCase();
		const validValues = ['MULTIPLEXING_OFF', 'MULTIPLEXING_LOW', 'MULTIPLEXING_MIDDLE', 'MULTIPLEXING_HIGH'];
		if (validValues.includes(multiplexing)) {
			config.multiplexing = multiplexing;
		} else {
			config.multiplexing = 'MULTIPLEXING_LOW'; // 默认值
		}
	} else {
		config.multiplexing = 'MULTIPLEXING_LOW'; // 默认值
	}

	return config;
}

// 解析AnyTLS
function parseAnyTLS(url) {
	const parsed = new URL(url);
	const params = parsed.searchParams;

	const config = {
		name: decodeURIComponent(parsed.hash.substring(1)) || 'AnyTLS',
		type: 'anytls',
		server: formatServerAddress(parsed.hostname),
		port: parseInt(parsed.port)
	};

	// 必需字段 - password在URL中位于@前，被识别为username
	if (parsed.username) {
		config.password = decodeURIComponent(parsed.username);
	}

	// 支持peer参数作为sni的别名
	if (params.get('peer')) {
		config.sni = params.get('peer');
	} else if (params.get('sni')) {
		config.sni = params.get('sni');
	}

	// WebSocket路径支持
	if (params.get('path')) {
		config.path = decodeURIComponent(params.get('path'));
	}

	// 客户端指纹
	if (params.get('client-fingerprint')) {
		config['client-fingerprint'] = params.get('client-fingerprint');
	} else {
		config['client-fingerprint'] = 'chrome'; // 默认值
	}

	// UDP支持
	if (params.get('udp') === 'true') {
		config.udp = true;
	}

	// 会话管理配置
	if (params.get('idle-session-check-interval')) {
		config['idle-session-check-interval'] = parseInt(params.get('idle-session-check-interval'));
	} else {
		config['idle-session-check-interval'] = 30; // 默认30秒
	}

	if (params.get('idle-session-timeout')) {
		config['idle-session-timeout'] = parseInt(params.get('idle-session-timeout'));
	} else {
		config['idle-session-timeout'] = 30; // 默认30秒
	}

	if (params.get('min-idle-session')) {
		config['min-idle-session'] = parseInt(params.get('min-idle-session'));
	} else {
		config['min-idle-session'] = 0; // 默认0
	}

	// ALPN配置
	if (params.get('alpn')) {
		config.alpn = params.get('alpn').split(',');
	} else {
		config.alpn = ['h2', 'http/1.1']; // 默认值
	}

	// 跳过证书验证
	if (params.get('skip-cert-verify') === 'true') {
		config['skip-cert-verify'] = true;
	}

	return config;
}

// 解析SSH
function parseSSH(url) {
	const parsed = new URL(url);
	const params = parsed.searchParams;

	const config = {
		name: decodeURIComponent(parsed.hash.substring(1)) || 'SSH',
		type: 'ssh',
		server: formatServerAddress(parsed.hostname),
		port: parseInt(parsed.port) || 22 // SSH默认端口22
	};

	// 用户名
	if (parsed.username) {
		config.username = decodeURIComponent(parsed.username);
	} else {
		config.username = 'root'; // 默认用户名
	}

	// 密码
	if (parsed.password) {
		config.password = decodeURIComponent(parsed.password);
	}

	// 私钥路径
	if (params.get('privateKey')) {
		config.privateKey = params.get('privateKey');
	}

	return config;
}

// 处理SMUX配置的通用函数
function parseSmuxConfig(params, prefix = 'smux') {
	if (params.get(`${prefix}-enabled`) === 'true') {
		const smux = {
			enabled: true,
			protocol: params.get(`${prefix}-protocol`) || 'smux'
		};

		if (params.get(`${prefix}-max-connections`)) {
			smux['max-connections'] = parseInt(params.get(`${prefix}-max-connections`));
		}
		if (params.get(`${prefix}-min-streams`)) {
			smux['min-streams'] = parseInt(params.get(`${prefix}-min-streams`));
		}
		if (params.get(`${prefix}-max-streams`)) {
			smux['max-streams'] = parseInt(params.get(`${prefix}-max-streams`));
		}
		if (params.get(`${prefix}-padding`)) {
			smux.padding = params.get(`${prefix}-padding`) === 'true';
		}
		if (params.get(`${prefix}-statistic`)) {
			smux.statistic = params.get(`${prefix}-statistic`) === 'true';
		}
		if (params.get(`${prefix}-only-tcp`)) {
			smux['only-tcp'] = params.get(`${prefix}-only-tcp`) === 'true';
		}

		return smux;
	}
	return null;
}

// 处理Brutal配置的通用函数
function parseBrutalConfig(params, prefix = 'brutal') {
	if (params.get(`${prefix}-enabled`) === 'true') {
		const brutal = {
			enabled: true
		};

		if (params.get(`${prefix}-up`)) {
			brutal.up = params.get(`${prefix}-up`);
		}
		if (params.get(`${prefix}-down`)) {
			brutal.down = params.get(`${prefix}-down`);
		}

		return brutal;
	}
	return null;
}

// 解析宽松格式的JSON（支持无引号的键和值）
function parseLooseJSON(jsonStr) {
	try {
		// 首先尝试标准JSON解析
		return JSON.parse(jsonStr);
	} catch (e) {
		// 如果标准解析失败，尝试宽松解析
		try {
			let processed = jsonStr.trim();

			// 支持 YAML 行内列表格式: "- { key: value, ... }"
			if (processed.startsWith('-')) {
				processed = processed.replace(/^\-\s*/, '');
			}
			// 去除可能的尾随逗号: "},"
			processed = processed.replace(/},\s*$/, '}');

			// 确保是对象格式
			if (!processed.startsWith('{') || !processed.endsWith('}')) {
				throw new Error('Invalid JSON format');
			}

			// 步骤1: 处理空值语法错误（如 flow:, 变为 flow: null,）
			processed = processed.replace(/:(\s*),/g, ': null,');
			processed = processed.replace(/:(\s*)}$/g, ': null}');

			// 步骤2: 处理单引号字符串
			processed = processed.replace(/'([^']*)'/g, '"$1"');

			// 步骤3: 为无引号的键添加引号（支持连字符）
			processed = processed.replace(/([{,]\s*)([a-zA-Z_$][a-zA-Z0-9_$-]*)\s*:/g, '$1"$2":');

			// 步骤4: 处理嵌套对象中的键（多次处理确保深层嵌套）
			for (let i = 0; i < 5; i++) {
				processed = processed.replace(/({[^{}]*?)([a-zA-Z_$][a-zA-Z0-9_$-]*)\s*:/g, '$1"$2":');
			}

			// 步骤5: 为复杂的无引号字符串值添加引号（支持 Unicode 字符包括 emoji）
			// 匹配冒号后到逗号/右括号之间的内容（排除已有引号的）
			processed = processed.replace(/:(\s*)([^:,{}"\[\]]+?)\s*([,}])/g, function (_, space, value, ending) {
				const trimmedValue = value.trim();
				// 排除布尔值、null、纯数字、对象、数组
				if (trimmedValue === 'true' || trimmedValue === 'false' || trimmedValue === 'null' ||
					/^\d+(\.\d+)?$/.test(trimmedValue) || trimmedValue.startsWith('{') || trimmedValue.startsWith('[') ||
					trimmedValue.startsWith('"')) {
					return ':' + space + trimmedValue + ending;
				}
				// 为复杂字符串值添加引号（包括包含 emoji 的字符串）
				return ':' + space + '"' + trimmedValue + '"' + ending;
			});

			// 步骤6: 处理端口范围等特殊格式（如 10710-10733）
			processed = processed.replace(/:(\s*)(\d+-\d+)\s*([,}])/g, ':"$2"$3');

			// 步骤7: 处理单个字符的字符串值
			processed = processed.replace(/:(\s*)([a-zA-Z])\s*([,}])/g, function (_, space, value, ending) {
				if (value === 'true' || value === 'false' || value === 'null') {
					return ':' + space + value + ending;
				}
				return ':' + space + '"' + value + '"' + ending;
			});

			// 步骤8: 处理IP地址
			processed = processed.replace(/:(\s*)(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})\s*([,}])/g, ':"$2"$3');

			// 尝试解析处理后的JSON
			return JSON.parse(processed);
		} catch (e2) {
			// 如果还是失败，尝试更激进的方法
			try {
				let jsCode = jsonStr.trim();

				// 同样支持 YAML 行内列表格式: "- { ... }"
				if (jsCode.startsWith('-')) {
					jsCode = jsCode.replace(/^\-\s*/, '');
				}
				jsCode = jsCode.replace(/},\s*$/, '}');

				// 确保是对象格式
				if (!jsCode.startsWith('{') || !jsCode.endsWith('}')) {
					throw new Error('Invalid format');
				}

				// 预处理：修复常见的语法错误
				// 1. 处理空值语法错误
				jsCode = jsCode.replace(/:(\s*),/g, ': null,');
				jsCode = jsCode.replace(/:(\s*)}$/g, ': null}');

				// 2. 处理单引号
				jsCode = jsCode.replace(/'/g, '"');

				// 3. 为所有可能的键添加引号
				jsCode = jsCode.replace(/([{,]\s*)([a-zA-Z_$][a-zA-Z0-9_$-]*)\s*:/g, '$1"$2":');

				// 4. 为所有可能的字符串值添加引号（支持 Unicode 字符包括 emoji）
				// 匹配冒号后到逗号/右括号之间的内容（排除已有引号的）
				jsCode = jsCode.replace(/:(\s*)([^:,{}"\[\]]+?)\s*([,}])/g, function (match, space, value, ending) {
					const trimmedValue = value.trim();
					// 如果已经有引号或是特殊值，不处理
					if (trimmedValue.startsWith('"') || trimmedValue === 'true' || trimmedValue === 'false' ||
						trimmedValue === 'null' || /^\d+(\.\d+)?$/.test(trimmedValue) ||
						trimmedValue.startsWith('{') || trimmedValue.startsWith('[')) {
						return match;
					}
					// 为其他所有值添加引号（包括包含 emoji 的字符串）
					return ':' + space + '"' + trimmedValue + '"' + ending;
				});

				// 5. 特殊处理：端口范围
				jsCode = jsCode.replace(/:(\s*)(\d+-\d+)\s*([,}])/g, ':"$2"$3');

				// 6. 特殊处理：IP地址
				jsCode = jsCode.replace(/:(\s*)(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})\s*([,}])/g, ':"$2"$3');

				return JSON.parse(jsCode);
			} catch (e3) {
				throw new Error(`Failed to parse loose JSON: ${e3.message}`);
			}
		}
	}
}

// 标准化JSON格式节点数据
function normalizeJSONProxy(proxyData, name, server, port) {
	const type = proxyData.type.toLowerCase();

	// 基础配置
	const config = {
		name: name,
		type: type,
		server: server,
		port: port
	};

	// 根据协议类型进行特定字段处理
	switch (type) {
		case 'vmess':
			return normalizeVmessJSON(proxyData, config);
		case 'vless':
			return normalizeVlessJSON(proxyData, config);
		case 'ss':
			return normalizeShadowsocksJSON(proxyData, config);
		case 'ssr':
			return normalizeShadowsocksRJSON(proxyData, config);
		case 'trojan':
			return normalizeTrojanJSON(proxyData, config);
		case 'hysteria':
			return normalizeHysteriaJSON(proxyData, config);
		case 'hysteria2':
			return normalizeHysteria2JSON(proxyData, config);
		case 'tuic':
			return normalizeTuicJSON(proxyData, config);
		case 'socks5':
			return normalizeSocks5JSON(proxyData, config);
		case 'http':
			return normalizeHttpJSON(proxyData, config);
		case 'snell':
			return normalizeSnellJSON(proxyData, config);
		case 'wireguard':
			return normalizeWireGuardJSON(proxyData, config);
		case 'mieru':
			return normalizeMieruJSON(proxyData, config);
		case 'anytls':
			return normalizeAnyTLSJSON(proxyData, config);
		case 'ssh':
			return normalizeSSHJSON(proxyData, config);
		default:
			// 对于未知协议，保留所有字段但覆盖基础字段
			return { ...proxyData, ...config };
	}
}

// VMess JSON标准化
function normalizeVmessJSON(data, config) {
	// 必需字段
	if (data.uuid) config.uuid = data.uuid;
	if (data.alterId !== undefined) config.alterId = parseInt(data.alterId) || 0;

	// 可选字段
	if (data.cipher) config.cipher = data.cipher;
	else config.cipher = 'auto';

	if (data.network) config.network = data.network;
	if (data.tls !== undefined) config.tls = data.tls === true || data.tls === 'true';
	if (data.udp !== undefined) config.udp = data.udp === true || data.udp === 'true';
	if (data['ip-version']) config['ip-version'] = data['ip-version'];
	if (data.fingerprint) config.fingerprint = data.fingerprint;
	if (data['client-fingerprint']) config['client-fingerprint'] = data['client-fingerprint'];
	if (data['skip-cert-verify'] !== undefined) config['skip-cert-verify'] = data['skip-cert-verify'] === true || data['skip-cert-verify'] === 'true';
	if (data.servername) config.servername = data.servername;

	// VMess 特有字段
	if (data['packet-encoding']) config['packet-encoding'] = data['packet-encoding'];
	if (data['global-padding'] !== undefined) config['global-padding'] = data['global-padding'] === true || data['global-padding'] === 'true';
	if (data['authenticated-length'] !== undefined) config['authenticated-length'] = data['authenticated-length'] === true || data['authenticated-length'] === 'true';
	if (data.alpn) config.alpn = Array.isArray(data.alpn) ? data.alpn : [data.alpn];

	// 传输层配置
	if (data['ws-opts']) config['ws-opts'] = data['ws-opts'];
	if (data['h2-opts']) config['h2-opts'] = data['h2-opts'];
	if (data['http-opts']) config['http-opts'] = data['http-opts'];
	if (data['grpc-opts']) config['grpc-opts'] = data['grpc-opts'];
	if (data['ech-opts']) config['ech-opts'] = data['ech-opts'];
	if (data['reality-opts']) config['reality-opts'] = data['reality-opts'];

	// SMUX配置
	if (data.smux) config.smux = data.smux;

	// Brutal配置
	if (data['brutal-opts']) config['brutal-opts'] = data['brutal-opts'];

	return config;
}

// VLess JSON标准化
function normalizeVlessJSON(data, config) {
	// 必需字段
	if (data.uuid) config.uuid = data.uuid;

	// 可选字段
	if (data.network) config.network = data.network;
	if (data.tls !== undefined) config.tls = data.tls === true || data.tls === 'true';
	if (data.udp !== undefined) config.udp = data.udp === true || data.udp === 'true';
	if (data['ip-version']) config['ip-version'] = data['ip-version'];

	// 处理flow字段，忽略null或空值
	if (data.flow && data.flow !== null && data.flow !== '') {
		config.flow = data.flow;
	}

	if (data.fingerprint) config.fingerprint = data.fingerprint;
	if (data['client-fingerprint']) config['client-fingerprint'] = data['client-fingerprint'];
	if (data['skip-cert-verify'] !== undefined) config['skip-cert-verify'] = data['skip-cert-verify'] === true || data['skip-cert-verify'] === 'true';
	if (data.servername) config.servername = data.servername;
	if (data.alpn) config.alpn = Array.isArray(data.alpn) ? data.alpn : [data.alpn];

	// 传输层配置
	if (data['ws-opts']) config['ws-opts'] = data['ws-opts'];
	if (data['h2-opts']) config['h2-opts'] = data['h2-opts'];
	if (data['grpc-opts']) config['grpc-opts'] = data['grpc-opts'];
	if (data['tcp-opts']) config['tcp-opts'] = data['tcp-opts'];
	if (data['ech-opts']) config['ech-opts'] = data['ech-opts'];
	if (data['reality-opts']) {
		config['reality-opts'] = data['reality-opts'];
		// 确保support-x25519mlkem768字段被正确处理
		if (data['reality-opts']['support-x25519mlkem768'] !== undefined) {
			config['reality-opts']['support-x25519mlkem768'] = data['reality-opts']['support-x25519mlkem768'] === true || data['reality-opts']['support-x25519mlkem768'] === 'true';
		}
	}

	// SMUX配置
	if (data.smux) config.smux = data.smux;

	// Brutal配置
	if (data['brutal-opts']) config['brutal-opts'] = data['brutal-opts'];

	return config;
}

// Shadowsocks JSON标准化
function normalizeShadowsocksJSON(data, config) {
	// 必需字段
	if (data.cipher) config.cipher = data.cipher;
	if (data.password) config.password = data.password;

	// 可选字段
	if (data.udp !== undefined) config.udp = data.udp === true || data.udp === 'true';
	if (data['udp-over-tcp'] !== undefined) config['udp-over-tcp'] = data['udp-over-tcp'] === true || data['udp-over-tcp'] === 'true';
	if (data['udp-over-tcp-version']) config['udp-over-tcp-version'] = parseInt(data['udp-over-tcp-version']);
	if (data['ip-version']) config['ip-version'] = data['ip-version'];
	if (data['client-fingerprint']) config['client-fingerprint'] = data['client-fingerprint'];

	// SMUX 配置
	if (data.smux) config.smux = data.smux;

	// 插件配置
	if (data.plugin) {
		config.plugin = data.plugin;
		if (data['plugin-opts']) config['plugin-opts'] = data['plugin-opts'];
	}

	return config;
}

// ShadowsocksR JSON标准化
function normalizeShadowsocksRJSON(data, config) {
	// 必需字段
	if (data.cipher) config.cipher = data.cipher;
	if (data.password) config.password = data.password;
	if (data.protocol) config.protocol = data.protocol;
	if (data.obfs) config.obfs = data.obfs;

	// 可选字段
	if (data['obfs-param']) config['obfs-param'] = data['obfs-param'];
	if (data['protocol-param']) config['protocol-param'] = data['protocol-param'];
	if (data.udp !== undefined) config.udp = data.udp === true || data.udp === 'true';

	return config;
}

// Trojan JSON标准化
function normalizeTrojanJSON(data, config) {
	// 必需字段
	if (data.password) config.password = data.password;

	// 可选字段
	if (data.udp !== undefined) config.udp = data.udp === true || data.udp === 'true';
	else config.udp = true; // Trojan默认开启UDP

	if (data['client-fingerprint']) config['client-fingerprint'] = data['client-fingerprint'];
	if (data.fingerprint) config.fingerprint = data.fingerprint;
	if (data.sni) config.sni = data.sni;
	if (data.alpn) config.alpn = Array.isArray(data.alpn) ? data.alpn : [data.alpn];
	if (data['skip-cert-verify'] !== undefined) config['skip-cert-verify'] = data['skip-cert-verify'] === true || data['skip-cert-verify'] === 'true';
	if (data.flow) config.flow = data.flow;
	if (data['flow-show'] !== undefined) config['flow-show'] = data['flow-show'] === true || data['flow-show'] === 'true';
	if (data.network) config.network = data.network;

	// 传输层配置
	if (data['ws-opts']) config['ws-opts'] = data['ws-opts'];
	if (data['grpc-opts']) config['grpc-opts'] = data['grpc-opts'];
	if (data['ss-opts']) config['ss-opts'] = data['ss-opts'];
	if (data['ech-opts']) config['ech-opts'] = data['ech-opts'];
	if (data['reality-opts']) config['reality-opts'] = data['reality-opts'];

	// SMUX配置
	if (data.smux) config.smux = data.smux;

	return config;
}

// Hysteria JSON标准化
function normalizeHysteriaJSON(data, config) {
	// 可选字段
	if (data['auth-str']) config['auth-str'] = data['auth-str'];
	if (data.ports) config.ports = data.ports;
	if (data.obfs) config.obfs = data.obfs;
	if (data.alpn) config.alpn = Array.isArray(data.alpn) ? data.alpn : [data.alpn];
	if (data.protocol) config.protocol = data.protocol;
	if (data.up) config.up = data.up;
	if (data.down) config.down = data.down;
	if (data.sni) config.sni = data.sni;
	if (data['skip-cert-verify'] !== undefined) config['skip-cert-verify'] = data['skip-cert-verify'] === true || data['skip-cert-verify'] === 'true';
	if (data['recv-window-conn']) config['recv-window-conn'] = parseInt(data['recv-window-conn']);
	if (data['recv-window']) config['recv-window'] = parseInt(data['recv-window']);
	if (data.ca) config.ca = data.ca;
	if (data['ca-str']) config['ca-str'] = data['ca-str'];
	if (data['disable-mtu-discovery'] !== undefined) config['disable-mtu-discovery'] = data['disable-mtu-discovery'] === true || data['disable-mtu-discovery'] === 'true';
	if (data.fingerprint) config.fingerprint = data.fingerprint;
	if (data['fast-open'] !== undefined) config['fast-open'] = data['fast-open'] === true || data['fast-open'] === 'true';
	if (data['ech-opts']) config['ech-opts'] = data['ech-opts'];

	return config;
}

// Hysteria2 JSON标准化
function normalizeHysteria2JSON(data, config) {
	// 必需字段 - 支持 password 和 auth 字段
	if (data.password) config.password = data.password;
	else if (data.auth) config.password = data.auth; // 兼容 auth 字段

	// 可选字段
	if (data.udp !== undefined) config.udp = data.udp === true || data.udp === 'true';
	if (data.ports) config.ports = data.ports;

	// 处理hop-interval字段的多种写法
	if (data['hop-interval']) config['hop-interval'] = parseInt(data['hop-interval']);
	else if (data.HopInterval) config['hop-interval'] = parseInt(data.HopInterval);
	else if (data.hopInterval) config['hop-interval'] = parseInt(data.hopInterval);

	if (data.up) config.up = data.up;
	if (data.down) config.down = data.down;
	if (data.obfs) config.obfs = data.obfs;
	if (data['obfs-password']) config['obfs-password'] = data['obfs-password'];
	if (data.sni) config.sni = data.sni;
	if (data['skip-cert-verify'] !== undefined) config['skip-cert-verify'] = data['skip-cert-verify'] === true || data['skip-cert-verify'] === 'true';
	if (data.fingerprint) config.fingerprint = data.fingerprint;
	if (data.alpn) config.alpn = Array.isArray(data.alpn) ? data.alpn : [data.alpn];
	if (data.ca) config.ca = data.ca;
	if (data['ca-str']) config['ca-str'] = data['ca-str'];
	if (data['ech-opts']) config['ech-opts'] = data['ech-opts'];

	// QUIC 特殊配置
	if (data['initial-stream-receive-window']) config['initial-stream-receive-window'] = parseInt(data['initial-stream-receive-window']);
	if (data['max-stream-receive-window']) config['max-stream-receive-window'] = parseInt(data['max-stream-receive-window']);
	if (data['initial-connection-receive-window']) config['initial-connection-receive-window'] = parseInt(data['initial-connection-receive-window']);
	if (data['max-connection-receive-window']) config['max-connection-receive-window'] = parseInt(data['max-connection-receive-window']);

	return config;
}

// TUIC JSON标准化
function normalizeTuicJSON(data, config) {
	// TUIC v4 使用 token，v5 使用 uuid + password
	if (data.token) {
		config.token = data.token;
	} else {
		if (data.uuid) config.uuid = data.uuid;
		if (data.password) config.password = data.password;
	}

	// 可选字段
	if (data.ip) config.ip = data.ip;
	if (data['heartbeat-interval']) config['heartbeat-interval'] = parseInt(data['heartbeat-interval']);
	if (data.alpn) config.alpn = Array.isArray(data.alpn) ? data.alpn : [data.alpn];
	else config.alpn = ['h3']; // TUIC 默认使用 h3

	if (data['disable-sni'] !== undefined) config['disable-sni'] = data['disable-sni'] === true || data['disable-sni'] === 'true';
	if (data['reduce-rtt'] !== undefined) config['reduce-rtt'] = data['reduce-rtt'] === true || data['reduce-rtt'] === 'true';
	if (data['request-timeout']) config['request-timeout'] = parseInt(data['request-timeout']);
	if (data['udp-relay-mode']) config['udp-relay-mode'] = data['udp-relay-mode'];
	else config['udp-relay-mode'] = 'native';

	if (data['congestion-controller']) config['congestion-controller'] = data['congestion-controller'];
	else config['congestion-controller'] = 'bbr';

	if (data.cwnd) config.cwnd = parseInt(data.cwnd);
	if (data['max-udp-relay-packet-size']) config['max-udp-relay-packet-size'] = parseInt(data['max-udp-relay-packet-size']);
	if (data['fast-open'] !== undefined) config['fast-open'] = data['fast-open'] === true || data['fast-open'] === 'true';
	if (data['skip-cert-verify'] !== undefined) config['skip-cert-verify'] = data['skip-cert-verify'] === true || data['skip-cert-verify'] === 'true';
	if (data['max-open-streams']) config['max-open-streams'] = parseInt(data['max-open-streams']);
	if (data.sni) config.sni = data.sni;
	if (data['ech-opts']) config['ech-opts'] = data['ech-opts'];
	if (data['udp-over-stream'] !== undefined) config['udp-over-stream'] = data['udp-over-stream'] === true || data['udp-over-stream'] === 'true';
	if (data['udp-over-stream-version']) config['udp-over-stream-version'] = parseInt(data['udp-over-stream-version']);

	return config;
}

// SOCKS5 JSON标准化
function normalizeSocks5JSON(data, config) {
	// 可选字段
	if (data.username) config.username = data.username;
	if (data.password) config.password = data.password;
	if (data.tls !== undefined) config.tls = data.tls === true || data.tls === 'true';
	if (data.fingerprint) config.fingerprint = data.fingerprint;
	if (data['skip-cert-verify'] !== undefined) config['skip-cert-verify'] = data['skip-cert-verify'] === true || data['skip-cert-verify'] === 'true';
	if (data.udp !== undefined) config.udp = data.udp === true || data.udp === 'true';
	if (data['ip-version']) config['ip-version'] = data['ip-version'];

	return config;
}

// HTTP JSON标准化
function normalizeHttpJSON(data, config) {
	// 可选字段
	if (data.username) config.username = data.username;
	if (data.password) config.password = data.password;
	if (data.tls !== undefined) config.tls = data.tls === true || data.tls === 'true';
	if (data['skip-cert-verify'] !== undefined) config['skip-cert-verify'] = data['skip-cert-verify'] === true || data['skip-cert-verify'] === 'true';
	if (data.sni) config.sni = data.sni;
	if (data.fingerprint) config.fingerprint = data.fingerprint;
	if (data['ip-version']) config['ip-version'] = data['ip-version'];

	return config;
}

// Snell JSON标准化
function normalizeSnellJSON(data, config) {
	// 必需字段
	if (data.psk) config.psk = data.psk;
	if (data.version !== undefined) config.version = parseInt(data.version) || 4;

	// 可选字段
	if (data.udp !== undefined) config.udp = data.udp === true || data.udp === 'true';
	if (data['ip-version']) config['ip-version'] = data['ip-version'];

	// 混淆配置
	if (data['obfs-opts']) {
		config['obfs-opts'] = data['obfs-opts'];
	}

	return config;
}

// WireGuard JSON标准化
function normalizeWireGuardJSON(data, config) {
	// 必需字段
	if (data['private-key']) config['private-key'] = data['private-key'];
	if (data['public-key']) config['public-key'] = data['public-key'];
	if (data.ip) config.ip = data.ip;

	// 可选字段
	if (data.ipv6) config.ipv6 = data.ipv6;
	if (data['pre-shared-key']) config['pre-shared-key'] = data['pre-shared-key'];
	if (data.reserved) config.reserved = data.reserved;
	if (data['dialer-proxy']) config['dialer-proxy'] = data['dialer-proxy'];
	if (data['remote-dns-resolve'] !== undefined) config['remote-dns-resolve'] = data['remote-dns-resolve'] === true || data['remote-dns-resolve'] === 'true';
	if (data.dns) config.dns = Array.isArray(data.dns) ? data.dns : [data.dns];
	if (data['refresh-server-ip-interval']) config['refresh-server-ip-interval'] = parseInt(data['refresh-server-ip-interval']);
	if (data.udp !== undefined) config.udp = data.udp === true || data.udp === 'true';
	if (data.peers) config.peers = data.peers;
	if (data['amnezia-wg-option']) config['amnezia-wg-option'] = data['amnezia-wg-option'];

	return config;
}

// Mieru JSON标准化
function normalizeMieruJSON(data, config) {
	// 必需字段
	if (data.username) config.username = data.username;
	if (data.password) config.password = data.password;

	// 传输协议 (只支持TCP)
	config.transport = 'TCP';

	// 端口范围
	if (data['port-range']) {
		config['port-range'] = data['port-range'];
		delete config.port; // 移除单独的port字段
	}

	// 可选字段
	if (data.udp !== undefined) config.udp = data.udp === true || data.udp === 'true';
	if (data.multiplexing) {
		const validValues = ['MULTIPLEXING_OFF', 'MULTIPLEXING_LOW', 'MULTIPLEXING_MIDDLE', 'MULTIPLEXING_HIGH'];
		if (validValues.includes(data.multiplexing.toUpperCase())) {
			config.multiplexing = data.multiplexing.toUpperCase();
		}
	}

	return config;
}

// AnyTLS JSON标准化
function normalizeAnyTLSJSON(data, config) {
	// 必需字段
	if (data.password) config.password = data.password;

	// 可选字段
	if (data['client-fingerprint']) config['client-fingerprint'] = data['client-fingerprint'];
	if (data.udp !== undefined) config.udp = data.udp === true || data.udp === 'true';
	if (data['idle-session-check-interval']) config['idle-session-check-interval'] = parseInt(data['idle-session-check-interval']);
	if (data['idle-session-timeout']) config['idle-session-timeout'] = parseInt(data['idle-session-timeout']);
	if (data['min-idle-session']) config['min-idle-session'] = parseInt(data['min-idle-session']);
	if (data.sni) config.sni = data.sni;
	if (data.alpn) config.alpn = Array.isArray(data.alpn) ? data.alpn : [data.alpn];
	if (data['skip-cert-verify'] !== undefined) config['skip-cert-verify'] = data['skip-cert-verify'] === true || data['skip-cert-verify'] === 'true';

	return config;
}

// SSH JSON标准化
function normalizeSSHJSON(data, config) {
	// 必需字段
	if (data.username) config.username = data.username;

	// 可选字段
	if (data.password) config.password = data.password;
	if (data.privateKey) config.privateKey = data.privateKey;

	return config;
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

// 活跃检测 - 更新订阅名称并移除无效订阅
async function activeDetection(env) {
	try {
		const subscriptions = JSON.parse(await env.CLASH_KV?.get('subscriptions') || '[]');
		const oldNames = JSON.parse(await env.CLASH_KV?.get('subscription_names') || '[]');
		const validSubscriptions = [];
		const validNames = [];
		const removedSubscriptions = [];

		// 存储已经使用的基础名称（不含流量和到期信息）以避免重复
		const usedBaseNames = new Set();

		for (let i = 0; i < subscriptions.length; i++) {
			const subUrl = subscriptions[i];
			const subInfo = await getSubscriptionInfo(subUrl);

			// 进行连通性检测
			const shouldReject = await shouldRejectSubscription(subUrl, subInfo);

			if (shouldReject.reject) {
				// 记录被移除的订阅
				removedSubscriptions.push({
					url: subUrl,
					name: oldNames[i] || `订阅${i + 1}`,
					reason: shouldReject.reason
				});
				continue; // 跳过无效的订阅
			}

			// 订阅有效，保留并更新名称
			validSubscriptions.push(subUrl);

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
				validNames.forEach(name => {
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
			const newName = generateSubscriptionName(tempSubInfo, validNames);
			validNames.push(newName);
		}

		// 保存更新后的订阅和名称
		await env.CLASH_KV?.put('subscriptions', JSON.stringify(validSubscriptions));
		await env.CLASH_KV?.put('subscription_names', JSON.stringify(validNames));

		return new Response(JSON.stringify({
			success: true,
			message: '活跃检测完成',
			updated: validNames.length,
			removed: removedSubscriptions.length,
			removedSubscriptions: removedSubscriptions
		}), {
			headers: { 'Content-Type': 'application/json' }
		});

	} catch (error) {
		return new Response(JSON.stringify({
			success: false,
			message: '活跃检测失败: ' + error.message
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
		// 使用轮询方式尝试不同的 User-Agent，设置较短的超时时间用于活跃检测
		const result = await fetchWithUserAgentRotation(subUrl, 8000);
		const response = result.response;

		subInfo.statusCode = response.status;
		subInfo.success = response.ok; // 200-299 范围内的状态码被认为是成功的

		console.log(`订阅 ${subUrl} 使用 ${result.userAgent} 请求，状态码: ${response.status}`);

		// 获取响应头（大小写不敏感）
		// 尝试多种可能的大小写组合
		let contentDisposition = response.headers.get('content-disposition') ||
			response.headers.get('Content-Disposition') ||
			response.headers.get('CONTENT-DISPOSITION');

		let userInfo = response.headers.get('subscription-userinfo') ||
			response.headers.get('Subscription-Userinfo') ||
			response.headers.get('SUBSCRIPTION-USERINFO') ||
			response.headers.get('Subscription-UserInfo') ||
			response.headers.get('subscription-UserInfo');

		// 如果还是没有找到，遍历所有头部
		if (!contentDisposition || !userInfo) {
			for (const [key, value] of response.headers.entries()) {
				const lowerKey = key.toLowerCase();
				if (!contentDisposition && lowerKey === 'content-disposition') {
					contentDisposition = value;
				}
				if (!userInfo && lowerKey === 'subscription-userinfo') {
					userInfo = value;
				}
			}
		}



		// 解析响应头
		return parseHeaders(contentDisposition, userInfo, subInfo);

	} catch (error) {
		// 网络错误、超时等情况
		console.log(`订阅 ${subUrl} 请求失败:`, error.message);
		subInfo.success = false;
		// 如果是超时错误，设置特殊状态码
		if (error.name === 'TimeoutError' || error.name === 'AbortError' || error.message.includes('timeout')) {
			subInfo.statusCode = 408; // Request Timeout
		} else if (error.message.includes('fetch failed') || error.message.includes('network')) {
			subInfo.statusCode = 0; // Network error
		} else {
			subInfo.statusCode = 0; // 其他网络错误
		}
	}

	return subInfo;
}



// 解析响应头的辅助函数
function parseHeaders(contentDisposition, userInfo, subInfo) {
	// 解析 Content-Disposition 获取订阅名称
	if (contentDisposition) {
		// 先处理 filename*=UTF-8'' 格式（RFC 5987）
		// 支持多种格式:
		// filename*=UTF-8''%E9%9D%92%E4%BA%91%E6%A2%AF
		// filename*=utf-8''Nova%E5%8A%A0%E9%80%9F
		// filename*=UTF-8'en'Nova%E5%8A%A0%E9%80%9F (带语言标签)
		const filenameStarMatch = contentDisposition.match(/filename\*\s*=\s*(?:UTF-8|utf-8)''([^;]+)/i);
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
			// 匹配多种可能的格式:
			// filename="name"
			// filename='name'
			// filename=name
			const filenameMatch = contentDisposition.match(/filename\s*=\s*([^;]+)/i);
			if (filenameMatch) {
				let rawName = filenameMatch[1].trim();

				// 移除可能的引号
				if ((rawName.startsWith('"') && rawName.endsWith('"')) ||
					(rawName.startsWith("'") && rawName.endsWith("'"))) {
					rawName = rawName.slice(1, -1);
				}

				if (rawName) {
					// 检查是否需要 URL 解码
					if (rawName.includes('%')) {
						try {
							subInfo.name = decodeURIComponent(rawName);
						} catch (e) {
							// 解码失败则使用原始值
							subInfo.name = rawName;
						}
					} else {
						subInfo.name = rawName;
					}
				}
			}
		}

		// 额外处理：有些服务器可能使用非标准格式
		// 例如: attachment; filename*=sub_name 或 attachment;filename=sub_name（无空格）
		if (!subInfo.name) {
			// 尝试更宽松的匹配
			const looseMatch = contentDisposition.match(/filename\*?\s*=\s*([^\s;]+)/i);
			if (looseMatch) {
				let name = looseMatch[1];
				// 移除可能的引号
				name = name.replace(/^["']|["']$/g, '');
				if (name.includes('%')) {
					try {
						subInfo.name = decodeURIComponent(name);
					} catch (e) {
						subInfo.name = name;
					}
				} else {
					subInfo.name = name;
				}
			}
		}
	}

	// 解析 Subscription-Userinfo 获取流量信息
	if (userInfo) {
		// 解析格式: upload=123; download=456; total=789; expire=1234567890
		// 支持大小写不敏感的键名
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
		// 清理地址：移除IPv6地址可能的方括号
		const cleanAddress = serverAddress.replace(/^\[|\]$/g, '');

		// 调用IP-API获取地理位置信息
		const apiUrl = `http://ip-api.com/json/${encodeURIComponent(cleanAddress)}?fields=status,country,countryCode`;
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

// 处理单个订阅检测
async function handleSubscriptionCheck(request) {
	if (request.method !== 'POST') {
		return new Response('Method not allowed', { status: 405 });
	}

	try {
		const { url } = await request.json();

		if (!url) {
			return new Response(JSON.stringify({
				valid: false,
				reason: '缺少URL参数'
			}), {
				status: 400,
				headers: { 'Content-Type': 'application/json' }
			});
		}

		// 获取订阅信息
		const subInfo = await getSubscriptionInfo(url);
		console.log(`订阅检测 ${url}: success=${subInfo.success}, statusCode=${subInfo.statusCode}`);

		// 进行连通性检测
		const shouldReject = await shouldRejectSubscription(url, subInfo);
		console.log(`连通性判断 ${url}: reject=${shouldReject.reject}, reason=${shouldReject.reason}`);

		return new Response(JSON.stringify({
			valid: !shouldReject.reject,
			name: subInfo.name || '',
			reason: shouldReject.reason || '检测通过',
			statusCode: subInfo.statusCode,
			download: subInfo.download,
			total: subInfo.total,
			expire: subInfo.expire
		}), {
			headers: { 'Content-Type': 'application/json' }
		});

	} catch (error) {
		return new Response(JSON.stringify({
			valid: false,
			reason: '检测失败: ' + error.message
		}), {
			status: 500,
			headers: { 'Content-Type': 'application/json' }
		});
	}
}

// 批量处理活跃检测结果
async function activeDetectionBatch(results, env) {
	try {
		// 验证输入参数
		if (!results || !Array.isArray(results)) {
			return new Response(JSON.stringify({
				success: false,
				message: '无效的检测结果数据'
			}), {
				status: 400,
				headers: { 'Content-Type': 'application/json' }
			});
		}

		const validSubscriptions = [];
		const validNames = [];
		const removedSubscriptions = [];

		// 存储已经使用的基础名称（不含流量和到期信息）以避免重复
		const usedBaseNames = new Set();

		for (const result of results) {
			if (!result.valid) {
				// 记录被移除的订阅
				removedSubscriptions.push({
					url: result.url,
					name: result.name || '未知订阅',
					reason: result.reason
				});
				continue; // 跳过无效的订阅
			}

			// 订阅有效，保留并更新名称
			validSubscriptions.push(result.url);

			// 提取基础名称
			let baseName = result.name;

			// 如果没有基础名称，使用订阅编号
			if (!baseName) {
				const usedNumbers = new Set();
				validNames.forEach(name => {
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
			const tempSubInfo = {
				name: uniqueBaseName,
				download: result.download || 0,
				total: result.total || 0,
				expire: result.expire || null
			};
			const newName = generateSubscriptionName(tempSubInfo, validNames);
			validNames.push(newName);
		}

		// 保存更新后的订阅和名称
		await env.CLASH_KV?.put('subscriptions', JSON.stringify(validSubscriptions));
		await env.CLASH_KV?.put('subscription_names', JSON.stringify(validNames));

		return new Response(JSON.stringify({
			success: true,
			message: '活跃检测完成',
			updated: validNames.length,
			removed: removedSubscriptions.length,
			removedSubscriptions: removedSubscriptions
		}), {
			headers: { 'Content-Type': 'application/json' }
		});

	} catch (error) {
		return new Response(JSON.stringify({
			success: false,
			message: '批量处理失败: ' + error.message
		}), {
			status: 500,
			headers: { 'Content-Type': 'application/json' }
		});
	}
}

// 检测是否为IPv6地址
function isIPv6Address(address) {
	// 移除可能的方括号（如 [2001:db8::1]）
	const cleanAddress = address.replace(/^\[|\]$/g, '');

	// IPv6地址的基本特征：包含冒号且符合IPv6格式
	if (!cleanAddress.includes(':')) {
		return false;
	}

	// 简单的IPv6格式验证
	// IPv6地址由8组4位十六进制数字组成，用冒号分隔
	// 支持压缩格式（::）和混合格式
	const ipv6Regex = /^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$|^([0-9a-fA-F]{1,4}:)*::([0-9a-fA-F]{1,4}:)*[0-9a-fA-F]{1,4}$|^::([0-9a-fA-F]{1,4}:)*[0-9a-fA-F]{1,4}$|^([0-9a-fA-F]{1,4}:)+::$|^::$/;

	return ipv6Regex.test(cleanAddress);
}

// 格式化server字段，确保IPv6地址格式正确
function formatServerAddress(server) {
	if (!server) return server;

	// 移除可能已存在的方括号
	const cleanServer = server.replace(/^\[|\]$/g, '');

	// 检查是否为IPv6地址
	if (isIPv6Address(cleanServer)) {
		// IPv6地址需要用方括号包围（当有端口时）
		// 但在Clash配置中，server字段只包含地址，不包含端口
		// 所以这里只返回纯IPv6地址，不加方括号
		return cleanServer;
	}

	// IPv4地址或域名直接返回
	return cleanServer;
}
