const pino = require("pino");
const chalk = require("chalk");
const env = require("../config/env");

const isDev = env.NODE_ENV === "development";

const logger = pino({
  level: isDev ? "debug" : "info",
  transport: isDev ? {
    target: "pino-pretty",
    options: {
      colorize: true,
      ignore: "pid,hostname",
      translateTime: "HH:MM:ss Z",
    },
  } : undefined,
  formatters: {
    level: (label) => {
      return { level: label.toUpperCase() };
    },
  },
  timestamp: pino.stdTimeFunctions.isoTime,
});

module.exports = {
  logger,
  chalk,
  // Helper for consistent logging
  info: (msg, obj) => logger.info(obj, msg),
  error: (msg, obj) => logger.error(obj, msg),
  warn: (msg, obj) => logger.warn(obj, msg),
  fatal: (msg, obj) => logger.fatal(obj, msg),
};
