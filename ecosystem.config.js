/**
 * PM2 配置文件
 * 用于生产环境部署干洗系统后端
 * 
 * 使用方法：
 * 1. 安装 PM2: npm install -g pm2
 * 2. 启动服务: pm2 start ecosystem.config.js
 * 3. 设置开机自启动: pm2 startup && pm2 save
 * 4. 其他常用命令:
 *    - pm2 list          查看所有进程
 *    - pm2 logs          查看日志
 *    - pm2 restart       重启服务
 *    - pm2 stop          停止服务
 *    - pm2 delete        删除进程
 */

module.exports = {
  apps: [
    // 主后端服务
    {
      name: 'dry-cleaning-backend',        // 应用名称
      script: 'server.js',                  // 启动脚本
      cwd: './backend',                     // 工作目录
      instances: 1,                         // 实例数量（开发环境1个，生产环境可根据CPU核心数调整）
      autorestart: true,                    // 崩溃后自动重启
      watch: false,                         // 开发模式可开启，监听文件变化自动重启
      max_memory_restart: '500M',          // 内存超过500MB时自动重启（防止内存泄漏）
      env: {
        NODE_ENV: 'production',            // 环境变量：生产环境
        PORT: 3000,                         // 端口号
        MQTT_BROKER: 'mqtt://localhost:1884' // MQTT Broker 地址
      },
      env_development: {
        NODE_ENV: 'development',
        PORT: 3000
      },
      // 日志配置
      log_file: './logs/combined.log',     // 合并日志文件
      out_file: './logs/out.log',          // 标准输出日志
      error_file: './logs/error.log',      // 错误日志
      log_date_format: 'YYYY-MM-DD HH:mm:ss',  // 日志时间格式
      combine_logs: true,                  // 合并所有实例的日志
      
      // 高级配置
      min_uptime: '10s',                   // 最小运行时间（用于判断是否是启动失败还是崩溃）
      max_restarts: 10,                    // 最多重启次数
      restart_delay: 4000,                 // 重启延迟（毫秒）
      
      // 故障检测
      exp_backoff_restart_delay: 100,      // 指数退避重启延迟（故障时逐步增加重启间隔）
      
      // 其他选项
      kill_timeout: 5000,                  // 停止进程等待时间（毫秒）
      listen_timeout: 3000,                // 启动超时时间（毫秒）
    },
    // MQTT Broker 服务
    {
      name: 'mqtt-broker',                 // 应用名称
      script: 'production-broker.js',       // 启动脚本
      cwd: './backend',                     // 工作目录
      instances: 1,                         // 单实例（MQTT Broker通常只需要一个）
      autorestart: true,                    // 崩溃后自动重启
      watch: false,                         // 不监听文件变化
      max_memory_restart: '200M',          // MQTT Broker内存限制
      env: {
        NODE_ENV: 'production',            // 环境变量：生产环境
        MQTT_PORT: 1884,                   // MQTT端口
        WS_PORT: 8084,                     // WebSocket端口
        MQTT_AUTH_ENABLED: 'true'          // 启用认证
      },
      env_development: {
        NODE_ENV: 'development',
        MQTT_PORT: 1884,
        WS_PORT: 8084,
        MQTT_AUTH_ENABLED: 'false'         // 开发环境禁用认证
      },
      // 日志配置
      log_file: './logs/mqtt-combined.log',     // 合并日志文件
      out_file: './logs/mqtt-out.log',          // 标准输出日志
      error_file: './logs/mqtt-error.log',      // 错误日志
      log_date_format: 'YYYY-MM-DD HH:mm:ss',  // 日志时间格式
      combine_logs: true,                  // 合并所有实例的日志
      
      // 高级配置
      min_uptime: '5s',                    // 最小运行时间
      max_restarts: 10,                    // 最多重启次数
      restart_delay: 2000,                 // 重启延迟（毫秒）
      
      // 故障检测
      exp_backoff_restart_delay: 100,      // 指数退避重启延迟
      
      // 其他选项
      kill_timeout: 5000,                  // 停止进程等待时间（毫秒）
      listen_timeout: 3000,                // 启动超时时间（毫秒）
    }
  ]
};
