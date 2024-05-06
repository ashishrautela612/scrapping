const puppeteer = require("puppeteer");
require('dotenv').config();
const XLSX = require('xlsx');
let finalData=[];//this is the object where our data will be stored
let count=0;

//all required input fields
const inputs={
    url:"https://www.linkedin.com/login",
    email:"rimurutempest1861@gmail.com",
    password:"Ashish@123",
    keyword:"education",
    region:"india",
    industry1:"higher Education",
    industry2:"Professional Services",
    neededDataLength:50,
}

const main = async () => {

    //launch browser
    const browser = await puppeteer.launch({ headless: false });
    const page = await browser.newPage();
    await page.setViewport({
        width: 1200,
        height: 2000,
    });
    await page.goto(inputs.url, { waitUntil: 'networkidle2' });

    // Login
    await page.waitForSelector("#username");
    await page.type("#username", inputs.email, { delay: 100 });

    await page.waitForSelector("#password");
    await page.type("#password", inputs.password, { delay: 100 });
    await new Promise(resolve => setTimeout(resolve, 1000));
    await Promise.all([
        page.waitForNavigation(),
        page.keyboard.press("Enter"),
    ]);

    // Search keyword
    await page.waitForSelector('.search-global-typeahead__input');
    await page.type('.search-global-typeahead__input',inputs.keyword, { delay: 100 });
    await page.keyboard.press('Enter');



    //choose companies filter  
    await page.waitForSelector('#search-reusables__filters-bar');
    let buttonBar = await page.$('#search-reusables__filters-bar');
    let buttons = await buttonBar.$$('button');

    for (const button of buttons) {
        let innerText = await page.evaluate(val => val.textContent.trim(), button);
        if (innerText === "Companies") {
            await button.click();
            break;
        }
    }


    //geo location filter
    await page.waitForSelector("#searchFilter_companyHqGeo");
    let geoLocation = await page.$('#searchFilter_companyHqGeo');
    await geoLocation.click();
    await selector(page, "Add a location", inputs.region);


    //industry filter
    await page.waitForSelector("#searchFilter_industryCompanyVertical");
    let industry = await page.$('#searchFilter_industryCompanyVertical');
    await industry.click();
    await selector(page, "Add an industry", inputs.industry1);

    //second filter
    await page.waitForSelector("#searchFilter_industryCompanyVertical");
    let industry2 = await page.$('#searchFilter_industryCompanyVertical');
    await industry2.click();
    await selector(page, "Add an industry", inputs.industry2);


    //company size filter
    await page.waitForSelector("#searchFilter_companySize");
    let companySize = await page.$("#searchFilter_companySize");
    await companySize.click();

    await page.waitForSelector("#companySize-D");
    let size = await page.$("#companySize-D");
    await size.click();
    page.keyboard.press("Escape");

    //function for fetching the data
    fetchData(browser, page);

}



//common funtion for geolocation and company filter
async function selector(page, label, text) {
    await page.waitForSelector(`input[placeholder='${label}']`);
    let inputField = await page.$$(`input[placeholder='${label}']`);
    let sngleField = inputField[0];
    await sngleField.type(text, { delay: 100 });
    await new Promise(resolve => setTimeout(resolve, 1000));
    const ariaControls = await page.$eval(`input[placeholder='${label}']`, el => el.getAttribute('aria-controls'));

    await page.waitForSelector(`#${ariaControls}`);
    const div = await page.$(`#${ariaControls}`);

    await page.waitForSelector('span span');
    let chosenCountry = await div.$$('span span');

    for (const spn of chosenCountry) {
        const textContent = await spn.evaluate(span => span.innerText);
        await new Promise(resolve => setTimeout(resolve, 2000));

        if (textContent.toLowerCase() === text.toLowerCase()) {
            await spn.click();
            break;
        }
    }
    //show result button
    let Btns = ariaControls.split('-');
    let id = Btns[2];
    let newId = convert(id);//get id of show result button
    await page.waitForSelector(`#ember${newId}`);
    const showResult = await page.$(`#ember${newId}`);
    await new Promise(resolve => setTimeout(resolve, 2000));
    await page.evaluate((btn) => btn.click(), showResult);
}

function convert(id) {
    let newid = Array.from(id)
    let num = newid.filter((val) => {
        if (!isNaN(val)) {
            return val;
        }
    });
    let returnedval = parseInt(num.join(''), 10);
    returnedval += 2;
    return returnedval
}


function mapCompanySizeToRange(size) {
    if (size >= 1 && size <= 10) {
        return "#companySize-B"
    }
    else if (size >= 11 && size <= 50) {
        return "#companySize-C";
    } else if (size >= 51 && size <= 200) {
        return "#companySize-D";
    } else if (size >= 201 && size <= 500) {
        return "#companySize-E";
    } else if (size >= 501 && size <= 1000) {
        return "#companySize-F";
    } else {
        return "More than 1000";
    }
}

//fetch data function
async function fetchData(browser, page) {
    if(finalData.length==inputs.neededDataLength){
        await saveDataToExcel(finalData);
        console.log(finalData);
        await page.close();
        await browser.close();
        return;
    }
    await page.waitForSelector(".scaffold-layout__main");
    let container = await page.$(".scaffold-layout__main");

    await page.waitForSelector('span span a');
    
    let hrefs = await page.$$('span span a')

    let links = [];//these are all the hyperlinks

    let companiesData=[];
    
    for (let href of hrefs) {
        let link = await page.evaluate(link => link.getAttribute("href"), href);
        links.push(`${link}about`);
    }


    //iterate over the links to get the information
    for (const link of links) {
        console.log(count);
        count++;
        let companyData={};
        //create a new page for navigation
        const newPage = await browser.newPage();
        await newPage.setViewport({
            width: 1200,
            height: 600,
        });
        await newPage.goto(link, { waitUntil: 'networkidle2' });

        //company name
        await newPage.waitForSelector('h1');
        const company = await newPage.$$('h1');
        const companyName = await newPage.evaluate(val => val.innerText, company[0]);
        companyData["Name"]=companyName;

        await newPage.waitForSelector('dl');
        const detailList = await newPage.$$('.overflow-hidden dt');

         //all detaild about company
        for(let i in detailList){
           let data=await newPage.evaluate( (val)=>{
            const dataDescriptin=val.nextElementSibling.innerText.trim();
            const filter=dataDescriptin.split("\n");//this is mainly for phone number
            return [val.innerText,filter[0].trim()];
           },detailList[i])
           const [item1,item2]=data;
           companyData[item1]=item2;
        }
        finalData.push(companyData);
        
        await newPage.close();
    }
    await page.waitForSelector('button[aria-label="Next"');
    let button =await page.$('button[aria-label="Next"');
    await button.click();
    await page.waitForNavigation();
    fetchData(browser,page);
}


//save data to exel
const saveDataToExcel = async (data) => {
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(data);
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Companies');
    const filePath = 'india11-50.xlsx';
    XLSX.writeFile(workbook, filePath);
    console.log('Data saved to', filePath);
};
main();
