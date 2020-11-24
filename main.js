const superagent = require("superagent"); //发送网络请求获取DOM
const cheerio = require("cheerio"); //能够像Jquery一样方便获取DOM节点
const nodemailer = require("nodemailer"); //发送邮件的node插件
const ejs = require("ejs"); //ejs模版引擎
const fs = require("fs"); //文件读写
const path = require("path"); //路径配置
const schedule = require("node-schedule"); //定时器任务库

const local = "hebei/baoding"; //想要得到天气数据的地理位置
const OneUrl = "http://wufazhuce.com"; 
const WeatherUrl = "https://tianqi.moji.com/weather/china/" + local;


let startDay = "2017/5/30";

let EmailService = "qq";
let EmailAuth = {
    user: "419336259@qq.com",
    pass:"acxewmotwxedbidh"
};

let EmailFrom = '"mm" <419336259@qq.com>';
let EmailTo = "1393007374@qq.com";
let EmailSubject = "日常";

let EmailHour = 5;
let EmailMinute = 30;

// 获取one网站数据
function getOneData() {
    let p = new Promise(function (resolve, reject) {
        superagent.get(OneUrl).end(function (err, res) {
                if (err) {
                    reject(err);
                }
                //获取网站的具体需要的数据
                let $ = cheerio.load(res.text);
                let selectItem = $('#carousel-one .carousel-inner .item');
                let todayOne = selectItem[0];
                let todayOneData = {
                    imgUrl: $(todayOne).find('.fp-one-imagen').attr('src'),
                    type: $(todayOne).find('.fp-one-imagen-footer').text().replace(/(^\s*)|(\s*$)/g, ""),
                    text: $(todayOne).find('.fp-one-cita').text().replace(/(^\s*)|(\s*$)/g, "")
                };
                resolve(todayOneData);
            })
    });
    return p;
}
function getWeatherTips(){
    let p = new Promise(function (resolve, reject) {
        superagent.get(WeatherUrl).end(function (err,res) {
            if (err){
                reject(err);
            }
            let threeDaysData = [];
            let weatherTip = "";
            let $ = cheerio.load(res.text);
            $(".wea-tips").each(function (i, elem) {
                weatherTip = $(elem).find("em").text();
            });
            resolve(weatherTip);
        });
    });
    return p;

}

function getWeatherData(){
    let p = new Promise(function(resolve, reject){
        superagent.get(WeatherUrl).end(function(err,res){
            if (err){
                reject(err);
            }
            let threeDaysData = [];
            let $ = cheerio.load(res.text);
            $(".forecast .days").each(function (i,elem) {
                let singleDay = $(elem).find("li");
                threeDaysData.push({
                    Day:$(singleDay[0]).text().replace(/(^\s*)|(\s*$)/g,""),
                    WeatherImgUrl: $(singleDay[1]).find("img").attr("src"),
                    WeatherText: $(singleDay[1]).text().replace(/(^\s*)|(\s*$)/g,""),
                    Temperature: $(singleDay[2]).text().replace(/(^\s*)|(\s*$)/g, ""),
                    WindDirection: $(singleDay[3]).find("em").text().replace(/(^\s*)|(\s*$)/g,""),
                    WindLevel: $(singleDay[3]).find("b").text().replace(/(^\s*)|(\s*$)/g,""),
                    Pollution: $(singleDay[4]).text().replace(/(^\s*)|(\s*$)/g, ""),
                    PollutionLevel: $(singleDay[4]).find("strong").attr("class")
                });
                });
            resolve(threeDaysData);
            });
        });
    return p;
}

function sendMail(HtmlData) {
    const template = ejs.compile(
        fs.readFileSync(path.resolve(__dirname, "mail.ejs"), "utf8")
    );
    const html = template(HtmlData);

    let transporter = nodemailer.createTransport({
        service: EmailService,
        port:465,
        secureConnection : true,
        auth: EmailAuth
    });
    let mailOptions = {
        from: EmailFrom,
        to: EmailTo,
        subject: EmailSubject,
        html: html
    };
    transporter.sendMail(mailOptions, (error, info = {}) => {
        if(error){
            console.log(error);
            sendMail(HtmlData);
        }
        console.log("邮件发送成功",info.messageId);
        console.log("等待下一次发送");
    })
}
function getAllDataAndSendMail() {
    let HtmlData = {};

    let today  = new Date();
    let initDay = new Date(startDay);
    let lastDay = Math.floor((today-initDay)/1000/60/60/24);
    let todaystr = today.getFullYear() + "/" + (today.getMonth() + 1) + "/" + today.getDate();
    HtmlData["lastDay"] = lastDay;
    HtmlData["todaystr"] = todaystr;

    Promise.all([getOneData(), getWeatherTips(), getWeatherData()]).then(
        function(data){
            HtmlData["todayOneData"] = data[0];
            HtmlData["weatherTip"] = data[1];
            HtmlData["threeDaysData"] = data[2];
            sendMail(HtmlData);
        }
    ).catch(function (err) {
        getAllDataAndSendMail();
        console.log("获取数据失败： ", err);
    });

}
let rule = new schedule.RecurrenceRule();
rule.dayOfWeek = [0,new schedule.Range(1,6)];
rule.hour = EmailHour;
rule.minute = EmailMinute;
console.log('NodeMail: 开始等待目标时刻。。。');
let j = schedule.scheduleJob(rule, function () {
    console.log("执行任务");
    getAllDataAndSendMail();
});