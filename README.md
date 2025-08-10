# Clash订阅生成器

一个部署在Cloudflare Workers上的Clash订阅生成器，支持节点整合和订阅整合两大功能。

## 功能特性

### 节点整合
- 支持添加 vmess, vless, ss, hysteria2, trojan 等所有类型节点
- 自动识别地区并按规则命名节点（如：HK1-IPv4, JP2-IPv6）
- 支持IPv4和IPv6节点
- 节点查重功能，避免重复添加（IP+端口相同）
- 前端显示已加入节点信息（名称、IP、协议类型）
- 支持删除单个节点和全部清空
- 生成固定的clash订阅链接，配置命名为ProxySub

### 订阅整合
- 基于SubMerge.yaml配置模板
- 支持添加多个订阅链接到proxy-providers
- 订阅链接查重功能
- 前端显示已加入订阅信息
- 支持删除单个订阅和全部清空
- 生成固定的clash订阅链接，配置命名为SubMerge

## 部署步骤

### 1. 克隆项目到本地
```bash
git clone https://...
```
```bash
cd clash-sub
```

### 2. 创建KV命名空间
```bash
# 创建生产环境KV
wrangler kv namespace create "CLASH_KV"
```
```
# 创建预览环境KV
wrangler kv namespace create "CLASH_KV" --preview
```

### 3. 更新wrangler.toml (并删除wrangler.jsonc)
将上一步获得的KV命名空间ID填入wrangler.toml文件中：
```toml
[[kv_namespaces]]
binding = "CLASH_KV"
id = "你的KV命名空间ID"
preview_id = "你的preview KV命名空间ID"
```

### 3. 部署
```bash
# 部署到Cloudflare Workers
wrangler deploy
```
```
# 或者先本地测试
wrangler dev
```

## 使用方法

### 节点整合
1. 访问部署后的Worker URL
2. 在"节点整合"标签页中输入节点链接
3. 支持的协议格式：
   - VMess: `vmess://base64编码的配置`
   - VLess: `vless://uuid@server:port?参数#备注`
   - Shadowsocks: `ss://base64编码@server:port#备注`
   - Hysteria2: `hysteria2://password@server:port#备注`
   - Trojan: `trojan://password@server:port?参数#备注`
4. 复制生成的订阅链接到Clash客户端

### 订阅整合
1. 在"订阅整合"标签页中输入现有的Clash订阅链接
2. 可以添加多个订阅链接
3. 复制生成的整合订阅链接到Clash客户端

## API接口

### 节点管理
- `GET /api/proxies` - 获取所有节点
- `POST /api/proxies` - 管理节点（添加/删除/清空）

### 订阅管理
- `GET /api/submerge` - 获取所有订阅
- `POST /api/submerge` - 管理订阅（添加/删除/清空）

### 配置生成
- `GET /clash/proxies` - 生成节点配置文件
- `GET /clash/submerge` - 生成订阅整合配置文件

## 技术特点

- 🚀 基于Cloudflare Workers，全球CDN加速
- 💾 使用KV存储持久化数据
- 🎨 扁平化UI设计，响应式布局
- 🔒 支持多种代理协议解析
- 🌍 智能地区识别
- ⚡ 无服务器架构，按需付费

## 注意事项

1. KV存储有免费额度限制，注意使用量
2. 节点链接需要是有效的格式
3. 建议定期备份重要的节点和订阅数据
