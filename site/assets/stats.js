// 쿠키 없는 방문 통계 (GoatCounter). CODE가 비어 있으면 아무것도 보내지 않는다.
// 켜는 법: 1) goatcounter.com에서 무료 계정을 만들고 사이트 코드(예: sajushopping)를 정한다.
//          2) 아래 CODE에 그 코드를 넣는다.  3) privacy.html에 방문 통계 문단을 넣는다.
// 주소의 ?from=이름 같은 값은 보내지 않게 경로(pathname)만 센다.
(function () {
  "use strict";
  var CODE = "";

  /** 공유 버튼 같은 행동을 센다 (예: "share-kakao"). 통계가 꺼져 있으면 아무것도 안 한다. */
  window.sajuStats = function (name) {
    var gc = window.goatcounter;
    if (CODE && gc && typeof gc.count === "function") {
      gc.count({ path: "event/" + name, title: name, event: true });
    }
  };

  if (!CODE) return;
  window.goatcounter = { path: function () { return window.location.pathname; } };
  var s = document.createElement("script");
  s.async = true;
  s.src = "https://gc.zgo.at/count.js";
  s.setAttribute("data-goatcounter", "https://" + CODE + ".goatcounter.com/count");
  document.head.appendChild(s);
})();
