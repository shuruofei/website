# 桦艺新生 —— 桦树皮画数字体验平台

国家级非物质文化遗产（编号 Ⅷ-83）桦树皮画的数字化体验平台，2026 年大学生创新创业训练计划项目。

技术栈：**Flask + SQLite + Jinja2 模板 + Tailwind（本地化）+ 智谱 GLM 大模型**，前端依赖已全部本地化，**断网环境下除 AI 问答（自动降级为本地知识库）外全部功能可用**。

## 一、启动方法

```powershell
# 1. 安装依赖（只需一次）
python -m pip install -r requirements.txt

# 2. 启动
python app.py

# 3. 浏览器打开
#    http://127.0.0.1:5000
```

首次启动会自动创建 `instance/site.db` 数据库并写入两个初始账号：

| 账号 | 密码 | 说明 |
|---|---|---|
| `admin` | `admin123` | 管理员（可进 /admin 管理面板） |
| `demo` | `demo123` | 普通用户（演示用） |

> **上线前务必**：登录后在「改密」页面修改初始密码，并更换 `.env` 中的 `SECRET_KEY`。

## 二、目录结构

```
website/
├── app.py                  # 后端全部路由与 API
├── requirements.txt        # Python 依赖（仅 flask、requests）
├── .env                    # 智谱 API Key 与 SECRET_KEY（不进 git）
├── templates/              # 16 个页面模板（base.html 为全站骨架）
├── static/                 # css / js / 本地化的 Tailwind 与 Font Awesome
├── uploads/                # 用户上传的素材图片（不进 git）
├── instance/site.db        # SQLite 数据库（自动生成，不进 git）
├── 桦树皮画图片素材/        # 展馆图片素材
└── AR试贴/webar/           # 本地 AR 备用（线上 AR 已部署至 GitHub Pages）
```

## 三、功能一览

- **首页**：3D 魔方导航（六面指向核心板块）+ 快捷导航
- **千年时间轴 / 工艺详解 / 传承人故事 / 民族图谱**：内容模块（史实经网络核实）
- **数字展馆**：6 幅画作 + 每幅画独立评论区
- **AR 试贴**：内嵌已部署的 WebAR（https://shuruofei.github.io/ar-trial）
- **AI 问答**：智谱 GLM 免费模型（glm-4.7-flash / glm-4-flash-250414 自动回退），断网自动降级本地知识库
- **素材共创库**：登录后上传图片（≤5MB），管理员可管理
- **问答挑战**：8 题互动小测
- **账号系统**：注册 / 登录 / 修改密码；管理员面板可删评论、删素材、看用户
- **留言墙**：全站大评论区（关于页）

## 四、常见问题

| 问题 | 说明 |
|---|---|
| AI 显示"离线模式" | 现场断网或智谱接口限流，自动用本地知识库回答，演示不翻车 |
| 摄像头黑屏（AR） | 浏览器要求 localhost 或 HTTPS 才授予摄像头权限；本机访问 `127.0.0.1:5000/ar` 没问题 |
| 免费额度查询 | open.bigmodel.cn 控制台 → 财务中心（所用模型为免费档，不产生费用） |
| 忘记密码 | 删掉 `instance/site.db` 重启即重置（会清空所有数据，慎用） |

## 五、AR 试贴（独立仓库）

`AR试贴/` 是独立的 git 仓库（WebAR 部署源码），已部署至 GitHub Pages，本仓库不追踪其内部改动。
