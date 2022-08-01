import dotenv from 'dotenv';
import logger from './logger';
import { init } from 'app';

dotenv.config();

init().then(() => {
    logger.info('Server running');
}, (err) => {
    logger.error('Error running server', err);
});
