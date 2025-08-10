# Clash订阅生成器

一个部署在Cloudflare Workers上的Clash订阅生成器，支持节点整合和订阅整合,将收集到的节点或者订阅装换成一个链接。

*本项目由Claude Code生成 (包括README)*

## 功能特性

### 节点整合
`(可能会有不对的地方没有完全测试)`
- 支持添加 vmess, vless, ss, hysteria2, trojan 等一个或多个节点
- 自动识别地区并按规则命名节点（如：HK香港01-IPv4, JP日本02-IPv6）
- 节点查重，避免重复添加
- 节点管理 (删除&清空)

### 订阅整合
- 基于Linuxdo论坛的配置模板
- 支持添加一个或多个订阅链接
- 订阅链接查重，避免重复添加
- 订阅管理 (删除&清空)

## 部署步骤

### 1. 克隆项目到本地
```bash
git clone https://github.com/redf1rst/clash-sub.git
```
```bash
cd clash-sub
```

### 2. 安装依赖
```bash
# 安装 wrangler
npm install

# 登录 wrangler
npx wrangler login

# 给Worker更名 (可选)
# 打开根目录下的 wrangler.toml
name = "clash-sub" # <--- 你可以修改这个名称
main = "src/index.js"
compatibility_date = "2025-08-08"
# ...
```

### 3. 创建KV命名空间
```bash
# 创建生产环境KV
wrangler kv namespace create "CLASH_KV"

# 创建预览环境KV
wrangler kv namespace create "CLASH_KV" --preview
```

### 4. 更新wrangler.toml
(并删除wrangler.jsonc)
将上一步获得的KV命名空间ID填入wrangler.toml文件中：
```toml
[[kv_namespaces]]
binding = "CLASH_KV"
id = "你的KV命名空间ID"
preview_id = "你的preview KV命名空间ID"
```

### 5. 部署
```bash
# 直接部署到 Cloudflare Workers
wrangler deploy

# 或者先本地测试
wrangler dev
```

## 使用方法

### 节点整合
1. 访问部署后的Worker URL
2. 在"节点整合"标签页中输入一个或多个节点链接，每行一个
3. 支持的协议格式：
   - VMess: `vmess://base64编码的配置`
   - VLess: `vless://uuid@server:port?参数#备注`
   - Shadowsocks: `ss://base64编码@server:port#备注`
   - Hysteria2: `hysteria2://password@server:port#备注`
   - Trojan: `trojan://password@server:port?参数#备注`
4. 复制生成的订阅链接到Clash客户端

### 订阅整合
1. 在"订阅整合"标签页中输入一个或多个Clash订阅链接，每行一个
2. 复制生成的整合订阅链接到Clash客户端

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
- 🎨 UI界面，响应式布局
- 🔒 支持多种代理协议解析
- 🌍 智能地区识别

## 注意事项

1. KV存储有免费额度限制，注意使用量
2. 节点链接需要是有效的格式
3. 建议定期备份重要的节点和订阅数据
