import bunyan = require('bunyan');

const streams: Record<string, unknown>[] = [
    {
        stream: process.stdout,
        level: process.env.LOGGER_LEVEL || 'debug'
    }, {
        stream: process.stderr,
        level: 'warn'
    },
];

const logger = bunyan.createLogger({
    name: 'mecagoen-miregistrolaboral',
    src: true,
    streams,
});

export default logger;
