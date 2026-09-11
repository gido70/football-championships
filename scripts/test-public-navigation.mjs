import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const store=new Map();
const location={href:'https://example.test/index.html',origin:'https://example.test'};
const listeners={};
const document={
  readyState:'complete',
  addEventListener(type,handler){listeners[type]=handler;},
  querySelectorAll(){return[];},
  querySelector(){return null;}
};
const sessionStorage={
  getItem(key){return store.get(key)||null;},
  setItem(key,value){store.set(key,value);}
};
const window={};
const context=vm.createContext({window,document,location,sessionStorage,URL,Date,JSON,Set,Object,String});
vm.runInContext(fs.readFileSync(new URL('../public-navigation.js',import.meta.url),'utf8'),context);

function backElement(initialHref){
  const attrs=new Map([['href',initialHref]]);
  return {
    dataset:{},
    classList:{add(){}},
    closest(){return null;},
    getAttribute(name){return attrs.get(name)||null;},
    setAttribute(name,value){attrs.set(name,value);},
    removeAttribute(name){attrs.delete(name);},
    set href(value){attrs.set('href',new URL(value,location.href).href);},
    get href(){return attrs.get('href');},
    textContent:'',
  };
}

function visit(target){
  window.PublicNavigation.remember(target);
  location.href=new URL(target,location.href).href;
}

function expectBack(expected,label,fallback='index.html'){
  const back=backElement(fallback);
  window.PublicNavigation.configureBack(back,fallback);
  assert.equal(back.href,new URL(expected,location.href).href);
  assert.equal(back.textContent,'← '+label);
}

visit('tournament.html?id=t1');
expectBack('index.html','الرئيسية');
visit('team.html?id=a1');
expectBack('tournament.html?id=t1','البطولة');
visit('player.html?id=p1');
expectBack('team.html?id=a1','الفريق');

// Following the player's back button must not overwrite the team's parent.
location.href='https://example.test/team.html?id=a1';
expectBack('tournament.html?id=t1','البطولة');
location.href='https://example.test/player.html?id=p1';

visit('match-live.html?id=m1');
expectBack('player.html?id=p1','اللاعب');

// Refresh keeps the same parent.
expectBack('player.html?id=p1','اللاعب');

// A later route to the same destination replaces the old parent for this tab.
location.href='https://example.test/index.html';
visit('match-live.html?id=m1');
expectBack('index.html','الرئيسية','tournament.html?id=t1');

// Opening a page directly uses its deterministic fallback.
location.href='https://example.test/player.html?id=direct';
expectBack('team.html?id=a1','الفريق','team.html?id=a1');

console.log('public navigation tests passed');
