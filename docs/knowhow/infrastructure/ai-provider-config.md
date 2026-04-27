# AI Provider Configuration

> ReadLoop 支持的 AI provider 连接配置、凭证来源、优先级。

## Problem
ReadLoop 需要连接多个 AI provider（Bedrock、Yunstorm、SiliconFlow），之前的凭证和 endpoint 已过时，需要重新配置和验证。

## Cause
- 旧 Bedrock AK/SK（Analemma ap-northeast-1 账号）已失效
- Yunstorm 旧 endpoint `gpt.yunstorm.com` 已下线（404）
- SiliconFlow key 从邮件获取但 401 invalid（可能未激活）

## Solution

### 当前可用 Provider（2026-04-27 验证）

| Provider | Base URL | Model | 状态 |
|----------|----------|-------|------|
| Bedrock Sonnet 4.6 | via proxy :3001 | `us.anthropic.claude-sonnet-4-6` | OK (2.4s) |
| Bedrock Opus 4.6 | via proxy :3001 | `us.anthropic.claude-opus-4-6-v1` | OK (2.8s) |
| Yunstorm (GPT) | `https://dl.yunstorm.com/v1` | `gpt-4.1` | OK (344ms) |
| SiliconFlow | `https://api.siliconflow.cn/v1` | `claude-sonnet-4` | FAIL (key invalid) |

### 凭证来源
- **Bedrock**: Claude Code 同一组 AWS AK/SK（us-east-2, account 533595510084）
- **Yunstorm**: Analemma 公司分配，Tag: Analemma03188，key 在 `.env` VITE_YUNSTORM_API_KEY
- **SiliconFlow**: Analemma 公司分配（邮件 2026-03-27 from Xiangkun），待确认激活

### 优先级规则（来自公司邮件）
- Claude 模型 → 优先用硅基流动（SiliconFlow）
- GPT 模型 → 优先用 Azure 代理（Yunstorm）
- Bedrock 作为 Claude 的备选

### Endpoint 注意事项
- `gpt.yunstorm.com` 已下线，改用 `dl.yunstorm.com`
- `guohe-apim.azure-api.net` 无法解析（DNS 或已弃用）
- Bedrock 需要走 Clash 代理 `127.0.0.1:7890`

## Commands
```bash
# 测试所有 provider 连通性
npm run test:providers

# 测试单个
npm run test:providers -- bedrock
npm run test:providers -- yunstorm

# 重启 proxy（更换 AWS 凭证后必须重启）
lsof -ti:3001 | xargs kill -9; set -a && source .env && set +a && node proxy.mjs
```

## Notes
- Date: 2026-04-27
- 凭证存储在 `.env`（已 gitignore），secrets-guard hook 阻止代码/命令中直接写入 key
- Bedrock region 从 ap-northeast-1 迁移到 us-east-2
