# Clash订阅生成器

一个部署在Cloudflare Workers上的Clash订阅生成器，支持节点整合和订阅整合。

*本项目由Claude Code生成 (包括README)*

<div align="center">
  <table border="0" style="border-collapse: collapse;">
    <tr>
      <td align="center">
        <img src="https://github.com/redf1rst/clash-sub/blob/main/img/proxyhub.png?raw=true" alt="collection" width="700">
      </td>
    </tr>
    <tr>
      <td align="center" style="padding-top: 5px;">
        <em><small>集合页面</small></em>
      </td>
    </tr>
  </table>
</div>

<br>

<div align="center">
  <table border="0" style="border-collapse: collapse;">
    <tr>
      <td align="center">
        <img src="https://github.com/redf1rst/clash-sub/blob/main/img/proxymanage.png?raw=true" alt="manager" width="700">
      </td>
    </tr>
    <tr>
      <td align="center" style="padding-top: 5px;">
        <em><small>管理窗口</small></em>
      </td>
    </tr>
  </table>
</div>

---

## 🌟 功能特性

### 🎯 节点集合管理
- **多集合管理**：创建和管理多个独立订阅链接
- **智能命名**：自动识别节点地区并统一命名
- **混合格式**：支持链接格式和JSON格式(单行)节点的混合添加
- **批量操作**：支持节点的批量操作
- **协议支持**：vmess, vless, ss, ssr, hysteria, hysteria2, trojan, tuic

### 📡 订阅集合管理
- **多集合管理**：创建和管理多个独立的订阅集合，便于分类管理
- **活跃检测**：支持检测订阅连通性和有效性
- **批量操作**：支持订阅的批量操作


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
npm install -g wrangler

# 登录 wrangler
wrangler login
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
部署后使用worker链接即可登录管理页面


### 版本历史

- **v3.0**
  - 🎯 **集合管理**：创建和管理多个独立的订阅链接
  - ✨ **混合格式支持**：同时支持链接格式和JSON格式节点的混合添加
  - ✨ **自动节点命名**：节点自动地区检测和统一命名（如：US美国01-IPv4）
  - 🔧 **界面优化**：改善了一些UI

- **v2.0**
  - 🔄 **批量操作**：支持节点和订阅的批量选择、复制、删除
  - 🛠️ **稳定性提升**：修复各种边界情况和错误处理

- **v1.0**
  - 🔗 **节点整合**：支持vmess、vless、ss、hysteria2、trojan、tuic等协议
  - 📡 **订阅整合**：基于自用的配置模板
  - 🌍 **地区识别**：自动识别节点地区并规范命名
  - 🚫 **去重功能**：自动过滤重复的节点和订阅


