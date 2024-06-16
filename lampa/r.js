// Radio SomaFM by @tsynik
// https://somafm.com/channels.xml
// https://somafm.com/channels.json
// https://github.com/rainner/soma-fm-player
(function () {
  'use strict';

  var api_url = 'https://somafm.com/channels.json';
  var genres_url = 'https://tsynik.github.io/lampa/genres.json';

  Lampa.Lang.add({
    radio_title: {
      ru: "Радио SomaFM",
      en: "Radio SomaFM"
    },
    radio_error: {
      ru: "Ошибка в загрузке потока",
      en: "Error loading station"
    }
  });

  // parse channels list from api response
  function parseChannels(channels) {
    let output = [];
    if (Array.isArray(channels)) {
      for (let c of channels) {
        if (!Array.isArray(c.playlists)) continue;
        c.plsfile = 'https://api.somafm.com/' + c.id + '.pls';
        c.mp3file = 'https://ice1.somafm.com/' + c.id + '-128-mp3';
        c.aacfile = 'https://ice1.somafm.com/' + c.id + '-128-aac';
        c.songsurl = 'https://somafm.com/songs/' + c.id + '.json';
        c.infourl = 'https://somafm.com/' + c.id + '/';
        c.twitter = c.twitter ? 'https://twitter.com/@' + c.twitter : '';
        c.route = '/channel/' + c.id;
        c.listeners = c.listeners | 0;
        c.updated = c.updated | 0;
        c.favorite = false;
        c.active = false;
        output.push(c);
      }
    }
    return output;
  }

  function item(data) {
    var item = Lampa.Template.get('radio_item', {
      name: data.title,
      genre: data.genre,
      description: data.description
    });
    var img = item.find('img')[0];
    img.onerror = function () {
      img.src = './img/img_broken.svg';
    };
    img.src = data.image;
    this.render = function () {
      return item;
    };
    this.destroy = function () {
      img.onerror = function () { };
      img.onload = function () { };
      img.src = '';
      item.remove();
    };
  }

  function component() {
    var network = new Lampa.Reguest();
    var scroll = new Lampa.Scroll({
      mask: true,
      over: true,
      step: 250
    });
    var player = window.radio_player;
    var items = [];
    var html = $('<div></div>');
    var body = $('<div class="category-full"></div>');
    var active;
    var last;
    this.create = function () {
      var _this = this;
      this.activity.loader(true);
      var prox = Lampa.Platform.is('webos') || Lampa.Platform.is('tizen') || Lampa.Storage.field('proxy_other') === false ? '' : '';
      network["native"](prox + api_url, this.build.bind(this), function () {
        var empty = new Lampa.Empty();
        html.append(empty.render());
        _this.start = empty.start;
        _this.activity.loader(false);
        _this.activity.toggle();
      });
      return this.render();
    };
    this.build = function (data) {
      scroll.minus();
      var stations = parseChannels(data.channels).sort(function (a, b) {
        return a.sort - b.sort;
      });
      this.append(stations);
      scroll.append(body);
      html.append(scroll.render());
      this.activity.loader(false);
      this.activity.toggle();
    };
    this.append = function (element) {
      element.forEach(function (el) {
        var item$1 = new item(el);
        item$1.render().on('hover:focus', function () {
          last = item$1.render()[0];
          active = items.indexOf(item$1);
          scroll.update(items[active].render(), true);
        }).on('hover:enter', function () {
          player.play(el);
        });
        body.append(item$1.render());
        items.push(item$1);
      });
    };
    this.back = function () {
      Lampa.Activity.backward();
    };
    this.background = function () {
      Lampa.Background.immediately('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAAAAAA6fptVAAAADUlEQVR42gECAP3/AAAAAgABUyucMAAAAABJRU5ErkJggg==');
    };
    this.start = function () {
      if (Lampa.Activity.active().activity !== this.activity) return;
      this.background();
      Lampa.Controller.add('content', {
        toggle: function toggle() {
          Lampa.Controller.collectionSet(scroll.render());
          Lampa.Controller.collectionFocus(last || false, scroll.render());
        },
        left: function left() {
          if (Navigator.canmove('left')) Navigator.move('left'); else Lampa.Controller.toggle('menu');
        },
        right: function right() {
          Navigator.move('right');
        },
        up: function up() {
          if (Navigator.canmove('up')) Navigator.move('up'); else Lampa.Controller.toggle('head');
        },
        down: function down() {
          if (Navigator.canmove('down')) Navigator.move('down');
        },
        back: this.back
      });
      Lampa.Controller.toggle('content');
    };
    this.pause = function () { };
    this.stop = function () { };
    this.render = function () {
      return html;
    };
    this.destroy = function () {
      network.clear();
      Lampa.Arrays.destroy(items);
      scroll.destroy();
      html.remove();
      items = null;
      network = null;
    };
  }

  function player() {
    var html = Lampa.Template.get('radio_player', {});
    var audio = new Audio();
    var url = '';
    var format = '';
    var played = false;
    var hls;
    audio.addEventListener("play", function (event) {
      played = true;
      html.toggleClass('loading', false);
    });
    function prepare() {
      if (audio.canPlayType('audio/vnd.apple.mpegurl')) load(); else if (Hls.isSupported() && format == "aacp") {
        try {
          hls = new Hls();
          hls.attachMedia(audio);
          hls.loadSource(url);
          hls.on(Hls.Events.ERROR, function (event, data) {
            if (data.details === Hls.ErrorDetails.MANIFEST_PARSING_ERROR) {
              if (data.reason === "no EXTM3U delimiter") {
                Lampa.Noty.show(Lampa.Lang.translate("radio_error"));
              }
            }
          });
          hls.on(Hls.Events.MANIFEST_LOADED, function () {
            start();
          });
        } catch (e) {
          Lampa.Noty.show(Lampa.Lang.translate("radio_error"));
        }
      } else load();
    }
    function load() {
      audio.src = url;
      audio.load();
      start();
    }
    function start() {
      var playPromise;
      try {
        playPromise = audio.play();
      } catch (e) { }
      if (playPromise !== undefined) {
        playPromise.then(function () {
          console.log('SomaFM', 'start playing');
        })["catch"](function (e) {
          console.log('SomaFM', 'play promise error:', e.message);
        });
      }
    }
    function play() {
      html.toggleClass('loading', true);
      html.toggleClass('stop', false);
      prepare();
    }
    function stop() {
      played = false;
      html.toggleClass('stop', true);
      html.toggleClass('loading', false);
      if (hls) {
        hls.destroy();
        hls = false;
      }
      audio.src = '';
    }
    html.on('hover:enter', function () {
      if (played) stop(); else if (url) play();
    });
    this.create = function () {
      $('.head__actions .open--search').before(html);
    };
    this.play = function (data) {
      stop();
      // url = data.stream_320 ? data.stream_320 : data.stream_128 ? data.stream_128 : data.stream_hls.replace('playlist.m3u8', '96/playlist.m3u8');
      url = data.mp3file ? data.mp3file : data.aacfile;
      html.find('.radio-player__name').text(data.title);
      html.toggleClass('hide', false);
      play();
    };
  }

  function startPlugin() {
    window.somafm = true;
    Lampa.Component.add('somafm', component);
    Lampa.Template.add('radio_item', "<div class=\"selector radio-item\">\n        <div class=\"radio-item__imgbox\">\n            <img class=\"radio-item__img\" />\n        </div>\n\n        <div class=\"radio-item__name\">{name}</div>\n    </div>");
    Lampa.Template.add('radio_player', "<div class=\"selector radio-player stop hide\">\n        <div class=\"radio-player__name\">Radio Soma FM</div>\n\n        <div class=\"radio-player__button\">\n            <i></i>\n            <i></i>\n            <i></i>\n            <i></i>\n        </div>\n    </div>");
    Lampa.Template.add('radio_style', "<style>\n.radio-item {\n  margin-left: 1em;\n  margin-bottom: 1em;\n  width: 12.5%;\n  -webkit-flex-shrink: 0;\n  -ms-flex-negative: 0;\n  flex-shrink: 0;\n}\n.radio-item__imgbox {\n  background-color: #3e3e3e;\n  padding-bottom: 100%;\n  position: relative;\n  -webkit-border-radius: 0.3em;\n  -moz-border-radius: 0.3em;\n  border-radius: 0.3em;\n}\n.radio-item__img {\n  position: absolute;\n  top: 0;\n  left: 0;\n  width: 100%;\n  height: 100%;\n  border-radius: 0.4em;\n}\n.radio-item__name {\n  font-size: 1.1em;\n  margin-top: 0.8em;\n}\n.radio-item.focus .radio-item__imgbox:after {\n  border: solid 0.26em #fff;\n  content: \"\";\n  display: block;\n  position: absolute;\n  left: -0.5em;\n  top: -0.5em;\n  right: -0.5em;\n  bottom: -0.5em;\n  -webkit-border-radius: 0.8em;\n  -moz-border-radius: 0.8em;\n  border-radius: 0.8em;\n}\n\n@-webkit-keyframes sound {\n  0% {\n    height: 0.1em;\n  }\n  100% {\n    height: 1em;\n  }\n}\n\n@-moz-keyframes sound {\n  0% {\n    height: 0.1em;\n  }\n  100% {\n    height: 1em;\n  }\n}\n\n@-o-keyframes sound {\n  0% {\n    height: 0.1em;\n  }\n  100% {\n    height: 1em;\n  }\n}\n\n@keyframes sound {\n  0% {\n    height: 0.1em;\n  }\n  100% {\n    height: 1em;\n  }\n}\n@-webkit-keyframes sound-loading {\n  0% {\n    -webkit-transform: rotate(0deg);\n    transform: rotate(0deg);\n  }\n  100% {\n    -webkit-transform: rotate(360deg);\n    transform: rotate(360deg);\n  }\n}\n@-moz-keyframes sound-loading {\n  0% {\n    -moz-transform: rotate(0deg);\n    transform: rotate(0deg);\n  }\n  100% {\n    -moz-transform: rotate(360deg);\n    transform: rotate(360deg);\n  }\n}\n@-o-keyframes sound-loading {\n  0% {\n    -o-transform: rotate(0deg);\n    transform: rotate(0deg);\n  }\n  100% {\n    -o-transform: rotate(360deg);\n    transform: rotate(360deg);\n  }\n}\n@keyframes sound-loading {\n  0% {\n    -webkit-transform: rotate(0deg);\n    -moz-transform: rotate(0deg);\n    -o-transform: rotate(0deg);\n    transform: rotate(0deg);\n  }\n  100% {\n    -webkit-transform: rotate(360deg);\n    -moz-transform: rotate(360deg);\n    -o-transform: rotate(360deg);\n    transform: rotate(360deg);\n  }\n}\n.radio-player {\n  display: -webkit-box;\n  display: -webkit-flex;\n  display: -moz-box;\n  display: -ms-flexbox;\n  display: flex;\n  -webkit-box-align: center;\n  -webkit-align-items: center;\n  -moz-box-align: center;\n  -ms-flex-align: center;\n  align-items: center;\n  -webkit-border-radius: 0.3em;\n  -moz-border-radius: 0.3em;\n  border-radius: 0.3em;\n  padding: 0.2em 0.8em;\n  background-color: #3e3e3e;\n}\n.radio-player__name {\n  margin-right: 1em;\n  white-space: nowrap;\n  overflow: hidden;\n  -o-text-overflow: ellipsis;\n  text-overflow: ellipsis;\n  max-width: 8em;\n}\n@media screen and (max-width: 580px) {\n  .radio-item {\n    width: 20%;\n  }\n}\n@media screen and (max-width: 385px) {\n  .radio-player__name {\n    display: none;\n  }\n  .radio-item__name {\n    display: none;\n  }\n  .radio-item {\n    width: 25%;\n  }\n}\n.radio-player__button {\n  position: relative;\n  width: 1.5em;\n  height: 1.5em;\n  display: -webkit-box;\n  display: -webkit-flex;\n  display: -moz-box;\n  display: -ms-flexbox;\n  display: flex;\n  -webkit-box-align: center;\n  -webkit-align-items: center;\n  -moz-box-align: center;\n  -ms-flex-align: center;\n  align-items: center;\n  -webkit-box-pack: center;\n  -webkit-justify-content: center;\n  -moz-box-pack: center;\n  -ms-flex-pack: center;\n  justify-content: center;\n  -webkit-flex-shrink: 0;\n  -ms-flex-negative: 0;\n  flex-shrink: 0;\n}\n.radio-player__button i {\n  display: block;\n  width: 0.2em;\n  background-color: #fff;\n  margin: 0 0.1em;\n  -webkit-animation: sound 0ms -800ms linear infinite alternate;\n  -moz-animation: sound 0ms -800ms linear infinite alternate;\n  -o-animation: sound 0ms -800ms linear infinite alternate;\n  animation: sound 0ms -800ms linear infinite alternate;\n  -webkit-flex-shrink: 0;\n  -ms-flex-negative: 0;\n  flex-shrink: 0;\n}\n.radio-player__button i:nth-child(1) {\n  -webkit-animation-duration: 474ms;\n  -moz-animation-duration: 474ms;\n  -o-animation-duration: 474ms;\n  animation-duration: 474ms;\n}\n.radio-player__button i:nth-child(2) {\n  -webkit-animation-duration: 433ms;\n  -moz-animation-duration: 433ms;\n  -o-animation-duration: 433ms;\n  animation-duration: 433ms;\n}\n.radio-player__button i:nth-child(3) {\n  -webkit-animation-duration: 407ms;\n  -moz-animation-duration: 407ms;\n  -o-animation-duration: 407ms;\n  animation-duration: 407ms;\n}\n.radio-player__button i:nth-child(4) {\n  -webkit-animation-duration: 458ms;\n  -moz-animation-duration: 458ms;\n  -o-animation-duration: 458ms;\n  animation-duration: 458ms;\n}\n.radio-player.stop .radio-player__button {\n  -webkit-border-radius: 100%;\n  -moz-border-radius: 100%;\n  border-radius: 100%;\n  border: 0.2em solid #fff;\n}\n.radio-player.stop .radio-player__button i {\n  display: none;\n}\n.radio-player.stop .radio-player__button:after {\n  content: \"\";\n  width: 0.5em;\n  height: 0.5em;\n  background-color: #fff;\n}\n.radio-player.loading .radio-player__button:before {\n  content: \"\";\n  display: block;\n  border-top: 0.2em solid #fff;\n  border-left: 0.2em solid transparent;\n  border-right: 0.2em solid transparent;\n  border-bottom: 0.2em solid transparent;\n  -webkit-animation: sound-loading 1s linear infinite;\n  -moz-animation: sound-loading 1s linear infinite;\n  -o-animation: sound-loading 1s linear infinite;\n  animation: sound-loading 1s linear infinite;\n  width: 0.9em;\n  height: 0.9em;\n  -webkit-border-radius: 100%;\n  -moz-border-radius: 100%;\n  border-radius: 100%;\n  -webkit-flex-shrink: 0;\n  -ms-flex-negative: 0;\n  flex-shrink: 0;\n}\n.radio-player.loading .radio-player__button i {\n  display: none;\n}\n.radio-player.focus {\n  background-color: #fff;\n  color: #000;\n}\n.radio-player.focus .radio-player__button {\n  border-color: #000;\n}\n.radio-player.focus .radio-player__button i,\n.radio-player.focus .radio-player__button:after {\n  background-color: #000;\n}\n.radio-player.focus .radio-player__button:before {\n  border-top-color: #000;\n}\n</style>");
    window.radio_player = new player();
    Lampa.Listener.follow('app', function (e) {
      if (e.type == 'ready') {
        var button = $("<li class=\"menu__item selector\" data-action=\"radio\">\n                <div class=\"menu__ico\">\n                    <svg width=\"38\" height=\"31\" viewBox=\"0 0 38 31\" fill=\"none\" xmlns=\"http://www.w3.org/2000/svg\">\n                    <rect x=\"17.613\" width=\"3\" height=\"16.3327\" rx=\"1.5\" transform=\"rotate(63.4707 17.613 0)\" fill=\"white\"/>\n                    <circle cx=\"13\" cy=\"19\" r=\"6\" fill=\"white\"/>\n                    <path fill-rule=\"evenodd\" clip-rule=\"evenodd\" d=\"M0 11C0 8.79086 1.79083 7 4 7H34C36.2091 7 38 8.79086 38 11V27C38 29.2091 36.2092 31 34 31H4C1.79083 31 0 29.2091 0 27V11ZM21 19C21 23.4183 17.4183 27 13 27C8.58173 27 5 23.4183 5 19C5 14.5817 8.58173 11 13 11C17.4183 11 21 14.5817 21 19ZM30.5 18C31.8807 18 33 16.8807 33 15.5C33 14.1193 31.8807 13 30.5 13C29.1193 13 28 14.1193 28 15.5C28 16.8807 29.1193 18 30.5 18Z\" fill=\"white\"/>\n                    </svg>\n                </div>\n                <div class=\"menu__text\">Soma FM</div>\n            </li>");
        button.on('hover:enter', function () {
          Lampa.Activity.push({
            url: '',
            title: Lampa.Lang.translate("radio_title"),
            component: 'somafm',
            page: 1
          });
        });
        $('.menu .menu__list').eq(0).append(button);
        $('body').append(Lampa.Template.get('radio_style', {}, true));
        window.radio_player.create();
      }
    });
  }
  if (!window.somafm) startPlugin();

})();
