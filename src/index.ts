import dotenv from 'dotenv';
import logger from './logger';
import { init } from 'app';

dotenv.config();

init().then(() => {
    logger.info('Done');
}, (err) => {
    logger.error('Error running app', err);
});
