#!/usr/bin/env node
/**
 * maimai-mcp: MCP server wrapping maimai-cli
 *
 * 暴露 5 个工具：
 *   1. maimai_get_contacts     — 获取联系人列表（只读）
 *   2. maimai_recommend_talents — 获取推荐人才列表（只读）
 *   3. maimai_get_dialog       — 获取对话消息历史（只读）
 *   4. maimai_recruiter_send   — 招聘立即沟通（写操作）
 *   5. maimai_enterprise_send  — 极速联系候选人（写操作）
 *
 * 认证：通过环境变量 MAIMAI_U 和 MAIMAI_ACCESS_TOKEN 传入
 *   - MAIMAI_U            : 脉脉用户ID（从网页 cookie 获取）
 *   - MAIMAI_ACCESS_TOKEN : 脉脉 access_token（从网页 cookie 获取）
 *
 * 安全：写操作会在 stderr 打印审计日志，便于追踪
 */

'use strict';

const path = require('path');
const fs = require('fs');

// 引入本地 maimai-cli（位于 .trae-cn/mcps/recruitment_tools/maimai-cli）
const MAIMAI_CLI_PATH = path.resolve(
  process.env.MAIMAI_CLI_PATH ||
  'c:\\Users\\Administrator\\.trae-cn\\mcps\\recruitment_tools\\maimai-cli'
);

// 检查 maimai-cli 是否存在
if (!fs.existsSync(path.join(MAIMAI_CLI_PATH, 'index.js'))) {
  console.error(`[maimai-mcp] 错误：maimai-cli 未找到于 ${MAIMAI_CLI_PATH}`);
  console.error('[maimai-mcp] 请设置 MAIMAI_CLI_PATH 环境变量指向 maimai-cli 目录');
  process.exit(1);
}

const maimai = require(MAIMAI_CLI_PATH);

// 引入 MCP SDK
const { Server } = require('@modelcontextprotocol/sdk/server/index.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const { CallToolRequestSchema, ListToolsRequestSchema } = require('@modelcontextprotocol/sdk/types.js');

/**
 * 从环境变量读取认证信息
 * @returns {{u: string, access_token: string}}
 */
function loadCredentials() {
  const u = process.env.MAIMAI_U;
  const access_token = process.env.MAIMAI_ACCESS_TOKEN;
  if (!u || !access_token) {
    console.error('[maimai-mcp] 错误：缺少环境变量 MAIMAI_U 或 MAIMAI_ACCESS_TOKEN');
    console.error('[maimai-mcp] 获取方式：登录脉脉网页版 → F12 开发者工具 → Application → Cookies');
    console.error('[maimai-mcp]   - MAIMAI_U            = cookie 中的 u 值');
    console.error('[maimai-mcp]   - MAIMAI_ACCESS_TOKEN = cookie 中的 access_token 值');
    process.exit(1);
  }
  return { u, access_token };
}

// 加载认证
const credentials = loadCredentials();

/**
 * 获取 Chat 客户端实例
 * @returns {maimai.Chat}
 */
function getChatClient() {
  return new maimai.Chat(credentials);
}

/**
 * 获取 Enterprise 客户端实例
 * @returns {maimai.Enterprise}
 */
function getEnterpriseClient() {
  return new maimai.Enterprise(credentials);
}

/**
 * 工具定义表
 * 每个工具包含 name、description、inputSchema 和 handler
 */
const TOOLS = [
  {
    name: 'maimai_get_contacts',
    description: '[只读] 获取脉脉联系人列表（好友）。返回联系人列表，包含用户ID、姓名、职位等。',
    inputSchema: {
      type: 'object',
      properties: {
        paginate: {
          type: 'number',
          description: '分页标识，默认 0（首页）',
          default: 0
        }
      }
    },
    handler: async (args) => {
      const chat = getChatClient();
      const result = await chat.pbd1({ paginate: args.paginate || 0 });
      return result;
    }
  },
  {
    name: 'maimai_recommend_talents',
    description: '[只读] 根据已发布的职位ID获取脉脉推荐人才列表（招聘方功能）。需要招聘方账号权限。',
    inputSchema: {
      type: 'object',
      properties: {
        jid: {
          type: 'string',
          description: '脉脉职位ID（在脉脉招聘后台获取）'
        },
        page: {
          type: 'number',
          description: '页码，默认 1',
          default: 1
        }
      },
      required: ['jid']
    },
    handler: async (args) => {
      const enterprise = getEnterpriseClient();
      const result = await enterprise.recommend(args.jid, { page: args.page || 1 });
      return result;
    }
  },
  {
    name: 'maimai_get_dialog',
    description: '[只读] 获取与指定联系人的对话消息历史。',
    inputSchema: {
      type: 'object',
      properties: {
        mid: {
          type: 'string',
          description: '对方用户ID（联系人ID）'
        },
        count: {
          type: 'number',
          description: '拉取消息条数，默认 10',
          default: 10
        }
      },
      required: ['mid']
    },
    handler: async (args) => {
      const chat = getChatClient();
      const result = await chat.get_dlg(args.mid, { count: args.count || 10 });
      return result;
    }
  },
  {
    name: 'maimai_recruiter_send',
    description: '[写操作] 招聘立即沟通：以招聘方身份向候选人发送消息。调用前会在 stderr 打印审计日志。需招聘方账号权限。',
    inputSchema: {
      type: 'object',
      properties: {
        uid: {
          type: 'string',
          description: '候选人脉脉用户ID'
        },
        content: {
          type: 'string',
          description: '要发送的消息内容'
        }
      },
      required: ['uid', 'content']
    },
    handler: async (args) => {
      console.error(`[maimai-mcp][审计] recruiter_send -> uid=${args.uid}, content=${args.content}`);
      const chat = getChatClient();
      const result = await chat.recruiter_send(args.uid, args.content);
      return result;
    }
  },
  {
    name: 'maimai_enterprise_send',
    description: '[写操作] 企业极速联系候选人。调用前会在 stderr 打印审计日志。需企业招聘方账号权限。',
    inputSchema: {
      type: 'object',
      properties: {
        to_uids: {
          type: 'string',
          description: '目标用户ID（脉脉字符串形式）'
        },
        content: {
          type: 'string',
          description: '要发送的消息内容'
        },
        jid: {
          type: 'string',
          description: '关联职位ID（可选）',
          default: ''
        }
      },
      required: ['to_uids', 'content']
    },
    handler: async (args) => {
      console.error(`[maimai-mcp][审计] enterprise_send -> to_uids=${args.to_uids}, content=${args.content}`);
      const enterprise = getEnterpriseClient();
      const result = await enterprise.send(args.to_uids, args.content, {
        jid: args.jid || '',
        communication: 'direct_im'
      });
      return result;
    }
  }
];

/**
 * 创建并启动 MCP Server
 */
function main() {
  const server = new Server(
    { name: 'maimai-mcp', version: '0.1.0' },
    { capabilities: { tools: {} } }
  );

  // 注册 ListTools 处理器
  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: TOOLS.map(t => ({
      name: t.name,
      description: t.description,
      inputSchema: t.inputSchema
    }))
  }));

  // 注册 CallTool 处理器
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    const tool = TOOLS.find(t => t.name === name);
    if (!tool) {
      return {
        content: [{ type: 'text', text: `错误：未知工具 ${name}` }],
        isError: true
      };
    }

    try {
      const result = await tool.handler(args || {});
      return {
        content: [{
          type: 'text',
          text: JSON.stringify(result, null, 2)
        }]
      };
    } catch (err) {
      console.error(`[maimai-mcp][错误] 工具 ${name} 执行失败:`, err.message);
      return {
        content: [{ type: 'text', text: `工具执行失败: ${err.message}` }],
        isError: true
      };
    }
  });

  // 启动 stdio 传输
  const transport = new StdioServerTransport();
  server.connect(transport).then(() => {
    console.error('[maimai-mcp] MCP server 已启动，等待客户端连接...');
  }).catch(err => {
    console.error('[maimai-mcp] 启动失败:', err);
    process.exit(1);
  });
}

main();
