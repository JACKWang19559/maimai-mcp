# maimai-mcp

[Model Context Protocol](https://modelcontextprotocol.io/) server wrapping [maimai-cli](https://github.com/lsongdev/maimai-js)，让 AI Agent 能调用脉脉的招聘功能。

## 暴露工具

| 工具名 | 类型 | 说明 |
|---|---|---|
| `maimai_get_contacts` | 只读 | 获取脉脉联系人列表 |
| `maimai_recommend_talents` | 只读 | 根据职位 ID 获取推荐人才 |
| `maimai_get_dialog` | 只读 | 获取与指定联系人的对话历史 |
| `maimai_recruiter_send` | 写操作 | 招聘立即沟通，向候选人发消息 |
| `maimai_enterprise_send` | 写操作 | 企业极速联系候选人 |

## 安装

```bash
cd c:\Users\Administrator\Desktop\面试\maimai-mcp
npm install
```

## 获取脉脉认证信息

1. 浏览器登录 https://maimai.cn/
2. F12 打开开发者工具 → Application → Cookies → `https://maimai.cn`
3. 复制两个 cookie 值：
   - `u` → 作为 `MAIMAI_U`
   - `access_token` → 作为 `MAIMAI_ACCESS_TOKEN`

⚠️ access_token 是敏感凭据，**不要提交到 git 或公开分享**。

## MCP 配置

将以下配置添加到你的 MCP 客户端（Claude Desktop / TRAE / Cursor 等）的 `mcpServers` 配置中：

```json
{
  "mcpServers": {
    "maimai": {
      "command": "node",
      "args": [
        "c:\\Users\\Administrator\\Desktop\\面试\\maimai-mcp\\index.js"
      ],
      "env": {
        "MAIMAI_U": "你的脉脉用户ID",
        "MAIMAI_ACCESS_TOKEN": "你的脉脉access_token"
      }
    }
  }
}
```

可选环境变量：
- `MAIMAI_CLI_PATH`：自定义 maimai-cli 目录路径（默认指向 `.trae-cn/mcps/recruitment_tools/maimai-cli`）

## 安全审计

写操作（`maimai_recruiter_send` / `maimai_enterprise_send`）调用前会在 stderr 打印审计日志：

```
[maimai-mcp][审计] recruiter_send -> uid=123456, content=您好...
```

便于在 MCP 客户端的日志面板追踪 AI 的发消息行为。

## 依赖

- Node.js ≥ 18
- `@modelcontextprotocol/sdk` ≥ 1.0.0
- 本地 `maimai-cli` 包（自动从 `MAIMAI_CLI_PATH` 或默认路径加载）
