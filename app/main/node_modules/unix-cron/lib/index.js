const moment = require("moment");
const { newArray } = require("./utils");
const { MONTH_SHORTCUTS, DAYS_OF_WEEK_SHORTCUTS } = require("./constants");

// UNIX Cron refer: https://www.ibm.com/docs/en/db2oc?topic=task-unix-cron-format
class cron {
  constructor(cron) {
    let [minute, hour, dayOfMonth, month, dayOfWeek] = cron
      .toLowerCase()
      .split(" ");

    const parseKeywords = (s, kws) => {
      let res = s;
      kws.forEach((kw, idx) => {
        res = res.replace(new RegExp(kw, "g"), idx);
      });
      return res;
    };

    const parseList = (list, length, startFrom = 0, isDayOfWeek = false) => {
      const m = [];
      for (const s of list.split(",")) {
        let n = [];
        const [range, step] = s.split("/");
        if (range === "*") {
          n.push(...newArray(length, startFrom));
        } else if (/(\d+)\-(\d+)/.test(range)) {
          let start = parseInt(RegExp.$1);
          let end = parseInt(RegExp.$2);
          // sunday in dayOfWeek can be 0 or 7
          if (isDayOfWeek && end === 0) {
            end = 6;
            n.push(0);
          }
          n.push(...newArray(end - start + 1, start));
        } else if (/\d+/.test(range)) {
          n.push(parseInt(range));
        }
        if (step) {
          const stepN = parseInt(step);
          if (stepN > 0) {
            n = n.filter((_, idx) => idx % stepN === 0);
          }
        }
        m.push(...n);
      }
      return m;
    };

    this.minute = parseList(minute, 60);
    this.hour = parseList(hour, 24);
    this.dayOfMonth =
      dayOfMonth === "*" && dayOfWeek !== "*"
        ? []
        : parseList(dayOfMonth, 31, 1);
    this.month = parseList(parseKeywords(month, MONTH_SHORTCUTS), 12, 1);
    this.dayOfWeek =
      dayOfWeek === "*" && dayOfMonth !== "*"
        ? []
        : parseList(
            parseKeywords(dayOfWeek, DAYS_OF_WEEK_SHORTCUTS),
            7,
            0,
            true
          );
  }

  isMatchDate(date) {
    const d = moment(date);
    return (
      this.minute.includes(d.minute()) &&
      this.hour.includes(d.hour()) &&
      (this.dayOfMonth.includes(d.date()) ||
        this.dayOfWeek.includes(d.day())) &&
      this.month.includes(d.month() + 1)
    );
  }

  next(date = new Date()) {
    const daysOfMonth = (month, year) => {
      switch (month) {
        case 1:
        case 3:
        case 5:
        case 7:
        case 8:
        case 10:
        case 12:
          return 31;
        case 4:
        case 6:
        case 9:
        case 11:
          return 30;
        case 2:
          return year % 4 === 0 ? 29 : 28;
        default:
          return 0;
      }
    };
    const td = moment(date);
    const y = td.year();
    for (const dist of newArray(5)) {
      for (const m of this.month) {
        for (const d of newArray(daysOfMonth(m, y + dist), 1)) {
          for (const h of this.hour) {
            for (const min of this.minute) {
              const n = moment({
                year: y + dist,
                month: m - 1,
                date: d,
                hour: h,
                minute: min,
              });
              if (
                (this.dayOfMonth.includes(d) ||
                  this.dayOfWeek.includes(n.day())) &&
                n.isAfter(td)
              ) {
                return n.toDate();
              }
            }
          }
        }
      }
    }
    return null;
  }

  schedule(fn = () => {}) {
    const c = () => {
      if (this.isMatchDate(moment())) {
        fn();
      }
    };
    c();
    return setInterval(c, 60 * 1000);
  }
}

module.exports = cron;
