# Clash订阅生成器

一个部署在Cloudflare Workers上的Clash系订阅转换工具，支持节点集合和订阅集合。


<div align="center">
  <table border="0" style="border-collapse: collapse;">
    <tr>
      <td align="center">
        <img src="https://github.com/redf1rst/Clash-Sub/blob/main/img/%E9%9B%86%E5%90%88%E7%95%8C%E9%9D%A2.png?raw=true" alt="collection" width="700">
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
        <img src="https://github.com/redf1rst/Clash-Sub/blob/main/img/%E7%AE%A1%E7%90%86%E7%AA%97%E5%8F%A3.png?raw=true" alt="manager" width="700">
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

###  节点集合管理
- **节点合并**：管理零散节点,整合为一个订阅配置
- **协议支持**：vmess, vless, ss, ssr, hysteria, hysteria2, trojan, tuic
- **自定义操作**: 支持节点重命名和IP/域名更改(用于优选)
- **智能命名**：自动识别节点地区并统一命名 (可能因服务器非落地节点而有误,出错请自行更改)
- **混合格式**：支持链接格式和JSON格式(单行)节点的混合添加
- **批量操作**：支持节点的批量复制/删除操作

###  订阅集合管理
- **订阅合并**：多订阅合并订阅配置
- **活跃检测**：支持检测订阅连通性和有效性 (可能不太准确,谨慎使用)
- **批量操作**：支持订阅的批量复制/删除操作
- **自定义操作**: 节点名称前是否添加前缀

###  访问令牌认证
- **Cookie认证**：基于访问令牌(Token)的Cookie认证保护,Cookie默认有效期30天


## 部署步骤

### 1. 克隆项目到本地
```bash
git clone https://github.com/redf1rst/clash-sub.git
```
```bash
cd clash-sub
```

### 2. 安装wangler
```bash
# 安装 wrangler
npm install -g wrangler

# 登录 wrangler
wrangler login
```

### 3. 创建KV命名空间
```bash
# 创建生产环境KV,并记下KV命名空间ID
wrangler kv namespace create "CLASH_KV"
```

### 4. 更新 wrangler.toml 配置文件
复制 wrangler.example.toml 到 wrangler.toml,
将上一步获得的KV命名空间ID填入 wrangler.toml 文件中：
```toml
# Worker名称 (可选修改)
name = "clash-sub"

# KV命名空间配置
[[kv_namespaces]]
binding = "CLASH_KV"
id = "你的KV命名空间ID"

[vars]
ACCESS_TOKEN_ENABLED = "true" # 启用令牌验证
```

### 5. 配置访问令牌

**方式一：使用 Secrets (推荐)**
```bash
# 设置访问令牌
wrangler secret put ACCESS_TOKEN
# 输入: your-secret-token
```

**方式二：使用环境变量 (仅本地开发)**
```toml
# 在 wrangler.toml 中添加 (不要提交到Git)
[vars]
ACCESS_TOKEN_DEV = "your-secret-token"
```

### 6. 部署
```bash
# 直接部署到 Cloudflare Workers
wrangler deploy

# 或者先本地测试
wrangler dev
```
部署后使用worker链接登录管理页面

### 7. 兼容性问题
由于本项目是部署在Cloudflare Worker的项目,部分订阅提供者会使用Cloudflare的服务,可能会导致订阅添加失败
解决方案:没啥好办法解决:(,可以单独去把订阅链接的节点信息提出来,通过节点集合添加到新的订阅里.


### 版本历史

- **v3.6**
  -  **访问令牌认证**：Cookie令牌认证保护管理页面
  -  **增加自定义**: 节点集合支持优选IP和重命名,订阅集合支持是否在节点名称前添加前缀
  -  **界面优化**：改善了一些UI

- **v3.0**
  -  **集合管理**：创建和管理多个独立的订阅配置
  -  **混合格式支持**：同时支持链接格式和JSON格式节点的混合添加
  -  **自动节点命名**：节点自动地区检测和统一命名（如：US美国001-IPv6）
  -  **界面优化**：改善了一些UI

- **v2.0**
  -  **批量操作**：支持节点和订阅的批量复制、删除
  -  **稳定性提升**：修复各种边界情况和错误处理

- **v1.0**
  -  **节点整合**：支持vmess、vless、ss、hysteria2、trojan、tuic等协议
  -  **订阅整合**：基于自用的配置模板
  -  **地区识别**：少量的地区映射
  -  **去重功能**：自动过滤重复的节点和订阅


