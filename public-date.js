(function(){
  'use strict';

  const MONTHS=[
    'يناير','فبراير','مارس','أبريل','مايو','يونيو',
    'يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'
  ];
  const WEEKDAYS=['الأحد','الاثنين','الثلاثاء','الأربعاء','الخميس','الجمعة','السبت'];

  function parseDate(value){
    if(!value)return null;
    const text=String(value).trim();
    const plain=text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if(plain){
      const date=new Date(Number(plain[1]),Number(plain[2])-1,Number(plain[3]));
      return Number.isNaN(date.getTime())?null:date;
    }
    const date=new Date(text);
    return Number.isNaN(date.getTime())?null:date;
  }

  function format(value,options={}){
    const date=parseDate(value);
    if(!date)return '';
    const parts=[];
    if(options.weekday)parts.push(WEEKDAYS[date.getDay()]);
    if(options.day!==false)parts.push(String(date.getDate()));
    if(options.month!==false)parts.push(MONTHS[date.getMonth()]);
    if(options.year)parts.push(String(date.getFullYear()));
    return parts.join(' ');
  }

  window.PublicDate=Object.freeze({format,months:MONTHS.slice()});
})();
