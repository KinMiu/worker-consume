const getDevTime = () => {
  return new Date().toLocaleString();
};

const logger = {
  info: (...args) => {
    console.log(`[INFO] ${getDevTime()} -`, ...args);
  },
  error: (...args) => {
    console.error(`[ERROR] ${getDevTime()} -`, ...args);
  },
  warn: (...args) => {
    console.warn(`[WARN] ${getDevTime()} -`, ...args);
  },
};

export default logger;
