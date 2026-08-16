// PM2 process configuration for bot-backend
// Usage on the server:
//   pm2 delete bot-backend        (if it's already running from a raw `pm2 start server.js`)
//   pm2 start ecosystem.config.cjs
//   pm2 save
//
// This adds automatic restarts (including on OOM-kill / crash) and a memory
// safety net so a runaway process gets restarted instead of being SIGKILLed
// by the kernel OOM killer and leaving the app down.
module.exports = {
  apps: [
    {
      name: 'bot-backend',
      script: 'server.js',
      cwd: __dirname,
      exec_mode: 'fork',
      instances: 1,
      autorestart: true,
      restart_delay: 3000,       // wait 3s before restarting after a crash
      max_restarts: 20,
      min_uptime: '10s',
      max_memory_restart: '400M', // restart if the process grows past this (tune to your server RAM)
      env: {
        NODE_ENV: 'production'
      },
      error_file: '~/.pm2/logs/bot-backend-error.log',
      out_file: '~/.pm2/logs/bot-backend-out.log',
      time: true
    }
  ]
};
