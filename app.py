# -*- coding: utf-8 -*-
"""桦艺新生 - 桦树皮画数字体验平台 后端服务"""
import json
import os
import sqlite3
import uuid
from datetime import datetime
from functools import wraps

import requests
from flask import (Flask, abort, g, jsonify, redirect, render_template,
                   request, send_from_directory, session, url_for)
from werkzeug.security import check_password_hash, generate_password_hash
from werkzeug.utils import secure_filename

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(BASE_DIR, "instance", "site.db")
UPLOAD_DIR = os.path.join(BASE_DIR, "uploads")
IMAGE_DIR = os.path.join(BASE_DIR, "桦树皮画图片素材")
MAX_CONTENT_LENGTH = 5 * 1024 * 1024  # 5MB

app = Flask(__name__)
app.config["MAX_CONTENT_LENGTH"] = MAX_CONTENT_LENGTH
app.secret_key = os.environ.get("SECRET_KEY", "huayi-dev-secret-change-me")


# ---------- .env 加载（免依赖 python-dotenv） ----------
def load_env(path=os.path.join(BASE_DIR, ".env")):
    if not os.path.exists(path):
        return
    with open(path, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, _, v = line.partition("=")
                os.environ.setdefault(k.strip(), v.strip())


load_env()
ZHIPU_API_KEY = os.environ.get("ZHIPU_API_KEY", "")
ZHIPU_URL = "https://open.bigmodel.cn/api/paas/v4/chat/completions"
# 备用免费模型链：主模型繁忙(429)时自动降级
ZHIPU_MODELS = ["glm-4.7-flash", "glm-4-flash-250414"]

# ---------- 展馆作品与素材常量（图片本地化映射） ----------
ARTWORKS = [
    {"slug": "qimalieshou",  "title": "骑马狩猎", "file": "骑马狩猎.jpg",
     "desc": "游猎民族的经典叙事主题：猎手纵马穿行于白桦林间，再现山林生活的原始张力。"},
    {"slug": "hualinlangying", "title": "桦林狼影", "file": "桦林狼影.png",
     "desc": "利用深色树皮剪出狼的轮廓，与浅色桦林底形成强烈对比，尽显\"相皮\"构图的巧思。"},
    {"slug": "shilubuluo",   "title": "使鹿部落", "file": "使鹿部落.png",
     "desc": "描绘鄂温克使鹿部落在兴安岭中的驯鹿生活，是北方森林民族的活态记忆。"},
    {"slug": "guxiangbaihua", "title": "故乡白桦", "file": "故乡白桦.png",
     "desc": "以树皮本色层层拼贴出白桦林的四季光影，质朴中见乡愁。"},
    {"slug": "linshenjianlu", "title": "林深见鹿", "file": "林深见鹿.jpg",
     "desc": "烙烫技法塑造的林间驯鹿，光影过渡细腻，体现\"以火为墨\"的独特美感。"},
    {"slug": "beifangshenghuo", "title": "北方生活", "file": "北方生活.jpg",
     "desc": "记录北方民族炊烟、狩猎、迁徙的日常图景，堪称一部\"视觉史书\"。"},
]

TEXTURE_MATERIALS = [
    "屏幕截图 2026-04-12 212259.png", "屏幕截图 2026-04-12 212441.png",
    "屏幕截图 2026-04-12 212523.png", "屏幕截图 2026-04-12 212601.png",
    "屏幕截图 2026-04-12 212658.png", "屏幕截图 2026-04-12 213249.png",
    "屏幕截图 2026-04-12 213441.png", "屏幕截图 2026-04-12 213557.png",
]

AR_URL = "https://shuruofei.github.io/ar-trial"

# ---------- 数据库 ----------
def get_db():
    if "db" not in g:
        os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
        g.db = sqlite3.connect(DB_PATH)
        g.db.row_factory = sqlite3.Row
        g.db.execute("PRAGMA foreign_keys = ON")
    return g.db


@app.teardown_appcontext
def close_db(exc):
    db = g.pop("db", None)
    if db:
        db.close()


def init_db():
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    db = sqlite3.connect(DB_PATH)
    db.executescript("""
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        is_admin INTEGER DEFAULT 0,
        created_at TEXT DEFAULT (datetime('now','localtime'))
    );
    CREATE TABLE IF NOT EXISTS materials (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL REFERENCES users(id),
        title TEXT NOT NULL,
        filename TEXT NOT NULL,
        created_at TEXT DEFAULT (datetime('now','localtime'))
    );
    CREATE TABLE IF NOT EXISTS comments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL REFERENCES users(id),
        artwork_key TEXT NOT NULL DEFAULT 'wall',
        content TEXT NOT NULL,
        created_at TEXT DEFAULT (datetime('now','localtime'))
    );
    """)
    # 预置账号：管理员 + 演示用户
    if db.execute("SELECT COUNT(*) FROM users").fetchone()[0] == 0:
        db.execute("INSERT INTO users (username, password_hash, is_admin) VALUES (?,?,1)",
                   ("admin", generate_password_hash("admin123")))
        db.execute("INSERT INTO users (username, password_hash, is_admin) VALUES (?,?,0)",
                   ("demo", generate_password_hash("demo123")))
    db.commit()
    db.close()


init_db()


def current_user():
    uid = session.get("uid")
    if not uid:
        return None
    row = get_db().execute("SELECT * FROM users WHERE id=?", (uid,)).fetchone()
    return row


def login_required(f):
    @wraps(f)
    def wrapper(*a, **kw):
        if not current_user():
            return jsonify({"ok": False, "msg": "请先登录"}), 401
        return f(*a, **kw)
    return wrapper


def admin_required(f):
    @wraps(f)
    def wrapper(*a, **kw):
        u = current_user()
        if not u or not u["is_admin"]:
            abort(403)
        return f(*a, **kw)
    return wrapper


# ---------- 页面路由 ----------
@app.route("/")
def index():
    return render_template("index.html")


@app.route("/gallery")
def gallery():
    return render_template("gallery.html", artworks=ARTWORKS)


@app.route("/timeline")
def timeline():
    return render_template("timeline.html")


@app.route("/craft")
def craft():
    return render_template("craft.html")


@app.route("/inheritors")
def inheritors():
    return render_template("inheritors.html")


@app.route("/culture")
def culture():
    return render_template("culture.html")


@app.route("/quiz")
def quiz():
    return render_template("quiz.html")


@app.route("/ar")
def ar():
    return render_template("ar.html", ar_url=AR_URL)


@app.route("/ai")
def ai():
    return render_template("ai.html")


@app.route("/material")
def material():
    return render_template("material.html", textures=TEXTURE_MATERIALS)


@app.route("/about")
def about():
    return render_template("about.html")


@app.route("/login")
def login_page():
    if current_user():
        return redirect(url_for("index"))
    return render_template("login.html")


@app.route("/register")
def register_page():
    if current_user():
        return redirect(url_for("index"))
    return render_template("register.html")


@app.route("/admin")
@admin_required
def admin_page():
    return render_template("admin.html")


# ---------- 图片/上传文件服务 ----------
@app.route("/img/<path:filename>")
def serve_image(filename):
    return send_from_directory(IMAGE_DIR, filename)


@app.route("/uploads/<path:filename>")
def serve_upload(filename):
    return send_from_directory(UPLOAD_DIR, filename)


# ---------- 认证 API ----------
@app.route("/api/register", methods=["POST"])
def api_register():
    data = request.get_json(silent=True) or {}
    username = (data.get("username") or "").strip()
    password = data.get("password") or ""
    if not (2 <= len(username) <= 20) or not username.replace("_", "").isalnum():
        return jsonify({"ok": False, "msg": "用户名需为 2-20 位字母、数字或下划线"})
    if len(password) < 6:
        return jsonify({"ok": False, "msg": "密码至少 6 位"})
    db = get_db()
    if db.execute("SELECT id FROM users WHERE username=?", (username,)).fetchone():
        return jsonify({"ok": False, "msg": "该用户名已被注册"})
    cur = db.execute("INSERT INTO users (username, password_hash) VALUES (?,?)",
                     (username, generate_password_hash(password)))
    db.commit()
    session["uid"] = cur.lastrowid
    return jsonify({"ok": True})


@app.route("/api/login", methods=["POST"])
def api_login():
    data = request.get_json(silent=True) or {}
    username = (data.get("username") or "").strip()
    row = get_db().execute("SELECT * FROM users WHERE username=?", (username,)).fetchone()
    if row and check_password_hash(row["password_hash"], data.get("password") or ""):
        session["uid"] = row["id"]
        return jsonify({"ok": True, "is_admin": bool(row["is_admin"])})
    return jsonify({"ok": False, "msg": "用户名或密码错误"})


@app.route("/api/logout", methods=["POST"])
def api_logout():
    session.pop("uid", None)
    return jsonify({"ok": True})


@app.route("/api/me")
def api_me():
    u = current_user()
    if not u:
        return jsonify({"ok": True, "user": None})
    return jsonify({"ok": True, "user": {"id": u["id"], "username": u["username"],
                                          "is_admin": bool(u["is_admin"])}})


# ---------- 素材库 API ----------
@app.route("/api/materials", methods=["GET"])
def api_materials_list():
    rows = get_db().execute(
        "SELECT m.id, m.title, m.filename, m.created_at, u.username "
        "FROM materials m JOIN users u ON u.id = m.user_id ORDER BY m.id DESC").fetchall()
    return jsonify({"ok": True, "materials": [
        {"id": r["id"], "title": r["title"], "src": url_for("serve_upload", filename=r["filename"]),
         "author": r["username"], "created_at": r["created_at"]} for r in rows]})


@app.route("/api/materials", methods=["POST"])
@login_required
def api_materials_upload():
    if "file" not in request.files:
        return jsonify({"ok": False, "msg": "未收到文件"})
    f = request.files["file"]
    if not f.filename:
        return jsonify({"ok": False, "msg": "未选择文件"})
    ext = os.path.splitext(f.filename)[1].lower()
    if ext not in (".jpg", ".jpeg", ".png", ".webp"):
        return jsonify({"ok": False, "msg": "仅支持 JPG / PNG / WebP 图片"})
    title = (request.form.get("title") or "").strip()[:30] or "未命名素材"
    filename = uuid.uuid4().hex + ext
    os.makedirs(UPLOAD_DIR, exist_ok=True)
    f.save(os.path.join(UPLOAD_DIR, filename))
    db = get_db()
    db.execute("INSERT INTO materials (user_id, title, filename) VALUES (?,?,?)",
               (session["uid"], title, filename))
    db.commit()
    return jsonify({"ok": True})


@app.route("/api/materials/<int:mid>", methods=["DELETE"])
@login_required
def api_materials_delete(mid):
    u = current_user()
    db = get_db()
    row = db.execute("SELECT * FROM materials WHERE id=?", (mid,)).fetchone()
    if not row:
        return jsonify({"ok": False, "msg": "素材不存在"}), 404
    if row["user_id"] != u["id"] and not u["is_admin"]:
        return jsonify({"ok": False, "msg": "无权删除"}), 403
    db.execute("DELETE FROM materials WHERE id=?", (mid,))
    db.commit()
    try:
        os.remove(os.path.join(UPLOAD_DIR, row["filename"]))
    except OSError:
        pass
    return jsonify({"ok": True})


# ---------- 评论 API ----------
def comment_list(key):
    rows = get_db().execute(
        "SELECT c.id, c.content, c.created_at, c.user_id, u.username, u.is_admin "
        "FROM comments c JOIN users u ON u.id = c.user_id "
        "WHERE c.artwork_key = ? ORDER BY c.id DESC", (key,)).fetchall()
    uid = session.get("uid")
    return [{"id": r["id"], "content": r["content"], "author": r["username"],
             "is_admin": bool(r["is_admin"]), "created_at": r["created_at"],
             "mine": uid == r["user_id"]} for r in rows]


@app.route("/api/comments")
def api_comments_get():
    key = (request.args.get("key") or "wall").strip()[:50]
    return jsonify({"ok": True, "comments": comment_list(key)})


@app.route("/api/comments", methods=["POST"])
@login_required
def api_comments_post():
    data = request.get_json(silent=True) or {}
    key = (data.get("key") or "wall").strip()[:50]
    content = (data.get("content") or "").strip()
    if not content:
        return jsonify({"ok": False, "msg": "留言内容不能为空"})
    if len(content) > 500:
        return jsonify({"ok": False, "msg": "留言内容请控制在 500 字以内"})
    db = get_db()
    db.execute("INSERT INTO comments (user_id, artwork_key, content) VALUES (?,?,?)",
               (session["uid"], key, content))
    db.commit()
    return jsonify({"ok": True, "comments": comment_list(key)})


@app.route("/api/comments/<int:cid>", methods=["DELETE"])
@login_required
def api_comments_delete(cid):
    u = current_user()
    db = get_db()
    row = db.execute("SELECT * FROM comments WHERE id=?", (cid,)).fetchone()
    if not row:
        return jsonify({"ok": False, "msg": "评论不存在"}), 404
    if row["user_id"] != u["id"] and not u["is_admin"]:
        return jsonify({"ok": False, "msg": "无权删除"}), 403
    db.execute("DELETE FROM comments WHERE id=?", (cid,))
    db.commit()
    return jsonify({"ok": True, "comments": comment_list(row["artwork_key"])})


# ---------- 数据看板 ----------
@app.route("/api/stats")
def api_stats():
    db = get_db()
    return jsonify({"ok": True, "stats": {
        "users": db.execute("SELECT COUNT(*) FROM users").fetchone()[0],
        "materials": db.execute("SELECT COUNT(*) FROM materials").fetchone()[0],
        "comments": db.execute("SELECT COUNT(*) FROM comments").fetchone()[0],
        "artworks": len(ARTWORKS),
    }})


# ---------- AI 问答（智谱 GLM，离线自动降级本地知识库） ----------
KB = """你是"桦艺AI助手"，桦树皮画数字体验平台（大创项目"桦艺新生"）的专属讲解员。
只回答与桦树皮画、北方森林民族文化（鄂伦春、鄂温克、赫哲、达斡尔）、非遗保护、
本平台功能相关的问题；无关问题请礼貌引导回主题。回答用中文、条理清晰、适度使用 emoji。

核心知识：
1. 概况：桦树皮画（桦皮画/桦皮烙画）是中国北方森林民族的传统艺术，以桦树皮为"纸"、
   以烙铁为"笔"、以火为"墨"。2006 年 5 月 20 日，桦树皮制作技艺经国务院批准列入
   第一批国家级非物质文化遗产名录，编号 Ⅷ-83（传统技艺类），申报地为内蒙古鄂伦春
   自治旗与黑龙江省。
2. 历史：约 3000 年前北方民族已有桦皮制品。1959 年满洲里扎赉诺尔汉代鲜卑墓出土
   上千件桦皮器皿盖；辽代墓葬亦有桦皮器皿残件。桦皮文化从实用器物（船、盒、篓、
   碗）装饰刻划，逐步发展为独立的烫烙剪贴绘画艺术。
3. 材料：选用二三十年树龄白桦，春末夏初（农历五月底六月初至立秋前）树液流动旺盛
   时剥取，只取外皮、不伤形成层，数年后树皮可再生，体现人与森林的生态智慧。
4. 工艺四步：剥取与熟化（水煮脱脂、压平阴干）→ 相皮构图（依天然结节纹理"因势
   象形"）→ 剪刻拼贴（不同色阶树皮多层叠贴，形成 2.5D 立体感）→ 烙烫修饰
   （电烙铁碳化原理绘制光影，全程不用化学颜料）。
5. 传承人：付占祥（1955 年生，赫哲族，黑龙江饶河），2007 年入选第一批国家级非遗
   项目代表性传承人；黑龙江饶河县建有桦树皮制作技艺展览馆和传习所。桦皮船制作
   技艺（鄂伦春语"奥木鲁钦"，全船不用一根铁钉）2008 年列入扩展项目。
6. 民族：主要流传于鄂伦春、鄂温克、达斡尔及黑龙江流域赫哲族聚居区，承载万物有灵
   的森林信仰与狩猎驯鹿文化。
7. 现状与新生：狩猎文化式微致传承面临危机；本平台以 WebAR、AI 问答、共创素材库
   等数字技术助力活态传承，"见人见物见生活"。"""

LOCAL_FALLBACK = [
    (["工艺流程", "怎么做", "制作", "步骤", "工艺"], 
     "桦树皮画的制作分四步：① 剥取与熟化——春末夏初剥取桦皮，水煮脱脂、重压平整；"
     "② 相皮构图——依天然结节与色斑因势象形；③ 剪刻拼贴——不同色阶树皮多层叠贴，"
     "营造立体纵深；④ 烙烫修饰——电烙铁高温烫出光影，全程不用化学颜料。"),
    (["历史", "起源", "多久", "渊源"],
     "约 3000 年前北方民族已有桦皮制品；扎赉诺尔汉代鲜卑墓曾出土上千件桦皮器皿盖。"
     "2006 年桦树皮制作技艺列入第一批国家级非遗名录（编号 Ⅷ-83）。"),
    (["材料", "原料", "采集", "选材", "树皮"],
     "匠人选用二三十年树龄的白桦，在春末夏初树液旺盛时剥取外皮——绝不伤及形成层，"
     "数年后新皮可再生。剥皮后还需水煮脱脂、重压平整，得到柔韧\"画布\"。"),
    (["传承人", "付占祥", "大师"],
     "付占祥（1955 年生，赫哲族，黑龙江饶河）是桦树皮制作技艺第一批国家级代表性传承人，"
     "饶河县建有桦树皮技艺展览馆与传习所。欢迎到\"传承人故事\"栏目了解更多。"),
    (["价值", "意义", "特色"],
     "桦树皮画以树皮为纸、以火为墨，承载北方森林民族的信仰与生活记忆，是无法被工业 "
     "复制的\"视觉史书\"，兼具历史、艺术与民俗学研究价值。"),
]


def local_answer(question):
    for keys, ans in LOCAL_FALLBACK:
        if any(k in question for k in keys):
            return ans
    return ("当前处于离线模式，我暂时只能回答核心知识。您可以问我：制作工艺、"
            "历史渊源、材料采集、传承人故事、文化价值等话题。联网后我会给出"
            "更详尽的解答。")


@app.route("/api/chat", methods=["POST"])
def api_chat():
    data = request.get_json(silent=True) or {}
    question = (data.get("question") or "").strip()[:500]
    if not question:
        return jsonify({"ok": False, "msg": "问题不能为空"})
    if not ZHIPU_API_KEY:
        return jsonify({"ok": True, "answer": local_answer(question), "offline": True})
    try:
        answer = None
        for model in ZHIPU_MODELS:
            try:
                resp = requests.post(ZHIPU_URL, timeout=20, headers={
                    "Authorization": f"Bearer {ZHIPU_API_KEY}",
                    "Content-Type": "application/json",
                }, json={
                    "model": model,
                    "messages": [{"role": "system", "content": KB},
                                 {"role": "user", "content": question}],
                    "temperature": 0.6,
                    "max_tokens": 1024,
                })
                if resp.status_code == 429:
                    continue  # 模型繁忙，尝试下一个备用模型
                resp.raise_for_status()
                answer = resp.json()["choices"][0]["message"]["content"]
                break
            except Exception:
                continue
        if answer:
            return jsonify({"ok": True, "answer": answer})
        return jsonify({"ok": True, "answer": local_answer(question), "offline": True})
    except Exception:
        return jsonify({"ok": True, "answer": local_answer(question), "offline": True})


# ---------- 管理员总览 API ----------
@app.route("/api/admin/overview")
@admin_required
def api_admin_overview():
    db = get_db()
    comments = db.execute(
        "SELECT c.id, c.content, c.created_at, c.artwork_key, u.username "
        "FROM comments c JOIN users u ON u.id=c.user_id ORDER BY c.id DESC").fetchall()
    materials = db.execute(
        "SELECT m.id, m.title, m.filename, m.created_at, u.username "
        "FROM materials m JOIN users u ON u.id=m.user_id ORDER BY m.id DESC").fetchall()
    users = db.execute(
        "SELECT id, username, is_admin, created_at FROM users ORDER BY id").fetchall()
    return jsonify({"ok": True, "comments": [
        {"id": c["id"], "content": c["content"], "author": c["username"],
         "key": c["artwork_key"], "created_at": c["created_at"]} for c in comments],
        "materials": [
            {"id": m["id"], "title": m["title"], "author": m["username"],
             "src": url_for("serve_upload", filename=m["filename"]),
             "created_at": m["created_at"]} for m in materials],
        "users": [{"id": u["id"], "username": u["username"],
                   "is_admin": bool(u["is_admin"]), "created_at": u["created_at"]} for u in users]})


# ---------- 模板全局上下文 ----------
@app.context_processor
def inject_globals():
    u = current_user()
    return {"user": ({"id": u["id"], "username": u["username"], "is_admin": bool(u["is_admin"])}
                     if u else None),
            "year": datetime.now().year,
            "artworks": ARTWORKS}


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
