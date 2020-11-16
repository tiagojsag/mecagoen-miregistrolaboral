import logger from './logger';
import { init } from 'app';

init().then(() => {
    logger.info('Server running');
}, (err) => {
    logger.error('Error running server', err);
});
