#!/bin/bash
# 项目重新部署启动脚本
# 使用方法：./deploy.sh

set -e  # 遇到错误立即退出

PROJECT_DIR="/opt/agarwood-ai-assistant"
LOG_FILE="$PROJECT_DIR/nextjs.log"
PID_FILE="$PROJECT_DIR/.next-server.pid"

echo "=========================================="
echo "开始部署项目: $(date '+%Y-%m-%d %H:%M:%S')"
echo "=========================================="

# 1. 进入项目目录
echo "[1/4] 进入项目目录..."
cd "$PROJECT_DIR" || exit 1

# 2. 停止当前运行的 Next.js 进程
echo "[2/4] 停止当前运行的 Next.js 进程..."

# 停止所有相关的 node 进程（next-server 和 run-next-command）
NEXT_PIDS=$(ps aux | grep -E 'next-server|run-next-command.mjs' | grep -v grep | awk '{print $2}' || true)

if [ -n "$NEXT_PIDS" ]; then
    echo "查找到 Next.js 相关进程: $NEXT_PIDS"
    echo "$NEXT_PIDS" | xargs kill 2>/dev/null || true
    sleep 3
    
    # 强制停止仍未退出的进程
    REMAIN_PIDS=$(ps aux | grep -E 'next-server|run-next-command.mjs' | grep -v grep | awk '{print $2}' || true)
    if [ -n "$REMAIN_PIDS" ]; then
        echo "强制停止进程: $REMAIN_PIDS"
        echo "$REMAIN_PIDS" | xargs kill -9 2>/dev/null || true
        sleep 2
    fi
else
    echo "未找到运行中的 Next.js 进程"
fi

# 确保端口 3000 已释放
if lsof -ti:3000 >/dev/null 2>&1; then
    echo "端口 3000 仍被占用，强制释放..."
    lsof -ti:3000 | xargs kill -9 2>/dev/null || true
    sleep 2
fi

# 清理 PID 文件
rm -f "$PID_FILE"

echo "当前 Next.js 进程已停止"

# 3. 重新构建项目
echo "[3/4] 重新构建项目..."
npm run build
if [ $? -eq 0 ]; then
    echo "项目构建成功"
else
    echo "项目构建失败，退出部署"
    exit 1
fi

# 4. 重新启动项目
echo "[4/4] 启动项目..."
nohup npm run start > "$LOG_FILE" 2>&1 &
NEW_PID=$!
echo "$NEW_PID" > "$PID_FILE"

echo "项目已启动，PID: $NEW_PID"
echo "日志文件: $LOG_FILE"

# 等待服务启动
sleep 3

# 验证服务状态
echo "=========================================="
echo "验证服务状态..."
if curl -s http://localhost:3000/api/health > /dev/null 2>&1; then
    echo "✅ 服务健康检查通过"
else
    echo "⚠️  服务健康检查失败，请检查日志"
fi

# 显示端口监听状态
echo ""
echo "端口监听状态:"
ss -tlnp | grep 3000 || echo "端口 3000 未监听"

echo ""
echo "=========================================="
echo "部署完成: $(date '+%Y-%m-%d %H:%M:%S')"
echo "=========================================="
echo ""
echo "查看日志: tail -f $LOG_FILE"
echo "停止服务: kill \$(cat $PID_FILE)"
