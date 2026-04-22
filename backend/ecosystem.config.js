module.exports = {
  apps: [
    {
      name: "ecommerce-backend",
      script: "server.js",
      instances: "max", // PRODUCTION: Utilize all CPU cores for 2000 concurrent users
      exec_mode: "cluster",
      watch: false,
      max_memory_restart: "600M", // Lower memory limit for better stability under high load
      
      // ENVIRONMENT CONFIGURATION
      env: {
        NODE_ENV: "production",
        LOG_LEVEL: "warn",
        PM2_LOG_DATE_FORMAT: "YYYY-MM-DD HH:mm:ss Z"
      },
      env_development: {
        NODE_ENV: "development",
        LOG_LEVEL: "debug",
        PM2_LOG_DATE_FORMAT: "YYYY-MM-DD HH:mm:ss Z"
      },
      
      // LOG MANAGEMENT
      error_file: "logs/pm2-error.log",
      out_file: "logs/pm2-out.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",
      merge_logs: true,
      
      // RELIABILITY & ZERO-DOWNTIME
      autorestart: true,
      
      // ADVANCED CONFIGURATION
      node_args: [
        "--max-old-space-size=1024" // Limit old space heap size
      ],
      
      // MONITORING
      pmx: true, // Enable PM2 monitoring
      vizion: false, // Disable file versioning in production
      
      // RESTART STRATEGIES
      min_uptime: "10s", // Minimum uptime before restart
      max_restarts: 10, // Max restarts per hour
      restart_delay: 4000, // Delay between restarts
      
      // GRACEFUL SHUTDOWN
      kill_timeout: 30000, // 30 seconds for graceful shutdown
      listen_timeout: 30000,
      
      // CLUSTER CONFIGURATION
      instance_var: "INSTANCE_ID",
      pmx: true,
      vizion: false,
      
      // ENVIRONMENT-SPECIFIC
      env_production: {
        NODE_ENV: "production",
        LOG_LEVEL: "warn",
        PM2_LOG_DATE_FORMAT: "YYYY-MM-DD HH:mm:ss Z"
      },
      
      env_development: {
        NODE_ENV: "development",
        LOG_LEVEL: "debug",
        PM2_LOG_DATE_FORMAT: "YYYY-MM-DD HH:mm:ss Z"
      }
    },
    {
      name: "ecommerce-worker",
      script: "services/worker.service.js",
      instances: 2, // 2 worker processes for background jobs
      exec_mode: "fork",
      watch: false,
      max_memory_restart: "400M", // Workers use less memory
      
      env: {
        NODE_ENV: "production",
        LOG_LEVEL: "warn"
      },
      
      // Worker-specific settings
      autorestart: true,
      exp_backoff_restart_delay: 8000, // Longer backoff for workers
      min_uptime: "5s",
      max_restarts: 5,
      
      // Worker logging
      error_file: "logs/worker-error.log",
      out_file: "logs/worker-out.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",
      merge_logs: true,
      
      // Worker monitoring
      pmx: true,
      kill_timeout: 8000,
      listen_timeout: 10000,
      
      // Worker node args
      node_args: [
        "--max-old-space-size=512"
      ]
    }
  ],
  
  // DEPLOYMENT CONFIGURATION
  deploy: {
    production: {
      user: "deploy",
      host: "localhost",
      ref: "origin/main",
      repo: "git@github.com:user/ecommerce-backend.git",
      path: "/var/www/ecommerce-backend",
      "pre-deploy-local": "npm install",
      "post-deploy": "pm2 reload ecosystem.config.js --env production",
      "pre-setup": "npm install"
    }
  }
};
