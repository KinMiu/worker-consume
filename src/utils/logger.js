const getDevTime = () => {
  return new Date().toLocaleString();
};

const logger = {
  info: (message) => {
    console.log(`[INFO] ${getDevTime()} - ${message}`);
  },
  error: (message) => {
    console.log(`[ERROR] ${getDevTime()} - ${message}`);
  },
  warn: (message) => {
    console.log(`[WARN] ${getDevTime()} - ${message}`);
  },
};

export default logger;
