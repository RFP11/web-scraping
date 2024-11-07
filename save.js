const etsyServ = async () => {
    puppeteer.use(Stealth())
    logger.info('Creating web Browser')
    const browser = await puppeteer.launch({
        executablePath: executablePath(),
        headless: true,
        slowMo: 200,
        args: [`--proxy-server=${host}`]
    })

    logger.info('Opening new page')
    const page = await browser.newPage()

    logger.info('Proxies init')
    await page.authenticate(proxyAuth)

    logger.info(`Navigating to ${etsy}`)
    await page.goto(etsy)
    await page.waitForNetworkIdle()

    logger.info('Taking screenshot!')
    await page.screenshot({path: 'etsy.png', fullpage: true})

    logger.info('Downloading HTML Content')
    const content = await page.content()
    fs.writeFileSync('etsy.html', content)
    logger.info('HTML file created')

    logger.info('Closing Browser')
    await browser.close()
}



const zillowServ = async () => {
    puppeteer.use(Stealth())
    logger.info('Creating web Browser')
    const browser = await puppeteer.launch({
        executablePath: executablePath(),
        headless: false,
        slowMo: 200,
        args: [`--proxy-server=${host}`]
    })

    logger.info('Opening new page')
    const page = await browser.newPage()

    logger.info('Abort CSS and image request')
    await page.setRequestInterception(true);
    page.on('request', (request) => {
        const url = request.url();
        if (request.resourceType() === 'image' || request.resourceType() === 'stylesheet') {
        request.abort(); 
        } else {
        request.continue();
        }
    });

    logger.info('Proxies init')
    await page.authenticate(proxyAuth)
    logger.info(proxyAuth.username)
    logger.info(proxyAuth.password)

    logger.info(`Navigating to ${zillow}`)
        await page.goto(zillow, {
            timeout: 0
        })
    
    logger.info('Screenshot page')
    await page.screenshot({path: 'zillow1.png', fullpage: true})

    const targetElementSelector = 'li.PaginationJumpItem-c11n-8-106-0__sc-h97wcm-0.fbkLhp a[rel="next"]';

    // Scroll 
    await scrollFun(targetElementSelector, page)

    logger.info('Screenshot page')
    await page.screenshot({path: 'zillow2.png', fullpage: true})

    logger.info('Closing Browser')
    await browser.close()
}
