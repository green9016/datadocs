//
// Created by gab on 16/12/19
//

const importScripts = src => {
  var s = document.createElement('script');
  s.src = src;
  s.type = "text/javascript";
  s.async = false;
  document.getElementsByTagName('head')[0].appendChild(s);
};
importScripts("./emingest.js");
importScripts("./test_emingest.js")
