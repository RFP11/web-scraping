const puppeteer = require('puppeteer-extra')
const Stealth = require('puppeteer-extra-plugin-stealth')
const {executablePath} = require('puppeteer')
const puppeteerCore = require('puppeteer-core')
const fs = require('fs')
const winston = require('winston')
const TwoCaptcha = require('@2captcha/captcha-solver')
const { timeout } = require('puppeteer-core')
const UserAgent = require('user-agents')
const { create } = require('domain')
require('dotenv').config()
const path = require('path')
const { autoScroll } = require('./autoScroll')
const {load} = require('cheerio')

const logger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.printf(({ level, message, timestamp }) => {
        return `${timestamp} [${level.toUpperCase()}]: ${message}`;
      })
    ),
    transports: [
      new winston.transports.Console(), 
      new winston.transports.File({ filename: 'app.log' }), 
    ],
  });

// zillow loop
const zillow = "https://www.zillow.com/california-city-ca"

// try and error
const etsy = "https://www.etsy.com/search?q=wall+decor"

// proxy
const host = process.env.HOST
const proxyAuth = {
    username: process.env.P_USER,
    password: process.env.P_PASS
}

// zenrows
const ZENROWS = `wss://browser.zenrows.com?apikey=${process.env.ZENROWS}`;
const ZENROWS2 = `wss://browser.zenrows.com?apikey=${process.env.ZENROWS_BP}`;

const titleErr = 'Access to this page has been denied'


// 2captcha
const apiKey = process.env.API_KEY
const solver = new TwoCaptcha.Solver(apiKey)

async function initBrowser(){
    puppeteer.use(Stealth())
    logger.info('Creating web Browser')
    return await puppeteer.launch({
        executablePath: executablePath(),
        headless: false,
        slowMo: 200,
        args: [`--proxy-server=${host}`]
    })

}

async function initZenrows(){
    return await puppeteerCore.connect({browserWSEndpoint: ZENROWS})
}

function sleep(ms) {
    const start = Date.now()
    while (Date.now() - start < ms);
}

async function changeUserAgent(page){
    const userAgent = new UserAgent({deviceCategory: 'desktop'})
    const randomUserAgent = userAgent.toString()
    await page.setUserAgent(randomUserAgent)
}

async function pagination(oldPage,oldBrowser, uri, currentPage=1, targetPage=5){
    currentPage++
    logger.info(uri)
    let url = uri+`/${currentPage}_p`
    logger.info(url)

    logger.info('Closing old Page')
    await Promise.all(oldPage.map((page) => page.close()));
    await oldBrowser.close()

    sleep(1000)

    const browser = await initBrowser()

    logger.info('Creating new Page')
    const page = await createPage(browser)

    sleep(500)

    logger.info(`Navigating to ${url}`)
    await page.goto(url, {
        timeout : 0
    })

    sleep(1000)

    const title = await page.title()

    if (title == titleErr){
        await pagination(page, browser, uri, currentPage--, targetPage)
    }

    sleep(2000)
    await autoScroll(page)

    const html = await page.content()

    await takeData(html)
    
    const htmlName = `web${currentPage}`

    await page.screenshot({path: `localDebug/pagination${currentPage}.png`})

    sleep(1000)

    if(currentPage < targetPage){
        await pagination(page, browser, uri, currentPage, targetPage)
    }else{
        return browser
    }

}

async function zenPagination(page, uri, currentPage=0, targetPage=5){
    currentPage++
    logger.info(uri)
    const url = uri+`/${currentPage}_p`
    logger.info(`Visiting ${url}`)
    await page.goto(url, {
        timeout : 0
    })

    const title = await page.title()
    logger.info(title)
    if(title == titleErr){
        logger.info('Solving Captcha')
        await captchaSolver(page)
    }

    await page.waitForNetworkIdle({
        timeout : 0
    })
    logger.info('Taking Screenshot')


    await page.screenshot({path: `zenrowsDebug/pagination${currentPage}.png`})

    if (currentPage < targetPage){
        logger.info(`Itterating to next pagination`)
        await zenPagination(page, uri, currentPage, targetPage)
    }
}

async function createPage(browser){
    logger.info('Opening new page')
    const page = await browser.newPage()

    changeUserAgent(page)

    logger.info('Proxies init')
    await page.authenticate(proxyAuth)
    logger.info(proxyAuth.username)
    logger.info(proxyAuth.password)

    return page
}

async function downloadHTML(page, title){
    logger.info('Downloading HTML Content')
    const content = await page.content()
    fs.writeFileSync(`htmlFile/${title}.html`, content)
    logger.info('HTML file created')
}

async function captchaSolver(page) {
    const element = await page.$('#px-captcha')

    const boundingBox = await element.boundingBox()

    if (boundingBox) {
        const centerX = boundingBox.x + boundingBox.width / 2
        const centerY = boundingBox.y + boundingBox.height / 2

        const randomOffsetX = Math.random() * 10 - 5
        const randomOffsetY = Math.random() * 10 - 5

        sleep(2000)

        const steps = 20
        for (let i = 0; i < steps; i++) {
            const x = centerX + randomOffsetX + (Math.random() * 2 - 1) * 2
            const y = centerY + randomOffsetY + (Math.random() * 2 - 1) * 2

            await page.mouse.move(x, y)
            sleep(Math.random() * 30 + 20)
        }

      
        sleep(Math.random() * 500 + 300)

        // Click and hold for 10 seconds
        await page.mouse.down()
        sleep(10000)
        await page.mouse.up()

        try {
            await page.waitForNavigation()
        } catch (error) {
            logger.info('Retrying')
            const title = await page.title()
            if (title == titleErr){
                await captchaSolver(page)
            }
        }
    } else {
        console.warn('Element not found')
    }

    await page.waitForNavigation()

}

async function takeData(content){
    const $ = load(content)
    const items = []
    const ulTags = $('#grid-search-results > ul > li')

    ulTags.each((index, element)=>{
        const itemData = $(element).find('article > div > div').first().text().trim()

        const addressMatch = itemData.match(/^[^$]+/); 
        const priceMatch = itemData.match(/\$\d+(,\d{3})*/); 
        const bedsMatch = itemData.match(/(\d+) bds/); 
        const bathsMatch = itemData.match(/(\d+) ba/); 

        const item = {
            iaddress: addressMatch ? addressMatch[0].trim() : null,
            price: priceMatch ? priceMatch[0] : null,
            beds: bedsMatch ? bedsMatch[1] : null,
            baths: bathsMatch ? bathsMatch[1] : null,
        }

        if (!Object.values(item).includes(null)) {
            items.push(item);
        }
    })

    console.log(items)
}

const zillowCaptchaServe = async () => {
    const browser = await initBrowser()
    const page = await createPage(browser)

    await page.goto(zillow, {
        timeout : 0
    })

    await page.goto(zillow+'/2_p', {
        timeout : 0
    })

    const title = await page.title()
    if (title == titleErr){
        await captchaSolver(page)
    }

    await browser.close()
}

const zillowServ = async () => {
    let browser = await initBrowser()
    const page = await createPage(browser)

    browser = await pagination(page,browser, zillow, 0, 1)
    
    await browser.close()
}

const etsyServe = async () => {
    const browser = await initZenrows()
    const page = await browser.newPage()

    sleep(1000)

    logger.info(`Navigating to ${etsy}`)
    await page.goto(etsy)

    sleep(3000)

    logger.info('Taking Screenshot')
    await page.screenshot({path: 'zenrowsDebug/etsy.png', fullPage: true})

    sleep(2000)

    const title = await page.title()

    await browser.close()

}


zillowServ()
// zillowCaptchaServe()
// etsyServe()
// extractFile()