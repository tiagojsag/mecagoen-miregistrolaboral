import logger from './logger';
import axios, { AxiosRequestConfig } from 'axios';
import { parse } from 'node-html-parser';
import eachLimit from 'async/eachLimit';
import * as fs from "fs";
import sleep from 'sleep';

const init = async (): Promise<any> => {

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
    logger.info('Login successful!')


    logger.info('Loading body...')

    const bodyRequestConfig: AxiosRequestConfig = {
        method: 'get',
        url: 'https://app.miregistrolaboral.es/panel',
        headers: {
            'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64; rv:82.0) Gecko/20100101 Firefox/82.0',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5',
            'Connection': 'keep-alive',
            'Referer': 'https://app.miregistrolaboral.es/login',
            'Cookie': loginResponse.headers['set-cookie'],
            'Upgrade-Insecure-Requests': '1',
            'Pragma': 'no-cache',
            'Cache-Control': 'no-cache',
            'TE': 'Trailers'
        }
    };

    const bodyResponse = await axios(bodyRequestConfig);

    logger.info('Body loaded successfully, extracting txtUsu')

    const bodyHTML = parse(bodyResponse.data);
    const txtIdUsu = bodyHTML.querySelector('#txtIdUsu').getAttribute('value');

    logger.info(`txtUsu extracted, value found: ${txtIdUsu}`);

    logger.info('Loading list of days pending validation')

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
            'Cookie': loginResponse.headers['set-cookie'],
            'Pragma': 'no-cache',
            'Cache-Control': 'no-cache',
            'TE': 'Trailers'
        },
        data: `funct=cargar_dias_pendientes&id_cli=${txtIdUsu}`
    };

    const pendingDaysResponse = await axios(pendingDaysRequestConfig);

    logger.info(`Number of days pending validation: ${pendingDaysResponse.data.row.length}`)

    const validateDataRow = async (dataRow) => {
        const dataRowHTML = parse(dataRow);
        const dayId = dataRowHTML.querySelector('').getAttribute('data-id');
        const dayString:string = `${dataRowHTML.querySelector('').getAttribute('data-fecha')} ${dataRowHTML.querySelector('').getAttribute('data-year')}` ;

        logger.info(`Validating date (in spanish) ${dayString}`);


        const validateDayRequestConfig:AxiosRequestConfig = {
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
                'Cookie': loginResponse.headers['set-cookie'],
                'Pragma': 'no-cache',
                'Cache-Control': 'no-cache',
                'TE': 'Trailers'
            },
            data: `funct=validar_dia&id_cli=${txtIdUsu}&id=${dayId}`
        };

        const validateDayResponse = await axios(validateDayRequestConfig);

        if (validateDayResponse.data.estado !== 'DONE') {
            throw new Error(`Validating date (in spanish) ${dayString} FAILED, aborting`);
        }
        logger.info(`Validated date (in spanish) ${dayString} successfully!!!`);

        sleep.sleep(process.env.DELAY || 2);
    }

    if(pendingDaysResponse.data.estado == 'DONE'){
        await eachLimit(pendingDaysResponse.data.row, 1, validateDataRow)
    }
    

    // for those that are also lazy to validate this.
    logger.info('Loading list of days pending validation')

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
            'Cookie': loginResponse.headers['set-cookie'],
            'Pragma': 'no-cache',
            'Cache-Control': 'no-cache',
            'TE': 'Trailers'
        },
        data: `funct=cargar_firmas_pendientes&id_cli=${txtIdUsu}`
    };

    const pendingMonthsResponse = await axios(pendingMonthsRequestConfig);
    const signatureImage = fs.readFileSync(process.env.SIGNATURE_PATH, {encoding: 'base64'});
    const validateMonthDataRow = async (dataRow) => {
        const dataRowHTML = parse(dataRow);
        const pendingHours = dataRowHTML.querySelector('').getAttribute('data-horas-pendientes');
        if (pendingHours =='0'){
            const validateHours = dataRowHTML.querySelector('').getAttribute('data-horas-validadas');
            const dayString:string = `${dataRowHTML.querySelector('').getAttribute('data-fecha')} ${dataRowHTML.querySelector('').getAttribute('data-year')}` ;

            logger.info(`Validating ${validateHours} for ${dayString}`);


            const validateDayRequestConfig:AxiosRequestConfig = {
                method: 'post',
                url: 'https://app.miregistrolaboral.es/control/ajax/upload.php',
                headers: {
                    'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64; rv:82.0) Gecko/20100101 Firefox/82.0',
                    'Accept': '*/*',
                    'Accept-Language': 'en-US,en;q=0.5',
                    'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
                    'X-Requested-With': 'XMLHttpRequest',
                    'Origin': 'https://app.miregistrolaboral.es',
                    'Connection': 'keep-alive',
                    'Referer': 'https://app.miregistrolaboral.es/panel',
                    'Cookie': loginResponse.headers['set-cookie'],
                    'Pragma': 'no-cache',
                    'Cache-Control': 'no-cache',
                    'TE': 'Trailers'
                },
                data: `'base64=${signatureImage}&id_cli=${txtIdUsu}&id_val=${dayString}&horas=${validateHours}`
            };

            const validateDayResponse = await axios(validateDayRequestConfig);

            if (validateDayResponse.data.estado !== 'DONE') {
                throw new Error(`Validating date (in spanish) ${dayString} FAILED, aborting`);
            }
            logger.info(`Validated month ${dayString} successfully!!!`);
        }
        sleep.sleep(process.env.DELAY || 2);
    }
    await eachLimit(pendingMonthsResponse.data.row, 1, validateMonthDataRow)
};

export { init };
