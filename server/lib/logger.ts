import pino from "pino";
import { serverEnv } from "./env";

const isDev = serverEnv.NODE_ENV !== "production";

export const logger = pino({
  level: serverEnv.LOG_LEVEL,
  transport: isDev
    ? {
        target: "pino-pretty",
        options: {
          colorize: true,
          ignore: "pid,hostname",
          translateTime: "HH:MM:ss Z",
        },
      }
    : undefined,
  formatters: {
    level: (label) => {
      return { level: label.toUpperCase() };
    },
  },
  base: isDev ? undefined : { env: serverEnv.NODE_ENV },
});
