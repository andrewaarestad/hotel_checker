
const url = process.env.TARGET_URL;
const userAgent = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/110.0.0.0 Safari/537.36';
const sendgridApiKey = process.env.SENDGRID_API_KEY

const puppeteer = require('puppeteer');
const sgMail = require('@sendgrid/mail');
const fs = require("fs");

let numEmailsSent = 0;
const delayMs = ms => new Promise(resolve => setTimeout(resolve, ms));

const sendEmail = async () => {
  sgMail.setApiKey(sendgridApiKey);

  const imageBase64 = fs.readFileSync('current_page.png', { encoding: 'base64' });
  const imageElement = `<img alt="Current Page" src="data:image/jpeg;base64,${imageBase64}" />`;
  const emailHtml = `<html><body><p>The hotel looks like it's available:</p>${imageElement}</body></html>`
  const msg = {
    to: process.env.EMAIL_RECIPIENT_ADDRESS,
    from: {
      email: process.env.EMAIL_SENDER_ADDRESS, name: process.env.EMAIL_SENDER_NAME
    },
    subject: 'Hotel available',
    // text: 'Hotel available',
    html: emailHtml
  }
  await sgMail.send(msg);
}


const checkAvailability = async (url) => {

  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  await page.setUserAgent(userAgent);

  console.log('Loading page...');
  await page.goto(url);
  console.log('Initial page load complete, waiting for secondary load to resolve...');
  // await page.waitForNavigation({
  //   waitUntil: 'networkidle2',
  // });
  await delayMs(10000);
  console.log('Taking screenshot');

  // save screenshot
  await page.screenshot({path: 'current_page.png'});

  console.log('Checking for page error');
  const [errorElement] = await page.$x('//*[contains(text(), "sorry but we were unable to complete your search.")]');

  if (!!errorElement) {
    console.log('Page error detected, trying again later');
    return;
  }

  console.log('Checking availability');
  const [element] = await page.$x('//*[contains(text(), "The hotel you selected is unavailable. Below are similar hotels you may like.")]');

  if (!element) {
    console.log('Available!');


    console.log('Sending notification email...');
    await sendEmail();
    console.log('Email sent');
    if (numEmailsSent > 2) {
      console.log('Exiting');
      process.exit(0);
    }
  } else {
    console.log('Not available');
  }
  await browser.close();


}


// this function calls getPrice every 10 minutes and logs the price to the console
const runAvailabilityCheckCycle = async () => {
  try {
    await checkAvailability(url);
  } catch (err) {
    console.log('Error during checkAvailability');
    console.error(err);
  }
  console.log('Waiting 10 minutes...');
  await delayMs(10 * 60 * 1000);
}


const run = async() => {
  while(1) {
    await runAvailabilityCheckCycle();
  }
}


run()
.then(() => process.exit(0))
.catch((err) => {
  console.error(err);
  process.exit(1);
});
