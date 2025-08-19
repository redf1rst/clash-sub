// Clash订阅生成器 - Cloudflare Worker
export default {
	async fetch(request, env) {
		const url = new URL(request.url);
		const path = url.pathname;

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
			return handleSubscriptionCheck(request, env);
		}

		if (path === '/clash/proxies') {
			return generateProxiesConfig(env);
		}

		if (path.startsWith('/clash/proxies/')) {
			const collectionId = path.split('/')[3];
			return generateProxyCollectionConfig(collectionId, env);
		}

		if (path === '/clash/submerge') {
			return generateSubMergeConfig(env);
		}

		if (path.startsWith('/clash/submerge/')) {
			const collectionId = path.split('/')[3];
			return generateSubCollectionConfig(collectionId, env);
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
				return await addJSONProxies(proxies, env);
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

		// 使用与添加节点时相同的排序逻辑，但采用优先级排序
		proxies.sort((a, b) => {
			// 提取地区缩写和序号 - 修正正则表达式以匹配实际的节点命名格式
			// 实际格式: US美国01-IPv4, JP日本02-IPv6 等
			const regionPatternForSort = /^([A-Z]{2})[^0-9]*?(\d{2})-(IPv4|IPv6)$/;
			const matchA = a.name.match(regionPatternForSort);
			const matchB = b.name.match(regionPatternForSort);

			if (matchA && matchB) {
				const regionA = matchA[1]; // 提取地区缩写，如 US, JP
				const regionB = matchB[1];
				const numberA = parseInt(matchA[2]); // 提取序号
				const numberB = parseInt(matchB[2]);

				// 定义优先级地区顺序
				const priorityRegions = ['US', 'JP', 'TW', 'SG', 'KR', 'HK', 'CA', 'AU', 'FR', 'GB', 'DE'];
				const priorityA = priorityRegions.indexOf(regionA);
				const priorityB = priorityRegions.indexOf(regionB);

				// 如果两个都是优先级地区
				if (priorityA !== -1 && priorityB !== -1) {
					if (priorityA !== priorityB) {
						return priorityA - priorityB; // 按优先级顺序排序
					}
					return numberA - numberB; // 优先级相同时按序号排序
				}

				// 如果只有一个是优先级地区
				if (priorityA !== -1 && priorityB === -1) {
					return -1; // A 是优先级地区，排在前面
				}
				if (priorityA === -1 && priorityB !== -1) {
					return 1; // B 是优先级地区，排在前面
				}

				// 如果都不是优先级地区，按地区缩写字母顺序排序
				if (regionA !== regionB) {
					return regionA.localeCompare(regionB);
				}
				// 地区相同时按序号排序
				return numberA - numberB;
			}

			// 如果匹配失败，按名称排序
			return a.name.localeCompare(b.name);
		});

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
		const id = 'sub_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);

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

		for (const subUrl of urls) {
			// 检查重复订阅
			if (collection.subscriptions.includes(subUrl)) {
				duplicateCount++;
				continue;
			}

			// 获取订阅信息
			const subInfo = await getSubscriptionInfo(subUrl);

			// 智能连通性判断
			const shouldReject = await shouldRejectSubscription(subUrl, subInfo);
			if (shouldReject.reject) {
				failedCount++;
				failedSubscriptions.push({
					url: subUrl,
					error: shouldReject.reason,
					statusCode: subInfo.statusCode
				});
				continue;
			}

			// 生成订阅名称
			const subName = generateSubscriptionName(subInfo, collection.subscriptionNames);

			collection.subscriptions.push(subUrl);
			collection.subscriptionNames.push(subName);
			addedSubscriptions.push({ url: subUrl, name: subName });
			successCount++;
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
				return await addJSONProxiesToCollection(collectionId, proxies, env);
			case 'addMixedProxy':
				return await addMixedProxiesToCollection(collectionId, data, env);
			default:
				return new Response('Invalid action', { status: 400 });
		}
	}

	return new Response('Method not allowed', { status: 405 });
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
		const id = 'proxy_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);

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

			// 检查重复节点
			const isDuplicate = collection.proxies.some(p =>
				p.server === proxyConfig.server && p.port === proxyConfig.port
			);

			if (isDuplicate) {
				duplicateCount++;
				continue;
			}

			// 生成节点名称 - 使用与节点整合相同的逻辑
			let detectedRegion;
			if (region === 'auto') {
				detectedRegion = await detectRegion(proxyConfig.server);
			} else {
				detectedRegion = region;
			}

			// 地区代码映射为英文缩写+中文格式
			const regionNames = {
				// 亚洲
				'HK': 'HK香港',
				'TW': 'TW台湾',
				'JP': 'JP日本',
				'KR': 'KR韩国',
				'SG': 'SG新加坡',
				'MY': 'MY马来西亚',
				'TH': 'TH泰国',
				'VN': 'VN越南',
				'ID': 'ID印尼',
				'PH': 'PH菲律宾',
				'IN': 'IN印度',
				'PK': 'PK巴基斯坦',
				'BD': 'BD孟加拉',
				'KH': 'KH柬埔寨',
				'MM': 'MM缅甸',
				'LK': 'LK斯里兰卡',
				'NP': 'NP尼泊尔',
				'KZ': 'KZ哈萨克斯坦',
				'UZ': 'UZ乌兹别克斯坦',

				// 美洲
				'US': 'US美国',
				'CA': 'CA加拿大',
				'MX': 'MX墨西哥',
				'BR': 'BR巴西',
				'AR': 'AR阿根廷',
				'CL': 'CL智利',
				'CO': 'CO哥伦比亚',
				'PE': 'PE秘鲁',
				'VE': 'VE委内瑞拉',
				'EC': 'EC厄瓜多尔',
				'BO': 'BO玻利维亚',
				'PY': 'PY巴拉圭',
				'UY': 'UY乌拉圭',
				'CR': 'CR哥斯达黎加',
				'PA': 'PA巴拿马',

				// 欧洲 - 西欧
				'UK': 'UK英国',
				'GB': 'GB英国',
				'FR': 'FR法国',
				'DE': 'DE德国',
				'NL': 'NL荷兰',
				'BE': 'BE比利时',
				'LU': 'LU卢森堡',
				'IE': 'IE爱尔兰',
				'AT': 'AT奥地利',
				'CH': 'CH瑞士',
				'LI': 'LI列支敦士登',

				// 欧洲 - 南欧
				'IT': 'IT意大利',
				'ES': 'ES西班牙',
				'PT': 'PT葡萄牙',
				'GR': 'GR希腊',
				'MT': 'MT马耳他',
				'CY': 'CY塞浦路斯',
				'AD': 'AD安道尔',
				'SM': 'SM圣马力诺',
				'VA': 'VA梵蒂冈',
				'MC': 'MC摩纳哥',

				// 欧洲 - 北欧
				'SE': 'SE瑞典',
				'NO': 'NO挪威',
				'DK': 'DK丹麦',
				'FI': 'FI芬兰',
				'IS': 'IS冰岛',
				'EE': 'EE爱沙尼亚',
				'LV': 'LV拉脱维亚',
				'LT': 'LT立陶宛',

				// 欧洲 - 东欧
				'RU': 'RU俄罗斯',
				'UA': 'UA乌克兰',
				'PL': 'PL波兰',
				'CZ': 'CZ捷克',
				'SK': 'SK斯洛伐克',
				'HU': 'HU匈牙利',
				'RO': 'RO罗马尼亚',
				'BG': 'BG保加利亚',
				'BY': 'BY白俄罗斯',
				'MD': 'MD摩尔多瓦',

				// 欧洲 - 巴尔干地区
				'RS': 'RS塞尔维亚',
				'HR': 'HR克罗地亚',
				'SI': 'SI斯洛文尼亚',
				'BA': 'BA波黑',
				'ME': 'ME黑山',
				'MK': 'MK北马其顿',
				'AL': 'AL阿尔巴尼亚',
				'XK': 'XK科索沃',

				// 欧洲 - 高加索地区
				'GE': 'GE格鲁吉亚',
				'AM': 'AM亚美尼亚',
				'AZ': 'AZ阿塞拜疆',

				// 中东
				'TR': 'TR土耳其',
				'AE': 'AE阿联酋',
				'IL': 'IL以色列',
				'SA': 'SA沙特',
				'QA': 'QA卡塔尔',
				'KW': 'KW科威特',
				'BH': 'BH巴林',
				'OM': 'OM阿曼',
				'JO': 'JO约旦',
				'LB': 'LB黎巴嫩',
				'SY': 'SY叙利亚',
				'IQ': 'IQ伊拉克',
				'IR': 'IR伊朗',
				'YE': 'YE也门',

				// 非洲
				'ZA': 'ZA南非',
				'EG': 'EG埃及',
				'NG': 'NG尼日利亚',
				'KE': 'KE肯尼亚',
				'ET': 'ET埃塞俄比亚',
				'GH': 'GH加纳',
				'DZ': 'DZ阿尔及利亚',
				'MA': 'MA摩洛哥',
				'TN': 'TN突尼斯',
				'LY': 'LY利比亚',
				'SD': 'SD苏丹',
				'UG': 'UG乌干达',
				'ZW': 'ZW津巴布韦',
				'TZ': 'TZ坦桑尼亚',
				'AO': 'AO安哥拉',
				'MZ': 'MZ莫桑比克',
				'NA': 'NA纳米比亚',
				'BW': 'BW博茨瓦纳',
				'MU': 'MU毛里求斯',
				'SC': 'SC塞舌尔',

				// 大洋洲
				'AU': 'AU澳洲',
				'NZ': 'NZ新西兰',
				'FJ': 'FJ斐济',
				'PG': 'PG巴新',
				'NC': 'NC新喀里多尼亚',

				// 其他
				'Unknown': 'Unknown未知'
			};

			const regionName = regionNames[detectedRegion] || `${detectedRegion}未知`;
			const isIPv6 = isIPv6Address(proxyConfig.server);
			const suffix = isIPv6 ? '-IPv6' : '-IPv4';

			// 计算序号 - 找到该地区可用的最小序号，填补空缺
			const regionPattern = new RegExp(`^${regionName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\d{2})-(IPv4|IPv6)$`);
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

			// 使用两位数字格式
			const nodeNumberStr = String(nodeNumber).padStart(2, '0');
			proxyConfig.name = `${regionName}${nodeNumberStr}${suffix}`;

			collection.proxies.push(proxyConfig);
			addedProxies.push(proxyConfig);
			successCount++;
		}

		// 排序节点 - 使用与节点整合相同的排序逻辑
		collection.proxies.sort((a, b) => {
			// 提取地区缩写和序号 - 修正正则表达式以匹配实际的节点命名格式
			const regionPatternForSort = /^([A-Z]{2})[^0-9]*?(\d{2})-(IPv4|IPv6)$/;
			const matchA = a.name.match(regionPatternForSort);
			const matchB = b.name.match(regionPatternForSort);

			if (matchA && matchB) {
				const regionA = matchA[1];
				const regionB = matchB[1];
				const numberA = parseInt(matchA[2]);
				const numberB = parseInt(matchB[2]);

				// 定义优先级地区顺序
				const priorityRegions = ['US', 'JP', 'TW', 'SG', 'KR', 'HK', 'CA', 'AU', 'FR', 'GB', 'DE'];
				const priorityA = priorityRegions.indexOf(regionA);
				const priorityB = priorityRegions.indexOf(regionB);

				// 如果两个都是优先级地区
				if (priorityA !== -1 && priorityB !== -1) {
					if (priorityA !== priorityB) {
						return priorityA - priorityB; // 按优先级顺序排序
					}
					return numberA - numberB; // 优先级相同时按序号排序
				}

				// 如果只有一个是优先级地区
				if (priorityA !== -1 && priorityB === -1) {
					return -1; // A 是优先级地区，排在前面
				}
				if (priorityA === -1 && priorityB !== -1) {
					return 1; // B 是优先级地区，排在前面
				}

				// 如果两个都不是优先级地区，按字母顺序排序
				if (regionA !== regionB) {
					return regionA.localeCompare(regionB);
				}
				// 地区相同时按序号排序
				return numberA - numberB;
			}

			// 如果匹配失败，按名称排序
			return a.name.localeCompare(b.name);
		});

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

// 合并两个操作结果
function combineResults(result1, result2) {
	try {
		// 解析两个结果
		const data1 = typeof result1 === 'string' ? JSON.parse(result1) : result1;
		const data2 = typeof result2 === 'string' ? JSON.parse(result2) : result2;

		// 如果任一操作失败，返回错误
		if (data1.error) return result1;
		if (data2.error) return result2;

		// 合并成功结果
		const combinedResult = {
			success: true,
			successCount: (data1.successCount || 0) + (data2.successCount || 0),
			duplicateCount: (data1.duplicateCount || 0) + (data2.duplicateCount || 0),
			addedProxies: [...(data1.addedProxies || []), ...(data2.addedProxies || [])]
		};

		return new Response(JSON.stringify(combinedResult), {
			headers: { 'Content-Type': 'application/json' }
		});
	} catch (error) {
		return new Response(JSON.stringify({ error: '合并结果失败: ' + error.message }), {
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
async function addJSONProxiesToCollection(collectionId, proxiesToAdd, env) {
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
		for (const proxyData of proxiesToAdd) {
			// 检查是否是前端标记的无效JSON
			if (proxyData._invalid) {
				errorCount++;
				continue; // 跳过前端标记的无效JSON
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

			// 检查重复节点 - 基于server和port，忽略名称
			const isDuplicate = collection.proxies.some(p =>
				p.server === formattedServer && p.port === port
			);

			if (isDuplicate) {
				duplicateCount++;
				continue; // 跳过重复节点
			}

			// 自动检测地区 - 与addProxyToCollection相同的逻辑
			const detectedRegion = await detectRegion(formattedServer);

			// 地区代码映射为英文缩写+中文格式
			const regionNames = {
				// 亚洲
				'HK': 'HK香港',
				'TW': 'TW台湾',
				'JP': 'JP日本',
				'KR': 'KR韩国',
				'SG': 'SG新加坡',
				'MY': 'MY马来西亚',
				'TH': 'TH泰国',
				'VN': 'VN越南',
				'ID': 'ID印尼',
				'PH': 'PH菲律宾',
				'IN': 'IN印度',
				'PK': 'PK巴基斯坦',
				'BD': 'BD孟加拉',
				'KH': 'KH柬埔寨',
				'MM': 'MM缅甸',
				'LK': 'LK斯里兰卡',
				'NP': 'NP尼泊尔',
				'KZ': 'KZ哈萨克斯坦',
				'UZ': 'UZ乌兹别克斯坦',

				// 美洲
				'US': 'US美国',
				'CA': 'CA加拿大',
				'MX': 'MX墨西哥',
				'BR': 'BR巴西',
				'AR': 'AR阿根廷',
				'CL': 'CL智利',
				'CO': 'CO哥伦比亚',
				'PE': 'PE秘鲁',
				'VE': 'VE委内瑞拉',
				'EC': 'EC厄瓜多尔',
				'BO': 'BO玻利维亚',
				'PY': 'PY巴拉圭',
				'UY': 'UY乌拉圭',
				'CR': 'CR哥斯达黎加',
				'PA': 'PA巴拿马',

				// 欧洲 - 西欧
				'UK': 'UK英国',
				'GB': 'GB英国',
				'FR': 'FR法国',
				'DE': 'DE德国',
				'NL': 'NL荷兰',
				'BE': 'BE比利时',
				'LU': 'LU卢森堡',
				'IE': 'IE爱尔兰',
				'AT': 'AT奥地利',
				'CH': 'CH瑞士',
				'LI': 'LI列支敦士登',

				// 欧洲 - 北欧
				'SE': 'SE瑞典',
				'NO': 'NO挪威',
				'DK': 'DK丹麦',
				'FI': 'FI芬兰',
				'IS': 'IS冰岛',

				// 欧洲 - 南欧
				'IT': 'IT意大利',
				'ES': 'ES西班牙',
				'PT': 'PT葡萄牙',
				'GR': 'GR希腊',
				'MT': 'MT马耳他',
				'CY': 'CY塞浦路斯',
				'SM': 'SM圣马力诺',
				'VA': 'VA梵蒂冈',
				'AD': 'AD安道尔',

				// 欧洲 - 东欧
				'RU': 'RU俄罗斯',
				'UA': 'UA乌克兰',
				'BY': 'BY白俄罗斯',
				'PL': 'PL波兰',
				'CZ': 'CZ捷克',
				'SK': 'SK斯洛伐克',
				'HU': 'HU匈牙利',
				'RO': 'RO罗马尼亚',
				'BG': 'BG保加利亚',
				'HR': 'HR克罗地亚',
				'SI': 'SI斯洛文尼亚',
				'BA': 'BA波黑',
				'RS': 'RS塞尔维亚',
				'ME': 'ME黑山',
				'MK': 'MK北马其顿',
				'AL': 'AL阿尔巴尼亚',
				'XK': 'XK科索沃',
				'MD': 'MD摩尔多瓦',
				'LT': 'LT立陶宛',
				'LV': 'LV拉脱维亚',
				'EE': 'EE爱沙尼亚',

				// 大洋洲
				'AU': 'AU澳洲',
				'NZ': 'NZ新西兰',
				'FJ': 'FJ斐济',
				'PG': 'PG巴布亚新几内亚',
				'NC': 'NC新喀里多尼亚',
				'VU': 'VU瓦努阿图',
				'SB': 'SB所罗门群岛',
				'TO': 'TO汤加',
				'WS': 'WS萨摩亚',
				'KI': 'KI基里巴斯',
				'TV': 'TV图瓦卢',
				'NR': 'NR瑙鲁',
				'PW': 'PW帕劳',
				'FM': 'FM密克罗尼西亚',
				'MH': 'MH马绍尔群岛',

				// 非洲
				'ZA': 'ZA南非',
				'EG': 'EG埃及',
				'NG': 'NG尼日利亚',
				'KE': 'KE肯尼亚',
				'GH': 'GH加纳',
				'ET': 'ET埃塞俄比亚',
				'TZ': 'TZ坦桑尼亚',
				'UG': 'UG乌干达',
				'DZ': 'DZ阿尔及利亚',
				'SD': 'SD苏丹',
				'MA': 'MA摩洛哥',
				'AO': 'AO安哥拉',
				'MZ': 'MZ莫桑比克',
				'MG': 'MG马达加斯加',
				'CM': 'CM喀麦隆',
				'CI': 'CI科特迪瓦',
				'NE': 'NE尼日尔',
				'BF': 'BF布基纳法索',
				'ML': 'ML马里',
				'MW': 'MW马拉维',
				'ZM': 'ZM赞比亚',
				'SN': 'SN塞内加尔',
				'SO': 'SO索马里',
				'TD': 'TD乍得',
				'SL': 'SL塞拉利昂',
				'TG': 'TG多哥',
				'CF': 'CF中非',
				'LR': 'LR利比里亚',
				'MR': 'MR毛里塔尼亚',
				'BW': 'BW博茨瓦纳',
				'NA': 'NA纳米比亚',
				'GM': 'GM冈比亚',
				'GW': 'GW几内亚比绍',
				'GQ': 'GQ赤道几内亚',
				'GA': 'GA加蓬',
				'SZ': 'SZ斯威士兰',
				'LS': 'LS莱索托',
				'RW': 'RW卢旺达',
				'BI': 'BI布隆迪',
				'DJ': 'DJ吉布提',
				'KM': 'KM科摩罗',
				'MU': 'MU毛里求斯',
				'SC': 'SC塞舌尔',
				'CV': 'CV佛得角',
				'ST': 'ST圣多美和普林西比',

				// 中东
				'TR': 'TR土耳其',
				'IR': 'IR伊朗',
				'IQ': 'IQ伊拉克',
				'SA': 'SA沙特',
				'AE': 'AE阿联酋',
				'IL': 'IL以色列',
				'JO': 'JO约旦',
				'LB': 'LB黎巴嫩',
				'SY': 'SY叙利亚',
				'YE': 'YE也门',
				'OM': 'OM阿曼',
				'KW': 'KW科威特',
				'QA': 'QA卡塔尔',
				'BH': 'BH巴林',
				'PS': 'PS巴勒斯坦',
				'AF': 'AF阿富汗'
			};

			const regionName = regionNames[detectedRegion] || `${detectedRegion}未知`;
			const isIPv6 = isIPv6Address(formattedServer);
			const suffix = isIPv6 ? '-IPv6' : '-IPv4';

			// 计算序号 - 找到该地区可用的最小序号，填补空缺
			const regionPattern = new RegExp(`^${regionName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\d{2})-(IPv4|IPv6)$`);
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

			// 使用两位数字格式
			const nodeNumberStr = String(nodeNumber).padStart(2, '0');
			const newNodeName = `${regionName}${nodeNumberStr}${suffix}`;
			console.log(`[DEBUG] Assigned number: ${nodeNumber}, final name: ${newNodeName}`);

			// 标准化节点数据 - 使用新生成的名称和格式化的server地址
			const { name: _, ...otherFields } = proxyData; // 排除原始name字段
			const normalizedProxy = {
				name: newNodeName,
				type: proxyData.type.toLowerCase(),
				server: formattedServer,
				port: port,
				...otherFields // 展开其他字段，不包含原始name和server
			};

			collection.proxies.push(normalizedProxy);
			addedProxies.push(normalizedProxy);
			successCount++;
		}

		// 排序节点 - 使用与addProxyToCollection相同的排序逻辑
		collection.proxies.sort((a, b) => {
			// 提取地区缩写和序号 - 修正正则表达式以匹配实际的节点命名格式
			const regionPatternForSort = /^([A-Z]{2})[^0-9]*?(\d{2})-(IPv4|IPv6)$/;
			const matchA = a.name.match(regionPatternForSort);
			const matchB = b.name.match(regionPatternForSort);

			if (matchA && matchB) {
				const regionA = matchA[1];
				const regionB = matchB[1];
				const numberA = parseInt(matchA[2]);
				const numberB = parseInt(matchB[2]);

				// 定义优先级地区顺序
				const priorityRegions = ['US', 'JP', 'TW', 'SG', 'KR', 'HK', 'CA', 'AU', 'FR', 'GB', 'DE'];
				const priorityA = priorityRegions.indexOf(regionA);
				const priorityB = priorityRegions.indexOf(regionB);

				// 如果两个都是优先级地区
				if (priorityA !== -1 && priorityB !== -1) {
					if (priorityA !== priorityB) {
						return priorityA - priorityB; // 按优先级顺序排序
					}
					return numberA - numberB; // 优先级相同时按序号排序
				}

				// 如果只有一个是优先级地区
				if (priorityA !== -1 && priorityB === -1) {
					return -1; // A 是优先级地区，排在前面
				}
				if (priorityA === -1 && priorityB !== -1) {
					return 1; // B 是优先级地区，排在前面
				}

				// 如果两个都不是优先级地区，按字母顺序排序
				if (regionA !== regionB) {
					return regionA.localeCompare(regionB);
				}
				// 地区相同时按序号排序
				return numberA - numberB;
			}

			// 如果匹配失败，按名称排序
			return a.name.localeCompare(b.name);
		});

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
				// 亚洲
				'HK': 'HK香港',
				'TW': 'TW台湾',
				'JP': 'JP日本',
				'KR': 'KR韩国',
				'SG': 'SG新加坡',
				'MY': 'MY马来西亚',
				'TH': 'TH泰国',
				'VN': 'VN越南',
				'ID': 'ID印尼',
				'PH': 'PH菲律宾',
				'IN': 'IN印度',
				'PK': 'PK巴基斯坦',
				'BD': 'BD孟加拉',
				'KH': 'KH柬埔寨',
				'MM': 'MM缅甸',
				'LK': 'LK斯里兰卡',
				'NP': 'NP尼泊尔',
				'KZ': 'KZ哈萨克斯坦',
				'UZ': 'UZ乌兹别克斯坦',

				// 美洲
				'US': 'US美国',
				'CA': 'CA加拿大',
				'MX': 'MX墨西哥',
				'BR': 'BR巴西',
				'AR': 'AR阿根廷',
				'CL': 'CL智利',
				'CO': 'CO哥伦比亚',
				'PE': 'PE秘鲁',
				'VE': 'VE委内瑞拉',
				'EC': 'EC厄瓜多尔',
				'BO': 'BO玻利维亚',
				'PY': 'PY巴拉圭',
				'UY': 'UY乌拉圭',
				'CR': 'CR哥斯达黎加',
				'PA': 'PA巴拿马',

				// 欧洲 - 西欧
				'UK': 'UK英国',
				'GB': 'GB英国',
				'FR': 'FR法国',
				'DE': 'DE德国',
				'NL': 'NL荷兰',
				'BE': 'BE比利时',
				'LU': 'LU卢森堡',
				'IE': 'IE爱尔兰',
				'AT': 'AT奥地利',
				'CH': 'CH瑞士',
				'LI': 'LI列支敦士登',

				// 欧洲 - 南欧
				'IT': 'IT意大利',
				'ES': 'ES西班牙',
				'PT': 'PT葡萄牙',
				'GR': 'GR希腊',
				'MT': 'MT马耳他',
				'CY': 'CY塞浦路斯',
				'AD': 'AD安道尔',
				'SM': 'SM圣马力诺',
				'VA': 'VA梵蒂冈',
				'MC': 'MC摩纳哥',

				// 欧洲 - 北欧
				'SE': 'SE瑞典',
				'NO': 'NO挪威',
				'DK': 'DK丹麦',
				'FI': 'FI芬兰',
				'IS': 'IS冰岛',
				'EE': 'EE爱沙尼亚',
				'LV': 'LV拉脱维亚',
				'LT': 'LT立陶宛',

				// 欧洲 - 东欧
				'RU': 'RU俄罗斯',
				'UA': 'UA乌克兰',
				'PL': 'PL波兰',
				'CZ': 'CZ捷克',
				'SK': 'SK斯洛伐克',
				'HU': 'HU匈牙利',
				'RO': 'RO罗马尼亚',
				'BG': 'BG保加利亚',
				'BY': 'BY白俄罗斯',
				'MD': 'MD摩尔多瓦',

				// 欧洲 - 巴尔干地区
				'RS': 'RS塞尔维亚',
				'HR': 'HR克罗地亚',
				'SI': 'SI斯洛文尼亚',
				'BA': 'BA波黑',
				'ME': 'ME黑山',
				'MK': 'MK北马其顿',
				'AL': 'AL阿尔巴尼亚',
				'XK': 'XK科索沃',

				// 欧洲 - 高加索地区
				'GE': 'GE格鲁吉亚',
				'AM': 'AM亚美尼亚',
				'AZ': 'AZ阿塞拜疆',

				// 中东
				'TR': 'TR土耳其',
				'AE': 'AE阿联酋',
				'IL': 'IL以色列',
				'SA': 'SA沙特',
				'QA': 'QA卡塔尔',
				'KW': 'KW科威特',
				'BH': 'BH巴林',
				'OM': 'OM阿曼',
				'JO': 'JO约旦',
				'LB': 'LB黎巴嫩',
				'SY': 'SY叙利亚',
				'IQ': 'IQ伊拉克',
				'IR': 'IR伊朗',
				'YE': 'YE也门',

				// 非洲
				'ZA': 'ZA南非',
				'EG': 'EG埃及',
				'NG': 'NG尼日利亚',
				'KE': 'KE肯尼亚',
				'ET': 'ET埃塞俄比亚',
				'GH': 'GH加纳',
				'DZ': 'DZ阿尔及利亚',
				'MA': 'MA摩洛哥',
				'TN': 'TN突尼斯',
				'LY': 'LY利比亚',
				'SD': 'SD苏丹',
				'UG': 'UG乌干达',
				'ZW': 'ZW津巴布韦',
				'TZ': 'TZ坦桑尼亚',
				'AO': 'AO安哥拉',
				'MZ': 'MZ莫桑比克',
				'NA': 'NA纳米比亚',
				'BW': 'BW博茨瓦纳',
				'MU': 'MU毛里求斯',
				'SC': 'SC塞舌尔',

				// 大洋洲
				'AU': 'AU澳洲',
				'NZ': 'NZ新西兰',
				'FJ': 'FJ斐济',
				'PG': 'PG巴新',
				'NC': 'NC新喀里多尼亚',

				// 其他
				'Unknown': 'Unknown未知'
			};

			const regionName = regionNames[detectedRegion] || `${detectedRegion}未知`;
			const isIPv6 = isIPv6Address(proxyConfig.server);
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
			// 提取地区缩写和序号 - 修正正则表达式以匹配实际的节点命名格式
			const regionPatternForSort = /^([A-Z]{2})[^0-9]*?(\d{2})-(IPv4|IPv6)$/;
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
			// 提取地区缩写和序号 - 修正正则表达式以匹配实际的节点命名格式
			const regionPatternForSort = /^([A-Z]{2})[^0-9]*?(\d{2})-(IPv4|IPv6)$/;
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
async function addJSONProxies(proxiesToAdd, env) {
	try {
		const proxies = JSON.parse(await env.CLASH_KV?.get('proxies') || '[]');
		const addedProxies = [];

		// 验证和处理每个节点
		for (const proxyData of proxiesToAdd) {
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

			// 检查重复节点 - 基于server和port，忽略名称
			const isDuplicate = proxies.some(p =>
				p.server === formattedServer && p.port === port
			);

			if (isDuplicate) {
				duplicateCount++;
				continue; // 跳过重复节点
			}

			// 自动检测地区
			const detectedRegion = await detectRegion(formattedServer);

			// 地区代码映射
			const regionNames = {
				'HK': 'HK香港', 'TW': 'TW台湾', 'JP': 'JP日本', 'KR': 'KR韩国', 'SG': 'SG新加坡',
				'US': 'US美国', 'CA': 'CA加拿大', 'MX': 'MX墨西哥', 'BR': 'BR巴西', 'AR': 'AR阿根廷',
				'UK': 'UK英国', 'GB': 'GB英国', 'FR': 'FR法国', 'DE': 'DE德国', 'NL': 'NL荷兰',
				'AU': 'AU澳洲', 'NZ': 'NZ新西兰', 'RU': 'RU俄罗斯', 'IN': 'IN印度', 'TR': 'TR土耳其'
			};

			const regionName = regionNames[detectedRegion] || `${detectedRegion}未知`;
			const isIPv6 = isIPv6Address(formattedServer);
			const suffix = isIPv6 ? '-IPv6' : '-IPv4';

			// 计算序号
			const regionPattern = new RegExp(`^${regionName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\d{2})-(IPv4|IPv6)$`);
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

			// 找到可用序号
			let nodeNumber = 1;
			while (usedNumbers.has(nodeNumber)) {
				nodeNumber++;
			}

			const nodeNumberStr = String(nodeNumber).padStart(2, '0');
			const newNodeName = `${regionName}${nodeNumberStr}${suffix}`;

			// 标准化节点数据 - 使用新生成的名称和格式化的server地址
			const normalizedProxy = {
				name: newNodeName,
				type: proxyData.type.toLowerCase(),
				server: formattedServer,
				port: port,
				...proxyData // 保留其他字段，但name、server会被覆盖
			};

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

		for (const subUrl of urls) {
			// 检查重复订阅
			if (subscriptions.includes(subUrl)) {
				duplicateCount++;
				continue; // 跳过重复的订阅
			}

			// 获取订阅信息（包括名称、流量、到期时间）
			const subInfo = await getSubscriptionInfo(subUrl);

			// 智能连通性判断
			const shouldReject = await shouldRejectSubscription(subUrl, subInfo);
			if (shouldReject.reject) {
				failedCount++;
				failedSubscriptions.push({
					url: subUrl,
					error: shouldReject.reason,
					statusCode: subInfo.statusCode
				});
				continue; // 跳过无效的订阅
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

// 检查URL是否使用IP地址
function isIpAddress(url) {
	try {
		const urlObj = new URL(url);
		const hostname = urlObj.hostname;

		// IPv4 地址正则表达式
		const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;

		// IPv6 地址正则表达式（简化版）
		const ipv6Regex = /^([0-9a-fA-F]{0,4}:){2,7}[0-9a-fA-F]{0,4}$/;

		return ipv4Regex.test(hostname) || ipv6Regex.test(hostname);
	} catch (error) {
		return false;
	}
}

// 定义三种标准 Clash 客户端请求头
const CLASH_USER_AGENTS = [
	{
		name: 'Clash.Meta',
		headers: {
			'User-Agent': 'Clash.Meta',
			'Accept': '*/*',
			'Accept-Encoding': 'gzip'
		}
	},
	{
		name: 'mihomo',
		headers: {
			'User-Agent': 'mihomo',
			'Accept': '*/*',
			'Accept-Encoding': 'gzip, deflate',
			'Connection': 'keep-alive'
		}
	},
	{
		name: 'clash-verge',
		headers: {
			'User-Agent': 'clash-verge/v2.3.0',
			'Accept': '*/*',
			'Accept-Encoding': 'gzip'
		}
	}
];

// 使用多种请求头轮询获取订阅
async function fetchWithUserAgentRotation(url, timeout = 5000) {
	let lastError = null;

	for (const userAgent of CLASH_USER_AGENTS) {
		try {
			const response = await fetch(url, {
				method: 'GET',
				headers: userAgent.headers,
				signal: AbortSignal.timeout(timeout)
			});

			// 如果请求成功，返回响应和使用的 User-Agent 信息
			return {
				response,
				userAgent: userAgent.name,
				success: true
			};
		} catch (error) {
			lastError = error;
			console.log(`${userAgent.name} 请求失败: ${error.message}`);
			// 继续尝试下一个 User-Agent
		}
	}

	// 所有 User-Agent 都失败了
	throw lastError || new Error('所有请求头都失败');
}

// 智能判断是否应该拒绝订阅
async function shouldRejectSubscription(subUrl, subInfo) {
	// 0. 对于使用IP地址的URL，跳过连通性检测，直接接受
	if (isIpAddress(subUrl)) {
		console.log(`跳过IP地址连通性检测: ${subUrl}`);
		return { reject: false, reason: '跳过IP地址检测' };
	}

	// 1. 网络连接失败，直接拒绝
	if (!subInfo.success && (subInfo.statusCode === 0 || subInfo.statusCode === 408)) {
		return {
			reject: true,
			reason: subInfo.statusCode === 408 ? '请求超时' : '网络连接失败'
		};
	}

	// 2. 对于HTTP错误状态码，需要进一步检查内容
	const criticalErrorCodes = [400, 401, 403, 404, 405, 429, 500, 502, 503, 504];
	if (criticalErrorCodes.includes(subInfo.statusCode)) {
		// 使用轮询方式尝试获取响应内容来判断是否真的无效
		try {
			const result = await fetchWithUserAgentRotation(subUrl, 5000);

			if (result.response.ok) {
				// 如果这次请求成功了，说明之前的错误可能是临时的
				console.log(`使用 ${result.userAgent} 重试成功`);
				return { reject: false };
			}

			// 检查响应内容类型和内容
			const contentType = result.response.headers.get('content-type') || '';
			const content = await result.response.text();

			// 如果返回的是HTML错误页面，则拒绝
			// 注意：只有当内容真的包含HTML标签时才认为是错误页面
			// 因为有些订阅服务会错误地设置 Content-Type 为 text/html，但实际返回的是配置文件
			if (contentType.includes('text/html') &&
				(content.includes('<html') || content.includes('<HTML') ||
					content.includes('<!DOCTYPE') || content.includes('<!doctype'))) {
				return {
					reject: true,
					reason: getErrorMessage(result.response.status, true)
				};
			}

			// 如果内容看起来像配置文件，则接受
			if (isValidConfigContent(content)) {
				return { reject: false };
			}

			// 其他情况，根据状态码决定
			if ([403, 404, 502, 503].includes(result.response.status)) {
				return {
					reject: true,
					reason: getErrorMessage(result.response.status, true)
				};
			}

		} catch (error) {
			// 二次请求也失败，拒绝
			return {
				reject: true,
				reason: getErrorMessage(subInfo.statusCode, subInfo.success)
			};
		}
	}

	// 3. 其他情况，接受订阅
	return { reject: false };
}

// 检查内容是否像有效的配置文件
function isValidConfigContent(content) {
	if (!content || content.length < 50) {
		return false;
	}

	// 检查是否包含常见的配置文件特征
	const configIndicators = [
		'proxies:', 'proxy-groups:', 'rules:',  // Clash YAML
		'vmess://', 'vless://', 'trojan://', 'ss://', 'ssr://',  // 节点链接
		'mixed-port:', 'allow-lan:', 'mode:',  // Clash 配置
		'server:', 'port:', 'cipher:', 'password:'  // 代理配置
	];

	const lowerContent = content.toLowerCase();
	return configIndicators.some(indicator => lowerContent.includes(indicator.toLowerCase()));
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

		// 对节点进行排序：优先级地区 + 其他地区按字母顺序
		proxies.sort((a, b) => {
			// 提取地区缩写和序号 - 修正正则表达式以匹配实际的节点命名格式
			const regionPatternForSort = /^([A-Z]{2})[^0-9]*?(\d{2})-(IPv4|IPv6)$/;
			const matchA = a.name.match(regionPatternForSort);
			const matchB = b.name.match(regionPatternForSort);

			if (matchA && matchB) {
				const regionA = matchA[1];
				const regionB = matchB[1];
				const numberA = parseInt(matchA[2]);
				const numberB = parseInt(matchB[2]);

				// 定义优先级地区顺序
				const priorityRegions = ['US', 'JP', 'TW', 'SG', 'KR', 'HK', 'CA', 'AU', 'FR', 'GB', 'DE'];
				const priorityA = priorityRegions.indexOf(regionA);
				const priorityB = priorityRegions.indexOf(regionB);

				// 如果两个都是优先级地区
				if (priorityA !== -1 && priorityB !== -1) {
					if (priorityA !== priorityB) {
						return priorityA - priorityB; // 按优先级顺序排序
					}
					return numberA - numberB; // 优先级相同时按序号排序
				}

				// 如果只有一个是优先级地区
				if (priorityA !== -1 && priorityB === -1) {
					return -1; // A 是优先级地区，排在前面
				}
				if (priorityA === -1 && priorityB !== -1) {
					return 1; // B 是优先级地区，排在前面
				}

				// 如果两个都不是优先级地区，按字母顺序排序
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
			//proxysub
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
			'find-process-mode': 'off',
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
					icon: 'https://edit-upload-pic.cdn.bcebos.com/26173e4a31c69a7c7bf843eeec70e1e0.jpeg?authorization=bce-auth-v1%2FALTAKh1mxHnNIyeO93hiasKJqq%2F2025-08-15T08%3A35%3A39Z%2F3600%2Fhost%2Fd6bff9c1010358e2a7ffd2915d3d7da2bf43bd76a9252e591ff085847855daf4'
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
				'Advertising-ads': {
					type: 'http',
					interval: 3600,
					behavior: 'domain',
					format: 'mrs',
					proxy: '节点选择',
					url: 'https://cdn.jsdmirror.com/gh/TG-Twilight/AWAvenue-Ads-Rule@main/Filters/AWAvenue-Ads-Rule-Clash.mrs',
					path: './ruleset/Advertising-ads.mrs'
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
				reject_non_ip_no_drop: {
					type: 'http',
					behavior: 'classical',
					interval: 43200,
					format: 'text',
					proxy: '节点选择',
					url: 'https://ruleset.skk.moe/Clash/non_ip/reject-no-drop.txt',
					path: './ruleset/reject_non_ip_no_drop.txt'
				},
				reject_non_ip_drop: {
					type: 'http',
					behavior: 'classical',
					interval: 43200,
					format: 'text',
					proxy: '节点选择',
					url: 'https://ruleset.skk.moe/Clash/non_ip/reject-drop.txt',
					path: './ruleset/reject_non_ip_drop.txt'
				},
				reject_non_ip: {
					type: 'http',
					behavior: 'classical',
					interval: 43200,
					format: 'text',
					proxy: '节点选择',
					url: 'https://ruleset.skk.moe/Clash/non_ip/reject.txt',
					path: './ruleset/reject_non_ip.txt'
				},
				reject_domainset: {
					type: 'http',
					behavior: 'domain',
					interval: 43200,
					format: 'text',
					proxy: '节点选择',
					url: 'https://ruleset.skk.moe/Clash/domainset/reject.txt',
					path: './ruleset/reject_domainset.txt'
				},
				reject_extra_domainset: {
					type: 'http',
					behavior: 'domain',
					interval: 43200,
					format: 'text',
					proxy: '节点选择',
					url: 'https://ruleset.skk.moe/Clash/domainset/reject_extra.txt',
					path: './ruleset/reject_domainset_extra.txt'
				},
				reject_ip: {
					type: 'http',
					behavior: 'classical',
					interval: 43200,
					format: 'text',
					proxy: '节点选择',
					url: 'https://ruleset.skk.moe/Clash/ip/reject.txt',
					path: './ruleset/reject_ip.txt'
				},
			},

			// 规则配置
			rules: [
				// 自定义优先规则
				'DOMAIN-SUFFIX,linux.do,Linux DO',
				'DOMAIN-SUFFIX,adobe.io,REJECT',
				'DOMAIN-SUFFIX,adobestats.io,REJECT',
				'DOMAIN-SUFFIX,bilibili.com,DIRECT',
				'DOMAIN-SUFFIX,cdn.bcebos.com,DIRECT',
				'RULE-SET,Advertising-ads,REJECT',
				// 内网
				'IP-CIDR,224.0.0.0/24,DIRECT,no-resolve',
				'RULE-SET,Private,DIRECT',
				'RULE-SET,LAN,DIRECT',
				'RULE-SET,Fakeip_Filter,DIRECT',

				// 特定服务规则
				'RULE-SET,ai,AI服务',
				'DOMAIN-SUFFIX,cloudflare.com,节点选择',
				'DOMAIN-SUFFIX,codebuddy.ai,AI服务',
				'DOMAIN-SUFFIX,github.com,节点选择',
				'RULE-SET,github_domain,节点选择',
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
				// 为常用的CDN和规则集提供代理
				'DOMAIN,cdn.jsdmirror.com,节点选择',
				'DOMAIN,raw.githubusercontent.com,节点选择',
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
				// 兜底规则
				'MATCH,节点选择'
			]

		};

		const yamlContent = convertToYAML(config);

		return new Response(yamlContent, {
			headers: {
				'Content-Type': 'text/yaml; charset=utf-8',
				'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(collection.name)}`
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
		config.port = 7890;
		config['socks-port'] = 7891;
		config['redir-port'] = 7892;
		config['mixed-port'] = 7893;
		config['tproxy-port'] = 7894;
		config['allow-lan'] = true;
		config['bind-address'] = '*';
		config.ipv6 = false;
		config['unified-delay'] = true;
		config['tcp-concurrent'] = true;
		config['log-level'] = 'info';
		config['find-process-mode'] = 'off';
		config['global-client-fingerprint'] = 'chrome';
		config['keep-alive-idle'] = 600;
		config['keep-alive-interval'] = 15;
		config['disable-keep-alive'] = false;
		config.profile = {
			'store-selected': true,
			'store-fake-ip': true
		};
		config.mode = 'rule';
		config['geodata-mode'] = false;
		config['geodata-loader'] = 'standard';
		config['geo-auto-update'] = true;
		config['geo-update-interval'] = 24;

		// 嗅探配置
		config.sniffer = {
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
		};

		// 入站配置
		config.tun = {
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
		};

		// DNS模块
		config.dns = {
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
			sortedSubscriptions.forEach((sub, index) => {
				// 获取对应的订阅名称
				const subscriptionName = subscriptionNames[index] || null;

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

				config['proxy-providers'][providerName] = {
					url: sub,
					type: 'http',
					interval: 3600,
					'health-check': {
						enable: true,
						url: 'https://www.gstatic.com/generate_204',
						interval: 300
					},
					proxy: 'DIRECT'
				};
			});
		}

		// 出站策略
		config['proxy-groups'] = [
			{
				name: '🚀 默认代理',
				type: 'select',
				proxies: [
					'♻️ 日本自动 🇯🇵',
					'♻️ 新加坡自动 🇸🇬',
					'♻️ 美国自动 🇺🇲',
					'♻️ 台湾自动 🇨🇳',
					'♻️ 韩国自动 🇰🇷',
					'♻️ 香港自动 🇭🇰',
					'♻️ 法国自动 🇫🇷',
					'♻️ 英国自动 🇬🇧',
					'♻️ 澳洲自动 🇦🇺',
					'♻️ 德国自动 🇩🇪',
					'♻️ 自动选择',
					'🔯 日本故障转移 🇯🇵',
					'🔯 新加坡故障转移 🇸🇬',
					'🔯 美国故障转移 🇺🇸',
					'🔯 台湾故障转移 🇨🇳',
					'🔯 韩国故障转移 🇰🇷',
					'🔯 香港故障转移 🇭🇰',
					'🔯 英国故障转移 🇬🇧',
					'🔯 法国故障转移 🇫🇷',
					'🔯 澳洲故障转移 🇦🇺',
					'🔯 德国故障转移 🇩🇪',
					'🌐 全部节点',
					'🇯🇵 日本节点',
					'🇨🇳 台湾节点',
					'🇸🇬 新加坡节点',
					'🇺🇲 美国节点',
					'🇰🇷 韩国节点',
					'🇭🇰 香港节点',
					'🇬🇧 英国节点',
					'🇫🇷 法国节点',
					'🇦🇺 澳洲节点',
					'🇩🇪 德国节点',
					'DIRECT'
				],
				icon: 'https://cdn.jsdelivr.net/gh/Koolson/Qure@master/IconSet/Color/Proxy.png'
			},
			{
				name: 'AI服务',
				type: 'select',
				proxies: [
					'🚀 默认代理',
					'♻️ 日本自动 🇯🇵',
					'♻️ 美国自动 🇺🇲',
					'♻️ 台湾自动 🇨🇳',
					'♻️ 新加坡自动 🇸🇬',
					'♻️ 韩国自动 🇰🇷',
					'♻️ 英国自动 🇬🇧',
					'♻️ 法国自动 🇫🇷',
					'♻️ 澳洲自动 🇦🇺',
					'♻️ 德国自动 🇩🇪',
					'♻️ 自动选择',
					'🔯 日本故障转移 🇯🇵',
					'🔯 新加坡故障转移 🇸🇬',
					'🔯 美国故障转移 🇺🇸',
					'🔯 台湾故障转移 🇨🇳',
					'🔯 韩国故障转移 🇰🇷',
					'🔯 英国故障转移 🇬🇧',
					'🔯 法国故障转移 🇫🇷',
					'🔯 澳洲故障转移 🇦🇺',
					'🔯 德国故障转移 🇩🇪',
					'🇯🇵 日本节点',
					'🇨🇳 台湾节点',
					'🇸🇬 新加坡节点',
					'🇺🇲 美国节点',
					'🇰🇷 韩国节点',
					'🇬🇧 英国节点',
					'🇫🇷 法国节点',
					'🇦🇺 澳洲节点',
					'🇩🇪 德国节点',
					'🌐 全部节点',
					'DIRECT'
				],
				icon: 'https://cdn.jsdelivr.net/gh/Koolson/Qure@master/IconSet/Color/ChatGPT.png'
			},
			{
				name: 'Linux DO',
				type: 'select',
				proxies: [
					'DIRECT',
					'🚀 默认代理'
				],
				icon: 'https://edit-upload-pic.cdn.bcebos.com/26173e4a31c69a7c7bf843eeec70e1e0.jpeg?authorization=bce-auth-v1%2FALTAKh1mxHnNIyeO93hiasKJqq%2F2025-08-15T08%3A35%3A39Z%2F3600%2Fhost%2Fd6bff9c1010358e2a7ffd2915d3d7da2bf43bd76a9252e591ff085847855daf4'
			},
			{
				name: '微软服务',
				type: 'select',
				proxies: ['AI服务', 'DIRECT'],
				icon: 'https://cdn.jsdelivr.net/gh/Koolson/Qure@master/IconSet/Color/Microsoft.png'
			},
			{
				name: '苹果服务',
				type: 'select',
				proxies: ['DIRECT', '🚀 默认代理'],
				icon: 'https://cdn.jsdelivr.net/gh/Koolson/Qure@master/IconSet/Color/Apple.png'
			},
			{
				name: '♻️ 台湾自动 🇨🇳',
				type: 'url-test',
				'include-all': true,
				tolerance: 30,
				interval: 300,
				filter: '^(?!.*(10x|6x))(?=.*((?i)🇹🇼|台湾|台北|新北|高雄|\\\\b(TW|Taiwan|Tai wan)\\\\b)).*$'
			},
			{
				name: '♻️ 日本自动 🇯🇵',
				type: 'url-test',
				'include-all': true,
				tolerance: 30,
				interval: 300,
				filter: '^(?!.*(10x|6x))(?=.*((?i)🇯🇵|日本|东京|大阪|京都|名古屋|埼玉|\\\\b(JP|Japan)\\\\b)).*$'
			},
			{
				name: '♻️ 新加坡自动 🇸🇬',
				type: 'url-test',
				'include-all': true,
				tolerance: 30,
				interval: 300,
				filter: '^(?!.*(10x|6x))(?=.*((?i)🇸🇬|新加坡|新加坡|\\\\b(SG|Singapore)\\\\b)).*$'
			},
			{
				name: '♻️ 美国自动 🇺🇲',
				type: 'url-test',
				'include-all': true,
				tolerance: 30,
				interval: 300,
				filter: '^(?!.*(10x|6x))(?=.*((?i)🇺🇸|美国|波特兰|达拉斯|俄勒冈|凤凰城|费利蒙|硅谷|拉斯维加斯|洛杉矶|圣何塞|圣克拉拉|西雅图|芝加哥|\\\\b(US|United States|America)\\\\b)).*$'
			},
			{
				name: '♻️ 韩国自动 🇰🇷',
				type: 'url-test',
				'include-all': true,
				tolerance: 30,
				interval: 300,
				filter: '^(?!.*(10x|6x))(?=.*((?i)🇰🇷|韩国|韓國|首尔|釜山|\\\\b(KR|Korea)\\\\b)).*$'
			},
			{
				name: '♻️ 英国自动 🇬🇧',
				type: 'url-test',
				'include-all': true,
				tolerance: 30,
				interval: 300,
				filter: '^(?!.*(10x|6x))(?=.*((?i)🇬🇧|英国|伦敦|曼彻斯特|\\\\b(UK|United Kingdom|Britain)\\\\b)).*$'
			},
			{
				name: '♻️ 法国自动 🇫🇷',
				type: 'url-test',
				'include-all': true,
				tolerance: 30,
				interval: 300,
				filter: '^(?!.*(10x|6x))(?=.*((?i)🇫🇷|法国|巴黎|马赛|\\\\b(FR|France)\\\\b)).*$'
			},
			{
				name: '♻️ 德国自动 🇩🇪',
				type: 'url-test',
				'include-all': true,
				tolerance: 30,
				interval: 300,
				filter: '^(?!.*(10x|6x))(?=.*((?i)🇩🇪|德国|柏林|法兰克福|慕尼黑|\\\\b(DE|Germany)\\\\b)).*$'
			},
			{
				name: '♻️ 澳洲自动 🇦🇺',
				type: 'url-test',
				'include-all': true,
				tolerance: 30,
				interval: 300,
				filter: '^(?!.*(10x|6x))(?=.*((?i)🇦🇺|澳大利亚|澳洲|悉尼|墨尔本|\\\\b(AU|AUS|Australia)\\\\b)).*$'
			},
			{
				name: '♻️ 香港自动 🇭🇰',
				type: 'url-test',
				'include-all': true,
				tolerance: 30,
				interval: 300,
				filter: '^(?!.*(10x|6x))(?=.*((?i)🇭🇰|香港|九龙|新界|\\\\b(HK|HongKong|Hong Kong)\\\\b)).*$'
			},
			{
				name: '♻️ 自动选择',
				type: 'url-test',
				'include-all': true,
				tolerance: 30,
				interval: 300,
				'exclude-filter': '^(?=.*((?i)10x|6x|过滤|客户端|不要|付款|如果|群|邀请|返利|循环|官网|客服|网站|网址|获取|订阅|流量|到期|机场|下次|版本|官址|备用|过期|已用|联系|邮箱|工单|贩卖|通知|倒卖|防止|国内|地址|频道|无法|说明|使用|提示|特别|访问|支持|教程|关注|更新|建议|备用|作者|加入|\\\\b(USE|USED|TOTAL|EXPIRE|EMAIL|Panel|Channel|Author)\\\\b|(\\\\d{4}-\\\\d{2}-\\\\d{2}|\\\\d+G))).*$'
			},
			{
				name: '🔯 日本故障转移 🇯🇵',
				type: 'fallback',
				'include-all': true,
				interval: 300,
				filter: '^(?!.*(10x|6x))(?=.*((?i)🇯🇵|日本|东京|大阪|京都|名古屋|埼玉|\\\\b(JP|Japan)\\\\b)).*$'
			},
			{
				name: '🔯 新加坡故障转移 🇸🇬',
				type: 'fallback',
				'include-all': true,
				interval: 300,
				filter: '^(?!.*(10x|6x))(?=.*((?i)🇸🇬|新加坡|新加坡|\\\\b(SG|Singapore)\\\\b)).*$'
			},
			{
				name: '🔯 美国故障转移 🇺🇸',
				type: 'fallback',
				'include-all': true,
				interval: 300,
				filter: '^(?!.*(10x|6x))(?=.*((?i)🇺🇸|美国|波特兰|达拉斯|俄勒冈|凤凰城|费利蒙|硅谷|拉斯维加斯|洛杉矶|圣何塞|圣克拉拉|西雅图|芝加哥|\\\\b(US|United States|America)\\\\b)).*$'
			},
			{
				name: '🔯 台湾故障转移 🇨🇳',
				type: 'fallback',
				'include-all': true,
				interval: 300,
				filter: '^(?!.*(10x|6x))(?=.*((?i)🇹🇼|台湾|台北|新北|高雄|\\\\b(TW|Taiwan|Tai wan)\\\\b)).*$'
			},
			{
				name: '🔯 香港故障转移 🇭🇰',
				type: 'fallback',
				'include-all': true,
				interval: 300,
				filter: '^(?!.*(10x|6x))(?=.*((?i)🇭🇰|香港|九龙|新界|\\\\b(HK|HongKong|Hong Kong)\\\\b)).*$'
			},
			{
				name: '🔯 韩国故障转移 🇰🇷',
				type: 'fallback',
				'include-all': true,
				interval: 300,
				filter: '^(?!.*(10x|6x))(?=.*((?i)🇰🇷|韩国|韓國|首尔|釜山|\\\\b(KR|Korea)\\\\b)).*$'
			},
			{
				name: '🔯 英国故障转移 🇬🇧',
				type: 'fallback',
				'include-all': true,
				interval: 300,
				filter: '^(?!.*(10x|6x))(?=.*((?i)🇬🇧|英国|伦敦|曼彻斯特|\\\\b(UK|United Kingdom|Britain)\\\\b)).*$'
			},
			{
				name: '🔯 法国故障转移 🇫🇷',
				type: 'fallback',
				'include-all': true,
				interval: 300,
				filter: '^(?!.*(10x|6x))(?=.*((?i)🇫🇷|法国|巴黎|马赛|\\\\b(FR|France)\\\\b)).*$'
			},
			{
				name: '🔯 德国故障转移 🇩🇪',
				type: 'fallback',
				'include-all': true,
				interval: 300,
				filter: '^(?!.*(10x|6x))(?=.*((?i)🇩🇪|德国|柏林|法兰克福|慕尼黑|\\\\b(DE|Germany)\\\\b)).*$'
			},
			{
				name: '🔯 澳洲故障转移 🇦🇺',
				type: 'fallback',
				'include-all': true,
				interval: 300,
				filter: '^(?!.*(10x|6x))(?=.*((?i)🇦🇺|澳大利亚|澳洲|悉尼|墨尔本|\\\\b(AU|AUS|Australia)\\\\b)).*$'
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
				name: '🇺🇲 美国节点',
				type: 'select',
				'include-all': true,
				filter: '^(?!.*(10x|6x))(?=.*((?i)🇺🇸|美国|波特兰|达拉斯|俄勒冈|凤凰城|费利蒙|硅谷|拉斯维加斯|洛杉矶|圣何塞|圣克拉拉|西雅图|芝加哥|\\\\b(US|United States|America)\\\\b)).*$'
			},
			{
				name: '🇰🇷 韩国节点',
				type: 'select',
				'include-all': true,
				filter: '^(?!.*(10x|6x))(?=.*((?i)🇰🇷|韩国|韓國|首尔|釜山|\\\\b(KR|Korea)\\\\b)).*$'
			},
			{
				name: '🇬🇧 英国节点',
				type: 'select',
				'include-all': true,
				filter: '^(?!.*(10x|6x))(?=.*((?i)🇬🇧|英国|伦敦|曼彻斯特|\\\\b(UK|United Kingdom|Britain)\\\\b)).*$'
			},
			{
				name: '🇫🇷 法国节点',
				type: 'select',
				'include-all': true,
				filter: '^(?!.*(10x|6x))(?=.*((?i)🇫🇷|法国|巴黎|马赛|\\\\b(FR|France)\\\\b)).*$'
			},
			{
				name: '🇩🇪 德国节点',
				type: 'select',
				'include-all': true,
				filter: '^(?!.*(10x|6x))(?=.*((?i)🇩🇪|德国|柏林|法兰克福|慕尼黑|\\\\b(DE|Germany)\\\\b)).*$'
			},
			{
				name: '🇨🇳 台湾节点',
				type: 'select',
				'include-all': true,
				filter: '^(?!.*(10x|6x))(?=.*((?i)🇹🇼|台湾|台北|新北|高雄|\\\\b(TW|Taiwan|Tai wan)\\\\b)).*$'
			},
			{
				name: '🇦🇺 澳洲节点',
				type: 'select',
				'include-all': true,
				filter: '^(?!.*(10x|6x))(?=.*((?i)🇦🇺|澳大利亚|澳洲|悉尼|墨尔本|\\\\b(AU|AUS|Australia)\\\\b)).*$'
			},
			{
				name: '🇭🇰 香港节点',
				type: 'select',
				'include-all': true,
				filter: '^(?!.*(10x|6x))(?=.*((?i)🇭🇰|香港|九龙|新界|\\\\b(HK|HongKong|Hong Kong)\\\\b)).*$'
			},
			{
				name: '🌐 全部节点',
				type: 'select',
				'include-all': true,
				'exclude-filter': '^(?=.*((?i)10x|6x|过滤|客户端|不要|付款|如果|群|邀请|返利|循环|官网|客服|网站|网址|获取|订阅|流量|到期|机场|下次|版本|官址|备用|过期|已用|联系|邮箱|工单|贩卖|通知|倒卖|防止|国内|地址|频道|无法|说明|使用|提示|特别|访问|支持|教程|关注|更新|建议|备用|作者|加入|\\\\b(USE|USED|TOTAL|EXPIRE|EMAIL|Panel|Channel|Author)\\\\b|(\\\\d{4}-\\\\d{2}-\\\\d{2}|\\\\d+G))).*$'
			}
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
			'Advertising-ads': {
				type: 'http',
				interval: 3600,
				behavior: 'domain',
				format: 'mrs',
				proxy: '🚀 默认代理',
				url: 'https://cdn.jsdmirror.com/gh/TG-Twilight/AWAvenue-Ads-Rule@main/Filters/AWAvenue-Ads-Rule-Clash.mrs',
				path: './ruleset/Advertising-ads.mrs'
			},
			reject_non_ip_no_drop: {
				type: 'http',
				behavior: 'classical',
				interval: 43200,
				format: 'text',
				proxy: '🚀 默认代理',
				url: 'https://ruleset.skk.moe/Clash/non_ip/reject-no-drop.txt',
				path: './ruleset/reject_non_ip_no_drop.txt'
			},
			reject_non_ip_drop: {
				type: 'http',
				behavior: 'classical',
				interval: 43200,
				format: 'text',
				proxy: '🚀 默认代理',
				url: 'https://ruleset.skk.moe/Clash/non_ip/reject-drop.txt',
				path: './ruleset/reject_non_ip_drop.txt'
			},
			reject_non_ip: {
				type: 'http',
				behavior: 'classical',
				interval: 43200,
				format: 'text',
				proxy: '🚀 默认代理',
				url: 'https://ruleset.skk.moe/Clash/non_ip/reject.txt',
				path: './ruleset/reject_non_ip.txt'
			},
			reject_domainset: {
				type: 'http',
				behavior: 'domain',
				interval: 43200,
				format: 'text',
				proxy: '🚀 默认代理',
				url: 'https://ruleset.skk.moe/Clash/domainset/reject.txt',
				path: './ruleset/reject_domainset.txt'
			},
			reject_extra_domainset: {
				type: 'http',
				behavior: 'domain',
				interval: 43200,
				format: 'text',
				proxy: '🚀 默认代理',
				url: 'https://ruleset.skk.moe/Clash/domainset/reject_extra.txt',
				path: './ruleset/reject_domainset_extra.txt'
			},
			reject_ip: {
				type: 'http',
				behavior: 'classical',
				interval: 43200,
				format: 'text',
				proxy: '🚀 默认代理',
				url: 'https://ruleset.skk.moe/Clash/ip/reject.txt',
				path: './ruleset/reject_ip.txt'
			},
		};

		// submerge规则匹配
		config.rules = [
			// 自定义优先规则
			'DOMAIN-SUFFIX,linux.do,Linux DO',
			'DOMAIN-SUFFIX,adobe.io,REJECT',
			'DOMAIN-SUFFIX,adobestats.io,REJECT',
			'DOMAIN-SUFFIX,bilibili.com,DIRECT',
			'DOMAIN-SUFFIX,cdn.bcebos.com,DIRECT',
			'RULE-SET,Advertising-ads,REJECT',
			// 内网
			'IP-CIDR,224.0.0.0/24,DIRECT,no-resolve',
			'RULE-SET,Private,DIRECT',
			'RULE-SET,LAN,DIRECT',
			'RULE-SET,Fakeip_Filter,DIRECT',

			// 特定服务规则
			'RULE-SET,ai,AI服务',
			'DOMAIN-SUFFIX,cloudflare.com,🚀 默认代理',
			'DOMAIN-SUFFIX,codebuddy.ai,AI服务',
			'DOMAIN-SUFFIX,github.com,🚀 默认代理',
			'RULE-SET,github_domain,🚀 默认代理',
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
			'DOMAIN,cdn.jsdmirror.com,🚀 默认代理',
			'DOMAIN,raw.githubusercontent.com,🚀 默认代理',
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
			// 兜底规则
			'MATCH,🚀 默认代理'
		];

		const yamlContent = convertToYAML(config);

		return new Response(yamlContent, {
			headers: {
				'Content-Type': 'text/yaml; charset=utf-8',
				'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(collection.name)}`
			}
		});
	} catch (error) {
		return new Response('生成配置失败', { status: 500 });
	}
}


// 解析代理URL
function parseProxyUrl(url, region = null) {
	try {
		// 支持vmess, vless, ss, ssr, hysteria, hysteria2, trojan, tuic等协议
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
		cipher: 'auto',
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

	// 添加 gRPC 配置
	if (data.net === 'grpc') {
		config['grpc-opts'] = {};
		if (data.path) {
			config['grpc-opts']['grpc-service-name'] = data.path;
		}
	}

	// 添加 HTTP/2 配置
	if (data.net === 'h2') {
		config['h2-opts'] = {};
		if (data.host) {
			config['h2-opts'].host = data.host.split(',');
		}
		if (data.path) {
			config['h2-opts'].path = data.path;
		}
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

	// 添加认证字符串
	if (parsed.username) {
		config['auth-str'] = parsed.username;
	}

	// 添加端口范围
	if (params.get('ports')) {
		config.ports = params.get('ports');
	}

	// 添加混淆
	if (params.get('obfs')) {
		config.obfs = params.get('obfs');
	}

	// 添加 ALPN
	if (params.get('alpn')) {
		config.alpn = params.get('alpn').split(',');
	}

	// 添加协议
	if (params.get('protocol')) {
		config.protocol = params.get('protocol');
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

	// 添加 ECH 配置
	if (params.get('ech-enable') === 'true') {
		config['ech-opts'] = {
			enable: true
		};
		if (params.get('ech-config')) {
			config['ech-opts'].config = params.get('ech-config');
		}
	}

	// 添加跳过证书验证
	if (params.get('skip-cert-verify')) {
		config['skip-cert-verify'] = params.get('skip-cert-verify') === 'true';
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

	// 对于IP地址的URL，由于Cloudflare Workers限制，直接返回默认成功状态
	if (isIpAddress(subUrl)) {
		console.log(`跳过IP地址信息获取: ${subUrl}`);
		subInfo.success = true;
		subInfo.statusCode = 200; // 假设成功
		subInfo.name = ''; // 无法获取名称，将使用默认命名
		return subInfo;
	}

	try {
		// 使用轮询方式尝试不同的 User-Agent，设置较短的超时时间用于活跃检测
		const result = await fetchWithUserAgentRotation(subUrl, 8000);
		const response = result.response;

		subInfo.statusCode = response.status;
		subInfo.success = response.ok; // 200-299 范围内的状态码被认为是成功的

		console.log(`订阅 ${subUrl} 使用 ${result.userAgent} 请求成功`);

		// 获取响应头（大小写不敏感）
		// 尝试多种可能的大小写组合
		let contentDisposition = response.headers.get('content-disposition') ||
			response.headers.get('Content-Disposition') ||
			response.headers.get('CONTENT-DISPOSITION');

		let userInfo = response.headers.get('subscription-userinfo') ||
			response.headers.get('Subscription-Userinfo') ||
			response.headers.get('SUBSCRIPTION-USERINFO');

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
async function handleSubscriptionCheck(request, env) {
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
function formatServerAddress(server, port) {
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
