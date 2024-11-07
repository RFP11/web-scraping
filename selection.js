const puppeteer = require('puppeteer-extra')
const Stealth = require('puppeteer-extra-plugin-stealth')
const {executablePath} = require('puppeteer')
const fs = require('fs')
const winston = require('winston')
const TwoCaptcha = require('@2captcha/captcha-solver')
const { timeout } = require('puppeteer-core')
const { time, log } = require('console')
require('dotenv').config()

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
const zillow = "file:///D:/data%20game/Lamar/mrscraper/bot.html"

// proxy
const host = process.env.HOST
const proxyAuth = {
    username: process.env.P_USER,
    password: process.env.P_PASS
}

// 2captcha
const apiKey = process.env.API_KEY
const solver = new TwoCaptcha.Solver(apiKey)

const zillowServ = async () => {
    puppeteer.use(Stealth())
    logger.info('Creating web Browser')
    const browser = await puppeteer.launch({
        executablePath: executablePath(),
        headless: false,
    })

    logger.info('Opening new page')
    const page = await browser.newPage()

    logger.info(`Navigating to ${zillow}`)
    await page.goto(zillow, {
        timeout: 0
    })

    const element = await page.$('#px-captcha'); 

    const boundingBox = await element.boundingBox();

    if (boundingBox) {
    // Calculate the center of the element
    const centerX = boundingBox.x + boundingBox.width / 2;
    const centerY = boundingBox.y + boundingBox.height / 2;

    // Move the mouse to the center of the element
    await page.mouse.move(centerX, centerY);

    // Click and hold for 10 seconds
    await page.mouse.down();
    sleep(10000)
    await page.mouse.up();
    } else {
    console.log('Element not found or bounding box is not available');
    }
 
            
    logger.info('Closing Browser')
    await browser.close()
}

function sleep(ms) {
    const start = Date.now();
    while (Date.now() - start < ms);
}


zillowServ()