async function autoScroll(page) {
    await page.evaluate(async () => {
      const wrapper = document.querySelector('div[id="search-page-list-container"]');

      await new Promise((resolve, reject) => {
        var totalHeight = 0;
        var distance = 1000;
        var scrollDelay = 3000;

        var timer = setInterval(async () => {
          var scrollHeightBefore = wrapper.scrollHeight;
          wrapper.scrollBy(0, distance);
          totalHeight += distance;

          if (totalHeight >= scrollHeightBefore) {
            totalHeight = 0;
            await new Promise((resolve) => setTimeout(resolve, scrollDelay));

            // Calculate scrollHeight after waiting
            var scrollHeightAfter = wrapper.scrollHeight;

            if (scrollHeightAfter > scrollHeightBefore) {
              // More content loaded, keep scrolling
              return;
            } else {
              // No more content loaded, stop scrolling
              clearInterval(timer);
              resolve();
            }
          }
        }, 200);
      });
    });
  }

  module.exports = {
    autoScroll
  }