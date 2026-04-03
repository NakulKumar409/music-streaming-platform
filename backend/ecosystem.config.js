/**
 * PM2 Ecosystem Configuration
 * Runs 3 clustered Node.js instances on ports 8000, 8001, 8002
 * Nginx upstream will load balance across all three.
 *
 * Race condition fix:
 *   - restart_delay: gives Redis time to start before PM2 respawns a crashed worker
 *   - listen_timeout: accommodates the Redis retry window (up to ~10 x 500ms = 5s) before server binds
 *   - max_restarts: caps runaway restart loops
 */
module.exports = {
  apps: [
    {
      name: "music-backend",
      script: "dist/app.js",
      instances: "max",         // Use all CPU cores
      exec_mode: "cluster",
      env: {
        NODE_ENV: "production",
        PORT: 8000,
      },
      env_file: ".env",
      watch: false,
      max_memory_restart: "512M",
      error_file: "logs/pm2-error.log",
      out_file: "logs/pm2-out.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss",

      // ── Crash recovery ──────────────────────────────────────────────────
      // Wait 3s before restarting after a crash.
      // This prevents workers from hammering Redis before it's ready on system boot.
      restart_delay: 3000,

      // After 10 restarts stop automatic restarts (prevents infinite crash loop)
      max_restarts: 10,
      min_uptime: "10s",        // Only count as "stable" if up for at least 10s

      // ── Graceful lifecycle ───────────────────────────────────────────────
      kill_timeout: 5000,
      wait_ready: false,        // We don't emit process.send("ready") — keep false
      listen_timeout: 15000,    // Allow up to 15s for Redis retries + server bind
    },
  ],
};

