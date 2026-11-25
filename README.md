# JK 直播口播生成器

通过分轮对话收集账号定位、目标用户、产品事实和直播参数，生成约 20 至 30 分钟的真人直播口播稿。默认由当前 Codex 生成，无需配置第三方 API Key。

| 项目 | 信息 |
| --- | --- |
| 当前版本 | 0.2.0 |
| Skill 作者 | 玩AI的杰克 |
| 许可证 | [0BSD](LICENSE) |
| 项目地址 | [jackywjj/jk-live-script-generator](https://github.com/jackywjj/jk-live-script-generator) |
| 反馈邮箱 | [ecstorm@gmail.com](mailto:ecstorm@gmail.com) |
| 反馈微信 | Jacky-K-Wu |
| 公众号 | 玩AI的杰克 |
| 视频号 | 玩AI的杰克 |

版本号以 `SKILL.md` 的 `metadata.version` 为准；升级时同步本页和 `assets/attribution.md`。文件中的版本号不代表已经创建 GitHub Release 或同名标签。

## 口播怎样组织

围绕同一个核心问题，循环展开“痛点 → 归因 → 情绪承接 → 专业证据 → 可信愿景 → 方法／演示 → 产品承接 → 回环”。默认 25 分钟用三轮展开：基础方法、同问题的新场景、执行卡点或异议回应；可按演示和问答调整。

每轮用简短回顾接住新观众，再提供新的方法细节或证据。商品已核实且适配时，才把内容接到对应的真实交付物；否则使用内容练习或预约下一场收口。具体编排见 [直播成交模式](references/live-script-mode.md)。

## 安装到新项目

仓库根目录就是 Skill，入口是 `SKILL.md`。必须保留 `references/`、`assets/`、`scripts/` 等完整目录，不能只复制入口文件。

### 方式一：让 Codex 安装

先在 Codex 中打开目标项目，再发送：

```text
使用 $skill-installer 安装 https://github.com/jackywjj/jk-live-script-generator 。
仓库内的 Skill 路径为根目录（.），名称为 jk-live-script-generator。
请安装到当前项目的 .agents/skills/jk-live-script-generator，安装前检查内容和风险；
如果同名目录已存在，先检查版本和本地修改，不直接覆盖。
```

完成后检查目标目录内的 `SKILL.md`，再发送下方的使用示例。如果界面尚未发现 Skill，可重新打开项目或重启 Codex。

### 方式二：手动安装到当前项目

以下命令适用于 macOS、Linux 或 Windows 的 Git Bash。先在终端进入目标项目根目录，需要本机已安装 Git：

```bash
mkdir -p .agents/skills
git clone https://github.com/jackywjj/jk-live-script-generator.git .agents/skills/jk-live-script-generator
```

安装结果应为 `.agents/skills/jk-live-script-generator/SKILL.md`。目标目录已有内容时，`git clone` 会停止，不会覆盖旧文件。

也可以从 GitHub 仓库页面选择 **Code → Download ZIP**，解压后将完整文件夹重命名为 `jk-live-script-generator`，放入目标项目的 `.agents/skills/`。不要多套一层同名文件夹。

这里的克隆会创建独立 Git 仓库。若要随业务项目一起提交给团队，应使用 ZIP 方式复制完整 Skill 文件，或由团队明确采用 Git 子模块管理。

## 全局安装：多个项目共用

希望所有项目都能使用时，选择全局安装即可，避免又在项目内安装同名副本：

```bash
mkdir -p "$HOME/.agents/skills"
git clone https://github.com/jackywjj/jk-live-script-generator.git "$HOME/.agents/skills/jk-live-script-generator"
```

也可让 `$skill-installer` 安装，并明确目标目录为 `~/.agents/skills/jk-live-script-generator`。某些版本的安装器默认使用 `~/.codex/skills` 或 `$CODEX_HOME/skills`，应以实际安装回执为准，不要把已有副本重复安装到多个位置。

项目级 `.agents/skills` 和用户级 `~/.agents/skills` 的发现规则见 [OpenAI 官方 Skill 文档](https://developers.openai.com/codex/skills/)。

## 开始使用

```text
使用 $jk-live-script-generator 帮我准备一场约25分钟的视频号真人直播。
先分轮询问账号定位、目标用户、产品事实、演示材料和本场目标。
由当前 Codex 直接生成，不使用外部模型。
```

产品尚未确认时，可以明确要求“纯内容／预约下一场版本”。不要把 `intake.example.json` 中的示例当成自己的真实资料。

成稿末尾默认显示作者邮箱、反馈微信、公众号、视频号、项目地址和 Skill 版本。这些信息独立于口播正文，不计入时长；可以要求省略署名。

## 更新已安装版本

Git 克隆安装：先检查本地修改和来源，再更新。例如，项目级安装从目标项目根目录执行：

```bash
git -C .agents/skills/jk-live-script-generator status --short
git -C .agents/skills/jk-live-script-generator remote -v
```

确认没有需要保留的未提交修改，且来源仍为本项目地址后执行：

```bash
git -C .agents/skills/jk-live-script-generator pull --ff-only
```

全局安装时，将上述命令中的目录替换为 `"$HOME/.agents/skills/jk-live-script-generator"`。若更新报告分叉或冲突，先处理本地修改，不强制重置或删除目录。

ZIP 或安装器复制安装：先将旧目录改名备份，再安装新版，比较后迁移自己的配置。不要用批量删除或强制覆盖处理更新。更新后核对 `SKILL.md` 的版本，重新打开项目并试用一次。

上述 Git 安装默认获取远端默认分支；尚未发布的本地改动需要维护者推送后才能被其他人安装到。

## 可选外部模型

外部脚本支持 DeepSeek、Kimi、千问和 MiniMax，通过 `--provider deepseek|kimi|qwen|minimax` 选择其中一个。脚本使用 Node.js 内置模块，无需 `npm install`；本机需支持内置 `fetch` 的 Node.js 环境。配置和离线校验命令见 [外部模型说明](references/provider-config.md)。`.env.example` 只是变量名称示例，脚本不会自动读取 `.env`。

外部脚本只向所选服务商的官方 HTTPS 地址发起请求，使用默认端口并禁止跟随重定向。HTTP 请求失败时仅显示状态码。默认由 Codex 直接生成时无需运行外部脚本。

本项目不自动安装第三方插件、不自动调用其他 Agent、不上传或发布直播稿。外部调用需要明确确认，可能产生费用；不要提交密钥、客户隐私或企业机密。已提供 `.gitignore` 忽略本机密钥文件、本机配置、`intake.json` 和 `outputs/`；其他自定义文件名仍需自行检查。

## 反馈

通过邮箱 **ecstorm@gmail.com** 或微信 **Jacky-K-Wu** 联系作者。反馈时附上 Skill 版本、安装方式、希望实现的效果和脱敏后的问题示例；不要发送 API Key 或未脱敏的客户资料。这里是问题反馈联系方式，不代表购买入口或服务时效承诺。

## 许可证与署名

本项目采用 [0BSD（Zero-Clause BSD）](LICENSE)，属于限制很少的宽松许可证，允许免费或收费使用、复制、修改和分发，无需强制署名，也无需公开修改后的源码。许可正文依据 [OSI 官方文本](https://opensource.org/license/0bsd)。

成稿中的作者署名仅是默认展示设置，可以移除，不构成附加授权条件。许可证适用于本项目原创内容；使用者输入的第三方素材仍应遵守其原有权利和授权。软件按原样提供，不作担保。
