# Clash订阅生成器

一个部署在Cloudflare Workers上的Clash订阅生成器，支持节点整合和订阅整合，**将繁多冗杂的节点或订阅合并成一个链接**。

*本项目由Claude Code生成 (包括README)*

<div align="center">
  <table border="0" style="border-collapse: collapse;">
    <tr>
      <td align="center">
        <img src="https://github.com/redf1rst/clash-sub/blob/main/img/proxysub.png?raw=true" alt="代理订阅界面" width="700">
      </td>
    </tr>
    <tr>
      <td align="center" style="padding-top: 5px;">
        <em><small>节点整合-Proxysub</small></em>
      </td>
    </tr>
  </table>
</div>

<br>

<div align="center">
  <table border="0" style="border-collapse: collapse;">
    <tr>
      <td align="center">
        <img src="https://github.com/redf1rst/clash-sub/blob/main/img/submerge.png?raw=true" alt="订阅整合界面" width="700">
      </td>
    </tr>
    <tr>
      <td align="center" style="padding-top: 5px;">
        <em><small>订阅整合-SubMerge</small></em>
      </td>
    </tr>
  </table>
</div>

---

## 功能特性

### 节点整合
`(可能会有不对的地方没有完全测试)`
- 支持添加 vmess, vless, ss, hysteria2, trojan, tuic 等一个或多个节点
- 自动识别地区并按规则命名节点（如：HK香港01-IPv4, JP日本02-IPv6）
- 支持自动去重，避免重复添加
- 节点管理 (删除&清空)

### 订阅整合
- 基于Linuxdo论坛的配置模板
- 支持添加一个或多个订阅链接
- 支持自动去重，避免重复添加
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
```

### 3. 创建KV命名空间
```bash
# 创建生产环境KV
wrangler kv namespace create "CLASH_KV"
```

### 4. 更新wrangler.jsonc 配置文件 (删除.example)
将上一步获得的KV命名空间ID填入wrangler.jsonc文件中：
```jsonc
{
  "kv_namespaces": [
    {
      "binding": "CLASH_KV",
      "id": "你的KV命名空间ID"
    }
  ]
}
```
```
# 给Worker更名 (可选)
{
  "name": "clash-sub" // <--- 你可以修改这个名称
}
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
2. 在`节点整合`标签页中输入一个或多个节点链接，每行一个，点击添加节点
3. 如果未能自动识别到地区，可以删除后手动选择地区添加
4. 复制生成的订阅链接到Clash客户端 或 更新客户端订阅

### 订阅整合
1. 访问部署后的Worker URL
2. 在`订阅整合`标签页中输入一个或多个订阅链接，每行一个，点击添加订阅
3. 复制生成的整合订阅链接到Clash客户端 或 更新客户端订阅


