import logger from './logger';
import axios, { AxiosRequestConfig } from 'axios';
import { parse } from 'node-html-parser';
import eachLimit from 'async/eachLimit';
import fs from "fs";
import sleep from 'sleep';
import path from 'path';

const delay = process.env.DELAY || 3;

const init = async (): Promise<any> => {

    if (!process.env.MRL_USER) {
        throw new Error('Missing MRL User');
    }

    if (!process.env.MRL_PASSWORD) {
        throw new Error('Missing MRL Password');
    }

    if (!process.env.SIGNATURE_PATH && !process.env.SIGNATURE_STRING) {
        logger.warn('Missing signature file path and content string. Skipping monthly signature.')
    }

    if (process.env.SIGNATURE_PATH && process.env.SIGNATURE_STRING) {
        logger.warn('Both file path and content string present. Using file path.')
    }

    const data = `funct=login&use=${encodeURIComponent(process.env.MRL_USER)}&pas=${encodeURIComponent(process.env.MRL_PASSWORD)}`;

    const loginRequestConfig: AxiosRequestConfig = {
        method: 'post',
        url: 'https://app.miregistrolaboral.es/ajax/login.php',
        headers: {
            'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64; rv:82.0) Gecko/20100101 Firefox/82.0',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5',
            'Connection': 'keep-alive',
            'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
            'X-Requested-With': 'XMLHttpRequest',
            'Origin': 'https://app.miregistrolaboral.es',
            'Referer': 'https://app.miregistrolaboral.es/login'
        },
        data
    };

    const loginResponse = await axios(loginRequestConfig);

    if (loginResponse.data.estado !== 'DONE') {
        throw new Error('Login failed');
    }

    logger.info('Login successful!');

    logger.info('Loading body...');

    const bodyRequestConfig: AxiosRequestConfig = {
        method: 'get',
        url: 'https://app.miregistrolaboral.es/panel',
        headers: {
            'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64; rv:82.0) Gecko/20100101 Firefox/82.0',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5',
            'Connection': 'keep-alive',
            'Referer': 'https://app.miregistrolaboral.es/login',
            'Cookie': loginResponse.headers['set-cookie'].toString(),
            'Upgrade-Insecure-Requests': '1',
            'Pragma': 'no-cache',
            'Cache-Control': 'no-cache',
            'TE': 'Trailers'
        }
    };

    const bodyResponse = await axios(bodyRequestConfig);

    logger.info('Body loaded successfully, extracting txtUsu');

    const bodyHTML = parse(bodyResponse.data);
    const txtIdUsu = bodyHTML.querySelector('#txtIdUsu').getAttribute('value');
    const txtEmpresa = bodyHTML.querySelector('#txtEmpresa').getAttribute('value');

    logger.info(`txtUsu extracted, value found: ${txtIdUsu}`);

    logger.info('Loading list of days pending validation');

    const pendingDaysRequestConfig: AxiosRequestConfig = {
        method: 'post',
        url: 'https://app.miregistrolaboral.es/control/ajax/clientes.php',
        headers: {
            'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64; rv:82.0) Gecko/20100101 Firefox/82.0',
            'Accept': '*/*',
            'Accept-Language': 'en-US,en;q=0.5',
            'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
            'X-Requested-With': 'XMLHttpRequest',
            'Origin': 'https://app.miregistrolaboral.es',
            'Connection': 'keep-alive',
            'Referer': 'https://app.miregistrolaboral.es/panel',
            'Cookie': loginResponse.headers['set-cookie'].toString(),
            'Pragma': 'no-cache',
            'Cache-Control': 'no-cache',
            'TE': 'Trailers'
        },
        data: `funct=cargar_dias_pendientes&id_cli=${txtEmpresa}`
    };

    const pendingDaysResponse = await axios(pendingDaysRequestConfig);

    logger.info(`Number of days pending validation: ${pendingDaysResponse.data.row.length}`);

    const validateDataRow = async (dataRow) => {
        const dataRowHTML = parse(dataRow);
        const dayId = dataRowHTML.querySelector('div').getAttribute('data-id');
        const date = dataRowHTML.querySelector('div').getAttribute('data-dia');
        const dayString: string = `${dataRowHTML.querySelector('div').getAttribute('data-fecha')} ${dataRowHTML.querySelector('div').getAttribute('data-year')}`;

        logger.info(`Validating date (in spanish) ${dayString}`);


        const validateDayRequestConfig: AxiosRequestConfig = {
            method: 'post',
            url: 'https://app.miregistrolaboral.es/control/ajax/clientes.php',
            headers: {
                'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64; rv:82.0) Gecko/20100101 Firefox/82.0',
                'Accept': '*/*',
                'Accept-Language': 'en-US,en;q=0.5',
                'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
                'X-Requested-With': 'XMLHttpRequest',
                'Origin': 'https://app.miregistrolaboral.es',
                'Connection': 'keep-alive',
                'Referer': 'https://app.miregistrolaboral.es/panel',
                'Cookie': loginResponse.headers['set-cookie'].toString(),
                'Pragma': 'no-cache',
                'Cache-Control': 'no-cache',
                'TE': 'Trailers'
            },
            data: `funct=validar_dia&id_cli=${txtEmpresa}&id=${dayId}&id_empleado=${txtIdUsu}&dia=${date}`
        };

        const validateDayResponse = await axios(validateDayRequestConfig);

        if (validateDayResponse.data.estado !== 'DONE') {
            throw new Error(`Validating date (in spanish) ${dayString} FAILED, aborting`);
        }
        logger.info(`Validated date (in spanish) ${dayString} successfully!!!`);

        sleep.sleep(delay);
    };

    if (pendingDaysResponse.data.estado === 'DONE') {
        await eachLimit(pendingDaysResponse.data.row, 1, validateDataRow);
    }

    // for those that are also lazy to validate this.
    logger.info(`Loading list of Months pending signature for ${txtIdUsu}`);

    const pendingMonthsRequestConfig: AxiosRequestConfig = {
        method: 'post',
        url: 'https://app.miregistrolaboral.es/control/ajax/clientes.php',
        headers: {
            'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64; rv:82.0) Gecko/20100101 Firefox/82.0',
            'Accept': '*/*',
            'Accept-Language': 'en-US,en;q=0.5',
            'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
            'X-Requested-With': 'XMLHttpRequest',
            'Origin': 'https://app.miregistrolaboral.es',
            'Connection': 'keep-alive',
            'Referer': 'https://app.miregistrolaboral.es/panel',
            'Cookie': loginResponse.headers['set-cookie'].toString(),
            'Pragma': 'no-cache',
            'Cache-Control': 'no-cache',
            'TE': 'Trailers'
        },
        data: `funct=cargar_firmas_pendientes&id_cli=${txtEmpresa}`
    };

    let processMonthlySignature = true;

    let signatureBase64Prefix = 'base64=data:image/png;base64,';
    let signatureImage: string;
    if (process.env.SIGNATURE_PATH) {
        signatureImage = fs.readFileSync(path.resolve(process.cwd(), process.env.SIGNATURE_PATH), { encoding: 'base64' });
    } else if (process.env.SIGNATURE_STRING) {
        signatureImage = process.env.SIGNATURE_STRING;
        signatureBase64Prefix = signatureImage.startsWith(signatureBase64Prefix) ? "" : signatureBase64Prefix;
    } else {
        processMonthlySignature = false;
    }

    const validateMonthDataRow = async (dataRow) => {
        const dataRowHTML = parse(dataRow);
        const pendingHours = dataRowHTML.querySelector('div').getAttribute('data-horas-pendientes');
        if (pendingHours === '0') {
            const validateHours = dataRowHTML.querySelector('div').getAttribute('data-horas-validadas');
            const monthString: string = `${dataRowHTML.querySelector('div').getAttribute('data-fecha')}`;

            logger.info(`Validating ${validateHours} for ${monthString}`);

            const validateDayRequestConfig: AxiosRequestConfig = {
                method: 'post',
                url: 'https://app.miregistrolaboral.es/ajax/upload.php',
                headers: {
                    'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64; rv:82.0) Gecko/20100101 Firefox/82.0',
                    'Accept': '*/*',
                    'Accept-Language': 'en-US,en;q=0.5',
                    'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
                    'X-Requested-With': 'XMLHttpRequest',
                    'Origin': 'https://app.miregistrolaboral.es',
                    'Connection': 'keep-alive',
                    'Referer': 'https://app.miregistrolaboral.es/panel',
                    'Cookie': loginResponse.headers['set-cookie'].toString(),
                    'Pragma': 'no-cache',
                    'Cache-Control': 'no-cache',
                    'TE': 'Trailers'
                },
                data: `${signatureBase64Prefix}${signatureImage}&cliente=${txtEmpresa}&id_val=${encodeURIComponent(monthString)}&horas=${validateHours}`,
            };

            const validateDayResponse = await axios(validateDayRequestConfig);

            if (validateDayResponse.data.result !== 'DONE') {
                throw new Error(`Validating date (in spanish) ${monthString} FAILED, aborting`);
            }
            logger.info(`Validated month ${monthString} successfully!!!`);
        }
        sleep.sleep(delay);
    };

    if (processMonthlySignature) {
        const pendingMonthsResponse = await axios(pendingMonthsRequestConfig);

        if (pendingMonthsResponse.data.estado === 'DONE') {
            await eachLimit(pendingMonthsResponse.data.row, 1, validateMonthDataRow);
        }
    }

};

export { init };
